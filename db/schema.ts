/**
 * Database schema for Hearify Phase 2: Native Neural Memory
 * 
 * Uses @op-engineering/op-sqlite with native sqlite-vec extension.
 * Target: <2ms vector search query time with JSI and native SIMD.
 */

export interface Snippet {
  cluster_id: number;
  id: number;
  content: string;
  type: 'fact' | 'feeling' | 'goal';
  sentiment: 'analytical' | 'positive' | 'creative' | 'neutral';
  topic: string;
  timestamp: number;
  embedding?: Float32Array;
  x: number;
  y: number;
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
      sentiment TEXT DEFAULT 'neutral' CHECK(sentiment IN ('analytical', 'positive', 'creative', 'neutral')),
      topic TEXT DEFAULT 'misc',
      timestamp INTEGER NOT NULL,
      x REAL DEFAULT 0,
      y REAL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_snippets_type ON snippets(type);
  `,
  // Tier 1: Fast Vector Shadow Table (384-dim for real-time)
  vectorTableFast: `
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_snippets_fast USING vec0(
      id INTEGER PRIMARY KEY,
      embedding float[384]
    );
  `,

  // Tier 2: Rich Vector Shadow Table (1536-dim for deep context) - Already exists
  vectorTableRich: `
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_snippets USING vec0(
      id INTEGER PRIMARY KEY,
      embedding float[1536]
    );
  `,

  // Semantic Clusters
  clusters: `
    CREATE TABLE IF NOT EXISTS clusters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      node_count INTEGER DEFAULT 0
    );
  `,

  // Migrations for schema evolution
  migrations: [
    `ALTER TABLE snippets ADD COLUMN x REAL DEFAULT 0;`,
    `ALTER TABLE snippets ADD COLUMN y REAL DEFAULT 0;`,
    `ALTER TABLE snippets ADD COLUMN sentiment TEXT DEFAULT 'neutral';`,
    `ALTER TABLE snippets ADD COLUMN topic TEXT DEFAULT 'misc';`,
    `ALTER TABLE snippets ADD COLUMN cluster_id INTEGER;`,
    `CREATE INDEX IF NOT EXISTS idx_snippets_cluster ON snippets(cluster_id);`
  ]
};

