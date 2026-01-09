/**
 * Orbit Screen - The Neural AI Companion Interface
 */

import { DeltaCard } from '@/components/DeltaCard';
import { GhostSuggestionsContainer } from '@/components/GhostSuggestion';
import { NeuralOrb } from '@/components/NeuralOrb';
import { NeuralThinking } from '@/components/NeuralThinking';
import { BurgerMenuButton, SideMenu } from '@/components/SideMenu';
import { areKeysConfigured } from '@/config/api';
import { findSimilarSnippets } from '@/db';
import { useTTS } from '@/hooks/useTTS';
import { useVoiceCapture } from '@/hooks/useVoiceCapture';
import { processWithReasoning } from '@/services/deepseek';
import { DailyDelta, generateYesterdayDelta, getDeltaForDate } from '@/services/DeltaService';
import { transcribeAudio } from '@/services/groq';
import { generateEmbedding } from '@/services/openai';
import { saveSnippetWithDedup } from '@/services/SemanticDedupService';
import { useContextStore } from '@/store/contextStore';
import { PROCESSING_STATE_LABELS, useConversationStore } from '@/store/conversation';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, {
    Extrapolate,
    FadeInUp,
    FadeOut,
    interpolate,
    LinearTransition,
    runOnJS,
    SharedValue,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { processWithBatchSynthesis, processWithGPT } from '@/services/openai-chat';
import { getSuggestionColor, getSuggestionIcon, getSurfaceSuggestions, type SurfaceSuggestion } from '@/services/SurfaceSuggestionService';
import * as Haptics from '@/utils/haptics';

// 🧠 Sprint 1.1: ACE Integration
import { useEcoMode } from '@/hooks/useEcoMode';
import { usePredictions } from '@/hooks/usePredictions';
import { ace } from '@/services/AmbientConnectionEngine';
import { usePredictionStore, type Prediction } from '@/store/predictionStore';

// 🔗 Phase 6: Batch Synthesis
import type { BatchContext } from '@/services/BatchSynthesisService';
import { usePendingBatchReflect, useSelectionActions } from '@/store/chronicleStore';

// 📐 Card dimensions for iPhone-style carousel
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 64; // Full-width cards with margin

// 🕐 Helper for relative time display
function formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `vor ${diffMins}m`;
    if (diffHours < 24) return `vor ${diffHours}h`;
    if (diffDays === 1) return 'Gestern';
    if (diffDays < 7) return `vor ${diffDays} Tagen`;
    if (diffDays < 30) return `vor ${Math.floor(diffDays / 7)} Wochen`;
    return `vor ${Math.floor(diffDays / 30)} Monaten`;
}

type AppState = 'idle' | 'listening' | 'processing' | 'speaking';

interface OrbitScreenProps {
    layoutY?: SharedValue<number>;
    onOpenChronicle?: () => void;
}

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

/**
 * 🎨 Memoized Message Bubble - Performance Core
 * Prevents re-renders of the whole conversation during active speaking
 */
const MessageBubble = React.memo(({ msg, isAI }: { msg: any, isAI: boolean }) => {
    return (
        <Animated.View
            entering={FadeInUp.springify().damping(20).stiffness(100)}
            exiting={FadeOut.duration(200)}
            layout={LinearTransition.springify().damping(25).stiffness(120)}
            style={[
                styles.messageWrapper,
                isAI ? styles.aiMessageWrapper : styles.userMessageWrapper
            ]}
        >
            <View style={[
                styles.messageBubble,
                isAI ? styles.aiBubble : styles.userBubble
            ]}>
                {isAI && msg.reasoning && (
                    <View style={styles.reasoningBox}>
                        <Text style={styles.reasoningLabel}>REASONING</Text>
                        <Text style={styles.reasoningText}>{msg.reasoning}</Text>
                    </View>
                )}
                <Text style={styles.messageText}>{msg.content}</Text>
            </View>
        </Animated.View>
    );
});

/**
 * 🔗 Batch Synthesis Header - Shows GFF breakdown during batch analysis
 */
const BatchSynthesisHeader = React.memo(({ context }: { context: BatchContext }) => {
    const { gffBreakdown, count, timeRange } = context;
    
    // Format time span
    const formatTimeSpan = () => {
        const days = timeRange.spanDays;
        if (days === 0) return 'Heute';
        if (days === 1) return 'Gestern - Heute';
        if (days < 7) return `${days} Tage`;
        if (days < 30) return `${Math.ceil(days / 7)} Wochen`;
        return `${Math.ceil(days / 30)} Monate`;
    };

    return (
        <Animated.View
            entering={FadeInUp.springify().damping(20).stiffness(100)}
            style={batchStyles.container}
        >
            <View style={batchStyles.header}>
                <Ionicons name="git-merge-outline" size={18} color="rgba(255, 255, 255, 0.8)" />
                <Text style={batchStyles.title}>Batch-Synthese</Text>
            </View>
            
            <View style={batchStyles.stats}>
                <View style={batchStyles.statItem}>
                    <Text style={batchStyles.statValue}>{count}</Text>
                    <Text style={batchStyles.statLabel}>Gedanken</Text>
                </View>
                <View style={batchStyles.statDivider} />
                <View style={batchStyles.statItem}>
                    <Text style={batchStyles.statValue}>{formatTimeSpan()}</Text>
                    <Text style={batchStyles.statLabel}>Zeitraum</Text>
                </View>
            </View>
            
            <View style={batchStyles.gffRow}>
                {gffBreakdown.goals > 0 && (
                    <View style={[batchStyles.gffBadge, { backgroundColor: 'rgba(74, 222, 128, 0.2)' }]}>
                        <Text style={[batchStyles.gffText, { color: '#4ade80' }]}>
                            🎯 {gffBreakdown.goals}
                        </Text>
                    </View>
                )}
                {gffBreakdown.feelings > 0 && (
                    <View style={[batchStyles.gffBadge, { backgroundColor: 'rgba(168, 85, 247, 0.2)' }]}>
                        <Text style={[batchStyles.gffText, { color: '#a855f7' }]}>
                            💜 {gffBreakdown.feelings}
                        </Text>
                    </View>
                )}
                {gffBreakdown.facts > 0 && (
                    <View style={[batchStyles.gffBadge, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                        <Text style={[batchStyles.gffText, { color: '#3b82f6' }]}>
                            📘 {gffBreakdown.facts}
                        </Text>
                    </View>
                )}
            </View>
        </Animated.View>
    );
});

const batchStyles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.8)',
    },
    stats: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    statLabel: {
        fontSize: 10,
        color: 'rgba(255, 255, 255, 0.5)',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statDivider: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginHorizontal: 12,
    },
    gffRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    gffBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    gffText: {
        fontSize: 12,
        fontWeight: '600',
    },
});

const ReflectionSuggester = ({ reflections, onSave, onDismiss }: {
    reflections: any[],
    onSave: (r: any, i: number) => void,
    onDismiss: (i: number) => void
}) => {
    const [expanded, setExpanded] = useState(false);

    if (reflections.length === 0) return null;

    return (
        <Animated.View
            entering={FadeInUp.springify()}
            style={styles.reflectionContainer}
        >
            {/* Compact Header - Always Visible */}
            <TouchableOpacity
                style={styles.reflectionToggle}
                onPress={() => setExpanded(!expanded)}
                activeOpacity={0.7}
            >
                <View style={styles.reflectionToggleContent}>
                    <Ionicons 
                        name="bookmarks-outline" 
                        size={16} 
                        color="rgba(255, 255, 255, 0.6)" 
                    />
                    <Text style={styles.reflectionToggleText}>
                        {reflections.length} {reflections.length === 1 ? 'Gedanke' : 'Gedanken'} zum Festhalten
                    </Text>
                    <Ionicons 
                        name={expanded ? "chevron-up" : "chevron-down"} 
                        size={16} 
                        color="rgba(255, 255, 255, 0.4)" 
                    />
                </View>
            </TouchableOpacity>

            {/* Expanded Card List */}
            {expanded && (
                <Animated.View
                    entering={FadeInUp.springify()}
                    style={styles.reflectionExpandedContent}
                >
                    <View style={styles.reflectionHeader}>
                        <Text style={styles.reflectionTitle}>Tippe zum Speichern</Text>
                        <TouchableOpacity onPress={() => {
                            reflections.forEach((_, i) => onDismiss(i));
                            setExpanded(false);
                        }}>
                            <Text style={styles.reflectionDismiss}>Alle ignorieren</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView
                        style={styles.reflectionScrollView}
                        showsVerticalScrollIndicator={false}
                    >
                        {reflections.map((ref, i) => (
                            <Animated.View
                                key={`${ref.content}-${i}`}
                                entering={FadeInUp.delay(i * 50).springify()}
                                layout={LinearTransition}
                            >
                                <TouchableOpacity
                                    style={[
                                        styles.reflectionCard,
                                        ref.type === 'goal' && styles.reflectionGoal,
                                        ref.type === 'feeling' && styles.reflectionFeeling,
                                        ref.type === 'fact' && styles.reflectionFact
                                    ]}
                                    onPress={() => {
                                        onSave(ref, i);
                                        if (reflections.length === 1) setExpanded(false);
                                    }}
                                >
                                    <View style={styles.reflectionIconRow}>
                                        <Text style={styles.reflectionType}>{ref.type.toUpperCase()}</Text>
                                        <TouchableOpacity 
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                onDismiss(i);
                                            }}
                                            hitSlop={8}
                                        >
                                            <Text style={styles.reflectionClose}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={styles.reflectionContent}>{ref.content}</Text>
                                    {ref.hashtags && <Text style={styles.reflectionHashtags}>{ref.hashtags}</Text>}
                                </TouchableOpacity>
                            </Animated.View>
                        ))}
                    </ScrollView>
                </Animated.View>
            )}
        </Animated.View>
    );
};

export function OrbitScreen({ layoutY, onOpenChronicle }: OrbitScreenProps) {
    const [appState, setAppState] = useState<AppState>('idle');
    const [isKeysConfigured, setIsKeysConfigured] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [dailyDelta, setDailyDelta] = useState<DailyDelta | null>(null);
    const [deltaShown, setDeltaShown] = useState(true);
    const [deepThinking, setDeepThinking] = useState(false);
    
    // 🎹 Animated keyboard height for smooth transitions
    const keyboardHeightAnim = useSharedValue(0);

    // 🆕 Sprint 1.1: Text Input & ACE State
    const [textInput, setTextInput] = useState('');
    const [stagedConnections, setStagedConnections] = useState<Prediction[]>([]);
    const [proposedReflections, setProposedReflections] = useState<any[]>([]);
    const textInputRef = React.useRef<TextInput>(null);
    const { reflect } = useLocalSearchParams<{ reflect?: string }>();
    const lastReflectedContent = useRef<string | null>(null);

    // 🔗 Phase 6: Batch Synthesis State
    const pendingBatchReflect = usePendingBatchReflect();
    const { clearPendingBatchReflect } = useSelectionActions();
    const [activeBatchContext, setActiveBatchContext] = useState<BatchContext | null>(null);
    const batchReflectProcessed = useRef(false);

    // 🌊 Surface Suggestions State
    const [surfaceSuggestions, setSurfaceSuggestions] = useState<SurfaceSuggestion[]>([]);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
    const surfaceCardsOpacity = useSharedValue(1);

    // 🗓️ Calendar Proposal State (Action Catalyst)
    const [calendarProposal, setCalendarProposal] = useState<EventProposal | null>(null);
    const calendarStatus = useCalendarStore((s) => s.status);

    // Helper to reset opacity after fade
    const resetSurfaceCardsOpacity = useCallback(() => {
        surfaceCardsOpacity.value = 1;
    }, []);

    // Helper to clear suggestions  
    const clearSurfaceSuggestions = useCallback(() => {
        setSurfaceSuggestions([]);
    }, []);

    // 🃏 Smooth fade-out for surface cards
    const dismissSurfaceCards = useCallback(() => {
        if (surfaceSuggestions.length === 0) return; // Nothing to dismiss
        surfaceCardsOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
            if (finished) {
                runOnJS(clearSurfaceSuggestions)();
                runOnJS(resetSurfaceCardsOpacity)();
            }
        });
    }, [surfaceSuggestions.length, clearSurfaceSuggestions, resetSurfaceCardsOpacity]);

    // 🧠 Handle incoming "Reflect" triggers from Chronicle
    useEffect(() => {
        if (reflect && reflect !== lastReflectedContent.current) {
            lastReflectedContent.current = reflect;
            console.log('[Orbit] Received reflection trigger:', reflect);

            // Auto-trigger a "deep dive" request
            const reflectionPrompt = `I want to reflect more on this thought from my archive: "${reflect}". Let's dive deeper into what this means or how I can cultivate it.`;

            // We delay slightly to let the screen mount
            setTimeout(() => {
                processTextMessage(reflectionPrompt);
            }, 500);
        }
    }, [reflect]);

    // 🧠 Save reflection handler
    const handleSaveReflection = useCallback(async (reflection: any, index: number) => {
        try {
            Haptics.impactHeavy();
            
            // === AMBIENT PERSISTENCE: Link snippet to current conversation ===
            const conversationId = useConversationStore.getState().currentConversationId;
            
            const result = await saveSnippetWithDedup({
                content: reflection.content,
                type: reflection.type,
                sentiment: reflection.sentiment || 'neutral',
                topic: reflection.topic || 'Reflection',
                hashtags: reflection.hashtags,
                conversationId, // 🆕 Link to session
            });
            
            if (result.success) {
                console.log('[Orbit] Snippet saved successfully:', result.snippetId);
                
                // Remove from staging
                setProposedReflections(prev => prev.filter((_, i) => i !== index));
                
                // Trigger refresh (already called in saveSnippetWithDedup, but ensuring it fires)
                useContextStore.getState().triggerNodeRefresh();
            }
        } catch (e) {
            console.error('[Orbit] Save failed:', e);
        }
    }, []);

    const handleDismissReflection = useCallback((index: number) => {
        Haptics.light();
        setProposedReflections(prev => prev.filter((_, i) => i !== index));
    }, []);

    // 🧠 ACE Predictions
    const predictions = usePredictions();
    const ecoMode = useEcoMode();

    // Set ACE tier based on eco mode
    useEffect(() => {
        ace.setTier(ecoMode.isEcoMode ? 'ECO' : 'STANDARD');
    }, [ecoMode.isEcoMode]);

    const voiceCapture = useVoiceCapture();
    const tts = useTTS();

    // Select only what we need from store to minimize re-renders
    const messages = useConversationStore(state => state.messages);
    const addUserMessage = useConversationStore(state => state.addUserMessage);
    const addAIResponse = useConversationStore(state => state.addAIResponse);
    const setTranscribing = useConversationStore(state => state.setTranscribing);
    const setReasoning = useConversationStore(state => state.setReasoning);
    const setEmbedding = useConversationStore(state => state.setEmbedding);
    const setSpeaking = useConversationStore(state => state.setSpeaking);
    const setError = useConversationStore(state => state.setError);
    const isTranscribing = useConversationStore(state => state.isTranscribing);
    const isReasoning = useConversationStore(state => state.isReasoning);
    const isEmbedding = useConversationStore(state => state.isEmbedding);
    const isSpeaking = useConversationStore(state => state.isSpeaking);
    const resumeSession = useConversationStore(state => state.resumeSession);
    
    // 🎯 Granular Processing State (Q3C)
    const processingState = useConversationStore(state => state.processingState);
    const setProcessingState = useConversationStore(state => state.setProcessingState);

    // 👻 Ghost Mode (Sprint 2.1)
    const isGhostMode = useContextStore(state => state.isGhostMode);
    const setGhostMode = useContextStore(state => state.setGhostMode);

    // 🔗 Phase 6: Handle Batch Reflect from Chronicle
    useEffect(() => {
        if (pendingBatchReflect && !batchReflectProcessed.current) {
            batchReflectProcessed.current = true;
            console.log('[Orbit] 🔗 Batch reflect received:', pendingBatchReflect.context.count, 'snippets');

            const processBatch = async () => {
                // Show disconnection warning if present
                if (pendingBatchReflect.disconnectionWarning) {
                    Alert.alert(
                        '⚠️ Thematischer Hinweis',
                        pendingBatchReflect.disconnectionWarning,
                        [
                            {
                                text: 'Trotzdem analysieren',
                                onPress: () => executeBatchSynthesis(),
                            },
                            {
                                text: 'Zurück zur Auswahl',
                                style: 'cancel',
                                onPress: () => {
                                    clearPendingBatchReflect();
                                    batchReflectProcessed.current = false;
                                },
                            },
                        ]
                    );
                } else {
                    executeBatchSynthesis();
                }
            };

            const executeBatchSynthesis = async () => {
                try {
                    Haptics.thinking();
                    setAppState('processing');
                    setProcessingState('reasoning');

                    // Set the active batch context for the header
                    setActiveBatchContext(pendingBatchReflect.context);

                    // Add a user "message" to show what we're analyzing
                    const userSummary = `📚 Batch-Analyse von ${pendingBatchReflect.context.count} Gedanken`;
                    addUserMessage(userSummary);

                    // Get or create conversation session
                    let conversationId = useConversationStore.getState().currentConversationId;
                    if (!conversationId) {
                        conversationId = await useConversationStore.getState().startNewSession();
                    }

                    // Call synthesis API
                    const result = await processWithBatchSynthesis(
                        pendingBatchReflect.systemPrompt,
                        pendingBatchReflect.userMessage,
                        conversationId
                    );

                    // Add AI response
                    addAIResponse(result.response, '');
                    setReasoning(false);
                    setProcessingState('generating');

                    // Speak the response
                    setAppState('speaking');
                    setSpeaking(true);
                    setProcessingState('speaking');
                    try {
                        await tts.speakStreaming(result.response, () => {
                            Haptics.speaking();
                        });
                    } catch (ttsError) {
                        console.error('[BatchSynthesis] TTS failed:', ttsError);
                    }

                    setSpeaking(false);
                    setAppState('idle');
                    setProcessingState('idle');

                    // Clear the pending payload
                    clearPendingBatchReflect();
                } catch (error) {
                    console.error('[BatchSynthesis] Error:', error);
                    setError('Batch-Analyse fehlgeschlagen');
                    setAppState('idle');
                    setProcessingState('idle');
                    clearPendingBatchReflect();
                }
            };

            // Small delay to let screen mount
            setTimeout(processBatch, 300);
        }

        // Reset flag when payload is cleared
        if (!pendingBatchReflect) {
            batchReflectProcessed.current = false;
        }
    }, [pendingBatchReflect, clearPendingBatchReflect, addUserMessage, addAIResponse, setProcessingState, setReasoning, setSpeaking, setError, tts]);

    const recordButtonScale = useSharedValue(1);

    useEffect(() => {
        if (appState === 'listening') {
            recordButtonScale.value = withRepeat(
                withSequence(
                    withTiming(1.15, { duration: 1000 }),
                    withTiming(1, { duration: 1000 })
                ),
                -1,
                true
            );
        } else {
            recordButtonScale.value = withSpring(1);
        }
    }, [appState]);

    const animatedButtonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: recordButtonScale.value }],
    }));

    // 🔦 SEMANTIC AWARENESS (Edge Glow)
    const ambientPredictions = useContextStore(state => state.ambientPredictions);

    const edgeGlowStyle = useAnimatedStyle(() => {
        // Active when reasoning, embedding, OR when ACE found connections (Sprint 1.3)
        const hasPredictions = ambientPredictions.length > 0;
        const active = isEmbedding || isReasoning || hasPredictions;

        return {
            opacity: withTiming(active ? 0.6 : 0, { duration: 600 })
        };
    });

    // Scroll ref for auto-scroll
    const scrollRef = React.useRef<ScrollView>(null);
    const prevMessageCount = React.useRef(0);

    // 🚀 UNIFIED SMART SCROLL: Handles all message additions smoothly
    useEffect(() => {
        if (messages.length > prevMessageCount.current) {
            const timer = setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: true });
            }, 250);
            return () => clearTimeout(timer);
        }
        prevMessageCount.current = messages.length;
    }, [messages.length]);

    const insets = useSafeAreaInsets();
    const { width: SCREEN_WIDTH } = Dimensions.get('window');

    // 🎹 Keyboard listener with smooth animated transitions
    useEffect(() => {
        const keyboardWillShow = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => {
                keyboardHeightAnim.value = withTiming(e.endCoordinates.height, { duration: 250 });
            }
        );
        const keyboardWillHide = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => {
                keyboardHeightAnim.value = withTiming(0, { duration: 200 });
            }
        );

        return () => {
            keyboardWillShow.remove();
            keyboardWillHide.remove();
        };
    }, []);

    // 🎨 Animated styles for smooth keyboard transitions
    const inputBarAnimatedStyle = useAnimatedStyle(() => {
        const bottomOffset = keyboardHeightAnim.value > 0 
            ? keyboardHeightAnim.value + 60 
            : insets.bottom + 20;
        return {
            bottom: bottomOffset,
        };
    });

    const welcomeContainerAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: withTiming(keyboardHeightAnim.value > 0 ? -keyboardHeightAnim.value * 0.35 : 0, { duration: 250 }) }],
        };
    });

    const ghostSuggestionsAnimatedStyle = useAnimatedStyle(() => {
        const bottomOffset = keyboardHeightAnim.value > 0 
            ? keyboardHeightAnim.value + 130 
            : insets.bottom + 90;
        return {
            bottom: bottomOffset,
            opacity: withTiming(textInput.length > 0 ? 1 : 0, { duration: 200 }),
        };
    });

    // 🃏 Animated style for surface cards fade-out
    const surfaceCardsAnimatedStyle = useAnimatedStyle(() => {
        return {
            opacity: surfaceCardsOpacity.value,
        };
    });

    // 🚀 SINGULARITY: The Orb reacts to horizontal swipe
    // Triptych: -2W = Chronicle, -W = Orbit (Home), 0 = Horizon
    const heroOrbStyle = useAnimatedStyle(() => {
        if (!layoutY) return {};

        const scale = interpolate(
            Number(layoutY.value),
            [-SCREEN_WIDTH * 2, -SCREEN_WIDTH, 0],
            [0.8, 1, 8],
            Extrapolate.CLAMP
        );

        const opacity = interpolate(
            Number(layoutY.value),
            [-SCREEN_WIDTH * 1.5, -SCREEN_WIDTH, -SCREEN_WIDTH * 0.5],
            [0.4, 1, 0.4],
            Extrapolate.CLAMP
        );

        return {
            transform: [{ scale }],
            opacity,
        };
    });

    useEffect(() => {
        const init = async () => {
            const configured = await areKeysConfigured();
            setIsKeysConfigured(configured);
        };
        init();
    }, []);

    useEffect(() => {
        const fetchDelta = async () => {
            try {
                const hour = new Date().getHours();
                const isReflectionTime = (hour >= 12 && hour <= 14) || (hour >= 18 && hour <= 21);

                if (!isReflectionTime) return;

                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                let delta = await getDeltaForDate(yesterday);

                if (!delta && isReflectionTime) {
                    delta = await generateYesterdayDelta();
                }

                setTimeout(() => {
                    setDailyDelta(delta);
                }, 2000);

            } catch (e) {
                console.debug('[OrbitScreen] Delta skipped:', e);
            }
        };
        fetchDelta();
    }, []);

    // 🌊 Load Surface Suggestions
    useEffect(() => {
        const loadSuggestions = async () => {
            try {
                const suggestions = await getSurfaceSuggestions(3);
                setSurfaceSuggestions(suggestions);
                console.log('[Orbit] Loaded', suggestions.length, 'surface suggestions');
                suggestions.forEach((s, i) => {
                    console.log(`[Orbit] Suggestion ${i}:`, s.type, s.reason, 'content:', s.snippet?.content?.slice(0, 50));
                });
            } catch (e) {
                console.debug('[Orbit] Surface suggestions skipped:', e);
            }
        };
        
        // Load after a short delay to not block initial render
        const timer = setTimeout(loadSuggestions, 1500);
        return () => clearTimeout(timer);
    }, []);

    // =========================================================================
    // 🧠 Sprint 1.1: Text Input & ACE Handlers
    // =========================================================================

    // Handle text input change - triggers ACE search
    const handleTextChange = useCallback((text: string) => {
        setTextInput(text);

        // 🧠 Sprint 3: Carry context to Horizon
        // Extract meaningful keywords for illumination
        const terms = text.toLowerCase()
            .split(/[\s,.;:!?]+/)
            .filter(w => w.length > 3);

        useContextStore.getState().transitionTo('orbit', { highlightTerms: terms });

        // Clear staged connections if input is cleared
        if (text.trim().length === 0) {
            setStagedConnections([]);
            // Since we're using a real ACE implementation elsewhere, 
            // the clear call might differ, but let's keep it consistent
            return;
        }

        // Trigger ACE search (debounced)
        // Note: 'ace' is usually a globally injected/imported service or hook result
        // @ts-ignore - ace is part of the Sprint 1.1 architecture
        if (typeof ace !== 'undefined') {
            ace.debouncedFind(text, (predictions: Prediction[]) => {
                if (__DEV__ && predictions.length > 0) {
                    console.log('[Orbit] 🎯 ACE found', predictions.length, 'predictions');
                }
            });
        }
    }, []);

    // Handle accepting a ghost suggestion (staging for edge creation)
    const handleAcceptPrediction = useCallback((prediction: Prediction) => {
        // Add to staged connections
        setStagedConnections(prev => {
            // Prevent duplicates
            if (prev.some(p => p.nodeId === prediction.nodeId)) return prev;
            return [...prev, prediction];
        });

        Haptics.impactHeavy();

        if (__DEV__) {
            console.log('[Orbit] 📎 Staged connection:', prediction.node.content.substring(0, 30));
        }
    }, []);

    // Handle removing a staged connection
    const handleRemoveStagedConnection = useCallback((nodeId: number) => {
        setStagedConnections(prev => prev.filter(p => p.nodeId !== nodeId));
        Haptics.selection();
    }, []);

    // Process text message (shared logic for text and voice)
    const processTextMessage = useCallback(async (
        userText: string,
        stagedEdges: Prediction[] = []
    ) => {
        try {
            Haptics.thinking();
            setAppState('processing');
            setProcessingState('retrieving'); // 🎯 Q3C: "Durchsuche Erinnerungen..."

            addUserMessage(userText);

            setEmbedding(true);
            const [{ rich: queryEmbed }] = await Promise.all([
                generateEmbedding(userText),
            ]);

            useContextStore.getState().setFocusVector(queryEmbed);

            const similarSnippets = await findSimilarSnippets(queryEmbed, 5);

            const context = similarSnippets.map(s => {
                const timeAgo = Math.floor((Date.now() - s.timestamp) / (1000 * 60 * 60 * 24));
                const temporalHeader = timeAgo === 0 ? "Heute" : timeAgo === 1 ? "Gestern" : `${timeAgo} Tage her`;
                return `[${s.type.toUpperCase()} | ${s.topic} | ${temporalHeader}]: ${s.content}`;
            });
            setEmbedding(false);

            let finalResponse = '';
            let finalReasoning = '';
            let snippets: any[] = [];

            const history = messages.map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content
            }));

            // === AMBIENT PERSISTENCE: Get or create conversation session ===
            let conversationId = useConversationStore.getState().currentConversationId;
            if (!conversationId) {
                conversationId = await useConversationStore.getState().startNewSession();
                console.log('[Orbit] Started new session:', conversationId);
            }

            setProcessingState('reasoning'); // 🎯 Q3C: "Denke nach..."
            
            let calendarProposalData: CalendarProposalData | null | undefined = null;
            
            if (deepThinking) {
                setReasoning(true);
                const result = await processWithReasoning(userText, context, history);
                finalResponse = result.response;
                finalReasoning = result.reasoning;
                snippets = result.snippets;
            } else {
                setReasoning(true);
                const result = await processWithGPT(userText, context, history, conversationId);
                finalResponse = result.response;
                snippets = result.snippets;
                calendarProposalData = result.calendarProposal; // 🚀 Action Catalyst
            }

            addAIResponse(finalResponse, finalReasoning);
            setReasoning(false);
            setProcessingState('generating'); // 🎯 Q3C: "Formuliere Antwort..."

            // 🗓️ Handle Calendar Proposal from Action Catalyst
            if (calendarProposalData && calendarStatus === 'connected') {
                try {
                    const startTime = new Date(calendarProposalData.startTime);
                    const proposal = await createEventProposal(
                        calendarProposalData.title,
                        startTime,
                        calendarProposalData.duration
                    );
                    setCalendarProposal(proposal);
                    console.log('[Orbit] Calendar proposal created:', proposal.title);
                } catch (e) {
                    console.warn('[Orbit] Failed to create calendar proposal:', e);
                }
            }

            // Save snippets with staged edges
            setEmbedding(true);

            // 👻 Ghost Mode Check
            const ghostModeActive = useContextStore.getState().isGhostMode;
            if (ghostModeActive) {
                if (__DEV__) console.log('[Orbit] 👻 Ghost Mode Active: Skipping memory suggestions.');
            } else if (snippets.length > 0) {
                // Instead of auto-saving, we stage them for the user to confirm
                setProposedReflections(prev => [...prev, ...snippets.map(s => ({ ...s, reasoning: finalReasoning }))]);

                // Still create non-persistent session edges if needed, but for now 
                // we focus on the Interactive Extraction.
            }
            setEmbedding(false);

            setAppState('speaking');
            setSpeaking(true);
            setProcessingState('speaking'); // 🎯 Q3C: "Spreche..."
            try {
                // 🚀 Hybrid TTS Streaming: First sentence plays in <500ms
                await tts.speakStreaming(finalResponse, () => {
                    Haptics.speaking();
                });
            } catch (ttsError) {
                console.error('[Neural Loop] TTS failed:', ttsError);
            }

            setSpeaking(false);
            setAppState('idle');
            setProcessingState('idle'); // 🎯 Q3C: Back to idle

        } catch (error) {
            console.error('[Neural Loop] Failed:', error);
            setError(error instanceof Error ? error.message : 'Unknown error');
            setTranscribing(false);
            setReasoning(false);
            setEmbedding(false);
            setSpeaking(false);
            setAppState('idle');
            setProcessingState('idle');
            Haptics.error();
            Alert.alert('Error', 'Neural loop failed.');
        }
    }, [deepThinking, messages, tts, addAIResponse, addUserMessage, setTranscribing, setEmbedding, setReasoning, setSpeaking, setError, setProcessingState]);

    // Handle sending text message (similar to voice flow)
    const handleSendText = useCallback(async () => {
        if (!textInput.trim() || appState !== 'idle') return;
        if (!isKeysConfigured) {
            Alert.alert('Setup Required', 'Please configure your API keys in settings');
            return;
        }

        const userText = textInput.trim();
        const currentStagedConnections = [...stagedConnections];

        // Clear input state
        setTextInput('');
        setStagedConnections([]);
        usePredictionStore.getState().clearPredictions();
        Keyboard.dismiss();

        // Process the text (similar to processAudio but without transcription)
        await processTextMessage(userText, currentStagedConnections);
    }, [textInput, stagedConnections, appState, isKeysConfigured, processTextMessage]);



    const processAudio = useCallback(async (audioUri: string) => {
        try {
            Haptics.thinking();

            setTranscribing(true);
            const { text: transcript } = await transcribeAudio(audioUri);
            setTranscribing(false);

            // Capture staged connections before clearing
            const currentStagedConnections = [...stagedConnections];
            setStagedConnections([]);
            usePredictionStore.getState().clearPredictions();

            // Process the transcript using unified logic
            await processTextMessage(transcript, currentStagedConnections);

        } catch (error) {
            console.error('[Neural Loop] Failed:', error);
            setError(error instanceof Error ? error.message : 'Unknown error');
            setTranscribing(false);
            setAppState('idle');
            Haptics.error();
            Alert.alert('Error', 'Neural loop failed.');
        }
    }, [stagedConnections, processTextMessage, setTranscribing, setAppState, setError]);

    const handleRecordPress = useCallback(async () => {
        if (!isKeysConfigured) {
            Alert.alert('Setup Required', 'Please configure your API keys in settings');
            return;
        }

        if (appState === 'idle') {
            try {
                Haptics.listening();
                await voiceCapture.startRecording();
                setAppState('listening');
            } catch (error) {
                console.error('[App] Recording failed:', error);
                Alert.alert('Error', 'Failed to start recording');
            }
        } else if (appState === 'listening') {
            try {
                const audioUri = await voiceCapture.stopRecording();
                setAppState('processing');
                processAudio(audioUri);
            } catch (error) {
                console.error('[App] Processing failed:', error);
                setAppState('idle');
                Alert.alert('Error', 'Failed to process audio');
            }
        } else if (appState === 'speaking') {
            tts.stop();
            setAppState('idle');
            Haptics.listening();
        }
    }, [appState, voiceCapture, isKeysConfigured, tts, processAudio]);


    const orbState = useMemo(() => {
        if (appState === 'listening') return 'listening';
        if (appState === 'processing') return 'thinking';
        if (appState === 'speaking') return 'speaking';
        return 'idle';
    }, [appState]);

    return (
        <View style={styles.container}>
            <View style={[styles.safeArea, { paddingTop: insets.top }]}>
                <SideMenu 
                    isOpen={menuOpen} 
                    onClose={() => setMenuOpen(false)} 
                    onResumeSession={async (conversationId: string) => {
                        try {
                            await resumeSession(parseInt(conversationId, 10));
                            Haptics.impactHeavy();
                        } catch (error) {
                            console.error('[Orbit] Failed to resume session:', error);
                        }
                    }}
                />

                <View style={styles.header}>
                    <BurgerMenuButton onPress={() => setMenuOpen(true)} />
                    <Text style={styles.headerTitle}>Orbit</Text>
                    <Pressable style={styles.chronicleButton} onPress={() => {
                        // In Triptych mode, swipe hint - actual swipe handled by PanoramaScreen
                        Haptics.light();
                        useContextStore.getState().setActiveScreen('memory');
                    }}>
                        <Text style={styles.chronicleIcon}>📜</Text>
                        <Text style={styles.chronicleText}>Chronicle →</Text>
                    </Pressable>

                    {/* 👻 Ghost Mode Toggle */}
                    <TouchableOpacity
                        style={[styles.ghostToggle, isGhostMode && styles.ghostToggleActive]}
                        onPress={() => {
                            Haptics.selection();
                            setGhostMode(!isGhostMode);
                        }}
                    >
                        <Text style={styles.ghostIcon}>{isGhostMode ? '👻' : '👁️'}</Text>
                    </TouchableOpacity>
                </View>

                {messages.length === 0 ? (
                    <Animated.View 
                        style={[
                            styles.welcomeContainer,
                            welcomeContainerAnimatedStyle
                        ]}
                    >
                        {dailyDelta && deltaShown && (
                            <DeltaCard delta={dailyDelta} onDismiss={() => setDeltaShown(false)} />
                        )}

                        {/* 🗓️ Calendar Proposal Card (Action Catalyst) */}
                        {calendarProposal && !dailyDelta && (
                            <CalendarProposalCard
                                proposal={calendarProposal}
                                onConfirm={(eventId) => {
                                    console.log('[Orbit] Event created:', eventId);
                                    setCalendarProposal(null);
                                    Haptics.success();
                                }}
                                onDismiss={() => {
                                    setCalendarProposal(null);
                                    Haptics.light();
                                }}
                                onSelectAlternative={async (slot) => {
                                    // User selected an alternative time slot
                                    const newProposal = await createEventProposal(
                                        calendarProposal.title,
                                        slot.start,
                                        slot.durationMinutes
                                    );
                                    setCalendarProposal(newProposal);
                                    Haptics.selection();
                                }}
                            />
                        )}

                        {/* 🌊 Surface Suggestions - iPhone-style swipeable cards */}
                        {surfaceSuggestions.length > 0 && !dailyDelta && !calendarProposal && (
                            <Animated.View 
                                entering={FadeInUp.delay(300)} 
                                style={[styles.surfaceCarouselWrapper, surfaceCardsAnimatedStyle]}
                            >
                                <ScrollView
                                    horizontal
                                    pagingEnabled={false}
                                    showsHorizontalScrollIndicator={false}
                                    decelerationRate="fast"
                                    snapToInterval={CARD_WIDTH + 16}
                                    snapToAlignment="start"
                                    contentContainerStyle={styles.surfaceCarouselContent}
                                    onScroll={(e) => {
                                        const index = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + 16));
                                        if (index !== activeSuggestionIndex && index >= 0 && index < surfaceSuggestions.length) {
                                            setActiveSuggestionIndex(index);
                                        }
                                    }}
                                    scrollEventThrottle={16}
                                >
                                    {surfaceSuggestions.map((suggestion, index) => (
                                        <Animated.View
                                            key={suggestion.id}
                                            entering={FadeInUp.delay(100 * index)}
                                            style={[
                                                styles.surfaceCard,
                                                { 
                                                    borderColor: `${getSuggestionColor(suggestion.type)}40`,
                                                    width: CARD_WIDTH,
                                                }
                                            ]}
                                        >
                                            <TouchableOpacity
                                                style={styles.surfaceCardInner}
                                                onPress={() => {
                                                    Haptics.selection();
                                                    dismissSurfaceCards(); // Smooth fade-out
                                                    setTimeout(() => {
                                                        setTextInput(suggestion.promptHint);
                                                        textInputRef.current?.focus();
                                                    }, 220); // Wait for fade-out
                                                }}
                                                activeOpacity={0.8}
                                            >
                                                <View style={styles.surfaceCardHeader}>
                                                    <View style={[styles.surfaceCardIcon, { backgroundColor: `${getSuggestionColor(suggestion.type)}20` }]}>
                                                        <Ionicons
                                                            name={getSuggestionIcon(suggestion.type) as any}
                                                            size={20}
                                                            color={getSuggestionColor(suggestion.type)}
                                                        />
                                                    </View>
                                                    <View style={styles.surfaceCardHeaderText}>
                                                        <Text style={[styles.surfaceCardReason, { color: getSuggestionColor(suggestion.type) }]}>
                                                            {suggestion.reason}
                                                        </Text>
                                                        <Text style={styles.surfaceCardMeta}>
                                                            {formatTimeAgo(suggestion.snippet.timestamp)} • {Math.round((suggestion.snippet.importance ?? 0.5) * 100)}% relevance
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Text style={styles.surfaceCardContent} numberOfLines={2}>
                                                    {suggestion.snippet.content}
                                                </Text>
                                                <View style={styles.surfaceCardFooter}>
                                                    <Text style={styles.surfaceCardHint}>Tippen zum Erkunden →</Text>
                                                </View>
                                            </TouchableOpacity>
                                        </Animated.View>
                                    ))}
                                </ScrollView>
                                
                                {/* Page Indicators */}
                                <View style={styles.surfacePageIndicators}>
                                    {surfaceSuggestions.map((_, i) => (
                                        <Animated.View 
                                            key={i} 
                                            style={[
                                                styles.surfacePageDot,
                                                i === activeSuggestionIndex && styles.surfacePageDotActive
                                            ]} 
                                        />
                                    ))}
                                </View>
                            </Animated.View>
                        )}

                        <Animated.View style={[styles.heroOrbWrapper, heroOrbStyle]}>
                            <NeuralOrb intensity={tts.intensity} state={orbState} size={180} />
                        </Animated.View>

                        <Text style={styles.welcomeText}>Was beschäftigt{'\n'}dich gerade?</Text>
                        <Text style={styles.welcomeSubtext}>Ich höre zu, denke mit und merke mir alles.</Text>
                    </Animated.View>
                ) : (
                    <AnimatedScrollView
                        ref={scrollRef}
                        style={styles.messageList}
                        contentContainerStyle={styles.messageListContent}
                        showsVerticalScrollIndicator={false}
                        scrollEventThrottle={16}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* 🔗 Phase 6: Batch Synthesis Header */}
                        {activeBatchContext && (
                            <BatchSynthesisHeader context={activeBatchContext} />
                        )}
                        
                        {messages.map((msg) => (
                            <MessageBubble
                                key={msg.id}
                                msg={msg}
                                isAI={msg.role === 'assistant'}
                            />
                        ))}

                        {/* 🎯 Granular Thinking Indicator (Q3C, Q4A) */}
                        {(isReasoning || isEmbedding || processingState !== 'idle') && (
                            <Animated.View
                                entering={FadeInUp}
                                exiting={FadeOut}
                                layout={LinearTransition}
                                style={[styles.messageWrapper, styles.aiMessageWrapper]}
                            >
                                <View style={[styles.messageBubble, styles.aiBubble, styles.thinkingBubble]}>
                                    <View style={styles.thinkingIndicator}>
                                        <NeuralThinking />
                                        <Text style={styles.thinkingLabel}>
                                            {PROCESSING_STATE_LABELS[processingState] || 'Denke nach...'}
                                        </Text>
                                    </View>
                                </View>
                            </Animated.View>
                        )}
                    </AnimatedScrollView>
                )}

                {/* 🧠 Sprint 1.1: Ghost Suggestions (ACE) - Smooth fade in/out */}
                {surfaceSuggestions.length === 0 && (
                    <Animated.View style={[styles.suggestionsWrapper, ghostSuggestionsAnimatedStyle]}>
                        <GhostSuggestionsContainer onConnectionCreated={handleAcceptPrediction} />
                    </Animated.View>
                )}

                {/* 🪞 Mirror Reflections (Staging Area) */}
                <ReflectionSuggester
                    reflections={proposedReflections}
                    onSave={handleSaveReflection}
                    onDismiss={handleDismissReflection}
                />

                {/* Staged Connections (Bubbles) */}
                {stagedConnections.length > 0 && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.stagedList}
                    >
                        {stagedConnections.map(conn => (
                            <TouchableOpacity
                                key={conn.nodeId}
                                style={styles.stagedChip}
                                onPress={() => handleRemoveStagedConnection(conn.nodeId)}
                            >
                                <Text style={styles.stagedEmoji}>📎</Text>
                                <Text style={styles.stagedText} numberOfLines={1}>
                                    {conn.node.content.substring(0, 15)}...
                                </Text>
                                <Text style={styles.stagedClose}>✕</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
                >
                    <Animated.View
                        entering={FadeInUp.delay(300).springify()}
                        style={[styles.inputBar, inputBarAnimatedStyle]}
                    >
                    {/* 🎤 Left: Voice Recording Button */}
                    <TouchableOpacity
                        style={[
                            styles.micButton,
                            appState === 'listening' && styles.micButtonActive,
                            (appState === 'processing' || appState === 'speaking') && styles.micButtonDisabled
                        ]}
                        onPress={handleRecordPress}
                        disabled={appState === 'processing' || appState === 'speaking'}
                    >
                        <Animated.View style={animatedButtonStyle}>
                            {appState === 'listening' ? (
                                <View style={styles.stopIcon} />
                            ) : appState === 'processing' || appState === 'speaking' ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <View style={styles.micCircle}>
                                    <Text style={styles.micEmoji}>🎤</Text>
                                </View>
                            )}
                        </Animated.View>
                    </TouchableOpacity>

                    <View style={styles.inputField}>
                        <TextInput
                            ref={textInputRef as any}
                            style={[styles.textInput, { maxHeight: 100 }] as any}
                            value={textInput}
                            onChangeText={handleTextChange}
                            onFocus={dismissSurfaceCards}
                            placeholder={
                                appState === 'listening' ? '🔴 Listening...' :
                                    isTranscribing ? '✍️ Transcribing...' :
                                        isEmbedding ? '🧠 Scanning Matrix...' :
                                            isReasoning ? (deepThinking ? '💭 Deep thinking...' : '⚡ Thinking...') :
                                                isSpeaking ? '🔊 Speaking...' :
                                                    deepThinking ? 'Deep thinking enabled...' : 'Share your consciousness...'
                            }
                            placeholderTextColor="rgba(255, 255, 255, 0.4)"
                            multiline
                            editable={appState === 'idle'}
                        />
                    </View>

                    {/* 🚀 Right: Send Text Button */}
                    <TouchableOpacity
                        style={[
                            styles.sendButton,
                            (!textInput.length || appState !== 'idle') && styles.sendButtonDisabled
                        ]}
                        onPress={handleSendText}
                        disabled={!textInput.length || appState !== 'idle'}
                    >
                        <Text style={styles.sendIcon}>🚀</Text>
                    </TouchableOpacity>
                </Animated.View>
                </KeyboardAvoidingView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent', // Transparent for parallax
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        zIndex: 100,
    },
    chronicleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.3)',
        gap: 6,
    },
    chronicleIcon: {
        fontSize: 14,
    },
    chronicleText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#818cf8',
        letterSpacing: 0.5,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: -0.3,
    },
    ghostToggle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    ghostToggleActive: {
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        borderColor: '#8b5cf6',
    },
    ghostIcon: {
        fontSize: 16,
    },
    welcomeContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingBottom: 80,
    },
    heroOrbWrapper: {
        marginBottom: 48,
    },
    welcomeText: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
        lineHeight: 36,
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    welcomeSubtext: {
        fontSize: 15,
        color: '#666',
        textAlign: 'center',
        lineHeight: 22,
    },

    // 🌊 Surface Suggestions
    surfaceSuggestionsContainer: {
        width: '100%',
        paddingHorizontal: 20,
        marginBottom: 24,
        gap: 10,
    },
    surfaceCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
        minHeight: 140,
    },
    surfaceCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 6,
    },
    surfaceCardHeaderText: {
        flex: 1,
    },
    surfaceCardReason: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    surfaceCardMeta: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.4)',
        fontWeight: '500',
    },
    surfaceCardContent: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.7)',
        lineHeight: 20,
    },
    
    // 🎠 iPhone-style Carousel
    surfaceCarouselWrapper: {
        width: '100%',
        marginBottom: 24,
    },
    surfaceCarouselContent: {
        paddingHorizontal: 20,
        gap: 16,
    },
    surfaceCardInner: {
        // No flex: 1 - let content determine height
    },
    surfaceCardIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    surfaceCardFooter: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.06)',
    },
    surfaceCardHint: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.35)',
        fontWeight: '500',
    },
    surfacePageIndicators: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 14,
        gap: 8,
    },
    surfacePageDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    surfacePageDotActive: {
        width: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
    },

    messageList: {
        flex: 1,
    },
    messageListContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 200,
        gap: 12,
    },
    messageWrapper: {
        maxWidth: '85%',
        marginVertical: 4,
    },
    userMessageWrapper: {
        alignSelf: 'flex-end',
    },
    aiMessageWrapper: {
        alignSelf: 'flex-start',
    },
    messageBubble: {
        borderRadius: 22,
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderWidth: 1,
    },
    userBubble: {
        backgroundColor: 'rgba(99, 102, 241, 0.12)',
        borderColor: 'rgba(99, 102, 241, 0.3)',
    },
    aiBubble: {
        backgroundColor: 'rgba(28, 28, 35, 0.8)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    reasoningBox: {
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    reasoningLabel: {
        fontSize: 9,
        fontWeight: '900',
        color: '#818cf8',
        marginBottom: 6,
        letterSpacing: 1.5,
    },
    reasoningText: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.5)',
        lineHeight: 20,
        fontWeight: '500',
    },
    messageText: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.95)',
        lineHeight: 24,
        fontWeight: '400',
    },
    thinkingBubble: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(28, 28, 35, 0.4)',
    },
    // 🎯 Granular Thinking Indicator (Q3C, Q4A)
    thinkingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    thinkingLabel: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.6)',
        fontWeight: '500',
        fontStyle: 'italic',
    },
    inputBar: {
        position: 'absolute',
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#121218',
        borderRadius: 32,
        paddingHorizontal: 8,
        paddingVertical: 8,
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 12,
    },
    inputField: {
        flex: 1,
        minHeight: 48,
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    inputPlaceholder: {
        fontSize: 15,
        color: 'rgba(255, 255, 255, 0.4)',
        fontWeight: '500',
    },
    micButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#6366f1',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 8,
    },
    micCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    micButtonActive: {
        backgroundColor: '#ef4444',
        shadowColor: '#ef4444',
    },
    micButtonDisabled: {
        backgroundColor: '#222',
        opacity: 0.4,
        shadowOpacity: 0,
    },
    micEmoji: {
        fontSize: 20,
    },
    stopIcon: {
        width: 16,
        height: 16,
        borderRadius: 3,
        backgroundColor: '#fff',
    },
    thinkingToggle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    thinkingToggleActive: {
        backgroundColor: 'rgba(139, 92, 246, 0.25)',
        borderColor: 'rgba(139, 92, 246, 0.5)',
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
    },
    thinkingToggleText: {
        fontSize: 18,
    },
    leftEdgeGlow: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 100,
        zIndex: 50,
    },
    // 🧠 Sprint 1.1: ACE Integrated Styles
    suggestionsWrapper: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 100,
        paddingHorizontal: 16,
    },
    stagedList: {
        position: 'absolute',
        bottom: 100, // Just above the input bar
        left: 0,
        paddingHorizontal: 20,
        paddingBottom: 12,
        zIndex: 90,
    },
    stagedChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderColor: 'rgba(99, 102, 241, 0.4)',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginRight: 8,
        gap: 6,
    },
    stagedEmoji: {
        fontSize: 12,
    },
    stagedText: {
        fontSize: 12,
        color: '#818cf8',
        fontWeight: '600',
        maxWidth: 120,
    },
    stagedClose: {
        fontSize: 12,
        color: '#818cf8',
        marginLeft: 2,
        opacity: 0.6,
    },
    textInput: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '500',
        paddingTop: 8,
        paddingBottom: 8,
    },
    sendButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#6366f1',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 8,
    },
    sendButtonDisabled: {
        backgroundColor: 'rgba(99, 102, 241, 0.3)',
        shadowOpacity: 0,
        elevation: 0,
    },
    sendIcon: {
        fontSize: 18,
    },
    // 🪞 Mirror Reflection Styles (Compact & Collapsible)
    reflectionContainer: {
        position: 'absolute',
        bottom: 120,
        left: 20,
        right: 20,
        zIndex: 110,
    },
    reflectionToggle: {
        backgroundColor: 'rgba(30, 30, 40, 0.95)',
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.2)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    reflectionToggleContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    reflectionToggleText: {
        flex: 1,
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.7)',
    },
    reflectionExpandedContent: {
        marginTop: 8,
        backgroundColor: 'rgba(20, 20, 28, 0.98)',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.15)',
        maxHeight: 280,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    reflectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        paddingHorizontal: 4,
    },
    reflectionTitle: {
        fontSize: 10,
        fontWeight: '800',
        color: 'rgba(255, 255, 255, 0.4)',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    reflectionDismiss: {
        fontSize: 11,
        color: '#666',
        fontWeight: '600',
    },
    reflectionScrollView: {
        maxHeight: 220,
    },
    reflectionCard: {
        backgroundColor: 'rgba(40, 40, 50, 0.7)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    reflectionGoal: { 
        borderLeftWidth: 3,
        borderLeftColor: '#ffd54f',
    },
    reflectionFeeling: { 
        borderLeftWidth: 3,
        borderLeftColor: '#ff1f6d',
    },
    reflectionFact: { 
        borderLeftWidth: 3,
        borderLeftColor: '#08d0ff',
    },
    reflectionIconRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    reflectionType: {
        fontSize: 9,
        fontWeight: '900',
        color: 'rgba(255, 255, 255, 0.35)',
        letterSpacing: 1,
    },
    reflectionClose: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.3)',
        padding: 4,
    },
    reflectionContent: {
        fontSize: 13,
        color: '#f0f0f5',
        lineHeight: 18,
        fontWeight: '500',
        marginBottom: 6,
    },
    reflectionHashtags: {
        fontSize: 10,
        color: '#7c83ff',
        fontWeight: '600',
        opacity: 0.7,
    },
    // Adjust ACE positions to avoid overlap
    suggestionsWrapper: {
        position: 'absolute',
        bottom: 240,
        left: 0,
        right: 0,
        zIndex: 100,
    },
});
