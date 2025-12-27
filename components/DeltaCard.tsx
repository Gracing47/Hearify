/**
 * 🌅 DeltaCard — Gentle Reflection Guide
 * 
 * Minimal, non-intrusive daily summary card.
 * Appears subtly during reflection windows (lunch/evening).
 */

import { BlurView } from 'expo-blur';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { DailyDelta } from '../services/DeltaService';

interface DeltaCardProps {
    delta: DailyDelta;
    onDismiss?: () => void;
}

const MOOD_EMOJI: Record<string, string> = {
    analytical: '🔬',
    reflective: '💭',
    creative: '✨',
    mixed: '🌈'
};

export const DeltaCard = ({ delta, onDismiss }: DeltaCardProps) => {
    const moodEmoji = MOOD_EMOJI[delta.mood] || '💭';

    // Show only first 2 highlights
    const highlights = delta.highlights.slice(0, 2);

    return (
        <Animated.View
            entering={FadeIn.delay(500).duration(600)}
            exiting={FadeOut.duration(300)}
            style={styles.container}
        >
            <BlurView intensity={30} tint="dark" style={styles.blur}>
                {/* Compact Header */}
                <View style={styles.header}>
                    <Text style={styles.emoji}>{moodEmoji}</Text>
                    <View style={styles.headerText}>
                        <Text style={styles.greeting}>Yesterday's reflection</Text>
                    </View>
                    <Pressable onPress={onDismiss} hitSlop={12}>
                        <Text style={styles.closeBtn}>✕</Text>
                    </Pressable>
                </View>

                {/* Summary - One line max */}
                <Text style={styles.summary} numberOfLines={2}>
                    {delta.summary}
                </Text>

                {/* Compact Highlights */}
                {highlights.length > 0 && (
                    <View style={styles.highlights}>
                        {highlights.map((h, idx) => (
                            <Text key={idx} style={styles.highlight}>• {h}</Text>
                        ))}
                    </View>
                )}

                {/* Subtle Stats */}
                <Text style={styles.stat}>
                    {delta.nodeCount} thoughts captured
                </Text>
            </BlurView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 20,
        marginTop: 8,
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    blur: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    emoji: {
        fontSize: 20,
        marginRight: 10,
    },
    headerText: {
        flex: 1,
    },
    greeting: {
        fontSize: 13,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.6)',
        letterSpacing: 0.3,
    },
    closeBtn: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.3)',
        padding: 4,
    },
    summary: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.85)',
        lineHeight: 20,
        marginBottom: 10,
    },
    highlights: {
        marginBottom: 8,
    },
    highlight: {
        fontSize: 12,
        color: 'rgba(165, 180, 252, 0.8)',
        marginBottom: 3,
    },
    stat: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.3)',
    },
});
