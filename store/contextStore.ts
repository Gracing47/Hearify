import { initDatabase } from '@/db';
import { create } from 'zustand';

interface ContextState {
    focusVector: Float32Array | null;
    focusNodeId: number | null;
    activeScreen: 'orbit' | 'horizon' | 'memory';
    horizonCamera: { x: number; y: number; scale: number };

    // 🚀 Pre-Cognition: Live focus target for Horizon camera drift
    liveFocusTarget: { x: number; y: number; confidence: number } | null;

    // 🚀 Node refresh trigger (increments when nodes change)
    nodeRefreshTrigger: number;

    // Actions
    setFocusVector: (vector: Float32Array | null) => void;
    setFocusNode: (id: number | null) => void;
    setActiveScreen: (screen: 'orbit' | 'horizon' | 'memory') => void;
    updateHorizonCamera: (x: number, y: number, scale: number) => void;
    setLiveFocusTarget: (target: { x: number; y: number; confidence: number } | null) => void;
    triggerNodeRefresh: () => void;
    navigateToNode: (nodeId: number) => void;
    navigateToCluster: (clusterId: number) => void;
}

export const useContextStore = create<ContextState>((set, get) => ({
    focusVector: null,
    focusNodeId: null,
    activeScreen: 'orbit',
    horizonCamera: { x: 0, y: 0, scale: 1 },
    liveFocusTarget: null,
    nodeRefreshTrigger: 0,

    setFocusVector: (vector) => set({ focusVector: vector }),
    setFocusNode: (id) => set({ focusNodeId: id }),
    setActiveScreen: (screen) => set({ activeScreen: screen }),
    updateHorizonCamera: (x, y, scale) => set({ horizonCamera: { x, y, scale } }),
    setLiveFocusTarget: (target) => set({ liveFocusTarget: target }),

    triggerNodeRefresh: () => set((state) => ({
        nodeRefreshTrigger: state.nodeRefreshTrigger + 1
    })),

    navigateToNode: async (nodeId) => {
        const db = await initDatabase();
        const result = await db.execute('SELECT x, y FROM snippets WHERE id = ?', [nodeId]);
        const node = result.rows?.[0] as any;
        if (node) {
            set({
                horizonCamera: { x: node.x || 0, y: node.y || 0, scale: 3.5 },
                focusNodeId: nodeId,
            });
        }
    },

    navigateToCluster: async (clusterId) => {
        const db = await initDatabase();
        const result = await db.execute('SELECT x, y FROM cluster_centroids WHERE cluster_id = ?', [clusterId]);
        const centroid = result.rows?.[0] as any;
        if (centroid) {
            set({ horizonCamera: { x: centroid.x, y: centroid.y, scale: 2.0 } });
        }
    },
}));

