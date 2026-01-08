/**
 * Horizon Screen - Neural Horizon v2.1
 * 
 * The Graph View - Always interactive (zoom, pan, tap nodes)
 */

import { NeuralCanvas } from '@/components/NeuralCanvas';
import { NeuralLensesHUD } from '@/components/NeuralLensesHUD';
import { useContextStore } from '@/store/contextStore';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import Animated, {
    FadeIn,
    SharedValue,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface HorizonScreenProps {
    layoutY?: SharedValue<number>;
    cameraZ?: SharedValue<number>;
}

export function HorizonScreen({ layoutY, cameraZ }: HorizonScreenProps) {
    const insets = useSafeAreaInsets();
    const focusNodeId = useContextStore(state => state.focusNodeId);

    // Animated pulse for the "LIVE" indicator
    const pulseOpacity = useSharedValue(1);

    useEffect(() => {
        pulseOpacity.value = withRepeat(
            withSequence(
                withTiming(0.3, { duration: 1000 }),
                withTiming(1, { duration: 1000 })
            ),
            -1,
            true
        );
    }, []);

    // Handle focus node from Chronicle "Plan" action
    useEffect(() => {
        if (focusNodeId !== null) {
            console.log(`[Horizon] Focusing on node ${focusNodeId} from Chronicle Plan action`);
            
            // Clear focus after handling to prevent re-triggering
            // NeuralCanvas will handle the actual camera movement and highlight
            const timer = setTimeout(() => {
                useContextStore.getState().setFocusNode(null);
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [focusNodeId]);

    const pulseStyle = useAnimatedStyle(() => ({
        opacity: pulseOpacity.value,
    }));

    return (
        <View style={styles.container}>
            {/* Deep Space Gradient - pointerEvents='none' allows touches to pass through */}
            <LinearGradient
                colors={['#06060a', '#0d0d1a', '#0a0a12', '#000000']}
                locations={[0, 0.3, 0.7, 1]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
            />

            {/* The Neural Canvas (Full Screen, Always Interactive) */}
            <NeuralCanvas layoutY={layoutY} cameraZ={cameraZ} />

            {/* 🧠 NEURAL LENSES HUD */}
            <NeuralLensesHUD />

            <StatusBar hidden />

            {/* Top Bar - Title + Status */}
            <Animated.View
                entering={FadeIn.duration(600)}
                style={[styles.topBar, { paddingTop: insets.top + 8 }]}
                pointerEvents="box-none"
            >
                <View style={styles.titleSection}>
                    <Text style={styles.title}>Horizon</Text>
                    <Animated.View style={[styles.liveIndicator, pulseStyle]}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>LIVE</Text>
                    </Animated.View>
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 24,
        paddingBottom: 20,
        zIndex: 100,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    titleSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: -0.5,
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.3)',
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#6366f1',
    },
    liveText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#6366f1',
        letterSpacing: 1,
    },
});
