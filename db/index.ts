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
        SCHEMA.snippets,        // Contains TABLE + INDEX
        SCHEMA.vectorTableFast, // Virtual Table
        SCHEMA.vectorTableRich, // Virtual Table
        SCHEMA.clusters         // Standard Table
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
    return db;
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
    return snippetId;
}


/**
 * Find similar snippets using native sqlite-vec search
 * This is the "Award-Winner" performance move.
 */
export async function findSimilarSnippets(
    queryEmbedding: Float32Array,
    limit: number = 5
): Promise<Snippet[]> {
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
}

/**
 * Get all snippets
 */
export async function getAllSnippets(): Promise<Snippet[]> {
    const database = getDb();
    const results = await database.execute('SELECT * FROM snippets ORDER BY timestamp DESC');
    return (results.rows as unknown as Snippet[]) || [];
}

/**
 * Get all snippets with their embeddings for the Neural Horizon
 * Uses JOIN with native vector table
 */
export async function getAllSnippetsWithEmbeddings(): Promise<Snippet[]> {
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
 * Get all clusters
 */
export async function getAllClusters(): Promise<any[]> {
    const database = getDb();
    const results = await database.execute('SELECT * FROM clusters');
    return results.rows || [];
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
