/**
 * TTS (Text-to-Speech) hook using ElevenLabs Flash v2.5
 * 
 * ARCHITECTURE: Dual-player gapless playback
 * - Uses two audio players alternating for seamless transitions
 * - Pre-loads next chunk while current is playing
 * - Aggressive pre-buffering before first playback
 * 
 * @module useTTS
 */

import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { ElevenLabsClient } from '../services/elevenlabs';

export interface TTSState {
    isConnected: boolean;
    isSpeaking: boolean;
    error: string | null;
}

// Pre-buffer settings - aggressive buffering for smooth start
const MIN_CHUNKS_BEFORE_START = 4; // Wait for 4 chunks before starting
const MAX_WAIT_MS = 1200; // Or start after 1.2 seconds

export function useTTS() {
    const [state, setState] = useState<TTSState>({
        isConnected: false,
        isSpeaking: false,
        error: null,
    });

    const clientRef = useRef<ElevenLabsClient | null>(null);

    // Dual player system for gapless playback
    const playerA = useAudioPlayer();
    const playerB = useAudioPlayer();
    const statusA = useAudioPlayerStatus(playerA);
    const statusB = useAudioPlayerStatus(playerB);

    // Track which player is active (true = A, false = B)
    const activePlayerRef = useRef<'A' | 'B'>('A');
    const nextPlayerLoadedRef = useRef(false);

    // Queue of base64 audio chunks
    const audioQueueRef = useRef<string[]>([]);

    // Pre-buffer tracking
    const preBufferRef = useRef<string[]>([]);
    const hasStartedPlaybackRef = useRef(false);
    const preBufferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const streamCompleteRef = useRef(false);

    const isPlayingRef = useRef(false);
    const isConnectedRef = useRef(false);
    const isConnectingRef = useRef(false);

    // Shared value for orb intensity (0-1)
    const intensity = useSharedValue(0);

    // Helper to get current and next player
    const getPlayers = useCallback(() => {
        if (activePlayerRef.current === 'A') {
            return { current: playerA, next: playerB };
        }
        return { current: playerB, next: playerA };
    }, [playerA, playerB]);

    // Convert base64 to data URI
    const toDataUri = useCallback((base64: string) => {
        return `data:audio/mpeg;base64,${base64}`;
    }, []);

    // Preload the next chunk into the inactive player
    const preloadNext = useCallback(() => {
        if (audioQueueRef.current.length === 0 || nextPlayerLoadedRef.current) {
            return;
        }

        const nextChunk = audioQueueRef.current[0]; // Peek, don't remove yet
        if (!nextChunk) return;

        const { next } = getPlayers();
        const dataUri = toDataUri(nextChunk);

        try {
            next.replace({ uri: dataUri });
            nextPlayerLoadedRef.current = true;
            console.log('[TTS] Preloaded next chunk');
        } catch (e) {
            console.warn('[TTS] Failed to preload:', e);
        }
    }, [getPlayers, toDataUri]);

    // Play the next chunk
    const playNextChunk = useCallback(() => {
        if (audioQueueRef.current.length === 0) {
            if (streamCompleteRef.current && hasStartedPlaybackRef.current) {
                console.log('[TTS] All chunks played, stream complete');
                isPlayingRef.current = false;
                setState(prev => ({ ...prev, isSpeaking: false }));
                intensity.value = 0;
            }
            return;
        }

        const chunk = audioQueueRef.current.shift();
        if (!chunk) return;

        isPlayingRef.current = true;
        const { current, next } = getPlayers();

        try {
            if (nextPlayerLoadedRef.current) {
                // Use pre-loaded player
                next.play();
                // Swap active player
                activePlayerRef.current = activePlayerRef.current === 'A' ? 'B' : 'A';
                nextPlayerLoadedRef.current = false;
                console.log(`[TTS] Playing pre-loaded chunk, ${audioQueueRef.current.length} remaining`);
            } else {
                // Load and play on current
                const dataUri = toDataUri(chunk);
                current.replace({ uri: dataUri });
                current.play();
                console.log(`[TTS] Playing chunk (loaded fresh), ${audioQueueRef.current.length} remaining`);
            }

            intensity.value = 0.8;

            // Immediately start preloading the next chunk
            setTimeout(() => preloadNext(), 50);
        } catch (error) {
            console.error('[TTS] Failed to play chunk:', error);
            isPlayingRef.current = false;
            intensity.value = 0;

            // Try next chunk
            if (audioQueueRef.current.length > 0) {
                setTimeout(() => playNextChunk(), 100);
            }
        }
    }, [getPlayers, toDataUri, preloadNext, intensity]);

    // Start playback from pre-buffer
    const startPlayback = useCallback(() => {
        if (hasStartedPlaybackRef.current) return;

        hasStartedPlaybackRef.current = true;

        if (preBufferTimeoutRef.current) {
            clearTimeout(preBufferTimeoutRef.current);
            preBufferTimeoutRef.current = null;
        }

        // Move pre-buffered chunks to main queue
        audioQueueRef.current = [...preBufferRef.current];
        preBufferRef.current = [];

        console.log(`[TTS] Starting playback with ${audioQueueRef.current.length} pre-buffered chunks`);

        // Preload first chunk, then start
        if (audioQueueRef.current.length > 1) {
            // Preload second chunk into next player
            const secondChunk = audioQueueRef.current[1];
            const { next } = getPlayers();
            next.replace({ uri: toDataUri(secondChunk) });
            nextPlayerLoadedRef.current = true;
        }

        playNextChunk();
    }, [getPlayers, toDataUri, playNextChunk]);

    // Process incoming audio chunk
    const handleAudioChunk = useCallback((chunk: string) => {
        if (!hasStartedPlaybackRef.current) {
            // Still pre-buffering
            preBufferRef.current.push(chunk);
            console.log(`[TTS] Pre-buffering chunk ${preBufferRef.current.length}/${MIN_CHUNKS_BEFORE_START}`);

            // Start timeout on first chunk
            if (preBufferRef.current.length === 1) {
                preBufferTimeoutRef.current = setTimeout(() => {
                    console.log('[TTS] Pre-buffer timeout, starting playback...');
                    startPlayback();
                }, MAX_WAIT_MS);
            }

            // Start playback when we have enough chunks
            if (preBufferRef.current.length >= MIN_CHUNKS_BEFORE_START) {
                console.log('[TTS] Pre-buffer full, starting playback...');
                startPlayback();
            }
        } else {
            // Already playing, add to main queue
            audioQueueRef.current.push(chunk);

            // Try to preload next
            preloadNext();

            // If nothing is playing, start
            if (!isPlayingRef.current) {
                playNextChunk();
            }
        }
    }, [startPlayback, preloadNext, playNextChunk]);

    useEffect(() => {
        clientRef.current = new ElevenLabsClient();

        return () => {
            if (clientRef.current) {
                clientRef.current.close();
            }
            if (preBufferTimeoutRef.current) {
                clearTimeout(preBufferTimeoutRef.current);
            }
        };
    }, []);

    // Handle player A completion
    useEffect(() => {
        if (activePlayerRef.current === 'A' && statusA.didJustFinish && isPlayingRef.current) {
            console.log('[TTS] Player A finished');
            intensity.value = 0.4;
            playNextChunk();
        }
    }, [statusA.didJustFinish, playNextChunk, intensity]);

    // Handle player B completion
    useEffect(() => {
        if (activePlayerRef.current === 'B' && statusB.didJustFinish && isPlayingRef.current) {
            console.log('[TTS] Player B finished');
            intensity.value = 0.4;
            playNextChunk();
        }
    }, [statusB.didJustFinish, playNextChunk, intensity]);

    const connect = useCallback(async () => {
        if (!clientRef.current || isConnectingRef.current) return isConnectedRef.current;

        try {
            isConnectingRef.current = true;

            clientRef.current.onDisconnectCallback(() => {
                isConnectedRef.current = false;
                setState(prev => ({ ...prev, isConnected: false }));
            });

            await clientRef.current.connect();

            clientRef.current.onAudio((chunk: string) => {
                handleAudioChunk(chunk);
            });

            clientRef.current.onStreamComplete(() => {
                console.log('[TTS] ElevenLabs stream complete');
                streamCompleteRef.current = true;

                // If still pre-buffering, start now
                if (!hasStartedPlaybackRef.current && preBufferRef.current.length > 0) {
                    startPlayback();
                }

                // Check if already done
                if (!isPlayingRef.current && audioQueueRef.current.length === 0 && hasStartedPlaybackRef.current) {
                    setState(prev => ({ ...prev, isSpeaking: false }));
                    intensity.value = 0;
                }
            });

            clientRef.current.onStreamError((error: Error) => {
                setState(prev => ({ ...prev, error: error.message, isSpeaking: false }));
                intensity.value = 0;
            });

            isConnectedRef.current = true;
            setState(prev => ({ ...prev, isConnected: true, error: null }));
            console.log('[TTS] Connected');
            return true;
        } catch (error) {
            console.error('[TTS] Connection failed:', error);
            isConnectedRef.current = false;
            setState(prev => ({
                ...prev,
                isConnected: false,
                error: error instanceof Error ? error.message : 'Connection failed'
            }));
            return false;
        } finally {
            isConnectingRef.current = false;
        }
    }, [handleAudioChunk, startPlayback, intensity]);

    const speak = useCallback(async (text: string) => {
        if (!clientRef.current) return;

        try {
            // Full reset for new speech
            streamCompleteRef.current = false;
            hasStartedPlaybackRef.current = false;
            preBufferRef.current = [];
            audioQueueRef.current = [];
            isPlayingRef.current = false;
            nextPlayerLoadedRef.current = false;
            activePlayerRef.current = 'A';

            if (preBufferTimeoutRef.current) {
                clearTimeout(preBufferTimeoutRef.current);
                preBufferTimeoutRef.current = null;
            }

            // Stop any playing audio
            playerA.pause();
            playerB.pause();

            // Ensure connection
            if (!isConnectedRef.current) {
                console.log('[TTS] Connecting...');

                if (clientRef.current) {
                    clientRef.current.close();
                }

                clientRef.current = new ElevenLabsClient();
                const success = await connect();

                if (!success || !isConnectedRef.current) {
                    throw new Error('TTS connection failed');
                }
            }

            setState(prev => ({ ...prev, isSpeaking: true, error: null }));
            intensity.value = 0.3;

            // Send text
            clientRef.current.sendText(text);
            clientRef.current.endStream();

            console.log(`[TTS] Sent ${text.length} chars`);
        } catch (error) {
            console.error('[TTS] Speak failed:', error);
            setState(prev => ({
                ...prev,
                isSpeaking: false,
                error: error instanceof Error ? error.message : 'Failed to speak'
            }));
            intensity.value = 0;
            throw error;
        }
    }, [connect, intensity, playerA, playerB]);

    const stop = useCallback(() => {
        playerA.pause();
        playerB.pause();

        audioQueueRef.current = [];
        preBufferRef.current = [];
        streamCompleteRef.current = false;
        hasStartedPlaybackRef.current = false;
        isPlayingRef.current = false;
        isConnectedRef.current = false;
        nextPlayerLoadedRef.current = false;
        activePlayerRef.current = 'A';
        intensity.value = 0;

        if (preBufferTimeoutRef.current) {
            clearTimeout(preBufferTimeoutRef.current);
            preBufferTimeoutRef.current = null;
        }

        if (clientRef.current) {
            clientRef.current.close();
            clientRef.current = new ElevenLabsClient();
        }

        setState(prev => ({ ...prev, isSpeaking: false, isConnected: false }));
    }, [playerA, playerB, intensity]);

    return {
        state,
        intensity,
        connect,
        speak,
        stop,
    };
}
