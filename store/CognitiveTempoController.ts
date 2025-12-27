/**
 * 🧠 Cognitive Tempo Control (CTC) — The Governor
 * 
 * Regulates all motion, visual intensity, and interaction based on
 * cognitive state. Nothing moves without permission.
 * 
 * States: IDLE → AWARENESS → INTEREST → INTENT → REFLECTION
 */

import { create } from 'zustand';

// --- Types ---

export type CognitiveMode = 'IDLE' | 'AWARENESS' | 'INTEREST' | 'INTENT' | 'REFLECTION';

export interface CTCLimits {
    allowCameraTranslation: boolean;
    allowCameraRotation: boolean;
    maxVelocity: number;
    edgeActivityLevel: 0 | 1 | 2;
    bloomIntensityCap: number;
    birthEnergyMultiplier: number;
}

interface CTCState {
    mode: CognitiveMode;
    focusConfidence: number;
    lastInteractionTime: number;
    stillnessTimerId: ReturnType<typeof setTimeout> | null;

    // Computed limits (derived from mode)
    limits: CTCLimits;

    // Actions
    touch: () => void;
    setFocusConfidence: (confidence: number) => void;
    setMode: (mode: CognitiveMode) => void;
    enterReflection: () => void;
    exitReflection: () => void;
}

// --- Mode Configurations ---

const MODE_CONFIGS: Record<CognitiveMode, CTCLimits> = {
    IDLE: {
        allowCameraTranslation: false,
        allowCameraRotation: false,
        maxVelocity: 0,
        edgeActivityLevel: 0,
        bloomIntensityCap: 0.2,
        birthEnergyMultiplier: 0,
    },
    AWARENESS: {
        allowCameraTranslation: true, // 🔥 Allow exploration on touch
        allowCameraRotation: true,
        maxVelocity: 10,
        edgeActivityLevel: 0,
        bloomIntensityCap: 0.4,
        birthEnergyMultiplier: 0.3,
    },
    INTEREST: {
        allowCameraTranslation: true,
        allowCameraRotation: true,
        maxVelocity: 30,
        edgeActivityLevel: 1,
        bloomIntensityCap: 0.7,
        birthEnergyMultiplier: 0.6,
    },
    INTENT: {
        allowCameraTranslation: true,
        allowCameraRotation: true,
        maxVelocity: 50,
        edgeActivityLevel: 2,
        bloomIntensityCap: 1.0,
        birthEnergyMultiplier: 1.0,
    },
    REFLECTION: {
        allowCameraTranslation: true,
        allowCameraRotation: true,
        maxVelocity: 15,
        edgeActivityLevel: 1,
        bloomIntensityCap: 0.5,
        birthEnergyMultiplier: 0, // Birth = fade-in only
    },
};

// --- Stillness Configuration ---

const STILLNESS_TIMEOUT_MS = 8000; // 8 seconds to IDLE
const FOCUS_THRESHOLDS = {
    AWARENESS: 0,
    INTEREST: 0.4,
    INTENT: 0.7,
};

// --- Store ---

export const useCTC = create<CTCState>((set, get) => ({
    mode: 'AWARENESS',
    focusConfidence: 0,
    lastInteractionTime: Date.now(),
    stillnessTimerId: null,
    limits: MODE_CONFIGS.AWARENESS,

    // Called on any user interaction (touch, gesture, voice)
    touch: () => {
        const now = Date.now();
        const state = get();

        // Clear existing stillness timer
        if (state.stillnessTimerId) {
            clearTimeout(state.stillnessTimerId);
        }

        // If in IDLE, transition to AWARENESS
        let newMode = state.mode;
        if (state.mode === 'IDLE') {
            newMode = 'AWARENESS';
        }

        // Start new stillness timer
        const timerId = setTimeout(() => {
            const current = get();
            if (current.mode !== 'REFLECTION') {
                set({
                    mode: 'IDLE',
                    limits: MODE_CONFIGS.IDLE,
                    stillnessTimerId: null
                });
            }
        }, STILLNESS_TIMEOUT_MS);

        set({
            lastInteractionTime: now,
            stillnessTimerId: timerId,
            mode: newMode,
            limits: MODE_CONFIGS[newMode],
        });
    },

    // Update focus confidence (from semantic vector similarity)
    setFocusConfidence: (confidence: number) => {
        const state = get();

        // Skip if in REFLECTION or IDLE
        if (state.mode === 'REFLECTION' || state.mode === 'IDLE') {
            set({ focusConfidence: confidence });
            return;
        }

        // Determine mode based on confidence thresholds
        let newMode: CognitiveMode = 'AWARENESS';
        if (confidence >= FOCUS_THRESHOLDS.INTENT) {
            newMode = 'INTENT';
        } else if (confidence >= FOCUS_THRESHOLDS.INTEREST) {
            newMode = 'INTEREST';
        }

        set({
            focusConfidence: confidence,
            mode: newMode,
            limits: MODE_CONFIGS[newMode],
        });
    },

    // Direct mode override (use sparingly)
    setMode: (mode: CognitiveMode) => {
        set({
            mode,
            limits: MODE_CONFIGS[mode],
        });
    },

    // Enter reflection mode (Chronicle/Memory)
    enterReflection: () => {
        const state = get();
        if (state.stillnessTimerId) {
            clearTimeout(state.stillnessTimerId);
        }
        set({
            mode: 'REFLECTION',
            limits: MODE_CONFIGS.REFLECTION,
            stillnessTimerId: null,
        });
    },

    // Exit reflection mode (back to Orbit)
    exitReflection: () => {
        set({
            mode: 'AWARENESS',
            limits: MODE_CONFIGS.AWARENESS,
        });
        get().touch(); // Reset stillness timer
    },
}));

// --- Utility Hooks ---

export const useCTCLimits = () => useCTC(state => state.limits);
export const useCTCMode = () => useCTC(state => state.mode);
