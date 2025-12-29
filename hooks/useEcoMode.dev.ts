/**
 * 🔋 useEcoMode Hook - REAL IMPLEMENTATION
 * 
 * This file contains the full expo-battery integration.
 * 
 * ⚠️ REQUIRES EAS DEV BUILD - Will not work in Expo Go!
 * 
 * To use this implementation:
 * 1. Create a dev build: eas build --profile development --platform android
 * 2. Rename this file to useEcoMode.ts (replace the stub)
 * 3. The hook will now detect battery state properly
 */

import { PERFORMANCE_CONTRACTS } from '@/constants/contracts';
import * as Battery from 'expo-battery';
import { useCallback, useEffect, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';

// ============================================================================
// TYPES
// ============================================================================

export interface EcoModeState {
    isEcoMode: boolean;
    batteryLevel: number | null;
    isCharging: boolean;
    isSystemLowPower: boolean;
    reason: EcoModeReason;
}

export type EcoModeReason =
    | 'NORMAL'
    | 'SYSTEM_LOW_POWER'
    | 'LOW_BATTERY'
    | 'UNAVAILABLE';

// ============================================================================
// CONSTANTS
// ============================================================================

const TRIGGER_LEVEL = PERFORMANCE_CONTRACTS.neuralCanvas.ecoMode.triggerLevel;

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export const useEcoMode = (): EcoModeState => {
    const [state, setState] = useState<EcoModeState>({
        isEcoMode: false,
        batteryLevel: null,
        isCharging: false,
        isSystemLowPower: false,
        reason: 'NORMAL',
    });

    const checkPowerState = useCallback(async () => {
        try {
            // 1. Check System Low Power Mode (Highest Priority)
            const isSystemLowPower = await Battery.isLowPowerModeEnabledAsync();

            if (isSystemLowPower) {
                setState({
                    isEcoMode: true,
                    batteryLevel: null,
                    isCharging: false,
                    isSystemLowPower: true,
                    reason: 'SYSTEM_LOW_POWER',
                });
                return;
            }

            // 2. Get detailed power state
            const powerState = await Battery.getPowerStateAsync();

            const batteryLevel = powerState.batteryLevel;
            const batteryState = powerState.batteryState;

            const isCharging =
                batteryState === Battery.BatteryState.CHARGING ||
                batteryState === Battery.BatteryState.FULL;

            const isLowBattery =
                batteryLevel !== null &&
                batteryLevel !== -1 &&
                batteryLevel <= TRIGGER_LEVEL;

            const shouldEco = isLowBattery && !isCharging;

            setState({
                isEcoMode: shouldEco,
                batteryLevel: batteryLevel === -1 ? null : batteryLevel,
                isCharging,
                isSystemLowPower: false,
                reason: shouldEco ? 'LOW_BATTERY' : 'NORMAL',
            });

        } catch (error) {
            console.warn('[useEcoMode] Battery check failed:', error);
            setState({
                isEcoMode: false,
                batteryLevel: null,
                isCharging: false,
                isSystemLowPower: false,
                reason: 'UNAVAILABLE',
            });
        }
    }, []);

    useEffect(() => {
        checkPowerState();

        const levelSub = Battery.addBatteryLevelListener(() => checkPowerState());
        const stateSub = Battery.addBatteryStateListener(() => checkPowerState());
        const lowPowerSub = Battery.addLowPowerModeListener(() => checkPowerState());

        return () => {
            levelSub.remove();
            stateSub.remove();
            lowPowerSub.remove();
        };
    }, [checkPowerState]);

    return state;
};

// ============================================================================
// SHARED VALUE BRIDGE
// ============================================================================

export const useEcoModeSharedValue = () => {
    const { isEcoMode } = useEcoMode();
    const ecoModeShared = useSharedValue(false);

    useEffect(() => {
        ecoModeShared.value = isEcoMode;
    }, [isEcoMode, ecoModeShared]);

    return ecoModeShared;
};
