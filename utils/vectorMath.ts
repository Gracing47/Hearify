/**
 * 📐 Vector Math Utilities — High-Performance Semantic Operations
 * 
 * Optimized for React Native / Hermes:
 * - Uses Float32Array to avoid GC pressure
 * - Pre-normalization pattern for O(n) similarity
 * - No object allocation in hot paths
 */

// ============================================================================
// COSINE SIMILARITY
// ============================================================================

/**
 * Calculates Cosine Similarity between two vectors.
 * 
 * Formula: A · B / (|A| * |B|)
 * 
 * Performance: If vectors are pre-normalized (magnitude = 1),
 * this simplifies to just the Dot Product (A · B),
 * saving two square roots and a division per comparison.
 * 
 * @param vecA First vector (should be pre-normalized)
 * @param vecB Second vector (should be pre-normalized)
 * @returns Similarity score from -1 to 1
 */
export const cosineSimilarity = (vecA: Float32Array, vecB: Float32Array): number => {
    if (vecA.length !== vecB.length) {
        console.warn('[VectorMath] Dimension mismatch:', vecA.length, 'vs', vecB.length);
        return 0;
    }

    let dotProduct = 0;

    // Simple iteration (Hermes optimizes this well)
    // For even faster performance, consider loop unrolling for fixed dimensions
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
    }

    return dotProduct;
};

/**
 * Full cosine similarity with normalization (slower, but works with non-normalized vectors)
 */
export const cosineSimilarityFull = (vecA: Float32Array, vecB: Float32Array): number => {
    if (vecA.length !== vecB.length) {
        console.warn('[VectorMath] Dimension mismatch');
        return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);

    // Prevent division by zero
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
};

// ============================================================================
// VECTOR NORMALIZATION
// ============================================================================

/**
 * Normalizes a vector IN PLACE to unit length.
 * This modifies the original array for performance.
 * 
 * @param vec Vector to normalize
 * @returns The same array (normalized)
 */
export const normalizeVectorInPlace = (vec: Float32Array): Float32Array => {
    let sumSq = 0;

    for (let i = 0; i < vec.length; i++) {
        sumSq += vec[i] * vec[i];
    }

    const magnitude = Math.sqrt(sumSq);

    // Prevent division by zero
    if (magnitude === 0) return vec;

    for (let i = 0; i < vec.length; i++) {
        vec[i] /= magnitude;
    }

    return vec;
};

/**
 * Creates a new normalized copy of the vector (immutable version)
 */
export const normalizeVector = (vec: Float32Array): Float32Array => {
    const normalized = new Float32Array(vec.length);

    let sumSq = 0;
    for (let i = 0; i < vec.length; i++) {
        sumSq += vec[i] * vec[i];
    }

    const magnitude = Math.sqrt(sumSq);

    if (magnitude === 0) {
        normalized.set(vec);
        return normalized;
    }

    for (let i = 0; i < vec.length; i++) {
        normalized[i] = vec[i] / magnitude;
    }

    return normalized;
};

// ============================================================================
// VECTOR STATISTICS
// ============================================================================

/**
 * Calculates the magnitude (L2 norm) of a vector
 */
export const vectorMagnitude = (vec: Float32Array): number => {
    let sumSq = 0;
    for (let i = 0; i < vec.length; i++) {
        sumSq += vec[i] * vec[i];
    }
    return Math.sqrt(sumSq);
};

/**
 * Checks if a vector is already normalized (magnitude ≈ 1)
 */
export const isNormalized = (vec: Float32Array, tolerance = 0.001): boolean => {
    const mag = vectorMagnitude(vec);
    return Math.abs(mag - 1.0) < tolerance;
};

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Finds the most similar vector in a collection.
 * Returns the index and similarity score.
 * 
 * @param query The query vector (should be normalized)
 * @param vectors Array of candidate vectors (should be normalized)
 * @returns { index, similarity } or null if no vectors
 */
export const findMostSimilar = (
    query: Float32Array,
    vectors: Float32Array[]
): { index: number; similarity: number } | null => {
    if (vectors.length === 0) return null;

    let bestIndex = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < vectors.length; i++) {
        const score = cosineSimilarity(query, vectors[i]);
        if (score > bestScore) {
            bestScore = score;
            bestIndex = i;
        }
    }

    return { index: bestIndex, similarity: bestScore };
};

/**
 * Finds all vectors above a similarity threshold.
 * Useful for semantic deduplication.
 * 
 * @param query The query vector
 * @param vectors Array of candidate vectors with IDs
 * @param threshold Minimum similarity score
 * @returns Array of { id, similarity } above threshold
 */
export const findAboveThreshold = <T extends { id: number; embedding: Float32Array }>(
    query: Float32Array,
    items: T[],
    threshold: number
): Array<{ item: T; similarity: number }> => {
    const results: Array<{ item: T; similarity: number }> = [];

    for (const item of items) {
        const similarity = cosineSimilarity(query, item.embedding);
        if (similarity >= threshold) {
            results.push({ item, similarity });
        }
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    return results;
};
