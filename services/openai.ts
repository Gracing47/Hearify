/**
 * OpenAI Embeddings API client
 * 
 * Dev notes:
 * - Using text-embedding-3-small (1536 dimensions)
 * - Batch processing support for efficiency
 * - Returns Float32Array for direct SQLite storage
 */

import { getOpenAIKey } from '../config/api';

const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Generate embedding vectors for text (Dual-Tier)
 * 
 * @param text - Text to embed
 * @returns Object with rich (1536d) and fast (384d) embeddings
 */
export async function generateEmbedding(
    text: string
): Promise<{ rich: Float32Array; fast: Float32Array }> {
    const apiKey = await getOpenAIKey();
    if (!apiKey) {
        throw new Error('OpenAI API key not configured');
    }

    try {
        // We use text-embedding-3-large and request both dimensions via separate calls 
        // or one call with maximum dimensions and truncate locally.
        // Truncation is supported by text-embedding-3 models.

        const fetchLevel = async (dims: number) => {
            const response = await fetch(OPENAI_EMBEDDING_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'text-embedding-3-large',
                    input: text,
                    dimensions: dims
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`OpenAI API error: ${error}`);
            }

            const result = await response.json();
            return new Float32Array(result.data[0].embedding);
        };

        // Parallel fetch for speed
        const [rich, fast] = await Promise.all([
            fetchLevel(1536),
            fetchLevel(384)
        ]);

        console.log(`[OpenAI] Generated Dual Embeddings: Rich(1536d) | Fast(384d)`);

        return { rich, fast };
    } catch (error) {
        console.error('[OpenAI] Dual embedding generation failed:', error);
        throw error;
    }
}

/**
 * Generate cluster labels using GPT-4
 */
export async function generateClusterLabel(snippets: { content: string }[]): Promise<string> {
    const apiKey = await getOpenAIKey();
    if (!apiKey) return 'Untitled Cluster';

    const prompt = `Generate a 2-3 word label for this thought cluster based on these snippets. 
    The label should be memorable, specific, and user-friendly. Return ONLY the label.
    
    Snippets:
    ${snippets.map(s => `- ${s.content}`).join('\n')}`;

    try {
        const response = await fetch(OPENAI_CHAT_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini', // Fast and cheap for labeling
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 10,
                temperature: 0.5
            }),
        });

        if (!response.ok) return 'New Insights';

        const result = await response.json();
        return result.choices[0].message.content.trim().replace(/^"|"$/g, '');
    } catch (e) {
        console.error('[OpenAI] Failed to generate cluster label:', e);
        return 'Thought Cluster';
    }
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddings(
    texts: string[],
    model: string = 'text-embedding-3-large',
    dimensions?: number
): Promise<Float32Array[]> {
    const apiKey = await getOpenAIKey();
    if (!apiKey) {
        throw new Error('OpenAI API key not configured');
    }

    try {
        const response = await fetch(OPENAI_EMBEDDING_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                input: texts,
                ...(dimensions ? { dimensions } : {})
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error: ${error}`);
        }

        const result = await response.json();
        const embeddings = result.data.map((item: any) => new Float32Array(item.embedding));

        console.log(`[OpenAI] Generated ${embeddings.length} batch embeddings (${embeddings[0].length}d) using ${model}`);

        return embeddings;
    } catch (error) {
        console.error('[OpenAI] Batch embedding generation failed:', error);
        throw error;
    }
}
