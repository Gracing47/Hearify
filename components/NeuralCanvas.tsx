/**
 * 🌌 NEURAL HORIZON 2.0 — ULTIMATE IMMERSION EDITION
 * ─────────────────────────────────────────────────────────────
 * NEUE FEATURES:
 * 1. Hierarchische Node-Größen basierend auf Wichtigkeit
 * 2. Cluster-Aura Visualisierung (farbige Nebelzonen)
 * 3. Dynamische Edge-Dicke (stärkere Verbindungen = dicker)
 * 4. Temporale Farbverläufe (alte Memories verblassen)
 * 5. Fokus-Modus (Klick dimmt unrelated Nodes)
 * 6. Progressive Text-Reveal mit Blur
 * 7. Thinking Pulse für neue/aktive Nodes
 * 8. Magnetische Cluster-Kräfte (stärkere Anziehung)
 */

import {
    Blur,
    Canvas,
    Group,
    Line,
    matchFont,
    Shader,
    Skia,
    Text as SkiaText
} from '@shopify/react-native-skia';
import { BlurView } from 'expo-blur';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

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

import { getSemanticGraph, loadNodesIncremental } from '../db';
import { Snippet } from '../db/schema';
import { useContextStore } from '../store/contextStore';
import { FilmGrainOverlay } from './visuals/FilmGrain';
import { SemanticNode } from './visuals/SemanticNode';

interface Cluster {
    id: number;
    label: string;
    node_count: number;
}

// 🎨 ENHANCED: Cluster-spezifische Farben
const CLUSTER_COLORS = [
    [0.4, 0.6, 1.0],   // Himmelblau
    [1.0, 0.5, 0.7],   // Rosa
    [0.5, 0.95, 0.6],  // Mintgrün
    [0.95, 0.75, 0.4], // Gold
    [0.7, 0.4, 0.95],  // Violett
    [0.4, 0.9, 0.95],  // Cyan
    [1.0, 0.6, 0.4],   // Koralle
    [0.6, 0.8, 0.95],  // Hellblau
];

const getClusterColor = (id: number): number[] => {
    'worklet';
    return CLUSTER_COLORS[id % CLUSTER_COLORS.length];
};

// 🎨 Node Shader: Organic Bloom & Neon Glow
const nodeShader = Skia.RuntimeEffect.Make(`
  uniform float u_time;
  uniform vec2 u_center;
  uniform float u_radius;
  uniform vec3 u_color;
  uniform float u_intensity;
  uniform float u_active; // 0 = inactive, 1 = active/hovered

  float sdCircle(vec2 p, float r) {
      return length(p) - r;
  }

  half4 main(vec2 pos) {
      vec2 localPos = pos - u_center;
      float radius = u_radius;
      float d = length(localPos);

      // 1. Organic Pulse (Breathing)
      float pulse = 0.95 + 0.05 * sin(u_time * 2.0 + length(localPos)*0.05);
      
      // 2. Glass/Crystalline Core
      float glass = pow(1.0 - clamp(d / radius, 0.0, 1.0), 2.5);
      
      // 3. Bloom/Glow
      float glow = exp(-d * 3.0 / radius) * u_intensity;
      
      // 4. Activity Boost (Explosion of color on hover)
      float activeBoost = u_active * 0.5;
      
      vec3 coreColor = u_color * (glass + 0.5 + activeBoost) * pulse;
      vec3 glowColor = u_color * glow * (0.8 + activeBoost);
      
      vec3 finalColor = coreColor + glowColor;
      
      // Alpha falloff
      float alpha = smoothstep(radius, radius * 0.8, d) * 0.8 + glow * 0.5;
      alpha = clamp(alpha, 0.0, 1.0);
      
      return half4(finalColor * alpha, alpha);
  }
`)!;

// 🌊 ENHANCED: Deep Space Nebula Background
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
    if (h < 0.985) return 0.0;
    float pulse = 0.4 + 0.6 * sin(u_time * 0.8 + h * 20.0);
    return smoothstep(0.8, 1.0, 1.0 - length(f - 0.5)) * pulse;
  }

  half4 main(vec2 pos) {
    vec2 uv = pos / u_res;
    vec2 p = (pos - u_res * 0.5) / u_scale + u_offset;
    
    // Parallax Star Fields
    float s1 = star(p, 0.04);
    float s2 = star(p * 1.5, 0.02);
    float s3 = star(p * 0.6, 0.08);

    // Deep Nebula Clouds
    float n1 = sin(p.x * 0.002 + u_time * 0.1) * cos(p.y * 0.002 - u_time * 0.05);
    float n2 = sin(p.y * 0.003 - u_time * 0.08) * cos(p.x * 0.004 + u_time * 0.12);
    vec3 nebulaColor = vec3(0.05, 0.04, 0.15) * (n1 + n2 + 1.0);
    
    // Core Glow
    float distToAvg = length(p - u_avgPos);
    float auraGlow = (u_energy * 0.1) / (1.0 + distToAvg * 0.005);
    vec3 auraColor = vec3(0.2, 0.3, 0.8) * auraGlow;
    
    // Background Gradient (Deep Navy to Black)
    vec3 baseColor = mix(vec3(0.005, 0.005, 0.015), vec3(0.0), uv.y);
    
    vec3 finalColor = baseColor + (s1 * 0.6 + s2 * 0.4 + s3 * 0.2) + nebulaColor * 0.3 + auraColor;
    
    // Subtle Vignette
    float vignette = 1.0 - length(uv - 0.5) * 0.6;
    return half4(finalColor * vignette, 1.0);
  }
`)!;

// 🔥 Edge Shader: Dynamic Traveler Particles
const edgeShader = Skia.RuntimeEffect.Make(`
  uniform float u_time;
  uniform vec2 u_p1;
  uniform vec2 u_p2;
  uniform float u_intensity; // 0..1 based on cursor proximity or similarity
  uniform vec3 u_color;

  half4 main(vec2 pos) {
    vec2 dir = u_p2 - u_p1;
    float len = length(dir);
    vec2 normDir = dir / len;
    vec2 p = pos - u_p1;
    
    // Project point onto line
    float t = dot(p, normDir);
    vec2 closest = normDir * clamp(t, 0.0, len);
    float dist = length(p - closest);
    
    if (dist > 3.0) return half4(0.0, 0.0, 0.0, 0.0);
    
    // Base line
    float alpha = smoothstep(2.0, 0.0, dist) * 0.15;
    
    // Traveler Particle
    float particlePos = fract(u_time * 0.8) * len;
    float particleDist = abs(t - particlePos);
    float particle = smoothstep(30.0, 0.0, particleDist); // 30px trail
    
    // Particle glow
    vec3 particleColor = mix(u_color, vec3(1.0, 1.0, 1.0), 0.7) * 2.5;
    float particleAlpha = particle * smoothstep(2.0, 0.0, dist) * 0.8;
    
    vec3 finalColor = u_color * alpha + particleColor * particleAlpha;
    float finalAlpha = alpha + particleAlpha;
    
    return half4(finalColor * finalAlpha, finalAlpha * u_intensity);
  }
`)!;

// 🌟 ENHANCED: Volumetric Cluster Aura
const clusterAuraShader = Skia.RuntimeEffect.Make(`
  uniform vec2 u_center;
  uniform float u_radius;
  uniform vec3 u_color;
  uniform float u_time;
  uniform float u_intensity;

  half4 main(vec2 pos) {
    vec2 toCenter = pos - u_center;
    float d = length(toCenter);
    
    // Volumetric density falloff
    float falloff = exp(-d * 4.0 / u_radius);
    
    // Organic turbulence
    float angle = atan(toCenter.y, toCenter.x);
    float turbulence = sin(angle * 4.0 + u_time * 0.5) * 0.2 + 0.8;
    float swell = 1.0 + 0.1 * sin(u_time * 0.8 + d * 0.01);
    
    float finalAlpha = falloff * u_intensity * turbulence * swell * 0.25;
    
    // Edge softening
    finalAlpha *= smoothstep(u_radius, u_radius * 0.5, d);
    
    return half4(u_color * finalAlpha, finalAlpha);
  }
`)!;

interface NeuralCanvasProps {
    filterType?: 'all' | 'fact' | 'feeling' | 'goal';
}

export function NeuralCanvas({ filterType = 'all' }: NeuralCanvasProps) {
    const [nodes, setNodes] = useState<Snippet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedNode, setSelectedNode] = useState<Snippet | null>(null);
    const [focusedNodeId, setFocusedNodeId] = useState<number | null>(null);

    const { width, height } = useWindowDimensions();
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);
    const time = useSharedValue(0);

    // Physics State
    const nodePositionsX = useSharedValue<number[]>([]);
    const nodePositionsY = useSharedValue<number[]>([]);
    const nodePositionsZ = useSharedValue<number[]>([]);
    const nodeVelocitiesX = useSharedValue<number[]>([]);
    const nodeVelocitiesY = useSharedValue<number[]>([]);
    const nodeVelocitiesZ = useSharedValue<number[]>([]);
    const nodeClusterIds = useSharedValue<number[]>([]);
    const nodeImportance = useSharedValue<number[]>([]);

    // Cluster State
    const clusterCentersX = useSharedValue<number[]>([]);
    const clusterCentersY = useSharedValue<number[]>([]);
    const clusterCentersZ = useSharedValue<number[]>([]);
    const [clusters, setClusters] = useState<Cluster[]>([]);
    const [insights, setInsights] = useState<any[]>([]);

    const [edgePairs, setEdgePairs] = useState<[number, number][]>([]);

    const [loadingPhase, setLoadingPhase] = useState<'clusters' | 'recent' | 'complete'>('clusters');

    useEffect(() => {
        const load = async () => {
            const startLoad = Date.now();

            // 🔥 PHASE 1: Clusters (Instant)
            const dbClusters = await loadNodesIncremental('clusters');
            setClusters(dbClusters);
            setLoadingPhase('clusters');

            // 🔥 PHASE 2: Recent & Important
            setTimeout(async () => {
                const { nodes: recentNodes, edges: initialEdges } = await getSemanticGraph();
                const filteredRecent = recentNodes.filter(n =>
                    (Date.now() - n.timestamp) < 14 * 24 * 60 * 60 * 1000 || n.importance >= 1.5
                ).slice(0, 100);

                applyNodes(filteredRecent);
                setEdgePairs(initialEdges.map(e => [e.source, e.target]));
                setNodes(filteredRecent);
                setLoadingPhase('recent');
                setIsLoading(false);

                // 🔥 PHASE 3: Full Archive
                setTimeout(async () => {
                    const { nodes: allNodes } = await getSemanticGraph();
                    applyNodes(allNodes);
                    setNodes(allNodes);
                    setLoadingPhase('complete');
                    console.log(`[NeuralCanvas] Full load: ${allNodes.length} nodes in ${Date.now() - startLoad}ms`);
                }, 500);
            }, 200);
        };

        const applyNodes = (snippets: Snippet[]) => {
            const n = snippets.length;
            const initialX = snippets.map(s => (s.x && s.x !== 0) ? s.x : (Math.random() - 0.5) * 1200);
            const initialY = snippets.map(s => (s.y && s.y !== 0) ? s.y : (Math.random() - 0.5) * 1200);
            const initialZ = snippets.map(s => s.z || 0);

            const clusterIds = snippets.map(s => s.cluster_id || -1);
            const importance = snippets.map(s => s.importance || 1.0);

            nodePositionsX.value = initialX;
            nodePositionsY.value = initialY;
            nodePositionsZ.value = initialZ;

            nodeVelocitiesX.value = new Array(n).fill(0);
            nodeVelocitiesY.value = new Array(n).fill(0);
            nodeVelocitiesZ.value = new Array(n).fill(0);
            nodeClusterIds.value = clusterIds;
            nodeImportance.value = importance;
        };

        load();
    }, []);

    // 🔥 ENHANCED: Stärkere Cluster-Kräfte
    useFrameCallback((info) => {
        'worklet';
        time.value = info.timestamp / 1000;
        const n = nodePositionsX.value.length;
        if (n === 0) return;

        const friction = 0.98;
        const repulsionK = 1200;
        const springK = 0.02;
        const clusterAttraction = 0.06;
        const orbitalStrength = 0.025; // 🔥 NEW: Orbital force
        const driftIntensity = 0.15;
        const centerAttraction = 0.003;

        const nextPosX = [...nodePositionsX.value];
        const nextPosY = [...nodePositionsY.value];
        const nextPosZ = [...nodePositionsZ.value];
        const nextVelX = [...nodeVelocitiesX.value];
        const nextVelY = [...nodeVelocitiesY.value];
        const nextVelZ = [...nodeVelocitiesZ.value];

        // ... existing cluster center calculation code ...
        const cCX: { [key: number]: number } = {};
        const cCY: { [key: number]: number } = {};
        const cCZ: { [key: number]: number } = {};
        const cCount: { [key: number]: number } = {};

        for (let i = 0; i < n; i++) {
            const cId = nodeClusterIds.value[i] ?? -1;
            if (cId !== -1) {
                if (cCX[cId] === undefined) {
                    cCX[cId] = nextPosX[i] ?? 0;
                    cCY[cId] = nextPosY[i] ?? 0;
                    cCZ[cId] = nextPosZ[i] ?? 0;
                    cCount[cId] = 1;
                } else {
                    cCX[cId] += nextPosX[i] ?? 0;
                    cCY[cId] += nextPosY[i] ?? 0;
                    cCZ[cId] += nextPosZ[i] ?? 0;
                    cCount[cId] += 1;
                }
            }
        }

        const finalCCX: number[] = [];
        const finalCCY: number[] = [];
        const finalCCZ: number[] = [];

        for (const idStr in cCount) {
            const id = parseInt(idStr);
            const count = cCount[id];
            finalCCX[id] = (cCX[id] ?? 0) / count;
            finalCCY[id] = (cCY[id] ?? 0) / count;
            finalCCZ[id] = (cCZ[id] ?? 0) / count;
        }

        clusterCentersX.value = finalCCX;
        clusterCentersY.value = finalCCY;
        clusterCentersZ.value = finalCCZ;

        for (let i = 0; i < n; i++) {
            let fx = 0, fy = 0, fz = 0;

            // 1. Cluster Attraction & Orbit
            const myClusterId = nodeClusterIds.value[i] ?? -1;
            if (myClusterId !== -1 && finalCCX[myClusterId] !== undefined) {
                const dx = (finalCCX[myClusterId] ?? 0) - (nextPosX[i] ?? 0);
                const dy = (finalCCY[myClusterId] ?? 0) - (nextPosY[i] ?? 0);
                const dz = (finalCCZ[myClusterId] ?? 0) - (nextPosZ[i] ?? 0);
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;

                // Pull towards center
                fx += dx * clusterAttraction;
                fy += dy * clusterAttraction;
                fz += dz * 0.05; // Gentle snap to cluster depth

                // 🔥 Orbital force: perpendicular to direction to center
                fx += -dy * orbitalStrength;
                fy += dx * orbitalStrength;
            }

            // 2. Global Repulsion
            for (let j = 0; j < n; j++) {
                if (i === j) continue;
                const dx = (nextPosX[i] ?? 0) - (nextPosX[j] ?? 0);
                const dy = (nextPosY[i] ?? 0) - (nextPosY[j] ?? 0);
                const distSq = dx * dx + dy * dy || 1;
                const repel = repulsionK / (distSq + 200);
                fx += (dx / Math.sqrt(distSq)) * repel;
                fy += (dy / Math.sqrt(distSq)) * repel;
            }

            // 3. Drift & Brownian Motion (The Spark of Life)
            fx += Math.sin(time.value * 0.7 + i) * driftIntensity;
            fy += Math.cos(time.value * 0.5 + i) * driftIntensity;
            fz += Math.sin(time.value * 1.2 + i) * (driftIntensity * 50); // Move in depth

            fx -= (nextPosX[i] ?? 0) * centerAttraction;
            fy -= (nextPosY[i] ?? 0) * centerAttraction;

            // 4. Update Velocities & Positions
            const vx = (nextVelX[i] + fx) * friction;
            const vy = (nextVelY[i] + fy) * friction;
            const vz = (nextVelZ[i] + fz) * friction;

            nextVelX[i] = vx;
            nextVelY[i] = vy;
            nextVelZ[i] = vz;

            nextPosX[i] += vx;
            nextPosY[i] += vy;
            nextPosZ[i] += vz;
        }

        nodePositionsX.value = nextPosX;
        nodePositionsY.value = nextPosY;
        nodePositionsZ.value = nextPosZ;
        nodeVelocitiesX.value = nextVelX;
        nodeVelocitiesY.value = nextVelY;
        nodeVelocitiesZ.value = nextVelZ;
    });

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

            const canvasCenterX = width / 2;
            const canvasCenterY = height / 2;

            const tapCanvasX = (e.x - canvasCenterX) / scale.value - translateX.value;
            const tapCanvasY = (e.y - canvasCenterY) / scale.value - translateY.value;

            for (let i = 0; i < n; i++) {
                const nodeX = nodePositionsX.value[i] ?? 0;
                const nodeY = nodePositionsY.value[i] ?? 0;

                const distance = Math.hypot(tapCanvasX - nodeX, tapCanvasY - nodeY);

                const hitRadius = 40 / scale.value + 20;

                if (distance < hitRadius) {
                    runOnJS(handleNodeTap)(nodes[i]);
                    break;
                }
            }
        });

    const handleNodeTap = (node: Snippet) => {
        setSelectedNode(node);
        setFocusedNodeId(node.id);

        // 🔥 Update global context
        useContextStore.getState().setFocusNode(node.id);

        // 🔥 Sync last accessed in DB (Optional/Async)
        // initDatabase().then(db => db.execute('UPDATE snippets SET last_accessed = ? WHERE id = ?', [Date.now(), node.id]));
    };

    const combined = Gesture.Simultaneous(panGesture, pinchGesture, tapGesture);

    // 🌟 FORTSETZUNG: Render-Logik & Komponenten

    const backgroundUniforms = useDerivedValue(() => {
        let ax = 0, ay = 0;
        const n = nodePositionsX.value.length;
        if (n > 0) {
            for (let i = 0; i < n; i++) {
                const px = nodePositionsX.value[i] ?? 0;
                const py = nodePositionsY.value[i] ?? 0;
                if (!isNaN(px) && !isNaN(py)) {
                    ax += px;
                    ay += py;
                }
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
            u_energy: Math.min(n / 10, 2.0) // Normalize energy for shader
        };
    });

    const canvasStyle = useAnimatedStyle(() => ({ flex: 1 }));

    const canvasTransform = useDerivedValue(() => [
        { translateX: width / 2 },
        { translateY: height / 2 },
        { scale: scale.value },
        { translateX: translateX.value },
        { translateY: translateY.value }
    ]);

    const font = matchFont({
        fontFamily: Platform.OS === 'ios' ? 'Helvetica' : 'serif',
        fontSize: 10,
        fontWeight: 'bold',
    });

    if (isLoading) return (
        <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.emptyText}>Initializing Neural Matrix...</Text>
        </View>
    );

    if (nodes.length === 0) return (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🌌</Text>
            <Text style={styles.emptyText}>The Horizon is quiet.</Text>
            <Text style={styles.emptySubtext}>Start a conversation in Orbit to seed your universe.</Text>
        </View>
    );

    return (
        <GestureHandlerRootView style={styles.container}>
            <GestureDetector gesture={combined}>
                <Animated.View style={[styles.canvasWrapper, canvasStyle]}>
                    <Canvas style={styles.canvas}>
                        <Shader source={backgroundShader} uniforms={backgroundUniforms} />

                        <Group transform={canvasTransform}>
                            {/* 🌟 NEU: Cluster Auras (farbige Nebelzonen) */}
                            {clusters.map((cluster) => (
                                <ClusterAura
                                    key={`aura-${cluster.id}`}
                                    cluster={cluster}
                                    clusterCentersX={clusterCentersX}
                                    clusterCentersY={clusterCentersY}
                                    scale={scale}
                                    time={time}
                                />
                            ))}

                            {/* 🔥 ENHANCED: Edges mit dynamischer Dicke */}
                            {edgePairs?.map(([sourceId, targetId], idx) => (
                                <NeuralEdge
                                    key={`edge-${sourceId}-${targetId}`}
                                    sourceId={sourceId}
                                    targetId={targetId}
                                    nodes={nodes}
                                    nodePositionsX={nodePositionsX}
                                    nodePositionsY={nodePositionsY}
                                    time={time}
                                />
                            ))}

                            {insights.filter(ins => ins.type === 'bridge').map((insight, idx) => (
                                <InsightBridge
                                    key={`insight-${idx}`}
                                    nodes={insight.nodes}
                                    nodePositionsX={nodePositionsX}
                                    nodePositionsY={nodePositionsY}
                                    nodePositionsZ={nodePositionsZ}
                                    time={time}
                                />
                            ))}

                            {/* Node Rendering */}
                            {nodes.map((node, i) => (
                                <NeuralNode
                                    key={`node-${node.id}`}
                                    i={i}
                                    node={node}
                                    nodePositionsX={nodePositionsX}
                                    nodePositionsY={nodePositionsY}
                                    nodePositionsZ={nodePositionsZ}
                                    nodeImportance={nodeImportance}
                                    scale={scale}
                                    time={time}
                                    font={font}
                                    filterType={filterType}
                                    focusedNodeId={focusedNodeId}
                                />
                            ))}


                        </Group>

                    </Canvas>
                </Animated.View>
            </GestureDetector>

            {selectedNode && (
                <Pressable
                    style={styles.overlay}
                    onPress={() => {
                        setSelectedNode(null);
                        setFocusedNodeId(null);
                    }}
                >
                    <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.cardContainer}>
                        <BlurView intensity={80} tint="dark" style={styles.card}>
                            <View style={styles.typeTag}>
                                <Text style={styles.typeText}>{selectedNode.type.toUpperCase()}</Text>
                            </View>
                            <Text style={styles.content}>{selectedNode.content}</Text>
                            <Text style={styles.date}>
                                {new Date(selectedNode.timestamp).toLocaleDateString()}
                            </Text>
                        </BlurView>
                    </Animated.View>
                </Pressable>
            )}

            {/* 🌟 NEU: Visual Polish Layer */}
            <FilmGrainOverlay width={width} height={height} />
        </GestureHandlerRootView>
    );
}

// 🌟 NEU: Cluster Aura Component (Farbige Nebelzonen)
function ClusterAura({ cluster, clusterCentersX, clusterCentersY, scale, time }: any) {
    const opacity = useDerivedValue(() => {
        if (scale.value > 2.5) return 0; // Verschwinden bei starkem Zoom
        return Math.max(0.05, 0.35 - scale.value * 0.12);
    });

    const radius = useDerivedValue(() => {
        const baseRadius = Math.sqrt(cluster.node_count) * 80;
        return baseRadius * (1 / Math.max(0.5, scale.value));
    });

    const cx = useDerivedValue(() => clusterCentersX.value[cluster.id] || 0);
    const cy = useDerivedValue(() => clusterCentersY.value[cluster.id] || 0);

    const uniforms = useDerivedValue(() => ({
        u_center: [cx.value, cy.value],
        u_radius: radius.value,
        u_color: getClusterColor(cluster.id),
        u_time: time.value,
        u_intensity: Math.min(cluster.node_count / 15, 1.0)
    }));

    return (
        <Group opacity={opacity}>
            <Shader source={clusterAuraShader} uniforms={uniforms} />
        </Group>
    );
}

function InsightBridge({ nodes, nodePositionsX, nodePositionsY, nodePositionsZ, time }: any) {
    const p1 = useDerivedValue(() => ({
        x: (nodePositionsX.value[nodes[0]] ?? 0),
        y: (nodePositionsY.value[nodes[0]] ?? 0)
    }));

    const p2 = useDerivedValue(() => ({
        x: (nodePositionsX.value[nodes[1]] ?? 0),
        y: (nodePositionsY.value[nodes[1]] ?? 0)
    }));

    const opacity = useDerivedValue(() => {
        return 0.35 + 0.65 * Math.abs(Math.sin(time.value * 2));
    });

    return (
        <Group opacity={opacity}>
            <Line p1={p1} p2={p2} color="#f472b6" strokeWidth={3}>
                <Blur blur={5} />
            </Line>
            <Line p1={p1} p2={p2} color="#fff" strokeWidth={1} />
        </Group>
    );
}

// 🔥 SIMPLIFIED: Beautiful glowing edge with traveler particles
function NeuralEdge({ sourceId, targetId, nodes, nodePositionsX, nodePositionsY, time }: any) {
    // Find array indices for source and target
    const sourceIndex = nodes.findIndex((n: any) => n.id === sourceId);
    const targetIndex = nodes.findIndex((n: any) => n.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) return null;

    const p1 = useDerivedValue(() => ({
        x: nodePositionsX.value[sourceIndex] ?? 0,
        y: nodePositionsY.value[sourceIndex] ?? 0
    }));

    const p2 = useDerivedValue(() => ({
        x: nodePositionsX.value[targetIndex] ?? 0,
        y: nodePositionsY.value[targetIndex] ?? 0
    }));

    const uniforms = useDerivedValue(() => ({
        u_time: time.value,
        u_p1: [p1.value.x, p1.value.y],
        u_p2: [p2.value.x, p2.value.y],
        u_intensity: 0.8,
        u_color: [0.3, 0.4, 0.9] // Pulsing Indigo
    }));

    return (
        <Group>
            {/* The animated traveler shader */}
            <Shader source={edgeShader} uniforms={uniforms} />

            {/* Very faint static line for structure */}
            <Line
                p1={p1}
                p2={p2}
                color="rgba(99, 102, 241, 0.05)"
                strokeWidth={1}
            />
        </Group>
    );
}



function NeuralNode({
    i, node, nodePositionsX, nodePositionsY, nodePositionsZ,
    nodeImportance, scale, time, font, filterType, focusedNodeId
}: any) {

    const x = useDerivedValue(() => nodePositionsX.value[i] ?? 0);
    const y = useDerivedValue(() => nodePositionsY.value[i] ?? 0);

    // Filter logic (static - doesn't need SharedValue)
    const isFiltered = filterType !== 'all' && node.type !== filterType;
    const isFocused = node.id === focusedNodeId;

    // Wrap importance in useDerivedValue to avoid reading .value during render
    const importance = useDerivedValue(() => nodeImportance.value[i] ?? 1.0);
    const z = useDerivedValue(() => nodePositionsZ.value[i] ?? 0);

    return (
        <SemanticNode
            x={x}
            y={y}
            z={z}
            type={node.type}
            content={node.content}
            importance={importance}
            time={time}
            zoomLevel={scale}
            isFocused={isFocused}
            isFiltered={isFiltered}
            font={font}
        />
    );
}

function ClusterLabel({ cluster, clusterCentersX, clusterCentersY, clusterCentersZ, scale, font }: any) {
    const opacity = useDerivedValue(() => {
        const z = clusterCentersZ.value[cluster.id] || 0;
        const depthFactor = Math.max(0.15, 1 - z / 50000);

        if (scale.value < 0.6) return 0;
        if (scale.value > 1.5) return 0.15 * depthFactor;
        return (scale.value - 0.6) * 0.85 * depthFactor;
    });

    const pos = useDerivedValue(() => ({
        x: (clusterCentersX.value[cluster.id] || 0),
        y: (clusterCentersY.value[cluster.id] || 0) - 90
    }));

    return (
        <Group opacity={opacity}>
            <SkiaText
                x={useDerivedValue(() => pos.value.x - 50)}
                y={useDerivedValue(() => pos.value.y)}
                text={cluster.label.toUpperCase()}
                font={font}
                color="rgba(255, 255, 255, 0.7)"
            />
        </Group>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    canvasWrapper: { ...StyleSheet.absoluteFillObject },
    canvas: { ...StyleSheet.absoluteFillObject },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100
    },
    cardContainer: { width: '85%' },
    card: {
        padding: 32,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        overflow: 'hidden'
    },
    typeTag: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: 'rgba(99, 102, 241, 0.25)',
        marginBottom: 16
    },
    typeText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#818cf8',
        letterSpacing: 2
    },
    content: {
        fontSize: 20,
        color: '#fff',
        lineHeight: 30,
        fontWeight: '600',
        letterSpacing: -0.2
    },
    date: {
        marginTop: 24,
        fontSize: 13,
        color: 'rgba(255,255,255,0.4)',
        fontWeight: '500'
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000'
    },
    emptyText: {
        marginTop: 16,
        color: '#818cf8',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 1
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 8,
    },
    emptySubtext: {
        marginTop: 8,
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 12,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
});
