/**
 * 🌌 NEURAL HORIZON 2.0 — SYNAPSE RUNTIME
 * Architecture: Deterministic Event-Spine (HEB) + Raptor Physics
 */

import {
    Blur,
    Canvas,
    Circle,
    Group,
    Line,
    Shader,
    Skia
} from '@shopify/react-native-skia';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import {
    Extrapolate,
    interpolate,
    useDerivedValue,
    useFrameCallback,
    useSharedValue
} from 'react-native-reanimated';

import { getAllClusters, getAllEdges, getDb, isDatabaseReady } from '../db';
import { Snippet } from '../db/schema';
import { useCTC } from '../store/CognitiveTempoController';
import { useContextStore } from '../store/contextStore';
import { FilmGrainOverlay } from './visuals/FilmGrain';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- SHADER CORE (Award-Grade Kinematics) ---

const backgroundShader = Skia.RuntimeEffect.Make(`
  uniform float u_time;
  uniform vec2 u_res;
  uniform vec2 u_offset;
  uniform float u_scale;
  uniform vec2 u_focusPos;
  uniform float u_focusIntensity;

  half4 main(vec2 pos) {
    vec2 uv = pos / u_res;
    vec2 p = (pos - u_res * 0.5) / u_scale + u_offset;
    
    // Deep Space Gradient
    vec3 spaceColor = mix(vec3(0.003, 0.004, 0.012), vec3(0.0), length(uv - 0.5));
    
    // Synapse Nebula
    float n = sin(p.x * 0.001 + u_time * 0.2) * cos(p.y * 0.001);
    vec3 nebula = vec3(0.04, 0.03, 0.12) * max(0.0, n);
    
    // Focus Aura (McKinsey Clarity)
    float distToFocus = length(p - u_focusPos);
    float focusGlow = (u_focusIntensity * 120.0) / (distToFocus + 400.0);
    vec3 aura = vec3(0.3, 0.4, 1.0) * pow(focusGlow, 1.5) * 0.05;

    return half4(spaceColor + nebula + aura, 1.0);
  }
`)!;

// --- THE SYNAPSE LAYER (Control Plane) ---

interface NeuralCanvasProps {
    filterType?: 'all' | 'fact' | 'feeling' | 'goal';
    layoutY?: any;
}

export const NeuralCanvas = ({ filterType = 'all', layoutY }: NeuralCanvasProps) => {
    const [nodes, setNodes] = useState<Snippet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [edgePairs, setEdgePairs] = useState<[number, number][]>([]);
    const [clusters, setClusters] = useState<any[]>([]);

    // 1. Focus Engine (EWMA Stabilizer)
    const rawFocusX = useSharedValue(0);
    const rawFocusY = useSharedValue(0);
    const stableFocusX = useSharedValue(0);
    const stableFocusY = useSharedValue(0);

    // 2. Camera & World State
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(0.4);
    const time = useSharedValue(0);

    // 3. Raptor Physics Buffers (Zero-Copy Shared Memory)
    const nodeCount = useSharedValue(0);
    const posX = useSharedValue(new Float32Array(500).fill(0));
    const posY = useSharedValue(new Float32Array(500).fill(0));
    const velX = useSharedValue(new Float32Array(500).fill(0));
    const velY = useSharedValue(new Float32Array(500).fill(0));
    const clusterIds = useSharedValue(new Int32Array(500).fill(-1));

    // 4. Trinity Sync Subscription
    const nodeRefreshTrigger = useContextStore((state) => state.nodeRefreshTrigger);
    const activeFocusNodeId = useContextStore((state) => state.focusNodeId);

    // 5. CTC Limits (Cognitive Tempo Control)
    const ctcMaxVelocity = useSharedValue(30);
    const ctcBloomCap = useSharedValue(1.0);
    const ctcEdgeActivity = useSharedValue(1);

    // Sync CTC limits to shared values
    const ctcLimits = useCTC(state => state.limits);
    useEffect(() => {
        ctcMaxVelocity.value = ctcLimits.maxVelocity;
        ctcBloomCap.value = ctcLimits.bloomIntensityCap;
        ctcEdgeActivity.value = ctcLimits.edgeActivityLevel;
    }, [ctcLimits]);

    // --- DATA BOOTSTRAP (SpaceX Pre-Flight) ---
    useEffect(() => {
        const bootstrap = async () => {
            if (!isDatabaseReady()) {
                setTimeout(bootstrap, 100);
                return;
            }

            const db = await getDb();
            const results = await db.execute('SELECT * FROM snippets');
            const snips = (results.rows as unknown as Snippet[]) || [];

            const [edges, cls] = await Promise.all([getAllEdges(), getAllClusters()]);

            // Initialize Physics Arrays
            const newPosX = new Float32Array(500);
            const newPosY = new Float32Array(500);
            const newVelX = new Float32Array(500);
            const newVelY = new Float32Array(500);
            const newCIds = new Int32Array(500).fill(-1);

            snips.forEach((s, i) => {
                newPosX[i] = (Math.random() - 0.5) * 400;
                newPosY[i] = (Math.random() - 0.5) * 400;
                newVelX[i] = (Math.random() - 0.5) * 20;
                newVelY[i] = (Math.random() - 0.5) * 20;
                newCIds[i] = s.cluster_id || -1;
            });

            posX.value = newPosX;
            posY.value = newPosY;
            velX.value = newVelX;
            velY.value = newVelY;
            clusterIds.value = newCIds;
            nodeCount.value = snips.length;

            setNodes(snips);
            setEdgePairs(edges);
            setClusters(cls);
            setIsLoading(false);
        };
        bootstrap();
    }, [nodeRefreshTrigger]);

    // --- RAPTOR PHYSICS LOOP (The Governor) ---
    useFrameCallback((info) => {
        'worklet';
        const delta = (info.timeSinceFirstFrame || 16.6) / 1000;
        time.value = (info.timestamp || 0) / 1000;
        const n = nodeCount.value;
        if (n === 0) return;

        const friction = 0.92;
        const repulsion = 1200;
        const centerGravity = 0.015;
        const alpha = 0.08; // EWMA Focus Smoothing

        // Stabilize Focus Vector (EWMA)
        stableFocusX.value = stableFocusX.value + (rawFocusX.value - stableFocusX.value) * alpha;
        stableFocusY.value = stableFocusY.value + (rawFocusY.value - stableFocusY.value) * alpha;

        const curX = posX.value;
        const curY = posY.value;
        const vX = velX.value;
        const vY = velY.value;

        for (let i = 0; i < n; i++) {
            let fx = 0;
            let fy = 0;

            // 1. Central Focus Gravity
            fx += (stableFocusX.value - curX[i]) * centerGravity;
            fy += (stableFocusY.value - curY[i]) * centerGravity;

            // 2. Fast Repulsion (McKinsey Clarity Culling)
            for (let j = 0; j < n; j++) {
                if (i === j) continue;
                const dx = curX[i] - curX[j];
                const dy = curY[i] - curY[j];
                const dSq = dx * dx + dy * dy + 100;
                if (dSq < 20000) { // Culling: only calculate nearby nodes
                    const f = repulsion / dSq;
                    fx += dx * f;
                    fy += dy * f;
                }
            }

            // Apply forces with friction
            vX[i] = (vX[i] + fx) * friction;
            vY[i] = (vY[i] + fy) * friction;

            // Velocity clamp for stability (CTC-governed)
            const maxV = ctcMaxVelocity.value;
            const v = Math.sqrt(vX[i] * vX[i] + vY[i] * vY[i]);
            if (v > maxV) {
                vX[i] = (vX[i] / v) * maxV;
                vY[i] = (vY[i] / v) * maxV;
            }

            curX[i] += vX[i] * delta * 60;
            curY[i] += vY[i] * delta * 60;
        }
    });

    const canvasTransform = useDerivedValue(() => [
        { translateX: SCREEN_WIDTH / 2 },
        { translateY: SCREEN_HEIGHT / 2 },
        { scale: scale.value },
        { translateX: translateX.value },
        { translateY: translateY.value }
    ]);

    const backgroundUniforms = useDerivedValue(() => ({
        u_time: time.value,
        u_res: [SCREEN_WIDTH, SCREEN_HEIGHT],
        u_offset: [translateX.value, translateY.value],
        u_scale: scale.value,
        u_focusPos: [stableFocusX.value, stableFocusY.value],
        u_focusIntensity: 1.0
    }));

    // --- GESTURES (Kinematic Grammar + CTC Governance) ---
    const ctcAllowTranslation = useSharedValue(true);

    // Sync CTC translation permission
    useEffect(() => {
        ctcAllowTranslation.value = ctcLimits.allowCameraTranslation;
    }, [ctcLimits]);

    const gesture = Gesture.Simultaneous(
        Gesture.Pan()
            .onStart(() => {
                'worklet';
                // CTC Touch on gesture start (runOnJS not needed - we'll use effect)
            })
            .onChange(e => {
                'worklet';
                // Phase A1: Camera Governance - only translate if CTC allows
                if (!ctcAllowTranslation.value) {
                    // AWARENESS mode: only allow rotation-like subtle drift
                    rawFocusX.value -= e.changeX * 0.1;
                    rawFocusY.value -= e.changeY * 0.1;
                    return;
                }

                translateX.value += e.changeX / scale.value;
                translateY.value += e.changeY / scale.value;
                // Shift focus inversely for parallax feel
                rawFocusX.value -= e.changeX * 0.3;
                rawFocusY.value -= e.changeY * 0.3;
            }),
        Gesture.Pinch().onChange(e => {
            'worklet';
            scale.value = Math.min(2.0, Math.max(0.2, scale.value * e.scaleChange));
        })
    );

    // CTC touch on any gesture (runs on JS thread)
    const handleGestureStart = () => {
        useCTC.getState().touch();
    };

    if (isLoading) return (
        <View style={styles.loader}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loaderText}>Initializing Neural Matrix...</Text>
        </View>
    );

    if (nodes.length === 0) return (
        <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🌌</Text>
            <Text style={styles.emptyText}>The Horizon is quiet.</Text>
            <Text style={styles.emptySubtext}>Start a conversation in Orbit to seed your universe.</Text>
        </View>
    );

    return (
        <GestureHandlerRootView style={styles.container}>
            <GestureDetector gesture={gesture}>
                <Canvas style={styles.canvas}>
                    <Shader source={backgroundShader} uniforms={backgroundUniforms} />

                    <Group transform={canvasTransform}>
                        {/* Semantic Edges */}
                        {edgePairs.map(([s, t], idx) => (
                            <NeuralEdge key={idx} s={s} t={t} nodes={nodes} posX={posX} posY={posY} time={time} edgeActivityLevel={ctcEdgeActivity} />
                        ))}

                        {/* Neural Nodes */}
                        {nodes.map((node, i) => (
                            <NeuralNode
                                key={node.id}
                                i={i}
                                node={node}
                                posX={posX}
                                posY={posY}
                                scale={scale}
                                time={time}
                                isActive={node.id === activeFocusNodeId}
                            />
                        ))}
                    </Group>
                </Canvas>
            </GestureDetector>
            <FilmGrainOverlay width={SCREEN_WIDTH} height={SCREEN_HEIGHT} />
        </GestureHandlerRootView>
    );
};

// --- SUB-COMPONENTS (Premium Immersion) ---

const TYPE_COLORS: Record<string, string> = {
    fact: '#22d3ee',    // Cyan
    feeling: '#e879f9', // Magenta
    goal: '#fde047',    // Gold
};

// Phase A3: Edge Activity States
type EdgeState = 'DORMANT' | 'BREATHING' | 'ACTIVE';

const NeuralEdge = ({ s, t, nodes, posX, posY, time, edgeActivityLevel }: any) => {
    const sIdx = useMemo(() => nodes.findIndex((n: any) => n.id === s), [nodes, s]);
    const tIdx = useMemo(() => nodes.findIndex((n: any) => n.id === t), [nodes, t]);

    const p1 = useDerivedValue(() => ({ x: posX.value[sIdx] ?? 0, y: posY.value[sIdx] ?? 0 }));
    const p2 = useDerivedValue(() => ({ x: posX.value[tIdx] ?? 0, y: posY.value[tIdx] ?? 0 }));

    // Phase A3: Edge opacity based on CTC activity level
    const opacity = useDerivedValue(() => {
        const level = edgeActivityLevel?.value ?? 1;

        if (level === 0) {
            // DORMANT: Nearly invisible
            return 0.03;
        } else if (level === 1) {
            // BREATHING: Subtle pulse
            return 0.06 + Math.sin(time.value * 1.5) * 0.02;
        } else {
            // ACTIVE: Full visibility with pulse
            return 0.12 + Math.sin(time.value * 3) * 0.04;
        }
    });

    if (sIdx === -1 || tIdx === -1) return null;

    return (
        <Group opacity={opacity}>
            <Line p1={p1} p2={p2} color="rgba(99, 102, 241, 0.15)" strokeWidth={1} />
        </Group>
    );
};

const NeuralNode = ({ i, node, posX, posY, scale, time, isActive }: any) => {
    const color = TYPE_COLORS[node.type] || TYPE_COLORS.fact;

    const x = useDerivedValue(() => posX.value[i] ?? 0);
    const y = useDerivedValue(() => posY.value[i] ?? 0);

    const radius = useDerivedValue(() => {
        const base = isActive ? 14 : 8;
        const pulse = 1 + Math.sin(time.value * 3 + i) * 0.1;
        return base * pulse;
    });

    const glowRadius = useDerivedValue(() => radius.value * 2.5);

    const opacity = useDerivedValue(() => {
        return interpolate(scale.value, [0.2, 0.5], [0.5, 1.0], Extrapolate.CLAMP);
    });

    return (
        <Group opacity={opacity}>
            {/* Outer Glow */}
            <Circle cx={x} cy={y} r={glowRadius} color={color} opacity={0.15}>
                <Blur blur={12} />
            </Circle>
            {/* Core */}
            <Circle cx={x} cy={y} r={radius} color={color}>
                <Blur blur={isActive ? 3 : 0} />
            </Circle>
        </Group>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    canvas: { flex: 1 },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000'
    },
    loaderText: {
        marginTop: 16,
        color: '#818cf8',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 1
    },
    empty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000'
    },
    emptyIcon: { fontSize: 48 },
    emptyText: {
        marginTop: 16,
        color: '#818cf8',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 1
    },
    emptySubtext: {
        marginTop: 8,
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 12,
        textAlign: 'center',
        paddingHorizontal: 40
    }
});
