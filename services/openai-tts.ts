/**
 * OpenAI TTS Service — TTS-1-HD
 * 
 * Replaced ElevenLabs with OpenAI TTS for cost efficiency.
 * TTS-1-HD provides high-quality voice output at ~$0.03/1K chars.
 * 
 * Available voices: alloy, echo, fable, onyx, nova, shimmer
 */

import * as FileSystem from 'expo-file-system/legacy';
import { getOpenAIKey } from '../config/api';

const MODEL = 'tts-1'; // Replaced tts-1-hd with tts-1 for real-time speed (up to 3x faster)
const VOICE = 'nova';
const API_URL = 'https://api.openai.com/v1/audio/speech';

export interface TTSOptions {
    voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
    speed?: number; // 0.25 to 4.0
}

/**
 * Generate speech audio from text using OpenAI TTS-1
 * Returns local file URI for playback
 */
export async function generateSpeech(text: string, options: TTSOptions = {}): Promise<string> {
    const apiKey = await getOpenAIKey();
    if (!apiKey) {
        throw new Error('OpenAI API key not configured');
    }

    const voice = options.voice || VOICE;
    const speed = options.speed || 1.05; // Slightly faster to feel more responsive

    console.log(`[OpenAI TTS] Generating speech for ${text.length} chars (voice: ${voice})...`);
    const startTime = Date.now();

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: MODEL,
            input: text,
            voice,
            speed,
            response_format: 'mp3',
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI TTS error: ${response.status} - ${error}`);
    }

    // Get audio as base64
    const audioBlob = await response.blob();
    const base64 = await blobToBase64(audioBlob);

    // Save to cache directory
    const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!cacheDir) {
        return `data:audio/mpeg;base64,${base64}`;
    }

    const fileName = `tts_${Date.now()}.mp3`;
    const fileUri = `${cacheDir}${fileName}`;

    await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
    });

    const elapsed = Date.now() - startTime;
    console.log(`[OpenAI TTS] Audio saved in ${elapsed}ms: ${fileUri}`);
    return fileUri;
}

/**
 * Convert Blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Cleanup old TTS audio files from cache
 */
export async function cleanupTTSCache(): Promise<void> {
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) return;

    try {
        const files = await FileSystem.readDirectoryAsync(cacheDir);
        const ttsFiles = files.filter(f => f.startsWith('tts_') && f.endsWith('.mp3'));

        if (ttsFiles.length > 5) {
            const toDelete = ttsFiles.slice(0, -5);
            await Promise.all(
                toDelete.map(f =>
                    FileSystem.deleteAsync(`${cacheDir}${f}`, { idempotent: true })
                )
            );
            console.log(`[OpenAI TTS] Cleaned up ${toDelete.length} old files`);
        }
    } catch (e) {
        console.warn('[OpenAI TTS] Cache cleanup failed:', e);
    }
}
