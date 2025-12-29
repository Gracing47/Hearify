/**
 * 🧠 Ambient Connection Engine (ACE) — Sprint 1.1
 * 
 * "Speed without Trust is worthless."
 * 
 * The ACE watches user context and surfaces relevant connections in real-time.
 * Unlike naive approaches, this engine:
 * 1. Provides REAL reasons (keyword extraction, not templates)
 * 2. Learns from feedback (penalty for rejected nodes)
 * 3. Adapts to device performance (tiers: PREMIUM, STANDARD, ECO)
 * 
 * Architecture:
 * - Debounced context watching
 * - Local keyword extraction for reasons (no API calls)
 * - Feedback loop with penalty scoring
 * - Integration with SatelliteEngine for vector search
 */

import { findKeywordMatches, findSimilarSnippets, getDb } from '../db/index';
import type { Snippet } from '../db/schema';
import { useContextStore } from '../store/contextStore';
import {
    PERFORMANCE_TIER_CONFIG,
    usePredictionStore,
    type FeedbackAction,
    type PerformanceTier,
    type Prediction,
    type PredictionType
} from '../store/predictionStore';
import { extractSharedContext, findSharedKeywords } from '../utils/nlp';
import { generateEmbedding } from './openai';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum similarity score to consider a match */
const BASE_THRESHOLD = 0.65;

/** Score penalty multiplier for rejected nodes */
const REJECTION_PENALTY = 0.5;

/** Maximum feedback history to keep (prevents memory bloat) */
const MAX_FEEDBACK_HISTORY = 100;

/** Debounce timers per tier */
const DEBOUNCE_TIMERS = {
    PREMIUM: 300,
    STANDARD: 500,
    ECO: 3000
} as const;

// ============================================================================
// TYPES
// ============================================================================

interface AmbientMatch {
    node: Snippet;
    score: number;
    embedding: Float32Array;
}

interface FeedbackEntry {
    nodeId: number;
    action: FeedbackAction;
    timestamp: number;
}

// ============================================================================
// ACE CLASS
// ============================================================================

class AmbientConnectionEngine {
    private feedbackHistory: FeedbackEntry[] = [];
    private currentTier: PerformanceTier = 'STANDARD';
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private lastQuery: string = '';
    private isProcessing: boolean = false;
    private lazyTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        if (__DEV__) {
            console.log('[ACE] 🧠 Ambient Connection Engine initialized');
        }
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Main entry point: Find predictions for user input.
     * This is called on every context change (debounced).
     */
    async findPredictions(input: string): Promise<Prediction[]> {
        if (!input || input.trim().length < 2) {
            return [];
        }

        const config = PERFORMANCE_TIER_CONFIG[this.currentTier];
        const trimmedInput = input.trim();

        try {
            // ⚡ STEP 1: Fast Local Text Search (Immediate Feedback)
            const keywordMatches = await findKeywordMatches(trimmedInput, config.maxPredictions + 5); // Fetch extra for filtering

            if (keywordMatches.length === 0) {
                return [];
            }

            // 🛡️ STEP 1.5: TRUST ENGINE - Check for Rejections
            const db = await getDb();
            const candidateIds = keywordMatches.map(n => n.id);

            let rejectedIds = new Set<number>();

            if (candidateIds.length > 0) {
                // Batch query for rejections
                const rejectionQuery = `
                    SELECT target_node_id FROM feedback_signals 
                    WHERE action_type = 'REJECTED' 
                    AND target_node_id IN (${candidateIds.join(',')})
                `;

                try {
                    const rejectionResult = await db.execute(rejectionQuery);
                    // op-sqlite returns rows as a direct array or array-like object
                    const rows = rejectionResult.rows || [];
                    // Handle both array and array-like result structures safely
                    const rowArray = Array.isArray(rows) ? rows : (rows as any)._array || Object.values(rows);

                    rowArray.forEach((r: any) => {
                        rejectedIds.add(parseInt(r.target_node_id));
                    });
                } catch (dbError) {
                    // Fallback if table doesn't exist yet (migration timing)
                    console.warn('[ACE] Feedback check failed (ignoring rejections):', dbError);
                }
            }

            // 2. Filter & Score
            const matches: AmbientMatch[] = keywordMatches
                .filter(node => !rejectedIds.has(node.id)) // Hard Filter
                .filter(node => {
                    // Skip if content has high overlap (mostly exact matches)
                    const lowerContent = node.content.toLowerCase();
                    const lowerInput = trimmedInput.toLowerCase();
                    return !lowerContent.includes(lowerInput) && !lowerInput.includes(lowerContent);
                })
                .map(node => ({
                    node,
                    score: 0.95,
                    embedding: new Float32Array(0)
                }));

            // 3. Limit to max predictions
            const limitedMatches = matches.slice(0, config.maxPredictions);

            // 4. Build predictions with reasons
            const predictions = limitedMatches.map((match, index) =>
                this.buildPrediction(match, trimmedInput, index)
            );

            return predictions;

        } catch (error) {
            console.error('[ACE] ❌ Error finding predictions:', error);
            return [];
        }
    }

    /**
     * Debounced version of findPredictions.
     * Use this in UI components for performance.
     */
    debouncedFind(input: string, callback: (predictions: Prediction[]) => void): void {
        const config = PERFORMANCE_TIER_CONFIG[this.currentTier];

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        if (input === this.lastQuery) {
            return;
        }

        this.lastQuery = input;

        this.debounceTimer = setTimeout(async () => {
            if (this.isProcessing) return;

            this.isProcessing = true;
            usePredictionStore.getState().setProcessing(true);

            try {
                const predictions = await this.findPredictions(input);

                // 🚀 Sync both stores for the Visual Bridge
                usePredictionStore.getState().setPredictions(predictions);
                useContextStore.getState().setAmbientPredictions(predictions);

                callback(predictions);

                // 🐢 STEP 2: Lazy Vector Search (only after idle > 2s)
                this.scheduleLazyVectorSearch(input);
            } finally {
                this.isProcessing = false;
                usePredictionStore.getState().setProcessing(false);
            }
        }, config.debounce);
    }

    /**
     * Deep Semantic Search after typing pause.
     * Prevents API spam while ensuring "Wow" intelligence.
     */
    private scheduleLazyVectorSearch(input: string) {
        if (this.lazyTimer) clearTimeout(this.lazyTimer);

        // Skip for short input or ECO mode
        if (input.length < 15 || this.currentTier === 'ECO') return;

        this.lazyTimer = setTimeout(async () => {
            if (__DEV__) console.log('[ACE] 🐢 Triggering Lazy Vector Search...');

            try {
                // 1. Get embedding (Semantic Search)
                const { rich: embedding } = await generateEmbedding(input);
                const vectorMatches = await findSimilarSnippets(embedding, 3);

                if (vectorMatches.length === 0) return;

                // 2. Score and Filter (Avoid duplicates with Keyword matches)
                const kwPredictions = usePredictionStore.getState().predictions;
                const kwIds = new Set(kwPredictions.map(p => p.nodeId));

                const semanticPredictions: Prediction[] = vectorMatches
                    .filter(node => !kwIds.has(node.id)) // Skip already found ones
                    .map((node, index) => ({
                        id: `ace_semantic_${node.id}_${Date.now()}`,
                        nodeId: node.id,
                        type: 'SEMANTIC',
                        node,
                        confidence: 0.85, // Vectors are high confidence
                        reason: `Ähnlicher Kontext zu deinem Text`,
                        trigger: input,
                        timestamp: Date.now()
                    }));

                if (semanticPredictions.length > 0) {
                    const combined = [...kwPredictions, ...semanticPredictions].slice(0, 5);
                    usePredictionStore.getState().setPredictions(combined);
                    useContextStore.getState().setAmbientPredictions(combined);
                }

            } catch (error) {
                console.warn('[ACE] Lazy search failed:', error);
            }
        }, 2000); // 2s Idle Pause
    }

    /**
     * Record user feedback for a prediction.
     * This affects future scoring via the penalty system.
     */
    async recordFeedback(nodeId: number, action: FeedbackAction): Promise<void> {
        try {
            // Write to DB
            const db = await getDb();
            await db.execute(
                `INSERT INTO feedback_signals (source_node_id, target_node_id, action_type) VALUES (?, ?, ?)`,
                ['user_input', nodeId.toString(), action]
            );

            // Update local history
            const entry: FeedbackEntry = {
                nodeId,
                action,
                timestamp: Date.now()
            };

            this.feedbackHistory.push(entry);

            if (this.feedbackHistory.length > MAX_FEEDBACK_HISTORY) {
                this.feedbackHistory = this.feedbackHistory.slice(-MAX_FEEDBACK_HISTORY);
            }

            // Update Store
            usePredictionStore.getState().recordFeedback(
                `prediction_${nodeId}_${Date.now()}`,
                nodeId,
                action
            );

            if (__DEV__) {
                console.log(`[ACE] 📝 Saved Feedback: ${action} for node #${nodeId}`);
            }

        } catch (e) {
            console.error('[ACE] Failed to record feedback:', e);
        }
    }

    /**
     * Set the performance tier.
     * Call this based on device info or user preference.
     */
    setTier(tier: PerformanceTier): void {
        this.currentTier = tier;
        usePredictionStore.getState().setTier(tier);

        if (__DEV__) {
            const config = PERFORMANCE_TIER_CONFIG[tier];
            console.log(`[ACE] ⚡ Tier changed: ${tier} (debounce: ${config.debounce}ms, max: ${config.maxPredictions})`);
        }
    }

    /**
     * Get current tier configuration
     */
    getConfig() {
        return PERFORMANCE_TIER_CONFIG[this.currentTier];
    }

    // ========================================================================
    // VECTOR SEARCH
    // ========================================================================

    // Repurposed or removed as we use direct Keyword matching now
    // Future: Lazy Vektor call here when idle > 2s
    private async performVectorSearch(input: string): Promise<AmbientMatch[]> {
        return [];
    }

    // ========================================================================
    // FEEDBACK PENALTY
    // ========================================================================

    private applyFeedbackPenalty(matches: AmbientMatch[]): AmbientMatch[] {
        return matches
            .map(match => {
                const wasRejected = this.wasRejected(match.node.id);
                const adjustedScore = wasRejected
                    ? match.score * REJECTION_PENALTY
                    : match.score;

                return {
                    ...match,
                    score: adjustedScore
                };
            })
            .filter(match => match.score >= BASE_THRESHOLD)
            .sort((a, b) => b.score - a.score);
    }

    private wasRejected(nodeId: number): boolean {
        return this.feedbackHistory.some(
            f => f.nodeId === nodeId && f.action === 'REJECTED'
        );
    }

    // ========================================================================
    // PREDICTION BUILDING
    // ========================================================================

    private buildPrediction(
        match: AmbientMatch,
        input: string,
        index: number
    ): Prediction {
        const config = PERFORMANCE_TIER_CONFIG[this.currentTier];

        // Trust Engine: Keyword Context
        let reason = "Thematisch verwandt";
        if (config.showReason) {
            const shared = extractSharedContext(input, match.node.content);
            if (shared) {
                reason = `Erwähnt: ${shared}`;
            }
        }

        return {
            id: `ace_${match.node.id}_${Date.now()}_${index}`,
            nodeId: match.node.id,
            type: 'KEYWORD',
            node: match.node,
            confidence: match.score,
            reason,
            trigger: input,
            timestamp: Date.now()
        };
    }

    private determinePredictionType(node: Snippet, input: string): PredictionType {
        const sharedKeywords = findSharedKeywords(input, node.content, 1);

        if (sharedKeywords.length > 0) {
            return 'SEMANTIC';
        }

        // Check if recently accessed
        if (node.last_accessed && Date.now() - node.last_accessed < 3600000) {
            return 'TEMPORAL';
        }

        return 'SEMANTIC';
    }

    // ========================================================================
    // STATS
    // ========================================================================

    getAcceptedCount(): number {
        return this.feedbackHistory.filter(f => f.action === 'ACCEPTED').length;
    }

    getRejectedCount(): number {
        return this.feedbackHistory.filter(f => f.action === 'REJECTED').length;
    }

    getStats() {
        return {
            tier: this.currentTier,
            config: PERFORMANCE_TIER_CONFIG[this.currentTier],
            feedbackCount: this.feedbackHistory.length,
            acceptedCount: this.getAcceptedCount(),
            rejectedCount: this.getRejectedCount()
        };
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    destroy(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.feedbackHistory = [];
        this.lastQuery = '';

        if (__DEV__) {
            console.log('[ACE] 🧠 Engine destroyed');
        }
    }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const ace = new AmbientConnectionEngine();

