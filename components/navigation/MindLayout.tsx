/**
 * 🧠 MindLayout — Horizontal Navigation System v4.0
 * 
 * NAVIGATION CHANGE (December 2024):
 * - Changed from vertical (up/down) to horizontal (left/right) swipe
 * - Swipe LEFT: Go to Horizon (Neural Canvas)
 * - Swipe RIGHT: Return to Orbit (Home)
 * - This eliminates conflicts with ScrollView vertical scrolling
 * 
 * Layout:
 * [Orbit (Home)] <---> [Horizon (Canvas)]
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- Configuration ---
const SPRING_CONFIG = {
    damping: 28,
    stiffness: 120,
    mass: 1.0,
    overshootClamping: false,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
};

const GESTURE_CONFIG = {
    activationThreshold: 35,  // 🔥 Increased to 35 to allow NeuralCanvas to pan freely first
    velocityThreshold: 400,
    rubberBandFactor: 0.25,
};

// Rubber-band effect
const applyRubberBand = (value: number, min: number, max: number, factor: number) => {
    'worklet';
    if (value < min) return min - (min - value) * factor;
    if (value > max) return max + (value - max) * factor;
    return value;
};

export const MindLayout = () => {
    // Horizontal position: 0 = Horizon (Left), -SCREEN_WIDTH = Orbit (Right)
    const translateX = useSharedValue(-SCREEN_WIDTH); // Start at Orbit
    const startX = useSharedValue(-SCREEN_WIDTH);

    const [memoryVisible, setMemoryVisible] = useState(false);
    const activeScreen = useContextStore(state => state.activeScreen);

    // Sync with external state changes
    useEffect(() => {
        if (activeScreen === 'memory') {
            setMemoryVisible(true);
            return;
        } else {
            // Close memory modal if we navigate away to horizon/orbit
            setMemoryVisible(false);
        }

        // Horizon (Left) -> 0, Orbit (Right) -> -SCREEN_WIDTH
        const target = activeScreen === 'horizon' ? 0 : -SCREEN_WIDTH;
        if (Math.abs(translateX.value - target) > 1) {
            translateX.value = withSpring(target, SPRING_CONFIG);
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

    // Horizontal pan gesture
    // Note: minPointers(1).maxPointers(1) ensures this only activates with single finger,
    // allowing 2-finger pinch gestures to pass through to child components (NeuralCanvas)
    const panGesture = Gesture.Pan()
        .minPointers(1)
        .maxPointers(1)
        .activeOffsetX([-GESTURE_CONFIG.activationThreshold, GESTURE_CONFIG.activationThreshold])
        .failOffsetY([-30, 30]) // Allow vertical scrolling to pass through
        .onStart(() => {
            'worklet';
            startX.value = translateX.value;
        })
        .onUpdate((event) => {
            'worklet';
            let nextX = startX.value + event.translationX;
            nextX = applyRubberBand(nextX, -SCREEN_WIDTH, 0, GESTURE_CONFIG.rubberBandFactor);
            translateX.value = nextX;
        })
        .onEnd((event) => {
            'worklet';
            const { velocityX } = event;
            const position = translateX.value;
            // Clamped between -SCREEN_WIDTH (Orbit) and 0 (Horizon)
            const clampedPosition = Math.max(-SCREEN_WIDTH, Math.min(0, position));
            const predictedTarget = clampedPosition + velocityX * 0.15;

            let targetValue: number;
            let targetScreen: 'orbit' | 'horizon';

            // Threshold at -SCREEN_WIDTH * 0.5
            // If < -0.5*W (Right side) -> Orbit
            // If > -0.5*W (Left side) -> Horizon
            if (predictedTarget < -SCREEN_WIDTH * 0.5) {
                targetValue = -SCREEN_WIDTH;
                targetScreen = 'orbit';
            } else {
                targetValue = 0;
                targetScreen = 'horizon';
            }

            translateX.value = withSpring(targetValue, {
                ...SPRING_CONFIG,
                velocity: velocityX
            }, (isFinished) => {
                if (isFinished) {
                    runOnJS(setScreen)(targetScreen);
                }
            });

            runOnJS(haptic)();
        });

    // Container slides horizontally
    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    // Orbit (Right Screen)
    // Visible at -SCREEN_WIDTH, fades/scales as x -> 0
    const orbitStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            translateX.value,
            [-SCREEN_WIDTH, -SCREEN_WIDTH * 0.5],
            [1, 0.3],
            Extrapolate.CLAMP
        );
        const scale = interpolate(
            translateX.value,
            [-SCREEN_WIDTH, 0],
            [1, 0.92],
            Extrapolate.CLAMP
        );
        return { opacity, transform: [{ scale }] };
    });

    // Horizon (Left Screen)
    // Visible at 0, fades/scales as x -> -SCREEN_WIDTH
    const horizonStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            translateX.value,
            [-SCREEN_WIDTH * 0.5, 0],
            [0.3, 1],
            Extrapolate.CLAMP
        );
        const scale = interpolate(
            translateX.value,
            [-SCREEN_WIDTH, 0],
            [0.92, 1],
            Extrapolate.CLAMP
        );
        return { opacity, transform: [{ scale }] };
    });

    return (
        <View style={styles.viewport}>
            <ToastContainer />

            <GestureDetector gesture={panGesture}>
                <Animated.View style={[styles.stack, containerStyle]}>
                    {/* Horizon (Canvas) - Left */}
                    <Animated.View style={[styles.screen, styles.horizon, horizonStyle]}>
                        <HorizonScreen layoutY={translateX} />
                    </Animated.View>

                    {/* Orbit (Home) - Right */}
                    <Animated.View style={[styles.screen, styles.orbit, orbitStyle]}>
                        <OrbitScreen layoutY={translateX} onOpenChronicle={openMemory} />
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
        flexDirection: 'row', // Horizontal layout
        width: SCREEN_WIDTH * 2, // Two screens side by side
        height: SCREEN_HEIGHT
    },
    screen: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
    },
    orbit: {
        // Left screen (index 0)
    },
    horizon: {
        // Right screen (index 1)
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