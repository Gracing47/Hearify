/**
 * OpenAI Embeddings API client
 * 
 * Dev notes:
 * - Using text-embedding-3-small (1536 dimensions)
 * - Batch processing support for efficiency
 * - Returns Float32Array for direct SQLite storage
 */

import { getOpenAIKey } from '../config/api';

const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';
const MODEL = 'text-embedding-3-small';

/**
 * Generate embedding vector for text
 * 
 * @param text - Text to embed
 * @returns Float32Array of embedding vector (1536 dimensions)
 */
export async function generateEmbedding(text: string): Promise<Float32Array> {
    const apiKey = await getOpenAIKey();
    if (!apiKey) {
        throw new Error('OpenAI API key not configured');
    }

    try {
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL,
                input: text,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error: ${error}`);
        }

        const result = await response.json();
        const embedding = new Float32Array(result.data[0].embedding);

        console.log(`[OpenAI] Generated embedding for: "${text.substring(0, 50)}..."`);

        return embedding;
    } catch (error) {
        console.error('[OpenAI] Embedding generation failed:', error);
        throw error;
    }
}

/**
 * Generate embeddings for multiple texts in batch
 * 
 * @param texts - Array of texts to embed
 * @returns Array of Float32Array embeddings
 */
export async function generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    const apiKey = await getOpenAIKey();
    if (!apiKey) {
        throw new Error('OpenAI API key not configured');
    }

    try {
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL,
                input: texts,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error: ${error}`);
        }

        const result = await response.json();
        const embeddings = result.data.map((item: any) => new Float32Array(item.embedding));

        console.log(`[OpenAI] Generated ${embeddings.length} embeddings`);

        return embeddings;
    } catch (error) {
        console.error('[OpenAI] Batch embedding generation failed:', error);
        throw error;
    }
}
