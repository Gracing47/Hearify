/**
 * 📝 Text Analysis Utilities — Smart Merge Decision Engine
 * 
 * Features:
 * - Levenshtein Distance (Edit Distance) for textual diff quantification
 * - Jaccard Similarity for tag set comparison
 * - Smart Merge Decision Matrix (Q5B/Q6B Strategy)
 * 
 * Q5B (Threshold 0.75+): Moderate - catches conceptually related thoughts
 * Q6B (Merge Strategy): Longer/richer content wins, metadata aggregated
 */

// ============================================================================
// LEVENSHTEIN DISTANCE
// ============================================================================

/**
 * Computes Levenshtein Distance (Edit Distance) between two strings.
 * 
 * Uses the "Two Row" memory optimization:
 * - O(min(m,n)) space complexity
 * - O(m*n) time complexity
 * 
 * @param a First string
 * @param b Second string
 * @returns Number of edits (insertions, deletions, substitutions) needed
 */
export const levenshteinDistance = (a: string, b: string): number => {
    // Edge cases
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    if (a === b) return 0;

    // Swap to ensure 'a' is the shorter string (optimization)
    if (a.length > b.length) {
        [a, b] = [b, a];
    }

    const aLen = a.length;
    const bLen = b.length;

    // Two-row approach
    let prevRow = new Array(aLen + 1);
    let currRow = new Array(aLen + 1);

    // Initialize first row
    for (let i = 0; i <= aLen; i++) {
        prevRow[i] = i;
    }

    // Fill matrix
    for (let j = 1; j <= bLen; j++) {
        currRow[0] = j;

        for (let i = 1; i <= aLen; i++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            currRow[i] = Math.min(
                prevRow[i] + 1,      // Deletion
                currRow[i - 1] + 1,  // Insertion
                prevRow[i - 1] + cost // Substitution
            );
        }

        // Swap rows
        [prevRow, currRow] = [currRow, prevRow];
    }

    return prevRow[aLen];
};

/**
 * Calculates normalized Levenshtein similarity (0 to 1)
 * 1 = identical, 0 = completely different
 */
export const levenshteinSimilarity = (a: string, b: string): number => {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1; // Both empty = identical

    const distance = levenshteinDistance(a, b);
    return 1 - (distance / maxLen);
};

// ============================================================================
// JACCARD SIMILARITY (for tags/sets)
// ============================================================================

/**
 * Calculates Jaccard Similarity between two sets.
 * |A ∩ B| / |A ∪ B|
 * 
 * @param setA First set (as array)
 * @param setB Second set (as array)
 * @returns Similarity score from 0 to 1
 */
export const jaccardSimilarity = (setA: string[], setB: string[]): number => {
    const a = new Set(setA.map(s => s.toLowerCase()));
    const b = new Set(setB.map(s => s.toLowerCase()));

    if (a.size === 0 && b.size === 0) return 1;

    let intersection = 0;
    for (const item of a) {
        if (b.has(item)) intersection++;
    }

    const union = a.size + b.size - intersection;
    return intersection / union;
};

// ============================================================================
// MERGE DECISION ENGINE
// ============================================================================

export type MergeAction =
    | 'KEEP_OLD'      // New snippet adds no value, keep existing
    | 'REPLACE'       // New snippet is better, replace existing
    | 'MERGE_CONTENT' // Combine content (new expands old)
    | 'MERGE_TAGS'    // Only merge tags, keep old content
    | 'CREATE_NEW';   // Different enough to be separate

export interface MergeDecision {
    action: MergeAction;
    confidence: number;    // 0-1, how confident in this decision
    reason: string;        // Human-readable explanation
    suggestedContent?: string;
    suggestedTags?: string[];
}

interface MergeAnalysisInput {
    oldText: string;
    newText: string;
    oldTags?: string[];
    newTags?: string[];
    semanticSimilarity: number; // Cosine similarity from embeddings
}

/**
 * Smart Merge Decision Matrix (Q5B/Q6B Strategy)
 * 
 * Analyzes the relationship between old and new content
 * and recommends the optimal merge strategy.
 * 
 * Q6B Strategy: Longer/richer content wins, metadata aggregated
 */
export const analyzeMerge = ({
    oldText,
    newText,
    oldTags = [],
    newTags = [],
    semanticSimilarity
}: MergeAnalysisInput): MergeDecision => {

    // Calculate metrics
    const textSimilarity = levenshteinSimilarity(oldText, newText);
    const tagJaccard = jaccardSimilarity(oldTags, newTags);
    const lengthRatio = newText.length / (oldText.length || 1);
    const hasNewTags = newTags.some(t => !oldTags.includes(t));
    
    // Q6B: Count "richness" metrics
    const newWordCount = extractWords(newText).length;
    const oldWordCount = extractWords(oldText).length;
    const newHasMoreContent = newWordCount > oldWordCount * 1.2; // 20% more words
    const oldHasMoreContent = oldWordCount > newWordCount * 1.2;

    // ====================================================================
    // DECISION TREE (Q5B/Q6B Optimized)
    // ====================================================================

    // Case 1: Exact duplicate (same text, same meaning)
    if (semanticSimilarity > 0.98 && textSimilarity > 0.95) {
        // Just update timestamp, maybe merge tags
        if (hasNewTags) {
            return {
                action: 'MERGE_TAGS',
                confidence: 0.99,
                reason: 'Exakt ähnlich - Tags zusammengeführt',
                suggestedTags: [...new Set([...oldTags, ...newTags])],
            };
        }
        return {
            action: 'KEEP_OLD',
            confidence: 0.99,
            reason: 'Identischer Gedanke bereits gespeichert',
        };
    }

    // Case 2: Near-duplicate (>0.92) - Q6B: Longer wins
    if (semanticSimilarity > 0.92) {
        if (newHasMoreContent) {
            return {
                action: 'REPLACE',
                confidence: 0.95,
                reason: 'Neuer Text erweitert bestehenden Gedanken',
                suggestedContent: newText,
                suggestedTags: [...new Set([...oldTags, ...newTags])],
            };
        }
        return {
            action: 'MERGE_TAGS',
            confidence: 0.92,
            reason: 'Ähnlicher Inhalt - Metadaten aktualisiert',
            suggestedTags: [...new Set([...oldTags, ...newTags])],
        };
    }

    // Case 3: High similarity (>0.85) - Q6B: Richer content wins
    if (semanticSimilarity > 0.85) {
        if (newHasMoreContent || lengthRatio > 1.3) {
            return {
                action: 'REPLACE',
                confidence: 0.9,
                reason: 'Reichhaltigere Version des Gedankens',
                suggestedContent: newText,
                suggestedTags: [...new Set([...oldTags, ...newTags])],
            };
        }
        if (oldHasMoreContent) {
            return {
                action: 'MERGE_TAGS',
                confidence: 0.85,
                reason: 'Bestehender Text detaillierter - Tags ergänzt',
                suggestedTags: [...new Set([...oldTags, ...newTags])],
            };
        }
        // Similar length - merge tags
        return {
            action: 'MERGE_TAGS',
            confidence: 0.8,
            reason: 'Gleiche Tiefe - Metadaten zusammengeführt',
            suggestedTags: [...new Set([...oldTags, ...newTags])],
        };
    }

    // Case 4: Conceptual match (0.75-0.85) - Q5B Threshold
    if (semanticSimilarity > 0.75) {
        // Q6B: Create merge with richer content as base
        if (newHasMoreContent) {
            return {
                action: 'MERGE_CONTENT',
                confidence: 0.75,
                reason: 'Verwandter Gedanke - erweiterte Version gespeichert',
                suggestedContent: newText,
                suggestedTags: [...new Set([...oldTags, ...newTags])],
            };
        }
        // Link them semantically but keep both
        return {
            action: 'CREATE_NEW',
            confidence: 0.7,
            reason: 'Verwandter aber eigenständiger Gedanke',
        };
    }

    // Case 5: Low similarity - definitely different
    return {
        action: 'CREATE_NEW',
        confidence: 0.95,
        reason: 'Einzigartiger neuer Gedanke',
    };
};

// ============================================================================
// HELPER UTILITIES
// ============================================================================

/**
 * Extracts words from text for basic comparison
 */
export const extractWords = (text: string): string[] => {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2);
};

/**
 * Calculates word overlap ratio between two texts
 */
export const wordOverlap = (textA: string, textB: string): number => {
    const wordsA = new Set(extractWords(textA));
    const wordsB = new Set(extractWords(textB));

    if (wordsA.size === 0 && wordsB.size === 0) return 1;

    let overlap = 0;
    for (const word of wordsA) {
        if (wordsB.has(word)) overlap++;
    }

    return overlap / Math.max(wordsA.size, wordsB.size);
};
