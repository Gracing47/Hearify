/**
 * 🔮 Prediction Store — Zustand State for ACE Results
 * 
 * Manages:
 * - Active predictions (ghost suggestions)
 * - Feedback history (accepted/rejected)
 * - Performance tier state
 */

import { create } from 'zustand';
import type { Snippet } from '../db/schema';

// ============================================================================
// TYPES
// ============================================================================

export type PredictionType = 'SEMANTIC' | 'TEMPORAL' | 'TAG_MATCH' | 'KEYWORD';

export interface Prediction {
    id: string;                      // Unique ID for this prediction instance
    nodeId: number;                  // The Snippet ID this prediction points to
    type: PredictionType;
    node: Snippet;
    confidence: number;              // 0.0 - 1.0
    reason: string;                  // "Beide erwähnen: 'Performance'" (Trust Pivot)
    trigger: string;                 // What user input triggered this
    timestamp: number;               // When this prediction was generated
}

export type FeedbackAction = 'ACCEPTED' | 'REJECTED' | 'IGNORED';

export interface Feedback {
    id: string;                      // The prediction ID
    nodeId: number;                  // The Snippet ID
    action: FeedbackAction;
    timestamp: number;
}

export type PerformanceTier = 'PREMIUM' | 'STANDARD' | 'ECO';

// ============================================================================
// TIER CONFIG
// ============================================================================

export const PERFORMANCE_TIER_CONFIG = {
    PREMIUM: {
        debounce: 300,    // Fast response
        maxPredictions: 5,
        showReason: true,
        description: 'High-End Device'
    },
    STANDARD: {
        debounce: 500,    // Balanced
        maxPredictions: 3,
        showReason: true,
        description: 'Standard Device'
    },
    ECO: {
        debounce: 3000,   // Battery saver
        maxPredictions: 1,
        showReason: false, // Skip reason generation in eco mode
        description: 'Battery Saver Mode'
    }
} as const;

// ============================================================================
// STORE INTERFACE
// ============================================================================

interface PredictionStore {
    // State
    predictions: Prediction[];
    feedbackHistory: Feedback[];
    currentTier: PerformanceTier;
    isProcessing: boolean;
    lastTrigger: string | null;

    // Actions
    setPredictions: (predictions: Prediction[]) => void;
    clearPredictions: () => void;
    recordFeedback: (predictionId: string, nodeId: number, action: FeedbackAction) => void;
    setTier: (tier: PerformanceTier) => void;
    setProcessing: (processing: boolean) => void;
    setLastTrigger: (trigger: string | null) => void;

    // Getters
    wasRejected: (nodeId: number) => boolean;
    getRejectedNodeIds: () => Set<number>;
    getAcceptedCount: () => number;
    getRejectedCount: () => number;
    getTierConfig: () => typeof PERFORMANCE_TIER_CONFIG[PerformanceTier];
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const usePredictionStore = create<PredictionStore>((set, get) => ({
    // Initial State
    predictions: [],
    feedbackHistory: [],
    currentTier: 'STANDARD',
    isProcessing: false,
    lastTrigger: null,

    // Actions
    setPredictions: (predictions) => set({ predictions }),

    clearPredictions: () => set({ predictions: [] }),

    recordFeedback: (predictionId, nodeId, action) => {
        const feedback: Feedback = {
            id: predictionId,
            nodeId,
            action,
            timestamp: Date.now()
        };

        set(state => ({
            feedbackHistory: [...state.feedbackHistory, feedback],
            // Also remove the prediction from active list
            predictions: state.predictions.filter(p => p.id !== predictionId)
        }));

        if (__DEV__) {
            console.log(`[PredictionStore] 📝 Feedback recorded: ${action} for node #${nodeId}`);
        }
    },

    setTier: (tier) => {
        set({ currentTier: tier });
        if (__DEV__) {
            console.log(`[PredictionStore] ⚡ Performance tier changed: ${tier}`);
        }
    },

    setProcessing: (processing) => set({ isProcessing: processing }),

    setLastTrigger: (trigger) => set({ lastTrigger: trigger }),

    // Getters
    wasRejected: (nodeId) => {
        return get().feedbackHistory.some(
            f => f.nodeId === nodeId && f.action === 'REJECTED'
        );
    },

    getRejectedNodeIds: () => {
        const rejected = new Set<number>();
        for (const f of get().feedbackHistory) {
            if (f.action === 'REJECTED') {
                rejected.add(f.nodeId);
            }
        }
        return rejected;
    },

    getAcceptedCount: () => {
        return get().feedbackHistory.filter(f => f.action === 'ACCEPTED').length;
    },

    getRejectedCount: () => {
        return get().feedbackHistory.filter(f => f.action === 'REJECTED').length;
    },

    getTierConfig: () => {
        return PERFORMANCE_TIER_CONFIG[get().currentTier];
    }
}));

// ============================================================================
// SELECTORS (for performance optimization)
// ============================================================================

/**
 * Use these selectors to prevent unnecessary re-renders
 */
export const selectPredictions = (state: PredictionStore) => state.predictions;
export const selectIsProcessing = (state: PredictionStore) => state.isProcessing;
export const selectCurrentTier = (state: PredictionStore) => state.currentTier;
export const selectFeedbackHistory = (state: PredictionStore) => state.feedbackHistory;
