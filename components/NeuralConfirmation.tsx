/**
 * Neural Confirmation Chip
 * 
 * Subtle UI feedback when the AI extracts and stores a memory snippet.
 * Premium obsidian aesthetic with soft glow.
 */

import { BlurView } from 'expo-blur';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    FadeInUp,
    FadeOutDown,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';

interface NeuralConfirmationProps {
    type: 'fact' | 'feeling' | 'goal';
    content: string;
    onComplete: () => void;
}

export function NeuralConfirmation({ type, content, onComplete }: NeuralConfirmationProps) {
    const glow = useSharedValue(0.2);

    useEffect(() => {
        // Pulsating glow effect
        glow.value = withRepeat(
            withSequence(
                withTiming(0.6, { duration: 1000 }),
                withTiming(0.2, { duration: 1000 })
            ),
            -1,
            true
        );

        // Auto-dismiss after 4 seconds
        const timer = setTimeout(onComplete, 4000);
        return () => clearTimeout(timer);
    }, []);

    const glowStyle = useAnimatedStyle(() => ({
        shadowOpacity: glow.value,
        borderColor: `rgba(99, 102, 241, ${glow.value + 0.1})`,
    }));

    const getIcon = () => {
        switch (type) {
            case 'fact': return '💎';
            case 'feeling': return '💜';
            case 'goal': return '🎯';
        }
    };

    const getLabel = () => {
        switch (type) {
            case 'fact': return 'FACT LEARNED';
            case 'feeling': return 'FEELING CAPTURED';
            case 'goal': return 'GOAL STORED';
        }
    };

    return (
        <Animated.View
            entering={FadeInUp.springify()}
            exiting={FadeOutDown}
            style={[styles.container, glowStyle]}
        >
            <BlurView intensity={40} tint="dark" style={styles.blur}>
                <Text style={styles.icon}>{getIcon()}</Text>
                <View style={styles.textContainer}>
                    <Text style={styles.label}>{getLabel()}</Text>
                    <Text numberOfLines={2} style={styles.content}>{content}</Text>
                </View>
            </BlurView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 100,
        left: 20,
        right: 20,
        zIndex: 1000,
        borderRadius: 20,
        backgroundColor: 'rgba(99, 102, 241, 0.05)',
        borderWidth: 1,
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 15,
        elevation: 10,
        overflow: 'hidden',
    },
    blur: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    icon: {
        fontSize: 24,
        marginRight: 16,
    },
    textContainer: {
        flex: 1,
    },
    label: {
        color: '#6366f1',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1.5,
        marginBottom: 4,
    },
    content: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 18,
    },
});
