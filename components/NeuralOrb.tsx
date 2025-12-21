/**
 * Neural Orb - The Soul of Hearify
 * High-fidelity SKSL Shader with refraction and organic distortion.
 */

import { Canvas, Circle, Fill, Group, Shader, Skia } from '@shopify/react-native-skia';
import React from 'react';
import { SharedValue, useDerivedValue, useFrameCallback, useSharedValue, withSpring } from 'react-native-reanimated';

const DEFAULT_ORB_SIZE = 280; // Default size when not specified

interface NeuralOrbProps {
    intensity: SharedValue<number>;
    state: 'idle' | 'listening' | 'thinking' | 'speaking';
    size?: number; // Optional custom size
}

const neuralOrbShader = Skia.RuntimeEffect.Make(`
  uniform float u_time;
  uniform float u_intensity;
  uniform vec3 u_color;
  uniform vec2 u_res;

  float sdCircle(vec2 p, float r) {
    return length(p) - r;
  }

  mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
  }

  half4 main(vec2 pos) {
    vec2 uv = (pos - u_res * 0.5) / u_res.y;
    float d = length(uv);
    
    // 1. Organic Warp Logic
    vec2 warp = uv;
    warp *= rot(u_time * 0.2 + d * 2.0);
    float noise = sin(warp.x * 10.0 + u_time) * cos(warp.y * 10.0 - u_time);
    uv += noise * 0.05 * u_intensity;

    // 2. Neural Glass Body
    float circle = sdCircle(uv, 0.35 + u_intensity * 0.05);
    float edge = 1.0 - smoothstep(0.0, 0.02, abs(circle));
    
    // 3. Chromatic Aberration & Refraction
    float r = smoothstep(0.35 + u_intensity * 0.06, 0.0, length(uv + vec2(0.005, 0.0)));
    float g = smoothstep(0.35 + u_intensity * 0.05, 0.0, length(uv));
    float b = smoothstep(0.35 + u_intensity * 0.04, 0.0, length(uv - vec2(0.005, 0.0)));
    
    vec3 color = vec3(r, g, b) * u_color;
    
    // 4. Inner Glow & Plasma
    float plasma = sin(d * 20.0 - u_time * 3.0) * 0.5 + 0.5;
    color += plasma * u_color * 0.2 * (1.0 - d);
    
    // 5. Specular Highlight (The Glass Look)
    float spec = pow(1.0 - length(uv - vec2(-0.1, -0.1)), 12.0);
    color += spec * 0.4;

    float alpha = smoothstep(0.01, -0.01, circle);
    
    return half4(color * alpha, alpha * 0.9);
  }
`)!;

export function NeuralOrb({ intensity, state, size = DEFAULT_ORB_SIZE }: NeuralOrbProps) {
    const time = useSharedValue(0);

    const thinkingPulse = useSharedValue(0);

    useFrameCallback((frameInfo) => {
        time.value += 0.01;
        if (state === 'thinking') {
            thinkingPulse.value = Math.sin(frameInfo.timestamp / 300) * 0.15 + 0.15;
        } else {
            thinkingPulse.value = 0;
        }
    });

    const springIntensity = useDerivedValue(() => {
        const base = intensity.value + thinkingPulse.value;
        return withSpring(base, { damping: 12, stiffness: 90 });
    });

    const orbColor = useDerivedValue(() => {
        switch (state) {
            case 'idle': return [0.388, 0.4, 0.945];      // Indigo
            case 'listening': return [0.937, 0.267, 0.267]; // Pulse Red
            case 'thinking': return [0.639, 0.388, 0.945];  // Violet
            case 'speaking': return [0.078, 0.945, 0.584];  // Energy Teal
            default: return [0.388, 0.4, 0.945];
        }
    });

    const uniforms = useDerivedValue(() => ({
        u_time: time.value,
        u_intensity: springIntensity.value,
        u_color: orbColor.value,
        u_res: [size, size]
    }));

    return (
        <Canvas style={{ width: size, height: size }}>
            <Fill color="transparent" />
            <Group>
                <Shader
                    source={neuralOrbShader}
                    uniforms={uniforms}
                />
                <Circle cx={size / 2} cy={size / 2} r={size / 2} />
            </Group>
        </Canvas>
    );
}
