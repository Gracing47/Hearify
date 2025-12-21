import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NeuralCanvas } from '../../components/NeuralCanvas';

export default function CanvasScreen() {
    const insets = useSafeAreaInsets();

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#0a0a0f', '#1a1a2e', '#09090b']}
                style={StyleSheet.absoluteFill}
            />

            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <Text style={styles.title}>Neural Horizon</Text>
                <Text style={styles.subtitle}>Your spatial memory map</Text>
            </View>

            <NeuralCanvas />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 24,
        zIndex: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 12,
        color: '#6366f1',
        fontWeight: '600',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginTop: 4,
    }
});
