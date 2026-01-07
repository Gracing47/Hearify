/**
 * 🧵 THREAD SCREEN
 * 
 * Hub-and-Spoke Context Engine for deep-diving into a thought.
 * Shows upstream (past), focus (center), downstream (future), and lateral (related) connections.
 */

import { THREAD_COLORS, THREAD_CONTRACT } from '@/constants/contracts';
import { Snippet } from '@/db/schema';
import { buildThreadContext } from '@/services/ThreadService';
import { useCTC } from '@/store/CognitiveTempoController';
import { useContextStore } from '@/store/contextStore';
import { AI_ACTIONS, AIActionType, ThreadContext } from '@/types/ThreadTypes';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
    SlideInRight
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ═══════════════════════════════════════════════════════════════════
// TYPE CONFIG (matching Chronicle)
// ═══════════════════════════════════════════════════════════════════

const TYPE_CONFIG = {
    fact: { color: '#00F0FF', label: 'FACT' },
    feeling: { color: '#FF0055', label: 'FEELING' },
    goal: { color: '#FFD700', label: 'GOAL' },
};

// ═══════════════════════════════════════════════════════════════════
// STEPPED CONNECTION (Zero SVG)
// ═══════════════════════════════════════════════════════════════════

interface SteppedConnectionProps {
    direction: 'up' | 'down';
    color?: string;
    isGradient?: boolean;
}

const SteppedConnection = ({ direction, color = '#333', isGradient = false }: SteppedConnectionProps) => (
    <View style={styles.connectorContainer}>
        <View style={[
            styles.connectorLine,
            { backgroundColor: isGradient ? color : '#333' },
            isGradient && { opacity: 0.6 }
        ]} />
        <View style={[styles.connectorDot, { backgroundColor: color }]} />
    </View>
);

// ═══════════════════════════════════════════════════════════════════
// THREAD NODE
// ═══════════════════════════════════════════════════════════════════

interface ThreadNodeProps {
    node: Snippet;
    variant: 'dimmed' | 'focus' | 'highlight';
    index: number;
    onPress?: () => void;
}

const ThreadNode = ({ node, variant, index, onPress }: ThreadNodeProps) => {
    const config = TYPE_CONFIG[node.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.fact;

    const getVariantStyles = () => {
        switch (variant) {
            case 'focus':
                return {
                    card: styles.focusCard,
                    border: { borderColor: THREAD_COLORS.focus.border, borderWidth: 2 },
                };
            case 'highlight':
                return {
                    card: styles.highlightCard,
                    border: { borderColor: THREAD_COLORS.downstream.line, borderWidth: 1 },
                };
            default:
                return {
                    card: styles.dimmedCard,
                    border: { borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 },
                };
        }
    };

    const variantStyles = getVariantStyles();

    return (
        <Animated.View entering={SlideInRight.delay(index * 60).springify()}>
            <Pressable
                style={[styles.nodeCard, variantStyles.card, variantStyles.border]}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onPress?.();
                }}
            >
                {/* Type Badge */}
                <View style={[styles.typeBadge, { backgroundColor: `${config.color}20` }]}>
                    <Text style={[styles.typeBadgeText, { color: config.color }]}>{config.label}</Text>
                </View>

                {/* Content */}
                <Text
                    style={[styles.nodeContent, variant === 'focus' && styles.focusContent]}
                    numberOfLines={variant === 'focus' ? 6 : 3}
                >
                    {node.content}
                </Text>

                {/* Footer */}
                <View style={styles.nodeFooter}>
                    <Text style={styles.nodeTime}>
                        {new Date(node.timestamp).toLocaleDateString()}
                    </Text>
                    {variant === 'focus' && (
                        <View style={styles.focusIndicator}>
                            <View style={[styles.focusDot, { backgroundColor: THREAD_COLORS.focus.border }]} />
                            <Text style={styles.focusText}>FOCUS</Text>
                        </View>
                    )}
                </View>
            </Pressable>
        </Animated.View>
    );
};

// ═══════════════════════════════════════════════════════════════════
// SECTION HEADER
// ═══════════════════════════════════════════════════════════════════

interface SectionHeaderProps {
    label: string;
    color: string;
    count: number;
}

const SectionHeader = ({ label, color, count }: SectionHeaderProps) => (
    <View style={styles.sectionHeader}>
        <View style={[styles.sectionDot, { backgroundColor: color }]} />
        <Text style={[styles.sectionLabel, { color }]}>{label}</Text>
        <Text style={styles.sectionCount}>{count}</Text>
    </View>
);

// ═══════════════════════════════════════════════════════════════════
// TRINITY ACTION DOCK
// ═══════════════════════════════════════════════════════════════════

interface TrinityActionDockProps {
    focusNode: Snippet;
    onAction: (actionType: AIActionType) => void;
    isLoading: boolean;
    enabled: boolean;
}

const TrinityActionDock = ({ focusNode, onAction, isLoading, enabled }: TrinityActionDockProps) => {
    if (!enabled) return null;

    return (
        <Animated.View entering={FadeInUp.delay(300)} style={styles.dockContainer}>
            {Platform.OS === 'ios' ? (
                <BlurView intensity={60} tint="dark" style={styles.dockBlur}>
                    <DockContent onAction={onAction} isLoading={isLoading} />
                </BlurView>
            ) : (
                <View style={styles.dockAndroid}>
                    <DockContent onAction={onAction} isLoading={isLoading} />
                </View>
            )}
        </Animated.View>
    );
};

const DockContent = ({ onAction, isLoading }: { onAction: (t: AIActionType) => void; isLoading: boolean }) => (
    <View style={styles.dockRow}>
        {Object.values(AI_ACTIONS).map((action) => (
            <Pressable
                key={action.id}
                style={styles.actionBtn}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onAction(action.id);
                }}
                disabled={isLoading}
            >
                <Text style={styles.actionEmoji}>{action.emoji}</Text>
                <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
        ))}
    </View>
);

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

interface ThreadScreenProps {
    focusNodeId: number;
    onClose: () => void;
}

export const ThreadScreen = ({ focusNodeId, onClose }: ThreadScreenProps) => {
    const insets = useSafeAreaInsets();
    const ctcMode = useCTC(s => s.mode);
    const [context, setContext] = useState<ThreadContext | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [aiLoading, setAiLoading] = useState(false);

    // Get visual behavior from contract
    const behavior = THREAD_CONTRACT.visualBehavior[ctcMode] || THREAD_CONTRACT.visualBehavior.IDLE;

    // Load thread context
    const loadContext = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch the focus node first
            const { getDb } = await import('@/db');
            const db = await getDb();
            const result = await db.execute('SELECT * FROM snippets WHERE id = ?', [focusNodeId]);
            const focusNode = result.rows?.[0] as unknown as Snippet | undefined;

            if (focusNode) {
                const threadContext = await buildThreadContext(focusNode);
                setContext(threadContext);
            }
        } catch (error) {
            console.error('[Thread] Failed to load context:', error);
        } finally {
            setIsLoading(false);
        }
    }, [focusNodeId]);

    useEffect(() => {
        loadContext();
    }, [loadContext]);

    // Auto-close on idle (Contract enforcement)
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (ctcMode === 'IDLE') {
            timer = setTimeout(onClose, THREAD_CONTRACT.availability.autoCloseTimeout);
        }
        return () => clearTimeout(timer);
    }, [ctcMode, onClose]);

    // Handle AI action
    const handleAIAction = useCallback(async (actionType: AIActionType) => {
        if (!context) return;

        setAiLoading(true);
        try {
            const { processWithReasoning } = await import('@/services/deepseek');
            const { saveSnippetWithDedup } = await import('@/services/SemanticDedupService');
            const { createEdge } = await import('@/db');

            const action = AI_ACTIONS[actionType];
            const prompt = action.prompt(context.focus.content);
            console.log('[Thread AI] Prompting:', prompt);

            // Call DeepSeek (Reasoning Model)
            const result = await processWithReasoning(
                prompt,
                context.upstream.nodes.map(n => n.content), // Context from upstream
                [] // No chat history needed
            );

            // Use the response as the insight content
            const insightContent = result.response.trim();
            if (insightContent) {
                // Save as new node
                const saved = await saveSnippetWithDedup({
                    type: 'fact', // Insights are stored as facts for now
                    content: insightContent,
                    topic: context.focus.topic,
                    sentiment: 'analytical',
                    reasoning: result.reasoning
                });

                if (saved.snippetId) {
                    // Link to focus node (Downstream)
                    // Action -> Result, so Focus -> Insight
                    await createEdge(context.focus.id, saved.snippetId, 0.85);

                    // Haptic & Reload
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    await loadContext(); // Refresh to show new node
                }
            }

        } catch (error) {
            console.error('[Thread AI] Failed:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setAiLoading(false);
        }
    }, [context, loadContext]);

    // Navigate to node in Horizon
    const handleNavigateToNode = useCallback((nodeId: number) => {
        useContextStore.getState().navigateToNode(nodeId);
        onClose();
    }, [onClose]);

    if (isLoading) {
        return (
            <View style={[styles.container, styles.loadingContainer]}>
                <ActivityIndicator size="large" color="#818cf8" />
                <Text style={styles.loadingText}>Building Thread...</Text>
            </View>
        );
    }

    if (!context) {
        return (
            <View style={[styles.container, styles.loadingContainer]}>
                <Text style={styles.errorText}>Could not load thread</Text>
                <Pressable style={styles.closeBtn} onPress={onClose}>
                    <Text style={styles.closeBtnText}>Close</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#0a0a12', '#0d0d18', '#000']}
                style={StyleSheet.absoluteFill}
            />

            {/* Header */}
            <Animated.View
                entering={FadeIn}
                style={[styles.header, { paddingTop: insets.top + 8 }]}
            >
                <Pressable style={styles.backBtn} onPress={onClose}>
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                </Pressable>
                <Text style={styles.headerTitle}>Thread View</Text>
                <View style={{ width: 40 }} />
            </Animated.View>

            {/* Scroll Content */}
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* ⬆️ UPSTREAM (Context) */}
                {behavior.showUpstream && context.upstream.nodes.length > 0 && (
                    <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
                        <SectionHeader
                            label="CONTEXT (Past)"
                            color={THREAD_COLORS.upstream.line}
                            count={context.upstream.nodes.length}
                        />
                        {context.upstream.nodes.map((node, i) => (
                            <React.Fragment key={node.id}>
                                <ThreadNode
                                    node={node}
                                    variant="dimmed"
                                    index={i}
                                    onPress={() => handleNavigateToNode(node.id)}
                                />
                                <SteppedConnection
                                    direction="down"
                                    color={THREAD_COLORS.upstream.dot}
                                />
                            </React.Fragment>
                        ))}
                    </Animated.View>
                )}

                {/* 🎯 THE HUB (Focus) */}
                <Animated.View entering={FadeIn.delay(200)} style={styles.hubContainer}>
                    <ThreadNode
                        node={context.focus}
                        variant="focus"
                        index={0}
                    />

                    {/* Lateral Scroll */}
                    {behavior.showLateral && context.lateral.nodes.length > 0 && (
                        <View style={styles.lateralContainer}>
                            <Text style={styles.lateralLabel}>Related Topics</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.lateralScroll}
                                contentContainerStyle={styles.lateralContent}
                            >
                                {context.lateral.nodes.slice(0, 5).map((node, i) => (
                                    <Pressable
                                        key={node.id}
                                        style={styles.lateralCard}
                                        onPress={() => handleNavigateToNode(node.id)}
                                    >
                                        <Text style={styles.lateralText} numberOfLines={2}>
                                            {node.content}
                                        </Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </View>
                    )}
                </Animated.View>

                {/* ⬇️ DOWNSTREAM (Implications) */}
                {behavior.showDownstream && (
                    <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
                        <SteppedConnection
                            direction="down"
                            color={THREAD_COLORS.downstream.line}
                            isGradient
                        />
                        <SectionHeader
                            label="IMPLICATIONS"
                            color={THREAD_COLORS.downstream.line}
                            count={context.downstream.nodes.length}
                        />
                        {context.downstream.nodes.map((node, i) => (
                            <ThreadNode
                                key={node.id}
                                node={node}
                                variant="highlight"
                                index={i}
                                onPress={() => handleNavigateToNode(node.id)}
                            />
                        ))}

                        {context.downstream.nodes.length === 0 && (
                            <View style={styles.emptyDownstream}>
                                <Text style={styles.emptyText}>No implications yet</Text>
                                <Text style={styles.emptyHint}>Use AI actions below to generate insights</Text>
                            </View>
                        )}
                    </Animated.View>
                )}
            </ScrollView>

            {/* Trinity Action Dock */}
            <TrinityActionDock
                focusNode={context.focus}
                onAction={handleAIAction}
                isLoading={aiLoading}
                enabled={behavior.aiActionsEnabled}
            />
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        color: '#888',
        fontSize: 14,
    },
    errorText: {
        color: '#ff4444',
        fontSize: 16,
        marginBottom: 20,
    },
    closeBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
    },
    closeBtnText: {
        color: '#fff',
        fontSize: 14,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#fff',
    },

    // Scroll
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
    },

    // Sections
    section: {
        marginBottom: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    sectionDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
    },
    sectionCount: {
        fontSize: 11,
        color: '#666',
        marginLeft: 'auto',
    },

    // Connector
    connectorContainer: {
        alignItems: 'center',
        height: 28,
        marginVertical: 4,
    },
    connectorLine: {
        width: 2,
        flex: 1,
        backgroundColor: '#333',
    },
    connectorDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 4,
    },

    // Nodes
    nodeCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 8,
    },
    dimmedCard: {
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    focusCard: {
        backgroundColor: 'rgba(129, 140, 248, 0.08)',
    },
    highlightCard: {
        backgroundColor: 'rgba(34, 197, 94, 0.06)',
    },
    typeBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginBottom: 10,
    },
    typeBadgeText: {
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 1,
    },
    nodeContent: {
        fontSize: 14,
        color: '#e5e5e5',
        lineHeight: 20,
    },
    focusContent: {
        fontSize: 16,
        lineHeight: 24,
    },
    nodeFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
    },
    nodeTime: {
        fontSize: 11,
        color: '#666',
    },
    focusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    focusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    focusText: {
        fontSize: 9,
        color: '#818cf8',
        fontWeight: '700',
        letterSpacing: 1,
    },

    // Hub
    hubContainer: {
        marginVertical: 16,
    },

    // Lateral
    lateralContainer: {
        marginTop: 16,
    },
    lateralLabel: {
        fontSize: 11,
        color: '#888',
        fontWeight: '600',
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    lateralScroll: {
        marginHorizontal: -20,
    },
    lateralContent: {
        paddingHorizontal: 20,
        gap: 10,
    },
    lateralCard: {
        width: 140,
        padding: 12,
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.2)',
    },
    lateralText: {
        fontSize: 12,
        color: '#ccc',
        lineHeight: 16,
    },

    // Empty
    emptyDownstream: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    emptyText: {
        color: '#666',
        fontSize: 14,
    },
    emptyHint: {
        color: '#444',
        fontSize: 12,
        marginTop: 4,
    },

    // Dock
    dockContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    dockBlur: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)',
    },
    dockAndroid: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        backgroundColor: 'rgba(20, 20, 28, 0.95)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)',
    },
    dockRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    actionBtn: {
        alignItems: 'center',
        padding: 12,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
        minWidth: 90,
    },
    actionEmoji: {
        fontSize: 24,
        marginBottom: 4,
    },
    actionLabel: {
        fontSize: 11,
        color: '#888',
        fontWeight: '600',
    },
});
