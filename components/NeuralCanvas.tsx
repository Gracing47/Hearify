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

import { getAllClusters, getAllSnippetsWithFastEmbeddings } from '../db';
import { Snippet } from '../db/schema';
import { IntelligenceService } from '../services/intelligence';
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

// 🎨 ENHANCED: Node Shader mit Temporal Tinting
// 🎨 ENHANCED: Node Shader mit "Organic Bloom" & Sentiment Neon
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

// 🌊 ENHANCED: Background mit stärkerer Cluster-Visualisierung
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
    
    float stars1 = star(p, 0.05);
    float stars2 = star(p * 2.0, 0.03);
    float stars3 = star(p * 0.5, 0.1);

    float distToCore = length(p);
    float coreGlow = 0.2 / (1.0 + distToCore * 0.002);
    
    float distToAvg = length(p - u_avgPos);
    float auraGlow = (u_energy * 0.08) / (1.0 + distToAvg * 0.004);
    vec3 auraColor = vec3(0.35, 0.45, 0.95) * auraGlow;
    
    vec3 color1 = vec3(0.008, 0.008, 0.025);
    vec3 color2 = vec3(0.0, 0.0, 0.0);    
    vec3 nebula = vec3(0.05, 0.05, 0.15) * stars2;
    
    vec3 finalColor = mix(color1, color2, uv.y);
    finalColor += stars1 * 0.5 + stars3 * 0.25 + nebula + auraColor + (vec3(0.5, 0.5, 1.0) * coreGlow);
    
    float vignette = 1.0 - length(uv - 0.5) * 0.7;
    return half4(finalColor * vignette, 1.0);
  }
`)!;

// 🔥 ENHANCED: Edge Shader mit dynamischer Dicke
// 🔥 ENHANCED: Edge Shader mit Traveler Particles
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
    vec3 particleColor = u_color * 2.0;
    float particleAlpha = particle * smoothstep(2.0, 0.0, dist) * 0.8;
    
    vec3 finalColor = u_color * alpha + particleColor * particleAlpha;
    float finalAlpha = alpha + particleAlpha;
    
    return half4(finalColor * finalAlpha, finalAlpha * u_intensity);
  }
`)!;

// 🌟 NEU: Cluster Aura Shader (Farbige Nebelzonen)
const clusterAuraShader = Skia.RuntimeEffect.Make(`
  uniform vec2 u_center;
  uniform float u_radius;
  uniform vec3 u_color;
  uniform float u_time;
  uniform float u_intensity;

  half4 main(vec2 pos) {
    vec2 toCenter = pos - u_center;
    float d = length(toCenter);
    
    // Organischer Puls
    float pulse = 0.9 + 0.1 * sin(u_time * 1.5);
    float effectiveRadius = u_radius * pulse;
    
    // Weicher Falloff
    float falloff = smoothstep(effectiveRadius, effectiveRadius * 0.3, d);
    
    // Rotierender Nebel-Effekt
    float angle = atan(toCenter.y, toCenter.x);
    float noise = sin(angle * 3.0 + u_time) * 0.15 + 0.85;
    
    float finalAlpha = falloff * u_intensity * noise * 0.18;
    
    return half4(u_color * finalAlpha, finalAlpha);
  }
`)!;

const getSentimentAura = (sentiment?: string): number[] => {
    switch (sentiment) {
        case 'analytical': return [0.3, 0.5, 1.0];
        case 'positive': return [1.0, 0.85, 0.2];
        case 'creative': return [0.4, 0.3, 0.9];
        default: return [0.4, 0.4, 0.5];
    }
};

const getNodeColorVec = (type: string): number[] => {
    switch (type) {
        case 'goal': return [0.99, 0.88, 0.22]; // Yellow
        case 'feeling': return [0.91, 0.25, 0.98]; // Purple
        case 'fact': return [0.13, 0.83, 0.93]; // Cyan
        default: return [0.8, 0.8, 0.8];
    }
};

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
    const [focusedNodeId, setFocusedNodeId] = useState<number | null>(null);

    const { width, height } = useWindowDimensions();
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);
    const time = useSharedValue(0);

    const boundsMinX = useSharedValue(-200);
    const boundsMaxX = useSharedValue(200);
    const boundsMinY = useSharedValue(-200);
    const boundsMaxY = useSharedValue(200);

    const nodePositionsX = useSharedValue<number[]>([]);
    const nodePositionsY = useSharedValue<number[]>([]);
    const nodePositionsZ = useSharedValue<number[]>([]);
    const nodeTargetZ = useSharedValue<number[]>([]);
    const nodeKnnIndices = useSharedValue<number[]>([]);
    const nodeVelocitiesX = useSharedValue<number[]>([]);
    const nodeVelocitiesY = useSharedValue<number[]>([]);
    const nodeVelocitiesZ = useSharedValue<number[]>([]);
    const nodeClusterIds = useSharedValue<number[]>([]);
    const similarityMatrix = useSharedValue<number[]>([]);
    const clusterCentersX = useSharedValue<number[]>([]);
    const clusterCentersY = useSharedValue<number[]>([]);
    const clusterCentersZ = useSharedValue<number[]>([]);
    const [clusters, setClusters] = useState<Cluster[]>([]);
    const [insights, setInsights] = useState<any[]>([]);

    // 🔥 NEU: Node Importance Tracking
    const nodeImportance = useSharedValue<number[]>([]);
    const nodeLastAccessed = useSharedValue<number[]>([]);

    const [edgePairs, setEdgePairs] = useState<[number, number][]>([]);

    useEffect(() => {
        const load = async () => {
            const startLoad = Date.now();
            const snippets = await getAllSnippetsWithFastEmbeddings();
            if (snippets.length === 0) return;

            const n = snippets.length;
            const initialX = snippets.map(s => (s.x && s.x !== 0) ? s.x : (Math.random() - 0.5) * 1200);
            const initialY = snippets.map(s => (s.y && s.y !== 0) ? s.y : (Math.random() - 0.5) * 1200);

            const now = Date.now();
            const dayInMs = 24 * 60 * 60 * 1000;
            const initialZ = snippets.map(s => {
                const ageDays = (now - s.timestamp) / dayInMs;
                return -Math.min(ageDays * 20, 1000);
            });

            const dbClusters = await getAllClusters();
            setClusters(dbClusters);

            const clusterIds = snippets.map(s => s.cluster_id || -1);

            const matrix = new Float32Array(n * n);
            const edges: [number, number][] = [];

            for (let i = 0; i < n; i++) {
                const vecI = snippets[i].embedding;
                if (!vecI) continue;

                for (let j = i + 1; j < n; j++) {
                    const vecJ = snippets[j].embedding;
                    if (vecJ) {
                        const sim = cosineSimilarity(vecI, vecJ);
                        matrix[i * n + j] = sim;
                        matrix[j * n + i] = sim;
                        if (sim > 0.78) { // Leicht gesenkt für mehr Verbindungen
                            edges.push([i, j]);
                        }
                    }
                }
            }

            const k = 5;
            const knnIndices = new Int32Array(n * k).fill(-1);
            const importance = new Array(n).fill(0);

            for (let i = 0; i < n; i++) {
                const neighbors: { idx: number; sim: number }[] = [];
                for (let j = 0; j < n; j++) {
                    if (i === j) continue;
                    const sim = matrix[i * n + j];
                    if (sim > 0.5) {
                        neighbors.push({ idx: j, sim });
                    }
                }

                neighbors.sort((a, b) => b.sim - a.sim);

                for (let m = 0; m < Math.min(k, neighbors.length); m++) {
                    knnIndices[i * k + m] = neighbors[m].idx;
                }

                // 🔥 Calculate Importance (Connection Count + Type Weight + Recency)
                const connectionCount = neighbors.length;
                const recency = 1 - Math.abs(initialZ[i]) / 1000;
                const typeWeight = snippets[i].type === 'goal' ? 1.5 :
                    snippets[i].type === 'feeling' ? 1.2 : 1.0;

                importance[i] = 0.6 + (connectionCount / 10) * 0.4 + recency * 0.5 + (typeWeight - 1) * 0.5;
            }

            console.log(`[NeuralCanvas] Calculations for ${n} nodes took ${Date.now() - startLoad}ms`);

            nodePositionsX.value = initialX;
            nodePositionsY.value = initialY;
            nodePositionsZ.value = initialZ;
            nodeTargetZ.value = initialZ;
            nodeVelocitiesX.value = new Array(n).fill(0).map(() => (Math.random() - 0.5) * 40);
            nodeVelocitiesY.value = new Array(n).fill(0).map(() => (Math.random() - 0.5) * 40);
            nodeVelocitiesZ.value = new Array(n).fill(0);
            nodeKnnIndices.value = Array.from(knnIndices);
            similarityMatrix.value = Array.from(matrix);
            nodeClusterIds.value = clusterIds;
            nodeImportance.value = importance;
            nodeLastAccessed.value = snippets.map(s => s.timestamp);

            setEdgePairs(edges);
            setNodes(snippets);

            const dbInsights = await IntelligenceService.detectInsights();
            setInsights(dbInsights);

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

            const contentWidth = maxX - minX + 50;
            const contentHeight = maxY - minY + 50;
            const fitScaleX = width / contentWidth;
            const fitScaleY = height / contentHeight;
            const initialScale = Math.min(Math.min(fitScaleX, fitScaleY) * 3.2, 5.0);

            scale.value = Math.max(initialScale, 1.8);
        };
        load();
    }, []);

    // 🔥 ENHANCED: Stärkere Cluster-Kräfte
    useFrameCallback((info) => {
        'worklet';
        time.value = info.timestamp / 1000;
        const n = nodePositionsX.value.length;
        if (n === 0) return;

        const friction = 0.985;
        const repulsionK = 1000;
        const springK = 0.018; // Leicht erhöht
        const clusterAttraction = 0.055; // 🔥 STARK erhöht (war 0.035)
        const driftIntensity = 0.12;
        const centerAttraction = 0.002;

        const nextPosX = [...nodePositionsX.value];
        const nextPosY = [...nodePositionsY.value];
        const nextPosZ = [...nodePositionsZ.value];
        const nextVelX = [...nodeVelocitiesX.value];
        const nextVelY = [...nodeVelocitiesY.value];
        const nextVelZ = [...nodeVelocitiesZ.value];

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

        const k = 5;
        for (let i = 0; i < n; i++) {
            let fx = 0, fy = 0, fz = 0;

            for (let m = 0; m < k; m++) {
                const neighborIdx = nodeKnnIndices.value[i * k + m];
                if (neighborIdx === -1 || neighborIdx === undefined) continue;

                const dx = (nextPosX[neighborIdx] ?? 0) - (nextPosX[i] ?? 0);
                const dy = (nextPosY[neighborIdx] ?? 0) - (nextPosY[i] ?? 0);
                const dz = (nextPosZ[neighborIdx] ?? 0) - (nextPosZ[i] ?? 0);

                const strength = springK * (1.3 - m / k);
                fx += dx * strength;
                fy += dy * strength;
                fz += dz * strength;
            }

            const myClusterId = nodeClusterIds.value[i] ?? -1;
            if (myClusterId !== -1 && finalCCX[myClusterId] !== undefined) {
                fx += ((finalCCX[myClusterId] ?? 0) - (nextPosX[i] ?? 0)) * clusterAttraction;
                fy += ((finalCCY[myClusterId] ?? 0) - (nextPosY[i] ?? 0)) * clusterAttraction;
                fz += ((finalCCZ[myClusterId] ?? 0) - (nextPosZ[i] ?? 0)) * clusterAttraction;
            }

            for (let j = 0; j < n; j++) {
                if (i === j) continue;

                const dx = (nextPosX[i] ?? 0) - (nextPosX[j] ?? 0);
                const dy = (nextPosY[i] ?? 0) - (nextPosY[j] ?? 0);
                const dz = (nextPosZ[i] ?? 0) - (nextPosZ[j] ?? 0);
                const distSq = dx * dx + dy * dy + dz * dz || 0.1;
                let dist = Math.sqrt(distSq);

                const repelForce = repulsionK / (distSq + 50);

                if (dist < 0.1) {
                    fx += (Math.random() - 0.5) * 2.0;
                    fy += (Math.random() - 0.5) * 2.0;
                } else {
                    fx += (dx / dist) * repelForce;
                    fy += (dy / dist) * repelForce;
                    fz += (dz / dist) * repelForce;
                }
            }

            fx += Math.sin(time.value * 0.7 + i) * driftIntensity;
            fy += Math.cos(time.value * 0.5 + i) * driftIntensity;
            fz += Math.sin(time.value * 0.3 + i) * driftIntensity;

            fx -= (nextPosX[i] ?? 0) * centerAttraction;
            fy -= (nextPosY[i] ?? 0) * centerAttraction;

            const targetZ = nodeTargetZ.value[i] ?? 0;
            fz += (targetZ - (nextPosZ[i] ?? 0)) * 0.05;

            if (isNaN(fx)) fx = 0;
            if (isNaN(fy)) fy = 0;
            if (isNaN(fz)) fz = 0;

            const vx = ((nextVelX[i] ?? 0) + fx) * friction;
            const vy = ((nextVelY[i] ?? 0) + fy) * friction;
            const vz = ((nextVelZ[i] ?? 0) + fz) * friction;

            nextVelX[i] = isNaN(vx) ? 0 : vx;
            nextVelY[i] = isNaN(vy) ? 0 : vy;
            nextVelZ[i] = isNaN(vz) ? 0 : vz;

            const px = (nextPosX[i] ?? 0) + (nextVelX[i] ?? 0);
            const py = (nextPosY[i] ?? 0) + (nextVelY[i] ?? 0);
            const pz = (nextPosZ[i] ?? 0) + (nextVelZ[i] ?? 0);

            nextPosX[i] = isNaN(px) ? (Math.random() - 0.5) * 100 : px;
            nextPosY[i] = isNaN(py) ? (Math.random() - 0.5) * 100 : py;
            nextPosZ[i] = isNaN(pz) ? (Math.random() - 0.5) * 100 : pz;
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
                    runOnJS(setSelectedNode)(nodes[i]);
                    runOnJS(setFocusedNodeId)(nodes[i].id);

                    // Update last accessed
                    const newAccessed = [...nodeLastAccessed.value];
                    newAccessed[i] = Date.now();
                    nodeLastAccessed.value = newAccessed;
                    break;
                }
            }
        });

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
            u_energy: Math.min(n, 50)
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
                            {edgePairs?.map(([i, j]) => (
                                <NeuralEdge
                                    key={`edge-${i}-${j}`}
                                    i={i}
                                    j={j}
                                    n={nodes.length}
                                    nodePositionsX={nodePositionsX}
                                    nodePositionsY={nodePositionsY}
                                    nodePositionsZ={nodePositionsZ}
                                    similarityMatrix={similarityMatrix}
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

                            {/* 🔥 ENHANCED: Nodes mit allen Features */}
                            {nodes.map((node, i) => (
                                <NeuralNode
                                    key={`node-${node.id}`}
                                    i={i}
                                    node={node}
                                    nodePositionsX={nodePositionsX}
                                    nodePositionsY={nodePositionsY}
                                    nodePositionsZ={nodePositionsZ}
                                    nodeImportance={nodeImportance}
                                    nodeLastAccessed={nodeLastAccessed}
                                    translateX={translateX}
                                    translateY={translateY}
                                    scale={scale}
                                    time={time}
                                    font={font}
                                    filterType={filterType}
                                    focusedNodeId={focusedNodeId}
                                    allNodes={nodes}
                                    nodeKnnIndices={nodeKnnIndices}
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

// 🔥 ENHANCED: Edge mit dynamischer Dicke
function NeuralEdge({ i, j, n, nodePositionsX, nodePositionsY, nodePositionsZ, similarityMatrix, time }: any) {
    const similarity = useDerivedValue(() => {
        return similarityMatrix.value[i * n + j] ?? 0;
    });

    const isVisible = useDerivedValue(() => similarity.value >= 0.78);

    const ageFactor = useDerivedValue(() => {
        const avgZ = ((nodePositionsZ.value[i] ?? 0) + (nodePositionsZ.value[j] ?? 0)) / 2;
        return Math.max(0.25, 1 + avgZ / 1000);
    });

    const thickness = useDerivedValue(() => {
        // Dicke basierend auf Ähnlichkeit: 0.78 → 0, 1.0 → 1
        return (similarity.value - 0.78) / 0.22;
    });

    const p1 = useDerivedValue(() => ({
        x: nodePositionsX.value[i] ?? 0,
        y: nodePositionsY.value[i] ?? 0
    }));

    const p2 = useDerivedValue(() => ({
        x: nodePositionsX.value[j] ?? 0,
        y: nodePositionsY.value[j] ?? 0
    }));

    const intensity = useDerivedValue(() => {
        return (similarity.value - 0.75) * 4;
    });

    const uniforms = useDerivedValue(() => ({
        u_time: time.value,
        u_p1: [p1.value.x, p1.value.y],
        u_p2: [p2.value.x, p2.value.y],
        u_intensity: intensity.value,
        u_color: [0.38, 0.38, 0.99] // Neon Blue for edges
    }));

    const edgeOpacity = useDerivedValue(() => isVisible.value ? 1 : 0);

    const strokeWidth = useDerivedValue(() => {
        const base = 0.5 + thickness.value * 2.5;
        const pulse = 1 + 0.2 * Math.sin(time.value * 2);
        return base * pulse;
    });

    return (
        <Group opacity={edgeOpacity}>
            <Shader source={edgeShader} uniforms={uniforms} />
            <Line
                p1={p1}
                p2={p2}
                color="rgba(99, 102, 241, 0.15)"
                strokeWidth={strokeWidth}
            />
        </Group>
    );
}

// ... (existing helper functions like getSentimentAura, cosineSimilarity, etc. remain unchanged)

function NeuralNode({
    i, node, nodePositionsX, nodePositionsY, nodePositionsZ,
    nodeImportance, nodeLastAccessed, translateX, translateY,
    scale, time, font, filterType, focusedNodeId, allNodes, nodeKnnIndices
}: any) {

    const x = useDerivedValue(() => nodePositionsX.value[i] ?? 0);
    const y = useDerivedValue(() => nodePositionsY.value[i] ?? 0);

    // Color mapping
    const colorStr = node.type === 'goal' ? "#fde047" : // yellow-300
        node.type === 'feeling' ? "#e879f9" : // fuchsia-400
            "#22d3ee"; // cyan-400

    // Filter logic
    const isFiltered = filterType !== 'all' && node.type !== filterType;
    const isFocused = node.id === focusedNodeId;

    // Opacity for filtering/focus (can overlay on top of SemanticNode or pass as prop?)
    // SemanticNode is simple. We might need to wrap it in a Group to apply opacity.

    const nodeOpacity = useDerivedValue(() => {
        const z = nodePositionsZ.value[i] ?? 0;
        const zOp = Math.max(0.2, 1 - Math.abs(z) / 50000);
        const base = isFiltered ? 0.2 : 1.0;
        const focus = (focusedNodeId && !isFocused) ? 0.3 : 1.0;
        return base * zOp * focus;
    });

    // Vector Color for Shader
    const colorVec = getNodeColorVec(node.type);

    // Active State (Pulse when focused or recently accessed)
    const active = useDerivedValue(() => {
        return (isFocused ? 1.0 : 0.0) as number;
    });

    // Depth of Field (DoF)
    const blur = useDerivedValue(() => {
        const z = nodePositionsZ.value[i] ?? 0;
        // Blur increases with distance from camera (camera at Z > 0, nodes at Z <= 0)
        // Let's assume focus plane is at Z=0.
        return Math.min(Math.abs(z) / 100, 8); // Max blur 8px
    });

    return (
        <Group opacity={nodeOpacity}>
            <SemanticNode
                x={x}
                y={y}
                color={colorStr}
                label="" // No label
                zoomLevel={scale}
                selected={isFocused}
                shader={nodeShader}
                time={time}
                active={active}
                colorVec={colorVec}
                blur={blur} font={undefined} />
        </Group>
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
    }
});
