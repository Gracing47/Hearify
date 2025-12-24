import { initDatabase } from '@/db';
import { create } from 'zustand';

interface ContextState {
    // Current mental focus (embedding of active thought)
    focusVector: Float32Array | null;
    focusNodeId: number | null;

    // Which screen is active
    activeScreen: 'orbit' | 'horizon' | 'memory';

    // Horizon camera state (shared)
    horizonCamera: {
        x: number;
        y: number;
        scale: number;
    };

    // Actions
    setFocusVector: (vector: Float32Array | null) => void;
    setFocusNode: (id: number | null) => void;
    setActiveScreen: (screen: 'orbit' | 'horizon' | 'memory') => void;
    updateHorizonCamera: (x: number, y: number, scale: number) => void;

    // 🔥 Smart Navigation
    navigateToNode: (nodeId: number) => void;
    navigateToCluster: (clusterId: number) => void;
}

export const useContextStore = create<ContextState>((set, get) => ({
    focusVector: null,
    focusNodeId: null,
    activeScreen: 'orbit',
    horizonCamera: { x: 0, y: 0, scale: 1 },

    setFocusVector: (vector) => set({ focusVector: vector }),
    setFocusNode: (id) => set({ focusNodeId: id }),
    setActiveScreen: (screen) => set({ activeScreen: screen }),
    updateHorizonCamera: (x, y, scale) =>
        set({ horizonCamera: { x, y, scale } }),

    navigateToNode: async (nodeId) => {
        const db = await initDatabase();
        const result = await db.execute('SELECT x, y FROM snippets WHERE id = ?', [nodeId]);
        const node = result.rows?.[0] as any;

        if (node) {
            // Smoothly pan Horizon camera to this node
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
            set({
                horizonCamera: { x: centroid.x, y: centroid.y, scale: 2.0 },
            });
        }
    },
}));
