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
    Skia,
    Line as SkiaLine
} from '@shopify/react-native-skia';
import React, { useEffect, useState } from 'react';
import { Animated, Dimensions, StyleSheet } from 'react-native';
import {
    Gesture,
    GestureDetector,
    GestureHandlerRootView
} from 'react-native-gesture-handler';
import {
    useAnimatedStyle,
    useFrameCallback,
    useSharedValue,
} from 'react-native-reanimated';
import { getAllSnippets, initDatabase } from '../db';
import { Snippet } from '../db/schema';

const { width, height } = Dimensions.get('window');

// Neural Glass SKSL Shader - Obsidian Void 2.0 (Award-Winning Edition)
const nodeShader = Skia.RuntimeEffect.Make(`
  uniform float u_time;
  uniform vec2 u_resolution; // Size of the node container
  uniform float u_intensity; // Linked to audio/similarity scores
  
  vec3 neuralIndigo = vec3(0.388, 0.4, 0.945); // #6366F1
  vec3 energyTeal = vec3(0.078, 0.945, 0.584);  // #14F195

  float sdCircle(vec2 p, float r) {
      return length(p) - r;
  }

  half4 main(vec2 pos) {
      vec2 center = u_resolution * 0.5;
      float radius = u_resolution.x * 0.45;
      
      // Distance to circle SDF
      float d = sdCircle(pos - center, radius * u_intensity);
      
      // 1. Organic Plasma Distortion
      float noise = sin(pos.x * 0.05 + u_time * 2.0) * cos(pos.y * 0.05 + u_time * 2.0);
      vec2 distortedPos = pos + noise * 10.0;
      
      // 2. Chromatic Aberration
      float rChannel = smoothstep(1.0, 0.0, sdCircle(distortedPos - center - vec2(2.0, 0.0), radius));
      float gChannel = smoothstep(1.0, 0.0, sdCircle(distortedPos - center, radius));
      float bChannel = smoothstep(1.0, 0.0, sdCircle(distortedPos - center + vec2(2.0, 0.0), radius));
      
      // 3. Refraction & Fresnel Edge
      float edge = 1.0 - smoothstep(0.0, 5.0, abs(d));
      float innerGlow = smoothstep(radius, 0.0, length(pos - center));
      
      vec3 color = vec3(rChannel, gChannel, bChannel);
      color *= neuralIndigo;
      
      // Intensity-based bloom
      color += edge * energyTeal * u_intensity;
      
      // 4. Obsidian Void Masking
      float alpha = smoothstep(2.0, -2.0, d);
      
      return half4(color * (innerGlow + 0.5), alpha * 0.9);
  }
`)!;

interface NodeData extends Snippet {
    color: number[];
}

export function NeuralCanvas() {
    const [nodes, setNodes] = useState<NodeData[]>([]);

    // Canvas Transform State
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);
    const time = useSharedValue(0);

    // High-performance Frame Loop
    useFrameCallback((info) => {
        time.value = (info.timestamp / 1000) % 1000;
    });

    // Load nodes from DB
    useEffect(() => {
        const load = async () => {
            try {
                // Ensure DB is ready
                await initDatabase();
                const data = await getAllSnippets();
                const processed = data.map((n) => ({
                    ...n,
                    // Use stored coordinates or fallback to semi-random spread
                    x: n.x || (Math.sin(n.id * 10) * 800) + (Math.random() * 50),
                    y: n.y || (Math.cos(n.id * 10) * 800) + (Math.random() * 50),
                    color: n.type === 'goal' ? [0.4, 0.4, 1.0] : n.type === 'feeling' ? [0.8, 0.4, 1.0] : [0.4, 1.0, 0.7]
                }));
                setNodes(processed);
            } catch (e) {
                console.error('[Canvas] Failed to load snippets:', e);
            }
        };
        load();
    }, []);

    // Gestures
    let lastTranslateX = 0;
    let lastTranslateY = 0;
    let lastScale = 1;

    const panGesture = Gesture.Pan()
        .onBegin(() => {
            lastTranslateX = translateX.value;
            lastTranslateY = translateY.value;
        })
        .onUpdate((e) => {
            translateX.value = lastTranslateX + e.translationX / scale.value;
            translateY.value = lastTranslateY + e.translationY / scale.value;
        });

    const pinchGesture = Gesture.Pinch()
        .onBegin(() => {
            lastScale = scale.value;
        })
        .onUpdate((e) => {
            scale.value = lastScale * e.scale;
        });

    // Node Interaction
    const activeNodeId = useSharedValue<number | null>(null);
    const nodeDragX = useSharedValue(0);
    const nodeDragY = useSharedValue(0);

    const tapGesture = Gesture.Tap()
        .onStart((e) => {
            // Check if we hit a node (naive distance check)
            for (const node of nodes) {
                const nodeScreenX = node.x + width / 2 + translateX.value;
                const nodeScreenY = node.y + height / 2 + translateY.value;
                const d = Math.hypot(e.x - nodeScreenX, e.y - nodeScreenY);
                if (d < 45) {
                    console.log('[Canvas] Node Tapped:', node.content);
                    break;
                }
            }
        });

    const longPressGesture = Gesture.LongPress()
        .onStart((e) => {
            for (const node of nodes) {
                const nodeScreenX = node.x + width / 2 + translateX.value;
                const nodeScreenY = node.y + height / 2 + translateY.value;
                const d = Math.hypot(e.x - nodeScreenX, e.y - nodeScreenY);
                if (d < 45) {
                    activeNodeId.value = node.id;
                    break;
                }
            }
        });

    const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture, tapGesture, longPressGesture);

    const animatedCanvasStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value * scale.value },
            { translateY: translateY.value * scale.value },
            { scale: scale.value }
        ]
    }));

    // Calculate edges between nodes based on proximity (simulating similarity)
    const edges: { from: NodeData; to: NodeData; strength: number }[] = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[i].x - nodes[j].x;
            const dy = nodes[i].y - nodes[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            // Connect nodes within 300px (later: use embedding similarity)
            if (dist < 300) {
                edges.push({ from: nodes[i], to: nodes[j], strength: 1 - dist / 300 });
            }
        }
    }

    // Empty State: Curious but Safe Environment
    if (nodes.length === 0) {
        return (
            <GestureHandlerRootView style={styles.container}>
                <Canvas style={styles.canvas}>
                    {/* Pulsating Welcome Orb */}
                    <Group transform={[{ translateX: width / 2 - 60 }, { translateY: height / 2 - 60 }]}>
                        <Shader
                            source={nodeShader}
                            uniforms={{
                                u_time: time.value,
                                u_resolution: [120, 120],
                                u_intensity: 1.2
                            }}
                        />
                        <Circle cx={60} cy={60} r={60} />
                    </Group>
                </Canvas>
                <Animated.View style={styles.emptyStateOverlay}>
                    <Animated.Text style={styles.emptyTitle}>Dein Gedächtnis erwacht.</Animated.Text>
                    <Animated.Text style={styles.emptySubtitle}>
                        Sprich zu mir. Jedes Wort wird ein Stern in deinem Universum.
                    </Animated.Text>
                </Animated.View>
            </GestureHandlerRootView>
        );
    }

    return (
        <GestureHandlerRootView style={styles.container}>
            <GestureDetector gesture={composedGesture}>
                <Animated.View style={[styles.canvasWrapper, animatedCanvasStyle]}>
                    <Canvas style={styles.canvas}>
                        {/* Neural Edges (Connections between similar thoughts) */}
                        {edges.map((edge, idx) => (
                            <SkiaLine
                                key={`edge-${idx}`}
                                p1={{ x: edge.from.x + width / 2, y: edge.from.y + height / 2 }}
                                p2={{ x: edge.to.x + width / 2, y: edge.to.y + height / 2 }}
                                color={`rgba(99, 102, 241, ${edge.strength * 0.5})`}
                                strokeWidth={1 + edge.strength * 2}
                            />
                        ))}
                        {/* Neural Nodes */}
                        {nodes.map((node) => (
                            <Group
                                key={node.id}
                                transform={[
                                    { translateX: node.x + width / 2 - 40 },
                                    { translateY: node.y + height / 2 - 40 }
                                ]}
                            >
                                <Shader
                                    source={nodeShader}
                                    uniforms={{
                                        u_time: time.value,
                                        u_resolution: [80, 80],
                                        u_intensity: activeNodeId.value === node.id ? 1.5 : 1.0
                                    }}
                                />
                                <Circle
                                    cx={40}
                                    cy={40}
                                    r={40}
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
    },
    emptyStateOverlay: {
        position: 'absolute',
        bottom: 120,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#6366f1',
        textAlign: 'center',
        lineHeight: 22,
        fontWeight: '500',
    }
});
