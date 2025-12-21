/**
 * Settings screen for API key configuration
 * 
 * Dev notes:
 * - SecureTextEntry for API keys
 * - Validates and saves to MMKV
 */

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    areKeysConfigured,
    getAllKeys,
    setDeepSeekKey,
    setElevenLabsKey,
    setGroqKey,
    setOpenAIKey,
} from '../config/api';

export function SettingsScreen() {
    const [groqKey, setLocalGroqKey] = useState('');
    const [deepseekKey, setLocalDeepSeekKey] = useState('');
    const [openaiKey, setLocalOpenAIKey] = useState('');
    const [elevenLabsKey, setLocalElevenLabsKey] = useState('');
    const [isConfigured, setIsConfigured] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    React.useEffect(() => {
        const loadKeys = async () => {
            setIsLoading(true);
            try {
                const keys = await getAllKeys();
                setLocalGroqKey(keys.groq || '');
                setLocalDeepSeekKey(keys.deepseek || '');
                setLocalOpenAIKey(keys.openai || '');
                setLocalElevenLabsKey(keys.elevenlabs || '');

                const configured = await areKeysConfigured();
                setIsConfigured(configured);
            } catch (error) {
                console.error('Failed to load keys:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadKeys();
    }, []);

    const handleSave = async () => {
        if (!groqKey || !deepseekKey || !openaiKey || !elevenLabsKey) {
            Alert.alert('Missing Keys', 'Please enter all API keys');
            return;
        }

        try {
            await setGroqKey(groqKey);
            await setDeepSeekKey(deepseekKey);
            await setOpenAIKey(openaiKey);
            await setElevenLabsKey(elevenLabsKey);

            const configured = await areKeysConfigured();
            setIsConfigured(configured);

            Alert.alert('Success', 'API keys saved successfully');
        } catch (error) {
            Alert.alert('Error', 'Failed to save API keys');
            console.error(error);
        }
    };

    const insets = useSafeAreaInsets();

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#0a0a0f', '#09090b']}
                style={StyleSheet.absoluteFill}
            />
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.contentContainer,
                    { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }
                ]}
            >
                <Text style={styles.title}>Neural Settings</Text>
                <Text style={styles.subtitle}>
                    Configure your API keys to authorize Hearify's advanced R1 reasoning and voice synthesis.
                </Text>

                {isConfigured && (
                    <BlurView intensity={20} tint="dark" style={styles.badge}>
                        <Text style={styles.badgeText}>✓ Neural System Fully Authorized</Text>
                    </BlurView>
                )}

                <View style={styles.section}>
                    <Text style={styles.label}>Groq API Key</Text>
                    <Text style={styles.hint}>Ultra-fast Whisper-V3-Turbo transcription</Text>
                    <TextInput
                        style={styles.input}
                        value={groqKey}
                        onChangeText={setLocalGroqKey}
                        placeholder="gsk_..."
                        placeholderTextColor="#444"
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>DeepSeek API Key</Text>
                    <Text style={styles.hint}>R1 Reasoning and snippet extraction</Text>
                    <TextInput
                        style={styles.input}
                        value={deepseekKey}
                        onChangeText={setLocalDeepSeekKey}
                        placeholder="sk-..."
                        placeholderTextColor="#444"
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>OpenAI API Key</Text>
                    <Text style={styles.hint}>Neural Vector Embeddings</Text>
                    <TextInput
                        style={styles.input}
                        value={openaiKey}
                        onChangeText={setLocalOpenAIKey}
                        placeholder="sk-..."
                        placeholderTextColor="#444"
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>ElevenLabs API Key</Text>
                    <Text style={styles.hint}>Flash v2.5 low-latency voice synthesis</Text>
                    <TextInput
                        style={styles.input}
                        value={elevenLabsKey}
                        onChangeText={setLocalElevenLabsKey}
                        placeholder="..."
                        placeholderTextColor="#444"
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.button, isLoading && styles.buttonDisabled]}
                    onPress={handleSave}
                    disabled={isLoading}
                >
                    <Text style={styles.buttonText}>
                        {isLoading ? 'Saving...' : 'Authorize Neural System'}
                    </Text>
                </TouchableOpacity>

                <Text style={styles.footer}>
                    Keys are encrypted and stored locally using Expo SecureStore.
                </Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 24,
    },
    title: {
        fontSize: 36,
        fontWeight: '900',
        color: '#fff',
        marginBottom: 8,
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 15,
        color: '#888',
        marginBottom: 24,
        lineHeight: 22,
    },
    badge: {
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        padding: 16,
        borderRadius: 12,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: 'rgba(74, 222, 128, 0.2)',
    },
    badgeText: {
        color: '#4ade80',
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    section: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    hint: {
        fontSize: 12,
        color: '#555',
        marginBottom: 10,
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: '#222',
        borderRadius: 12,
        padding: 16,
        color: '#fff',
        fontSize: 15,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    button: {
        backgroundColor: '#6366f1',
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 24,
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    buttonDisabled: {
        backgroundColor: '#222',
        opacity: 0.7,
        shadowOpacity: 0,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    footer: {
        fontSize: 11,
        color: '#444',
        textAlign: 'center',
        marginBottom: 40,
        lineHeight: 18,
    },
});
