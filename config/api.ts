/**
 * Configuration management using expo-secure-store
 * 
 * Dev notes:
 * - Uses expo-secure-store for persistent key storage
 * - Fallbacks to EXPO_PUBLIC_* environment variables for easy local dev
 */

import * as SecureStore from 'expo-secure-store';

const Keys = {
    GROQ_API_KEY: 'groq_api_key',
    DEEPSEEK_API_KEY: 'deepseek_api_key',
    OPENAI_API_KEY: 'openai_api_key',
    ELEVENLABS_API_KEY: 'elevenlabs_api_key',
} as const;

/**
 * Get Groq API key for Whisper transcription
 */
export async function getGroqKey(): Promise<string | null> {
    const stored = await SecureStore.getItemAsync(Keys.GROQ_API_KEY);
    return stored || process.env.EXPO_PUBLIC_GROQ_API_KEY || null;
}

/**
 * Set Groq API key
 */
export async function setGroqKey(key: string): Promise<void> {
    await SecureStore.setItemAsync(Keys.GROQ_API_KEY, key);
}

/**
 * Get DeepSeek API key for R1 reasoning
 */
export async function getDeepSeekKey(): Promise<string | null> {
    const stored = await SecureStore.getItemAsync(Keys.DEEPSEEK_API_KEY);
    return stored || process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY || null;
}

/**
 * Set DeepSeek API key
 */
export async function setDeepSeekKey(key: string): Promise<void> {
    await SecureStore.setItemAsync(Keys.DEEPSEEK_API_KEY, key);
}

/**
 * Get OpenAI API key for embeddings
 */
export async function getOpenAIKey(): Promise<string | null> {
    const stored = await SecureStore.getItemAsync(Keys.OPENAI_API_KEY);
    return stored || process.env.EXPO_PUBLIC_OPENAI_API_KEY || null;
}

/**
 * Set OpenAI API key
 */
export async function setOpenAIKey(key: string): Promise<void> {
    await SecureStore.setItemAsync(Keys.OPENAI_API_KEY, key);
}

/**
 * Get ElevenLabs API key for TTS
 */
export async function getElevenLabsKey(): Promise<string | null> {
    const stored = await SecureStore.getItemAsync(Keys.ELEVENLABS_API_KEY);
    return stored || process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY || null;
}

/**
 * Set ElevenLabs API key
 */
export async function setElevenLabsKey(key: string): Promise<void> {
    await SecureStore.setItemAsync(Keys.ELEVENLABS_API_KEY, key);
}

/**
 * Check if all required API keys are configured
 */
export async function areKeysConfigured(): Promise<boolean> {
    const keys = await getAllKeys();
    return !!(
        keys.groq &&
        keys.deepseek &&
        keys.openai &&
        keys.elevenlabs
    );
}

/**
 * Get all API keys (for validation UI)
 */
export async function getAllKeys() {
    return {
        groq: await getGroqKey(),
        deepseek: await getDeepSeekKey(),
        openai: await getOpenAIKey(),
        elevenlabs: await getElevenLabsKey(),
    };
}

/**
 * Clear all API keys (for logout/reset)
 */
export async function clearAllKeys(): Promise<void> {
    await SecureStore.deleteItemAsync(Keys.GROQ_API_KEY);
    await SecureStore.deleteItemAsync(Keys.DEEPSEEK_API_KEY);
    await SecureStore.deleteItemAsync(Keys.OPENAI_API_KEY);
    await SecureStore.deleteItemAsync(Keys.ELEVENLABS_API_KEY);
}
