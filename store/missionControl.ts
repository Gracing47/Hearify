import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface TelemetryData {
    fps: number;
    memoryMB: number;
    nodeCount: number;
    lastInsertMs: number;
    activeUsers: number;
}

interface MissionState {
    // Current mental focus
    focusVector: Float32Array | null;
    focusNodeId: number | null;
    focusClusterId: number | null;

    // Active screen
    activeScreen: 'orbit' | 'horizon' | 'memory';

    // Horizon camera (synchronized)
    horizonCamera: {
        x: number;
        y: number;
        z: number;
        scale: number;
        targetX: number;
        targetY: number;
        isAnimating: boolean;
    };

    // Performance telemetry
    telemetry: TelemetryData;

    // Actions
    setFocus: (vector: Float32Array | null, nodeId: number | null) => void;
    setActiveScreen: (screen: 'orbit' | 'horizon' | 'memory') => void;
    updateCamera: (camera: Partial<MissionState['horizonCamera']>) => void;
    updateTelemetry: (data: Partial<TelemetryData>) => void;

    // Autonomous navigation
    autonomousNavigation: {
        enabled: boolean;
        followFocus: boolean;
        predictiveLoading: boolean;
    };
}

export const useMissionControl = create<MissionState>()(
    subscribeWithSelector((set, get) => ({
        focusVector: null,
        focusNodeId: null,
        focusClusterId: null,
        activeScreen: 'orbit',
        horizonCamera: {
            x: 0,
            y: 0,
            z: 0,
            scale: 1,
            targetX: 0,
            targetY: 0,
            isAnimating: false,
        },
        telemetry: {
            fps: 60,
            memoryMB: 0,
            nodeCount: 0,
            lastInsertMs: 0,
            activeUsers: 1,
        },
        autonomousNavigation: {
            enabled: true,
            followFocus: true,
            predictiveLoading: true,
        },

        setFocus: (vector, nodeId) => {
            set({ focusVector: vector, focusNodeId: nodeId });
        },

        setActiveScreen: (screen) => {
            set({ activeScreen: screen });
        },

        updateCamera: (camera) => {
            set((state) => ({
                horizonCamera: { ...state.horizonCamera, ...camera }
            }));
        },

        updateTelemetry: (data) => {
            set((state) => ({
                telemetry: { ...state.telemetry, ...data }
            }));
        },
    }))
);
