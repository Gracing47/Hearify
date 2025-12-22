import {
    BlurMask,
    Circle,
    Group,
    Paint,
    Shader,
    vec
} from '@shopify/react-native-skia';
import React from 'react';
import {
    Extrapolate,
    interpolate,
    SharedValue,
    useDerivedValue
} from 'react-native-reanimated';

interface SemanticNodeProps {
    x: SharedValue<number>;
    y: SharedValue<number>;
    color: string;
    label: string;
    zoomLevel: SharedValue<number>; // Global Zoom State from GestureHandler
    font: any; // Skia Font Object
    selected?: boolean;
    shader: any; // Skia Runtime Effect
    time: SharedValue<number>;
    active: SharedValue<number>;
    colorVec: number[];
    blur?: SharedValue<number>;
}

export const SemanticNode = ({ x, y, color, label, zoomLevel, font, selected, shader, time, active, colorVec, blur }: SemanticNodeProps) => {

    // --- LOD LOGIC (UI Thread Calculations) ---
    // ... (rest is same)

    // 1. Dynamic Size: Nodes shrink slightly when zooming in to make space for text
    const orbRadius = useDerivedValue(() => {
        return interpolate(zoomLevel.value, [0.5, 2.0], [12, 18], Extrapolate.CLAMP);
    });

    // 2. Label Visibility: Fades in between 2.5x and 3.5x zoom (Deep Zoom)
    const labelOpacity = useDerivedValue(() => {
        return interpolate(
            zoomLevel.value,
            [2.5, 3.5],
            [0, 1], // 0 to 1 for Skia Paint
            Extrapolate.CLAMP
        );
    });

    // 3. Focus Glow: Only visible when very close (Deep Inspection)
    const glowOpacity = useDerivedValue(() => {
        if (selected) return 1;
        return interpolate(
            zoomLevel.value,
            [1.5, 2.5],
            [0, 1],
            Extrapolate.CLAMP
        );
    });

    // Shader Uniforms
    const uniforms = useDerivedValue(() => {
        // Convert hex color string to RGB vec3? 
        // Skia Shader expects vec3 or vec4 for color. 
        // We might need to pass color as [r,g,b] array or let shader handle it?
        // Let's assume color is passed as string, but shader needs vec3.
        // We can use a simple color conversion or pass a parsed color prop.
        // For simplicity, let's pass a dummy white color and handle tint in shader if possible?
        // No, shader needs actual color.
        // Let's try passing the Skia Color directly if possible?
        // Actually, let's use the color prop directly in Circle color and use shader for effect?
        // No, shader replaces color.

        // Let's pass the color as vec3. But 'color' prop is string.
        // We need a helper to hex to vec3. 
        // Or we pass the color components from NeuralCanvas.

        return {
            u_time: time.value,
            u_center: vec(x.value, y.value),
            u_radius: orbRadius.value,
            u_color: colorVec,
            u_intensity: 1.0,
            u_active: active.value
        };
    });

    // Hex to Vec3 Helper (Basic approximation or separate util)
    // Since we can't easily parse hex in worklet without helpers, 
    // let's rely on NeuralCanvas passing numeric colors if needed.
    // BUT 'color' prop is string.

    // Re-check: semanticNode receives 'color' (string).

    return (
        <Group>
            {/* LAYER 1: Organic Bloom Orb */}
            <Circle cx={x} cy={y} r={orbRadius}>
                <Shader source={shader} uniforms={uniforms} />
                {blur && <BlurMask blur={blur} style="normal" />}
            </Circle>

            {/* LAYER 2: The Label (Context) - Now truncated and subtle */}


            {/* LAYER 3: Interaction Glow (High Detail) */}
            <Group>
                <Paint opacity={glowOpacity} style="stroke" strokeWidth={2} color="white" />
                <Circle cx={x} cy={y} r={useDerivedValue(() => orbRadius.value + 4)}>
                    <BlurMask blur={4} style="normal" />
                </Circle>
            </Group>
        </Group>
    );
};
