/**
 * Fast Chat API client using Groq (LLaMA 3)
 */

import { getGroqKey } from '../config/api';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const FAST_MODEL = 'llama-3.3-70b-versatile'; // Updated to current Groq model

const INSTANT_ANSWER_PROMPT = `You are a warm, efficient neural assistant. 
For simple greetings or clear, short requests, provide a friendly, direct answer.
Keep your response concise and conversational.
If the query is complex, just say "Thinking..." (the system will then switch to reasoning).`;

export async function getFastResponse(text: string): Promise<string> {
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
                    { role: 'system', content: INSTANT_ANSWER_PROMPT },
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
