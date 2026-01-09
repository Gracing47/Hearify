/**
 * 🔍 Embeddings Service — Semantic Search & Auto-Generation
 * 
 * Manages embedding generation and semantic search across the knowledge graph.
 * 
 * Features:
 * - Auto-generation on snippet save (already in SemanticDedupService)
 * - Backfill utility for existing snippets without embeddings
 * - Semantic search with cosine similarity
 * - Integration with Chronicle search and ACE Ghost Suggestions
 * 
 * Database:
 * - vec_snippets (1536d rich embeddings for deep semantic search)
 * - vec_snippets_fast (384d fast embeddings for real-time suggestions)
 */

import { getDb, isDatabaseReady } from '@/db';
import { Snippet } from '@/db/schema';
import { generateEmbedding } from './openai';

/**
 * Backfill embeddings for snippets that don't have them
 * Useful after database migrations or bulk imports
 */
export async function backfillEmbeddings(): Promise<{
  processed: number;
  skipped: number;
  failed: number;
}> {
  if (!isDatabaseReady()) {
    throw new Error('Database not ready');
  }

  console.log('[Embeddings] Starting backfill...');
  const db = getDb();

  // Get all snippets
  const snippetsResult = await db.execute('SELECT id, content FROM snippets');
  const snippets = (snippetsResult.rows || []) as { id: number; content: string }[];

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const snippet of snippets) {
    try {
      // Check if embedding already exists
      const existingRich = await db.execute(
        'SELECT id FROM vec_snippets WHERE id = ?',
        [snippet.id]
      );

      if (existingRich.rows && existingRich.rows.length > 0) {
        skipped++;
        continue;
      }

      // Generate embeddings
      console.log(`[Embeddings] Generating for snippet ${snippet.id}...`);
      const { rich, fast } = await generateEmbedding(snippet.content);

      // Insert into vector tables
      await db.execute(
        'INSERT OR REPLACE INTO vec_snippets (id, embedding) VALUES (?, ?)',
        [snippet.id, rich as any]
      );

      await db.execute(
        'INSERT OR REPLACE INTO vec_snippets_fast (id, embedding) VALUES (?, ?)',
        [snippet.id, fast as any]
      );

      processed++;
      console.log(`[Embeddings] ✅ Snippet ${snippet.id} embedded`);

      // Rate limiting: 500ms delay to respect OpenAI API limits
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`[Embeddings] ❌ Failed for snippet ${snippet.id}:`, error);
      failed++;
    }
  }

  console.log(`[Embeddings] Backfill complete: ${processed} processed, ${skipped} skipped, ${failed} failed`);

  return { processed, skipped, failed };
}

/**
 * Search snippets by semantic similarity
 * 
 * @param query - Natural language search query
 * @param limit - Maximum number of results (default: 10)
 * @param threshold - Minimum similarity score (0-1, default: 0.7)
 * @param useFast - Use fast embeddings for real-time search (default: false)
 * @returns Array of snippets with similarity scores
 */
export async function searchByEmbedding(
  query: string,
  limit: number = 10,
  threshold: number = 0.7,
  useFast: boolean = false
): Promise<Array<Snippet & { similarity: number }>> {
  if (!isDatabaseReady()) {
    return [];
  }

  try {
    const db = getDb();

    // Generate query embedding
    const { rich, fast } = await generateEmbedding(query);
    const queryEmbedding = useFast ? fast : rich;
    const tableName = useFast ? 'vec_snippets_fast' : 'vec_snippets';

    // Vector search using sqlite-vec
    // Note: sqlite-vec uses vec_distance_cosine() for similarity
    const result = await db.execute(
      `SELECT 
        s.*,
        (1 - vec_distance_cosine(v.embedding, ?)) as similarity
      FROM snippets s
      INNER JOIN ${tableName} v ON s.id = v.id
      WHERE (1 - vec_distance_cosine(v.embedding, ?)) >= ?
      ORDER BY similarity DESC
      LIMIT ?`,
      [queryEmbedding as any, queryEmbedding as any, threshold, limit]
    );

    return (result.rows || []) as unknown as Array<Snippet & { similarity: number }>;

  } catch (error) {
    console.error('[Embeddings] Search failed:', error);
    return [];
  }
}

/**
 * Find similar snippets to a given snippet
 * 
 * @param snippetId - ID of the snippet to find similar items for
 * @param limit - Maximum number of results
 * @param threshold - Minimum similarity score
 * @returns Array of similar snippets with scores
 */
export async function findSimilarSnippets(
  snippetId: number,
  limit: number = 5,
  threshold: number = 0.7
): Promise<Array<Snippet & { similarity: number }>> {
  if (!isDatabaseReady()) {
    return [];
  }

  try {
    const db = getDb();

    // Get embedding for source snippet
    const embeddingResult = await db.execute(
      'SELECT embedding FROM vec_snippets WHERE id = ?',
      [snippetId]
    );

    if (!embeddingResult.rows || embeddingResult.rows.length === 0) {
      console.warn(`[Embeddings] No embedding found for snippet ${snippetId}`);
      return [];
    }

    const sourceEmbedding = embeddingResult.rows[0].embedding;

    // Find similar snippets (excluding self)
    const result = await db.execute(
      `SELECT 
        s.*,
        (1 - vec_distance_cosine(v.embedding, ?)) as similarity
      FROM snippets s
      INNER JOIN vec_snippets v ON s.id = v.id
      WHERE s.id != ? 
        AND (1 - vec_distance_cosine(v.embedding, ?)) >= ?
      ORDER BY similarity DESC
      LIMIT ?`,
      [sourceEmbedding as any, snippetId, sourceEmbedding as any, threshold, limit]
    );

    return (result.rows || []) as unknown as Array<Snippet & { similarity: number }>;

  } catch (error) {
    console.error('[Embeddings] findSimilarSnippets failed:', error);
    return [];
  }
}

/**
 * Get embedding statistics
 * Useful for debugging and monitoring
 */
export async function getEmbeddingStats(): Promise<{
  totalSnippets: number;
  withRichEmbeddings: number;
  withFastEmbeddings: number;
  missingEmbeddings: number;
}> {
  if (!isDatabaseReady()) {
    return {
      totalSnippets: 0,
      withRichEmbeddings: 0,
      withFastEmbeddings: 0,
      missingEmbeddings: 0,
    };
  }

  const db = getDb();

  const [totalResult, richResult, fastResult] = await Promise.all([
    db.execute('SELECT COUNT(*) as count FROM snippets'),
    db.execute('SELECT COUNT(*) as count FROM vec_snippets'),
    db.execute('SELECT COUNT(*) as count FROM vec_snippets_fast'),
  ]);

  const total = Number(totalResult.rows?.[0]?.count || 0);
  const rich = Number(richResult.rows?.[0]?.count || 0);
  const fast = Number(fastResult.rows?.[0]?.count || 0);

  return {
    totalSnippets: total,
    withRichEmbeddings: rich,
    withFastEmbeddings: fast,
    missingEmbeddings: total - Math.min(rich, fast),
  };
}

/**
 * Search snippets by text and embeddings (hybrid search)
 * Combines full-text search with semantic search for best results
 * 
 * @param query - Search query
 * @param limit - Maximum results
 * @returns Ranked snippets with combined scores
 */
export async function hybridSearch(
  query: string,
  limit: number = 10
): Promise<Array<Snippet & { score: number; match_type: string }>> {
  if (!isDatabaseReady()) {
    return [];
  }

  try {
    const db = getDb();

    // 1. Full-text search (keyword matching)
    const textResults = await db.execute(
      `SELECT *, 1.0 as score, 'text' as match_type 
       FROM snippets 
       WHERE content LIKE ? OR topic LIKE ? OR hashtags LIKE ?
       LIMIT ?`,
      [`%${query}%`, `%${query}%`, `%${query}%`, limit]
    );

    // 2. Semantic search (vector similarity)
    const semanticResults = await searchByEmbedding(query, limit, 0.6);

    // 3. Combine and deduplicate
    const combinedMap = new Map<number, Snippet & { score: number; match_type: string }>();

    // Add text results
    (textResults.rows || []).forEach((row: any) => {
      combinedMap.set(row.id, { ...row, score: 1.0, match_type: 'text' });
    });

    // Add semantic results (boost score if already in text results)
    semanticResults.forEach((row) => {
      const existing = combinedMap.get(row.id);
      if (existing) {
        // Hybrid match: text + semantic
        combinedMap.set(row.id, {
          ...row,
          score: (existing.score + row.similarity) / 2,
          match_type: 'hybrid',
        });
      } else {
        // Semantic only
        combinedMap.set(row.id, {
          ...row,
          score: row.similarity,
          match_type: 'semantic',
        });
      }
    });

    // Sort by combined score
    const results = Array.from(combinedMap.values()).sort((a, b) => b.score - a.score);

    return results.slice(0, limit);

  } catch (error) {
    console.error('[Embeddings] Hybrid search failed:', error);
    return [];
  }
}

/**
 * Test utility: Generate test embedding and verify storage
 */
export async function testEmbeddingPipeline(): Promise<boolean> {
  console.log('\n=== Embedding Pipeline Test ===\n');

  try {
    const testText = 'This is a test snippet for embedding verification';

    // 1. Generate embedding
    console.log('[Test] Generating embedding...');
    const { rich, fast } = await generateEmbedding(testText);
    console.log(`[Test] ✅ Generated: Rich=${rich.length}d, Fast=${fast.length}d`);

    // 2. Check database connection
    if (!isDatabaseReady()) {
      console.log('[Test] ❌ Database not ready');
      return false;
    }

    // 3. Get stats
    const stats = await getEmbeddingStats();
    console.log('[Test] Current stats:', stats);

    // 4. Test search
    console.log('[Test] Testing semantic search...');
    const results = await searchByEmbedding('test snippet', 5, 0.5);
    console.log(`[Test] Found ${results.length} similar snippets`);

    console.log('\n✅ Embedding pipeline test passed!\n');
    return true;

  } catch (error) {
    console.error('\n❌ Embedding pipeline test failed:', error);
    return false;
  }
}
