import { DB, open } from '@op-engineering/op-sqlite';
import { SCHEMA, type Snippet } from './schema';

let db: DB | null = null;

/**
 * Initialize native database connection
 */
export async function initDatabase(): Promise<DB> {
    if (db) return db;

    // Open database with sqlite-vec extension enabled
    db = open({
        name: 'hearify.db',
    });

    // Create tables
    db.execute(SCHEMA.snippets);
    db.execute(SCHEMA.vectorTable);

    console.log('[DB] Native JSI Database initialized with sqlite-vec');
    return db;
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
    embedding: Float32Array
): Promise<number> {
    const database = getDb();
    const timestamp = Date.now();

    // 1. Insert into main table
    const result = database.execute(
        'INSERT INTO snippets (content, type, timestamp) VALUES (?, ?, ?)',
        [content, type, timestamp]
    );

    const snippetId = result.insertId!;

    // 2. Insert into native vector table
    database.execute(
        'INSERT INTO vec_snippets (id, embedding) VALUES (?, ?)',
        [snippetId, embedding]
    );

    console.log(`[DB] Native Insert: ${snippetId}`);
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
    const query = `
        SELECT 
            s.id, 
            s.content, 
            s.type, 
            s.timestamp,
            v.distance
        FROM vec_snippets v
        JOIN snippets s ON s.id = v.id
        WHERE embedding MATCH ?
        ORDER BY distance
        LIMIT ?
    `;

    const results = database.execute(query, [queryEmbedding, limit]);

    const elapsed = Date.now() - startTime;
    console.log(`[DB] Native Vector Search completed in ${elapsed}ms`);

    return (results.rows?._array || []) as Snippet[];
}

/**
 * Get all snippets
 */
export async function getAllSnippets(): Promise<Snippet[]> {
    const database = getDb();
    const results = database.execute('SELECT * FROM snippets ORDER BY timestamp DESC');
    return (results.rows?._array || []) as Snippet[];
}

/**
 * Delete all data
 */
export async function clearDatabase(): Promise<void> {
    const database = getDb();
    database.execute('DELETE FROM snippets');
    database.execute('DELETE FROM vec_snippets');
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
