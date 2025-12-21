/**
 * Onboarding Screen - First-time user experience
 * 
 * Creates a "curious but safe" environment for new users.
 * Collects minimal data: just a name and optional avatar.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfileStore } from '../store/profile';

const AVATAR_OPTIONS = ['🧠', '✨', '🌌', '🔮', '💎', '🌙', '⚡', '🎯'];

export default function OnboardingScreen() {
    const [name, setName] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState('🧠');
    const [isCreating, setIsCreating] = useState(false);

    const { createProfile, completeOnboarding } = useProfileStore();
    const insets = useSafeAreaInsets();

    const handleContinue = async () => {
        if (!name.trim() || isCreating) return;

        setIsCreating(true);
        try {
            await createProfile(name.trim(), selectedAvatar);
            await completeOnboarding();
            router.replace('/(tabs)');
        } catch (error) {
            console.error('[Onboarding] Failed to create profile:', error);
            setIsCreating(false);
        }
    };

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.container}>
                <LinearGradient
                    colors={['#0a0a0f', '#1a1a2e', '#09090b']}
                    style={StyleSheet.absoluteFill}
                />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={[styles.content, { paddingTop: insets.top + 60 }]}
                >
                    {/* Welcome Message */}
                    <Animated.View entering={FadeInUp.delay(200)} style={styles.header}>
                        <Text style={styles.welcomeEmoji}>🌌</Text>
                        <Text style={styles.title}>Willkommen bei Hearify</Text>
                        <Text style={styles.subtitle}>
                            Dein persönliches Gedächtnis-Universum.{'\n'}
                            Alles was du sagst, wird ein Stern in deinem Raum.
                        </Text>
                    </Animated.View>

                    {/* Avatar Selection */}
                    <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
                        <Text style={styles.label}>Wähle dein Symbol</Text>
                        <View style={styles.avatarGrid}>
                            {AVATAR_OPTIONS.map((emoji) => (
                                <TouchableOpacity
                                    key={emoji}
                                    style={[
                                        styles.avatarOption,
                                        selectedAvatar === emoji && styles.avatarSelected
                                    ]}
                                    onPress={() => setSelectedAvatar(emoji)}
                                >
                                    <Text style={styles.avatarEmoji}>{emoji}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Animated.View>

                    {/* Name Input */}
                    <Animated.View entering={FadeInDown.delay(600)} style={styles.section}>
                        <Text style={styles.label}>Wie soll ich dich nennen?</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Dein Name..."
                            placeholderTextColor="#666"
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="words"
                            autoCorrect={false}
                            maxLength={20}
                        />
                    </Animated.View>

                    {/* Continue Button */}
                    <Animated.View entering={FadeInDown.delay(800)} style={styles.footer}>
                        <TouchableOpacity
                            style={[
                                styles.continueButton,
                                (!name.trim() || isCreating) && styles.continueButtonDisabled
                            ]}
                            onPress={handleContinue}
                            disabled={!name.trim() || isCreating}
                        >
                            <Text style={styles.continueText}>
                                {isCreating ? 'Erstelle dein Universum...' : 'Los geht\'s'}
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                </KeyboardAvoidingView>
            </View>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    welcomeEmoji: {
        fontSize: 64,
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fff',
        textAlign: 'center',
        letterSpacing: -0.5,
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: '#888',
        textAlign: 'center',
        lineHeight: 24,
    },
    section: {
        marginBottom: 32,
    },
    label: {
        fontSize: 14,
        color: '#6366f1',
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 16,
    },
    avatarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12,
    },
    avatarOption: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    avatarSelected: {
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
    },
    avatarEmoji: {
        fontSize: 28,
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 16,
        fontSize: 18,
        color: '#fff',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    footer: {
        marginTop: 'auto',
        paddingBottom: 40,
    },
    continueButton: {
        backgroundColor: '#6366f1',
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    continueButtonDisabled: {
        backgroundColor: '#333',
        shadowOpacity: 0,
    },
    continueText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
});
