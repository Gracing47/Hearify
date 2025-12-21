/**
 * Groq Whisper API client for ultra-fast transcription
 * 
 * Dev notes:
 * - Using whisper-large-v3-turbo: 247x real-time speed
 * - Target latency: <500ms for typical voice recordings
 * - WAV format recommended for lowest latency
 */

import { getGroqKey } from '../config/api';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

export interface TranscriptionResult {
    text: string;
    duration: number; // processing time in ms
}

/**
 * Transcribe audio using Groq Whisper API
 * 
 * @param audioUri - Local file URI of audio recording
 * @returns Transcribed text and processing duration
 */
export async function transcribeAudio(audioUri: string): Promise<TranscriptionResult> {
    const apiKey = await getGroqKey();
    if (!apiKey) {
        throw new Error('Groq API key not configured');
    }

    const startTime = Date.now();

    try {
        // Create form data according to React Native file upload standards
        const formData = new FormData();

        // In React Native, we append an object with uri, name, and type for file uploads
        formData.append('file', {
            uri: audioUri,
            name: 'audio.wav',
            type: 'audio/wav',
        } as any);

        formData.append('model', 'whisper-large-v3-turbo');
        formData.append('response_format', 'json');

        console.log(`[Groq] Sending transcription request to ${GROQ_API_URL}...`);

        // Call Groq API
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                // Do NOT set 'Content-Type': 'multipart/form-data' manually,
                // the browser/RN will set it with the correct boundary.
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Groq API error: ${error}`);
        }

        const result = await response.json();
        const duration = Date.now() - startTime;

        console.log(`[Groq] Transcription completed in ${duration}ms (target: <500ms)`);
        console.log(`[Groq] Text: "${result.text}"`);

        return {
            text: result.text,
            duration,
        };
    } catch (error) {
        console.error('[Groq] Transcription failed:', error);
        throw error;
    }
}
