import { create } from 'zustand';
import type { Prediction } from './predictionStore';

interface LiveContext {
    lastAction: 'TYPING' | 'READING' | 'EXPLORING';
    targetNodeId: number | null; // Wo wollen wir hin?
    highlightTerms: string[];    // Was soll leuchten?
    timestamp: number;
}

interface ContextState {
    focusVector: Float32Array | null;
    focusNodeId: number | null;
    activeScreen: 'orbit' | 'horizon' | 'memory';

    // 🚀 Node refresh trigger (increments when nodes change)
    nodeRefreshTrigger: number;

    // 🔮 ACE Predictions (Sprint 1.3)
    ambientPredictions: Prediction[];

    // ⚡ Synaptic Fire! (Edge animation state)
    synapticFire: { sourceId: number, targetId: number, timestamp: number } | null;

    // 🧠 Live Context (Sprint 3)
    liveContext: LiveContext;

    // 👻 Privacy (Sprint 2.1)
    isGhostMode: boolean;

    // Actions
    setGhostMode: (enabled: boolean) => void;
    setFocusVector: (vector: Float32Array | null) => void;
    setFocusNode: (id: number | null) => void;
    setActiveScreen: (screen: 'orbit' | 'horizon' | 'memory') => void;
    setAmbientPredictions: (predictions: Prediction[]) => void;
    triggerSynapticFire: (sourceId: number, targetId: number) => void;
    triggerNodeRefresh: () => void;
    navigateToNode: (nodeId: number) => void;
    navigateToCluster: (clusterId: number) => void;
    transitionTo: (screen: 'orbit' | 'horizon' | 'memory', context?: Partial<LiveContext>) => void;
}

export const useContextStore = create<ContextState>((set, get) => ({
    focusVector: null,
    focusNodeId: null,
    activeScreen: 'orbit',
    nodeRefreshTrigger: 0,
    ambientPredictions: [],
    synapticFire: null,

    liveContext: {
        lastAction: 'EXPLORING',
        targetNodeId: null,
        highlightTerms: [],
        timestamp: Date.now()
    },

    isGhostMode: false,

    setGhostMode: (enabled) => set({ isGhostMode: enabled }),
    setFocusVector: (vector) => set({ focusVector: vector }),
    setFocusNode: (id) => set({ focusNodeId: id }),
    setActiveScreen: (screen) => set({ activeScreen: screen }),
    setAmbientPredictions: (predictions) => set({ ambientPredictions: predictions }),

    triggerSynapticFire: (sourceId, targetId) => set({
        synapticFire: { sourceId, targetId, timestamp: Date.now() }
    }),

    triggerNodeRefresh: () => set((state) => ({
        nodeRefreshTrigger: state.nodeRefreshTrigger + 1
    })),

    transitionTo: (screen, context = {}) => {
        console.log(`[Context] 🧠 Transitioning to ${screen} with context:`, context);
        set((state) => ({
            activeScreen: screen,
            liveContext: {
                ...state.liveContext,
                ...context,
                timestamp: Date.now()
            }
        }));
    },

    navigateToNode: (nodeId) => {
        console.log('[Context] Navigating to node:', nodeId);
        // Set focus node and switch to Horizon
        get().transitionTo('horizon', { targetNodeId: nodeId, lastAction: 'EXPLORING' });
    },

    navigateToCluster: async (clusterId) => {
        // Navigation logic simplified - just used for data focus if needed
        // Camera movement logic removed
    },
}));

