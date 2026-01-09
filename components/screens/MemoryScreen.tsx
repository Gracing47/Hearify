/**
 * Chronicle 2.0 - The Neural Archive
 * 
 * McKinsey meets Minority Report:
 * - Weekly Insight Header (AI-Generated Summary)
 * - Time-Stream (SectionList grouped by date)
 * - Shape Icons (Hexagon/Diamond/Circle for type identity)
 * - Time-Travel Navigation (Tap -> Focus in Horizon)
 * 
 * v2.1: Smart Discovery Panel Integration
 * - SQL-based multi-filter (GFF intersection, date range, hashtags)
 * - Hybrid scoring (0.7 semantic + 0.3 type match)
 * - Empty state suggestions
 * 
 * v2.2: Batch Synthesis (Phase 6)
 * - Multi-select mode with long-press activation
 * - Floating Action Bar for batch reflect
 */

import { BatchSelectFAB } from '@/components/BatchSelectFAB';
import { SmartFilterPanel } from '@/components/SmartFilterPanel';
import { updateSnippetImportance } from '@/db';
import { Snippet } from '@/db/schema';
import { useFilteredSnippets } from '@/hooks/useFilteredSnippets';
import { getAllConversations, type Conversation } from '@/services/ConversationService';
import { resumeSessionInStore } from '@/services/SessionRestorationService';
import {
    useChronicleActions,
    useChronicleStore,
    useChronicleUI,
    useSelectionMode
} from '@/store/chronicleStore';
import { useContextStore } from '@/store/contextStore';
import { useLensStore } from '@/store/lensStore';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Pressable,
    SectionList,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import Animated, {
    FadeIn,
    FadeInUp,
    useAnimatedStyle,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ═══════════════════════════════════════════════════════════════════
// TYPE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const TYPE_CONFIG = {
    fact: {
        color: '#08d0ff',
        bgColor: 'rgba(8, 208, 255, 0.12)',
        borderColor: 'rgba(8, 208, 255, 0.32)',
        icon: 'book-outline' as const,
        label: 'FACT',
    },
    feeling: {
        color: '#ff1f6d',
        bgColor: 'rgba(255, 31, 109, 0.14)',
        borderColor: 'rgba(255, 31, 109, 0.4)',
        icon: 'heart-outline' as const,
        label: 'FEELING',
    },
    goal: {
        color: '#ffd54f',
        bgColor: 'rgba(255, 213, 79, 0.12)',
        borderColor: 'rgba(255, 213, 79, 0.35)',
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
// CONVERSATION BENTO BLOCK — Unified Timeline
// ═══════════════════════════════════════════════════════════════════

interface ConversationBlockProps {
    conversation: Conversation;
    snippets: Snippet[];
    isExpanded: boolean;
    onToggle: () => void;
    onResume: () => void;
}

const ConversationBlock = React.memo(({ conversation, snippets, isExpanded, onToggle, onResume }: ConversationBlockProps) => {
    const gffBreakdown = conversation.gff_breakdown 
        ? JSON.parse(conversation.gff_breakdown) 
        : { goals: 0, facts: 0, feelings: 0 };
    
    const timeStr = new Date(conversation.start_timestamp).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const conversationSnippets = snippets.filter(s => s.conversation_id === conversation.id);
    const highlightSnippets = conversationSnippets.slice(0, 3); // Show top 3

    return (
        <Animated.View entering={FadeInUp} style={styles.conversationBlock}>
            <LinearGradient
                colors={['rgba(99, 102, 241, 0.08)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            
            {/* Header */}
            <TouchableOpacity style={styles.conversationHeader} onPress={onToggle} activeOpacity={0.7}>
                <View style={styles.conversationTitleRow}>
                    <Text style={styles.conversationTitle} numberOfLines={1}>
                        {conversation.title}
                    </Text>
                    <Ionicons 
                        name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                        size={18} 
                        color="rgba(255,255,255,0.5)" 
                    />
                </View>
                
                {/* GFF Metadata */}
                <View style={styles.conversationMeta}>
                    <Text style={styles.conversationTime}>{timeStr}</Text>
                    <View style={styles.gffBadges}>
                        {gffBreakdown.goals > 0 && (
                            <View style={styles.gffBadge}>
                                <ShapeIcon type="goal" size={10} />
                                <Text style={styles.gffBadgeText}>{gffBreakdown.goals}</Text>
                            </View>
                        )}
                        {gffBreakdown.feelings > 0 && (
                            <View style={styles.gffBadge}>
                                <ShapeIcon type="feeling" size={10} />
                                <Text style={styles.gffBadgeText}>{gffBreakdown.feelings}</Text>
                            </View>
                        )}
                        {gffBreakdown.facts > 0 && (
                            <View style={styles.gffBadge}>
                                <ShapeIcon type="fact" size={10} />
                                <Text style={styles.gffBadgeText}>{gffBreakdown.facts}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>

            {/* Expanded Content */}
            {isExpanded && (
                <Animated.View entering={FadeInUp.springify()} style={styles.conversationExpanded}>
                    {/* Summary */}
                    {conversation.summary && (
                        <Text style={styles.conversationSummary} numberOfLines={3}>
                            {conversation.summary}
                        </Text>
                    )}
                    
                    {/* Highlights */}
                    {highlightSnippets.length > 0 && (
                        <View style={styles.conversationHighlights}>
                            <Text style={styles.conversationHighlightsLabel}>KEY THOUGHTS</Text>
                            {highlightSnippets.map((snippet, i) => (
                                <View key={snippet.id} style={styles.conversationHighlight}>
                                    <ShapeIcon type={snippet.type} size={12} />
                                    <Text style={styles.conversationHighlightText} numberOfLines={2}>
                                        {snippet.content}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Resume Button */}
                    <TouchableOpacity 
                        style={styles.conversationResumeBtn} 
                        onPress={onResume}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="play-circle" size={18} color="#818cf8" />
                        <Text style={styles.conversationResumeBtnText}>Resume Session</Text>
                    </TouchableOpacity>
                </Animated.View>
            )}
        </Animated.View>
    );
});

// ═══════════════════════════════════════════════════════════════════
// TIMELINE ITEM (Memoized for performance)
// ═══════════════════════════════════════════════════════════════════

interface TimelineItemProps {
    snippet: Snippet;
    index: number;
    isFirst: boolean;
    isLast: boolean;
    onPress: () => void;
    onRefresh: () => void;
}

const ActionButton = ({
    label,
    icon,
    onPress,
    active,
    emphasis
}: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    active?: boolean;
    emphasis?: boolean;
}) => (
    <TouchableOpacity
        style={[styles.actionBtn, emphasis && styles.actionBtnActive]}
        onPress={onPress}
        hitSlop={8}
    >
        <Ionicons
            name={icon}
            size={16}
            color={active ? '#F59E0B' : emphasis ? '#7c83ff' : 'rgba(255, 255, 255, 0.6)'}
        />
        <Text
            style={[
                styles.actionBtnText,
                active && { color: '#F59E0B' },
                emphasis && { color: '#7c83ff' }
            ]}
        >
            {label}
        </Text>
    </TouchableOpacity>
);

// ═══════════════════════════════════════════════════════════════════
// TIMELINE ITEM WITH MULTI-SELECT SUPPORT (Phase 6)
// ═══════════════════════════════════════════════════════════════════

const TimelineItem = React.memo(({ snippet, index, isFirst, isLast, onPress, onRefresh }: TimelineItemProps) => {
    const config = TYPE_CONFIG[snippet.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.fact;
    const timeStr = new Date(snippet.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const router = useRouter();
    const { setMode } = useLensStore();
    
    // Multi-Select State (Phase 6)
    const isSelectionMode = useSelectionMode();
    const isSelected = useChronicleStore((s) => s.selectedSnippetIds.has(snippet.id));
    const toggleSelection = useChronicleStore((s) => s.toggleSnippetSelection);
    const canSelectMore = useChronicleStore((s) => s.canSelectMore);

    const handleStar = useCallback(async () => {
        try {
            const newImportance = snippet.importance > 0 ? 0 : 1;
            await updateSnippetImportance(snippet.id, newImportance);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onRefresh();
        } catch (e) {
            console.error('[Chronicle] Star failed:', e);
        }
    }, [snippet.id, snippet.importance, onRefresh]);

    const handlePlan = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        // Set Strategy lens for goal planning
        setMode('STRATEGY');
        
        // Focus on this specific snippet in Horizon
        useContextStore.getState().setFocusNode(snippet.id);
        
        // Navigate to Horizon
        useContextStore.getState().setActiveScreen('horizon');
        
        console.log(`[Chronicle] Plan: Focusing node ${snippet.id} in Horizon (Strategy mode)`);
    }, [setMode, snippet.id]);

    const handleReflect = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        // Pass snippet content to Orbit for reflection
        router.setParams({ 
            reflect: snippet.content,
            snippetId: snippet.id.toString()
        });
        
        // Navigate to Orbit
        useContextStore.getState().setActiveScreen('orbit');
        
        console.log(`[Chronicle] Reflect: Opening Orbit with snippet ${snippet.id}`);
    }, [snippet.content, snippet.id, router]);

    // Long-Press Handler for Multi-Select (Phase 6)
    const handleLongPress = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const success = toggleSelection(snippet.id);
        if (!success) {
            // Selection limit reached
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
    }, [snippet.id, toggleSelection]);

    // Tap Handler (respects selection mode)
    const handlePress = useCallback(() => {
        if (isSelectionMode) {
            // In selection mode: toggle selection
            const wasSelected = isSelected;
            const success = toggleSelection(snippet.id);
            
            if (success) {
                Haptics.impactAsync(wasSelected 
                    ? Haptics.ImpactFeedbackStyle.Light  // Deselect: softer
                    : Haptics.ImpactFeedbackStyle.Medium // Select: stronger
                );
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
        } else {
            // Normal mode: navigate
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress();
        }
    }, [isSelectionMode, isSelected, snippet.id, toggleSelection, onPress]);

    // Animated selection glow
    const selectionStyle = useAnimatedStyle(() => ({
        borderWidth: withTiming(isSelected ? 2 : 1, { duration: 150 }),
        borderColor: withTiming(
            isSelected ? config.color : config.borderColor, 
            { duration: 150 }
        ),
        shadowColor: config.color,
        shadowOpacity: withTiming(isSelected ? 0.4 : 0, { duration: 200 }),
        shadowRadius: withTiming(isSelected ? 8 : 0, { duration: 200 }),
    }));

    return (
        <Pressable
            style={styles.timelineItem}
            onPress={handlePress}
            onLongPress={handleLongPress}
            delayLongPress={400}
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
            <Animated.View style={[
                styles.timelineCard, 
                { backgroundColor: config.bgColor },
                selectionStyle
            ]}>
                {/* Selection Checkbox Overlay */}
                {isSelectionMode && (
                    <View style={styles.checkboxOverlay}>
                        <View style={[
                            styles.checkbox,
                            isSelected && { backgroundColor: config.color, borderColor: config.color }
                        ]}>
                            {isSelected && (
                                <Ionicons name="checkmark" size={14} color="#000" />
                            )}
                        </View>
                    </View>
                )}
                
                <View style={styles.timelineCardHeader}>
                    <Text style={[styles.timelineType, { color: config.color }]}>{config.label}</Text>
                    <Text style={styles.timelineTime}>{timeStr}</Text>
                </View>
                <Text style={styles.timelineContent} numberOfLines={4}>{snippet.content}</Text>

                {snippet.hashtags && (
                    <View style={styles.hashtagsRow}>
                        {snippet.hashtags.split(' ').map((tag, i) => (
                            <Text key={i} style={styles.hashtagText}>{tag}</Text>
                        ))}
                    </View>
                )}

                <View style={styles.timelineCardFooter}>
                    <View style={styles.actionRow}>
                        <ActionButton
                            label="Star"
                            icon={snippet.importance > 0 ? 'star' : 'star-outline'}
                            onPress={handleStar}
                            active={snippet.importance > 0}
                        />
                        <ActionButton label="Plan" icon="layers-outline" onPress={handlePlan} />
                        <ActionButton label="Reflect" icon="chatbubble-ellipses-outline" onPress={handleReflect} emphasis />
                    </View>

                    {/* View button hidden - double-tap card to view in Horizon */}
                </View>
            </Animated.View>
        </Pressable>
    );
}, (prevProps, nextProps) => {
    // Custom comparison - only re-render if these change
    // Note: Selection state handled by Zustand selectors, not props
    return prevProps.snippet.id === nextProps.snippet.id &&
        prevProps.snippet.importance === nextProps.snippet.importance &&
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
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [expandedConvId, setExpandedConvId] = useState<number | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    
    // Smart Filter Panel integration
    const { resultCount, isLoading: isFilterLoading } = useChronicleUI();
    const { resetFilters } = useChronicleActions();
    
    // SQL-based filtered snippets with hybrid scoring
    const { 
        snippets, 
        results: filteredResults,
        count, 
        topHashtags,
        emptySuggestions,
        totalCount,
        refresh: refreshSnippets,
        isLoading,
        queryTimeMs 
    } = useFilteredSnippets();

    const nodeRefreshTrigger = useContextStore(state => state.nodeRefreshTrigger);

    const loadConversations = useCallback(async () => {
        console.log('[Chronicle] Loading conversations...');
        const data = await getAllConversations(20);
        console.log('[Chronicle] Loaded', data.length, 'conversations');
        setConversations(data);
    }, []);

    useEffect(() => {
        console.log('[Chronicle] Refresh triggered, nodeRefreshTrigger:', nodeRefreshTrigger);
        refreshSnippets();
        loadConversations();
    }, [nodeRefreshTrigger, refreshSnippets, loadConversations]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([refreshSnippets(), loadConversations()]);
        setRefreshing(false);
    };

    // Use filtered results for display (includes soft matches with reduced opacity)
    const filteredSnippets = useMemo(() => {
        return filteredResults.map(r => r.snippet);
    }, [filteredResults]);

    // Group snippets by date + prepend Conversations section
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

        // Build sections array (without Conversations section, handled in ListHeader)
        const snippetSections = Object.entries(groups)
            .map(([title, data]) => ({ title, data }))
            .sort((a, b) => {
                if (a.title === 'Today') return -1;
                if (b.title === 'Today') return 1;
                if (a.title === 'Yesterday') return -1;
                if (b.title === 'Yesterday') return 1;
                return 0;
            });

        return snippetSections;
    }, [filteredSnippets]);

    const stats = {
        total: snippets.length,
        facts: snippets.filter(s => s.type === 'fact').length,
        feelings: snippets.filter(s => s.type === 'feeling').length,
        goals: snippets.filter(s => s.type === 'goal').length,
    };

    const handleNavigateToNode = useCallback((snippetId: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // Transition to Horizon disabled - keeping user in Chronicle
        console.log('[Chronicle] View action for node:', snippetId, '(transition disabled)');
        // useContextStore.getState().navigateToNode(snippetId);
    }, []);

    // 🔄 Resume Conversation Handler
    const handleResumeConversation = useCallback(async (conversationId: number) => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            
            console.log('[Chronicle] Resuming conversation:', conversationId);
            
            // Restore session in OrbitStore
            await resumeSessionInStore(conversationId);
            
            // Navigate to Orbit
            useContextStore.getState().setActiveScreen('orbit');
            
            console.log('[Chronicle] Session restored, navigated to Orbit');
        } catch (error) {
            console.error('[Chronicle] Resume failed:', error);
        }
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
            onRefresh={onRefresh}
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

                        {/* 🎨 Smart Filter Panel (Zone A/B/C) */}
                        <Animated.View entering={FadeInUp.delay(150)}>
                            <SmartFilterPanel 
                                topHashtags={topHashtags}
                                resultCount={count}
                            />
                        </Animated.View>
                    </>
                )}
                ListEmptyComponent={() => (
                    <Animated.View entering={FadeIn} style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>🧠</Text>
                        <Text style={styles.emptyTitle}>
                            {totalCount === 0 ? 'No memories yet' : 'Keine Treffer'}
                        </Text>
                        <Text style={styles.emptySubtitle}>
                            {totalCount === 0 
                                ? 'Start a conversation to capture thoughts' 
                                : 'Versuche einen anderen Filter'}
                        </Text>
                        
                        {/* Empty State Suggestions */}
                        {emptySuggestions.length > 0 && (
                            <View style={styles.emptySuggestions}>
                                {emptySuggestions.map((suggestion, index) => (
                                    <Pressable 
                                        key={index}
                                        style={styles.suggestionButton}
                                        onPress={() => {
                                            Haptics.selectionAsync();
                                            useChronicleStore.getState().applyFilterSuggestion(suggestion);
                                        }}
                                    >
                                        <Ionicons 
                                            name={suggestion.type === 'extend_date' ? 'calendar-outline' : 'options-outline'} 
                                            size={14} 
                                            color="#08d0ff" 
                                        />
                                        <Text style={styles.suggestionText}>{suggestion.label}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    </Animated.View>
                )}
            />
            
            {/* Batch Select FAB (Phase 6) */}
            <BatchSelectFAB />
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
        fontSize: 30,
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
    // Search Bar
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#fff',
        fontWeight: '500',
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
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    filterPillActive: {
        backgroundColor: 'rgba(99, 102, 241, 0.12)',
        borderColor: 'rgba(99, 102, 241, 0.3)',
    },
    filterPillText: {
        fontSize: 14,
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
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
    },
    sectionCount: {
        fontSize: 13,
        color: '#7a7a7a',
        fontWeight: '600',
    },

    // Timeline
    timelineItem: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    timelineLine: {
        width: 48,
        alignItems: 'center',
    },
    timelineLineSegment: {
        width: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        flex: 1,
    },
    timelineLineTop: {
        marginBottom: 4,
    },
    timelineLineBottom: {
        marginTop: 4,
    },
    timelineNode: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0a0a0f',
    },
    timelineCard: {
        flex: 1,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
    },
    timelineCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    timelineType: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1,
    },
    timelineTime: {
        fontSize: 12,
        color: '#8a8a8a',
        fontWeight: '600',
    },
    timelineContent: {
        fontSize: 16,
        color: '#f0f0f5',
        lineHeight: 24,
    },
    timelineCardFooter: {
        marginTop: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 6,
        flex: 1,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    actionBtnActive: {
        backgroundColor: 'rgba(99, 102, 241, 0.12)',
        borderColor: 'rgba(99, 102, 241, 0.22)',
    },
    actionBtnText: {
        fontSize: 9,
        color: 'rgba(255, 255, 255, 0.72)',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    viewInHorizonBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: 'rgba(99, 102, 241, 0.16)',
        marginLeft: 8,
    },
    viewInHorizonText: {
        fontSize: 11,
        color: '#7c83ff',
        fontWeight: '700',
    },
    hashtagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
    },
    hashtagText: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.55)',
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

    // Conversations
    conversationsContainer: {
        marginBottom: 24,
    },
    conversationBlock: {
        marginHorizontal: 20,
        marginBottom: 12,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.2)',
        backgroundColor: 'rgba(10, 10, 15, 0.6)',
    },
    conversationHeader: {
        padding: 16,
    },
    conversationTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    conversationTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        flex: 1,
        marginRight: 12,
    },
    conversationMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    conversationTime: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.4)',
    },
    gffBadges: {
        flexDirection: 'row',
        gap: 8,
    },
    gffBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    gffBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.7)',
    },
    conversationExpanded: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.06)',
    },
    conversationSummary: {
        fontSize: 13,
        lineHeight: 20,
        color: 'rgba(255, 255, 255, 0.65)',
        marginTop: 12,
        marginBottom: 16,
    },
    conversationHighlights: {
        marginBottom: 16,
    },
    conversationHighlightsLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: 'rgba(255, 255, 255, 0.4)',
        letterSpacing: 1,
        marginBottom: 8,
    },
    conversationHighlight: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        paddingVertical: 6,
    },
    conversationHighlightText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
        color: 'rgba(255, 255, 255, 0.6)',
    },
    conversationResumeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.3)',
    },
    conversationResumeBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#818cf8',
    },
    
    // Empty State Suggestions
    emptySuggestions: {
        marginTop: 20,
        gap: 10,
        alignItems: 'center',
    },
    suggestionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(8, 208, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(8, 208, 255, 0.2)',
    },
    suggestionText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#08d0ff',
    },
    
    // Multi-Select Checkbox (Phase 6)
    checkboxOverlay: {
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 10,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
