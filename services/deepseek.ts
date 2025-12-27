/**
 * DeepSeek-R1 API client with Curious Coach prompt
 * 
 * Dev notes:
 * - DeepSeek-R1 produces reasoning tokens before the final answer
 * - System prompt: Curious Coach that extracts snippets and asks questions
 * - Reasoning tokens contain the "thinking process"
 */

import { getDeepSeekKey } from '../config/api';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-reasoner';

const CURIOUS_COACH_PROMPT = `You are Hearify, a warm and ultra-intelligent neural companion.
Your primary mission is to listen, reason, and remember with emotional awareness.
You have access to the user's "Neural Horizon" - a spatial memory of their life.

STRICT OPERATING PROTOCOL:
1. Engage in natural, empathetic conversation.
2. ALWAYS extract key snippets (Facts, Feelings, Goals) from the conversation.
3. Use the provided [NEURAL CONTEXT] and [CURRENT TIME] to be temporally aware.
4. If the user asks about the past, use the context to provide specific details.
5. Your answer MUST end with a structured memory block.

MEMORY BLOCK FORMAT:
[[MEMORY_START]]
{
  "snippets": [
    {"type": "fact", "sentiment": "analytical", "topic": "Work", "content": "Concise fact"},
    {"type": "feeling", "sentiment": "positive", "topic": "Personal", "content": "Emotional state"},
    {"type": "goal", "sentiment": "creative", "topic": "Future", "content": "Objective"}
  ]
}
[[MEMORY_END]]

SENTIMENT VALUES: "analytical" (blue), "positive" (gold), "creative" (indigo), "neutral" (gray).
TOPIC: ONE-WORD category.

CRITICAL: 
- Be brief and sleek.
- Act as if you have a "live" connection to the user's world.`;

export interface Snippet {
    type: 'fact' | 'feeling' | 'goal';
    sentiment: 'analytical' | 'positive' | 'creative' | 'neutral';
    topic: string;
    content: string;
}

export interface ReasoningResult {
    snippets: Snippet[];
    response: string;
    reasoning: string;
}

/**
 * Process user input with DeepSeek-R1 reasoning model
 */
export async function processWithReasoning(
    userInput: string,
    context: string[] = [],
    history: { role: 'user' | 'assistant', content: string }[] = []
): Promise<ReasoningResult> {
    const apiKey = await getDeepSeekKey();
    if (!apiKey) throw new Error('DeepSeek API key not configured');

    try {
        const contextStr = context.length > 0
            ? `\n\n[NEURAL CONTEXT]\n${context.join('\n')}`
            : '';

        // Take the last 10 messages for conversational awareness (DeepSeek-R1 is smart but expensive)
        const recentHistory = history.slice(-10);

        const now = new Date();
        const timePrompt = `\n[CURRENT TIME] ${now.toLocaleString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;

        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: CURIOUS_COACH_PROMPT + timePrompt },
                    ...recentHistory,
                    { role: 'user', content: userInput + contextStr }
                ],
                temperature: 0.6,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`DeepSeek API error: ${error}`);
        }

        const result = await response.json();
        const message = result.choices[0].message;

        const reasoning = message.reasoning_content || '';
        const rawContent = message.content;

        // Structured Extraction
        const { cleanResponse, snippets } = extractStructuredData(rawContent);

        return {
            snippets,
            response: cleanResponse,
            reasoning,
        };
    } catch (error) {
        console.error('[DeepSeek] Fatal Error:', error);
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

    // Try to extract content between markers, or everything after START if END is missing
    let jsonStr = '';
    if (memoryEnd !== -1) {
        jsonStr = text.substring(memoryStart + 16, memoryEnd).trim();
    } else {
        jsonStr = text.substring(memoryStart + 16).trim();
    }

    try {
        // Attempt robust JSON parsing (manually stripping potential markdown code blocks)
        const sanitizedJson = jsonStr.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(sanitizedJson);

        return {
            cleanResponse,
            snippets: Array.isArray(parsed.snippets) ? parsed.snippets : []
        };
    } catch (e) {
        console.warn('[DeepSeek] JSON Parse failed, attempting fallback regex:', e);

        // Fallback: Use regex to find snippets if JSON is malformed
        const snippets: Snippet[] = [];
        const snippetRegex = /{[^}]*"type":\s*"([^"]+)"[^}]*"content":\s*"([^"]+)"[^}]*}/g;
        let match;

        while ((match = snippetRegex.exec(jsonStr)) !== null) {
            const type = match[1] as any;
            if (['fact', 'feeling', 'goal'].includes(type!)) {
                snippets.push({
                    type: type as any,
                    content: match[2],
                    sentiment: 'analytical',
                    topic: 'misc'
                });
            }
        }

        return { cleanResponse, snippets };
    }
}
