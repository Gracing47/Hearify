/**
 * 🌌 PANORAMA SCREEN — The Trinity Triptych v2.0
 * 
 * Architecture: Spatial Canvas (3x Screen Width)
 * Zone 1 (Left)   🌌 HORIZON:   The Graph (Subconscious)
 * Zone 2 (Center) ⏺️ ORBIT:     The Input (Conscious) [START]
 * Zone 3 (Right)  📜 CHRONICLE: The Timeline (Memory)
 * 
 * v2.0 Changes:
 * - Each zone renders its own full screen (not layered)
 * - Edge-swipe detection (swipe from screen edges to switch zones)
 * - Full interactivity within each zone
 */

import { NeuralLensesHUD } from '@/components/NeuralLensesHUD';
import { HorizonScreen } from '@/components/screens/HorizonScreen';
import { MemoryScreen } from '@/components/screens/MemoryScreen';
import { OrbitScreen } from '@/components/screens/OrbitScreen';
import { useContextStore } from '@/store/contextStore';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Extrapolate,
    interpolate,
    runOnJS,
    useAnimatedReaction,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withDecay,
    withSpring
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Physics Config
const SPRING_CONFIG = {
    damping: 22,
    stiffness: 180,
    mass: 0.6,
    overshootClamping: false,
};

const GESTURE_CONFIG = {
    edgeWidth: 40, // Pixels from edge to trigger swipe
    activationThreshold: 30,
    velocityThreshold: 400,
    rubberBandFactor: 0.2,
};

type Zone = 'HORIZON' | 'ORBIT' | 'CHRONICLE';

// Rubber-band effect
const applyRubberBand = (value: number, min: number, max: number, factor: number) => {
    'worklet';
    if (value < min) return min - (min - value) * factor;
    if (value > max) return max + (value - max) * factor;
    return value;
};

export const PanoramaScreen = () => {
    // Start in the Middle (Orbit) -> Offset = -SCREEN_WIDTH
    const translateX = useSharedValue(-SCREEN_WIDTH);
    const startX = useSharedValue(-SCREEN_WIDTH);
    const cameraZ = useSharedValue(0);
    const startZ = useSharedValue(0);
    const lastHapticZ = useSharedValue(0);
    const gestureStartedFromEdge = useSharedValue(false);
    const zoomSide = useSharedValue<0 | 1 | 2>(0); // 0=none, 1=left, 2=right
    const [activeZone, setActiveZone] = useState<Zone>('ORBIT');

    const activeScreen = useContextStore(state => state.activeScreen);

    // 🔊 Haptic Engine
    const haptic = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    // Sync activeZone to UI thread for worklets
    const activeZoneSV = useSharedValue<Zone>('ORBIT');
    useEffect(() => {
        activeZoneSV.value = activeZone;
    }, [activeZone]);

    // 🔊 Edge Zoom Haptics
    useAnimatedReaction(
        () => Math.floor(cameraZ.value / 100),
        (val, prev) => {
            if (val !== prev && activeZoneSV.value === 'HORIZON') {
                runOnJS(haptic)();
            }
        }
    );

    // Sync with context store

    useEffect(() => {
        // External navigation (e.g., from Chronicle button)
        const targetX = activeScreen === 'horizon' ? 0 :
            activeScreen === 'memory' ? -SCREEN_WIDTH * 2 :
                -SCREEN_WIDTH;
        if (Math.abs(translateX.value - targetX) > 1) {
            translateX.value = withSpring(targetX, SPRING_CONFIG);
            const zone: Zone = activeScreen === 'horizon' ? 'HORIZON' :
                activeScreen === 'memory' ? 'CHRONICLE' : 'ORBIT';
            setActiveZone(zone);
        }
    }, [activeScreen]);

    const syncZone = useCallback((zone: Zone) => {
        setActiveZone(zone);
        const screen = zone === 'HORIZON' ? 'horizon' : zone === 'CHRONICLE' ? 'memory' : 'orbit';
        useContextStore.getState().setActiveScreen(screen);
    }, []);


    // Shared gesture handler logic
    const createEdgeGesture = (side: 'left' | 'right') => Gesture.Pan()
        .minPointers(1)
        .maxPointers(1)
        .activeOffsetX(side === 'left' ? [0, 15] : [-15, 0]) // Precise activation
        .onStart(() => {
            'worklet';
            startX.value = translateX.value;
            startZ.value = cameraZ.value;
            zoomSide.value = side === 'left' ? 1 : 2;
        })
        .onUpdate((e) => {
            'worklet';
            // ↔️ Axis 1: Horizontal screen switching
            let nextX = startX.value + e.translationX;
            nextX = applyRubberBand(nextX, -SCREEN_WIDTH * 2, 0, GESTURE_CONFIG.rubberBandFactor);
            translateX.value = nextX;

            // ↕️ Axis 2: Vertical Edge-Zoom (Exclusive to Horizon)
            // Depth Mapping: Up = In (-Z), Down = Out (+Z)
            const sensitivity = 3.5; // Optimized for 60hz smoothness
            let targetZ = startZ.value + e.translationY * sensitivity;

            // Hard clamp for update to keep sync
            targetZ = Math.max(-1600, Math.min(800, targetZ));

            // Apply smoothing
            cameraZ.value = withSpring(targetZ, { damping: 26, stiffness: 220 });
        })
        .onEnd((e) => {
            'worklet';
            zoomSide.value = 0;

            const { velocityX, velocityY } = e;
            const position = translateX.value;
            const clampedPosition = Math.max(-SCREEN_WIDTH * 2, Math.min(0, position));
            const predictedEnd = clampedPosition + velocityX * 0.15;

            // ↕️ Axis 2: Vertical Zoom Decay (Momentum)
            if (Math.abs(velocityY) > 400 && activeZone === 'HORIZON') {
                cameraZ.value = withDecay({
                    velocity: velocityY * 1.5,
                    clamp: [-1500, 700],
                    deceleration: 0.998
                });
            }

            let targetX = -SCREEN_WIDTH;
            let targetZone: Zone = 'ORBIT';

            const horizonThreshold = -SCREEN_WIDTH * 0.5;
            const chronicleThreshold = -SCREEN_WIDTH * 1.5;

            if (predictedEnd > horizonThreshold) {
                targetX = 0;
                targetZone = 'HORIZON';
            } else if (predictedEnd < chronicleThreshold) {
                targetX = -SCREEN_WIDTH * 2;
                targetZone = 'CHRONICLE';
            }

            translateX.value = withSpring(targetX, {
                ...SPRING_CONFIG,
                velocity: velocityX
            });

            runOnJS(syncZone)(targetZone);
            runOnJS(haptic)();
        });

    const leftPanGesture = createEdgeGesture('left');
    const rightPanGesture = createEdgeGesture('right');

    // 🌊 Depth Gauge (Visual Feedback)
    const gaugeOpacity = useDerivedValue(() => {
        return withSpring(zoomSide.value !== 0 && activeZone === 'HORIZON' ? 1 : 0);
    });

    const gaugeHeight = useDerivedValue(() => {
        // Map cameraZ (-1500 to 700) to percentage (0% to 100%)
        // -1500 (deep) -> 100% (bar full)
        // 700 (out) -> 0% (bar empty)
        return interpolate(cameraZ.value, [700, -1500], [0, 100], Extrapolate.CLAMP);
    });

    const gaugeStyle = useAnimatedStyle(() => ({
        opacity: gaugeOpacity.value,
        height: `${gaugeHeight.value}%`,
        backgroundColor: zoomSide.value === 1 ? '#818cf8' : '#c084fc', // Indigo vs Purple
        left: zoomSide.value === 1 ? 0 : undefined,
        right: zoomSide.value === 2 ? 0 : undefined,
    }));

    // Foreground Screens
    const foregroundStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    // Zone opacity animations
    const horizonOpacity = useDerivedValue(() =>
        interpolate(translateX.value, [-SCREEN_WIDTH, 0], [0.5, 1], Extrapolate.CLAMP)
    );
    const orbitOpacity = useDerivedValue(() =>
        interpolate(translateX.value, [-SCREEN_WIDTH * 2, -SCREEN_WIDTH, 0], [0.5, 1, 0.5], Extrapolate.CLAMP)
    );
    const chronicleOpacity = useDerivedValue(() =>
        interpolate(translateX.value, [-SCREEN_WIDTH * 2, -SCREEN_WIDTH], [1, 0.5], Extrapolate.CLAMP)
    );

    const horizonStyle = useAnimatedStyle(() => ({ opacity: horizonOpacity.value }));
    const orbitStyle = useAnimatedStyle(() => ({ opacity: orbitOpacity.value }));
    const chronicleStyle = useAnimatedStyle(() => ({ opacity: chronicleOpacity.value }));

    return (
        <View style={styles.container}>
            {/* Main Content (NOT wrapped in GestureDetector) */}
            {/* pointerEvents='box-none' allows touches to pass through to children */}
            <Animated.View style={[styles.track, foregroundStyle]} pointerEvents="box-none">

                {/* 👈 ZONE 1: HORIZON */}
                <Animated.View style={[styles.screen, horizonStyle]} pointerEvents="box-none">
                    <HorizonScreen layoutY={translateX} cameraZ={cameraZ} />
                </Animated.View>

                {/* ⏺️ ZONE 2: ORBIT */}
                <Animated.View style={[styles.screen, orbitStyle]} pointerEvents="box-none">
                    <OrbitScreen layoutY={translateX} />
                </Animated.View>

                {/* 👉 ZONE 3: CHRONICLE */}
                <Animated.View style={[styles.screen, chronicleStyle]} pointerEvents="box-none">
                    <MemoryScreen />
                </Animated.View>

            </Animated.View>

            {/* Left Edge Swipe Zone */}
            <GestureDetector gesture={leftPanGesture}>
                <Animated.View style={styles.leftEdge} />
            </GestureDetector>

            {/* Right Edge Swipe Zone */}
            <GestureDetector gesture={rightPanGesture}>
                <Animated.View style={styles.rightEdge} />
            </GestureDetector>

            {/* Global HUD - Rendered at PanoramaScreen level to be above all gestures */}
            {activeZone === 'HORIZON' && (
                <>
                    <NeuralLensesHUD />
                    {/* Depth Gauge */}
                    <Animated.View style={[styles.gaugeContainer, { opacity: gaugeOpacity }]}>
                        <Animated.View style={[styles.gaugeBar, gaugeStyle]} />
                    </Animated.View>
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        overflow: 'hidden',
    },
    track: {
        flexDirection: 'row',
        width: SCREEN_WIDTH * 3,
        height: SCREEN_HEIGHT,
    },
    screen: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
    },
    leftEdge: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: GESTURE_CONFIG.edgeWidth,
        height: SCREEN_HEIGHT,
        // backgroundColor: 'rgba(255,0,0,0.2)', // Debug: uncomment to see edge zone
    },
    rightEdge: {
        position: 'absolute',
        right: 0,
        top: 0,
        width: GESTURE_CONFIG.edgeWidth,
        height: SCREEN_HEIGHT,
        zIndex: 50,
    },
    gaugeContainer: {
        position: 'absolute',
        top: 100,
        bottom: 100,
        width: 4,
        zIndex: 100,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        overflow: 'hidden',
        // Dynamic positioning via style prop
    },
    gaugeBar: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        borderRadius: 2,
    }
});
