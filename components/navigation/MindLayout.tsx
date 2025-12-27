/**
 * 🧠 MindLayout — Dual Navigation System v3.1
 * 
 * Enhanced smooth swipe experience:
 * - Vertical swipe: Orbit ↔ Horizon (Neural Canvas)
 * - Chronicle Button: Opens Memory as modal overlay
 * 
 * Improvements:
 * - Rubber-band resistance at edges
 * - Predictive snap points based on velocity
 * - Smoother spring physics
 * - Better touch response
 */

import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
    Gesture,
    GestureDetector
} from 'react-native-gesture-handler';
import Animated, {
    Extrapolate,
    FadeIn,
    FadeOut,
    interpolate,
    runOnJS,
    SlideInDown,
    SlideOutDown,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';

import { HorizonScreen } from '@/components/screens/HorizonScreen';
import { MemoryScreen } from '@/components/screens/MemoryScreen';
import { OrbitScreen } from '@/components/screens/OrbitScreen';
import { useCTC } from '@/store/CognitiveTempoController';
import { useContextStore } from '@/store/contextStore';
import { ToastContainer } from '../ToastContainer';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- Enhanced Configuration ---
const SPRING_CONFIG = {
    damping: 30,           // More dampened for a premium feel
    stiffness: 150,        // Slightly softer
    mass: 1.0,             // Natural weight
    overshootClamping: false,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
};

const GESTURE_CONFIG = {
    activationThreshold: 10,     // Slightly higher to prevent jitter
    velocityThreshold: 600,      // Higher threshold for intentional flings
    snapThreshold: 0.25,         // Snap earlier
    rubberBandFactor: 0.3,       // More resistance at edges
};

// Rubber-band effect: adds resistance when dragging beyond bounds
const applyRubberBand = (value: number, min: number, max: number, factor: number) => {
    'worklet';
    if (value < min) {
        const diff = min - value;
        return min - diff * factor;
    }
    if (value > max) {
        const diff = value - max;
        return max + diff * factor;
    }
    return value;
};

export const MindLayout = () => {
    const translateY = useSharedValue(0);
    const startY = useSharedValue(0);

    const [memoryVisible, setMemoryVisible] = useState(false);
    const activeScreen = useContextStore(state => state.activeScreen);

    // Sync with activeScreen (only for initial load or external state changes)
    useEffect(() => {
        if (activeScreen === 'memory') {
            setMemoryVisible(true);
            return;
        }

        const target = activeScreen === 'horizon' ? -SCREEN_HEIGHT : 0;
        // Check if we are already there to avoid unnecessary animations
        if (Math.abs(translateY.value - target) > 1) {
            translateY.value = withSpring(target, SPRING_CONFIG);
        }
    }, [activeScreen]);

    const haptic = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    const setScreen = useCallback((screen: 'orbit' | 'horizon') => {
        useContextStore.getState().setActiveScreen(screen);
        const ctc = useCTC.getState();
        if (screen === 'orbit') ctc.exitReflection();
        else ctc.touch();
    }, []);

    const openMemory = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setMemoryVisible(true);
        useContextStore.getState().setActiveScreen('memory');
        useCTC.getState().enterReflection();
    }, []);

    const closeMemory = useCallback(() => {
        setMemoryVisible(false);
        useContextStore.getState().setActiveScreen('orbit');
        useCTC.getState().exitReflection();
    }, []);

    // Enhanced pan gesture with rubber-banding
    const panGesture = Gesture.Pan()
        .activeOffsetY([-GESTURE_CONFIG.activationThreshold, GESTURE_CONFIG.activationThreshold])
        .failOffsetX([-50, 50]) // Much more forgiving for non-perfect vertical swipes
        .onStart(() => {
            'worklet';
            startY.value = translateY.value;
        })
        .onUpdate((event) => {
            'worklet';
            const { translationY } = event;

            // Calculate raw next position
            let nextY = startY.value + translationY;

            // Apply rubber-band resistance at edges
            nextY = applyRubberBand(
                nextY,
                -SCREEN_HEIGHT,
                0,
                GESTURE_CONFIG.rubberBandFactor
            );

            translateY.value = nextY;
        })
        .onEnd((event) => {
            'worklet';
            const { velocityY } = event;
            const position = translateY.value;

            // Clamp position back to valid range for target calculation
            const clampedPosition = Math.max(-SCREEN_HEIGHT, Math.min(0, position));

            // Predictive target: where would we land based on velocity?
            const predictedTarget = clampedPosition + velocityY * 0.15;

            let targetValue: number;
            let targetScreen: 'orbit' | 'horizon';

            // Determination based on prediction and current position
            if (predictedTarget < -SCREEN_HEIGHT * 0.5) {
                targetValue = -SCREEN_HEIGHT;
                targetScreen = 'horizon';
            } else {
                targetValue = 0;
                targetScreen = 'orbit';
            }

            // Execute "Liquid Snap" using current velocity
            translateY.value = withSpring(targetValue, {
                ...SPRING_CONFIG,
                velocity: velocityY
            }, (isFinished) => {
                if (isFinished) {
                    runOnJS(setScreen)(targetScreen);
                }
            });

            runOnJS(haptic)();
        });

    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    // Orbit: fade out smoothly as we swipe up
    const orbitStyle = useAnimatedStyle(() => {
        const fadeStart = -SCREEN_HEIGHT * 0.2;
        const opacity = interpolate(
            translateY.value,
            [-SCREEN_HEIGHT * 0.4, fadeStart, 0],
            [0, 0.5, 1],
            Extrapolate.CLAMP
        );

        const scale = interpolate(
            translateY.value,
            [-SCREEN_HEIGHT, 0],
            [0.94, 1],
            Extrapolate.CLAMP
        );

        return {
            opacity,
            transform: [{ scale }],
        };
    });

    // Horizon: fade in smoothly as we swipe up
    const horizonStyle = useAnimatedStyle(() => {
        const fadeEnd = -SCREEN_HEIGHT * 0.8;
        const opacity = interpolate(
            translateY.value,
            [-SCREEN_HEIGHT, fadeEnd, -SCREEN_HEIGHT * 0.2],
            [1, 1, 0],
            Extrapolate.CLAMP
        );

        const scale = interpolate(
            translateY.value,
            [-SCREEN_HEIGHT, 0],
            [1, 0.96],
            Extrapolate.CLAMP
        );

        return {
            opacity,
            transform: [{ scale }],
        };
    });

    return (
        <View style={styles.viewport}>
            <ToastContainer />

            <GestureDetector gesture={panGesture}>
                <Animated.View style={[styles.stack, containerStyle]}>
                    {/* Horizon (Below) */}
                    <Animated.View style={[styles.screen, styles.horizon, horizonStyle]}>
                        <HorizonScreen layoutY={translateY} />
                    </Animated.View>

                    {/* Orbit (Home) */}
                    <Animated.View style={[styles.screen, styles.orbit, orbitStyle]}>
                        <OrbitScreen layoutY={translateY} onOpenChronicle={openMemory} />
                    </Animated.View>
                </Animated.View>
            </GestureDetector>

            {/* Memory Modal */}
            <Modal
                visible={memoryVisible}
                animationType="none"
                transparent={true}
                onRequestClose={closeMemory}
            >
                <Animated.View
                    entering={FadeIn.duration(400)}
                    exiting={FadeOut.duration(250)}
                    style={styles.modalBackdrop}
                >
                    <Pressable style={styles.backdropPressable} onPress={closeMemory} />

                    <Animated.View
                        entering={SlideInDown.springify().damping(28).stiffness(140).mass(0.8)}
                        exiting={SlideOutDown.duration(300)}
                        style={styles.memoryModal}
                    >
                        <View style={styles.dragHandleContainer}>
                            <View style={styles.dragHandle} />
                            <Text style={styles.modalTitle}>Chronicle</Text>
                            <Pressable onPress={closeMemory} style={styles.closeButton}>
                                <Text style={styles.closeButtonText}>✕</Text>
                            </Pressable>
                        </View>

                        <View style={styles.memoryContent}>
                            <MemoryScreen />
                        </View>
                    </Animated.View>
                </Animated.View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    viewport: {
        flex: 1,
        backgroundColor: '#000',
        overflow: 'hidden'
    },
    stack: {
        flex: 1,
        height: SCREEN_HEIGHT
    },
    screen: {
        height: SCREEN_HEIGHT,
        width: '100%',
        position: 'absolute'
    },
    orbit: {
        top: 0
    },
    horizon: {
        top: SCREEN_HEIGHT  // Horizon is BELOW Orbit
    },

    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    backdropPressable: {
        height: 60,
    },
    memoryModal: {
        flex: 1,
        backgroundColor: '#0a0a0f',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    dragHandleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    dragHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        position: 'absolute',
        left: '50%',
        marginLeft: -20,
        top: 8,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: -0.3,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeButtonText: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.6)',
    },
    memoryContent: {
        flex: 1,
    },
});