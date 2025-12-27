/**
 * 🔔 Toast Container — Reanimated 3 Layout Animation Controller
 * 
 * Features:
 * - SlideInUp with spring physics for entrance
 * - SlideOutRight for dismissal
 * - Layout.springify() for automatic position transitions
 * - pointerEvents="box-none" for touch passthrough
 * - Auto-dismissal timer
 * 
 * This component mounts at the App root, outside navigation.
 */

import { ToastMessage, ToastType, useToastStore } from '@/store/toastStore';
import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Layout,
    SlideInUp,
    SlideOutRight
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ============================================================================
// COLOR PALETTE
// ============================================================================

const TOAST_COLORS: Record<ToastType, { bg: string; border: string; text: string }> = {
    success: {
        bg: 'rgba(16, 185, 129, 0.95)',
        border: 'rgba(16, 185, 129, 0.3)',
        text: '#ffffff',
    },
    error: {
        bg: 'rgba(239, 68, 68, 0.95)',
        border: 'rgba(239, 68, 68, 0.3)',
        text: '#ffffff',
    },
    warning: {
        bg: 'rgba(245, 158, 11, 0.95)',
        border: 'rgba(245, 158, 11, 0.3)',
        text: '#000000',
    },
    info: {
        bg: 'rgba(59, 130, 246, 0.95)',
        border: 'rgba(59, 130, 246, 0.3)',
        text: '#ffffff',
    },
    merged: {
        bg: 'rgba(139, 92, 246, 0.95)',
        border: 'rgba(139, 92, 246, 0.3)',
        text: '#ffffff',
    },
    duplicate: {
        bg: 'rgba(107, 114, 128, 0.95)',
        border: 'rgba(107, 114, 128, 0.3)',
        text: '#ffffff',
    },
};

// ============================================================================
// TOAST ITEM COMPONENT
// ============================================================================

interface ToastItemProps extends ToastMessage {
    onDismiss: () => void;
}

const ToastItem = ({ id, title, message, type, icon, duration, onDismiss }: ToastItemProps) => {
    const colors = TOAST_COLORS[type];

    // Auto-dismiss timer
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onDismiss]);

    return (
        <Animated.View
            // ENTERING: Slide in from top with spring physics
            entering={SlideInUp.springify().damping(18).stiffness(120)}
            // EXITING: Slide out to the right
            exiting={SlideOutRight.duration(200)}
            // LAYOUT: Automatic position transitions when siblings change
            layout={Layout.springify().damping(15)}
            style={[
                styles.toastCard,
                {
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                }
            ]}
        >
            {/* Icon */}
            <View style={styles.iconContainer}>
                <Text style={[styles.icon, { color: colors.text }]}>{icon}</Text>
            </View>

            {/* Content */}
            <View style={styles.contentContainer}>
                <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                {message && (
                    <Text style={[styles.message, { color: colors.text, opacity: 0.9 }]}>
                        {message}
                    </Text>
                )}
            </View>

            {/* Dismiss Button */}
            <Pressable onPress={onDismiss} style={styles.dismissButton} hitSlop={10}>
                <Text style={[styles.dismissText, { color: colors.text }]}>✕</Text>
            </Pressable>
        </Animated.View>
    );
};

// ============================================================================
// TOAST CONTAINER COMPONENT
// ============================================================================

export const ToastContainer = () => {
    const queue = useToastStore((state) => state.queue);
    const removeToast = useToastStore((state) => state.removeToast);
    const insets = useSafeAreaInsets();

    if (queue.length === 0) return null;

    return (
        <View
            style={[styles.container, { top: insets.top + 10 }]}
            pointerEvents="box-none" // Critical: allows touches to pass through empty areas
        >
            {queue.map((toast) => (
                <ToastItem
                    key={toast.id} // CRITICAL: Use unique ID, not index!
                    {...toast}
                    onDismiss={() => removeToast(toast.id)}
                />
            ))}
        </View>
    );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 9999,
        elevation: 9999,
        alignItems: 'center',
    },
    toastCard: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 8,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    iconContainer: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    icon: {
        fontSize: 14,
        fontWeight: '700',
    },
    contentContainer: {
        flex: 1,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    message: {
        fontSize: 13,
        fontWeight: '500',
        marginTop: 2,
        lineHeight: 18,
    },
    dismissButton: {
        marginLeft: 12,
        padding: 4,
    },
    dismissText: {
        fontSize: 14,
        fontWeight: '600',
        opacity: 0.7,
    },
});
