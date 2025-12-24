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

            // In Memory zone: only block when user is scrolling content (not at top)
            // and trying to swipe down to scroll more content
            if (contextY.value <= -SCREEN_HEIGHT * 0.9) {
                // User is in Memory screen
                // Only block if: Memory is NOT at top AND user is swiping down (positive Y = reveal more content)
                if (e.translationY > 0 && !isMemoryAtTop.value) {
                    // User wants to scroll up in content (see more content), block nav swipe
                    nextY = -SCREEN_HEIGHT;
                }
                // Swiping up (negative Y) = trying to go back to Orbit - ALWAYS ALLOW
            }

            // Clamp to valid range
            nextY = Math.max(-SCREEN_HEIGHT, Math.min(SCREEN_HEIGHT, nextY));
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
                        <HorizonScreen layoutY={translateY} />
                    </View>

                    {/* ● CENTER: ORBIT (The Voice) */}
                    <Animated.View style={[styles.screen, orbitStyle]}>
                        <OrbitScreen layoutY={translateY} />
                    </Animated.View>

                    {/* ▼ BOTTOM: MEMORY (The Archive) */}
                    <View style={[styles.screen, { top: SCREEN_HEIGHT }]}>
                        <MemoryScreen
                            scrollRef={memoryScrollRef}
                            isAtTop={isMemoryAtTop}
                            layoutY={translateY}
                        />
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
