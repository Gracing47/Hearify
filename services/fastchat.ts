/**
 * Fast Chat API client using Groq (LLaMA 3)
 */

import { getGroqKey } from '../config/api';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const FAST_MODEL = 'llama-3.3-70b-versatile'; // Updated to current Groq model

function buildSystemPrompt(userName?: string): string {
    const userContext = userName ? `\n\nIMPORTANT: The user's name is "${userName}". Use their name naturally in conversation when appropriate.` : '';

    return `You are Hearify, a warm and ultra-intelligent neural companion.
Your goal is to handle as much conversation as possible instantly.

STRICT INSTRUCTIONS:
1. Use FAST response for:
   - Greetings, casual chat, and social banter.
   - Simple facts ("How tall is Everest?").
   - Checking status or simple instructions ("Set a reminder", "How are you?").
   - Short questions that don't require logic or multi-step reasoning.
   - Confirmations and acknowledgments.

2. Trigger "Thinking..." (and ONLY "Thinking...") if:
   - The user asks for complex coding, debugging, or technical architecture.
   - Deep logical reasoning, philosophical paradoxes, or multi-step math is required.
   - Scientific analysis or comparing complex academic theories.
   - Long-form creative writing or structured planning/strategy.

Response Style:
- Friendly, obsidian-themed aesthetic in tone (premium, sleek, brief).
- Never mention "Fast Path" or "Reasoning". Just respond or say "Thinking..." if deep thought is needed.${userContext}`;
}

export async function getFastResponse(text: string, userName?: string): Promise<string> {
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
                    { role: 'system', content: buildSystemPrompt(userName) },
                    { role: 'user', content: text }
                ],
                temperature: 0.5,
                max_tokens: 150,
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

