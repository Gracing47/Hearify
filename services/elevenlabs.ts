/**
 * ElevenLabs Flash v2.5 WebSocket streaming client
 * 
 * Dev notes:
 * - Target latency: <100ms for first audio chunk
 * - WebSocket protocol: send BOS → text chunks → EOS
 * - Returns audio chunks as base64-encoded PCM
 */

import { getElevenLabsKey } from '../config/api';

const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah voice (default, can be customized)
const MODEL_ID = 'eleven_flash_v2_5';

export interface TTSOptions {
    voiceId?: string;
    stability?: number;
    similarityBoost?: number;
}

/**
 * ElevenLabs WebSocket client for streaming TTS
 */
export class ElevenLabsClient {
    private ws: WebSocket | null = null;
    private onAudioChunk: ((chunk: string) => void) | null = null;
    private onComplete: (() => void) | null = null;
    private onError: ((error: Error) => void) | null = null;
    private onDisconnect: (() => void) | null = null;

    /**
     * Connect to ElevenLabs WebSocket
     */
    async connect(options: TTSOptions = {}): Promise<void> {
        // If already connected and open, just return
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('[ElevenLabs] Already connected, reusing connection');
            return;
        }

        const apiKey = await getElevenLabsKey();
        if (!apiKey) {
            throw new Error('ElevenLabs API key not configured');
        }

        const voiceId = options.voiceId || VOICE_ID;
        // flush=true disables server-side buffering for lower latency
        // optimize_streaming_latency=4 is maximum optimization (best for real-time)
        const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${MODEL_ID}&optimize_streaming_latency=4&flush=true&xi-api-key=${apiKey}`;

        return new Promise((resolve, reject) => {
            // Set connection timeout to prevent hanging
            const connectionTimeout = setTimeout(() => {
                if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
                    console.error('[ElevenLabs] Connection timeout after 30s');
                    this.ws?.close();
                    reject(new Error('Connection timeout'));
                }
            }, 30000);

            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                clearTimeout(connectionTimeout);
                console.log('[ElevenLabs] WebSocket connected');

                try {
                    // Send BOS (Beginning of Stream) message
                    const bosMessage = JSON.stringify({
                        text: ' ',
                        voice_settings: {
                            stability: options.stability || 0.5,
                            similarity_boost: options.similarityBoost || 0.75,
                        },
                        xi_api_key: apiKey,
                    });

                    this.ws?.send(bosMessage);
                    console.log('[ElevenLabs] BOS message sent');
                    resolve();
                } catch (error) {
                    console.error('[ElevenLabs] Failed to send BOS message:', error);
                    reject(error);
                }
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);

                    if (message.audio) {
                        // Received audio chunk (base64 encoded)
                        this.onAudioChunk?.(message.audio);
                    }

                    if (message.isFinal) {
                        console.log('[ElevenLabs] Stream completed');
                        this.onComplete?.();
                    }

                    if (message.message) {
                        // ElevenLabs sends error details in the 'message' field
                        console.error('[ElevenLabs] Server Message:', message.message);
                        if (message.error) {
                            this.onError?.(new Error(message.message));
                        }
                    }
                } catch (e) {
                    console.error('[ElevenLabs] Failed to parse message:', event.data);
                }
            };

            this.ws.onerror = (error) => {
                clearTimeout(connectionTimeout);
                console.error('[ElevenLabs] WebSocket error event:', error);
                this.onError?.(new Error('WebSocket connection failed'));
                reject(error);
            };

            this.ws.onclose = () => {
                clearTimeout(connectionTimeout);
                console.log('[ElevenLabs] WebSocket closed');
                this.onDisconnect?.();
            };
        });
    }

    /**
     * Stream text for TTS
     * Splits text into sentences for smoother streaming
     */
    sendText(text: string): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            const state = this.ws ? this.ws.readyState : 'null';
            throw new Error(`WebSocket not connected (state: ${state})`);
        }

        // Split text into sentences for better streaming
        // ElevenLabs processes better with sentence-level chunks
        const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];

        console.log(`[ElevenLabs] Sending ${sentences.length} sentences (${text.length} total chars)`);

        for (const sentence of sentences) {
            const trimmed = sentence.trim();
            if (trimmed) {
                const payload = {
                    text: trimmed + ' ', // Add space to help with word boundaries
                    try_trigger_generation: true,
                };
                this.ws.send(JSON.stringify(payload));
            }
        }
    }

    /**
     * Send EOS (End of Stream) to finalize
     */
    endStream(): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('[ElevenLabs] Cannot send EOS - WebSocket not connected');
            return;
        }

        console.log('[ElevenLabs] Sending EOS (end of stream)');
        this.ws.send(JSON.stringify({
            text: '',
        }));
    }

    /**
     * Close WebSocket connection
     */
    close(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * Set callback for audio chunks
     */
    onAudio(callback: (chunk: string) => void): void {
        this.onAudioChunk = callback;
    }

    /**
     * Set callback for completion
     */
    onStreamComplete(callback: () => void): void {
        this.onComplete = callback;
    }

    /**
     * Set callback for errors
     */
    onStreamError(callback: (error: Error) => void): void {
        this.onError = callback;
    }

    /**
     * Set callback for disconnection
     */
    onDisconnectCallback(callback: () => void): void {
        this.onDisconnect = callback;
    }
}
