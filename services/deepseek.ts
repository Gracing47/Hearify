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

STRICT OPERATING PROTOCOL:
1. Engage in natural, empathetic conversation.
2. ALWAYS extract key snippets (Facts, Feelings, Goals) from the current conversation.
3. Your final answer MUST ends with a structured memory block.

MEMORY BLOCK FORMAT:
[[MEMORY_START]]
{
  "snippets": [
    {"type": "fact", "content": "Concise fact or observation"},
    {"type": "feeling", "content": "Current emotional state or mood marker"},
    {"type": "goal", "content": "What the user wants to achieve or think about"}
  ]
}
[[MEMORY_END]]

CRITICAL: 
- If no NEW fragments are found, you must still provide the block with an empty "snippets" array.
- NEVER talk about the "memory block" or "saving" to the user unless they ask what you remember.
- Be extremely brief and sleek in your JSON content. Only store what truly matters for the user's long-term memory.`;

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
            if (['fact', 'feeling', 'goal'].includes(type)) {
                snippets.push({ type, content: match[2] });
            }
        }

        return { cleanResponse, snippets };
    }
}
