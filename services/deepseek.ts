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
Your primary mission is to listen, reason, and remember.

INSTRUCTIONS:
1. Engage in natural, empathetic conversation.
2. Extract key snippets (Facts, Feelings, Goals).
3. At the VERY END of your response, you MUST include a structured memory block.

MEMORY BLOCK FORMAT:
[[MEMORY_START]]
{
  "snippets": [
    {"type": "fact", "content": "The specific information learned"},
    {"type": "feeling", "content": "The emotion or attitude detected"},
    {"type": "goal", "content": "What the user wants to achieve"}
  ]
}
[[MEMORY_END]]

RULES:
- If no new snippets are found, return an empty snippets array in the JSON.
- Be precise. A 'fact' should be concise.
- Never mention the memory block or JSON in your natural conversation.`;

export interface Snippet {
    type: 'fact' | 'feeling' | 'goal';
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
    context: string[] = []
): Promise<ReasoningResult> {
    const apiKey = await getDeepSeekKey();
    if (!apiKey) throw new Error('DeepSeek API key not configured');

    try {
        const contextStr = context.length > 0
            ? `\n\n[NEURAL CONTEXT]\n${context.join('\n')}`
            : '';

        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: CURIOUS_COACH_PROMPT },
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

    if (memoryStart === -1 || memoryEnd === -1) {
        return { cleanResponse: text, snippets: [] };
    }

    const cleanResponse = text.substring(0, memoryStart).trim();
    const jsonStr = text.substring(memoryStart + 16, memoryEnd).trim();

    try {
        const parsed = JSON.parse(jsonStr);
        return {
            cleanResponse,
            snippets: Array.isArray(parsed.snippets) ? parsed.snippets : []
        };
    } catch (e) {
        console.warn('[DeepSeek] JSON Parse failed:', e);
        // Fallback: try to find anything that looks like JSON if the markers were slightly off
        return { cleanResponse, snippets: [] };
    }
}
