/**
 * Orbit Screen - The Neural AI Companion Interface
 */

import { DeltaCard } from '@/components/DeltaCard';
import { NeuralOrb } from '@/components/NeuralOrb';
import { NeuralThinking } from '@/components/NeuralThinking';
import { BurgerMenuButton, SideMenu } from '@/components/SideMenu';
import { areKeysConfigured } from '@/config/api';
import { findSimilarSnippets } from '@/db';
import { useTTS } from '@/hooks/useTTS';
import { useVoiceCapture } from '@/hooks/useVoiceCapture';
import { processWithReasoning } from '@/services/deepseek';
import { DailyDelta, generateYesterdayDelta, getDeltaForDate } from '@/services/DeltaService';
import { getFastResponse } from '@/services/fastchat';
import { transcribeAudio } from '@/services/groq';
import { computeFocusTarget } from '@/services/LiveFocusService';
import { generateEmbedding } from '@/services/openai';
import { saveSnippetWithDedup } from '@/services/SemanticDedupService';
import { useContextStore } from '@/store/contextStore';
import { useConversationStore } from '@/store/conversation';
import { useProfileStore } from '@/store/profile';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, {
    Extrapolate,
    FadeInUp,
    interpolate,
    SharedValue,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Haptics from '@/utils/haptics';

type AppState = 'idle' | 'listening' | 'processing' | 'speaking';

interface OrbitScreenProps {
    layoutY?: SharedValue<number>;
    onOpenChronicle?: () => void;
}

export function OrbitScreen({ layoutY, onOpenChronicle }: OrbitScreenProps) {
    const [appState, setAppState] = useState<AppState>('idle');
    const [isKeysConfigured, setIsKeysConfigured] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [dailyDelta, setDailyDelta] = useState<DailyDelta | null>(null);
    const [deltaShown, setDeltaShown] = useState(true);

    const voiceCapture = useVoiceCapture();
    const tts = useTTS();
    const {
        messages,
        addUserMessage,
        addAIResponse,
        setTranscribing,
        setReasoning,
        setEmbedding,
        setSpeaking,
        setError,
        isTranscribing,
        isReasoning,
        isEmbedding,
        isSpeaking,
    } = useConversationStore();

    const { currentProfile } = useProfileStore();

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

    // Scroll ref for auto-scroll to end
    const scrollRef = React.useRef<any>(null);
    const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

    const insets = useSafeAreaInsets();
    const { height: SCREEN_HEIGHT } = Dimensions.get('window');

    // 🚀 SINGULARITY: The Orb reacts to the swipe towards Horizon (+layoutY)
    const heroOrbStyle = useAnimatedStyle(() => {
        if (!layoutY) return {};

        // As layoutY goes from 0 to -SCREEN_HEIGHT (Horizon Screen)
        const scale = interpolate(
            Number(layoutY.value),
            [-SCREEN_HEIGHT, 0],
            [15, 1], // Radical zoom into the "Neural Matrix"
            Extrapolate.CLAMP
        );

        const opacity = interpolate(
            Number(layoutY.value),
            [-SCREEN_HEIGHT, -SCREEN_HEIGHT * 0.5, 0],
            [0, 0.8, 1], // Dissolve into the stars
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

    // Fetch yesterday's Daily Delta - Only show at appropriate times (lunch/evening)
    useEffect(() => {
        const fetchDelta = async () => {
            try {
                const hour = new Date().getHours();

                // Only show Delta during reflection windows:
                // - Lunch: 12:00 - 14:00
                // - Evening: 18:00 - 21:00
                const isReflectionTime = (hour >= 12 && hour <= 14) || (hour >= 18 && hour <= 21);

                if (!isReflectionTime) {
                    // Not the right time - skip silently
                    return;
                }

                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                let delta = await getDeltaForDate(yesterday);

                // Only generate if we're in the window and none exists
                if (!delta && isReflectionTime) {
                    delta = await generateYesterdayDelta();
                }

                // Small delay so it doesn't feel pushy
                setTimeout(() => {
                    setDailyDelta(delta);
                }, 2000);

            } catch (e) {
                // Fail silently - Delta is not critical
                console.debug('[OrbitScreen] Delta skipped:', e);
            }
        };
        fetchDelta();
    }, []);

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
            // 🛑 INTERRUPT: Stop AI speaking immediately
            tts.stop();
            setAppState('idle');
            Haptics.listening(); // Subtle haptic to confirm stop
        }
    }, [appState, voiceCapture, isKeysConfigured, tts]);

    const processAudio = useCallback(async (audioUri: string) => {
        try {
            Haptics.thinking();

            console.log('[Neural Loop] Step 1: Transcribing...');
            setTranscribing(true);
            const { text: transcript } = await transcribeAudio(audioUri);
            setTranscribing(false);
            addUserMessage(transcript);

            setEmbedding(true); // Re-use embedding state for retrieval feedback
            const [{ rich: queryEmbed }, isChattyQuery] = await Promise.all([
                generateEmbedding(transcript),
                Promise.resolve(
                    transcript.split(' ').length < 15 &&
                    !/will|muss|soll|ziel|plan|merke|notier|fakt|wichtig|wahr|wer|was|erinnerst|weißt/i.test(transcript)
                )
            ]);

            // 🔥 Sync focus vector to global store
            useContextStore.getState().setFocusVector(queryEmbed);

            // 🚀 PRE-COGNITION: Compute live focus target for Horizon camera drift
            // This runs async and updates the store — Horizon will pick it up
            computeFocusTarget(transcript).then(target => {
                if (target) {
                    useContextStore.getState().setLiveFocusTarget({
                        x: target.x,
                        y: target.y,
                        confidence: target.confidence
                    });
                }
            });

            const similarSnippets = await findSimilarSnippets(queryEmbed, 5);

            // 🧠 High-Context formatting for the AI
            const context = similarSnippets.map(s => {
                const date = new Date(s.timestamp);
                const timeAgo = Math.floor((Date.now() - s.timestamp) / (1000 * 60 * 60 * 24));
                const temporalHeader = timeAgo === 0 ? "Heute" : timeAgo === 1 ? "Gestern" : `${timeAgo} Tage her`;
                return `[${s.type.toUpperCase()} | ${s.topic} | ${temporalHeader}]: ${s.content}`;
            });
            setEmbedding(false);

            console.log('[Neural Loop] Step 3: Neural Path Execution...');
            let finalResponse = '';
            let finalReasoning = '';
            let snippets: any[] = [];

            // 🧠 Transform history for AI consistency
            const history = messages.map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content
            }));

            if (isChattyQuery) {
                console.log('[Neural Loop] Executing Fast Path (Groq)...');
                const fastResponse = await getFastResponse(
                    transcript,
                    currentProfile?.name,
                    context,
                    history
                );

                if (fastResponse.toLowerCase().includes('thinking')) {
                    console.log('[Neural Loop] Fast Path suggested reasoning. Switching...');
                    setReasoning(true);
                    const result = await processWithReasoning(transcript, context, history);
                    finalResponse = result.response;
                    finalReasoning = result.reasoning;
                    snippets = result.snippets;
                    setReasoning(false);
                } else {
                    finalResponse = fastResponse;
                }
            } else {
                console.log('[Neural Loop] Executing Reasoning Path (DeepSeek)...');
                setReasoning(true);
                const result = await processWithReasoning(transcript, context, history);
                finalResponse = result.response;
                finalReasoning = result.reasoning;
                snippets = result.snippets;
                setReasoning(false);
            }

            console.log('[Neural Loop] Step 4: Saving snippets with Semantic Deduplication...');
            setEmbedding(true);
            if (snippets.length > 0) {
                // 🧠 NEW: Use SemanticDedupService for intelligent storage
                // This handles embedding, similarity check, and smart merge
                for (const snippet of snippets) {
                    await saveSnippetWithDedup({
                        content: snippet.content,
                        type: snippet.type,
                        sentiment: snippet.sentiment,
                        topic: snippet.topic,
                        reasoning: finalReasoning,
                    });
                }
            }
            setEmbedding(false);

            // Note: SatelliteInsertEngine is triggered inside saveSnippetWithDedup
            console.log('[Neural Loop] Semantic Deduplication complete.');

            console.log('[Neural Loop] Step 5: Speaking...');


            Haptics.speaking();
            addAIResponse(finalResponse, finalReasoning);
            setAppState('speaking');
            setSpeaking(true);
            try {
                await tts.speak(finalResponse);
            } catch (ttsError) {
                console.error('[Neural Loop] TTS failed but continuing:', ttsError);
            }

            setSpeaking(false);
            setAppState('idle');

        } catch (error) {
            console.error('[Neural Loop] Failed:', error);
            setError(error instanceof Error ? error.message : 'Unknown error');
            setTranscribing(false);
            setReasoning(false);
            setEmbedding(false);
            setSpeaking(false);
            setAppState('idle');
            Haptics.error();
            Alert.alert('Error', 'Neural loop failed. Check console for details.');
        }
    }, []);

    const getOrbState = (): 'idle' | 'listening' | 'thinking' | 'speaking' => {
        if (appState === 'listening') return 'listening';
        if (appState === 'processing') return 'thinking';
        if (appState === 'speaking') return 'speaking';
        return 'idle';
    };

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
    }, [messages]);

    return (
        <View style={styles.container}>
            {/* Note: Confirmations now handled by ToastContainer in MindLayout */}

            <View style={[styles.safeArea, { paddingTop: insets.top }]}>
                {/* Side Menu */}
                <SideMenu
                    isOpen={menuOpen}
                    onClose={() => setMenuOpen(false)}
                />

                {/* Minimal Header with Burger */}
                <View style={styles.header}>
                    <BurgerMenuButton onPress={() => setMenuOpen(true)} />
                    <Text style={styles.headerTitle}>Orbit</Text>
                    <Pressable style={styles.chronicleButton} onPress={onOpenChronicle}>
                        <Text style={styles.chronicleIcon}>📜</Text>
                        <Text style={styles.chronicleText}>Chronicle</Text>
                    </Pressable>
                </View>

                {/* Main Content Area */}
                {messages.length === 0 ? (
                    /* Welcome Screen - Centered Layout */
                    <View style={styles.welcomeContainer}>
                        {/* Daily Delta Card */}
                        {dailyDelta && deltaShown && (
                            <DeltaCard
                                delta={dailyDelta}
                                onDismiss={() => setDeltaShown(false)}
                            />
                        )}

                        {/* Neural Orb - Visual Center */}
                        <Animated.View style={[styles.heroOrbWrapper, heroOrbStyle]}>
                            <NeuralOrb
                                intensity={tts.intensity}
                                state={getOrbState()}
                                size={180}
                            />
                        </Animated.View>

                        {/* Welcome Text */}
                        <Text style={styles.welcomeText}>
                            Was beschäftigt{'\n'}dich gerade?
                        </Text>

                        <Text style={styles.welcomeSubtext}>
                            Ich höre zu, denke mit und merke mir alles.
                        </Text>
                    </View>
                ) : (
                    /* Scrollable Messages */
                    <AnimatedScrollView
                        ref={scrollRef}
                        style={styles.messageList}
                        contentContainerStyle={styles.messageListContent}
                        showsVerticalScrollIndicator={false}
                        scrollEventThrottle={16}
                        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                    >
                        {messages.map((msg, idx) => (
                            <Animated.View
                                key={idx}
                                entering={FadeInUp.delay(idx * 50)}
                                style={[
                                    styles.messageWrapper,
                                    msg.role === 'user' ? styles.userMessageWrapper : styles.aiMessageWrapper
                                ]}
                            >
                                <View style={[
                                    styles.messageBubble,
                                    msg.role === 'user' ? styles.userBubble : styles.aiBubble
                                ]}>
                                    <Text style={styles.messageText}>{msg.content}</Text>
                                </View>
                            </Animated.View>
                        ))}

                        {/* Thinking Indicator */}
                        {isReasoning && (
                            <Animated.View entering={FadeInUp} style={[styles.messageWrapper, styles.aiMessageWrapper]}>
                                <View style={[styles.messageBubble, styles.aiBubble, styles.thinkingBubble]}>
                                    <NeuralThinking />
                                </View>
                            </Animated.View>
                        )}
                    </AnimatedScrollView>
                )}

                {/* Floating Input Bar (Antigravity HUD) */}
                <Animated.View
                    entering={FadeInUp.delay(1000).springify()}
                    style={[styles.inputBar, { bottom: insets.bottom + 20 }]}
                >
                    <View style={styles.inputField}>
                        <Text style={styles.inputPlaceholder}>
                            {appState === 'listening' ? '🔴 System is listening...' :
                                isTranscribing ? '✍️ Decoding neural signal...' :
                                    isEmbedding ? '🧠 Scanning Matrix...' :
                                        isReasoning ? '💭 Pathfinding thoughts...' :
                                            isSpeaking ? '🔊 Synthesizing voice...' :
                                                'Share your consciousness...'}
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.micButton,
                            appState === 'listening' && styles.micButtonActive,
                            (appState === 'processing' || appState === 'speaking') && styles.micButtonDisabled
                        ]}
                        onPress={handleRecordPress}
                        disabled={appState === 'processing' || appState === 'speaking'}
                        activeOpacity={0.8}
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
                </Animated.View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    safeArea: {
        flex: 1,
    },
    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
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
    // Welcome Screen - Centered Orb Layout
    welcomeContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingBottom: 80, // Space for input bar
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
    // Message List
    messageList: {
        flex: 1,
    },
    messageListContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 140,
        gap: 12,
    },
    // Message Bubbles (Liquid Glass)
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
    // Floating Input Bar (HUD)
    inputBar: {
        position: 'absolute',
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(18, 18, 24, 0.9)',
        borderRadius: 32,
        paddingHorizontal: 8,
        paddingVertical: 8,
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 15,
    },
    inputField: {
        flex: 1,
        height: 48,
        justifyContent: 'center',
        paddingHorizontal: 16,
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
});
