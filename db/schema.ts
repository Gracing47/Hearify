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
  z: number;
  importance: number;
  connection_count: number;
  last_accessed: number | null;
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
      y REAL DEFAULT 0,
      z REAL DEFAULT 0,
      importance REAL DEFAULT 1.0,
      connection_count INTEGER DEFAULT 0,
      last_accessed INTEGER,
      cluster_id INTEGER,
      cluster_label TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_snippets_type ON snippets(type);
    CREATE INDEX IF NOT EXISTS idx_snippets_cluster ON snippets(cluster_id);
  `,
  // Tier 1: Fast Vector Shadow Table (384-dim for real-time)
  vectorTableFast: `
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_snippets_fast USING vec0(
      id INTEGER PRIMARY KEY,
      embedding float[384]
    );
  `,

  // Tier 2: Rich Vector Shadow Table (1536-dim for deep context)
  vectorTableRich: `
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_snippets USING vec0(
      id INTEGER PRIMARY KEY,
      embedding float[1536]
    );
  `,

  // Pre-computed Semantic Edges
  semanticEdges: `
    CREATE TABLE IF NOT EXISTS semantic_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      target_id INTEGER NOT NULL,
      weight REAL NOT NULL,
      edge_type TEXT DEFAULT 'weak',
      visual_priority INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(source_id) REFERENCES snippets(id) ON DELETE CASCADE,
      FOREIGN KEY(target_id) REFERENCES snippets(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_edges_source ON semantic_edges(source_id);
    CREATE INDEX IF NOT EXISTS idx_edges_target ON semantic_edges(target_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_edges_unique ON semantic_edges(source_id, target_id);
  `,

  // Cluster Centroids (Pre-computed)
  clusterCentroids: `
    CREATE TABLE IF NOT EXISTS cluster_centroids (
      cluster_id INTEGER PRIMARY KEY,
      x REAL NOT NULL,
      y REAL NOT NULL,
      z REAL NOT NULL,
      radius REAL DEFAULT 100,
      color TEXT,
      node_count INTEGER NOT NULL,
      avg_importance REAL DEFAULT 1.0,
      ai_label TEXT,
      ai_summary TEXT,
      last_updated INTEGER NOT NULL
    );
  `,

  // MCP: External Resources
  externalResources: `
    CREATE TABLE IF NOT EXISTS external_resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id TEXT NOT NULL,
      uri TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      metadata TEXT,
      embedding BLOB,
      x REAL DEFAULT 0,
      y REAL DEFAULT 0,
      z REAL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `,

  // MCP: Resource Links
  resourceLinks: `
    CREATE TABLE IF NOT EXISTS resource_links (
      snippet_id INTEGER,
      resource_id INTEGER,
      relationship_type TEXT,
      FOREIGN KEY(snippet_id) REFERENCES snippets(id),
      FOREIGN KEY(resource_id) REFERENCES external_resources(id)
    );
  `,

  // Phase 5: Daily Delta Summaries
  dailyDeltas: `
    CREATE TABLE IF NOT EXISTS daily_deltas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      summary TEXT NOT NULL,
      highlights TEXT,
      mood TEXT CHECK(mood IN ('analytical', 'reflective', 'creative', 'mixed')),
      node_count INTEGER DEFAULT 0,
      top_clusters TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_deltas_date ON daily_deltas(date);
  `,

  // Migrations for schema evolution
  migrations: [
    `ALTER TABLE snippets ADD COLUMN z REAL DEFAULT 0;`,
    `ALTER TABLE snippets ADD COLUMN importance REAL DEFAULT 1.0;`,
    `ALTER TABLE snippets ADD COLUMN connection_count INTEGER DEFAULT 0;`,
    `ALTER TABLE snippets ADD COLUMN last_accessed INTEGER;`
  ]
};

