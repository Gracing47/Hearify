// hooks/useCameraFlight.ts
import { useCallback } from 'react';
import { Easing, SharedValue, withTiming } from 'react-native-reanimated';

/**
 * ✈️ THE FLIGHT ENGINE (Sprint 3)
 * Orchestrates cinematic 3D camera movements through the Neural Horizon.
 */
export const useCameraFlight = (
    cameraX: SharedValue<number>,
    cameraY: SharedValue<number>,
    cameraZ: SharedValue<number>
) => {

    const flyToNode = useCallback((x: number, y: number, z: number) => {
        'worklet';

        // 1. Calculate target position
        // Target Z: We want to be slightly "behind" the node to see it
        // If node is at Z=0, Camera at Z=-300 gives nice context.
        const targetZ = z - 200;

        // Invert coordinates because we move the camera, not the world
        const targetX = -x;
        const targetY = -y;

        // 2. Cinematic Easing (Logarithmic Ease-Out)
        // Starts fast, lands like a feather.
        const duration = 1500;
        const easing = Easing.out(Easing.exp);

        // 3. Launch Animation
        console.log(`[Flight] ✈️ Launching to {${x.toFixed(0)}, ${y.toFixed(0)}, ${z.toFixed(0)} } `);

        cameraX.value = withTiming(targetX, { duration, easing });
        cameraY.value = withTiming(targetY, { duration, easing });
        cameraZ.value = withTiming(targetZ, { duration, easing });
    }, [cameraX, cameraY, cameraZ]);

    return { flyToNode };
};
