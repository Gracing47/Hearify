/**
 * 🧠 Semantic Deduplication Service — The "Brain" of the Memory System
 * 
 * Architecture:
 * 1. Generate embedding for new snippet
 * 2. Search existing snippets for semantic matches
 * 3. Apply Smart Merge logic
 * 4. Provide user feedback via Toast Queue
 * 
 * Thresholds:
 * - > 0.90: Near-duplicate (KEEP_OLD or MERGE_TAGS)
 * - > 0.85: High similarity (MERGE or REPLACE)
 * - 0.70-0.85: Related (CREATE_NEW with edge)
 * - < 0.70: Unique (CREATE_NEW)
 */

import { findSimilarSnippets, getDb, insertSnippet } from '@/db';
import { Snippet } from '@/db/schema';
import { generateEmbedding } from '@/services/openai';
import { useContextStore } from '@/store/contextStore';
import { toast } from '@/store/toastStore';
import { analyzeMerge, MergeDecision } from '@/utils/textAnalysis';
import { cosineSimilarityFull, normalizeVector } from '@/utils/vectorMath';

// ============================================================================
// CONSTANTS
// ============================================================================

const THRESHOLDS = {
    NEAR_DUPLICATE: 0.92,  // Almost identical
    HIGH_SIMILARITY: 0.85, // Same concept
    RELATED: 0.70,         // Related topic
};

// ============================================================================
// TYPES
// ============================================================================

export interface SaveSnippetResult {
    success: boolean;
    snippetId: number | null;
    action: 'created' | 'merged' | 'replaced' | 'skipped';
    message: string;
    existingSnippetId?: number;
}

export interface SaveSnippetInput {
    content: string;
    type: 'fact' | 'feeling' | 'goal';
    sentiment?: 'analytical' | 'positive' | 'creative' | 'neutral';
    topic?: string;
    reasoning?: string;
    hashtags?: string;
}

// ============================================================================
// MAIN SERVICE
// ============================================================================

/**
 * Intelligently saves a snippet with semantic deduplication.
 * 
 * This is the main entry point for all snippet saves.
 * It handles:
 * 1. Embedding generation
 * 2. Similarity search
 * 3. Smart merge decisions
 * 4. Database operations
 * 5. User feedback (toasts)
 */
export async function saveSnippetWithDedup(input: SaveSnippetInput): Promise<SaveSnippetResult> {
    const { content, type, sentiment = 'neutral', topic = 'misc', reasoning, hashtags } = input;

    console.log('[SemanticDedup] Processing:', content.substring(0, 50) + '...');

    try {
        // ================================================================
        // STEP 1: Generate Embedding
        // ================================================================
        const { rich: embeddingRich, fast: embeddingFast } = await generateEmbedding(content);

        if (!embeddingRich) {
            console.error('[SemanticDedup] Failed to generate embedding');
            toast.error('Memory Error', 'Could not process thought');
            return {
                success: false,
                snippetId: null,
                action: 'skipped',
                message: 'Embedding generation failed',
            };
        }

        // Normalize for cosine similarity optimization
        const normalizedEmbedding = normalizeVector(embeddingRich);

        // ================================================================
        // STEP 2: Find Similar Snippets
        // ================================================================
        const similarSnippets = await findSimilarSnippets(normalizedEmbedding, 5);

        console.log('[SemanticDedup] Found', similarSnippets.length, 'candidates');

        // ================================================================
        // STEP 3: Check for Duplicates
        // ================================================================
        if (similarSnippets.length > 0) {
            // Get the most similar snippet
            const bestMatch = similarSnippets[0];

            // Calculate exact similarity (the distance from vec search)
            // Note: findSimilarSnippets returns distance, we need similarity
            // For sqlite-vec, distance is typically L2, so we recalculate cosine
            const existingEmbedding = await getSnippetEmbedding(bestMatch.id);

            if (existingEmbedding) {
                const similarity = cosineSimilarityFull(normalizedEmbedding, existingEmbedding);

                console.log('[SemanticDedup] Best match similarity:', similarity.toFixed(3));

                // High similarity detected - analyze merge
                if (similarity >= THRESHOLDS.RELATED) {
                    const decision = analyzeMerge({
                        oldText: bestMatch.content,
                        newText: content,
                        semanticSimilarity: similarity,
                    });

                    console.log('[SemanticDedup] Merge decision:', decision.action, decision.reason);

                    // Execute the decision
                    const result = await executeMergeDecision(
                        decision,
                        bestMatch,
                        content,
                        type,
                        sentiment,
                        topic,
                        normalizedEmbedding,
                        embeddingFast,
                        reasoning,
                        hashtags
                    );

                    return result;
                }
            }
        }

        // ================================================================
        // STEP 4: Create New Snippet (No duplicates found)
        // ================================================================
        const snippetId = await insertSnippet(
            content,
            type,
            normalizedEmbedding,
            embeddingFast || undefined,
            sentiment,
            topic,
            undefined, // x
            undefined, // y
            reasoning,
            hashtags
        );

        console.log('[SemanticDedup] Created new snippet:', snippetId);

        // Trigger node refresh for Neural Horizon
        useContextStore.getState().triggerNodeRefresh();

        // Show success toast
        toast.success('Memory Saved', getTypeLabel(type));

        return {
            success: true,
            snippetId,
            action: 'created',
            message: 'New unique thought stored',
        };

    } catch (error) {
        console.error('[SemanticDedup] Error:', error);
        toast.error('Save Failed', 'Could not store memory');
        return {
            success: false,
            snippetId: null,
            action: 'skipped',
            message: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ============================================================================
// MERGE EXECUTION
// ============================================================================

async function executeMergeDecision(
    decision: MergeDecision,
    existingSnippet: Snippet,
    newContent: string,
    newType: 'fact' | 'feeling' | 'goal',
    sentiment: string,
    topic: string,
    newEmbedding: Float32Array,
    newEmbeddingFast: Float32Array | null,
    reasoning?: string,
    newHashtags?: string
): Promise<SaveSnippetResult> {
    const db = getDb();
    const mergedHashtags = mergeHashtags(existingSnippet.hashtags, newHashtags);

    switch (decision.action) {
        case 'KEEP_OLD':
            // Just update timestamp to bubble it up and merge hashtags
            await db.execute(
                'UPDATE snippets SET timestamp = ?, hashtags = ? WHERE id = ?',
                [Date.now(), mergedHashtags, existingSnippet.id]
            );

            toast.duplicate('Already Remembered', 'Similar memory exists');

            return {
                success: true,
                snippetId: existingSnippet.id,
                action: 'skipped',
                message: decision.reason,
                existingSnippetId: existingSnippet.id,
            };

        case 'REPLACE':
            // Update existing with new content
            await db.execute(
                `UPDATE snippets SET 
                    content = ?, 
                    type = ?,
                    sentiment = ?,
                    topic = ?,
                    hashtags = ?,
                    timestamp = ?,
                    reasoning = ?
                WHERE id = ?`,
                [newContent, newType, sentiment, topic, mergedHashtags, Date.now(), reasoning ?? null, existingSnippet.id]
            );

            // Update vector
            await db.execute(
                'UPDATE vec_snippets SET embedding = ? WHERE id = ?',
                [newEmbedding, existingSnippet.id]
            );

            if (newEmbeddingFast) {
                await db.execute(
                    'UPDATE vec_snippets_fast SET embedding = ? WHERE id = ?',
                    [newEmbeddingFast, existingSnippet.id]
                );
            }

            useContextStore.getState().triggerNodeRefresh();
            toast.merged('Memory Updated', 'Expanded existing thought');

            return {
                success: true,
                snippetId: existingSnippet.id,
                action: 'replaced',
                message: decision.reason,
                existingSnippetId: existingSnippet.id,
            };

        case 'MERGE_TAGS':
        case 'MERGE_CONTENT':
            // Update timestamp, topic and hashtags (soft merge)
            await db.execute(
                'UPDATE snippets SET timestamp = ?, topic = ?, hashtags = ? WHERE id = ?',
                [Date.now(), topic, mergedHashtags, existingSnippet.id]
            );

            toast.merged('Memory Linked', 'Added to existing thought');

            return {
                success: true,
                snippetId: existingSnippet.id,
                action: 'merged',
                message: decision.reason,
                existingSnippetId: existingSnippet.id,
            };

        case 'CREATE_NEW':
        default:
            // Create as new but potentially create edge to related
            const snippetId = await insertSnippet(
                newContent,
                newType,
                newEmbedding,
                newEmbeddingFast || undefined,
                sentiment as any,
                topic,
                undefined,
                undefined,
                reasoning,
                newHashtags
            );

            // Create semantic edge if related
            if (decision.confidence < 0.9) {
                try {
                    await db.execute(
                        `INSERT OR IGNORE INTO semantic_edges 
                            (source_id, target_id, weight, created_at) 
                        VALUES (?, ?, ?)`,
                        [snippetId, existingSnippet.id, decision.confidence]
                    );
                } catch (e) {
                    // Edge creation is non-critical
                }
            }

            useContextStore.getState().triggerNodeRefresh();
            toast.success('Memory Saved', 'New related thought stored');

            return {
                success: true,
                snippetId,
                action: 'created',
                message: 'Created with semantic link',
                existingSnippetId: existingSnippet.id,
            };
    }
}

/**
 * Helper to combine and deduplicate hashtag strings
 */
function mergeHashtags(oldTags?: string, newTags?: string): string {
    const tags = new Set<string>();
    const splitRegex = /[\s,]+/;

    if (oldTags) {
        oldTags.split(splitRegex).forEach(t => {
            const tag = t.trim().toLowerCase();
            if (tag) tags.add(tag.startsWith('#') ? tag : `#${tag}`);
        });
    }

    if (newTags) {
        newTags.split(splitRegex).forEach(t => {
            const tag = t.trim().toLowerCase();
            if (tag) tags.add(tag.startsWith('#') ? tag : `#${tag}`);
        });
    }

    return Array.from(tags).join(' ');
}

// ============================================================================
// HELPERS
// ============================================================================

async function getSnippetEmbedding(snippetId: number): Promise<Float32Array | null> {
    try {
        const db = getDb();
        const result = await db.execute(
            'SELECT embedding FROM vec_snippets WHERE id = ?',
            [snippetId]
        );

        if (result.rows && result.rows.length > 0) {
            const row = result.rows[0];
            if (row.embedding) {
                return new Float32Array(row.embedding as ArrayBuffer);
            }
        }
    } catch (e) {
        console.warn('[SemanticDedup] Could not fetch embedding:', e);
    }
    return null;
}

function getTypeLabel(type: 'fact' | 'feeling' | 'goal'): string {
    switch (type) {
        case 'fact': return '💎 Fact captured';
        case 'feeling': return '💜 Feeling stored';
        case 'goal': return '🎯 Goal remembered';
    }
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Deduplicates the entire database (for maintenance)
 * This is a heavy operation and should only run when device is charging.
 */
export async function runFullDeduplication(): Promise<{ removed: number; merged: number }> {
    console.log('[SemanticDedup] Starting full deduplication...');

    // TODO: Implement batch deduplication
    // This would iterate through all snippets and find/merge duplicates

    return { removed: 0, merged: 0 };
}
