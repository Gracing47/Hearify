/**
 * 🧠 Cognitive Tempo Control (CTC) v2.0 — The Governor
 * 
 * Regulates all motion, visual intensity, and interaction based on
 * cognitive state. Nothing moves without permission.
 * 
 * States: IDLE → AWARENESS → INTENT → REFLECTION (4 states per v2.0 spec)
 * 
 * Operating Model:
 * - Every visual element must check CTC state
 * - Default Rule: If uncertain → Don't animate
 */

import { create } from 'zustand';

// --- Types (v2.0 aligned) ---

export type CognitiveMode = 'IDLE' | 'AWARENESS' | 'INTENT' | 'REFLECTION';

export interface CTCLimits {
    // Camera permissions
    allowCameraTranslation: boolean;
    allowCameraRotation: boolean;
    maxVelocity: number;

    // Visual system controls
    edgeActivityLevel: 0 | 1 | 2;
    bloomIntensityCap: number;
    birthEnergyMultiplier: number;

    // v2.0: Breathing control
    breathingEnabled: boolean;
    motionBudget: number;  // 0 = frozen, 1 = full
}

interface CTCState {
    mode: CognitiveMode;
    focusConfidence: number;
    lastInteractionTime: number;
    stillnessTimerId: ReturnType<typeof setTimeout> | null;

    // v2.0: Camera settle tracking
    cameraSettled: boolean;
    lastCameraMoveTime: number;

    // v2.0: Pre-modal state (to restore after REFLECTION)
    preReflectionMode: CognitiveMode | null;

    // Computed limits (derived from mode)
    limits: CTCLimits;

    // Actions
    touch: () => void;
    setFocusConfidence: (confidence: number) => void;
    setMode: (mode: CognitiveMode) => void;
    enterReflection: () => void;
    exitReflection: () => void;

    // v2.0: Camera settle actions
    onCameraMove: () => void;
    onCameraSettle: () => void;

    // v2.0: Enter INTENT mode (during active gesture)
    enterIntent: () => void;
    exitIntent: () => void;
}

// --- Mode Configurations (v2.0 aligned) ---

const MODE_CONFIGS: Record<CognitiveMode, CTCLimits> = {
    IDLE: {
        allowCameraTranslation: false,
        allowCameraRotation: false,
        maxVelocity: 0,
        edgeActivityLevel: 0,
        bloomIntensityCap: 0.2,
        birthEnergyMultiplier: 0,
        breathingEnabled: true,   // ✅ Breathing allowed in IDLE
        motionBudget: 0.2,        // Minimal ambient motion only
    },
    AWARENESS: {
        allowCameraTranslation: true,
        allowCameraRotation: true,
        maxVelocity: 30,
        edgeActivityLevel: 1,
        bloomIntensityCap: 0.6,
        birthEnergyMultiplier: 0.5,
        breathingEnabled: true,   // ✅ Breathing allowed in AWARENESS
        motionBudget: 0.6,
    },
    INTENT: {
        allowCameraTranslation: true,
        allowCameraRotation: true,
        maxVelocity: 50,
        edgeActivityLevel: 2,
        bloomIntensityCap: 1.0,
        birthEnergyMultiplier: 1.0,
        breathingEnabled: false,  // ❌ No breathing during gesture
        motionBudget: 1.0,
    },
    REFLECTION: {
        allowCameraTranslation: false,  // Modal is open, no camera moves
        allowCameraRotation: false,
        maxVelocity: 0,
        edgeActivityLevel: 0,
        bloomIntensityCap: 0.3,
        birthEnergyMultiplier: 0,
        breathingEnabled: false,  // ❌ All motion paused
        motionBudget: 0,          // System frozen
    },
};

// --- Timing Constants (v2.0 aligned) ---

const STILLNESS_TIMEOUT_MS = 10000;    // 10 seconds to IDLE (spec: 10s)
const CAMERA_SETTLE_DELAY_MS = 180;     // 180ms settle delay for labels (spec)
const INTENT_EXIT_DELAY_MS = 180;       // 180ms after gesture end

// --- Store ---

export const useCTC = create<CTCState>((set, get) => ({
    mode: 'AWARENESS',
    focusConfidence: 0,
    lastInteractionTime: Date.now(),
    stillnessTimerId: null,
    cameraSettled: true,
    lastCameraMoveTime: 0,
    preReflectionMode: null,
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

        // Skip mode changes if in REFLECTION, IDLE, or INTENT
        if (state.mode === 'REFLECTION' || state.mode === 'IDLE' || state.mode === 'INTENT') {
            set({ focusConfidence: confidence });
            return;
        }

        // In AWARENESS, stay in AWARENESS (removed INTEREST state)
        set({ focusConfidence: confidence });
    },

    // Direct mode override (use sparingly)
    setMode: (mode: CognitiveMode) => {
        set({
            mode,
            limits: MODE_CONFIGS[mode],
        });
    },

    // v2.0: Enter INTENT during active gesture
    enterIntent: () => {
        const state = get();
        if (state.mode === 'REFLECTION') return; // Don't interrupt modal

        set({
            mode: 'INTENT',
            limits: MODE_CONFIGS.INTENT,
            cameraSettled: false,
        });
    },

    // v2.0: Exit INTENT after gesture ends (with settle delay)
    exitIntent: () => {
        const state = get();
        if (state.mode !== 'INTENT') return;

        // Wait for settle delay before transitioning
        setTimeout(() => {
            const current = get();
            if (current.mode === 'INTENT') {
                set({
                    mode: 'AWARENESS',
                    limits: MODE_CONFIGS.AWARENESS,
                });
                // Camera settle is handled by NeuralCanvas frame callback
            }
        }, INTENT_EXIT_DELAY_MS);
    },

    // v2.0: Camera movement tracking
    onCameraMove: () => {
        set({
            cameraSettled: false,
            lastCameraMoveTime: Date.now(),
        });
    },

    // v2.0: Camera settle detection
    onCameraSettle: () => {
        const state = get();
        const now = Date.now();
        const elapsed = now - state.lastCameraMoveTime;

        if (elapsed >= CAMERA_SETTLE_DELAY_MS) {
            set({ cameraSettled: true });
        }
    },

    // Enter reflection mode (Modal open)
    enterReflection: () => {
        const state = get();

        if (state.stillnessTimerId) {
            clearTimeout(state.stillnessTimerId);
        }

        set({
            mode: 'REFLECTION',
            limits: MODE_CONFIGS.REFLECTION,
            stillnessTimerId: null,
            preReflectionMode: state.mode !== 'REFLECTION' ? state.mode : state.preReflectionMode,
        });
    },

    // Exit reflection mode (Modal close)
    exitReflection: () => {
        const state = get();
        const returnMode = state.preReflectionMode || 'AWARENESS';

        set({
            mode: returnMode,
            limits: MODE_CONFIGS[returnMode],
            preReflectionMode: null,
        });

        // Delay breathing resume by 500ms per spec
        setTimeout(() => {
            get().touch(); // Reset stillness timer
        }, 500);
    },
}));

// --- Utility Hooks ---

export const useCTCLimits = () => useCTC(state => state.limits);
export const useCTCMode = () => useCTC(state => state.mode);
export const useCTCBreathing = () => useCTC(state => state.limits.breathingEnabled);
export const useCTCCameraSettled = () => useCTC(state => state.cameraSettled);

// --- State Transition Table (for documentation/debugging) ---

export const CTC_TRANSITIONS = [
    { from: 'IDLE', to: 'AWARENESS', trigger: 'Touch canvas', visual: 'Enable labels, breathing continues' },
    { from: 'AWARENESS', to: 'INTENT', trigger: 'Pan/Zoom start', visual: 'Disable breathing, focus on gesture' },
    { from: 'INTENT', to: 'AWARENESS', trigger: 'Gesture end + 180ms', visual: 'Re-enable breathing smoothly' },
    { from: '*', to: 'REFLECTION', trigger: 'Modal open', visual: 'Pause all background motion' },
    { from: 'REFLECTION', to: 'AWARENESS', trigger: 'Modal close + 500ms', visual: 'Resume breathing' },
    { from: 'AWARENESS', to: 'IDLE', trigger: '10s stillness', visual: 'Minimal ambient motion' },
] as const;
