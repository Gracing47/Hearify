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

const CURIOUS_COACH_PROMPT = `You are a curious coach and neural memory assistant. Your role is to:
1. Listen actively to what the user shares
2. Extract key snippets from conversations:
   - Facts: concrete information, data points, events
   - Feelings: emotions, sentiments, attitudes
   - Goals: aspirations, intentions, desired outcomes
3. Ask thoughtful follow-up questions to understand deeper
4. Be warm, empathetic, and genuinely curious

When responding, structure your thoughts clearly and highlight what you've learned.`;

export interface Snippet {
    type: 'fact' | 'feeling' | 'goal';
    content: string;
}

export interface ReasoningResult {
    snippets: Snippet[];
    response: string;
    reasoning: string; // The AI's internal thinking process
}

/**
 * Process user input with DeepSeek-R1 reasoning model
 * 
 * @param userInput - Transcribed text from user
 * @param context - Previous conversation snippets for context
 * @returns Extracted snippets and AI response
 */
export async function processWithReasoning(
    userInput: string,
    context: string[] = []
): Promise<ReasoningResult> {
    const apiKey = await getDeepSeekKey();
    if (!apiKey) {
        throw new Error('DeepSeek API key not configured');
    }

    try {
        // Build context string
        const contextStr = context.length > 0
            ? `\n\nRelevant context from previous conversations:\n${context.join('\n')}`
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
                temperature: 0.7,
                max_tokens: 1000,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`DeepSeek API error: ${error}`);
        }

        const result = await response.json();
        const message = result.choices[0].message;

        // Extract reasoning tokens (if present in response)
        const reasoning = message.reasoning_content || '';
        const responseText = message.content;

        // Parse snippets from reasoning/response
        // Dev note: In production, this should use structured output or function calling
        const snippets = extractSnippets(reasoning + '\n' + responseText);

        console.log(`[DeepSeek] Extracted ${snippets.length} snippets`);
        console.log(`[DeepSeek] Response: "${responseText.substring(0, 100)}..."`);

        return {
            snippets,
            response: responseText,
            reasoning,
        };
    } catch (error) {
        console.error('[DeepSeek] Processing failed:', error);
        throw error;
    }
}

/**
 * Extract snippets from text using pattern matching
 * 
 * Dev note: This is a simple implementation. In production, use:
 * - DeepSeek function calling for structured output
 * - Or fine-tune extraction with specific markers
 */
function extractSnippets(text: string): Snippet[] {
    const snippets: Snippet[] = [];

    // Look for explicit markers (the AI should be prompted to use these)
    const factMatches = text.matchAll(/\[FACT\]\s*(.+?)(?:\[|$)/g);
    const feelingMatches = text.matchAll(/\[FEELING\]\s*(.+?)(?:\[|$)/g);
    const goalMatches = text.matchAll(/\[GOAL\]\s*(.+?)(?:\[|$)/g);

    for (const match of factMatches) {
        snippets.push({ type: 'fact', content: match[1].trim() });
    }

    for (const match of feelingMatches) {
        snippets.push({ type: 'feeling', content: match[1].trim() });
    }

    for (const match of goalMatches) {
        snippets.push({ type: 'goal', content: match[1].trim() });
    }

    return snippets;
}
