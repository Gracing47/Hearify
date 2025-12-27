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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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

            // 🏠 ORBITAL CONSTELLATION: Nodes arranged in stable orbital rings
            const newPosX = new Float32Array(500);
            const newPosY = new Float32Array(500);
            const newVelX = new Float32Array(500); // Now stores orbital angle
            const newVelY = new Float32Array(500); // Now stores orbital radius
            const newCIds = new Int32Array(500).fill(-1);

            // Calculate orbital parameters for each node
            const numNodes = snips.length;
            const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // 137.5° - creates beautiful spiral

            snips.forEach((s, i) => {
                // � GOLDEN SPIRAL PLACEMENT: Creates natural, balanced distribution
                const angle = i * goldenAngle;
                const radiusFactor = Math.sqrt(i + 1) / Math.sqrt(numNodes + 1);
                const baseRadius = 80 + radiusFactor * 350; // Inner: 80px, Outer: 430px

                // Add slight randomness for organic feel
                const radiusJitter = (Math.random() - 0.5) * 30;
                const angleJitter = (Math.random() - 0.5) * 0.2;

                const finalRadius = baseRadius + radiusJitter;
                const finalAngle = angle + angleJitter;

                // Set initial position on orbital path
                newPosX[i] = Math.cos(finalAngle) * finalRadius;
                newPosY[i] = Math.sin(finalAngle) * finalRadius;

                // Store orbital parameters (angle, radius) for smooth orbital motion
                newVelX[i] = finalAngle; // Current orbital angle
                newVelY[i] = finalRadius; // Orbital radius

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

    // --- 🏠 ORBITAL CONSTELLATION PHYSICS (Home-like Calm) ---
    useFrameCallback((info) => {
        'worklet';
        time.value = (info.timestamp || 0) / 1000;
        const n = nodeCount.value;
        if (n === 0) return;

        // 🌊 ULTRA-SLOW orbital drift - like stars gently rotating
        const baseOrbitalSpeed = 0.008; // Very slow rotation (full orbit ~13 minutes)
        const t = time.value;

        // Stabilize Focus Vector (EWMA) - for subtle attraction to camera focus
        const alpha = 0.02; // Even smoother stabilization
        stableFocusX.value = Number(stableFocusX.value) + (Number(rawFocusX.value) - Number(stableFocusX.value)) * alpha;
        stableFocusY.value = Number(stableFocusY.value) + (Number(rawFocusY.value) - Number(stableFocusY.value)) * alpha;

        const curX = posX.value;
        const curY = posY.value;
        const angles = velX.value;  // Orbital angles
        const radii = velY.value;   // Orbital radii

        for (let i = 0; i < n; i++) {
            // 🌀 ORBITAL MOTION: Each node orbits at its own radius
            // Inner nodes orbit slightly faster (Kepler-like)
            const radiusFactor = radii[i] / 400; // 0 to 1
            const orbitalSpeed = baseOrbitalSpeed * (1.2 - radiusFactor * 0.5); // Inner: faster, Outer: slower

            // Update orbital angle
            angles[i] += orbitalSpeed;

            // 🌊 BREATHING RADIUS: Orbit expands/contracts gently
            const breathingPhase = t * 0.1 + i * 0.5; // Very slow breathing
            const breathingAmplitude = 8; // Subtle 8px expansion
            const currentRadius = radii[i] + Math.sin(breathingPhase) * breathingAmplitude;

            // 🎭 ELLIPTICAL WOBBLE: Orbits are slightly elliptical for organic feel
            const ellipseRatio = 0.92 + Math.sin(i * 2.3) * 0.08; // 0.84 - 1.0
            const wobblePhase = angles[i] * 2 + i; // Each node has unique wobble
            const radiusWobble = Math.sin(wobblePhase * 0.3) * 5;

            // Calculate position on orbital path
            const effectiveRadius = currentRadius + radiusWobble;
            const targetX = Math.cos(angles[i]) * effectiveRadius * ellipseRatio;
            const targetY = Math.sin(angles[i]) * effectiveRadius;

            // 🏠 SMOOTH SETTLING: Nodes gently drift to their orbital position
            // This creates the "home" feeling - everything settles calmly
            const settleSpeed = 0.03; // Gentle interpolation toward target
            curX[i] += (targetX - curX[i]) * settleSpeed;
            curY[i] += (targetY - curY[i]) * settleSpeed;
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
            .activeOffsetX([-5, 5]) // 🔥 MORE SENSITIVE (5px) - Claims gesture before MindLayout (30px)
            .activeOffsetY([-35, 35]) // Higher than MindLayout's 25, so navigation swipe wins
            .onStart(() => {
                'worklet';
            })
            .onChange(e => {
                'worklet';
                // Only pan the canvas if the movement is not a clear navigation attempt
                // (Parent MindLayout has activation threshold of 8)

                if (!ctcAllowTranslation.value) {
                    rawFocusX.value -= e.changeX * 0.1;
                    rawFocusY.value -= e.changeY * 0.1;
                    return;
                }

                translateX.value += e.changeX / scale.value;
                translateY.value += e.changeY / scale.value;
                rawFocusX.value -= e.changeX * 0.3;
                rawFocusY.value -= e.changeY * 0.3;
            })
            .onEnd(() => {
                'worklet';
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
        <View style={styles.container}>
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
        </View>
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

    // ⚡ CALM ENERGY FLOW: Slow pulse traveling along edge
    const pulseProgress = useDerivedValue(() => {
        const t = Number(time.value);
        // Each edge has a unique phase based on its endpoints
        const phase = (sIdx + tIdx) * 0.3;
        return (Math.sin(t * 0.4 + phase) + 1) / 2; // 3x slower (0.4 vs 1.2)
    });

    // Pulse position interpolated between p1 and p2
    const pulseX = useDerivedValue(() => {
        const progress = pulseProgress.value;
        return p1.value.x + (p2.value.x - p1.value.x) * progress;
    });
    const pulseY = useDerivedValue(() => {
        const progress = pulseProgress.value;
        return p1.value.y + (p2.value.y - p1.value.y) * progress;
    });

    // Phase A3: Edge opacity based on CTC activity level
    const opacity = useDerivedValue(() => {
        const level = edgeActivityLevel?.value ?? 1;

        if (level === 0) {
            return 0.04;
        } else if (level === 1) {
            return 0.08 + Math.sin(Number(time.value) * 1.5) * 0.03;
        } else {
            return 0.15 + Math.sin(Number(time.value) * 3) * 0.05;
        }
    });

    // Pulse glow intensity
    const pulseOpacity = useDerivedValue(() => {
        const level = edgeActivityLevel?.value ?? 1;
        if (level === 0) return 0;
        return 0.4 + Math.sin(Number(time.value) * 3) * 0.2;
    });

    if (sIdx === -1 || tIdx === -1) return null;

    return (
        <Group>
            {/* Base connection line */}
            <Group opacity={opacity}>
                <Line p1={p1} p2={p2} color="rgba(99, 102, 241, 0.2)" strokeWidth={1.5} />
            </Group>

            {/* ⚡ Energy pulse traveling along the edge */}
            <Circle cx={pulseX} cy={pulseY} r={3} color="#818cf8" opacity={pulseOpacity}>
                <Blur blur={4} />
            </Circle>
        </Group>
    );
};

const NeuralNode = ({ i, node, posX, posY, scale, time, isActive }: { i: number, node: Snippet, posX: any, posY: any, scale: any, time: any, isActive: boolean }) => {
    const color = TYPE_COLORS[node.type] || TYPE_COLORS.fact;

    // � CALM BREATHING: Like a sleeping heartbeat
    const breathRate = 0.15 + (i % 5) * 0.02; // Very slow: 0.15 - 0.25 Hz (4-7 second cycles)
    const breathDepth = 0.05 + (i % 4) * 0.01; // Very subtle: 5-9% size change

    // 💫 MICRO FLOAT: Almost imperceptible gentle motion
    const driftX = useDerivedValue(() => {
        const t = Number(time.value);
        return Math.sin(t * 0.08 + i * 1.3) * 2 + Math.cos(t * 0.12 + i * 0.7) * 1;
    });
    const driftY = useDerivedValue(() => {
        const t = Number(time.value);
        return Math.cos(t * 0.06 + i * 1.1) * 2 + Math.sin(t * 0.1 + i * 0.9) * 1;
    });

    const x = useDerivedValue(() => (posX.value[i] ?? 0) + driftX.value);
    const y = useDerivedValue(() => (posY.value[i] ?? 0) + driftY.value);

    // 🌙 Size pulse (very gentle, like stars twinkling)
    const radius = useDerivedValue(() => {
        const base = isActive ? 12 : 8;
        const timeVal = Number(time.value);
        const mainPulse = Math.sin(timeVal * breathRate + i * 0.7) * breathDepth;
        return base * (1 + mainPulse);
    });

    // ✨ WARM GLOW: Occasional soft twinkle (not harsh blink)
    const twinkleIntensity = useDerivedValue(() => {
        const t = Number(time.value);
        // Slower, smoother twinkle pattern - like distant stars
        const wave1 = Math.sin(t * 0.3 + i * 2.3);
        const wave2 = Math.sin(t * 0.5 + i * 1.7);
        const combined = (wave1 + wave2) / 2;
        // Only brighten when waves align (rare, special moments)
        return combined > 0.7 ? (combined - 0.7) * 1.5 : 0;
    });

    // 🌟 AURA: Warm, cozy glow
    const auraIntensity = useDerivedValue(() => {
        const t = Number(time.value);
        const base = 0.25 + Math.sin(t * breathRate * 0.5 + i * 0.8) * 0.05;
        return base + twinkleIntensity.value * 0.15;
    });

    const glowRadius = useDerivedValue(() => radius.value * 2.5);
    const outerGlowRadius = useDerivedValue(() => glowRadius.value * 1.8);
    const sparkleRadius = useDerivedValue(() => radius.value * 0.35);
    const auraOpacity = useDerivedValue(() => auraIntensity.value * 0.5);

    // Core and sparkle warm up during twinkle
    const coreOpacity = useDerivedValue(() => 0.9 + twinkleIntensity.value * 0.1);
    const sparkleOpacity = useDerivedValue(() => 0.4 + twinkleIntensity.value * 0.4);

    const opacity = useDerivedValue(() => {
        return interpolate(scale.value, [0.2, 0.5], [0.7, 1.0], Extrapolate.CLAMP);
    });

    return (
        <Group opacity={opacity}>
            {/* 1. Distant Aura - warmer, softer */}
            <Circle cx={x} cy={y} r={outerGlowRadius} color={color} opacity={auraOpacity}>
                <Blur blur={40} />
            </Circle>

            {/* 2. Inner Glow - cozy warmth */}
            <Circle cx={x} cy={y} r={glowRadius} color={color} opacity={0.25}>
                <Blur blur={20} />
            </Circle>

            {/* 3. Core - stable, like home */}
            <Circle cx={x} cy={y} r={radius} color={color} opacity={coreOpacity} />

            {/* 4. Center sparkle - twinkles gently */}
            <Circle cx={x} cy={y} r={sparkleRadius} color="#ffffff" opacity={sparkleOpacity} />
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
