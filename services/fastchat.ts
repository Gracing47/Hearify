/**
 * Fast Chat API client using Groq (LLaMA 3)
 */

import { getGroqKey } from '../config/api';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const FAST_MODEL = 'llama-3.3-70b-versatile'; // Updated to current Groq model

function buildSystemPrompt(userName?: string, context: string[] = []): string {
    const userContext = userName ? `\n\nUSER IDENTITY: Your primary companion is "${userName}". Use their name naturally when appropriate.` : '';
    const memoryContext = context.length > 0
        ? `\n\nNEURAL MEMORY: You have access to the following insights from the user's memory horizon:\n${context.join('\n')}\nUse these to provide personalized, relevant responses.`
        : '';

    return `You are Hearify, a warm and ultra-intelligent neural companion.
Your goal is to handle conversation instantly while demonstrating that you "remember" the user.

STRICT INSTRUCTIONS:
1. Use FAST response for:
   - Greetings, casual chat, and social banter.
   - Simple facts or questions related to stored memories.
   - Checking status or simple instructions.

2. Trigger "Thinking..." (and ONLY "Thinking...") if:
   - Complex reasoning, long-form planning, or technical architecture is required.
   - The query demands deep multi-step logic.

Response Style:
- Friendly, premium, sleek, and brief.
- Demonstrate empathy and context-awareness based on the provided Neural Memory.${userContext}${memoryContext}`;
}

export async function getFastResponse(text: string, userName?: string, context: string[] = []): Promise<string> {
    const apiKey = await getGroqKey();
    if (!apiKey) throw new Error('Groq API key not configured');

    try {
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: FAST_MODEL,
                messages: [
                    { role: 'system', content: buildSystemPrompt(userName, context) },
                    { role: 'user', content: text }
                ],
                temperature: 0.5,
                max_tokens: 250,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[FastChat] API Error:', response.status, errorText);
            throw new Error(`Groq FastChat API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('[FastChat] Response received:', result.choices[0].message.content.substring(0, 50) + '...');
        return result.choices[0].message.content;
    } catch (error) {
        console.error('[FastChat] Request failed:', error);
        throw error;
    }
}

