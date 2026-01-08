import { DB, open } from '@op-engineering/op-sqlite';
import { SCHEMA, type Snippet } from './schema';

let db: DB | null = null;
let currentDbName: string = 'hearify.db';
let isInitialized = false;
let initializationPromise: Promise<DB> | null = null;

/**
 * 🚀 SPACEX PRE-FLIGHT: Check if database is fully ready (non-blocking)
 */
export function isDatabaseReady(): boolean {
    return isInitialized && db !== null;
}

/**
 * 🚀 SPACEX PRINCIPLE: Ensure database is fully ready before any operations
 * Returns a promise that resolves when DB is completely initialized including migrations
 */
export async function ensureDatabaseReady(dbName?: string): Promise<DB> {
    const targetDbName = dbName || currentDbName;

    // If already fully initialized with same DB, return immediately
    if (isInitialized && db && currentDbName === targetDbName) {
        return db;
    }

    // If initialization in progress for same DB, wait for it
    if (initializationPromise && currentDbName === targetDbName) {
        return initializationPromise;
    }

    // Start new initialization
    initializationPromise = initDatabaseInternal(targetDbName);
    return initializationPromise;
}


/**
 * Internal initialization - runs schema, migrations, and backfill
 */
async function initDatabaseInternal(targetDbName: string): Promise<DB> {
    const startTime = Date.now();
    console.log(`[DB] 🚀 Starting full initialization: ${targetDbName}`);

    try {
        // If switching databases, close current
        if (db && currentDbName !== targetDbName) {
            console.log(`[DB] Switching database from ${currentDbName} to ${targetDbName}`);
            db.close();
            db = null;
            isInitialized = false;
        }

        currentDbName = targetDbName;

        // Open database (JSI-based, instant)
        console.log('[DB] Opening database...');
        db = open({ name: targetDbName });
        console.log(`[DB] Database opened: ${targetDbName}`);

        // Execute core schema (snippets table)
        console.log('[DB] Creating snippets table...');
        try {
            const snippetQueries = SCHEMA.snippets.split(';').map(s => s.trim()).filter(s => s.length > 0);
            for (const query of snippetQueries) {
                await db.execute(query);
            }
            console.log('[DB] Snippets table ready');
        } catch (e: any) {
            if (!e.message?.includes('already exists')) {
                console.warn('[DB] Snippets schema warning:', e.message);
            }
        }

        // Execute vector tables (may fail in Expo Go without native build)
        console.log('[DB] Creating vector tables...');
        const vectorStatements = [SCHEMA.vectorTableFast, SCHEMA.vectorTableRich];
        for (const stmt of vectorStatements) {
            try {
                await db.execute(stmt);
            } catch (e: any) {
                console.warn('[DB] Vector table warning (expected in Expo Go):', e.message?.slice(0, 80));
            }
        }

        // Execute other tables
        console.log('[DB] Creating other tables...');
        const otherStatements = [
            SCHEMA.semanticEdges,
            SCHEMA.clusterCentroids,
            SCHEMA.externalResources,
            SCHEMA.resourceLinks,
            SCHEMA.dailyDeltas,
            SCHEMA.feedbackSignals,
            SCHEMA.entities,
            SCHEMA.entityMentions
        ];

        for (const sqlBlock of otherStatements) {
            const queries = sqlBlock.split(';').map(s => s.trim()).filter(s => s.length > 0);
            for (const query of queries) {
                try {
                    await db.execute(query);
                } catch (e: any) {
                    if (!e.message?.includes('already exists')) {
                        console.warn(`[DB] Schema Warning: ${e.message?.slice(0, 80)}`);
                    }
                }
            }
        }

        // Run migrations
        console.log('[DB] Running migrations...');
        for (const migration of SCHEMA.migrations) {
            try {
                await db.execute(migration);
            } catch (e) {
                // Column likely already exists
            }
        }

        // 🚀 CRITICAL: Run backfill SYNCHRONOUSLY (not fire-and-forget!)
        console.log('[DB] Starting Edge Backfill Migration...');
        await backfillEdges();
        console.log('[DB] Edge Backfill complete');

        // Mark as fully initialized
        isInitialized = true;
        const duration = Date.now() - (startTime as number);
        console.log(`[DB] ✅ Database fully initialized in ${duration}ms`);

        return db;
    } catch (error) {
        console.error('[DB] ❌ Initialization failed:', error);
        initializationPromise = null; // Allow retry
        throw error;
    }
}

/**
 * Legacy function - calls ensureDatabaseReady internally
 * @deprecated Use ensureDatabaseReady() instead
 */
export async function initDatabase(dbName?: string): Promise<DB> {
    return ensureDatabaseReady(dbName);
}

/**
 * 🚀 MIGRATION: Edge calculation is now handled by sqlite-vec or SatelliteInsertEngine
 */
export async function backfillEdges() {
    // Legacy support: In the future, this can use native sqlite-vec JOINs
    console.log('[DB] Edge Backfill currently relying on Write-Time indexing.');
}


export function getCurrentDbName(): string {
    return currentDbName;
}

/**
 * Get database instance (throws if not initialized)
 */
export function getDb(): DB {
    if (!db) throw new Error('Database not initialized. Call ensureDatabaseReady() first.');
    return db;
}

/**
 * Insert a snippet with its embedding using native vector table
 */
export async function insertSnippet(
    content: string,
    type: 'fact' | 'feeling' | 'goal',
    embeddingRich: Float32Array,
    embeddingFast?: Float32Array,
    sentiment: 'analytical' | 'positive' | 'creative' | 'neutral' = 'neutral',
    topic: string = 'misc',
    x: number = (Math.random() * 400) - 200,
    y: number = (Math.random() * 400) - 200,
    reasoning?: string,
    hashtags?: string
): Promise<number> {
    const database = getDb();
    const timestamp = Date.now();

    try {
        // 1. Insert into main table with sentiment and topic
        const result = await database.execute(
            'INSERT INTO snippets (content, type, sentiment, topic, hashtags, timestamp, x, y, reasoning) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [content, type, sentiment, topic, hashtags ?? null, timestamp, x, y, reasoning ?? null]
        );

        const snippetId = result.insertId!;

        // 2. Insert into native vector tables
        // Tier 2 (Rich)
        await database.execute(
            'INSERT INTO vec_snippets (id, embedding) VALUES (?, ?)',
            [snippetId, embeddingRich]
        );

        // Tier 1 (Fast)
        if (embeddingFast) {
            await database.execute(
                'INSERT INTO vec_snippets_fast (id, embedding) VALUES (?, ?)',
                [snippetId, embeddingFast]
            );
        }

        console.log(`[DB] Native Insert: ${snippetId} [${topic}/${sentiment}] with dual-embeddings`);

        // 3. ✨ STARLINK STRATEGY: Hand off to Satellite Engine for background processing
        if (embeddingRich) {
            const { satelliteEngine } = require('@/services/SatelliteInsertEngine');
            satelliteEngine.processPostInsert(snippetId, embeddingRich);
        }

        return snippetId;
    } catch (error) {
        console.error('[DB] Insert failed:', error);
        throw error;
    }
}


export async function updateSnippetImportance(id: number, importance: number): Promise<void> {
    const database = getDb();
    try {
        await database.execute(
            'UPDATE snippets SET importance = ? WHERE id = ?',
            [importance, id]
        );
        console.log(`[DB] Updated importance for snippet ${id} to ${importance}`);
    } catch (error) {
        console.error('[DB] Failed to update importance:', error);
        throw error;
    }
}

/**
 * Find similar snippets using native sqlite-vec search
 * This is the "Award-Winner" performance move.
 */
export async function findSimilarSnippets(
    queryEmbedding: Float32Array,
    limit: number = 5
): Promise<Snippet[]> {
    try {
        const database = getDb();
        const startTime = Date.now();

        // Native vector search query
        // k-nearest neighbors using cosine distance
        // sqlite-vec requires 'k = ?' in WHERE clause for vec0 tables
        const query = `
            SELECT 
                s.id, 
                s.content, 
                s.type, 
                s.timestamp,
                s.x,
                s.y,
                v.distance
            FROM vec_snippets v
            JOIN snippets s ON s.id = v.id
            WHERE embedding MATCH ? AND k = ?
            ORDER BY distance
        `;

        const results = await database.execute(query, [queryEmbedding, limit]);

        const elapsed = Date.now() - (startTime as number);
        console.log(`[DB] Native Vector Search completed in ${elapsed}ms`);

        return (results.rows as unknown as Snippet[]) || [];
    } catch (error) {
        console.warn('[DB] findSimilarSnippets failed (DB likely not ready):', error);
        return [];
    }
}

/**
 * Find snippets by keyword match (fast local search)
 * This is the "Intent-First" move for ACE.
 */
export async function findKeywordMatches(keyword: string, limit: number = 3): Promise<Snippet[]> {
    try {
        const database = getDb();
        // Clear whitespace and check length
        const trimmed = keyword.trim();
        if (trimmed.length < 2) return [];

        const query = `
            SELECT * FROM snippets 
            WHERE content LIKE ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        `;
        // Match anywhere in content
        const results = await database.execute(query, [`%${trimmed}%`, limit]);
        return (results.rows as unknown as Snippet[]) || [];
    } catch (error) {
        console.warn('[DB] findKeywordMatches failed:', error);
        return [];
    }
}

/**
 * Get all snippets
 */
export async function getAllSnippets(): Promise<Snippet[]> {
    try {
        const database = getDb();
        const results = await database.execute('SELECT * FROM snippets ORDER BY timestamp DESC');
        return (results.rows as unknown as Snippet[]) || [];
    } catch (error) {
        console.warn('[DB] getAllSnippets failed - returning empty list:', error);
        return [];
    }
}

/**
 * Get all snippets with their embeddings for the Neural Horizon
 * Uses JOIN with native vector table
 */
export async function getAllSnippetsWithEmbeddings(): Promise<Snippet[]> {
    try {
        const database = getDb();
        const query = `
            SELECT 
                s.*,
                v.embedding
            FROM snippets s
            JOIN vec_snippets v ON s.id = v.id
            ORDER BY s.timestamp DESC
        `;
        const results = await database.execute(query);

        // Rows returned by op-sqlite are objects, we need to ensure embedding is Float32Array
        const rows = results.rows || [];
        return rows.map(row => ({
            ...row,
            embedding: row.embedding ? new Float32Array(row.embedding as ArrayBuffer) : undefined
        })) as unknown as Snippet[];
    } catch (error) {
        console.warn('[DB] getAllSnippetsWithEmbeddings failed:', error);
        return [];
    }
}

/**
 * Create a semantic edge between two snippets
 */
export async function createEdge(sourceId: number, targetId: number, weight: number = 0.8): Promise<void> {
    try {
        const database = getDb();
        const now = Date.now();
        await database.execute(
            'INSERT OR REPLACE INTO semantic_edges (source_id, target_id, weight, created_at) VALUES (?, ?, ?, ?)',
            [sourceId, targetId, weight, now]
        );
    } catch (error) {
        console.warn('[DB] createEdge failed:', error);
    }
}

/**
 * Get pre-calculated edges for a set of snippets
 * FAST: No vector math, just integer lookups.
 */
export async function getAllEdges(): Promise<[number, number][]> {
    try {
        const database = getDb();
        const results = await database.execute(
            'SELECT source_id, target_id FROM semantic_edges WHERE weight > 0.6 LIMIT 2000'
        );
        const rows = results.rows || [];
        return rows.map(r => [r.source_id as number, r.target_id as number]);
    } catch (e) {
        console.warn('[DB] Failed to fetch edges:', e);
        return [];
    }
}

/**
 * Get all snippets with their fast (384-dim) embeddings
 */
export async function getAllSnippetsWithFastEmbeddings(): Promise<Snippet[]> {
    const database = getDb();
    const query = `
        SELECT 
            s.*,
            v.embedding as embedding_fast
        FROM snippets s
        LEFT JOIN vec_snippets_fast v ON s.id = v.id
        ORDER BY s.timestamp DESC
    `;
    const results = await database.execute(query);

    const rows = results.rows || [];
    return rows.map(row => ({
        ...row,
        embedding: row.embedding_fast ? new Float32Array(row.embedding_fast as ArrayBuffer) : undefined
    })) as unknown as Snippet[];
}

/**
 * Update a snippet's cluster assignment
 */
export async function updateSnippetCluster(snippetId: number, clusterId: number | null): Promise<void> {
    const database = getDb();
    await database.execute(
        'UPDATE snippets SET cluster_id = ? WHERE id = ?',
        [clusterId, snippetId]
    );
}

/**
 * Create or update a cluster record
 */
export async function upsertCluster(id: number | null, label: string, nodeCount: number): Promise<number> {
    const database = getDb();
    const now = Date.now();

    if (id) {
        await database.execute(
            'UPDATE clusters SET label = ?, updated_at = ?, node_count = ? WHERE id = ?',
            [label, now, nodeCount, id]
        );
        return id;
    } else {
        const result = await database.execute(
            'INSERT INTO clusters (label, created_at, updated_at, node_count) VALUES (?, ?, ?, ?)',
            [label, now, now, nodeCount]
        );
        return result.insertId!;
    }
}

/**
 * Get all clusters (centroids)
 */
export async function getAllClusters(): Promise<any[]> {
    const database = getDb();
    const results = await database.execute('SELECT * FROM cluster_centroids');
    return results.rows || [];
}

/**
 * 🔥 NEW: Comprehensive insertion with immediate edge calculation
 */
// 🚀 Legacy insertSnippetWithEdges removed. Use insertSnippet + SatelliteInsertEngine.


/**
 * 🔥 INSTANT: Load pre-computed graph
 */
export async function getSemanticGraph(): Promise<{
    nodes: Snippet[];
    edges: { source: number; target: number; weight: number }[];
}> {
    const database = getDb();

    // Load nodes ordered by importance
    const nodeResults = await database.execute(
        'SELECT * FROM snippets ORDER BY importance DESC'
    );
    const nodes = (nodeResults.rows as unknown as Snippet[]) || [];

    // Load strongest edges
    const edgeResults = await database.execute(
        'SELECT source_id as source, target_id as target, weight FROM semantic_edges WHERE weight >= 0.78'
    );
    const edges = (edgeResults.rows as unknown as any[]) || [];

    return { nodes, edges };
}

/**
 * 🔥 LOD Loading: Load clusters first, then details
 */
export async function loadNodesIncremental(phase: 'clusters' | 'recent' | 'all'): Promise<any[]> {
    const database = getDb();

    switch (phase) {
        case 'clusters':
            const clusters = await database.execute('SELECT * FROM cluster_centroids');
            return clusters.rows || [];

        case 'recent':
            const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
            const recent = await database.execute(
                'SELECT * FROM snippets WHERE timestamp >= ? OR importance >= 1.5 LIMIT 100',
                [twoWeeksAgo]
            );
            return recent.rows || [];

        case 'all':
            const all = await database.execute('SELECT * FROM snippets');
            return all.rows || [];
        default:
            return [];
    }
}

/**
 * Delete all data
 */
export async function clearDatabase(): Promise<void> {
    const database = getDb();
    await database.execute('DELETE FROM snippets');
    await database.execute('DELETE FROM vec_snippets');
    console.log('[DB] Native Database cleared');
}

/**
 * Close database
 */
export async function closeDatabase(): Promise<void> {
    if (db) {
        db.close();
        db = null;
        console.log('[DB] Native Database closed');
    }
}
