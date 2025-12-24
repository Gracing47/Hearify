import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfileStore } from '../store/profile';

export default function OnboardingScreen() {
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const insets = useSafeAreaInsets();
    const { createProfile, completeOnboarding } = useProfileStore();

    const handleStart = async () => {
        if (!name.trim()) return;

        setIsSubmitting(true);
        try {
            await createProfile(name.trim(), '🧠');
            await completeOnboarding();
            // Routing is handled automatically by RootLayout
        } catch (error) {
            console.error('[Onboarding] Failed to create profile:', error);
            setIsSubmitting(false);
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#0a0a0f', '#000']}
                style={StyleSheet.absoluteFill}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.content}
            >
                <Animated.View entering={FadeIn.duration(1000)} style={styles.heroSection}>
                    <View style={styles.orbPlaceholder}>
                        <LinearGradient
                            colors={['#6366f1', '#a855f7']}
                            style={styles.orb}
                        />
                    </View>
                    <Text style={styles.title}>Hearify</Text>
                    <Text style={styles.subtitle}>Your Neural Architecture begins here.</Text>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.formSection}>
                    <BlurView intensity={20} tint="dark" style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="How shall I call you?"
                            placeholderTextColor="rgba(255, 255, 255, 0.3)"
                            value={name}
                            onChangeText={setName}
                            autoFocus
                        />
                    </BlurView>

                    <TouchableOpacity
                        style={[styles.button, !name.trim() && styles.buttonDisabled]}
                        onPress={handleStart}
                        disabled={!name.trim() || isSubmitting}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>Initialize Consciousness</Text>
                        )}
                    </TouchableOpacity>
                </Animated.View>

                <View style={[styles.footer, { marginBottom: insets.bottom + 20 }]}>
                    <Text style={styles.footerText}>Phase 2 Engine: Native Vector Search Enabled</Text>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    content: {
        flex: 1,
        paddingHorizontal: 32,
        justifyContent: 'center',
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: 60,
    },
    orbPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        marginBottom: 24,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    orb: {
        width: '100%',
        height: '100%',
        borderRadius: 60,
        opacity: 0.8,
    },
    title: {
        fontSize: 42,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginTop: 8,
        textAlign: 'center',
    },
    formSection: {
        width: '100%',
    },
    inputContainer: {
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: 16,
        paddingHorizontal: 20,
        height: 64,
        justifyContent: 'center',
        overflow: 'hidden',
    },
    input: {
        fontSize: 18,
        color: '#fff',
        fontWeight: '500',
    },
    button: {
        height: 64,
        borderRadius: 20,
        backgroundColor: '#6366f1',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
    },
    buttonDisabled: {
        backgroundColor: '#222',
        shadowOpacity: 0,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 10,
        color: 'rgba(255, 255, 255, 0.2)',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        fontWeight: '700',
    },
});
