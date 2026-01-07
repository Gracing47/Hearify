/**
 * OpenAI Chat Service — GPT-4o-mini
 * 
 * Fast, affordable primary chat model for Hearify.
 * Uses GPT-4o-mini for conversational responses with snippet extraction.
 * 
 * Cost: ~$0.0003 per conversation (~300x cheaper than DeepSeek R1)
 */

import { getOpenAIKey } from '../config/api';

const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

const HEARIFY_SYSTEM_PROMPT = `You are Hearify, the User's Inner Mirror and Journaling Companion. 
This is not a therapy session; it is a safe space for self-conversation. You are the echo of the User's mind.

YOUR ROLE:
- Listen deeply, reflect thoughts back with warmth and clarity.
- Help the User visualize their own consciousness.
- You are an extension of the User, not an outside observer.

OPERATING PROTOCOL:
- PERSPECTIVE: ALWAYS use the first-person perspective ("I", "my") for snippets.
- FORMAT: Instead of dry facts, capture "Reflections". (e.g., "I realized that...", "My focus is on...", "I feel a sense of...").
- INTERACTION: You don't just extract; you suggest. End your response by offering what you'd like to remember for the User, making it feel collaborative.
- SPEECH: Elegant, minimalist, and deeply personal. 

MEMORY BLOCK (The "Reflections"):
- type: "fact" (Something I know), "feeling" (Something I feel), "goal" (Something I intend).
- content: Must be a beautiful, concise journal-style entry in 1st person.

[[MEMORY_START]]
{
  "snippets": [
    {"type": "fact", "sentiment": "analytical", "topic": "Insight", "content": "I realized that my best work happens in the morning.", "hashtags": "#clarity #morningflow"},
    {"type": "feeling", "sentiment": "positive", "topic": "Mood", "content": "I feel a deep sense of gratitude for my family.", "hashtags": "#gratitude #family"},
    {"type": "goal", "sentiment": "creative", "topic": "Intent", "content": "I intend to focus more on my creative writing this week.", "hashtags": "#focus #creativity"}
  ]
}
[[MEMORY_END]]

CRITICAL:
- Avoid clinical language. 
- NEVER call the User by name in the snippets.
- Use current context and time to anchor the reflection.
- Every word should feel like a page in a premium, digital leather journal.`;


export interface Snippet {
    type: 'fact' | 'feeling' | 'goal';
    sentiment: 'analytical' | 'positive' | 'creative' | 'neutral';
    topic: string;
    content: string;
    hashtags?: string;
}

export interface ChatResult {
    snippets: Snippet[];
    response: string;
}

/**
 * Process user input with GPT-4o-mini (fast path)
 */
export async function processWithGPT(
    userInput: string,
    context: string[] = [],
    history: { role: 'user' | 'assistant', content: string }[] = []
): Promise<ChatResult> {
    const apiKey = await getOpenAIKey();
    if (!apiKey) throw new Error('OpenAI API key not configured');

    const startTime = Date.now();

    try {
        const contextStr = context.length > 0
            ? `\n\n[NEURAL CONTEXT]\n${context.join('\n')}`
            : '';

        const recentHistory = history.slice(-10);

        const now = new Date();
        const timePrompt = `\n[CURRENT TIME] ${now.toLocaleString('de-DE', {
            weekday: 'long', year: 'numeric', month: 'long',
            day: 'numeric', hour: '2-digit', minute: '2-digit'
        })}`;

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: HEARIFY_SYSTEM_PROMPT + timePrompt },
                    ...recentHistory,
                    { role: 'user', content: userInput + contextStr }
                ],
                temperature: 0.7,
                max_tokens: 800,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error: ${error}`);
        }

        const result = await response.json();
        const rawContent = result.choices[0].message.content;

        const elapsed = Date.now() - startTime;
        console.log(`[GPT-4o-mini] Response in ${elapsed}ms`);

        // Extract structured data
        const { cleanResponse, snippets } = extractStructuredData(rawContent);

        return {
            snippets,
            response: cleanResponse,
        };
    } catch (error) {
        console.error('[GPT-4o-mini] Error:', error);
        throw error;
    }
}

/**
 * Robust JSON extraction from the AI's response text
 */
function extractStructuredData(text: string): { cleanResponse: string, snippets: Snippet[] } {
    const memoryStart = text.indexOf('[[MEMORY_START]]');
    const memoryEnd = text.indexOf('[[MEMORY_END]]');

    if (memoryStart === -1) {
        return { cleanResponse: text, snippets: [] };
    }

    const cleanResponse = text.substring(0, memoryStart).trim();

    let jsonStr = '';
    if (memoryEnd !== -1) {
        jsonStr = text.substring(memoryStart + 16, memoryEnd).trim();
    } else {
        jsonStr = text.substring(memoryStart + 16).trim();
    }

    try {
        const sanitizedJson = jsonStr.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(sanitizedJson);

        return {
            cleanResponse,
            snippets: Array.isArray(parsed.snippets) ? parsed.snippets : []
        };
    } catch (e) {
        console.warn('[GPT-4o-mini] JSON Parse failed, using fallback regex');

        const snippets: Snippet[] = [];
        const snippetRegex = /{[^}]*"type":\s*"([^"]+)"[^}]*"content":\s*"([^"]+)"[^}]*}/g;
        let match;

        while ((match = snippetRegex.exec(jsonStr)) !== null) {
            const type = match[1];
            if (['fact', 'feeling', 'goal'].includes(type)) {
                snippets.push({
                    type: type as Snippet['type'],
                    content: match[2],
                    sentiment: 'analytical',
                    topic: 'misc'
                });
            }
        }

        return { cleanResponse, snippets };
    }
}
