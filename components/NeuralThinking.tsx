/**
 * NeuralThinking - Interactive "Thinking" state for DeepSeek-R1 wait times
 * 
 * Cycles through cognitive simulation labels to make the wait feel productive.
 * Features a glowing pulse and staggered text animations.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';

const COGNITIVE_TASKS = [
    "Neural Matrix scanning...",
    "Semantic context retrieval...",
    "Correlating memories...",
    "DeepSeek-R1 reasoning...",
    "Analyzing sentiment...",
    "Synthesizing response...",
    "Finalizing neural path..."
];

export function NeuralThinking() {
    const [index, setIndex] = useState(0);
    const pulse = useSharedValue(0.4);

    useEffect(() => {
        // Cycle through tasks
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % COGNITIVE_TASKS.length);
        }, 3000);

        // Visual pulse
        pulse.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 1000 }),
                withTiming(0.4, { duration: 1000 })
            ),
            -1,
            true
        );

        return () => clearInterval(interval);
    }, []);

    const glowStyle = useAnimatedStyle(() => ({
        opacity: pulse.value,
        transform: [{ scale: 0.8 + pulse.value * 0.4 }]
    }));

    return (
        <View style={styles.container}>
            {/* Pulsing Neural Core */}
            <View style={styles.coreWrapper}>
                <Animated.View style={[styles.glow, glowStyle]} />
                <View style={styles.core} />
            </View>

            {/* Cycling Thought Text */}
            <View style={styles.textWrapper}>
                <Animated.Text
                    key={COGNITIVE_TASKS[index]}
                    entering={FadeIn.duration(800)}
                    exiting={FadeOut.duration(400)}
                    style={styles.text}
                >
                    {COGNITIVE_TASKS[index]}
                </Animated.Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        gap: 12,
    },
    coreWrapper: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    core: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#6366f1',
    },
    glow: {
        position: 'absolute',
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(99, 102, 241, 0.4)',
    },
    textWrapper: {
        height: 20,
        justifyContent: 'center',
    },
    text: {
        fontSize: 14,
        color: '#888',
        fontWeight: '500',
        fontStyle: 'italic',
    }
});
