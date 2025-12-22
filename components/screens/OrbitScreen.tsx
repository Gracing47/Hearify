/**
 * Orbit Screen - The Neural AI Companion Interface (formerly HomeScreen)
 */

import { NeuralConfirmation } from '@/components/NeuralConfirmation';
import { NeuralOrb } from '@/components/NeuralOrb';
import { NeuralThinking } from '@/components/NeuralThinking';
import { BurgerMenuButton, SideMenu } from '@/components/SideMenu';
import { areKeysConfigured } from '@/config/api';
import { findSimilarSnippets, initDatabase, insertSnippet } from '@/db';
import { useTTS } from '@/hooks/useTTS';
import { useVoiceCapture } from '@/hooks/useVoiceCapture';
import { processWithReasoning } from '@/services/deepseek';
import { getFastResponse } from '@/services/fastchat';
import { transcribeAudio } from '@/services/groq';
import { generateEmbedding, generateEmbeddings } from '@/services/openai';
import { useConversationStore } from '@/store/conversation';
import { useProfileStore } from '@/store/profile';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IntelligenceService } from '@/services/intelligence';
import * as Haptics from '@/utils/haptics';

type AppState = 'idle' | 'listening' | 'processing' | 'speaking';

export function OrbitScreen() {
    const [appState, setAppState] = useState<AppState>('idle');
    const [isKeysConfigured, setIsKeysConfigured] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

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
        pendingSnippets,
        addPendingSnippet,
        removePendingSnippet,
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

    const scrollRef = useRef<ScrollView>(null);
    const insets = useSafeAreaInsets();

    // Initialize database and check API keys
    useEffect(() => {
        const init = async () => {
            try {
                await initDatabase();
                console.log('[App] Database initialized');
            } catch (error) {
                console.error('[App] Database init failed:', error);
            }

            const configured = await areKeysConfigured();
            setIsKeysConfigured(configured);
        };
        init();
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
        }
    }, [appState, voiceCapture, isKeysConfigured]);

    const processAudio = useCallback(async (audioUri: string) => {
        try {
            Haptics.thinking();

            console.log('[Neural Loop] Step 1: Transcribing...');
            setTranscribing(true);
            const { text: transcript } = await transcribeAudio(audioUri);
            setTranscribing(false);
            addUserMessage(transcript);

            setEmbedding(true); // Re-use embedding state for retrieval feedback
            const [queryEmbed, isChattyQuery] = await Promise.all([
                generateEmbedding(transcript, 'text-embedding-3-large', 1536),
                Promise.resolve(
                    transcript.split(' ').length < 15 &&
                    !/will|muss|soll|ziel|plan|merke|notier|fakt|wichtig|wahr|wer|was|erinnerst|weißt/i.test(transcript)
                )
            ]);

            const similarSnippets = await findSimilarSnippets(queryEmbed, 5);
            const context = similarSnippets.map(s => s.content);
            setEmbedding(false);

            console.log('[Neural Loop] Step 3: Neural Path Execution...');
            let finalResponse = '';
            let finalReasoning = '';
            let snippets: any[] = [];

            if (isChattyQuery) {
                console.log('[Neural Loop] Executing Fast Path (Groq)...');
                const fastResponse = await getFastResponse(transcript, currentProfile?.name, context);

                if (fastResponse.toLowerCase().includes('thinking')) {
                    console.log('[Neural Loop] Fast Path suggested reasoning. Switching...');
                    setReasoning(true);
                    const result = await processWithReasoning(transcript, context);
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
                const result = await processWithReasoning(transcript, context);
                finalResponse = result.response;
                finalReasoning = result.reasoning;
                snippets = result.snippets;
                setReasoning(false);
            }

            console.log('[Neural Loop] Step 4: Embedding snippets (Dual-Tier)...');
            setEmbedding(true);
            if (snippets.length > 0) {
                const contents = snippets.map(s => s.content);

                // Generate both tiers for maximum performance/context balance
                const [richEmbeds, fastEmbeds] = await Promise.all([
                    generateEmbeddings(contents, 'text-embedding-3-large', 1536),
                    generateEmbeddings(contents, 'text-embedding-3-small', 384)
                ]);

                for (let i = 0; i < snippets.length; i++) {
                    const snippet = snippets[i];
                    await insertSnippet(
                        snippet.content,
                        snippet.type,
                        richEmbeds[i],
                        fastEmbeds[i],
                        snippet.sentiment,
                        snippet.topic
                    );
                    addPendingSnippet({ type: snippet.type, content: snippet.content });
                }
            }
            setEmbedding(false);

            // Trigger asynchronous community detection
            IntelligenceService.runClustering().catch(e => console.error('[Intelligence] Clustering failed:', e));

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
            {/* Neural Confirmation Overlays */}
            {pendingSnippets.map((snippet) => (
                <NeuralConfirmation
                    key={snippet.id}
                    type={snippet.type}
                    content={snippet.content}
                    onComplete={() => removePendingSnippet(snippet.id)}
                />
            ))}

            <View style={[styles.safeArea, { paddingTop: insets.top }]}>
                {/* Side Menu */}
                <SideMenu
                    isOpen={menuOpen}
                    onClose={() => setMenuOpen(false)}
                    activeRoute="home"
                />

                {/* Minimal Header with Burger */}
                <View style={styles.header}>
                    <BurgerMenuButton onPress={() => setMenuOpen(true)} />
                    <Text style={styles.headerTitle}>Orbit</Text>
                    <View style={styles.statusPill}>
                        <View style={styles.statusDot} />
                        <Text style={styles.statusText}>R1</Text>
                    </View>
                </View>

                {/* Main Content Area */}
                {messages.length === 0 ? (
                    /* Welcome Screen - Centered Layout */
                    <View style={styles.welcomeContainer}>
                        {/* Neural Orb - Visual Center */}
                        <View style={styles.heroOrbWrapper}>
                            <NeuralOrb
                                intensity={tts.intensity}
                                state={getOrbState()}
                                size={200}
                            />
                        </View>

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
                    <ScrollView
                        ref={scrollRef}
                        style={styles.messageList}
                        contentContainerStyle={styles.messageListContent}
                        showsVerticalScrollIndicator={false}
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
                                    {msg.role === 'assistant' && msg.reasoning && (
                                        <View style={styles.reasoningBox}>
                                            <Text style={styles.reasoningLabel}>💭 THOUGHTS</Text>
                                            <Text style={styles.reasoningText}>{msg.reasoning}</Text>
                                        </View>
                                    )}
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
                    </ScrollView>
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
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10b981',
        marginRight: 6,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#10b981',
        letterSpacing: 1,
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
