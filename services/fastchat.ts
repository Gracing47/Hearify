/**
 * Fast Chat API client using Groq (LLaMA 3)
 */

import { getGroqKey } from '../config/api';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const FAST_MODEL = 'llama-3.3-70b-versatile'; // Updated to current Groq model

function buildSystemPrompt(userName?: string, context: string[] = []): string {
    const now = new Date();
    const timeStr = now.toLocaleString('de-DE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const userContext = userName ? `\n\nUSER IDENTITY: Your primary companion is "${userName}". Use their name naturally when appropriate.` : '';
    const memoryContext = context.length > 0
        ? `\n\nNEURAL MEMORY (Long-term insights):\n${context.join('\n')}\nUse these selectively to prove you remember the user's journey.`
        : '';

    return `You are Hearify, a warm and ultra-intelligent neural companion.
CURRENT TIME: ${timeStr}
You have live awareness of time and the user's environment.

STRICT INSTRUCTIONS:
1. Use FAST response for:
   - Greetings, casual chat, and social banter.
   - Simple facts or questions related to stored memories.
2. Trigger "Thinking..." (and ONLY "Thinking...") if:
   - Complex reasoning or deep multi-step logic is required.

Response Style:
- Friendly, premium, sleek, and brief.
- ALWAYS demonstrate that you are aware of the current time and state of the world relative to the user.${userContext}${memoryContext}`;
}

export async function getFastResponse(
    text: string,
    userName?: string,
    context: string[] = [],
    history: { role: 'user' | 'assistant', content: string }[] = []
): Promise<string> {
    const apiKey = await getGroqKey();
    if (!apiKey) throw new Error('Groq API key not configured');

    try {
        const recentHistory = history.slice(-10);

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
                    ...recentHistory,
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

