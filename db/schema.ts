/**
 * Database schema for Hearify Phase 2: Native Neural Memory
 * 
 * Uses @op-engineering/op-sqlite with native sqlite-vec extension.
 * Target: <2ms vector search query time with JSI and native SIMD.
 */

export interface Snippet {
  id: number;
  content: string;
  type: 'fact' | 'feeling' | 'goal';
  timestamp: number;
  embedding?: Float32Array;
}

/**
 * SQL schema for snippets table and the native vector virtual table
 */
export const SCHEMA = {
  // Main metadata table
  snippets: `
    CREATE TABLE IF NOT EXISTS snippets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('fact', 'feeling', 'goal')),
      timestamp INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_snippets_timestamp ON snippets(timestamp);
    CREATE INDEX IF NOT EXISTS idx_snippets_type ON snippets(type);
  `,

  // Native Vector Shadow Table (sqlite-vec)
  // Note: Float32 vectors are 1536 dimensions for OpenAI text-embedding-3-small
  vectorTable: `
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_snippets USING vec0(
      id INTEGER PRIMARY KEY,
      embedding float[1536]
    );
  `
};
