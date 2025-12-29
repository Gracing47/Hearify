/**
 * 📊 STATISTICS HUD — Neural Horizon v2.0
 * 
 * Auto-hiding overlay with key metrics.
 * Designed to avoid gamification — uses "Rhythm" not "Streak".
 * 
 * Contract (HUD_CONTRACT):
 * - Auto-hide after 3s of inactivity
 * - Recall via tap (temporary), long-press (sticky), two-finger tap (toggle)
 * - Counter animations without sounds
 */

import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    Extrapolate,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { HUD_CONTRACT } from '../constants/contracts';
import { getDb } from '../db';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface StatItem {
    id: string;
    label: string;
    icon: string;
    value: string | number;
}

interface StatisticsHUDProps {
    visible?: boolean;
    onVisibilityChange?: (visible: boolean) => void;
}

// Animated counter component
const AnimatedCounter = ({ value, duration = 600 }: { value: number; duration?: number }) => {
    const animatedValue = useSharedValue(0);
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        animatedValue.value = withTiming(value, {
            duration,
            easing: Easing.out(Easing.cubic),
        });
    }, [value]);

    useEffect(() => {
        const interval = setInterval(() => {
            const currentProgress = animatedValue.value;
            setDisplayValue(Math.round(currentProgress));
        }, 16);
        return () => clearInterval(interval);
    }, []);

    return <Text style={styles.statValue}>{displayValue}</Text>;
};

// Individual stat card
const StatCard = ({ item, index }: { item: StatItem; index: number }) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: interpolate(scale.value, [0.95, 1], [0.8, 1], Extrapolate.CLAMP),
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.95, { damping: 15 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15 });
    };

    return (
        <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
            <Animated.View style={[styles.statCard, animatedStyle]}>
                <Text style={styles.statIcon}>{item.icon}</Text>
                {typeof item.value === 'number' ? (
                    <AnimatedCounter value={item.value} />
                ) : (
                    <Text style={styles.statValue}>{item.value}</Text>
                )}
                <Text style={styles.statLabel}>{item.label}</Text>
            </Animated.View>
        </Pressable>
    );
};

export const StatisticsHUD = ({ visible: externalVisible, onVisibilityChange }: StatisticsHUDProps) => {
    const [internalVisible, setInternalVisible] = useState(false);
    const [isSticky, setIsSticky] = useState(false);
    const [stats, setStats] = useState<StatItem[]>([]);

    const opacity = useSharedValue(0);
    const translateY = useSharedValue(-20);
    const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const isVisible = externalVisible ?? internalVisible;

    // Load stats from database
    const loadStats = useCallback(async () => {
        try {
            const db = await getDb();
            const now = Date.now();
            const startOfToday = new Date().setHours(0, 0, 0, 0);

            // Today's snippets
            const todayResult = await db.execute(
                'SELECT COUNT(*) as count FROM snippets WHERE timestamp >= ?',
                [startOfToday]
            );
            const todayCount = (todayResult.rows as any)?.[0]?.count || 0;

            // Total snippets and edges
            const totalResult = await db.execute('SELECT COUNT(*) as count FROM snippets');
            const totalSnippets = (totalResult.rows as any)?.[0]?.count || 0;

            const edgesResult = await db.execute('SELECT COUNT(*) as count FROM edges');
            const totalEdges = (edgesResult.rows as any)?.[0]?.count || 0;

            // Connection rate (edges / max possible edges)
            const maxPossibleEdges = (totalSnippets * (totalSnippets - 1)) / 2;
            const connectionRate = maxPossibleEdges > 0
                ? Math.round((totalEdges / maxPossibleEdges) * 100)
                : 0;

            // Cluster count
            const clustersResult = await db.execute('SELECT COUNT(DISTINCT cluster_id) as count FROM snippets WHERE cluster_id IS NOT NULL');
            const clusterCount = (clustersResult.rows as any)?.[0]?.count || 0;

            // Continuity (simplified: count of unique days with activity in last 30 days)
            const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
            const continuityResult = await db.execute(
                `SELECT COUNT(DISTINCT date(timestamp/1000, 'unixepoch')) as days FROM snippets WHERE timestamp >= ?`,
                [thirtyDaysAgo]
            );
            const continuityDays = (continuityResult.rows as any)?.[0]?.days || 0;

            setStats([
                { id: 'today', label: HUD_CONTRACT.stats[0].label, icon: HUD_CONTRACT.stats[0].icon, value: todayCount },
                { id: 'connected', label: HUD_CONTRACT.stats[1].label, icon: HUD_CONTRACT.stats[1].icon, value: `${connectionRate}%` },
                { id: 'clusters', label: HUD_CONTRACT.stats[2].label, icon: HUD_CONTRACT.stats[2].icon, value: clusterCount },
                { id: 'continuity', label: HUD_CONTRACT.stats[3].label, icon: HUD_CONTRACT.stats[3].icon, value: `${continuityDays}d` },
            ]);
        } catch (error) {
            console.error('Failed to load HUD stats:', error);
        }
    }, []);

    // Show HUD
    const show = useCallback((sticky = false) => {
        setInternalVisible(true);
        setIsSticky(sticky);
        onVisibilityChange?.(true);
        loadStats();

        opacity.value = withSpring(1, { damping: 20 });
        translateY.value = withSpring(0, { damping: 20 });

        // Clear existing timer
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
        }

        // Auto-hide after delay (unless sticky)
        if (!sticky) {
            hideTimerRef.current = setTimeout(() => {
                hide();
            }, HUD_CONTRACT.visibility.hideDelay);
        }
    }, [loadStats, onVisibilityChange]);

    // Hide HUD
    const hide = useCallback(() => {
        opacity.value = withTiming(0, { duration: 200 });
        translateY.value = withTiming(-20, { duration: 200 });

        setTimeout(() => {
            setInternalVisible(false);
            setIsSticky(false);
            onVisibilityChange?.(false);
        }, 200);
    }, [onVisibilityChange]);

    // Toggle HUD
    const toggle = useCallback(() => {
        if (isVisible) {
            hide();
        } else {
            show(true);
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [isVisible, show, hide]);

    // Recall gestures (exposed for parent component)
    const handleTap = useCallback(() => {
        if (!isVisible) {
            show(false); // Temporary show
        }
    }, [isVisible, show]);

    const handleLongPress = useCallback(() => {
        show(true); // Sticky show
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, [show]);

    const handleTwoFingerTap = useCallback(() => {
        toggle();
    }, [toggle]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
            }
        };
    }, []);

    // Animated styles
    const containerStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
    }));

    if (!isVisible && opacity.value === 0) return null;

    return (
        <Animated.View style={[styles.container, containerStyle]} pointerEvents="box-none">
            <BlurView intensity={40} tint="dark" style={styles.blurContainer}>
                <View style={styles.statsRow}>
                    {stats.map((item, index) => (
                        <StatCard key={item.id} item={item} index={index} />
                    ))}
                </View>

                {isSticky && (
                    <Pressable style={styles.closeButton} onPress={hide}>
                        <Text style={styles.closeIcon}>×</Text>
                    </Pressable>
                )}
            </BlurView>
        </Animated.View>
    );
};

// Expose gesture handlers for parent integration
StatisticsHUD.displayName = 'StatisticsHUD';

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60,
        left: 16,
        right: 16,
        zIndex: 100,
    },
    blurContainer: {
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 16,
        paddingHorizontal: 8,
    },
    statCard: {
        alignItems: 'center',
        minWidth: 70,
    },
    statIcon: {
        fontSize: 20,
        marginBottom: 4,
    },
    statValue: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    statLabel: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 11,
        fontWeight: '500',
        marginTop: 2,
    },
    closeButton: {
        position: 'absolute',
        top: 4,
        right: 8,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeIcon: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 20,
        fontWeight: '300',
    },
});
