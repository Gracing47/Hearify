/**
 * Neural Orb visualization component using React Native Skia
 * 
 * Dev notes:
 * - GPU-accelerated with custom GLSL shader
 * - Reanimated SharedValue for audio-reactive pulsation
 * - Color transitions based on AI state
 */

import { Canvas, Circle, Group, Paint, Shader, Skia } from '@shopify/react-native-skia';
import React, { useMemo } from 'react';
import { Dimensions } from 'react-native';
import { SharedValue, useDerivedValue, useSharedValue, withSpring } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');
const ORB_SIZE = 160; // Standardized size

interface NeuralOrbProps {
    intensity: SharedValue<number>; // SharedValue from Reanimated
    state: 'idle' | 'listening' | 'thinking' | 'speaking';
}

/**
 * Advanced Neural Plasma Shader
 */
const orbShader = Skia.RuntimeEffect.Make(`
  uniform vec2 resolution;
  uniform float time;
  uniform float intensity;
  uniform vec3 color;
  
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  half4 main(vec2 fragCoord) {
    // Normalize coordinates to [0, 1] then center to [-0.5, 0.5]
    vec2 uv = fragCoord / resolution - 0.5;
    float d = length(uv) * 2.0; // range 0 to 1 at edges
    
    // Complex plasma movement
    float n1 = noise(uv * 4.0 + time * 0.6 + intensity);
    float n2 = noise(uv * 8.0 - time * 0.8 + n1);
    
    // Core and outer layers - adjusted for normalized d
    float shape = 0.6 + 0.1 * n2 + (0.15 * intensity);
    float glow = smoothstep(shape, shape - 0.4, d);
    
    // Dynamic color variations
    vec3 baseColor = color * (0.8 + 0.3 * n1);
    // Subtle inner highlights
    vec3 highlights = vec3(1.0) * pow(glow, 8.0) * 0.3;
    
    float alpha = glow * (0.85 + 0.15 * intensity);
    
    return half4(baseColor + highlights, alpha);
  }
`)!;

export function NeuralOrb({ intensity, state }: NeuralOrbProps) {
    const time = useSharedValue(0);

    // Animate time for shader
    React.useEffect(() => {
        const interval = setInterval(() => {
            time.value += 0.016; // ~60fps
        }, 16);

        return () => clearInterval(interval);
    }, [time]);

    // Animate intensity changes using another shared value for spring smoothing
    const animatedIntensity = useDerivedValue(() => {
        return withSpring(intensity.value, {
            damping: 10,
            stiffness: 100,
        });
    });

    // Color based on state
    const color = useMemo(() => {
        switch (state) {
            case 'idle':
                return [0.2, 0.4, 0.9]; // Blue
            case 'listening':
                return [0.6, 0.2, 0.9]; // Purple
            case 'thinking':
                return [0.9, 0.4, 0.7]; // Pink
            case 'speaking':
                return [0.9, 0.5, 0.2]; // Orange
            default:
                return [0.2, 0.4, 0.9];
        }
    }, [state]);

    // Derived uniforms for shader
    const uniforms = useDerivedValue(() => ({
        resolution: [ORB_SIZE, ORB_SIZE],
        time: time.value,
        intensity: animatedIntensity.value,
        color,
    }));

    return (
        <Canvas style={{ width: ORB_SIZE, height: ORB_SIZE }}>
            <Group>
                <Shader source={orbShader} uniforms={uniforms} />
                <Circle cx={ORB_SIZE / 2} cy={ORB_SIZE / 2} r={ORB_SIZE / 2}>
                    <Paint style="fill" />
                </Circle>
            </Group>
        </Canvas>
    );
}
