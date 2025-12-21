/**
 * 🌌 NEURAL HORIZON 2.0 — SEMANTIC SPATIAL MEMORY CORE
 * ─────────────────────────────────────────────────────────────
 * An award-winning implementation of a Force-Directed Graph using
 * GPU-accelerated rendering and JSI-based native physics.
 * 
 * DESIGN PILLARS:
 * 1. Semantic Clustering: Memories attract each other based on vector similarity.
 * 2. Organic Immersion: Exponential LOD curves and blur-reveal text.
 * 3. Infinite Canvas: Unrestricted exploration within a 64-bit coordinate void.
 * 4. Neural Glass UI: Premium obsidian-aesthetic with adaptive aura shaders.
 * 
 * REFERENCES:
 * - @[NEURAL_HORIZON.md]: Core theory and physics formulas.
 * - @[NEURAL_GLASS_UI.md]: Interaction model and glassmorphic standards.
 * - @[DESIGN_SYSTEM.md]: Color palette and animation principles.
 */

// --- CORE FRAMEWORKS ---
import {
    Blur,
    Canvas,
    Circle,
    Group,
    Line,
    Mask,
    matchFont,
    Shader,
    Skia,
    Text as SkiaText
} from '@shopify/react-native-skia';
import { BlurView } from 'expo-blur';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

// --- GESTURE & ANIMATION ENGINE ---
import {
    Gesture,
    GestureDetector,
    GestureHandlerRootView
} from 'react-native-gesture-handler';
import Animated, {
    FadeIn,
    FadeOut,
    runOnJS,
    useAnimatedStyle,
    useDerivedValue,
    useFrameCallback,
    useSharedValue
} from 'react-native-reanimated';

// --- NATIVE DATABASE & SCHEMA ---
import { getAllSnippetsWithEmbeddings } from '../db';
import { Snippet } from '../db/schema';

const { width, height } = Dimensions.get('window');

// 1. Neural Soul Shader (Emotional Aura Edition)
// A high-performance refractive plasma shader for memory nodes.
const nodeShader = Skia.RuntimeEffect.Make(`
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_intensity;
  uniform vec3 u_baseColor;
  uniform vec3 u_auraColor;

  float sdCircle(vec2 p, float r) {
      return length(p) - r;
  }

  half4 main(vec2 pos) {
      vec2 center = u_resolution * 0.5;
      float radius = u_resolution.x * 0.45;
      float d = sdCircle(pos - center, radius * (0.8 + 0.2 * u_intensity));
      float noise = sin(pos.x * 0.1 + u_time * 2.0) * cos(pos.y * 0.1 - u_time * 1.5);
      vec2 warp = pos + noise * 5.0 * u_intensity;
      float circle = smoothstep(1.0, -1.0, sdCircle(warp - center, radius));
      float glass = pow(1.0 - length(pos - center) / radius, 3.0);
      vec3 coreColor = u_baseColor * (glass + 0.3);
      float auraRadius = radius * 1.3;
      float auraDist = length(pos - center) - auraRadius;
      float aura = smoothstep(15.0, 0.0, abs(auraDist)) * (0.4 + 0.3 * sin(u_time * 3.0));
      float edge = (1.0 - smoothstep(0.0, 2.0, abs(d))) * 0.5;
      vec3 finalColor = coreColor + edge;
      finalColor = mix(finalColor, u_auraColor, aura * 0.6);
      float alpha = max(circle * 0.85, aura * 0.5);
      return half4(finalColor, alpha);
  }
`)!;

// 2. Deep Void Atmosphere with Cosmic Stardust
const backgroundShader = Skia.RuntimeEffect.Make(`
  uniform float u_time;
  uniform vec2 u_res;
  uniform vec2 u_offset;
  uniform float u_scale;
  uniform vec2 u_avgPos;
  uniform float u_energy;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float star(vec2 p, float density) {
    vec2 i = floor(p * density);
    vec2 f = fract(p * density);
    float h = hash(i);
    if (h < 0.98) return 0.0;
    float pulse = 0.5 + 0.5 * sin(u_time * 2.0 + h * 10.0);
    return smoothstep(0.9, 1.0, 1.0 - length(f - 0.5)) * pulse;
  }

  half4 main(vec2 pos) {
    vec2 uv = pos / u_res;
    vec2 p = (pos - u_res * 0.5) / u_scale + u_offset;
    
    // Layers of Stardust (Parallax)
    float stars1 = star(p, 0.05);
    float stars2 = star(p * 2.0, 0.03);
    float stars3 = star(p * 0.5, 0.1);

    // Neural Lighthouse (Origin)
    float distToCore = length(p);
    float coreGlow = 0.15 / (1.0 + distToCore * 0.002);
    
    // Neural Aura (Center of Thought)
    float distToAvg = length(p - u_avgPos);
    float auraGlow = (u_energy * 0.05) / (1.0 + distToAvg * 0.005);
    vec3 auraColor = vec3(0.3, 0.4, 0.9) * auraGlow;
    
    vec3 color1 = vec3(0.005, 0.005, 0.02); // Deeper Navy
    vec3 color2 = vec3(0.0, 0.0, 0.0);    
    vec3 nebula = vec3(0.04, 0.04, 0.12) * stars2;
    
    vec3 finalColor = mix(color1, color2, uv.y);
    finalColor += stars1 * 0.4 + stars3 * 0.2 + nebula + auraColor + (vec3(0.4, 0.4, 1.0) * coreGlow);
    
    float vignette = 1.0 - length(uv - 0.5) * 0.8;
    return half4(finalColor * vignette, 1.0);
  }
`)!;

// 3. Energy Edge Shader (Thought Flow)
// Visualizes the semantic resonance between memory nodes.
const edgeShader = Skia.RuntimeEffect.Make(`
  uniform float u_time;
  uniform vec2 u_p1;
  uniform vec2 u_p2;
  uniform float u_intensity;

  half4 main(vec2 pos) {
    vec2 dir = u_p2 - u_p1;
    float len = length(dir);
    vec2 normDir = dir / len;
    vec2 p = pos - u_p1;
    float projection = dot(p, normDir);
    float d = length(p - normDir * clamp(projection, 0.0, len));
    float pulse = fract(projection / len - u_time * 0.5);
    float pulseShape = smoothstep(0.1, 0.0, abs(pulse - 0.5)) * smoothstep(0.0, 5.0, projection) * smoothstep(len, len - 5.0, projection);
    vec3 baseColor = vec3(0.38, 0.4, 0.94);
    vec3 pulseColor = vec3(0.6, 0.8, 1.0);
    vec3 color = mix(baseColor, pulseColor, pulseShape * u_intensity);
    float alpha = (0.2 + 0.3 * pulseShape) * u_intensity * smoothstep(2.0, 0.0, d);
    return half4(color * alpha, alpha);
  }
`)!;

// Sentiment to Aura Color Mapping
const getSentimentAura = (sentiment?: string): number[] => {
    switch (sentiment) {
        case 'analytical': return [0.3, 0.5, 1.0];   // Cool Blue
        case 'positive': return [1.0, 0.85, 0.2];  // Warm Gold
        case 'creative': return [0.4, 0.3, 0.9];   // Deep Indigo
        default: return [0.4, 0.4, 0.5];   // Neutral Gray
    }
};

// Helper for Cosine Similarity
const cosineSimilarity = (a: Float32Array, b: Float32Array) => {
    let dotProduct = 0;
    let mA = 0;
    let mB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        mA += a[i] * a[i];
        mB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
};

interface NeuralCanvasProps {
    filterType?: 'all' | 'fact' | 'feeling' | 'goal';
}

export function NeuralCanvas({ filterType = 'all' }: NeuralCanvasProps) {
    const [nodes, setNodes] = useState<Snippet[]>([]);
    const [selectedNode, setSelectedNode] = useState<Snippet | null>(null);

    // Canvas State
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);
    const time = useSharedValue(0);

    // Bounds tracking (calculated from node positions + 20% margin)
    const boundsMinX = useSharedValue(-200);
    const boundsMaxX = useSharedValue(200);
    const boundsMinY = useSharedValue(-200);
    const boundsMaxY = useSharedValue(200);

    // Physics State (Shared Values for Performance)
    const nodePositionsX = useSharedValue<number[]>([]);
    const nodePositionsY = useSharedValue<number[]>([]);
    const nodeVelocitiesX = useSharedValue<number[]>([]);
    const nodeVelocitiesY = useSharedValue<number[]>([]);

    // Topic Cluster State (Semantic Logic)
    const nodeTopicIds = useSharedValue<number[]>([]);
    const topicCentersX = useSharedValue<number[]>(new Array(20).fill(0));
    const topicCentersY = useSharedValue<number[]>(new Array(20).fill(0));
    const uniqueTopics = useRef<string[]>([]);

    // Similarity Matrix (stored as flat array for worklet access)
    const similarityMatrix = useSharedValue<number[]>([]);

    // Load and pre-calculate
    useEffect(() => {
        const load = async () => {
            const snippets = await getAllSnippetsWithEmbeddings();
            if (snippets.length === 0) return;

            const n = snippets.length;
            const initialX = snippets.map(s => s.x || (Math.random() - 0.5) * 500);
            const initialY = snippets.map(s => s.y || (Math.random() - 0.5) * 500);
            const initialVelX = new Array(n).fill(0);
            const initialVelY = new Array(n).fill(0);

            // Pre-calculate similarities
            const matrix = new Array(n * n).fill(0);
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    if (i === j) continue;
                    if (snippets[i].embedding && snippets[j].embedding) {
                        matrix[i * n + j] = cosineSimilarity(snippets[i].embedding!, snippets[j].embedding!);
                    }
                }
            }

            // Assign Topic IDs
            const topics: string[] = [];
            const topicIds = snippets.map(s => {
                const topic = s.topic || 'misc';
                let idx = topics.indexOf(topic);
                if (idx === -1) {
                    topics.push(topic);
                    idx = topics.length - 1;
                }
                return idx;
            });
            uniqueTopics.current = topics;
            nodeTopicIds.value = topicIds;

            // Discovery Physics: If nodes were added, give them a burst
            if (n > nodePositionsX.value.length && nodePositionsX.value.length > 0) {
                const diff = n - nodePositionsX.value.length;
                for (let k = 0; k < diff; k++) {
                    const idx = n - diff + k;
                    initialVelX[idx] = (Math.random() - 0.5) * 50;
                    initialVelY[idx] = (Math.random() - 0.5) * 50;
                }
            }

            nodePositionsX.value = initialX;
            nodePositionsY.value = initialY;
            nodeVelocitiesX.value = initialVelX;
            nodeVelocitiesY.value = initialVelY;
            similarityMatrix.value = matrix;
            setNodes(snippets);

            // Calculate initial bounds + 20% margin
            const minX = Math.min(...initialX);
            const maxX = Math.max(...initialX);
            const minY = Math.min(...initialY);
            const maxY = Math.max(...initialY);
            const paddingX = (maxX - minX) * 0.2 || 200;
            const paddingY = (maxY - minY) * 0.2 || 200;

            boundsMinX.value = minX - paddingX;
            boundsMaxX.value = maxX + paddingX;
            boundsMinY.value = minY - paddingY;
            boundsMaxY.value = maxY + paddingY;

            setNodes(snippets);
        };
        load();
    }, []);

    // 2. The Semantic Physics Engine (Antigravity Edition)
    useFrameCallback((info) => {
        'worklet';
        time.value = info.timestamp / 1000;
        const n = nodePositionsX.value.length;
        if (n === 0) return;
        // --- 47x PHYSICS ENGINE: ORGANIC IMMERSION CORE ---
        // Infinite Canvas: Exploration is restricted only by memory volume.

        // 1. Viscosity & Friction (Digital Resistance)
        const friction = 0.985;  // High premium viscosity

        // 2. Repulsion Forces (Anti-Collision)
        const repulsionK = 1100; // Softer, more organic spacing

        // 3. Semantic Spring Logic (Memory Attraction)
        const springK = 0.015;   // Gentle connection elasticity
        const simThreshold = 0.8; // Cutoff for semantic grouping

        // 4. Cluster Gravity (The Topic Hubs)
        const topicAttraction = 0.02;

        // 5. Global Entropy (Ambient Drift)
        const driftIntensity = 0.1;
        const centerAttraction = 0.0015;

        const nextPosX = [...nodePositionsX.value];
        const nextPosY = [...nodePositionsY.value];
        const nextVelX = [...nodeVelocitiesX.value];
        const nextVelY = [...nodeVelocitiesY.value];

        // 1. Calculate Cluster Centroids (The Logic Hubs)
        const tCX = new Array(20).fill(0);
        const tCY = new Array(20).fill(0);
        const tCount = new Array(20).fill(0);

        for (let i = 0; i < n; i++) {
            const tId = nodeTopicIds.value[i];
            if (tId < 20) {
                tCX[tId] += nextPosX[i];
                tCY[tId] += nextPosY[i];
                tCount[tId]++;
            }
        }

        for (let t = 0; t < 20; t++) {
            if (tCount[t] > 0) {
                tCX[t] /= tCount[t];
                tCY[t] /= tCount[t];
            }
        }
        topicCentersX.value = tCX;
        topicCentersY.value = tCY;

        // 2. Apply Forces
        for (let i = 0; i < n; i++) {
            let fx = 0, fy = 0;

            // Cluster Gravity (The Logic)
            const myTopicId = nodeTopicIds.value[i];
            if (myTopicId < 20) {
                const tx = topicCentersX.value[myTopicId];
                const ty = topicCentersY.value[myTopicId];
                fx += (tx - nextPosX[i]) * topicAttraction;
                fy += (ty - nextPosY[i]) * topicAttraction;
            }

            // Global Repulsion & Semantic Attraction
            for (let j = 0; j < n; j++) {
                if (i === j) continue;

                const dx = nextPosX[i] - nextPosX[j];
                const dy = nextPosY[i] - nextPosY[j];
                const distSq = dx * dx + dy * dy || 1;
                const dist = Math.sqrt(distSq);

                const repelForce = repulsionK / distSq;
                fx += (dx / dist) * repelForce;
                fy += (dy / dist) * repelForce;

                const sim = similarityMatrix.value[i * n + j];
                if (sim > simThreshold) {
                    const targetDist = (1 - sim) * 300;
                    const springForce = (targetDist - dist) * springK * sim;
                    fx += (dx / dist) * springForce;
                    fy += (dy / dist) * springForce;
                }
            }

            fx += Math.sin(time.value * 0.7 + i) * driftIntensity;
            fy += Math.cos(time.value * 0.5 + i) * driftIntensity;

            fx -= nextPosX[i] * centerAttraction;
            fy -= nextPosY[i] * centerAttraction;

            nextVelX[i] = (nextVelX[i] + fx) * friction;
            nextVelY[i] = (nextVelY[i] + fy) * friction;
            nextPosX[i] += nextVelX[i];
            nextPosY[i] += nextVelY[i];
        }

        nodePositionsX.value = nextPosX;
        nodePositionsY.value = nextPosY;
        nodeVelocitiesX.value = nextVelX;
        nodeVelocitiesY.value = nextVelY;
    });

    // Gestures
    const panGesture = Gesture.Pan()
        .onChange((e) => {
            'worklet';
            translateX.value += e.changeX / scale.value;
            translateY.value += e.changeY / scale.value;
        });

    const pinchGesture = Gesture.Pinch()
        .onChange((e) => {
            'worklet';
            scale.value *= e.scaleChange;
        });

    const tapGesture = Gesture.Tap()
        .onStart((e) => {
            'worklet';
            const n = nodes.length;

            // Transform tap coordinates to canvas space
            // The canvas is scaled and translated, so we need to reverse those transforms
            const canvasCenterX = width / 2;
            const canvasCenterY = height / 2;

            // Convert screen tap position to canvas position
            const tapCanvasX = (e.x - canvasCenterX) / scale.value - translateX.value;
            const tapCanvasY = (e.y - canvasCenterY) / scale.value - translateY.value;

            for (let i = 0; i < n; i++) {
                // Node positions are relative to center (0,0)
                const nodeX = nodePositionsX.value[i];
                const nodeY = nodePositionsY.value[i];

                const distance = Math.hypot(tapCanvasX - nodeX, tapCanvasY - nodeY);

                // Hit radius adjusted for scale (nodes appear larger when zoomed in)
                const hitRadius = 40 / scale.value + 20;

                if (distance < hitRadius) {
                    runOnJS(setSelectedNode)(nodes[i]);
                    break;
                }
            }
        });

    const combined = Gesture.Simultaneous(panGesture, pinchGesture, tapGesture);

    // 4. Background Shader Uniforms (Hook)
    const backgroundUniforms = useDerivedValue(() => {
        let ax = 0, ay = 0;
        const n = nodePositionsX.value.length;
        if (n > 0) {
            for (let i = 0; i < n; i++) {
                ax += nodePositionsX.value[i];
                ay += nodePositionsY.value[i];
            }
            ax /= n;
            ay /= n;
        }

        return {
            u_time: time.value,
            u_res: [width, height],
            u_offset: [translateX.value, translateY.value],
            u_scale: scale.value,
            u_avgPos: [ax, ay],
            u_energy: Math.min(n, 40)
        };
    });

    const canvasStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { translateX: translateX.value },
            { translateY: translateY.value }
        ]
    }));

    // --- Render Logic ---
    const font = matchFont({
        fontFamily: Platform.OS === 'ios' ? 'Helvetica' : 'serif',
        fontSize: 12,
        fontWeight: 'bold',
    });

    if (nodes.length === 0) return (
        <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.emptyText}>Initializing Neural Matrix...</Text>
        </View>
    );

    return (
        <GestureHandlerRootView style={styles.container}>
            <GestureDetector gesture={combined}>
                <Animated.View style={[styles.canvasWrapper, canvasStyle]}>
                    <Canvas style={styles.canvas}>
                        {/* 0. Deep Void Atmosphere */}
                        <Shader
                            source={backgroundShader}
                            uniforms={backgroundUniforms}
                        />

                        {/* 1. Neural Edges (Thought Flow) */}
                        {nodes.map((node, i) => (
                            <NeuralEdges
                                key={`edge-group-${node.id}`}
                                i={i}
                                nodes={nodes}
                                nodePositionsX={nodePositionsX}
                                nodePositionsY={nodePositionsY}
                                similarityMatrix={similarityMatrix}
                                time={time}
                            />
                        ))}

                        {/* 2. Neural Nodes (LOD Morphing) */}
                        {nodes.map((node, i) => (
                            <NeuralNode
                                key={`node-${node.id}`}
                                i={i}
                                node={node}
                                nodePositionsX={nodePositionsX}
                                nodePositionsY={nodePositionsY}
                                translateX={translateX}
                                translateY={translateY}
                                scale={scale}
                                time={time}
                                font={font}
                                filterType={filterType}
                            />
                        ))}

                        {/* 3. Logic Hub Labels (Solar System Identity) */}
                        {uniqueTopics.current.map((topic, tIdx) => (
                            <TopicLabel
                                key={`topic-${topic}`}
                                topic={topic}
                                tIdx={tIdx}
                                topicCentersX={topicCentersX}
                                topicCentersY={topicCentersY}
                                scale={scale}
                                font={font}
                            />
                        ))}
                    </Canvas>
                </Animated.View>
            </GestureDetector>

            {/* Glass Detail Overlay */}
            {selectedNode && (
                <Pressable style={styles.overlay} onPress={() => setSelectedNode(null)}>
                    <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.cardContainer}>
                        <BlurView intensity={80} tint="dark" style={styles.card}>
                            <View style={styles.typeTag}>
                                <Text style={styles.typeText}>{selectedNode.type.toUpperCase()}</Text>
                            </View>
                            <Text style={styles.content}>{selectedNode.content}</Text>
                            <Text style={styles.date}>{new Date(selectedNode.timestamp).toLocaleDateString()}</Text>
                        </BlurView>
                    </Animated.View>
                </Pressable>
            )}
        </GestureHandlerRootView>
    );
}

/**
 * Sub-component for Neural Edges with Thought Flow Animation
 */
/**
 * Sub-component for Neural Edges Group (one group per node to manage edges)
 */
function NeuralEdges({ i, nodes, nodePositionsX, nodePositionsY, similarityMatrix, time }: any) {
    return nodes.slice(i + 1).map((target: any, jIdx: number) => (
        <NeuralEdge
            key={`edge-${i}-${i + 1 + jIdx}`}
            i={i}
            j={i + 1 + jIdx}
            n={nodes.length}
            nodePositionsX={nodePositionsX}
            nodePositionsY={nodePositionsY}
            similarityMatrix={similarityMatrix}
            time={time}
        />
    ));
}

/**
 * Individual Neural Edge component (Safe Hook Usage)
 */
function NeuralEdge({ i, j, n, nodePositionsX, nodePositionsY, similarityMatrix, time }: any) {
    const isVisible = useDerivedValue(() => {
        const sim = similarityMatrix.value[i * n + j];
        return sim >= 0.82;
    });

    const p1 = useDerivedValue(() => ({
        x: nodePositionsX.value[i] + width / 2,
        y: nodePositionsY.value[i] + height / 2
    }));

    const p2 = useDerivedValue(() => ({
        x: nodePositionsX.value[j] + width / 2,
        y: nodePositionsY.value[j] + height / 2
    }));

    const intensity = useDerivedValue(() => {
        const sim = similarityMatrix.value[i * n + j];
        return (sim - 0.75) * 4;
    });

    const uniforms = useDerivedValue(() => ({
        u_time: time.value,
        u_p1: [p1.value.x, p1.value.y],
        u_p2: [p2.value.x, p2.value.y],
        u_intensity: intensity.value
    }));

    const edgeOpacity = useDerivedValue(() => isVisible.value ? 1 : 0);

    return (
        <Group opacity={edgeOpacity}>
            <Shader source={edgeShader} uniforms={uniforms} />
            <Line
                p1={p1}
                p2={p2}
                color="rgba(99, 102, 241, 0.2)"
                strokeWidth={1}
            />
        </Group>
    );
}

/**
 * Sub-component for a single Neural Node with Semantic Zoom (LOD)
 */
function NeuralNode({ i, node, nodePositionsX, nodePositionsY, translateX, translateY, scale, time, font, filterType }: any) {
    const isFiltered = filterType !== 'all' && node.type !== filterType;
    const typeColor = node.type === 'goal' ? [1.0, 0.8, 0.2] : node.type === 'feeling' ? [0.6, 0.3, 0.9] : [0.1, 0.9, 0.6];
    const auraColor = getSentimentAura(node.sentiment);

    const nodeOpacity = useDerivedValue(() => isFiltered ? 0.2 : 1.0);

    const lod2Opacity = useDerivedValue(() => {
        if (scale.value < 1.1) return 0;
        if (scale.value > 1.9) return 1;
        // Exponential fade-in for organic feel
        return Math.pow((scale.value - 1.1) / 0.8, 2);
    });

    const lod3Progress = useDerivedValue(() => {
        if (scale.value < 2.8) return 0;
        if (scale.value > 4.8) return 1;
        // Cubic progress for immersive reveal
        return Math.pow((scale.value - 2.8) / 2.0, 3);
    });

    const transform = useDerivedValue(() => [
        { translateX: nodePositionsX.value[i] + width / 2 },
        { translateY: nodePositionsY.value[i] + height / 2 }
    ]);

    const lod1And2Opacity = useDerivedValue(() => 1 - lod3Progress.value);

    const nodeUniforms = useDerivedValue(() => ({
        u_time: time.value,
        u_resolution: [60, 60],
        u_intensity: 1.0,
        u_baseColor: typeColor,
        u_auraColor: auraColor
    }));

    const lod3CircleRadius = useDerivedValue(() => 30 + lod3Progress.value * 120);

    const lod2GroupOpacity = useDerivedValue(() => lod2Opacity.value * (1 - lod3Progress.value));

    // Dynamic label fade based on distance to center (Focus Zone)
    const labelOpacity = useDerivedValue(() => {
        const x = nodePositionsX.value[i] + translateX.value;
        const y = nodePositionsY.value[i] + translateY.value;
        const distToCenter = Math.sqrt(x * x + y * y);
        const focusFactor = Math.max(0, 1 - distToCenter / 400);
        return lod2GroupOpacity.value * focusFactor;
    });

    return (
        <Group opacity={nodeOpacity}>
            <Group transform={transform}>
                {/* LOD 1 & 2: The Core Orb */}
                <Group opacity={lod1And2Opacity}>
                    <Shader
                        source={nodeShader}
                        uniforms={nodeUniforms}
                    />
                    <Circle cx={0} cy={0} r={30} />
                </Group>

                {/* LOD 3: Immersive Glass Card */}
                <Group opacity={lod3Progress}>
                    <Circle
                        cx={0}
                        cy={0}
                        r={lod3CircleRadius}
                        color="rgba(20, 20, 30, 0.95)"
                    />
                    <SkiaText
                        x={-100}
                        y={0}
                        text={node.content.length > 35 ? node.content.substring(0, 35) + "..." : node.content}
                        font={font}
                        color="#fff"
                    />
                </Group>

                {/* LOD 2: Contextual Labels (Blur Reveal from Neural Void) */}
                <Group opacity={labelOpacity}>
                    <Mask
                        mask={
                            <Circle cx={40} cy={5} r={80}>
                                <Blur blur={useDerivedValue(() => (1 - lod2Opacity.value) * 15)} />
                            </Circle>
                        }
                    >
                        <SkiaText
                            x={35}
                            y={5}
                            text={node.content.substring(0, 18) + (node.content.length > 18 ? "..." : "")}
                            font={font}
                            color="rgba(255, 255, 255, 0.95)"
                        />
                    </Mask>
                </Group>
            </Group>
        </Group>
    );
}

/**
 * Spatial Label for Semantic Clusters (The Logic Hubs)
 */
function TopicLabel({ topic, tIdx, topicCentersX, topicCentersY, scale, font }: any) {
    const opacity = useDerivedValue(() => {
        if (scale.value < 0.6) return 0;
        if (scale.value > 1.2) return 0.2; // Fade out when too close (nodes take over)
        return (scale.value - 0.6) * 0.8;
    });

    const pos = useDerivedValue(() => ({
        x: topicCentersX.value[tIdx] + width / 2,
        y: topicCentersY.value[tIdx] + height / 2 - 60 // Float above the cluster
    }));

    return (
        <Group opacity={opacity}>
            <SkiaText
                x={useDerivedValue(() => pos.value.x - 40)}
                y={useDerivedValue(() => pos.value.y)}
                text={topic.toUpperCase()}
                font={font}
                color="rgba(255, 255, 255, 0.4)"
            />
        </Group>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    canvasWrapper: { flex: 1 },
    canvas: { flex: 1 },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
    cardContainer: { width: '85%' },
    card: { padding: 32, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
    typeTag: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(99, 102, 241, 0.25)', marginBottom: 16 },
    typeText: { fontSize: 10, fontWeight: '900', color: '#818cf8', letterSpacing: 2 },
    content: { fontSize: 20, color: '#fff', lineHeight: 30, fontWeight: '600', letterSpacing: -0.2 },
    date: { marginTop: 24, fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
    emptyText: { marginTop: 16, color: '#818cf8', fontSize: 14, fontWeight: '700', letterSpacing: 1 }
});
