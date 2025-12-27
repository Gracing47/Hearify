/**
 * 🎯 LiveFocusService — Pre-Cognition Engine
 * ─────────────────────────────────────────────
 * 
 * This service provides real-time semantic focus tracking.
 * When the user speaks in Orbit, it determines the most relevant
 * area of the Horizon and provides a target for the camera drift.
 * 
 * DESIGN NOTES:
 * - Uses 384-dim embeddings for speed (vs 1536 for accuracy)
 * - KNN lookup is bounded to top 3 results for performance
 * - Focus target is smoothed using EWMA to prevent jitter
 * - All state is managed via SharedValues for zero-latency UI updates
 * 
 * PERFORMANCE CONSIDERATIONS:
 * - Embedding generation is async and should NOT block UI
 * - KNN search uses native sqlite-vec (<1ms for 10k nodes)
 * - Focus updates are throttled to max 2Hz to prevent overload
 */

import { getDb, isDatabaseReady } from '@/db';
import { generateEmbedding } from '@/services/openai';

// --- Types ---
export interface FocusTarget {
    x: number;
    y: number;
    nodeIds: number[];
    confidence: number; // 0-1, how sure we are about this focus
}

// --- Configuration ---
const CONFIG = {
    EWMA_ALPHA: 0.25,           // Smoothing factor (lower = slower drift)
    MIN_CONFIDENCE: 0.65,       // Minimum similarity to consider a valid focus
    MAX_RESULTS: 3,             // Top K nodes to consider
    THROTTLE_MS: 500,           // Minimum time between updates
    EMBEDDING_DIM: 384,         // Fast embedding dimension
};

// --- State ---
let lastUpdateTime = 0;
let currentFocus: FocusTarget = { x: 0, y: 0, nodeIds: [], confidence: 0 };

/**
 * 🚀 Compute focus target from a text fragment (e.g., partial transcript)
 * 
 * This is the core of Pre-Cognition. It takes a snippet of what the user
 * is saying and finds where in the Horizon that relates to.
 * 
 * @param textFragment - Partial or complete transcript
 * @returns FocusTarget with position and confidence
 */
export async function computeFocusTarget(textFragment: string): Promise<FocusTarget | null> {
    // Throttle to prevent overload
    const now = Date.now();
    if (now - lastUpdateTime < CONFIG.THROTTLE_MS) {
        return currentFocus; // Return cached
    }
    lastUpdateTime = now;

    // Don't compute for very short fragments
    if (!textFragment || textFragment.trim().length < 10) {
        return null;
    }

    // Ensure DB is ready
    if (!isDatabaseReady()) {
        console.debug('[LiveFocus] DB not ready, skipping');
        return null;
    }

    try {
        // Step 1: Generate fast embedding (384-dim for speed)
        const { fast: embedding } = await generateEmbedding(textFragment);

        if (!embedding) {
            console.debug('[LiveFocus] No fast embedding available');
            return null;
        }

        // Step 2: KNN lookup in native vector table
        const db = getDb();
        const query = `
            SELECT 
                s.id,
                s.x,
                s.y,
                v.distance
            FROM vec_snippets_fast v
            JOIN snippets s ON s.id = v.id
            WHERE embedding MATCH ? AND k = ?
            ORDER BY distance
        `;

        const results = await db.execute(query, [embedding, CONFIG.MAX_RESULTS]);
        const rows = results.rows || [];

        if (rows.length === 0) {
            return null;
        }

        // Step 3: Calculate weighted centroid of top results
        let sumX = 0, sumY = 0, sumWeight = 0;
        const nodeIds: number[] = [];
        let maxSimilarity = 0;

        for (const row of rows) {
            // Distance to similarity (assuming L2 distance, normalize to 0-1)
            const distance = (row as any).distance || 1;
            const similarity = Math.max(0, 1 - distance / 2); // Rough normalization

            maxSimilarity = Math.max(maxSimilarity, similarity);

            const x = (row as any).x || 0;
            const y = (row as any).y || 0;
            const id = (row as any).id;

            const weight = similarity * similarity; // Quadratic weighting
            sumX += x * weight;
            sumY += y * weight;
            sumWeight += weight;
            nodeIds.push(id);
        }

        if (sumWeight === 0 || maxSimilarity < CONFIG.MIN_CONFIDENCE) {
            return null;
        }

        // Step 4: Apply EWMA smoothing
        const rawX = sumX / sumWeight;
        const rawY = sumY / sumWeight;

        const smoothedX = currentFocus.x * (1 - CONFIG.EWMA_ALPHA) + rawX * CONFIG.EWMA_ALPHA;
        const smoothedY = currentFocus.y * (1 - CONFIG.EWMA_ALPHA) + rawY * CONFIG.EWMA_ALPHA;

        // Update cached focus
        currentFocus = {
            x: smoothedX,
            y: smoothedY,
            nodeIds,
            confidence: maxSimilarity,
        };

        console.debug(`[LiveFocus] Target: (${smoothedX.toFixed(0)}, ${smoothedY.toFixed(0)}) ` +
            `conf=${maxSimilarity.toFixed(2)} nodes=[${nodeIds.join(',')}]`);

        return currentFocus;

    } catch (error) {
        console.warn('[LiveFocus] computeFocusTarget failed:', error);
        return null;
    }
}

/**
 * Reset focus state (e.g., when conversation ends)
 */
export function resetFocus(): void {
    currentFocus = { x: 0, y: 0, nodeIds: [], confidence: 0 };
    lastUpdateTime = 0;
}

/**
 * Get current focus without computation
 */
export function getCurrentFocus(): FocusTarget {
    return { ...currentFocus };
}
