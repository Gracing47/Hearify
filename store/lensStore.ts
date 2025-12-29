import { create } from 'zustand';

export type LensMode = 'EXPLORE' | 'LEARN' | 'STRATEGY' | 'REFLECT';

interface LensState {
    mode: LensMode;
    setMode: (mode: LensMode) => void;
}

export const useLensStore = create<LensState>((set) => ({
    mode: 'EXPLORE',
    setMode: (mode) => set({ mode }),
}));
