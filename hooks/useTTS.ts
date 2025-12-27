/**
 * TTS (Text-to-Speech) Hook
 * 
 * Uses OpenAI TTS-1-HD for high-quality voice generation
 * Generates complete audio file and plays it smoothly
 * speak() returns a Promise that resolves when audio finishes
 */

import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { cleanupTTSCache, generateSpeech } from '../services/openai-tts';


export interface TTSState {
    isGenerating: boolean;
    isSpeaking: boolean;
    error: string | null;
}

export function useTTS() {
    const [state, setState] = useState<TTSState>({
        isGenerating: false,
        isSpeaking: false,
        error: null,
    });

    const player = useAudioPlayer();
    const status = useAudioPlayerStatus(player);

    // Promise resolver for when audio finishes
    const finishResolverRef = useRef<(() => void) | null>(null);

    // Shared value for orb intensity (0-1)
    const intensity = useSharedValue(0);

    // Handle audio completion
    useEffect(() => {
        if (status.playing) {
            intensity.value = withTiming(0.8, { duration: 200 });
        } else if (status.didJustFinish) {
            intensity.value = withTiming(0, { duration: 300 });
            setState(prev => ({ ...prev, isSpeaking: false }));

            // Resolve the speak() promise
            if (finishResolverRef.current) {
                finishResolverRef.current();
                finishResolverRef.current = null;
            }
        }
    }, [status.playing, status.didJustFinish, intensity]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            try {
                // Only pause if player exists and is valid
                if (player && typeof player.pause === 'function') {
                    player.pause();
                }
            } catch (e) {
                // Player already released, ignore
                console.log('[TTS] Cleanup: player already released');
            }
            cleanupTTSCache();
        };
    }, []);

    /**
     * Generate and play TTS audio
     * @param text The text to speak
     * @param onPlaybackStart Optional callback triggered when audio starts playing
     * Returns a Promise that resolves when audio playback finishes
     */
    const speak = useCallback(async (text: string, onPlaybackStart?: () => void): Promise<void> => {
        return new Promise(async (resolve, reject) => {
            try {
                // Reset state
                setState({ isGenerating: true, isSpeaking: false, error: null });
                intensity.value = withTiming(0.3, { duration: 200 });

                // Stop any current playback
                player.pause();

                // Generate complete audio file
                console.log('[TTS] Generating audio...');
                const audioUri = await generateSpeech(text);

                // Set up completion handler
                finishResolverRef.current = resolve;

                // Play the complete audio
                setState(prev => ({ ...prev, isGenerating: false, isSpeaking: true }));
                player.replace({ uri: audioUri });

                // Trigger the callback just before playing
                if (onPlaybackStart) {
                    onPlaybackStart();
                }

                player.play();

                console.log('[TTS] Playing audio');
            } catch (error) {

                console.error('[TTS] Error:', error);
                setState({
                    isGenerating: false,
                    isSpeaking: false,
                    error: error instanceof Error ? error.message : 'TTS failed',
                });
                intensity.value = 0;
                reject(error);
            }
        });
    }, [player, intensity]);

    const stop = useCallback(() => {
        player.pause();
        intensity.value = withTiming(0, { duration: 200 });
        setState(prev => ({ ...prev, isSpeaking: false }));

        // Resolve any pending promise
        if (finishResolverRef.current) {
            finishResolverRef.current();
            finishResolverRef.current = null;
        }
    }, [player, intensity]);

    return {
        state,
        intensity,
        speak,
        stop,
    };
}
