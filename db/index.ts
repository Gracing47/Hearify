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
    const statements = [
        SCHEMA.snippets,
        SCHEMA.vectorTable
    ];

    for (const sql of statements) {
        // Simple regex split for safety if schema contains multiple statements
        const individualStatements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
        for (const stmt of individualStatements) {
            try {
                await db.execute(stmt);
            } catch (e) {
                console.warn(`[DB] Note: Statement execution: ${e}`);
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
    embedding: Float32Array,
    x: number = Math.random() * 400 - 200,
    y: number = Math.random() * 400 - 200
): Promise<number> {
    const database = getDb();
    const timestamp = Date.now();

    // 1. Insert into main table
    const result = await database.execute(
        'INSERT INTO snippets (content, type, timestamp, x, y) VALUES (?, ?, ?, ?, ?)',
        [content, type, timestamp, x, y]
    );

    const snippetId = result.insertId!;

    // 2. Insert into native vector table
    await database.execute(
        'INSERT INTO vec_snippets (id, embedding) VALUES (?, ?)',
        [snippetId, embedding]
    );

    console.log(`[DB] Native Insert: ${snippetId} at (${x.toFixed(1)}, ${y.toFixed(1)})`);
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
