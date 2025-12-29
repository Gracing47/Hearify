/**
 * 📜 NEURAL HORIZON — UX Contracts v2.0
 * All behavioral contracts and decision rules.
 * Every visual element answers: When? How much? What priority?
 */

import { NEURAL_TOKENS } from './neuralTokens';

// ============================================================================
// CTC STATE CONTRACT
// ============================================================================

export type CTCState = 'IDLE' | 'AWARENESS' | 'INTENT' | 'REFLECTION';

export interface CTCTransition {
    from: CTCState;
    to: CTCState;
    trigger: string;
    visualImpact: string;
}

export const CTC_TRANSITIONS: CTCTransition[] = [
    { from: 'IDLE', to: 'AWARENESS', trigger: 'Touch canvas', visualImpact: 'Enable labels, breathing continues' },
    { from: 'AWARENESS', to: 'INTENT', trigger: 'Pan/Zoom start', visualImpact: 'Disable breathing, focus on gesture' },
    { from: 'INTENT', to: 'AWARENESS', trigger: 'Gesture end + 180ms settle', visualImpact: 'Re-enable breathing smoothly' },
    { from: 'IDLE', to: 'REFLECTION', trigger: 'Modal open', visualImpact: 'Pause all background motion' },
    { from: 'AWARENESS', to: 'REFLECTION', trigger: 'Modal open', visualImpact: 'Pause all background motion' },
    { from: 'INTENT', to: 'REFLECTION', trigger: 'Modal open', visualImpact: 'Pause all background motion' },
    { from: 'REFLECTION', to: 'AWARENESS', trigger: 'Modal close', visualImpact: 'Resume breathing after 500ms' },
];

// ============================================================================
// ZOOM CONTRACT
// ============================================================================

export const ZOOM_CONTRACT = {
    // Piecewise mapping for precision
    scaleTransform: (pinchScale: number, currentScale: number): number => {
        'worklet';
        const next = currentScale * pinchScale;
        // Far-zoom: aggressive (speed)
        if (next < 1.0) {
            return Math.pow(pinchScale, 0.85);
        }
        // Near-zoom: precise (control)
        return Math.pow(pinchScale, 0.65);
    },

    friction: NEURAL_TOKENS.animation.zoom.friction,
    minScale: NEURAL_TOKENS.animation.zoom.minScale,
    maxScale: NEURAL_TOKENS.animation.zoom.maxScale,
    initialScale: NEURAL_TOKENS.animation.zoom.initialScale,

    snap: {
        enabled: true,
        velocityThreshold: NEURAL_TOKENS.animation.zoom.snap.velocityThreshold,
        magnetRadius: NEURAL_TOKENS.spacing.node.magnetRadius,
        animation: {
            damping: NEURAL_TOKENS.animation.zoom.snap.damping,
            stiffness: NEURAL_TOKENS.animation.zoom.snap.stiffness,
            mass: NEURAL_TOKENS.animation.zoom.snap.mass,
        },
        intentionGate: {
            maxPanVelocity: 100,
            requireGestureEnd: true,
        }
    }
} as const;

// ============================================================================
// LOD CONTRACT
// ============================================================================

export interface LODLevel {
    scaleRange: [number, number];
    showLabels: boolean;
    maxLabels: number;
    labelLength: number;
    showIcons: boolean;
    iconOpacity: number;
    nodeDetail: 'low' | 'medium' | 'high';
}

export const LOD_CONTRACT = {
    levels: {
        LOD1: {
            scaleRange: [0.2, 0.7] as [number, number],
            showLabels: false,
            maxLabels: NEURAL_TOKENS.budgets.labels.LOD1,
            labelLength: 0,
            showIcons: false,
            iconOpacity: 0,
            nodeDetail: 'low' as const,
        },
        LOD2: {
            scaleRange: [0.7, 1.2] as [number, number],
            showLabels: true,
            maxLabels: NEURAL_TOKENS.budgets.labels.LOD2,
            labelLength: 20,
            showIcons: true,
            iconOpacity: 0.6,
            nodeDetail: 'medium' as const,
        },
        LOD3: {
            scaleRange: [1.2, 3.0] as [number, number],
            showLabels: true,
            maxLabels: NEURAL_TOKENS.budgets.labels.LOD3,
            labelLength: 50,
            showIcons: true,
            iconOpacity: 1.0,
            nodeDetail: 'high' as const,
        }
    },

    labelSelection: {
        method: 'salience' as const,
        collisionStrategy: 'grid' as const,
        gridCellSize: NEURAL_TOKENS.spacing.label.gridCellSize,
    },

    revealPolicy: {
        afterCameraSettle: true,
        settleDelay: NEURAL_TOKENS.animation.labels.settleDelay,
        animation: {
            duration: NEURAL_TOKENS.animation.labels.revealDuration,
            opacity: [0, 1] as [number, number],
            blur: [NEURAL_TOKENS.animation.labels.blurStart, NEURAL_TOKENS.animation.labels.blurEnd] as [number, number],
        }
    },

    // Helper to get current LOD level
    getCurrentLevel: (scale: number): 'LOD1' | 'LOD2' | 'LOD3' => {
        'worklet';
        if (scale < 0.7) return 'LOD1';
        if (scale < 1.2) return 'LOD2';
        return 'LOD3';
    }
} as const;

// ============================================================================
// NODE CONTRACT
// ============================================================================

export const NODE_CONTRACT = {
    radius: {
        base: NEURAL_TOKENS.spacing.node.baseRadius,
        min: NEURAL_TOKENS.spacing.node.minRadius,
        max: NEURAL_TOKENS.spacing.node.maxRadius,
        calculate: (connectionCount: number, maxConnections: number): number => {
            'worklet';
            const normalized = maxConnections > 0 ? connectionCount / maxConnections : 0;
            const raw = 16 * Math.sqrt(normalized);
            return Math.max(12, Math.min(28, raw));
        },
        smoothing: {
            enabled: true,
            method: 'EWMA' as const,
            alpha: 0.3,
        }
    },

    colors: NEURAL_TOKENS.colors.node,

    icons: {
        showAtLOD: 2,
        size: 16,
        opacity: {
            LOD2: 0.6,
            LOD3: 1.0,
        }
    },

    layers: {
        background: {
            z: -1,
            ageDaysThreshold: 30,
            opacity: 0.7,
            blur: 1,
        },
        midground: {
            z: 0,
            opacity: 1.0,
        },
        foreground: {
            z: 1,
            newDaysThreshold: 3,
            opacity: 1.0,
            scale: 1.15,
            shadow: 'enhanced',
        }
    },

    starred: {
        ring: {
            enabled: true,
            width: 3,
            style: 'dashed' as const,
            dashPattern: [4, 4] as [number, number],
        },
        pulse: {
            enabled: true,
            cycle: 1200,
            glowRange: [0.8, 1.2] as [number, number],
        },
        scale: 1.15,
        salienceBoost: 0.3,
    }
} as const;

// ============================================================================
// BREATHING CONTRACT
// ============================================================================

export const BREATHING_CONTRACT = {
    enabledStates: ['IDLE', 'AWARENESS'] as CTCState[],

    animation: {
        cycle: NEURAL_TOKENS.animation.breathing.cycle,
        amplitude: {
            scale: [0.98, 1.02] as [number, number],
            glow: [0.6, 1.0] as [number, number],
        },
        phaseOffset: (nodeIndex: number) => nodeIndex * 0.1,
    },

    transitions: {
        onEnable: {
            delay: 500,
            fadeIn: 800,
        },
        onDisable: {
            immediate: true,
            fadeOut: 0,
        }
    },

    isEnabled: (ctcState: CTCState): boolean => {
        return ctcState === 'IDLE' || ctcState === 'AWARENESS';
    }
} as const;

// ============================================================================
// CLUSTER CONTRACT
// ============================================================================

export const CLUSTER_CONTRACT = {
    default: {
        method: 'convex_hull' as const,
        style: {
            fillOpacity: 0.08,
            strokeOpacity: 0.2,
            strokeWidth: 2,
            blur: 8,
        },
        maxVisible: 5,
    },

    analysisMode: {
        method: 'voronoi' as const,
        toggle: 'user_preference',
    }
} as const;

// ============================================================================
// MINIMAP CONTRACT
// ============================================================================

export const MINIMAP_CONTRACT = {
    autoAppear: {
        enabled: true,
        conditions: {
            zoomThreshold: 0.55,
            rapidPans: { count: 2, withinMs: 3000 },
        }
    },

    toggle: {
        gesture: 'three_finger_tap',
        sticky: true,
    },

    style: {
        position: 'bottom_right' as const,
        size: { width: 120, height: 120 },
        background: 'rgba(0, 0, 0, 0.7)',
        border: 'rgba(255, 255, 255, 0.15)',
        blur: 10,
    },

    content: {
        showNodes: false,
        showClusters: true,
        showViewport: true,
        showCompass: true,
    }
} as const;

// ============================================================================
// HUD CONTRACT
// ============================================================================

export const HUD_CONTRACT = {
    visibility: {
        default: 'auto_hide' as const,
        hideDelay: 3000,
        recallGestures: {
            tap_canvas: 'temporary' as const,
            long_press_canvas: 'sticky' as const,
            two_finger_tap: 'toggle' as const,
        }
    },

    stats: [
        { id: 'today', label: 'Today', icon: '✨' },
        { id: 'connected', label: 'Connected', icon: '🔗' },
        { id: 'clusters', label: 'Clusters', icon: '🌌' },
        { id: 'continuity', label: 'Rhythm', icon: '🎵' }, // NOT "streak" — avoid gamification
    ],

    counterAnimation: {
        enabled: true,
        duration: 600,
        sound: false,
    }
} as const;

// ============================================================================
// MODAL CONTRACT
// ============================================================================

export const MODAL_CONTRACT = {
    onOpen: {
        ctcState: 'REFLECTION' as CTCState,
        horizonBehavior: {
            breathing: false,
            edgeActivity: false,
            motionBudget: 0,
        }
    },

    structure: {
        header: {
            height: 80,
            content: ['preview_text', 'metadata', 'close_button'],
        },
        primaryActions: {
            layout: 'grid_2x2' as const,
            actions: [
                { id: 'connect', icon: 'link', label: 'Connect', style: 'primary' },
                { id: 'star', icon: 'star', label: 'Star', style: 'primary' },
                { id: 'edit', icon: 'edit', label: 'Edit', style: 'primary' },
                { id: 'delete', icon: 'trash', label: 'Delete', style: 'destructive' },
            ],
        },
        secondaryActions: {
            layout: 'horizontal_scroll' as const,
            actions: [
                { id: 'share', icon: 'share', label: 'Share' },
                { id: 'archive', icon: 'archive', label: 'Archive' },
                { id: 'duplicate', icon: 'copy', label: 'Duplicate' },
            ],
        },
    },

    suggestions: {
        count: 5,
        policy: {
            similar: 3,
            goalAligned: 1,
            novel: 1,
        },
        ui: 'horizontal_carousel' as const,
    },

    expansion: {
        enabled: true,
        dragThreshold: 0.4,
        features: ['rich_text_edit', 'connection_graph', 'version_history'],
    }
} as const;

// ============================================================================
// SALIENCE CALCULATION
// ============================================================================

export interface NodeSalience {
    importance: number;
    recency: number;
    focusAffinity: number;
    isStarred: boolean;
}

export const calculateSalience = (node: NodeSalience): number => {
    'worklet';
    const base = (
        node.importance * 0.4 +
        node.recency * 0.3 +
        node.focusAffinity * 0.3
    );
    return node.isStarred ? Math.min(1, base + NODE_CONTRACT.starred.salienceBoost) : base;
};

// ============================================================================
// MOTION BUDGET
// ============================================================================

export const MOTION_BUDGET = {
    maxActiveNodes: NEURAL_TOKENS.budgets.motion.maxActiveNodes,
    maxVisibleLabels: NEURAL_TOKENS.budgets.labels,
    maxCameraMovesPerSecond: NEURAL_TOKENS.budgets.motion.maxCameraMovesPerSecond,
    maxEdgeActivityClusters: NEURAL_TOKENS.budgets.motion.maxEdgeActivityClusters,

    breathingEnabled: (ctcState: CTCState): boolean => {
        return ctcState === 'IDLE' || ctcState === 'AWARENESS';
    },
    breathingAmplitude: NEURAL_TOKENS.animation.breathing.amplitude,
    breathingCycle: NEURAL_TOKENS.animation.breathing.cycle,
} as const;

// ============================================================================
// THREAD CONTRACT (Hub-and-Spoke Context Engine)
// ============================================================================

export const THREAD_CONTRACT = {
    // 🧠 State Logic
    availability: {
        canOpen: (ctcMode: CTCState) => ctcMode !== 'INTENT',
        autoCloseTimeout: 30000, // 30s idle closes the thread
    },

    // 🎭 Visual Behavior per CTC Mode
    visualBehavior: {
        REFLECTION: {
            threadExpanded: true,
            aiActionsEnabled: true,
            motionScale: 1.0,
            showUpstream: true,
            showDownstream: true,
            showLateral: true,
        },
        AWARENESS: {
            threadExpanded: false,
            aiActionsEnabled: false,
            motionScale: 0.0,
            showUpstream: true,
            showDownstream: false,
            showLateral: false,
        },
        INTENT: {
            threadExpanded: false,
            aiActionsEnabled: false,
            motionScale: 0.0,
            showUpstream: false,
            showDownstream: false,
            showLateral: false,
        },
        IDLE: {
            threadExpanded: true,
            aiActionsEnabled: true,
            motionScale: 0.6,
            showUpstream: true,
            showDownstream: true,
            showLateral: true,
        },
    },
} as const;

export const THREAD_MOTION_BUDGET = {
    maxActiveAnimations: 3,        // Focus Node + 2 neighbors max
    scrollParallax: 0.15,          // Minimal depth
    transitionDuration: 300,       // Snappy, not floaty
    useSteppedGradients: true,     // Force CSS gradients over SVG
    maxUpstreamNodes: 5,
    maxDownstreamNodes: 5,
    maxLateralNodes: 8,
} as const;

export const THREAD_COLORS = {
    upstream: {
        line: '#3b82f6',      // Blue - Past/Context
        dot: '#60a5fa',
        label: 'rgba(59, 130, 246, 0.8)',
    },
    focus: {
        border: '#818cf8',    // Purple - Current
        glow: 'rgba(129, 140, 248, 0.3)',
    },
    downstream: {
        line: '#22c55e',      // Green - Future/Implications
        dot: '#4ade80',
        label: 'rgba(34, 197, 94, 0.8)',
    },
    lateral: {
        line: '#f59e0b',      // Amber - Related
        dot: '#fbbf24',
    },
} as const;

// ============================================================================
// PERFORMANCE CONTRACTS (Phase 0 - Battery-Aware Performance)
// ============================================================================

/**
 * Performance contracts for battery-aware rendering.
 * 
 * ECO MODE activates when:
 * 1. System Low Power Mode is enabled (iOS/Android)
 * 2. Battery < 20% AND device is unplugged
 * 
 * @see hooks/useEcoMode.ts for implementation
 */
export const PERFORMANCE_CONTRACTS = {
    neuralCanvas: {
        /** Maximum nodes before performance degradation */
        maxNodes: 500,

        /** Target frame rate in normal mode */
        targetFPS: 60,

        /** 🔋 ECO MODE: Activated on low battery/system low power mode */
        ecoMode: {
            /** Battery level threshold (0.0 - 1.0) */
            triggerLevel: 0.20,

            /** Target FPS in eco mode (physics throttled to ~30fps) */
            targetFPS: 30,

            /** Frame time threshold in ms (1000/30 ≈ 33.33ms) */
            frameTimeThreshold: 33.33,

            /** Background rendering strategy */
            background: 'STATIC' as const,  // No nebula shader, just solid black

            /** Visual effects strategy */
            effects: 'MINIMAL' as const,    // No blur/glow, opacity only

            /** ACE (Ambient Connection Engine) polling interval in ms */
            aceInterval: 3000,
        },
    },

    animation: {
        /** Maximum concurrent animations (motion budget) */
        maxSimultaneous: 5,

        /** Transition duration cap in ms */
        maxDuration: 500,
    },

    /** Static fallback background color when shaders disabled */
    fallbackBackground: '#000000',
} as const;

// Type exports for type safety
export type PerformanceMode = 'NORMAL' | 'ECO';
export type BackgroundMode = typeof PERFORMANCE_CONTRACTS.neuralCanvas.ecoMode.background;
export type EffectsMode = typeof PERFORMANCE_CONTRACTS.neuralCanvas.ecoMode.effects;
