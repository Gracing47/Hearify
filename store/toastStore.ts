/**
 * 🔔 Toast Queue Store — M/D/1 Serialized Notification System
 * 
 * Architecture: Markovian arrival, Deterministic service, Single server
 * 
 * Features:
 * - Strict FIFO queue with max size cap (prevents memory leaks)
 * - Automatic deduplication (no consecutive identical toasts)
 * - Haptic feedback mapped to semantic types
 * - Type-safe toast configuration
 */

import * as Haptics from 'expo-haptics';
import { create } from 'zustand';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'merged' | 'duplicate';

export interface ToastMessage {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    icon?: string;
    duration: number; // ms
    timestamp: number;
}

interface ToastState {
    queue: ToastMessage[];
    addToast: (toast: Omit<ToastMessage, 'id' | 'timestamp' | 'duration'> & { duration?: number }) => void;
    removeToast: (id: string) => void;
    clearAll: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_QUEUE_SIZE = 5;

const DEFAULT_DURATIONS: Record<ToastType, number> = {
    success: 3000,
    error: 5000,
    warning: 4000,
    info: 3000,
    merged: 4000,
    duplicate: 2500,
};

const TOAST_ICONS: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
    merged: '🔗',
    duplicate: '📋',
};

// ============================================================================
// HAPTIC MAPPING - Sensory Reinforcement
// ============================================================================

const triggerHaptic = (type: ToastType): void => {
    switch (type) {
        case 'success':
            // Crisp double-tap pattern - completion signal
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            break;
        case 'error':
            // Heavy poly-rhythmic vibration - failure signal
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            break;
        case 'warning':
            // Distinct buzzy pattern - attention required
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            break;
        case 'merged':
            // Medium impact - data consolidation
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            break;
        case 'duplicate':
            // Light selection - acknowledgement
            Haptics.selectionAsync();
            break;
        default:
            // Light feedback for info
            Haptics.selectionAsync();
    }
};

// ============================================================================
// UUID GENERATOR
// ============================================================================

const generateId = (): string => {
    return `toast_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useToastStore = create<ToastState>((set, get) => ({
    queue: [],

    addToast: (toast) => {
        const id = generateId();
        const timestamp = Date.now();
        const duration = toast.duration ?? DEFAULT_DURATIONS[toast.type];
        const icon = toast.icon ?? TOAST_ICONS[toast.type];

        const newToast: ToastMessage = {
            ...toast,
            id,
            icon,
            duration,
            timestamp,
        };

        // Trigger haptic IMMEDIATELY upon logic invocation
        // This provides zero-latency feedback before UI thread paints
        triggerHaptic(toast.type);

        set((state) => {
            const currentQueue = state.queue;

            // DEDUPLICATION: Don't show identical consecutive toasts
            if (currentQueue.length > 0) {
                const lastToast = currentQueue[currentQueue.length - 1];
                if (lastToast.title === toast.title && lastToast.type === toast.type) {
                    console.log('[ToastQueue] Duplicate toast suppressed:', toast.title);
                    return { queue: currentQueue }; // Ignore duplicate
                }
            }

            // FIFO with max size cap - remove oldest if full
            let updatedQueue: ToastMessage[];
            if (currentQueue.length >= MAX_QUEUE_SIZE) {
                updatedQueue = [...currentQueue.slice(1), newToast];
            } else {
                updatedQueue = [...currentQueue, newToast];
            }

            console.log('[ToastQueue] Added:', toast.type, toast.title, `(Queue: ${updatedQueue.length})`);
            return { queue: updatedQueue };
        });
    },

    removeToast: (id) => {
        set((state) => ({
            queue: state.queue.filter((t) => t.id !== id)
        }));
    },

    clearAll: () => {
        set({ queue: [] });
    },
}));

// ============================================================================
// CONVENIENCE METHODS (for external usage)
// ============================================================================

export const toast = {
    success: (title: string, message?: string) =>
        useToastStore.getState().addToast({ type: 'success', title, message }),

    error: (title: string, message?: string) =>
        useToastStore.getState().addToast({ type: 'error', title, message }),

    warning: (title: string, message?: string) =>
        useToastStore.getState().addToast({ type: 'warning', title, message }),

    info: (title: string, message?: string) =>
        useToastStore.getState().addToast({ type: 'info', title, message }),

    merged: (title: string, message?: string) =>
        useToastStore.getState().addToast({ type: 'merged', title, message }),

    duplicate: (title: string, message?: string) =>
        useToastStore.getState().addToast({ type: 'duplicate', title, message }),
};
