/**
 * Neural Canvas Component
 * 
 * An infinite, 2D/3D-accelerated spatial memory map using React Native Skia.
 * Each memory snippet is rendered as an "Energy Node" with organic shader effects.
 */

import {
    Canvas,
    Circle,
    Group,
    Shader,
    Skia
} from '@shopify/react-native-skia';
import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import {
    Gesture,
    GestureDetector,
    GestureHandlerRootView
} from 'react-native-gesture-handler';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
} from 'react-native-reanimated';
import { getAllSnippets } from '../db';
import { Snippet } from '../db/schema';

const { width, height } = Dimensions.get('window');

// Neural Node Shader - More complex plasma energy
const nodeShader = Skia.RuntimeEffect.Make(`
  uniform float time;
  uniform vec3 color;
  uniform float intensity;

  half4 main(vec2 fragCoord) {
    vec2 center = vec2(30.0, 30.0);
    float d = length(fragCoord - center);
    
    // Core energy
    float core = exp(-d * 0.2) * 1.5;
    
    // Outer plasma glow
    float glow = exp(-d * 0.1) * 0.5;
    
    // Subtle turbulence
    float turbulence = sin(d * 0.5 - time * 3.0) * 0.1;
    
    float final = (core + glow + turbulence) * intensity;
    float pulse = 0.9 + 0.1 * sin(time * 2.5);
    
    return half4(color * final * pulse, final * 0.8);
  }
`)!;

interface NodeData extends Snippet {
    x: number;
    y: number;
    color: number[];
}

export function NeuralCanvas() {
    const [nodes, setNodes] = useState<NodeData[]>([]);

    // Canvas Transform State
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);
    const time = useSharedValue(0);

    // Load nodes from DB
    useEffect(() => {
        const load = async () => {
            try {
                const data = await getAllSnippets();
                const processed = data.map((n, i) => ({
                    ...n,
                    // Semantic-ish layout: use ID or timestamp to seed positions
                    x: (Math.sin(n.id * 10) * 800) + (Math.random() * 50),
                    y: (Math.cos(n.id * 10) * 800) + (Math.random() * 50),
                    color: n.type === 'goal' ? [0.4, 0.4, 1.0] : n.type === 'feeling' ? [0.8, 0.4, 1.0] : [0.4, 1.0, 0.7]
                }));
                setNodes(processed);
            } catch (e) {
                console.error('[Canvas] Failed to load snippets:', e);
            }
        };
        load();
    }, []);

    // Animate shader time
    useEffect(() => {
        let frameId: number;
        const animate = () => {
            time.value += 0.016;
            frameId = requestAnimationFrame(animate);
        };
        frameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frameId);
    }, []);

    // Gestures
    const panGesture = Gesture.Pan()
        .onUpdate((e) => {
            translateX.value += e.changeX / scale.value;
            translateY.value += e.changeY / scale.value;
        });

    const pinchGesture = Gesture.Pinch()
        .onUpdate((e) => {
            scale.value *= e.scaleChange;
        });

    const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

    const animatedCanvasStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value * scale.value },
            { translateY: translateY.value * scale.value },
            { scale: scale.value }
        ]
    }));

    return (
        <GestureHandlerRootView style={styles.container}>
            <GestureDetector gesture={composedGesture}>
                <Animated.View style={[styles.canvasWrapper, animatedCanvasStyle]}>
                    <Canvas style={styles.canvas}>
                        {nodes.map((node) => (
                            <Group key={node.id} transform={[{ translateX: node.x + width / 2 - 30 }, { translateY: node.y + height / 2 - 30 }]}>
                                <Shader
                                    source={nodeShader}
                                    uniforms={{
                                        time: time.value,
                                        color: node.color,
                                        intensity: 1.2
                                    }}
                                />
                                <Circle
                                    cx={30}
                                    cy={30}
                                    r={30}
                                />
                            </Group>
                        ))}
                    </Canvas>
                </Animated.View>
            </GestureDetector>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    canvasWrapper: {
        flex: 1,
    },
    canvas: {
        flex: 1,
    }
});
