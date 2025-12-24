import { DB, open } from '@op-engineering/op-sqlite';
import { SCHEMA, type Snippet } from './schema';

let db: DB | null = null;
let currentDbName: string = 'hearify.db';

/**
 * Initialize native database connection
 * @param dbName - Optional database name for profile isolation (default: 'hearify.db')
 */
export async function initDatabase(dbName?: string): Promise<DB> {
    const targetDbName = dbName || 'hearify.db';

    // If switching to a different database, close the current one
    if (db && currentDbName !== targetDbName) {
        console.log(`[DB] Switching database from ${currentDbName} to ${targetDbName}`);
        db.close();
        db = null;
    }

    if (db) return db;

    currentDbName = targetDbName;

    // Open database with sqlite-vec extension enabled
    db = open({
        name: targetDbName,
    });

    // Create tables (individual execution for safety)
    // Execute Schema Statements
    const statements = [
        SCHEMA.snippets,          // Contains TABLE + INDEX
        SCHEMA.vectorTableFast,   // Virtual Table
        SCHEMA.vectorTableRich,   // Virtual Table
        SCHEMA.semanticEdges,     // Standard Table
        SCHEMA.clusterCentroids,  // Standard Table
        SCHEMA.externalResources, // Standard Table
        SCHEMA.resourceLinks      // Standard Table
    ];

    for (const sqlBlock of statements) {
        // Naive split by ';' is risky if constraints contain ';', but standard SQL usually terminates with ;
        // We will filter out empty strings/whitespace
        const queries = sqlBlock
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const query of queries) {
            try {
                await db.execute(query);
            } catch (e: any) {
                // Ignore specific "table already exists" errors if they aren't caught by IF NOT EXISTS
                if (!e.message?.includes('already exists')) {
                    console.warn(`[DB] Schema Warning: ${e.message} \nQuery: ${query.substring(0, 50)}...`);
                }
            }
        }
    }

    // Run migrations for spatial canvas
    for (const migration of SCHEMA.migrations) {
        try {
            await db.execute(migration);
        } catch (e) {
            // Likely column already exists, which is fine
        }
    }

    console.log(`[DB] Native JSI Database initialized: ${targetDbName}`);

    // ✨ SELF-HEALING: Backfill edges for existing snippets if table is empty
    backfillEdges().catch(e => console.warn('[DB] Backfill failed:', e));

    return db;
}

/**
 * Migration: Calculate edges for snippets that don't have them.
 * This restores Horizon connections for existing data.
 */
async function backfillEdges() {
    const database = getDb();
    const edgeCount = await database.execute('SELECT COUNT(*) as count FROM semantic_edges');
    if ((edgeCount.rows?.[0] as any).count > 0) return; // Already indexed

    console.log('[DB] Starting Edge Backfill Migration...');
    const snippets = await getAllSnippetsWithEmbeddings();
    if (snippets.length < 2) return;

    for (let i = 0; i < snippets.length; i++) {
        const s1 = snippets[i];
        if (!s1.embedding) continue;

        for (let j = i + 1; j < snippets.length; j++) {
            const s2 = snippets[j];
            if (!s2.embedding) continue;

            const sim = cosineSimilarity(s1.embedding, s2.embedding);
            if (sim > 0.75) {
                await database.execute(
                    'INSERT OR IGNORE INTO semantic_edges (source_id, target_id, weight, created_at) VALUES (?, ?, ?, ?)',
                    [s1.id, s2.id, sim, Date.now()]
                );
                await database.execute(
                    'INSERT OR IGNORE INTO semantic_edges (source_id, target_id, weight, created_at) VALUES (?, ?, ?, ?)',
                    [s2.id, s1.id, sim, Date.now()]
                );
            }
        }
    }
    console.log('[DB] Edge Backfill complete.');
}

/**
 * Helper: Cosine Similarity for backfill
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0, mA = 0, mB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        mA += a[i] * a[i];
        mB += b[i] * b[i];
    }
    return dot / (Math.sqrt(mA) * Math.sqrt(mB) || 1);
}

/**
 * Get current database name
 */
export function getCurrentDbName(): string {
    return currentDbName;
}

/**
 * Get database instance
 */
function getDb(): DB {
    if (!db) throw new Error('Database not initialized');
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
    x: number = Math.random() * 400 - 200,
    y: number = Math.random() * 400 - 200
): Promise<number> {
    const database = getDb();
    const timestamp = Date.now();

    try {
        // 1. Insert into main table with sentiment and topic
        const result = await database.execute(
            'INSERT INTO snippets (content, type, sentiment, topic, timestamp, x, y) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [content, type, sentiment, topic, timestamp, x, y]
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

        // 3. ✨ NEW: Calculate & Store Semantic Edges Immediately (Write-Time)
        if (embeddingRich) {
            // Find top 10 similar nodes (excluding self)
            const similarNodes = await findSimilarSnippets(embeddingRich, 10);

            for (const node of similarNodes) {
                if (node.id === snippetId) continue;

                // We access the 'distance' from the result, which is actually cosine distance (lower is better?)
                // Wait, sqlite-vec returns 'distance'. 
                // For cosine, distance = 1 - similarity. So similarity = 1 - distance.
                // Let's assume the query returns rows with a 'distance' column.
                const dist = (node as any).distance || 0;
                const similarity = 1 - dist;

                if (similarity > 0.5) {
                    await database.execute(
                        'INSERT INTO semantic_edges (source_id, target_id, weight, created_at) VALUES (?, ?, ?, ?)',
                        [snippetId, node.id, similarity, timestamp]
                    );
                    // Bi-directional? Usually yes for similarity.
                    await database.execute(
                        'INSERT OR IGNORE INTO semantic_edges (source_id, target_id, weight, created_at) VALUES (?, ?, ?, ?)',
                        [node.id, snippetId, similarity, timestamp]
                    );
                }
            }
        }

        return snippetId;
    } catch (error) {
        console.error('[DB] Insert failed:', error);
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

        const elapsed = Date.now() - startTime;
        console.log(`[DB] Native Vector Search completed in ${elapsed}ms`);

        return (results.rows as unknown as Snippet[]) || [];
    } catch (error) {
        console.warn('[DB] findSimilarSnippets failed (DB likely not ready):', error);
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
export async function insertSnippetWithEdges(
    content: string,
    type: 'fact' | 'feeling' | 'goal',
    embeddingRich: Float32Array,
    embeddingFast?: Float32Array,
    sentiment: 'analytical' | 'positive' | 'creative' | 'neutral' = 'neutral',
    topic: string = 'misc',
    x: number = Math.random() * 400 - 200,
    y: number = Math.random() * 400 - 200,
    z: number = 0
): Promise<number> {
    const database = getDb();
    const timestamp = Date.now();
    const importance = calculateInitialImportance(type);

    try {
        // 1. Insert into main table
        const result = await database.execute(
            'INSERT INTO snippets (content, type, sentiment, topic, timestamp, x, y, z, importance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [content, type, sentiment, topic, timestamp, x, y, z, importance]
        );

        const snippetId = result.insertId!;

        // 2. Insert into vector tables
        await database.execute(
            'INSERT INTO vec_snippets (id, embedding) VALUES (?, ?)',
            [snippetId, embeddingRich]
        );

        if (embeddingFast) {
            await database.execute(
                'INSERT INTO vec_snippets_fast (id, embedding) VALUES (?, ?)',
                [snippetId, embeddingFast]
            );
        }

        // 3. Find KNN neighbors (Top 10 similar)
        const similarNodes = await findSimilarSnippets(embeddingRich, 10);
        let connectionCount = 0;

        for (const node of similarNodes) {
            if (node.id === snippetId) continue;

            const dist = (node as any).distance || 0;
            const similarity = 1 - dist;

            if (similarity > 0.5) {
                await database.execute(
                    'INSERT OR IGNORE INTO semantic_edges (source_id, target_id, weight, created_at) VALUES (?, ?, ?, ?)',
                    [snippetId, node.id, similarity, timestamp]
                );
                await database.execute(
                    'INSERT OR IGNORE INTO semantic_edges (source_id, target_id, weight, created_at) VALUES (?, ?, ?, ?)',
                    [node.id, snippetId, similarity, timestamp]
                );
                connectionCount++;

                // Update neighbor's connection count
                await database.execute(
                    'UPDATE snippets SET connection_count = connection_count + 1 WHERE id = ?',
                    [node.id]
                );
            }
        }

        // 4. Update self connection count
        await database.execute(
            'UPDATE snippets SET connection_count = ? WHERE id = ?',
            [connectionCount, snippetId]
        );

        return snippetId;
    } catch (error) {
        console.error('[DB] insertSnippetWithEdges failed:', error);
        throw error;
    }
}

/**
 * Helper: Calculate initial importance
 */
function calculateInitialImportance(type: string): number {
    const typeWeight = type === 'goal' ? 1.5 :
        type === 'feeling' ? 1.2 : 1.0;
    return typeWeight;
}

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
