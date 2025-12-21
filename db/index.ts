import * as SQLite from 'expo-sqlite';
import { deserializeEmbedding, SCHEMA, serializeEmbedding, type Snippet } from './schema';

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize database connection and create tables
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (db) return db;

    // Open database
    db = await SQLite.openDatabaseAsync('hearify.db');

    // Create tables
    await db.execAsync(SCHEMA.snippets);

    console.log('[DB] Database initialized with expo-sqlite');
    return db;
}

/**
 * Get database instance (throws if not initialized)
 */
function getDb(): SQLite.SQLiteDatabase {
    if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
    return db;
}

/**
 * Insert a snippet with its embedding
 */
export async function insertSnippet(
    content: string,
    type: 'fact' | 'feeling' | 'goal',
    embedding: Float32Array
): Promise<number> {
    const database = getDb();
    const timestamp = Date.now();

    // Insert snippet
    const result = await database.runAsync(
        'INSERT INTO snippets (content, type, timestamp, embedding) VALUES (?, ?, ?, ?)',
        [content, type, timestamp, serializeEmbedding(embedding)]
    );

    const snippetId = result.lastInsertRowId;
    console.log(`[DB] Inserted snippet ${snippetId}: "${content.substring(0, 50)}..."`);
    return snippetId;
}

/**
 * Cosine similarity calculation in JS
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find similar snippets using vector search (JS-side similarity)
 * 
 * note: Fast enough for Phase 1 (<100 snippets)
 */
export async function findSimilarSnippets(
    queryEmbedding: Float32Array,
    limit: number = 5
): Promise<Snippet[]> {
    const database = getDb();
    const startTime = Date.now();

    // 1. Get all snippets with embeddings
    const rows: any[] = await database.getAllAsync(
        'SELECT id, content, type, timestamp, embedding FROM snippets WHERE embedding IS NOT NULL'
    );

    // 2. Calculate similarities in JS
    const scoredSnippets = rows.map(row => {
        const embedding = deserializeEmbedding(row.embedding);
        return {
            id: row.id,
            content: row.content,
            type: row.type,
            timestamp: row.timestamp,
            embedding,
            distance: 1 - cosineSimilarity(queryEmbedding, embedding)
        };
    });

    // 3. Sort and limit
    const results = scoredSnippets
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);

    const elapsed = Date.now() - startTime;
    console.log(`[DB] Vector search (JS) completed in ${elapsed}ms for ${rows.length} records`);

    return results.map(({ distance, ...snippet }) => snippet);
}

/**
 * Get all snippets ordered by timestamp
 */
export async function getAllSnippets(): Promise<Snippet[]> {
    const database = getDb();

    const results: any[] = await database.getAllAsync(
        'SELECT id, content, type, timestamp FROM snippets ORDER BY timestamp DESC'
    );

    return results.map((row: any) => ({
        id: row.id,
        content: row.content,
        type: row.type,
        timestamp: row.timestamp
    }));
}

/**
 * Delete all data (for testing/reset)
 */
export async function clearDatabase(): Promise<void> {
    const database = getDb();
    await database.execAsync('DELETE FROM snippets');
    console.log('[DB] Database cleared');
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
    if (db) {
        await db.closeAsync();
        db = null;
        console.log('[DB] Database closed');
    }
}
