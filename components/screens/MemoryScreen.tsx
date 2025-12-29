/**
 * Chronicle 2.0 - The Neural Archive
 * 
 * McKinsey meets Minority Report:
 * - Weekly Insight Header (AI-Generated Summary)
 * - Time-Stream (SectionList grouped by date)
 * - Shape Icons (Hexagon/Diamond/Circle for type identity)
 * - Time-Travel Navigation (Tap -> Focus in Horizon)
 */

import { getAllSnippets } from '@/db';
import { Snippet } from '@/db/schema';
import { useContextStore } from '@/store/contextStore';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Pressable,
    SectionList,
    StyleSheet,
    Text,
    View
} from 'react-native';
import Animated, {
    FadeIn,
    FadeInUp
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ═══════════════════════════════════════════════════════════════════
// TYPE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const TYPE_CONFIG = {
    fact: {
        color: '#00F0FF',
        bgColor: 'rgba(0, 240, 255, 0.08)',
        borderColor: 'rgba(0, 240, 255, 0.25)',
        icon: 'book-outline' as const,
        label: 'FACT',
    },
    feeling: {
        color: '#FF0055',
        bgColor: 'rgba(255, 0, 85, 0.08)',
        borderColor: 'rgba(255, 0, 85, 0.25)',
        icon: 'heart-outline' as const,
        label: 'FEELING',
    },
    goal: {
        color: '#FFD700',
        bgColor: 'rgba(255, 215, 0, 0.08)',
        borderColor: 'rgba(255, 215, 0, 0.25)',
        icon: 'flag-outline' as const,
        label: 'GOAL',
    },
};

// ═══════════════════════════════════════════════════════════════════
// SHAPE COMPONENTS (View-based, no native modules needed)
// ═══════════════════════════════════════════════════════════════════

const ShapeIcon = ({ type, size = 20 }: { type: string; size?: number }) => {
    const config = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.fact;

    if (type === 'fact') {
        // Hexagon approximation - rotated square with rounded corners
        return (
            <View style={{
                width: size,
                height: size,
                backgroundColor: config.color,
                transform: [{ rotate: '45deg' }],
                borderRadius: 3,
                opacity: 0.9,
            }} />
        );
    }

    if (type === 'goal') {
        // Diamond - rotated square
        return (
            <View style={{
                width: size * 0.8,
                height: size * 0.8,
                backgroundColor: config.color,
                transform: [{ rotate: '45deg' }],
                opacity: 0.9,
            }} />
        );
    }

    // Feeling - Circle
    return (
        <View style={{
            width: size,
            height: size,
            backgroundColor: config.color,
            borderRadius: size / 2,
            opacity: 0.9,
        }} />
    );
};

// ═══════════════════════════════════════════════════════════════════
// SPARKLINE COMPONENT (View-based bars instead of SVG)
// ═══════════════════════════════════════════════════════════════════

const Sparkline = ({ data, width = 120, height = 40, color = '#6366f1' }: {
    data: number[];
    width?: number;
    height?: number;
    color?: string;
}) => {
    if (data.length < 2) return null;

    const max = Math.max(...data, 1);
    const barWidth = (width / data.length) - 2;

    return (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, width, gap: 2, opacity: 0.6 }}>
            {data.map((value, i) => (
                <View
                    key={i}
                    style={{
                        width: barWidth,
                        height: Math.max(4, (value / max) * height),
                        backgroundColor: color,
                        borderRadius: 2,
                    }}
                />
            ))}
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════
// INSIGHT HEADER ("The Analyst")
// ═══════════════════════════════════════════════════════════════════

interface InsightHeaderProps {
    snippets: Snippet[];
    stats: { total: number; facts: number; feelings: number; goals: number };
}

const InsightHeader = ({ snippets, stats }: InsightHeaderProps) => {
    // Calculate weekly activity data for sparkline
    const weeklyData = useMemo(() => {
        const now = new Date();
        const days = Array(7).fill(0);

        snippets.forEach(s => {
            const date = new Date(s.timestamp);
            const daysAgo = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
            if (daysAgo >= 0 && daysAgo < 7) {
                days[6 - daysAgo]++;
            }
        });

        return days;
    }, [snippets]);

    // Determine dominant type
    const dominantType = useMemo(() => {
        if (stats.goals >= stats.facts && stats.goals >= stats.feelings) return 'goal';
        if (stats.facts >= stats.feelings) return 'fact';
        return 'feeling';
    }, [stats]);

    const dominantConfig = TYPE_CONFIG[dominantType];

    // Generate insight text
    const insightText = useMemo(() => {
        const totalThisWeek = weeklyData.reduce((a, b) => a + b, 0);
        const typePercentage = Math.round((stats[`${dominantType}s` as keyof typeof stats] / (stats.total || 1)) * 100);

        if (stats.total === 0) {
            return "Start capturing your thoughts to see insights here.";
        }

        const typeLabels = { goal: 'Goals', fact: 'Facts', feeling: 'Feelings' };
        return `This week: ${totalThisWeek} new thoughts. Focus area: ${typeLabels[dominantType]} (${typePercentage}%). Your neural archive is growing.`;
    }, [weeklyData, dominantType, stats]);

    return (
        <Animated.View entering={FadeInUp.delay(100)} style={styles.insightContainer}>
            <LinearGradient
                colors={[`${dominantConfig.color}15`, 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            {/* Sparkline Background */}
            <View style={styles.sparklineContainer}>
                <Sparkline data={weeklyData} color={dominantConfig.color} width={140} height={50} />
            </View>

            {/* Content */}
            <View style={styles.insightContent}>
                <View style={styles.insightHeader}>
                    <Ionicons name="analytics-outline" size={18} color="#888" />
                    <Text style={styles.insightLabel}>Weekly Insight</Text>
                </View>
                <Text style={styles.insightText}>{insightText}</Text>

                {/* Stats Row */}
                <View style={styles.insightStatsRow}>
                    <View style={styles.insightStat}>
                        <ShapeIcon type="fact" size={14} />
                        <Text style={[styles.insightStatValue, { color: TYPE_CONFIG.fact.color }]}>{stats.facts}</Text>
                    </View>
                    <View style={styles.insightStat}>
                        <ShapeIcon type="feeling" size={14} />
                        <Text style={[styles.insightStatValue, { color: TYPE_CONFIG.feeling.color }]}>{stats.feelings}</Text>
                    </View>
                    <View style={styles.insightStat}>
                        <ShapeIcon type="goal" size={14} />
                        <Text style={[styles.insightStatValue, { color: TYPE_CONFIG.goal.color }]}>{stats.goals}</Text>
                    </View>
                </View>
            </View>
        </Animated.View>
    );
};

// ═══════════════════════════════════════════════════════════════════
// TIMELINE ITEM (Memoized for performance)
// ═══════════════════════════════════════════════════════════════════

interface TimelineItemProps {
    snippet: Snippet;
    index: number;
    isFirst: boolean;
    isLast: boolean;
    onPress: () => void;
}

const TimelineItem = React.memo(({ snippet, index, isFirst, isLast, onPress }: TimelineItemProps) => {
    const config = TYPE_CONFIG[snippet.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.fact;
    const timeStr = new Date(snippet.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <Pressable
            style={styles.timelineItem}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress();
            }}
        >
            {/* Timeline Line */}
            <View style={styles.timelineLine}>
                {!isFirst && <View style={[styles.timelineLineSegment, styles.timelineLineTop]} />}
                <View style={[styles.timelineNode, { borderColor: config.color }]}>
                    <ShapeIcon type={snippet.type} size={16} />
                </View>
                {!isLast && <View style={[styles.timelineLineSegment, styles.timelineLineBottom]} />}
            </View>

            {/* Content Card */}
            <View style={[styles.timelineCard, { borderColor: config.borderColor, backgroundColor: config.bgColor }]}>
                <View style={styles.timelineCardHeader}>
                    <Text style={[styles.timelineType, { color: config.color }]}>{config.label}</Text>
                    <Text style={styles.timelineTime}>{timeStr}</Text>
                </View>
                <Text style={styles.timelineContent} numberOfLines={3}>{snippet.content}</Text>
                <View style={styles.timelineCardFooter}>
                    <Pressable style={styles.viewInHorizonBtn} onPress={onPress}>
                        <Ionicons name="compass-outline" size={14} color="#6366f1" />
                        <Text style={styles.viewInHorizonText}>View in Horizon</Text>
                    </Pressable>
                </View>
            </View>
        </Pressable>
    );
}, (prevProps, nextProps) => {
    // Custom comparison - only re-render if these change
    return prevProps.snippet.id === nextProps.snippet.id &&
        prevProps.isFirst === nextProps.isFirst &&
        prevProps.isLast === nextProps.isLast;
});

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

interface Section {
    title: string;
    data: Snippet[];
}

export function MemoryScreen() {
    const insets = useSafeAreaInsets();
    const [snippets, setSnippets] = useState<Snippet[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<'all' | 'fact' | 'feeling' | 'goal'>('all');

    const nodeRefreshTrigger = useContextStore(state => state.nodeRefreshTrigger);

    const loadSnippets = useCallback(async () => {
        const data = await getAllSnippets();
        setSnippets(data);
    }, []);

    useEffect(() => {
        loadSnippets();
    }, [nodeRefreshTrigger]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadSnippets();
        setRefreshing(false);
    };

    const filteredSnippets = filter === 'all'
        ? snippets
        : snippets.filter(s => s.type === filter);

    // Group snippets by date
    const sections: Section[] = useMemo(() => {
        const groups: { [key: string]: Snippet[] } = {};
        const now = new Date();
        const today = now.toDateString();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString();

        filteredSnippets.forEach(s => {
            const date = new Date(s.timestamp);
            const dateStr = date.toDateString();

            let label: string;
            if (dateStr === today) {
                label = 'Today';
            } else if (dateStr === yesterday) {
                label = 'Yesterday';
            } else {
                const daysAgo = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
                if (daysAgo < 7) {
                    label = date.toLocaleDateString('en-US', { weekday: 'long' });
                } else {
                    label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }
            }

            if (!groups[label]) groups[label] = [];
            groups[label].push(s);
        });

        // Sort sections by most recent first
        return Object.entries(groups)
            .map(([title, data]) => ({ title, data }))
            .sort((a, b) => {
                if (a.title === 'Today') return -1;
                if (b.title === 'Today') return 1;
                if (a.title === 'Yesterday') return -1;
                if (b.title === 'Yesterday') return 1;
                return 0;
            });
    }, [filteredSnippets]);

    const stats = {
        total: snippets.length,
        facts: snippets.filter(s => s.type === 'fact').length,
        feelings: snippets.filter(s => s.type === 'feeling').length,
        goals: snippets.filter(s => s.type === 'goal').length,
    };

    const handleNavigateToNode = useCallback((snippetId: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        useContextStore.getState().navigateToNode(snippetId);
    }, []);

    const renderSectionHeader = ({ section }: { section: Section }) => (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>{section.data.length} thoughts</Text>
        </View>
    );

    const renderItem = ({ item, index, section }: { item: Snippet; index: number; section: Section }) => (
        <TimelineItem
            snippet={item}
            index={index}
            isFirst={index === 0}
            isLast={index === section.data.length - 1}
            onPress={() => handleNavigateToNode(item.id)}
        />
    );

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#0a0a0f', '#0d0d14', '#000']}
                style={StyleSheet.absoluteFill}
            />

            <SectionList
                sections={sections}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                renderSectionHeader={renderSectionHeader}
                stickySectionHeadersEnabled={false}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }
                ]}
                showsVerticalScrollIndicator={false}
                refreshing={refreshing}
                onRefresh={onRefresh}
                ListHeaderComponent={() => (
                    <>
                        {/* Header */}
                        <Animated.View entering={FadeIn} style={styles.header}>
                            <View>
                                <Text style={styles.title}>Chronicle</Text>
                                <Text style={styles.subtitle}>The Neural Archive</Text>
                            </View>
                            <Pressable onPress={onRefresh} style={styles.refreshBtn} hitSlop={12}>
                                <Ionicons name="refresh-outline" size={20} color="rgba(255,255,255,0.4)" />
                            </Pressable>
                        </Animated.View>

                        {/* Insight Header */}
                        <InsightHeader snippets={snippets} stats={stats} />

                        {/* Filter Pills */}
                        <Animated.View entering={FadeInUp.delay(200)} style={styles.filterRow}>
                            {(['all', 'goal', 'feeling', 'fact'] as const).map((f) => {
                                const config = f !== 'all' ? TYPE_CONFIG[f] : null;
                                return (
                                    <Pressable
                                        key={f}
                                        style={[
                                            styles.filterPill,
                                            filter === f && styles.filterPillActive,
                                            filter === f && config && { borderColor: config.color }
                                        ]}
                                        onPress={() => {
                                            Haptics.selectionAsync();
                                            setFilter(f);
                                        }}
                                    >
                                        {config && <ShapeIcon type={f} size={12} />}
                                        <Text style={[
                                            styles.filterPillText,
                                            filter === f && styles.filterPillTextActive,
                                            filter === f && config && { color: config.color }
                                        ]}>
                                            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </Animated.View>
                    </>
                )}
                ListEmptyComponent={() => (
                    <Animated.View entering={FadeIn} style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>🧠</Text>
                        <Text style={styles.emptyTitle}>No memories yet</Text>
                        <Text style={styles.emptySubtitle}>Start a conversation to capture thoughts</Text>
                    </Animated.View>
                )}
            />
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    scrollContent: {
        paddingHorizontal: 20,
    },

    // Header
    header: {
        marginBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
        fontWeight: '500',
    },
    refreshBtn: {
        padding: 8,
    },

    // Insight Header
    insightContainer: {
        backgroundColor: 'rgba(20, 20, 28, 0.8)',
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
    },
    sparklineContainer: {
        position: 'absolute',
        right: 16,
        top: 16,
        opacity: 0.5,
    },
    insightContent: {
        zIndex: 1,
    },
    insightHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    insightLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    insightText: {
        fontSize: 15,
        color: '#e5e5e5',
        lineHeight: 22,
        marginBottom: 16,
    },
    insightStatsRow: {
        flexDirection: 'row',
        gap: 20,
    },
    insightStat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    insightStatValue: {
        fontSize: 16,
        fontWeight: '700',
    },

    // Filter Pills
    filterRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 24,
    },
    filterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    filterPillActive: {
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        borderColor: 'rgba(99, 102, 241, 0.4)',
    },
    filterPillText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#888',
    },
    filterPillTextActive: {
        color: '#6366f1',
    },

    // Section Header
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    sectionCount: {
        fontSize: 12,
        color: '#666',
        fontWeight: '500',
    },

    // Timeline
    timelineItem: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    timelineLine: {
        width: 40,
        alignItems: 'center',
    },
    timelineLineSegment: {
        width: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        flex: 1,
    },
    timelineLineTop: {
        marginBottom: 4,
    },
    timelineLineBottom: {
        marginTop: 4,
    },
    timelineNode: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0a0a0f',
    },
    timelineCard: {
        flex: 1,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        marginBottom: 12,
    },
    timelineCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    timelineType: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
    timelineTime: {
        fontSize: 11,
        color: '#666',
        fontWeight: '500',
    },
    timelineContent: {
        fontSize: 14,
        color: '#e5e5e5',
        lineHeight: 20,
    },
    timelineCardFooter: {
        marginTop: 12,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    viewInHorizonBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
    },
    viewInHorizonText: {
        fontSize: 11,
        color: '#6366f1',
        fontWeight: '600',
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#666',
    },
});
