import { create } from 'zustand';

interface ContextState {
    focusVector: Float32Array | null;
    focusNodeId: number | null;
    activeScreen: 'orbit' | 'horizon' | 'memory';

    // 🚀 Node refresh trigger (increments when nodes change)
    nodeRefreshTrigger: number;

    // Actions
    setFocusVector: (vector: Float32Array | null) => void;
    setFocusNode: (id: number | null) => void;
    setActiveScreen: (screen: 'orbit' | 'horizon' | 'memory') => void;
    triggerNodeRefresh: () => void;
    navigateToNode: (nodeId: number) => void;
    navigateToCluster: (clusterId: number) => void;
}

export const useContextStore = create<ContextState>((set, get) => ({
    focusVector: null,
    focusNodeId: null,
    activeScreen: 'orbit',
    nodeRefreshTrigger: 0,

    setFocusVector: (vector) => set({ focusVector: vector }),
    setFocusNode: (id) => set({ focusNodeId: id }),
    setActiveScreen: (screen) => set({ activeScreen: screen }),

    triggerNodeRefresh: () => set((state) => ({
        nodeRefreshTrigger: state.nodeRefreshTrigger + 1
    })),

    navigateToNode: async (nodeId) => {
        // Navigation logic simplified - just set focus node
        // Camera movement logic removed
        set({ focusNodeId: nodeId });
    },

    navigateToCluster: async (clusterId) => {
        // Navigation logic simplified - just used for data focus if needed
        // Camera movement logic removed
    },
}));

