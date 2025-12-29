/**
 * 🔋 useEcoMode Hook
 * 
 * Centralized battery-aware performance mode detection.
 * 
 * ⚠️ EXPO GO LIMITATION:
 * expo-battery requires native modules which are not available in Expo Go.
 * This hook returns a safe default (eco mode disabled) until you create
 * a development build with EAS Build.
 * 
 * To enable full battery functionality:
 * 1. Run: eas build --profile development --platform android
 * 2. Install the dev build on your device
 * 3. The hook will automatically detect and use expo-battery
 * 
 * For now, this is a STUB that keeps the app running in Expo Go.
 * 
 * @returns {EcoModeState} Current eco mode state (disabled in Expo Go)
 */

import { useEffect } from 'react';
import { useSharedValue } from 'react-native-reanimated';

// ============================================================================
// TYPES
// ============================================================================

export interface EcoModeState {
    /** Whether eco mode is currently active */
    isEcoMode: boolean;

    /** Current battery level (0.0 - 1.0), null if unavailable */
    batteryLevel: number | null;

    /** Whether device is currently charging */
    isCharging: boolean;

    /** Whether system-wide low power mode is enabled */
    isSystemLowPower: boolean;

    /** Reason for current eco mode state (for debugging/telemetry) */
    reason: EcoModeReason;
}

export type EcoModeReason =
    | 'NORMAL'              // Eco mode OFF
    | 'SYSTEM_LOW_POWER'    // iOS/Android system low power mode
    | 'LOW_BATTERY'         // Battery below threshold + unplugged
    | 'UNAVAILABLE';        // Battery API not available (Expo Go)

// ============================================================================
// STUB IMPLEMENTATION (Expo Go Safe)
// ============================================================================

/**
 * 🔋 STUB: Returns disabled eco mode for Expo Go compatibility.
 * 
 * TODO: When you have a dev build, uncomment the real implementation
 * in useEcoMode.native.ts and use platform-specific imports.
 * 
 * @deprecated_reason Waiting for EAS Build with native modules
 */
const DISABLED_STATE: EcoModeState = {
    isEcoMode: false,
    batteryLevel: null,
    isCharging: false,
    isSystemLowPower: false,
    reason: 'UNAVAILABLE',
};

export const useEcoMode = (): EcoModeState => {
    // Log once on mount for debugging
    useEffect(() => {
        console.log('[useEcoMode] 🔋 Stub mode - expo-battery requires dev build');
    }, []);

    return DISABLED_STATE;
};

// ============================================================================
// SHARED VALUE BRIDGE (For Worklet Integration)
// ============================================================================

/**
 * Creates a shared value that syncs with eco mode state.
 * In stub mode, this always returns false (eco mode disabled).
 */
export const useEcoModeSharedValue = () => {
    const ecoModeShared = useSharedValue(false);

    // In stub mode, eco mode is always disabled
    // No need to sync - it's always false

    return ecoModeShared;
};

// ============================================================================
// FUTURE: Real Implementation (for EAS Dev Build)
// ============================================================================
//
// When you create a dev build, create a new file:
// hooks/useEcoMode.native.ts
//
// And use metro.config.js to switch between implementations:
// - useEcoMode.ts (stub for Expo Go)
// - useEcoMode.native.ts (real implementation for dev builds)
//
// Or simply replace this file's content with the real implementation
// after creating a dev build.
// ============================================================================
