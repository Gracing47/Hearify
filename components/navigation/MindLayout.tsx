import * as Haptics from 'expo-haptics';
import React from 'react';
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

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Physics Configuration (The "Weight" of the swipe)
const SPRING_CONFIG = {
    damping: 20,
    stiffness: 150,
    mass: 0.8,
    overshootClamping: false,
};

export const MindLayout = () => {
    // 0 = Orbit, -Height = Horizon, +Height = Memory
    const translateY = useSharedValue(0);
    const contextY = useSharedValue(0);

    // Coordination checks
    const isMemoryAtTop = useSharedValue(true);
    const memoryScrollRef = React.useRef<any>(null);

    // Haptic Feedback Helper (Runs on JS Thread)
    const triggerHaptic = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const panGesture = Gesture.Pan()
        .simultaneousWithExternalGesture(memoryScrollRef)
        .onStart(() => {
            contextY.value = translateY.value;
        })
        .onUpdate((e) => {
            let nextY = contextY.value + e.translationY * 0.8;

            // --- SCROLL LOCK LOGIC ---
            // If we are currently at the Memory Screen (bottom, so translateY is approx -SCREEN_HEIGHT)
            // And the user is pulling DOWN (e.translationY > 0) to verify scroll content?
            // Wait: 
            // - Pulling DOWN (positive) moves content DOWN. This is scrolling TOP. 
            // - If at top, we want to move screen (return to Orbit).
            // - If NOT at top, we want to scroll content (Screen should stay locked at -SCREEN_HEIGHT).

            // Check if we are in Memory Zone
            if (contextY.value <= -SCREEN_HEIGHT * 0.9) {
                const tryingToScrollContentUp = e.translationY > 0; // Swipe Down
                const tryingToScrollContentDown = e.translationY < 0; // Swipe Up

                if (tryingToScrollContentUp && !isMemoryAtTop.value) {
                    // We are scrolling up, but not at top yet.
                    // The screen position should NOT change. Lock it.
                    nextY = -SCREEN_HEIGHT;
                }

                // If dragging up (scrolling down), screen stays at max (can't go further up)
                if (tryingToScrollContentDown) {
                    nextY = -SCREEN_HEIGHT;
                }
            }

            // Normal Update
            translateY.value = nextY;
        })
        .onEnd((e) => {
            const velocity = e.velocityY;
            const position = translateY.value;
            const halfHeight = SCREEN_HEIGHT * 0.25;

            let target = 0;

            // 1. Determine nearest snap point based on position
            if (position < -halfHeight) {
                target = -SCREEN_HEIGHT; // Snap to Memory
            } else if (position > halfHeight) {
                target = SCREEN_HEIGHT; // Snap to Horizon
            } else {
                target = 0; // Snap to Orbit
            }

            // 2. Allow "Fling" to override position (Velocity Check)
            // If dragging significantly against the current target, switch target.
            if (velocity < -500) {
                // Fling UP -> Go closer to Memory (-H)
                if (target === SCREEN_HEIGHT) target = 0;
                else if (target === 0) target = -SCREEN_HEIGHT;
            } else if (velocity > 500) {
                // Fling DOWN -> Go closer to Horizon (+H)
                if (target === -SCREEN_HEIGHT) target = 0;
                else if (target === 0) target = SCREEN_HEIGHT;
            }

            translateY.value = withSpring(target, SPRING_CONFIG);

            if (target !== 0) {
                runOnJS(triggerHaptic)();
            }
        });

    // --- ANIMATIONS ---

    // 1. Main Container Movement
    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    // 2. Parallax Effect for the Center Screen (Orbit)
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
