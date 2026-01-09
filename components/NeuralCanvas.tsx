/**
 * 🌌 NEURAL HORIZON 2.0 — SYNAPSE RUNTIME
 * Architecture: Deterministic Event-Spine (HEB) + Raptor Physics
 * 
 * v2.0 Enhancements:
 * - Precision zone zoom (piecewise logarithmic)
 * - Snap intention gate with velocity tracking
 * - Camera settle detection for label reveal
 * - Salience-based label selection with hard caps
 * - CTC-conditional breathing (6s cycle, 2% amplitude)
 * - EWMA node size smoothing
 */

import { getDiamondPath, getHexagonPath } from '@/utils/shapes';
import {
    Blur,
    Canvas,
    Circle,
    Fill,
    Group,
    Line,
    matchFont,
    Path,
    Shader,
    Skia,
    Text as SkiaText,
    vec
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    Extrapolate,
    interpolate,
    runOnJS,
    SharedValue,
    useAnimatedReaction,
    useDerivedValue,
    useFrameCallback,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { FlashcardModal } from './FlashcardModal';
import { ThoughtActionModal } from './ThoughtActionModal';

import { useLensStore } from '@/store/lensStore';
import { NODE_CONTRACT, PERFORMANCE_CONTRACTS, ZOOM_CONTRACT } from '../constants/contracts';
import { NEURAL_TOKENS } from '../constants/neuralTokens';
import { getAllClusters, getAllEdges, getAllSnippets, getDb, isDatabaseReady } from '../db';
import { Snippet } from '../db/schema';
import { useCameraFlight } from '../hooks/useCameraFlight';
import { useEcoMode, useEcoModeSharedValue } from '../hooks/useEcoMode';
import { filterNodesByLens, type FilteredNode } from '../services/LensFilterService';
import { SpatialEngine } from '../services/SpatialEngine';
import { useCTC } from '../store/CognitiveTempoController';
import { useContextStore } from '../store/contextStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- SHADER CORE (Award-Grade Kinematics) ---

const backgroundShaderSource = Skia.RuntimeEffect.Make(`
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
`);

// Safety check: if shader failed to compile, log error
if (!backgroundShaderSource) {
    console.error('[NeuralCanvas] CRITICAL: Background shader failed to compile!');
}

// --- COLOR PALETTE (v2.0 spec) ---

const TYPE_COLORS: Record<string, { base: string; glow: string; shadow: string }> = {
    fact: NEURAL_TOKENS.colors.node.fact,
    feeling: NEURAL_TOKENS.colors.node.feeling,
    goal: NEURAL_TOKENS.colors.node.goal,
};

// --- THE SYNAPSE LAYER (Control Plane) ---

interface NeuralCanvasProps {
    layoutY?: any;
    cameraZ?: SharedValue<number>;
}

export const NeuralCanvas = ({ layoutY, cameraZ: cameraZProp }: NeuralCanvasProps) => {
    // 🧠 NEURAL LENSES (Sync React State -> Worklet)
    const lensMode = useLensStore(state => state.mode);
    const lensModeSV = useSharedValue(0);

    // 🔋 ECO MODE: Battery-aware rendering (React state for JSX conditionals)
    const { isEcoMode } = useEcoMode();

    // 🐛 DEBUG: Log once on mount
    useEffect(() => {
        console.log('[NeuralCanvas] 🎨 Canvas mounted, isEcoMode:', isEcoMode);
    }, []);

    useEffect(() => {
        lensModeSV.value = lensMode === 'EXPLORE' ? 0 :
            lensMode === 'LEARN' ? 1 :
                lensMode === 'STRATEGY' ? 2 : 3;
    }, [lensMode]);

    const [nodes, setNodes] = useState<Snippet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [edgePairs, setEdgePairs] = useState<[number, number][]>([]);
    const [clusters, setClusters] = useState<any[]>([]);
    const [modalOrigin, setModalOrigin] = useState<{ x: number, y: number } | null>(null);
    const [isFlashcardVisible, setIsFlashcardVisible] = useState(false);
    
    // 🔍 GFF LENS FILTERING: Relevance scores for Visual MECE
    const [nodeRelevanceMap, setNodeRelevanceMap] = useState<Map<number, number>>(new Map());

    // 🔍 LOD FONT: System font for text labels
    const font = useMemo(() => matchFont({
        fontFamily: 'System',
        fontSize: 11,
        fontWeight: '500'
    }), []);

    // 💭 THOUGHT ACTION MODAL STATE
    const [selectedNode, setSelectedNode] = useState<Snippet | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [currentLOD, setCurrentLOD] = useState(ZOOM_CONTRACT.initialScale < 0.7 ? 1 : ZOOM_CONTRACT.initialScale < 1.2 ? 2 : 3);

    // 1. Focus Engine (EWMA Stabilizer)
    const rawFocusX = useSharedValue(0);
    const rawFocusY = useSharedValue(0);
    const stableFocusX = useSharedValue(0);
    const stableFocusY = useSharedValue(0);

    // 2. Camera & World State (v2.0: initial scale 0.6)
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(ZOOM_CONTRACT.initialScale as number);
    const internalCameraZ = useSharedValue(0); // fallback
    const cameraZ = cameraZProp || internalCameraZ;
    const time = useSharedValue(0);

    // v2.0: Camera velocity tracking for snap intention gate
    const panVelocityX = useSharedValue(0);
    const panVelocityY = useSharedValue(0);
    const zoomVelocity = useSharedValue(0);
    const lastPanX = useSharedValue(0);
    const lastPanY = useSharedValue(0);
    const lastPanTime = useSharedValue(0);
    const prevPinchScale = useSharedValue(1); // 🛰️ Sprint 2: 3D Pinch Tracker

    // v2.0: Camera settle detection
    const cameraSettled = useSharedValue(true);
    const lastCameraMoveTime = useSharedValue(0);
    const labelOpacity = useSharedValue(0);
    const rotation = useSharedValue(0);
    const savedRotation = useSharedValue(0);
    const activeGestures = useSharedValue(0);

    // 3. Raptor Physics Buffers (Zero-Copy Shared Memory)
    const nodeCount = useSharedValue(0);
    const posX = useSharedValue(new Float32Array(500).fill(0));
    const posY = useSharedValue(new Float32Array(500).fill(0));
    const posZ = useSharedValue(new Float32Array(500).fill(0));
    const velX = useSharedValue(new Float32Array(500).fill(0));
    const velY = useSharedValue(new Float32Array(500).fill(0));
    const clusterIds = useSharedValue(new Int32Array(500).fill(-1));

    // v2.0: Node size smoothing (EWMA)
    const nodeRadii = useSharedValue(new Float32Array(500).fill(16));

    // 4. Trinity Sync Subscription
    const nodeRefreshTrigger = useContextStore((state) => state.nodeRefreshTrigger);
    const activeFocusNodeId = useContextStore((state) => state.focusNodeId);

    // 5. CTC State Access (v2.0: breathing control)
    const ctcLimits = useCTC(state => state.limits);
    const ctcMode = useCTC(state => state.mode);
    const ctcEnterIntent = useCTC(state => state.enterIntent);
    const ctcExitIntent = useCTC(state => state.exitIntent);
    const ctcOnCameraMove = useCTC(state => state.onCameraMove);

    // Shared values for worklet access
    const ctcMaxVelocity = useSharedValue(30);
    const ctcBloomCap = useSharedValue(1.0);
    const ctcEdgeActivity = useSharedValue(1);
    const ctcBreathingEnabled = useSharedValue(true);
    const ctcAllowTranslation = useSharedValue(true);

    // 🔋 ECO MODE: Battery-aware performance (Phase 0)
    const ecoModeEnabled = useEcoModeSharedValue();

    // ✈️ THE FLIGHT ENGINE (Sprint 3)
    const { flyToNode } = useCameraFlight(translateX, translateY, cameraZ);

    // ⚡ Synaptic Fire (Edge Animation Queue)
    const synapticFire = useContextStore(state => state.synapticFire);
    const liveContext = useContextStore(state => state.liveContext);
    const activeScreen = useContextStore(state => state.activeScreen);
    const [activeFires, setActiveFires] = useState<{ id: string, sourceIdx: number, targetIdx: number }[]>([]);

    useEffect(() => {
        if (!synapticFire) return;

        // Find indices
        const sIdx = nodes.findIndex(n => n.id === synapticFire.sourceId);
        const tIdx = nodes.findIndex(n => n.id === synapticFire.targetId);

        if (sIdx !== -1 && tIdx !== -1) {
            const fireId = `fire_${synapticFire.timestamp}_${sIdx}_${tIdx}`;
            // Avoid duplicates
            if (activeFires.find(f => f.id === fireId)) return;

            setActiveFires(prev => [...prev, { id: fireId, sourceIdx: sIdx, targetIdx: tIdx }]);
        }
    }, [synapticFire, nodes]);

    const removeFire = useCallback((id: string) => {
        setActiveFires(prev => prev.filter(f => f.id !== id));
    }, []);

    // Sync CTC limits to shared values
    useEffect(() => {
        ctcMaxVelocity.value = ctcLimits.maxVelocity;
        ctcBloomCap.value = ctcLimits.bloomIntensityCap;
        ctcEdgeActivity.value = ctcLimits.edgeActivityLevel;
        ctcBreathingEnabled.value = ctcLimits.breathingEnabled;
        ctcAllowTranslation.value = ctcLimits.allowCameraTranslation;
    }, [ctcLimits]);

    // ✈️ SPRINT 3: AUTOMATED CAMERA FLIGHTS
    useEffect(() => {
        if (nodes.length === 0) return;

        // A. Precision Flight: To a specific node (from Chronicle/Search)
        if (liveContext.targetNodeId !== null) {
            const nodeIndex = nodes.findIndex(n => n.id === liveContext.targetNodeId);
            if (nodeIndex !== -1) {
                flyToNode(
                    posX.value[nodeIndex],
                    posY.value[nodeIndex],
                    posZ.value[nodeIndex]
                );
            }
            // Clear target after flight initiated
            setTimeout(() => {
                useContextStore.getState().transitionTo(activeScreen, { targetNodeId: null });
            }, 1000);
            return;
        }

        // B. Contextual Swarm Flight: To current conversation area (from Orbit)
        if (activeScreen === 'horizon' && liveContext.highlightTerms.length > 0) {
            const relevantIndices = nodes.map((n, i) => {
                const content = n.content.toLowerCase();
                return liveContext.highlightTerms.some(term => content.includes(term.toLowerCase())) ? i : -1;
            }).filter(i => i !== -1);

            if (relevantIndices.length > 0) {
                let sumX = 0, sumY = 0, sumZ = 0;
                relevantIndices.forEach(idx => {
                    sumX += posX.value[idx];
                    sumY += posY.value[idx];
                    sumZ += posZ.value[idx];
                });

                const avgX = sumX / relevantIndices.length;
                const avgY = sumY / relevantIndices.length;
                const avgZ = sumZ / relevantIndices.length;

                // Zoom out slightly for clusters to provide perspective (Positive offset increases depth)
                const zoomOutOffset = relevantIndices.length > 1 ? 300 : 0;
                flyToNode(avgX, avgY, avgZ + zoomOutOffset);
            }
        }
    }, [liveContext.targetNodeId, liveContext.highlightTerms, nodes.length, activeScreen]);

    // v2.0: Sync scale to React state for LOD logic (avoids render-phase warnings)
    useAnimatedReaction(
        () => {
            // Nominal scale from 3D depth
            const s = SpatialEngine.project3D(0, 0, 0, cameraZ.value).scale;
            if (s < 0.7) return 1;
            if (s < 1.2) return 2;
            return 3;
        },
        (result, previous) => {
            if (result !== previous) {
                runOnJS(setCurrentLOD)(result);
            }
        }
    );

    // --- DATA BOOTSTRAP (SpaceX Pre-Flight) ---
    useEffect(() => {
        const bootstrap = async () => {
            if (!isDatabaseReady()) {
                setTimeout(bootstrap, 100);
                return;
            }

            const snips = await getAllSnippets();
            const [edges, cls] = await Promise.all([getAllEdges(), getAllClusters()]);

            // 🏠 ORBITAL CONSTELLATION: Nodes arranged in stable orbital rings
            const newPosX = new Float32Array(500);
            const newPosY = new Float32Array(500);
            const newPosZ = new Float32Array(500);
            const newVelX = new Float32Array(500);
            const newVelY = new Float32Array(500);
            const newCIds = new Int32Array(500).fill(-1);
            const newRadii = new Float32Array(500).fill(16);

            const numNodes = snips.length;
            const goldenAngle = Math.PI * (3 - Math.sqrt(5));

            // Calculate max connections for size normalization
            const connectionCounts: Record<string, number> = {};
            edges.forEach(([s, t]) => {
                connectionCounts[s] = (connectionCounts[s] || 0) + 1;
                connectionCounts[t] = (connectionCounts[t] || 0) + 1;
            });
            const maxConnections = Math.max(1, ...Object.values(connectionCounts));

            snips.forEach((s, i) => {
                const angle = i * goldenAngle;
                // v2.0: Spreading nodes in a wider orbital shell
                const radiusFactor = Math.sqrt(i + 1) / Math.sqrt(numNodes + 1);
                const baseRadius = 80 + radiusFactor * 350;

                const radiusJitter = (Math.random() - 0.5) * 30;
                const angleJitter = (Math.random() - 0.5) * 0.2;

                const finalRadius = baseRadius + radiusJitter;
                const finalAngle = angle + angleJitter;

                newPosX[i] = Math.cos(finalAngle) * finalRadius;
                newPosY[i] = Math.sin(finalAngle) * finalRadius;

                // 📽️ Sprint 2: The Spatial Injection
                newPosZ[i] = SpatialEngine.calculateZ(s);

                newVelX[i] = finalAngle;
                newVelY[i] = finalRadius;
                newCIds[i] = s.cluster_id || -1;

                // v2.0: Calculate node radius based on importance
                const connections = connectionCounts[s.id] || 0;
                newRadii[i] = NODE_CONTRACT.radius.calculate(connections, maxConnections);
            });

            posX.value = newPosX;
            posY.value = newPosY;
            posZ.value = newPosZ;
            velX.value = newVelX;
            velY.value = newVelY;
            clusterIds.value = newCIds;
            nodeRadii.value = newRadii;
            nodeCount.value = snips.length;

            setNodes(snips);
            setEdgePairs(edges);
            setClusters(cls);
            setIsLoading(false);
            console.log(`[NeuralCanvas] 🚀 Bootstrap complete: ${snips.length} nodes, ${edges.length} edges`);
        };
        bootstrap();
    }, [nodeRefreshTrigger]);

    // --- 🔍 GFF LENS FILTERING: Apply relevance scores when lens changes ---
    useEffect(() => {
        const applyLensFilter = async () => {
            if (nodes.length === 0) return;

            const filteredNodes = await filterNodesByLens(
                lensMode as any,
                activeFocusNodeId
            );

            // Build relevance map: nodeId -> relevanceScore
            const relevanceMap = new Map<number, number>();
            filteredNodes.forEach((fn: FilteredNode) => {
                relevanceMap.set(fn.id, fn.relevanceScore);
            });

            // Nodes not in filtered list get 0.1 relevance (dimmed)
            nodes.forEach((node) => {
                if (!relevanceMap.has(node.id)) {
                    relevanceMap.set(node.id, 0.1);
                }
            });

            setNodeRelevanceMap(relevanceMap);
            console.log(`[NeuralCanvas] 🔍 Lens filter applied: ${lensMode}, ${filteredNodes.length}/${nodes.length} nodes visible`);
        };

        applyLensFilter();
    }, [lensMode, nodes, activeFocusNodeId]);

    // --- 🏠 ORBITAL CONSTELLATION PHYSICS + v2.0 BREATHING ---
    // Note: All contract values inlined to ensure worklet safety
    const SETTLE_DELAY_MS = 180; // LOD_CONTRACT.revealPolicy.settleDelay
    const BREATHING_AMP_SCALE = 0.02; // BREATHING_CONTRACT.animation.amplitude.scale[1] - 1

    // 🔋 ECO MODE: Frame time threshold (inlined for worklet safety)
    const ECO_FRAME_THRESHOLD = 33.33; // PERFORMANCE_CONTRACTS.neuralCanvas.ecoMode.frameTimeThreshold

    useFrameCallback((info) => {
        'worklet';
        // ⚡ Time Normalization (prevent jitter on frame drops)
        const dtMs = info.timeSincePreviousFrame || 16.666;
        const dt = dtMs / 16.666; // approx 1.0 at 60fps

        // 🔋 ECO MODE: Skip frames to reduce CPU (30fps cap)
        // When eco mode is active, only process physics every ~33ms
        if (ecoModeEnabled.value && dtMs < ECO_FRAME_THRESHOLD) {
            // Still update time for consistent animation
            time.value = (info.timestamp || 0) / 1000;
            return; // SKIP PHYSICS -> Saves CPU/Battery
        }

        time.value = (info.timestamp || 0) / 1000;
        const t = time.value;
        const n = nodeCount.value;
        if (n === 0) return;

        // Check camera settle (v2.0)
        const now = info.timestamp || 0;
        const elapsed = now - lastCameraMoveTime.value;
        if (elapsed > SETTLE_DELAY_MS && !cameraSettled.value) {
            cameraSettled.value = true;
        }

        // v2.0: Smooth label opacity based on settle state (dt corrected)
        const targetLabelOpacity = cameraSettled.value ? 1 : 0;
        labelOpacity.value = labelOpacity.value + (targetLabelOpacity - labelOpacity.value) * 0.1 * dt;

        // Physics constants scaled by dt
        const baseOrbitalSpeed = 0.008 * dt;

        // EWMA focus stabilization (dt corrected)
        const alpha = 0.05 * dt;
        stableFocusX.value = Number(stableFocusX.value) + (Number(rawFocusX.value) - Number(stableFocusX.value)) * alpha;
        stableFocusY.value = Number(stableFocusY.value) + (Number(rawFocusY.value) - Number(stableFocusY.value)) * alpha;

        const curX = posX.value;
        const curY = posY.value;
        const angles = velX.value;
        const radii = velY.value;

        // v2.0: Breathing amplitude (conditional on CTC)
        const breathingActive = ctcBreathingEnabled.value;
        const breathingAmp = breathingActive ? BREATHING_AMP_SCALE : 0;

        const settleSpeed = 0.05 * dt; // Slightly snappier but smooth due to dt

        for (let i = 0; i < n; i++) {
            const radiusFactor = radii[i] / 400;
            const orbitalSpeed = baseOrbitalSpeed * (1.2 - radiusFactor * 0.5);

            angles[i] += orbitalSpeed;

            // v2.0: 6s breathing cycle (spec), conditional on CTC
            const breathingCycleSeconds = 6;
            const phaseOffset = i * 0.1;
            const breathingPhase = t * (2 * Math.PI / breathingCycleSeconds) + phaseOffset;
            const breathingRadius = radii[i] + (breathingActive ? Math.sin(breathingPhase) * 8 * breathingAmp * 50 : 0);

            const ellipseRatio = 0.92 + Math.sin(i * 2.3) * 0.08;
            const wobblePhase = angles[i] * 2 + i;
            const radiusWobble = Math.sin(wobblePhase * 0.3) * 5;

            const effectiveRadius = breathingRadius + radiusWobble;
            const targetX = Math.cos(angles[i]) * effectiveRadius * ellipseRatio;
            const targetY = Math.sin(angles[i]) * effectiveRadius;

            curX[i] += (targetX - curX[i]) * settleSpeed;
            curY[i] += (targetY - curY[i]) * settleSpeed;
        }
    });

    const canvasTransform = useDerivedValue(() => [
        { translateX: SCREEN_WIDTH / 2 },
        { translateY: SCREEN_HEIGHT / 2 },
        { rotate: rotation.value },
        // 📽️ Scale is now handled per-node via project3D
    ]);

    const backgroundUniforms = useDerivedValue(() => {
        // Nominal scale for shader consistency
        const nominalScale = SpatialEngine.project3D(0, 0, 0, cameraZ.value).scale;
        return {
            u_time: time.value,
            u_res: [SCREEN_WIDTH, SCREEN_HEIGHT],
            u_offset: [translateX.value * nominalScale, translateY.value * nominalScale],
            u_scale: nominalScale,
            u_focusPos: [stableFocusX.value * nominalScale, stableFocusY.value * nominalScale],
            u_focusIntensity: 1.0
        };
    });

    // --- v2.0: PRECISION ZONE ZOOM + SNAP INTENTION GATE ---

    // 🐛 DEBUG: Performance logging
    let lastLogTime = 0;
    const logGesture = (type: string, data: any) => {
        const now = Date.now();
        const fps = lastLogTime ? Math.round(1000 / (now - lastLogTime)) : 0;
        lastLogTime = now;
        console.log(`[Gesture] ${type} | FPS: ${fps} | ${JSON.stringify(data)}`);
    };

    const handleGestureStart = () => {
        // console.log('[Gesture] 🟢 START'); 
        useCTC.getState().touch();
        useCTC.getState().enterIntent();
    };

    const handleGestureEnd = () => {
        // console.log('[Gesture] 🔴 END');
        useCTC.getState().exitIntent();
    };

    // Find nearest node to camera center for snap
    const findNearestNodeForSnap = useCallback(() => {
        const nominalScale = SpatialEngine.project3D(0, 0, 0, cameraZ.value).scale;
        const centerWorldX = -translateX.value;
        const centerWorldY = -translateY.value;
        const magnetRadius = 80 / nominalScale; // Dynamic 3D magnet radius

        let closestNode: Snippet | null = null;
        let closestDist = magnetRadius;

        for (let i = 0; i < nodes.length; i++) {
            const nx = posX.value[i];
            const ny = posY.value[i];
            const dist = Math.sqrt((centerWorldX - nx) ** 2 + (centerWorldY - ny) ** 2);

            if (dist < closestDist) {
                closestDist = dist;
                closestNode = nodes[i];
            }
        }

        return closestNode ? { node: closestNode, index: nodes.indexOf(closestNode) } : null;
    }, [nodes, posX, posY, translateX, translateY, cameraZ]);

    // Snap to node with spring animation
    const snapToNode = useCallback((nodeIndex: number) => {
        const targetX = -posX.value[nodeIndex];
        const targetY = -posY.value[nodeIndex];

        translateX.value = withSpring(targetX, { damping: 18, stiffness: 150, mass: 0.5 });
        translateY.value = withSpring(targetY, { damping: 18, stiffness: 150, mass: 0.5 });

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [posX, posY, translateX, translateY]);

    // Must be defined BEFORE gesture that uses it
    const attemptSnap = useCallback(() => {
        const nearest = findNearestNodeForSnap();
        if (nearest) {
            snapToNode(nearest.index);
        }
    }, [findNearestNodeForSnap, snapToNode]);

    // Zoom constants (inlined for worklet safety)
    // 📽️ Spatial Engine Limits (v2.0)
    const CAMERA_Z_MIN = -1500;
    const CAMERA_Z_MAX = 700;
    const ZOOM_SNAP_VELOCITY_THRESHOLD = 200;
    const ZOOM_SNAP_PAN_VELOCITY = 100;

    const panGesture = Gesture.Pan()
        .maxPointers(1)
        .activeOffsetX([-5, 5])
        .activeOffsetY([-35, 35])
        .onStart(() => {
            'worklet';
            runOnJS(console.log)('[Gesture] ✋ Pan START');
            activeGestures.value += 1;
            if (activeGestures.value === 1) runOnJS(handleGestureStart)();
            cameraSettled.value = false;
        })
        .onChange((e) => {
            'worklet';
            if (!ctcAllowTranslation.value) {
                // Allow focus drift even if translation locked
                rawFocusX.value -= e.changeX * 0.1;
                rawFocusY.value -= e.changeY * 0.1;
                return;
            }

            const now = Date.now();
            const dt = Math.max(1, now - lastPanTime.value);
            panVelocityX.value = e.changeX / dt * 1000;
            panVelocityY.value = e.changeY / dt * 1000;
            lastPanTime.value = now;

            // Correct pan direction based on current rotation
            const rot = -rotation.value;
            const cos = Math.cos(rot);
            const sin = Math.sin(rot);
            const dx = e.changeX * cos - e.changeY * sin;
            const dy = e.changeX * sin + e.changeY * cos;

            // nominal scale for pan consistency
            const nominalScale = SpatialEngine.project3D(0, 0, 0, cameraZ.value).scale;
            translateX.value += dx / nominalScale;
            translateY.value += dy / nominalScale;

            // Subtle parallax for focus
            rawFocusX.value -= dx * 0.3;
            rawFocusY.value -= dy * 0.3;

            lastCameraMoveTime.value = Date.now();
            cameraSettled.value = false;
        })
        .onEnd(() => {
            'worklet';
            activeGestures.value -= 1;
            if (activeGestures.value <= 0) {
                activeGestures.value = 0;
                runOnJS(handleGestureEnd)();
            }

            // Boundaries for 📽️ 3D camera
            if (cameraZ.value < CAMERA_Z_MIN) {
                cameraZ.value = withSpring(CAMERA_Z_MIN, { damping: 15, stiffness: 150 });
            } else if (cameraZ.value > CAMERA_Z_MAX) {
                cameraZ.value = withSpring(CAMERA_Z_MAX, { damping: 15, stiffness: 150 });
            } else if (Math.abs(panVelocityX.value) < ZOOM_SNAP_PAN_VELOCITY && Math.abs(panVelocityY.value) < ZOOM_SNAP_PAN_VELOCITY) {
                // Only snap if not panning wildly
                runOnJS(attemptSnap)();
            }
        });

    const pinchGesture = Gesture.Pinch()
        .onStart(() => {
            'worklet';
            activeGestures.value += 1;
            if (activeGestures.value === 1) runOnJS(handleGestureStart)();
            cameraSettled.value = false;
            prevPinchScale.value = 1;
        })
        .onChange((e) => {
            'worklet';
            const deltaScale = e.scale - prevPinchScale.value;
            prevPinchScale.value = e.scale;

            // 📽️ Sprint 2: Pinching shifts camera Z linearly
            const deltaZ = deltaScale * 600;
            const nextZ = cameraZ.value + deltaZ;

            cameraZ.value = Math.max(CAMERA_Z_MIN, Math.min(CAMERA_Z_MAX, nextZ));
            zoomVelocity.value = Math.abs(e.velocity);

            lastCameraMoveTime.value = Date.now();
            cameraSettled.value = false;
        })
        .onEnd(() => {
            'worklet';
            activeGestures.value -= 1;
            if (activeGestures.value <= 0) {
                activeGestures.value = 0;
                runOnJS(handleGestureEnd)();
            }

            // Boundary Spring
            if (cameraZ.value < CAMERA_Z_MIN + 50) {
                cameraZ.value = withSpring(CAMERA_Z_MIN + 50, { damping: 15, stiffness: 150 });
            } else if (cameraZ.value > CAMERA_Z_MAX - 50) {
                cameraZ.value = withSpring(CAMERA_Z_MAX - 50, { damping: 15, stiffness: 150 });
            }
        });

    const rotateGesture = Gesture.Rotation()
        .onStart(() => {
            'worklet';
            activeGestures.value += 1;
            if (activeGestures.value === 1) runOnJS(handleGestureStart)();
            savedRotation.value = rotation.value;
        })
        .onUpdate((e) => {
            'worklet';
            rotation.value = savedRotation.value + e.rotation;
            lastCameraMoveTime.value = Date.now();
            cameraSettled.value = false;
        })
        .onEnd(() => {
            'worklet';
            activeGestures.value -= 1;
            if (activeGestures.value <= 0) {
                activeGestures.value = 0;
                runOnJS(handleGestureEnd)();
            }
        });

    const gesture = Gesture.Simultaneous(panGesture, pinchGesture, rotateGesture);
    const onNodeAction = useCallback((index: number, tapX: number, tapY: number) => {
        const node = nodes[index];
        if (!node) return;

        // 🎯 ALWAYS INTERACTIVE
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // 1. Cinematic Zoom to Node
        const targetX = -posX.value[index];
        const targetY = -posY.value[index];

        translateX.value = withSpring(targetX, { damping: 20, stiffness: 100 });
        translateY.value = withSpring(targetY, { damping: 20, stiffness: 100 });
        scale.value = withSpring(1.6, { damping: 18, stiffness: 120 });

        // 🧠 POLYMORPHIC ROUTING (Visual Context -> Interaction Context)
        const lensMode = useLensStore.getState().mode;

        // Visual Feedback (Impact matches intention)
        if (lensMode === 'LEARN' && node.type === 'fact') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setModalOrigin({ x: tapX, y: tapY });
            setSelectedNode(node);
            setIsFlashcardVisible(true);
        }
        else if (lensMode === 'STRATEGY' && node.type === 'goal') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            setModalOrigin({ x: tapX, y: tapY });
            setSelectedNode(node);
            setIsModalVisible(true);
        }
        else {
            // Standard Action Modal (Default)
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setModalOrigin({ x: tapX, y: tapY });
            setSelectedNode(node);
            setIsModalVisible(true);
        }

        // 3. Update Cognitive State
        useCTC.getState().enterReflection();
    }, [nodes, posX, posY, translateX, translateY, scale, setModalOrigin, setSelectedNode, setIsModalVisible]);

    const tapGesture = Gesture.Tap()
        .onEnd((e) => {
            'worklet';

            // 📽️ 3D Perspective Hit Detection
            const cx = SCREEN_WIDTH / 2;
            const cy = SCREEN_HEIGHT / 2;
            const screenX = e.x - cx;
            const screenY = e.y - cy;

            // Inverse Rotate (Global rotation only)
            const rot = -rotation.value;
            const rx = screenX * Math.cos(rot) - screenY * Math.sin(rot);
            const ry = screenX * Math.sin(rot) + screenY * Math.cos(rot);

            // rx, ry are now in "canvas-space" coordinates but still SCREEN units.
            // We need to find the node whose projection is closest to this.

            let closestIndex = -1;
            let currentMinDistSq = 40 * 40; // 40px tap radius on screen

            const n = nodeCount.value;
            const px = posX.value;
            const py = posY.value;
            const pz = posZ.value;
            const cZ = cameraZ.value;
            const tx = translateX.value;
            const ty = translateY.value;

            for (let i = 0; i < n; i++) {
                // Project node to screen
                const proj = SpatialEngine.project3D(
                    px[i] + tx,
                    py[i] + ty,
                    pz[i],
                    cZ
                );

                if (!proj.visible) continue;

                const dx = rx - proj.x;
                const dy = ry - proj.y;
                const d2 = dx * dx + dy * dy;

                if (d2 < currentMinDistSq) {
                    currentMinDistSq = d2;
                    closestIndex = i;
                }
            }

            if (closestIndex !== -1) {
                runOnJS(onNodeAction)(closestIndex, e.x, e.y);
            }
        });

    const combinedGesture = Gesture.Simultaneous(tapGesture, gesture);

    // 💭 MODAL ACTION HANDLERS
    const handleCloseModal = useCallback(() => {
        setIsModalVisible(false);
        setSelectedNode(null);
        useCTC.getState().exitReflection();
    }, []);

    const handleCloseFlashcard = useCallback(() => {
        setIsFlashcardVisible(false);
        // Don't clear selectedNode immediately to avoid flicker during close anim?
        // FlashcardModal handles anim internally then calls onClose.
        // We can wait or clear. FlashcardModal keeps visible prop.
        setTimeout(() => setSelectedNode(null), 300);
        useCTC.getState().exitReflection();
    }, []);

    const handleChronicle = useCallback((snippet: Snippet) => {
        console.log('📖 Chronicle:', snippet.content.substring(0, 50));
        useContextStore.getState().setActiveScreen('memory');
        useContextStore.getState().setFocusNode(snippet.id);
        handleCloseModal();
    }, [handleCloseModal]);

    const handleReflect = useCallback((snippet: Snippet) => {
        console.log('💭 Reflect:', snippet.content.substring(0, 50));
        useContextStore.getState().setActiveScreen('orbit');
        handleCloseModal();
    }, [handleCloseModal]);

    const handleConnect = useCallback((snippet: Snippet) => {
        console.log('🔗 Connect:', snippet.content.substring(0, 50));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        handleCloseModal();
    }, [handleCloseModal]);

    const handleStar = useCallback(async (snippet: Snippet) => {
        console.log('⭐ Star:', snippet.content.substring(0, 50));
        try {
            const db = await getDb();
            await db.execute(
                'UPDATE snippets SET importance = importance + 0.5 WHERE id = ?',
                [snippet.id]
            );
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.error('Failed to star snippet:', error);
        }
        handleCloseModal();
    }, [handleCloseModal]);

    // --- v2.0: LOD Level Calculation ---
    const lodLevel = useDerivedValue(() => {
        // Nominal scale from 3D camera depth
        const s = SpatialEngine.project3D(0, 0, 0, cameraZ.value).scale;
        if (s < 0.7) return 1;
        if (s < 1.2) return 2;
        return 3;
    });

    // --- v2.0: Visible labels (salience-based selection) ---
    const visibleLabelIndices = useMemo(() => {
        // LOD1: 0 labels, LOD2: 12 labels, LOD3: 6 labels
        const maxLabels = currentLOD === 1 ? 0 : currentLOD === 2 ? 12 : 6;
        return nodes.slice(0, maxLabels).map((_, i) => i);
    }, [nodes, currentLOD]);

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
        <>
            <GestureDetector gesture={combinedGesture}>
                <Animated.View
                    style={styles.container}
                    collapsable={false}
                >
                    <Canvas style={styles.canvas}>
                        {/* 🔋 ECO MODE: Static black background instead of expensive shader */}
                        {isEcoMode ? (
                            <Fill color={PERFORMANCE_CONTRACTS.fallbackBackground} />
                        ) : (
                            backgroundShaderSource && (
                                <Fill>
                                    <Shader source={backgroundShaderSource} uniforms={backgroundUniforms} />
                                </Fill>
                            )
                        )}

                        <Group transform={canvasTransform}>
                            {/* Semantic Edges with CTC modulation */}
                            {edgePairs.map(([s, t], idx) => {
                                if (s >= nodes.length || t >= nodes.length) return null;
                                return (
                                    <NeuralEdge
                                        key={`edge-${idx}`}
                                        s={s}
                                        t={t}
                                        posX={posX}
                                        posY={posY}
                                        posZ={posZ}
                                        cameraZ={cameraZ}
                                        translateX={translateX}
                                        translateY={translateY}
                                        time={time}
                                        edgeActivityLevel={ctcEdgeActivity}
                                    />
                                );
                            })}

                            {/* Neural Nodes */}
                            {nodes.map((node, i) => (
                                <NeuralNode
                                    key={node.id}
                                    i={i}
                                    node={node}
                                    posX={posX}
                                    posY={posY}
                                    posZ={posZ}
                                    cameraZ={cameraZ}
                                    translateX={translateX}
                                    translateY={translateY}
                                    time={time}
                                    nodeRadii={nodeRadii}
                                    isActive={node.id === activeFocusNodeId || node.id === selectedNode?.id}
                                    lensModeSV={lensModeSV}
                                    font={font}
                                    showLabel={visibleLabelIndices.includes(i)}
                                    labelOpacity={labelOpacity}
                                    ctcBreathingEnabled={ctcBreathingEnabled}
                                    currentLOD={currentLOD}
                                    isEcoMode={isEcoMode}
                                    relevanceScore={nodeRelevanceMap.get(node.id) ?? 1.0}
                                />
                            ))}

                            {/* ⚡ Synaptic Fire Particles */}
                            {activeFires.map(fire => (
                                <SynapticFireParticle
                                    key={fire.id}
                                    sourceIdx={fire.sourceIdx}
                                    targetIdx={fire.targetIdx}
                                    posX={posX}
                                    posY={posY}
                                    posZ={posZ}
                                    cameraZ={cameraZ}
                                    translateX={translateX}
                                    translateY={translateY}
                                    onFinish={() => removeFire(fire.id)}
                                />
                            ))}
                        </Group>
                    </Canvas>
                </Animated.View>
            </GestureDetector>

            {/* 💭 Thought Action Modal */}
            <ThoughtActionModal
                visible={isModalVisible}
                snippet={selectedNode}
                onClose={handleCloseModal}
                onChronicle={handleChronicle}
                onConnect={handleConnect}
                onReflect={handleReflect}
                onStar={handleStar}
                origin={modalOrigin}
            />

            {/* 🎓 Flashcard Modal (Student Flow) */}
            <FlashcardModal
                visible={isFlashcardVisible}
                node={selectedNode}
                onClose={handleCloseFlashcard}
            />
        </>
    );
};

// --- SUB-COMPONENTS (Premium Immersion) ---

type EdgeState = 'DORMANT' | 'BREATHING' | 'ACTIVE';

// NeuralEdge: Proper worklet-safe edge rendering
const NeuralEdge = React.memo(({
    s,
    t,
    posX,
    posY,
    posZ,
    cameraZ,
    translateX,
    translateY,
    time,
    edgeActivityLevel
}: {
    s: number;
    t: number;
    posX: any;
    posY: any;
    posZ: any;
    cameraZ: any;
    translateX: any;
    translateY: any;
    time: any;
    edgeActivityLevel: any;
}) => {
    // Use derived values to safely access shared values
    const p1 = useDerivedValue(() => {
        const proj = SpatialEngine.project3D(
            posX.value[s] + translateX.value,
            posY.value[s] + translateY.value,
            posZ.value[s] ?? 0,
            cameraZ.value
        );
        return vec(proj.x, proj.y);
    });

    const p2 = useDerivedValue(() => {
        const proj = SpatialEngine.project3D(
            posX.value[t] + translateX.value,
            posY.value[t] + translateY.value,
            posZ.value[t] ?? 0,
            cameraZ.value
        );
        return vec(proj.x, proj.y);
    });

    const edgeVisibility = useDerivedValue(() => {
        const proj1 = SpatialEngine.project3D(
            posX.value[s] + translateX.value,
            posY.value[s] + translateY.value,
            posZ.value[s] ?? 0,
            cameraZ.value
        );
        const proj2 = SpatialEngine.project3D(
            posX.value[t] + translateX.value,
            posY.value[t] + translateY.value,
            posZ.value[t] ?? 0,
            cameraZ.value
        );
        return proj1.visible && proj2.visible ? 1 : 0;
    });

    const opacity = useDerivedValue(() => {
        const proj1 = SpatialEngine.project3D(
            posX.value[s] + translateX.value,
            posY.value[s] + translateY.value,
            posZ.value[s] ?? 0,
            cameraZ.value
        );
        const proj2 = SpatialEngine.project3D(
            posX.value[t] + translateX.value,
            posY.value[t] + translateY.value,
            posZ.value[t] ?? 0,
            cameraZ.value
        );
        const baseOpacity = 0.15 * ((proj1.opacity + proj2.opacity) / 2);
        const activityMod = edgeActivityLevel.value * 0.1;
        const pulse = Math.sin(time.value * 0.5 + s * 0.3) * 0.02;
        return (baseOpacity + activityMod + pulse) * edgeVisibility.value;
    });

    return (
        <Line
            p1={p1}
            p2={p2}
            color="rgba(255, 255, 255, 0.15)"
            strokeWidth={1}
            opacity={opacity}
        />
    );
});

// v2.2: Synaptic Fire Particle Component
const SynapticFireParticle = ({
    sourceIdx,
    targetIdx,
    posX,
    posY,
    posZ,
    cameraZ,
    translateX,
    translateY,
    onFinish
}: {
    sourceIdx: number,
    targetIdx: number,
    posX: any,
    posY: any,
    posZ: any,
    cameraZ: any,
    translateX: any,
    translateY: any,
    onFinish: () => void
}) => {
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withTiming(1, {
            duration: 1000,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1)
        }, (finished) => {
            if (finished) runOnJS(onFinish)();
        });
    }, []);

    const p = useDerivedValue(() => {
        const x1 = posX.value[sourceIdx] || 0;
        const y1 = posY.value[sourceIdx] || 0;
        const z1 = posZ.value[sourceIdx] || 0;
        const x2 = posX.value[targetIdx] || 0;
        const y2 = posY.value[targetIdx] || 0;
        const z2 = posZ.value[targetIdx] || 0;

        // Interpolate in 3D
        const curX = x1 + (x2 - x1) * progress.value;
        const curY = y1 + (y2 - y1) * progress.value;
        const curZ = z1 + (z2 - z1) * progress.value;

        // Project
        const proj = SpatialEngine.project3D(
            curX + translateX.value,
            curY + translateY.value,
            curZ,
            cameraZ.value
        );
        return vec(proj.x, proj.y);
    });

    const opacity = useDerivedValue(() => {
        // Fade in (0 -> 0.2) and fade out (0.8 -> 1.0)
        return interpolate(progress.value, [0, 0.1, 0.9, 1], [0, 1, 1, 0], Extrapolate.CLAMP);
    });

    return (
        <Group opacity={opacity}>
            {/* Inner Core */}
            <Circle c={p} r={4} color="rgba(255, 255, 255, 0.8)">
                <Blur blur={3} />
            </Circle>
            <Circle c={p} r={1.5} color="#FFF" />
        </Group>
    );
};

// v2.1: Shape-Aware Neural Node (The Panorama Update)
const NeuralNode = ({
    i,
    node,
    posX,
    posY,
    posZ,
    cameraZ,
    translateX,
    translateY,
    time,
    nodeRadii,
    isActive,
    lensModeSV,
    font,
    showLabel,
    labelOpacity,
    ctcBreathingEnabled,
    currentLOD,
    isEcoMode,
    relevanceScore = 1.0
}: {
    i: number;
    node: Snippet;
    posX: any;
    posY: any;
    posZ: any;
    cameraZ: any;
    translateX: any;
    translateY: any;
    time: any;
    nodeRadii: any;
    isActive: boolean;
    lensModeSV: any;
    font: any;
    showLabel: boolean;
    labelOpacity: any;
    ctcBreathingEnabled: any;
    currentLOD: number;
    isEcoMode: boolean;
    relevanceScore?: number;
}) => {
    const colors = TYPE_COLORS[node.type] || TYPE_COLORS.fact;

    // 1. Shape Identity
    const shapePath = useMemo(() => {
        if (node.type === 'fact') return getHexagonPath(1);
        if (node.type === 'goal') return getDiamondPath(1);
        return null; // Feeling = Blob/Circle
    }, [node.type]);

    // 2. Base Position & Drift
    const driftX = useDerivedValue(() => {
        const t = Number(time.value);
        return (Math.sin(t * 0.08 + i * 1.3) * 2 + Math.cos(t * 0.12 + i * 0.7) * 1) * 0.5;
    });
    const driftY = useDerivedValue(() => {
        const t = Number(time.value);
        return (Math.cos(t * 0.06 + i * 1.1) * 2 + Math.sin(t * 0.1 + i * 0.9) * 1) * 0.5;
    });

    // 🔮 ACE Integration (Visual Bridge)
    const ambientPredictions = useContextStore(state => state.ambientPredictions);

    const isGhostMatch = useDerivedValue(() => {
        // High-performance React state -> Worklet bridge check
        if (ambientPredictions.length === 0) return false;
        for (let p = 0; p < ambientPredictions.length; p++) {
            if (ambientPredictions[p].nodeId === node.id) return true;
        }
        return false;
    });

    // Semantic Heartbeat (Sync to match confidence)
    const acePulse = useDerivedValue(() => {
        if (!isGhostMatch.value) return 1;
        const t = Number(time.value);
        // Confident matches breathe deeper
        const confidence = 0.95; // Keyword matches are usually high
        const speed = 2 + confidence * 2;
        const amp = 0.1 + confidence * 0.15;
        return 1 + Math.sin(t * speed) * amp;
    });

    // 3. Physics Loop (Idle Animations)
    const physicsTransform = useDerivedValue(() => {
        const t = Number(time.value);
        const transform: any[] = [];

        if (node.type === 'fact') {
            // 🐢 Fact: Slow, stable rotation
            transform.push({ rotate: t * 0.05 });
        } else if (node.type === 'goal') {
            // 🎯 Goal: High freq jitter (ambition)
            const jitter = Math.sin(t * 20) * 0.5;
            transform.push({ translateX: jitter });
        } else if (node.type === 'feeling') {
            // 💓 Feeling: Breathing (Squash & Stretch)
            const breath = Math.sin(t * 2) * 0.05;
            transform.push({ scaleY: 1 + breath });
            transform.push({ scaleX: 1 - breath * 0.5 });
        }
        return transform;
    });

    // 📽️ 3D PROJECTION ENGINE (Sprint 2)
    const projection = useDerivedValue(() => {
        return SpatialEngine.project3D(
            posX.value[i] + driftX.value + translateX.value,
            posY.value[i] + driftY.value + translateY.value,
            posZ.value[i],
            cameraZ.value
        );
    });

    const x = useDerivedValue(() => projection.value.x);
    const y = useDerivedValue(() => projection.value.y);

    // 4. Radius Handling
    const radius = useDerivedValue(() => {
        const base = nodeRadii.value[i] ?? 16;
        const active = isActive ? 1.4 : 1;
        return base * active;
    });

    // 5. Visual State (Glows, Opacity)
    const blurValue = useDerivedValue(() => {
        if (isEcoMode) return 0;
        const b = projection.value.blur;
        return b > 1 ? b : 0;
    });

    const synapseFireIntensity = useDerivedValue(() => {
        const t = Number(time.value);
        const nodePhase = i * 1.618;
        const combined = (Math.sin(t * 2.5 + nodePhase) + Math.sin(t * 1.3 + nodePhase * 2)) / 2;
        return combined > 0.6 ? Math.pow((combined - 0.6) * 2.5, 1.5) : 0;
    });

    const auraOpacity = useDerivedValue(() => {
        const base = 0.2 + synapseFireIntensity.value * 0.4;
        return isGhostMatch.value ? 0.8 : base;
    });
    const coreOpacity = useDerivedValue(() => {
        const base = 0.85 + synapseFireIntensity.value * 0.15;
        return isGhostMatch.value ? 1.0 : base;
    });

    // Depth Sorting
    const depthLayer = useMemo(() => {
        if (isActive) return 'FOREGROUND';
        if (node.importance && node.importance > 0.7) return 'FOREGROUND';
        return 'MIDGROUND';
    }, [isActive, node.importance]);

    // Lens Filter
    // Lens Filter Logic
    const isFiltered = useDerivedValue(() => {
        const mode = lensModeSV.value;
        if (mode === 0) return false; // EXPLORE: Show all
        if (mode === 1) return node.type !== 'fact'; // LEARN: Hide non-facts
        if (mode === 2) return node.type !== 'goal'; // STRATEGY: Hide non-goals
        if (mode === 3) return node.type !== 'feeling'; // REFLECT: Hide non-feelings (HEALED)
        return false;
    });

    const groupOpacity = useDerivedValue(() => {
        // v2.2: GFF Lens Filtering with relevanceScore
        // Opacity modulated by: 3D distance + Lens filtering + Relevance score
        const distanceOpacity = projection.value.opacity;
        
        // If using old lens filter logic, apply minimal opacity
        if (isFiltered.value) return distanceOpacity * 0.1;
        
        // Apply relevanceScore from LensFilterService (0.6-1.0)
        return distanceOpacity * relevanceScore;
    });

    // Combined Transform for the Shape Group
    const mainTransform = useDerivedValue(() => [
        { translateX: x.value },
        { translateY: y.value },
        { scale: projection.value.scale * radius.value * acePulse.value },
        ...physicsTransform.value
    ]);

    // Text & Star Logic
    const isStarred = (node.importance || 0) > 0.8;

    // Calculate Label Position (Account for radius but ignore rotation effectively)
    const textY = useDerivedValue(() => {
        const visualRadius = radius.value * acePulse.value * projection.value.scale;
        return y.value + visualRadius + (12 * projection.value.scale);
    });
    const textOpacity = useDerivedValue(() => {
        if (!showLabel || !projection.value.visible) return 0;
        // Fade labels based on depth/scale
        const depthThreshold = interpolate(projection.value.scale, [0.7, 1.2], [0, 1], Extrapolate.CLAMP);
        return depthThreshold * labelOpacity.value * projection.value.opacity;
    });

    const labelText = useMemo(() => {
        const len = currentLOD === 3 ? 50 : 20;
        const t = node.content.replace(/\n/g, ' ').trim();
        return t.length > len ? t.substring(0, len) + '...' : t;
    }, [node.content, currentLOD]);

    return (
        <Group opacity={groupOpacity}>
            {/* 🟦 THE SHAPE CONTAINER (Core + Glows) */}
            <Group transform={mainTransform}>
                {/* Outer Glow */}
                {shapePath ? (
                    <Path path={shapePath} color={colors.base} style="stroke" strokeWidth={0.5} opacity={auraOpacity}>
                        <Blur blur={blurValue} />
                    </Path>
                ) : (
                    <Circle cx={0} cy={0} r={2.5} color={colors.base} opacity={auraOpacity}>
                        <Blur blur={blurValue} />
                    </Circle>
                )}

                {/* Inner Glow */}
                {shapePath ? (
                    <Path path={shapePath} color={colors.base} opacity={0.3}>
                        <Blur blur={1} />
                    </Path>
                ) : (
                    <Circle cx={0} cy={0} r={1.2} color={colors.base} opacity={0.3}>
                        <Blur blur={1} />
                    </Circle>
                )}

                {/* Core Body */}
                {shapePath ? (
                    <Path path={shapePath} color={colors.base} opacity={coreOpacity} />
                ) : (
                    <Circle cx={0} cy={0} r={1} color={colors.base} opacity={coreOpacity} />
                )}

                {/* Rim Light */}
                {depthLayer === 'FOREGROUND' && (
                    shapePath ? (
                        <Path path={shapePath} color="rgba(255,255,255,0.4)" style="stroke" strokeWidth={0.1} />
                    ) : (
                        <Circle cx={0} cy={0} r={1} color="rgba(255,255,255,0.4)" style="stroke" strokeWidth={0.1} />
                    )
                )}

                {/* Star Overlay */}
                {isStarred && (
                    shapePath ? (
                        <Path path={shapePath} color="#FFD700" style="stroke" strokeWidth={0.2} opacity={0.8} transform={[{ scale: 1.4 }]} />
                    ) : (
                        <Circle cx={0} cy={0} r={1.4} color="#FFD700" style="stroke" strokeWidth={0.2} opacity={0.8} />
                    )
                )}
            </Group>

            {/* 📝 TEXT LABEL (Outside transform group to stay upright) */}
            {font && showLabel && (
                <Group opacity={textOpacity}>
                    <SkiaText
                        x={x}
                        y={textY}
                        text={labelText}
                        font={font}
                        color="rgba(255, 255, 255, 0.9)"
                    // Center text? SkiaText draws from left baseline. 
                    // To center, we'd need to measure text width. 
                    // For now, simple left align or maybe slight offset.
                    />
                </Group>
            )}
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
