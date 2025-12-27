/**
 * 🧠 MindLayout — Dual Navigation System v3.0
 * 
 * Simplified navigation:
 * - Vertical swipe: Orbit ↔ Horizon (Neural Canvas)
 * - Chronicle Button: Opens Memory as modal overlay
 * 
 * No more scroll conflicts! 🎉
 */

import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
    Gesture,
    GestureDetector,
    GestureStateChangeEvent,
    GestureUpdateEvent,
    PanGestureHandlerEventPayload
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

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- Configuration ---
const SPRING_CONFIG = {
    damping: 25,
    stiffness: 180,
    mass: 0.8,
    overshootClamping: false,
};

const GESTURE_CONFIG = {
    activationThreshold: 20,
    resistanceThreshold: 50,
    velocityThreshold: 600,
    snapThreshold: 0.3,
};

export const MindLayout = () => {
    const translateY = useSharedValue(0);
    const startY = useSharedValue(0);
    const gestureActive = useSharedValue(false);

    // Memory modal state
    const [memoryVisible, setMemoryVisible] = useState(false);

    const activeScreen = useContextStore(state => state.activeScreen);

    // Sync with activeScreen for programmatic navigation (Orbit ↔ Horizon only)
    useEffect(() => {
        if (activeScreen === 'memory') {
            // Open modal instead of swiping
            setMemoryVisible(true);
        } else {
            const target = activeScreen === 'horizon' ? SCREEN_HEIGHT : 0;
            translateY.value = withSpring(target, SPRING_CONFIG);
        }
    }, [activeScreen]);

    const haptic = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

    // Simplified pan gesture: Only Orbit ↔ Horizon
    const panGesture = Gesture.Pan()
        .activeOffsetY([-GESTURE_CONFIG.activationThreshold, GESTURE_CONFIG.activationThreshold])
        .onStart(() => {
            'worklet';
            startY.value = translateY.value;
            gestureActive.value = false;
        })
        .onUpdate((event: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
            'worklet';
            const { translationY } = event;

            // Resistance threshold
            if (!gestureActive.value && Math.abs(translationY) < GESTURE_CONFIG.resistanceThreshold) {
                return;
            }

            gestureActive.value = true;

            // Apply movement with resistance
            const resisted = translationY > 0
                ? translationY - GESTURE_CONFIG.resistanceThreshold
                : translationY + GESTURE_CONFIG.resistanceThreshold;

            // Clamp between 0 (Orbit) and SCREEN_HEIGHT (Horizon)
            let nextY = startY.value + resisted * 0.7;
            nextY = Math.max(0, Math.min(SCREEN_HEIGHT, nextY));
            translateY.value = nextY;
        })
        .onEnd((event: GestureStateChangeEvent<PanGestureHandlerEventPayload>) => {
            'worklet';
            if (!gestureActive.value) {
                return;
            }

            gestureActive.value = false;

            const { velocityY } = event;
            const position = translateY.value;
            const threshold = SCREEN_HEIGHT * GESTURE_CONFIG.snapThreshold;

            // Simple binary decision: Orbit or Horizon
            let target: 'orbit' | 'horizon' = position > threshold ? 'horizon' : 'orbit';

            // Fling override
            if (Math.abs(velocityY) > GESTURE_CONFIG.velocityThreshold) {
                target = velocityY > 0 ? 'horizon' : 'orbit';
            }

            runOnJS(setScreen)(target);
            runOnJS(haptic)();
        });

    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const orbitStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateY.value, [0, SCREEN_HEIGHT * 0.5], [1, 0], Extrapolate.CLAMP),
        transform: [{ scale: interpolate(translateY.value, [0, SCREEN_HEIGHT], [1, 0.92], Extrapolate.CLAMP) }],
    }));

    const horizonStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateY.value, [SCREEN_HEIGHT * 0.15, SCREEN_HEIGHT], [0, 1], Extrapolate.CLAMP),
    }));

    return (
        <View style={styles.viewport}>
            {/* Main Navigation: Orbit ↔ Horizon */}
            <GestureDetector gesture={panGesture}>
                <Animated.View style={[styles.stack, containerStyle]}>
                    {/* Horizon (Below Orbit - swipe down to reveal) */}
                    <Animated.View style={[styles.screen, styles.horizon, horizonStyle]}>
                        <HorizonScreen layoutY={translateY} />
                    </Animated.View>

                    {/* Orbit (Home - default) */}
                    <Animated.View style={[styles.screen, styles.orbit, orbitStyle]}>
                        <OrbitScreen layoutY={translateY} onOpenChronicle={openMemory} />
                    </Animated.View>
                </Animated.View>
            </GestureDetector>

            {/* 📜 Memory Modal */}
            <Modal
                visible={memoryVisible}
                animationType="none"
                transparent={true}
                onRequestClose={closeMemory}
            >
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(150)}
                    style={styles.modalBackdrop}
                >
                    <Pressable style={styles.backdropPressable} onPress={closeMemory} />

                    <Animated.View
                        entering={SlideInDown.springify().damping(20)}
                        exiting={SlideOutDown.duration(200)}
                        style={styles.memoryModal}
                    >
                        {/* Drag Handle */}
                        <View style={styles.dragHandleContainer}>
                            <View style={styles.dragHandle} />
                            <Text style={styles.modalTitle}>Chronicle</Text>
                            <Pressable onPress={closeMemory} style={styles.closeButton}>
                                <Text style={styles.closeButtonText}>✕</Text>
                            </Pressable>
                        </View>

                        {/* Memory Content */}
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
    horizon: {
        top: -SCREEN_HEIGHT
    },
    orbit: {
        top: 0
    },

    // Modal styles
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

export default MindLayout;
