/**
 * ElevenLabs TTS Service
 * 
 * Uses REST API for full audio generation (not WebSocket streaming)
 * This produces smooth, complete audio without chunk stuttering
 */

import * as FileSystem from 'expo-file-system/legacy';
import { getElevenLabsKey } from '../config/api';

const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah voice
const MODEL_ID = 'eleven_flash_v2_5';
const API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

export interface TTSOptions {
    voiceId?: string;
    stability?: number;
    similarityBoost?: number;
}

/**
 * Generate complete audio file from text using ElevenLabs REST API
 * Returns the local file URI for playback
 */
export async function generateSpeech(text: string, options: TTSOptions = {}): Promise<string> {
    const apiKey = await getElevenLabsKey();
    if (!apiKey) {
        throw new Error('ElevenLabs API key not configured');
    }

    const voiceId = options.voiceId || VOICE_ID;
    const url = `${API_URL}/${voiceId}`;

    console.log(`[ElevenLabs] Generating speech for ${text.length} chars...`);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': apiKey,
        },
        body: JSON.stringify({
            text,
            model_id: MODEL_ID,
            voice_settings: {
                stability: options.stability ?? 0.5,
                similarity_boost: options.similarityBoost ?? 0.75,
            },
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
    }

    // Get audio as base64
    const audioBlob = await response.blob();
    const base64 = await blobToBase64(audioBlob);

    // Save to cache directory
    const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!cacheDir) {
        // Fallback: return data URI directly
        return `data:audio/mpeg;base64,${base64}`;
    }

    const fileName = `tts_${Date.now()}.mp3`;
    const fileUri = `${cacheDir}${fileName}`;

    await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
    });

    console.log(`[ElevenLabs] Audio saved to: ${fileUri}`);
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
            // Remove data URL prefix (data:audio/mpeg;base64,)
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

        // Keep only last 5 files
        if (ttsFiles.length > 5) {
            const toDelete = ttsFiles.slice(0, -5);
            await Promise.all(
                toDelete.map(f =>
                    FileSystem.deleteAsync(`${cacheDir}${f}`, { idempotent: true })
                )
            );
            console.log(`[ElevenLabs] Cleaned up ${toDelete.length} old files`);
        }
    } catch (e) {
        console.warn('[ElevenLabs] Cache cleanup failed:', e);
    }
}
