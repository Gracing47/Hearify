import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useLensStore } from '../store/lensStore';

const MODES = [
    { id: 'EXPLORE', label: 'Explore', icon: 'compass', color: '#818cf8' },
    { id: 'LEARN', label: 'Learn', icon: 'book', color: '#00F0FF' },
    { id: 'STRATEGY', label: 'Strategy', icon: 'flag', color: '#FFD700' },
    { id: 'REFLECT', label: 'Reflect', icon: 'heart', color: '#FF0055' },
] as const;

export const NeuralLensesHUD = () => {
    const { mode, setMode } = useLensStore();

    const handlePress = (newMode: typeof MODES[number]['id']) => {
        Haptics.selectionAsync();
        setMode(newMode);
    };

    return (
        <Animated.View entering={FadeInDown.delay(300)} style={styles.container}>
            <BlurView intensity={30} tint="dark" style={styles.blurContainer}>
                <View style={styles.glassBorder} />

                {MODES.map((m) => {
                    const isActive = mode === m.id;

                    return (
                        <TouchableOpacity
                            key={m.id}
                            onPress={() => handlePress(m.id)}
                            style={[styles.button, isActive && { backgroundColor: `${m.color}15` }]}
                            activeOpacity={0.7}
                        >
                            <View style={[
                                styles.iconContainer,
                                isActive && { backgroundColor: `${m.color}30` }
                            ]}>
                                <Ionicons
                                    name={isActive ? m.icon : `${m.icon}-outline` as any}
                                    size={22}
                                    color={isActive ? m.color : '#888'}
                                />
                            </View>

                            {isActive && (
                                <Text style={[styles.label, { color: m.color }]}>
                                    {m.label}
                                </Text>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </BlurView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        alignItems: 'center',
        zIndex: 9999,
        elevation: 999, // Android
    },
    blurContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(10, 10, 12, 0.6)',
        borderRadius: 32,
        padding: 6,
        paddingHorizontal: 12,
        overflow: 'hidden',
        borderCurve: 'continuous', // iOS smooth corners
        gap: 8,
    },
    glassBorder: {
        ...StyleSheet.absoluteFillObject,
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderRadius: 32,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 24,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 8,
        letterSpacing: 0.5,
    }
});
