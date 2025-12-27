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
import { transcribeAudio } from '@/services/groq';
import { generateEmbedding } from '@/services/openai';
import { saveSnippetWithDedup } from '@/services/SemanticDedupService';
import { useContextStore } from '@/store/contextStore';
import { useConversationStore } from '@/store/conversation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
    FadeOut,
    interpolate,
    LinearTransition,
    SharedValue,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { processWithGPT } from '@/services/openai-chat';
import * as Haptics from '@/utils/haptics';

type AppState = 'idle' | 'listening' | 'processing' | 'speaking';

interface OrbitScreenProps {
    layoutY?: SharedValue<number>;
    onOpenChronicle?: () => void;
}

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

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

export function OrbitScreen({ layoutY, onOpenChronicle }: OrbitScreenProps) {
    const [appState, setAppState] = useState<AppState>('idle');
    const [isKeysConfigured, setIsKeysConfigured] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [dailyDelta, setDailyDelta] = useState<DailyDelta | null>(null);
    const [deltaShown, setDeltaShown] = useState(true);
    const [deepThinking, setDeepThinking] = useState(false);

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

    // 🚀 SINGULARITY: The Orb reacts to horizontal swipe towards Horizon
    const heroOrbStyle = useAnimatedStyle(() => {
        if (!layoutY) return {};

        const scale = interpolate(
            Number(layoutY.value),
            [-SCREEN_WIDTH, 0],
            [12, 1],
            Extrapolate.CLAMP
        );

        const opacity = interpolate(
            Number(layoutY.value),
            [-SCREEN_WIDTH, -SCREEN_WIDTH * 0.4, 0],
            [0, 0.6, 1],
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
    }, [appState, voiceCapture, isKeysConfigured, tts]);

    const processAudio = useCallback(async (audioUri: string) => {
        try {
            Haptics.thinking();

            setTranscribing(true);
            const { text: transcript } = await transcribeAudio(audioUri);
            setTranscribing(false);
            addUserMessage(transcript);

            setEmbedding(true);
            const [{ rich: queryEmbed }] = await Promise.all([
                generateEmbedding(transcript),
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

            if (deepThinking) {
                setReasoning(true);
                const result = await processWithReasoning(transcript, context, history);
                finalResponse = result.response;
                finalReasoning = result.reasoning;
                snippets = result.snippets;
            } else {
                setReasoning(true);
                const result = await processWithGPT(transcript, context, history);
                finalResponse = result.response;
                snippets = result.snippets;
            }

            addAIResponse(finalResponse, finalReasoning);
            setReasoning(false);

            setEmbedding(true);
            if (snippets.length > 0) {
                await Promise.all(snippets.map(snippet =>
                    saveSnippetWithDedup({
                        content: snippet.content,
                        type: snippet.type,
                        sentiment: snippet.sentiment,
                        topic: snippet.topic,
                        reasoning: finalReasoning,
                    })
                ));
            }
            setEmbedding(false);

            setAppState('speaking');
            setSpeaking(true);
            try {
                await tts.speak(finalResponse, () => {
                    Haptics.speaking();
                });
            } catch (ttsError) {
                console.error('[Neural Loop] TTS failed:', ttsError);
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
            Alert.alert('Error', 'Neural loop failed.');
        }
    }, [deepThinking, messages, voiceCapture, tts, addAIResponse, addUserMessage, setTranscribing, setEmbedding, setReasoning, setSpeaking, setError]);

    const orbState = useMemo(() => {
        if (appState === 'listening') return 'listening';
        if (appState === 'processing') return 'thinking';
        if (appState === 'speaking') return 'speaking';
        return 'idle';
    }, [appState]);

    return (
        <View style={styles.container}>
            <View style={[styles.safeArea, { paddingTop: insets.top }]}>
                <SideMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

                <View style={styles.header}>
                    <BurgerMenuButton onPress={() => setMenuOpen(true)} />
                    <Text style={styles.headerTitle}>Orbit</Text>
                    <Pressable style={styles.chronicleButton} onPress={onOpenChronicle}>
                        <Text style={styles.chronicleIcon}>📜</Text>
                        <Text style={styles.chronicleText}>Chronicle</Text>
                    </Pressable>
                </View>

                {messages.length === 0 ? (
                    <View style={styles.welcomeContainer}>
                        {dailyDelta && deltaShown && (
                            <DeltaCard delta={dailyDelta} onDismiss={() => setDeltaShown(false)} />
                        )}

                        <Animated.View style={[styles.heroOrbWrapper, heroOrbStyle]}>
                            <NeuralOrb intensity={tts.intensity} state={orbState} size={180} />
                        </Animated.View>

                        <Text style={styles.welcomeText}>Was beschäftigt{'\n'}dich gerade?</Text>
                        <Text style={styles.welcomeSubtext}>Ich höre zu, denke mit und merke mir alles.</Text>
                    </View>
                ) : (
                    <AnimatedScrollView
                        ref={scrollRef}
                        style={styles.messageList}
                        contentContainerStyle={styles.messageListContent}
                        showsVerticalScrollIndicator={false}
                        scrollEventThrottle={16}
                        keyboardShouldPersistTaps="handled"
                    >
                        {messages.map((msg) => (
                            <MessageBubble
                                key={msg.id}
                                msg={msg}
                                isAI={msg.role === 'assistant'}
                            />
                        ))}

                        {isReasoning && (
                            <Animated.View
                                entering={FadeInUp}
                                exiting={FadeOut}
                                layout={LinearTransition}
                                style={[styles.messageWrapper, styles.aiMessageWrapper]}
                            >
                                <View style={[styles.messageBubble, styles.aiBubble, styles.thinkingBubble]}>
                                    <NeuralThinking />
                                </View>
                            </Animated.View>
                        )}
                    </AnimatedScrollView>
                )}

                <Animated.View
                    entering={FadeInUp.delay(300).springify()}
                    style={[styles.inputBar, { bottom: insets.bottom + 20 }]}
                >
                    <TouchableOpacity
                        style={[styles.thinkingToggle, deepThinking && styles.thinkingToggleActive]}
                        onPress={() => {
                            setDeepThinking(!deepThinking);
                            Haptics.light();
                        }}
                    >
                        <Text style={styles.thinkingToggleText}>{deepThinking ? '🧠' : '⚡'}</Text>
                    </TouchableOpacity>

                    <View style={styles.inputField}>
                        <Text style={styles.inputPlaceholder}>
                            {appState === 'listening' ? '🔴 Listening...' :
                                isTranscribing ? '✍️ Transcribing...' :
                                    isEmbedding ? '🧠 Scanning Matrix...' :
                                        isReasoning ? (deepThinking ? '💭 Deep thinking...' : '⚡ Thinking...') :
                                            isSpeaking ? '🔊 Speaking...' :
                                                deepThinking ? 'Deep thinking enabled...' : 'Share your consciousness...'}
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
});
