/**
 * Horizon Screen - Neural Horizon 2.0 (formerly CanvasScreen)
 */

import { NeuralCanvas } from '@/components/NeuralCanvas';
import { getAllSnippets } from '@/db';
import { useContextStore } from '@/store/contextStore';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import Animated, {
    FadeIn,
    SharedValue,
    SlideInDown,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface NodeStats {
    total: number;
    facts: number;
    feelings: number;
    goals: number;
}

interface HorizonScreenProps {
    layoutY?: SharedValue<number>;
}

export function HorizonScreen({ layoutY }: HorizonScreenProps) {
    const insets = useSafeAreaInsets();
    const router = useRouter(); // Keeping router for now
    const [stats, setStats] = useState<NodeStats>({ total: 0, facts: 0, feelings: 0, goals: 0 });
    const [showHUD, setShowHUD] = useState(true);
    const [filterType, setFilterType] = useState<'all' | 'fact' | 'feeling' | 'goal'>('all');

    // Animated pulse for the "LIVE" indicator
    const pulseOpacity = useSharedValue(1);

    useEffect(() => {
        pulseOpacity.value = withRepeat(
            withSequence(
                withTiming(0.3, { duration: 1000 }),
                withTiming(1, { duration: 1000 })
            ),
            -1,
            true
        );
    }, []);

    // 🚀 HOLOGRAPHIC SYNC: Subscribe to node refresh trigger
    const nodeRefreshTrigger = useContextStore(state => state.nodeRefreshTrigger);

    // Load stats - reactive to nodeRefreshTrigger
    useEffect(() => {
        const loadStats = async () => {
            const snippets = await getAllSnippets();
            setStats({
                total: snippets.length,
                facts: snippets.filter(s => s.type === 'fact').length,
                feelings: snippets.filter(s => s.type === 'feeling').length,
                goals: snippets.filter(s => s.type === 'goal').length,
            });
        };
        loadStats();
    }, [nodeRefreshTrigger]); // 🔥 Re-run when nodes change


    const pulseStyle = useAnimatedStyle(() => ({
        opacity: pulseOpacity.value,
    }));

    return (
        <View style={styles.container}>
            {/* Deep Space Gradient */}
            <LinearGradient
                colors={['#06060a', '#0d0d1a', '#0a0a12', '#000000']}
                locations={[0, 0.3, 0.7, 1]}
                style={StyleSheet.absoluteFill}
            />

            {/* The Neural Canvas (Full Screen) */}
            <NeuralCanvas filterType={filterType} layoutY={layoutY} />

            <StatusBar hidden />

            {/* Glassmorphic HUD Overlay */}
            {showHUD && (
                <>
                    {/* Top Bar - Title + Status */}
                    <Animated.View
                        entering={FadeIn.duration(600)}
                        style={[styles.topBar, { paddingTop: insets.top + 8 }]}
                    >
                        <View style={styles.titleSection}>
                            <Text style={styles.title}>Horizon</Text>
                            <Animated.View style={[styles.liveIndicator, pulseStyle]}>
                                <View style={styles.liveDot} />
                                <Text style={styles.liveText}>LIVE</Text>
                            </Animated.View>
                        </View>

                        {/* 
                         * Back button removed/hidden in MindFlow 
                         * since gesture navigation replaces it.
                         * But keeping layout for structure. 
                         */}
                    </Animated.View>

                    {/* Bottom Stats Panel */}
                    <Animated.View
                        entering={SlideInDown.delay(300).springify()}
                        style={[styles.statsPanel, { paddingBottom: insets.bottom + 16 }]}
                    >
                        {Platform.OS === 'ios' ? (
                            <BlurView intensity={60} tint="dark" style={styles.statsPanelBlur}>
                                <StatsContent
                                    stats={stats}
                                    currentFilter={filterType}
                                    onFilterChange={setFilterType}
                                />
                            </BlurView>
                        ) : (
                            <View style={styles.statsPanelAndroid}>
                                <StatsContent
                                    stats={stats}
                                    currentFilter={filterType}
                                    onFilterChange={setFilterType}
                                />
                            </View>
                        )}
                    </Animated.View>
                </>
            )}

            {/* Toggle HUD Button */}
            <Pressable
                style={[styles.toggleHUD, { top: insets.top + 60 }]}
                onPress={() => setShowHUD(!showHUD)}
            >
                <Text style={styles.toggleIcon}>{showHUD ? '◉' : '○'}</Text>
            </Pressable>
        </View>
    );
}

function StatsContent({
    stats,
    currentFilter,
    onFilterChange
}: {
    stats: NodeStats;
    currentFilter: string;
    onFilterChange: (type: any) => void;
}) {
    return (
        <View style={styles.statsRow}>
            <View style={styles.primaryStat}>
                <StatItem
                    label="NEURAL NODES"
                    value={stats.total}
                    color="#fff"
                    large
                    isActive={currentFilter === 'all'}
                    onPress={() => onFilterChange('all')}
                />
            </View>

            <View style={styles.statsDivider} />

            <View style={styles.secondaryStats}>
                <StatItem
                    label="FACTS"
                    value={stats.facts}
                    color="#22d3ee"
                    isActive={currentFilter === 'fact'}
                    onPress={() => onFilterChange(currentFilter === 'fact' ? 'all' : 'fact')}
                />
                <StatItem
                    label="FEELINGS"
                    value={stats.feelings}
                    color="#e879f9"
                    isActive={currentFilter === 'feeling'}
                    onPress={() => onFilterChange(currentFilter === 'feeling' ? 'all' : 'feeling')}
                />
                <StatItem
                    label="GOALS"
                    value={stats.goals}
                    color="#fde047"
                    isActive={currentFilter === 'goal'}
                    onPress={() => onFilterChange(currentFilter === 'goal' ? 'all' : 'goal')}
                />
            </View>
        </View>
    );
}

function StatItem({
    label,
    value,
    color,
    large,
    isActive,
    onPress
}: {
    label: string;
    value: number;
    color: string;
    large?: boolean;
    isActive: boolean;
    onPress: () => void;
}) {
    const scale = useSharedValue(1);

    useEffect(() => {
        scale.value = withSequence(
            withSpring(1.2, { damping: 8 }),
            withSpring(1)
        );
    }, [value]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: isActive ? 1 : 0.4
    }));

    return (
        <Pressable
            style={[styles.statItem, large && styles.statItemLarge]}
            onPress={onPress}
        >
            <Animated.Text style={[
                styles.statValue,
                { color },
                large && styles.statValueLarge,
                animatedStyle
            ]}>
                {value}
            </Animated.Text>
            <Text style={[styles.statLabel, large && styles.statLabelLarge, { opacity: isActive ? 1 : 0.5 }]}>
                {label}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    // Top Bar
    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 24,
        zIndex: 100,
    },
    titleSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: -0.8,
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.3)',
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#6366f1',
        marginRight: 6,
    },
    liveText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#6366f1',
        letterSpacing: 1,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    backIcon: {
        fontSize: 20,
        color: '#fff',
    },
    // Bottom Stats Panel
    statsPanel: {
        position: 'absolute',
        bottom: 24,
        left: 20,
        right: 20,
        zIndex: 100,
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
    },
    statsPanelBlur: {
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    statsPanelAndroid: {
        backgroundColor: 'rgba(22, 22, 28, 0.95)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
    primaryStat: {
        width: 100, // Fixed width to prevent pushing others
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryStats: {
        flex: 2,
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statsDivider: {
        width: 1,
        height: 60,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        marginHorizontal: 4,
    },
    statItem: {
        alignItems: 'center',
    },
    statItemLarge: {
        marginBottom: 8,
    },
    statValue: {
        fontSize: 22,
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    statValueLarge: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fff',
    },
    statLabel: {
        fontSize: 8,
        fontWeight: '700',
        color: '#666',
        letterSpacing: 1.5,
        marginTop: 6,
        textTransform: 'uppercase',
        textAlign: 'center',
    },
    statLabelLarge: {
        fontSize: 10,
        color: '#999',
        letterSpacing: 2,
    },
    // Gesture Hints
    gestureHints: {
        position: 'absolute',
        bottom: 130,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 100,
    },
    hintText: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.3)',
        fontWeight: '500',
        letterSpacing: 0.5,
    },
    // Toggle HUD
    toggleHUD: {
        position: 'absolute',
        right: 24,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 101,
    },
    toggleIcon: {
        fontSize: 14,
        color: '#fff',
    },
});
