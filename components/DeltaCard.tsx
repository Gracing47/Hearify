/**
 * 🌅 DeltaCard — Morning Reflection Display
 * 
 * Glassmorphic card showing daily AI-generated summaries
 */

import { BlurView } from 'expo-blur';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

import { DailyDelta } from '../services/DeltaService';

interface DeltaCardProps {
    delta: DailyDelta;
    onDismiss?: () => void;
    onDiveDeeper?: () => void;
}

const MOOD_EMOJI: Record<string, string> = {
    analytical: '🔬',
    reflective: '💭',
    creative: '✨',
    mixed: '🌈'
};

const MOOD_COLORS: Record<string, string> = {
    analytical: '#22d3ee',
    reflective: '#a78bfa',
    creative: '#fde047',
    mixed: '#f472b6'
};

export const DeltaCard = ({ delta, onDismiss, onDiveDeeper }: DeltaCardProps) => {
    const moodEmoji = MOOD_EMOJI[delta.mood] || '🌈';
    const moodColor = MOOD_COLORS[delta.mood] || '#818cf8';

    const formattedDate = formatDisplayDate(delta.date);

    return (
        <Animated.View
            entering={FadeInDown.springify().damping(15)}
            exiting={FadeOutUp.duration(200)}
            style={styles.container}
        >
            <BlurView intensity={40} tint="dark" style={styles.blur}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.emoji}>{moodEmoji}</Text>
                    <View style={styles.headerText}>
                        <Text style={styles.title}>Daily Delta</Text>
                        <Text style={styles.date}>{formattedDate}</Text>
                    </View>
                    <View style={[styles.moodBadge, { backgroundColor: moodColor + '20' }]}>
                        <Text style={[styles.moodText, { color: moodColor }]}>
                            {delta.mood.toUpperCase()}
                        </Text>
                    </View>
                </View>

                {/* Summary */}
                <Text style={styles.summary}>{delta.summary}</Text>

                {/* Highlights */}
                {delta.highlights.length > 0 && (
                    <View style={styles.highlightsContainer}>
                        {delta.highlights.map((h, idx) => (
                            <View key={idx} style={styles.highlightChip}>
                                <Text style={styles.highlightText}>{h}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Stats */}
                <View style={styles.stats}>
                    <Text style={styles.statText}>
                        {delta.nodeCount} thoughts captured
                    </Text>
                    {delta.topClusters.length > 0 && (
                        <Text style={styles.statText}>
                            • {delta.topClusters.slice(0, 2).join(', ')}
                        </Text>
                    )}
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                    {onDismiss && (
                        <Pressable style={styles.dismissBtn} onPress={onDismiss}>
                            <Text style={styles.dismissText}>Dismiss</Text>
                        </Pressable>
                    )}
                    {onDiveDeeper && (
                        <Pressable style={styles.diveBtn} onPress={onDiveDeeper}>
                            <Text style={styles.diveText}>Dive Deeper →</Text>
                        </Pressable>
                    )}
                </View>
            </BlurView>
        </Animated.View>
    );
};

function formatDisplayDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);

    if (targetDate.getTime() === yesterday.getTime()) {
        return 'Yesterday';
    }

    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
    });
}

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        marginVertical: 12,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    blur: {
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    emoji: {
        fontSize: 32,
        marginRight: 12,
    },
    headerText: {
        flex: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 0.5,
    },
    date: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.5)',
        marginTop: 2,
    },
    moodBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    moodText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
    summary: {
        fontSize: 15,
        color: 'rgba(255, 255, 255, 0.9)',
        lineHeight: 22,
        marginBottom: 16,
    },
    highlightsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    highlightChip: {
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.3)',
    },
    highlightText: {
        fontSize: 12,
        color: '#a5b4fc',
        fontWeight: '600',
    },
    stats: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    statText: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.4)',
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    dismissBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    dismissText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 14,
        fontWeight: '600',
    },
    diveBtn: {
        backgroundColor: 'rgba(99, 102, 241, 0.3)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    diveText: {
        color: '#a5b4fc',
        fontSize: 14,
        fontWeight: '700',
    },
});
