/**
 * Database schema for Hearify Phase 1: Neural Memory Storage
 * 
 * Uses op-sqlite with sqlite-vec extension for local vector search.
 * Target: <10ms vector search query time with JSI.
 */

export interface Snippet {
  id: number;
  content: string;
  type: 'fact' | 'feeling' | 'goal';
  timestamp: number;
  embedding?: Float32Array; // Vector representation (1536 dimensions for text-embedding-3-small)
}

/**
 * Serialize Float32Array to Blob for SQLite storage
 */
export function serializeEmbedding(embedding: Float32Array): Uint8Array {
  return new Uint8Array(embedding.buffer);
}

/**
 * Deserialize Blob from SQLite to Float32Array
 */
export function deserializeEmbedding(blob: Uint8Array): Float32Array {
  return new Float32Array(blob.buffer);
}

/**
 * SQL schema for snippets table with vector support
 */
export const SCHEMA = {
  snippets: `
    CREATE TABLE IF NOT EXISTS snippets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('fact', 'feeling', 'goal')),
      timestamp INTEGER NOT NULL,
      embedding BLOB
    );
    CREATE INDEX IF NOT EXISTS idx_snippets_timestamp ON snippets(timestamp);
    CREATE INDEX IF NOT EXISTS idx_snippets_type ON snippets(type);
  `
};
