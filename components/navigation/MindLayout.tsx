import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Extrapolate,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';

// 👇 IMPORT YOUR SCREENS HERE
import { HorizonScreen } from '@/components/screens/HorizonScreen';
import { MemoryScreen } from '@/components/screens/MemoryScreen';
import { OrbitScreen } from '@/components/screens/OrbitScreen';
import { useContextStore } from '@/store/contextStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Physics Configuration (The "Weight" of the swipe)
const SPRING_CONFIG = {
    damping: 20,
    stiffness: 150,
    mass: 0.8,
    overshootClamping: false,
};

export const MindLayout = () => {
    // 0 = Orbit, -SCREEN_HEIGHT = Horizon, SCREEN_HEIGHT = Memory
    const translateY = useSharedValue(0);
    const contextY = useSharedValue(0);

    const activeScreen = useContextStore(state => state.activeScreen);

    // Sync state to translateY
    useEffect(() => {
        let target = 0;
        if (activeScreen === 'horizon') target = SCREEN_HEIGHT;
        else if (activeScreen === 'memory') target = -SCREEN_HEIGHT;
        else target = 0;

        translateY.value = withSpring(target, SPRING_CONFIG);
    }, [activeScreen]);

    // Coordination checks
    const isMemoryAtTop = useSharedValue(true);
    const memoryScrollRef = React.useRef<any>(null);

    // Haptic Feedback Helper (Runs on JS Thread)
    const triggerHaptic = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    // Helper for runOnJS (must be a stable reference)
    const updateActiveScreen = (screen: 'orbit' | 'horizon' | 'memory') => {
        useContextStore.getState().setActiveScreen(screen);
    };

    const panGesture = Gesture.Pan()
        .simultaneousWithExternalGesture(memoryScrollRef)
        .onStart(() => {
            contextY.value = translateY.value;
        })
        .onUpdate((e) => {
            let nextY = contextY.value + e.translationY * 0.8;

            // Check if we are in Memory Zone (bottom, nextY < 0?)
            // Wait, in this layout: 
            // Orbit at 0
            // Horizon at SCREEN_HEIGHT (top of container is moved DOWN)
            // Memory at -SCREEN_HEIGHT (top of container is moved UP)
            if (contextY.value <= -SCREEN_HEIGHT * 0.9) {
                const tryingToScrollContentUp = e.translationY > 0; // Swipe Down
                const tryingToScrollContentDown = e.translationY < 0; // Swipe Up

                if (tryingToScrollContentUp && !isMemoryAtTop.value) {
                    nextY = -SCREEN_HEIGHT;
                }
                if (tryingToScrollContentDown) {
                    nextY = -SCREEN_HEIGHT;
                }
            }

            translateY.value = nextY;
        })
        .onEnd((e) => {
            const velocity = e.velocityY;
            const position = translateY.value;
            const halfHeight = SCREEN_HEIGHT * 0.25;

            let target: 'orbit' | 'horizon' | 'memory' = 'orbit';

            // 1. Determine nearest snap point based on position
            if (position < -halfHeight) {
                target = 'memory';
            } else if (position > halfHeight) {
                target = 'horizon';
            } else {
                target = 'orbit';
            }

            // 2. Allow "Fling" to override position (Velocity Check)
            if (velocity < -500) {
                // Fling UP -> Go closer to Memory (-H)
                if (target === 'horizon') target = 'orbit';
                else if (target === 'orbit') target = 'memory';
            } else if (velocity > 500) {
                // Fling DOWN -> Go closer to Horizon (+H)
                if (target === 'memory') target = 'orbit';
                else if (target === 'orbit') target = 'horizon';
            }

            runOnJS(updateActiveScreen)(target);

            if (target !== 'orbit') {
                runOnJS(triggerHaptic)();
            }
        });

    // --- ANIMATIONS ---

    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const orbitStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            translateY.value,
            [-SCREEN_HEIGHT / 2, 0, SCREEN_HEIGHT / 2],
            [0, 1, 0],
            Extrapolate.CLAMP
        ),
        transform: [{
            scale: interpolate(
                translateY.value,
                [-SCREEN_HEIGHT, 0, SCREEN_HEIGHT],
                [0.85, 1, 0.85],
                Extrapolate.CLAMP
            )
        }],
    }));

    return (
        <View style={styles.viewport}>
            <GestureDetector gesture={panGesture}>
                <Animated.View style={[styles.infiniteStack, containerStyle]}>

                    {/* ▲ TOP: HORIZON (The Stars) */}
                    <View style={[styles.screen, { top: -SCREEN_HEIGHT }]}>
                        <HorizonScreen />
                    </View>

                    {/* ● CENTER: ORBIT (The Voice) */}
                    <Animated.View style={[styles.screen, orbitStyle]}>
                        <OrbitScreen />
                    </Animated.View>

                    {/* ▼ BOTTOM: MEMORY (The Archive) */}
                    <View style={[styles.screen, { top: SCREEN_HEIGHT }]}>
                        <MemoryScreen scrollRef={memoryScrollRef} isAtTop={isMemoryAtTop} />
                    </View>

                </Animated.View>
            </GestureDetector>
        </View>
    );
};

const styles = StyleSheet.create({
    viewport: {
        flex: 1,
        backgroundColor: '#000', // Deep Void
        overflow: 'hidden',
    },
    infiniteStack: {
        flex: 1,
        height: SCREEN_HEIGHT,
        position: 'relative',
    },
    screen: {
        height: SCREEN_HEIGHT,
        width: '100%',
        position: 'absolute',
        left: 0,
    },
});
