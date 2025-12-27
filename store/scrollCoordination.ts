/**
 * 📜 Scroll Coordination Store v2.0
 * 
 * Uses SharedValues for zero-latency scroll/pager coordination.
 * No React state in the critical path.
 */

import { createRef, RefObject } from 'react';
import { makeMutable } from 'react-native-reanimated';
import { create } from 'zustand';

// Direct shared values for worklet access (zero latency)
export const chronicleScrollY = makeMutable(0);
export const chronicleIsAtTopSV = makeMutable(true);
export const orbitScrollY = makeMutable(0);
export const orbitIsAtTopSV = makeMutable(true);
export const orbitIsAtBottomSV = makeMutable(true);

export interface ScrollCoordinationState {
    // Scroll refs for gesture linking
    orbitScrollRef: RefObject<any>;
    chronicleScrollRef: RefObject<any>;
}

export const useScrollCoordination = create<ScrollCoordinationState>(() => ({
    orbitScrollRef: createRef(),
    chronicleScrollRef: createRef(),
}));

/**
 * Helper: Update Chronicle scroll state (call from worklet)
 */
export const updateChronicleScroll = (offsetY: number, contentHeight: number, layoutHeight: number) => {
    'worklet';
    chronicleScrollY.value = offsetY;
    chronicleIsAtTopSV.value = offsetY <= 5; // Small threshold for touch tolerance
};

/**
 * Helper: Update Orbit scroll state (call from worklet)
 */
export const updateOrbitScroll = (offsetY: number, contentHeight: number, layoutHeight: number) => {
    'worklet';
    orbitScrollY.value = offsetY;
    orbitIsAtTopSV.value = offsetY <= 5;
    orbitIsAtBottomSV.value = offsetY >= contentHeight - layoutHeight - 10;
};
