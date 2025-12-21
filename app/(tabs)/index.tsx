/**
 * Hearify Main Screen - Neural AI Companion Interface
 */

import { useProfileStore } from '@/store/profile';
import { Link } from 'expo-router';
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
import { NeuralConfirmation } from '../../components/NeuralConfirmation';
import { NeuralOrb } from '../../components/NeuralOrb';
import { areKeysConfigured } from '../../config/api';
import { findSimilarSnippets, initDatabase, insertSnippet } from '../../db';
import { useTTS } from '../../hooks/useTTS';
import { useVoiceCapture } from '../../hooks/useVoiceCapture';
import { processWithReasoning } from '../../services/deepseek';
import { getFastResponse } from '../../services/fastchat';
import { transcribeAudio } from '../../services/groq';
import { generateEmbedding, generateEmbeddings } from '../../services/openai';
import { useConversationStore } from '../../store/conversation';
import * as Haptics from '../../utils/haptics';

type AppState = 'idle' | 'listening' | 'processing' | 'speaking';

export default function HomeScreen() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [isKeysConfigured, setIsKeysConfigured] = useState(false);

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

      console.log('[Neural Loop] Step 2: Concurrent Context Retrieval...');

      const [queryEmbed, isChattyQuery] = await Promise.all([
        generateEmbedding(transcript),
        Promise.resolve(
          transcript.split(' ').length < 15 &&
          !/will|muss|soll|ziel|plan|merke|notier|fakt|wichtig|wahr/i.test(transcript)
        )
      ]);

      const similarSnippets = await findSimilarSnippets(queryEmbed, 3);
      const context = similarSnippets.map(s => s.content);

      console.log('[Neural Loop] Step 3: Neural Path Execution...');
      let finalResponse = '';
      let finalReasoning = '';
      let snippets: any[] = [];

      if (isChattyQuery) {
        console.log('[Neural Loop] Executing Fast Path (Groq)...');
        const fastResponse = await getFastResponse(transcript, currentProfile?.name);

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

      console.log('[Neural Loop] Step 4: Embedding snippets...');
      setEmbedding(true);
      if (snippets.length > 0) {
        const contents = snippets.map(s => s.content);
        const embeddings = await generateEmbeddings(contents);

        for (let i = 0; i < snippets.length; i++) {
          const snippet = snippets[i];
          await insertSnippet(snippet.content, snippet.type, embeddings[i]);
          addPendingSnippet({ type: snippet.type, content: snippet.content });
        }
      }
      setEmbedding(false);

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
        {/* Minimal Header */}
        <View style={styles.header}>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>R1 ACTIVE</Text>
          </View>
          <Text style={styles.headerTitle}>Hearify</Text>
          <Link href="/explore" asChild>
            <TouchableOpacity style={styles.settingsButton}>
              <Text style={styles.settingsIcon}>⚙️</Text>
            </TouchableOpacity>
          </Link>
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
                  <ActivityIndicator size="small" color="#6366f1" />
                  <Text style={styles.thinkingText}>Denke nach...</Text>
                </View>
              </Animated.View>
            )}
          </ScrollView>
        )}

        {/* Floating Input Bar */}
        <View style={[styles.inputBar, { bottom: insets.bottom + 70 }]}>
          <View style={styles.inputField}>
            <Text style={styles.inputPlaceholder}>
              {appState === 'listening' ? '🔴 Ich höre...' :
                appState === 'processing' ? '⏳ Verarbeite...' :
                  appState === 'speaking' ? '🔊 Spreche...' :
                    'Sprich mit mir...'}
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
            activeOpacity={0.7}
          >
            <Animated.View style={animatedButtonStyle}>
              {appState === 'listening' ? (
                <View style={styles.stopIcon} />
              ) : appState === 'processing' || appState === 'speaking' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.micEmoji}>🎤</Text>
              )}
            </Animated.View>
          </TouchableOpacity>
        </View>
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
  settingsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    fontSize: 20,
  },
  // Welcome Screen - Centered Orb Layout
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: -60, // Shift content up slightly for visual balance
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
  messageWrapper: {
    maxWidth: '85%',
  },
  userMessageWrapper: {
    alignSelf: 'flex-end',
  },
  aiMessageWrapper: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  userBubble: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  aiBubble: {
    backgroundColor: '#1A1A1A',
  },
  reasoningBox: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  reasoningLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366f1',
    marginBottom: 6,
  },
  reasoningText: {
    fontSize: 13,
    color: '#888',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  messageText: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 24,
  },
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  thinkingText: {
    color: '#888',
    fontSize: 14,
  },
  // Floating Input Bar
  inputBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderRadius: 28,
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  inputField: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  inputPlaceholder: {
    fontSize: 15,
    color: '#666',
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  micButtonActive: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
  },
  micButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.6,
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
