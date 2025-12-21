/**
 * Hearify Main Screen - Neural AI Companion Interface
 */

import { useProfileStore } from '@/store/profile';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
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

const { width } = Dimensions.get('window');

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

  // TTS is now REST-based, no connection needed

  const handleRecordPress = useCallback(async () => {
    if (!isKeysConfigured) {
      Alert.alert('Setup Required', 'Please configure your API keys in settings');
      return;
    }

    if (appState === 'idle') {
      // Start recording
      try {
        Haptics.listening();
        await voiceCapture.startRecording();
        setAppState('listening');
      } catch (error) {
        console.error('[App] Recording failed:', error);
        Alert.alert('Error', 'Failed to start recording');
      }
    } else if (appState === 'listening') {
      // Stop recording and process
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

      // 1. Transcribe audio (Core Input Helix)
      console.log('[Neural Loop] Step 1: Transcribing...');
      setTranscribing(true);
      const { text: transcript } = await transcribeAudio(audioUri);
      setTranscribing(false);
      addUserMessage(transcript);

      // 2. CONCURRENT PRE-FETCHING (The 47x Move)
      // Start embedding the query and retrieving context BEFORE we even decide the LLM path
      console.log('[Neural Loop] Step 2: Concurrent Context Retrieval...');

      // Parallel execution of Embedding + Initial Search determination
      const [queryEmbed, isChattyQuery] = await Promise.all([
        generateEmbedding(transcript),
        Promise.resolve(transcript.split(' ').length < 40)
      ]);

      // JSI-Powered Vector Search (Native Speed)
      const similarSnippets = await findSimilarSnippets(queryEmbed, 3);
      const context = similarSnippets.map(s => s.content);

      // 3. Neural Path Determination
      console.log('[Neural Loop] Step 3: Neural Path Execution...');
      let finalResponse = '';
      let snippets: any[] = [];

      if (isChattyQuery) {
        // Fast Path (Groq / FastChat)
        console.log('[Neural Loop] Executing Fast Path (Groq)...');
        const fastResponse = await getFastResponse(transcript, currentProfile?.name);

        if (fastResponse.toLowerCase().includes('thinking')) {
          console.log('[Neural Loop] Fast Path suggested reasoning. Switching...');
          setReasoning(true);
          const result = await processWithReasoning(transcript, context);
          finalResponse = result.response;
          snippets = result.snippets;
          setReasoning(false);
        } else {
          finalResponse = fastResponse;
        }
      } else {
        // Deep Reasoning Path (DeepSeek R1)
        console.log('[Neural Loop] Executing Reasoning Path (DeepSeek)...');
        setReasoning(true);
        const result = await processWithReasoning(transcript, context);
        finalResponse = result.response;
        snippets = result.snippets;
        setReasoning(false);
      }

      // 4. Generate embeddings for new snippets
      console.log('[Neural Loop] Step 4: Embedding snippets...');
      setEmbedding(true);
      if (snippets.length > 0) {
        const contents = snippets.map(s => s.content);
        const embeddings = await generateEmbeddings(contents);

        // 5. Store in local database & Trigger Confirmation UI
        for (let i = 0; i < snippets.length; i++) {
          const snippet = snippets[i];
          await insertSnippet(snippet.content, snippet.type, embeddings[i]);

          // Trigger the 'Neural Confirmation'
          addPendingSnippet({ type: snippet.type, content: snippet.content });
        }
      }
      setEmbedding(false);

      // 6. Speak response
      console.log('[Neural Loop] Step 5: Speaking...');
      Haptics.speaking();
      addAIResponse(finalResponse);
      setAppState('speaking');
      setSpeaking(true);
      try {
        await tts.speak(finalResponse);
      } catch (ttsError) {
        console.error('[Neural Loop] TTS failed but continuing:', ttsError);
      }

      // Done
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

  const getStatusText = () => {
    if (appState === 'listening') return 'Listening...';
    if (isTranscribing) return 'Transcribing Audio...';
    if (isReasoning) return 'Neural Reasoning...';
    if (isEmbedding) return 'Updating Memory...';
    if (isSpeaking) return 'Speaking...';
    return isKeysConfigured ? 'Neural System Online' : 'Setup Required';
  };

  const getButtonText = () => {
    if (appState === 'listening') return 'Stop';
    if (appState === 'processing') return 'Processing';
    if (appState === 'speaking') return 'Speaking';
    return 'Record';
  };

  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a0a0f', '#1a1a2e', '#09090b']}
        style={StyleSheet.absoluteFill}
      />

      {/* Neural Confirmation Overlays */}
      {pendingSnippets.map((snippet) => (
        <NeuralConfirmation
          key={snippet.id}
          type={snippet.type}
          content={snippet.content}
          onComplete={() => removePendingSnippet(snippet.id)}
        />
      ))}

      <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>Hearify</Text>
            <View style={styles.onlineBadge}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>R1 REASONING ACTIVE</Text>
            </View>
          </View>
          <Link href="/explore" asChild>
            <TouchableOpacity style={styles.settingsButton}>
              <BlurView intensity={20} style={styles.settingsBlur}>
                <Text style={styles.settingsText}>Settings</Text>
              </BlurView>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Conversation history */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.conversation}
          contentContainerStyle={styles.conversationContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <Animated.View
              entering={FadeInUp.delay(300)}
              style={styles.emptyState}
            >
              <Text style={styles.emptyText}>Neural Companion</Text>
              <Text style={styles.emptyHint}>I process, remember, and reason for you.</Text>
            </Animated.View>
          ) : (
            messages.map((msg, index) => (
              <Animated.View
                key={msg.id}
                entering={FadeInDown.springify().damping(15)}
                style={[
                  styles.messageWrapper,
                  msg.role === 'user' ? styles.userMessageWrapper : styles.aiMessageWrapper,
                ]}
              >
                <BlurView
                  intensity={msg.role === 'user' ? 40 : 25}
                  tint="dark"
                  style={[
                    styles.messageBlur,
                    msg.role === 'user' ? styles.userMessageBlur : styles.aiMessageBlur,
                  ]}
                >
                  {msg.role === 'assistant' && (
                    <Text style={styles.assistantLabel}>HEARIFY AI</Text>
                  )}
                  <Text style={styles.messageText}>{msg.content}</Text>
                </BlurView>
              </Animated.View>
            ))
          )}
          {isReasoning && (
            <Animated.View
              entering={FadeInDown}
              style={[styles.messageWrapper, styles.aiMessageWrapper]}
            >
              <BlurView intensity={15} tint="dark" style={[styles.messageBlur, styles.aiMessageBlur, styles.thinkingBlur]}>
                <ActivityIndicator size="small" color="#6366f1" style={{ marginRight: 10 }} />
                <Text style={styles.thinkingText}>Thinking...</Text>
              </BlurView>
            </Animated.View>
          )}
        </ScrollView>

        {/* Status Area */}
        <View style={styles.statusArea}>
          <View style={styles.orbWrapper}>
            <NeuralOrb
              intensity={tts.intensity}
              state={getOrbState()}
            />
            {appState === 'processing' && (
              <View style={styles.processingDetails}>
                <ActivityIndicator color="#6366f1" size="small" />
              </View>
            )}
          </View>
          <Text style={styles.statusLabel}>{getStatusText()}</Text>
        </View>

        {/* Footer Area */}
        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleRecordPress}
            disabled={appState === 'processing' || appState === 'speaking'}
          >
            <Animated.View
              style={[
                styles.recordButton,
                appState === 'listening' && styles.recordButtonActive,
                (appState === 'processing' || appState === 'speaking') && styles.recordButtonDisabled,
                animatedButtonStyle,
              ]}
            >
              {appState === 'listening' ? (
                <View style={styles.stopIcon} />
              ) : appState === 'processing' || appState === 'speaking' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.micIcon} />
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
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
  },
  logo: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  onlineText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  settingsButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  settingsBlur: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  settingsText: {
    color: '#ddd',
    fontSize: 14,
    fontWeight: '600',
  },
  conversation: {
    flex: 1,
  },
  conversationContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  emptyState: {
    paddingTop: 100,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    opacity: 0.9,
    marginBottom: 12,
    letterSpacing: -1,
  },
  emptyHint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  messageWrapper: {
    marginBottom: 16,
    maxWidth: '85%',
  },
  userMessageWrapper: {
    alignSelf: 'flex-end',
  },
  aiMessageWrapper: {
    alignSelf: 'flex-start',
  },
  messageBlur: {
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  userMessageBlur: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderBottomRightRadius: 4,
  },
  aiMessageBlur: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderBottomLeftRadius: 4,
  },
  assistantLabel: {
    color: '#6366f1',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  thinkingBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  thinkingText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  statusArea: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  orbWrapper: {
    position: 'relative',
    height: 160,
    width: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingDetails: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  statusLabel: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 10,
  },
  footer: {
    paddingBottom: 30,
    alignItems: 'center',
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  recordButtonActive: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    transform: [{ scale: 1.1 }],
  },
  recordButtonDisabled: {
    backgroundColor: '#222',
    opacity: 0.5,
    shadowOpacity: 0,
  },
  micIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  stopIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
});
