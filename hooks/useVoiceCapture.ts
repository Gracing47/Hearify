/**
 * Voice capture hook using expo-audio
 * 
 * Dev notes:
 * - Migrated from deprecated expo-av to expo-audio
 * - High quality recording settings for transcription
 */

import {
    AudioQuality,
    getRecordingPermissionsAsync,
    IOSOutputFormat,
    PermissionResponse,
    requestRecordingPermissionsAsync,
    useAudioRecorder
} from 'expo-audio';
import { useCallback, useEffect, useState } from 'react';

export interface VoiceCaptureState {
    isRecording: boolean;
    hasPermission: boolean;
}

export function useVoiceCapture() {
    const [permissionResponse, setPermissionResponse] = useState<PermissionResponse | null>(null);

    const [state, setState] = useState<VoiceCaptureState>({
        isRecording: false,
        hasPermission: false,
    });

    const recorder = useAudioRecorder({
        // High quality transcription settings
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 128000,
        extension: '.wav',
        android: {
            outputFormat: 'mpeg4',
            audioEncoder: 'aac',
        },
        ios: {
            outputFormat: IOSOutputFormat.LINEARPCM,
            audioQuality: AudioQuality.HIGH,
        },
        web: {
            mimeType: 'audio/wav',
            bitsPerSecond: 128000,
        }
    });

    // Check permissions on mount
    useEffect(() => {
        async function checkPermissions() {
            const response = await getRecordingPermissionsAsync();
            setPermissionResponse(response);
            setState(prev => ({ ...prev, hasPermission: response.status === 'granted' }));
        }
        checkPermissions();
    }, []);

    const requestPermissions = useCallback(async () => {
        const response = await requestRecordingPermissionsAsync();
        setPermissionResponse(response);
        setState(prev => ({ ...prev, hasPermission: response.status === 'granted' }));
        return response;
    }, []);

    const startRecording = useCallback(async () => {
        const response = await getRecordingPermissionsAsync();
        if (response.status !== 'granted') {
            const retry = await requestPermissions();
            if (retry.status !== 'granted') {
                throw new Error('Microphone permission not granted');
            }
        }

        try {
            // Explicitly prepare the recorder before starting
            await recorder.prepareToRecordAsync();
            await recorder.record();

            setState(prev => ({ ...prev, isRecording: true }));
            console.log('[VoiceCapture] Recording started');
        } catch (error) {
            console.error('[VoiceCapture] Failed to start recording:', error);
            throw error;
        }
    }, [recorder, requestPermissions]);

    const stopRecording = useCallback(async (): Promise<string> => {
        try {
            await recorder.stop();

            // On some platforms/versions, recorder.uri might be null 
            // but the status might contain the URL.
            const status = recorder.getStatus();
            const uri = recorder.uri || status.url;

            setState(prev => ({ ...prev, isRecording: false }));
            console.log(`[VoiceCapture] Recording stopped. Found URI: ${uri}`);

            if (!uri) {
                console.error('[VoiceCapture] Recording stopped but URI is still null. Status:', status);
                throw new Error('Recording URI is null');
            }

            return uri;
        } catch (error) {
            console.error('[VoiceCapture] Failed to stop recording:', error);
            throw error;
        }
    }, [recorder]);

    const cancelRecording = useCallback(async () => {
        try {
            await recorder.stop();
            setState(prev => ({ ...prev, isRecording: false }));
        } catch (error) {
            console.error('[VoiceCapture] Failed to cancel recording:', error);
        }
    }, [recorder]);

    return {
        state,
        startRecording,
        stopRecording,
        cancelRecording,
        requestPermissions,
    };
}
