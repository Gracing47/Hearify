import {
    Canvas,
    Fill,
    Shader,
    Skia
} from '@shopify/react-native-skia';
import React from 'react';
import { StyleSheet } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';

// GLSL Shader for organic noise
const GRAIN_SHADER = Skia.RuntimeEffect.Make(`
  uniform float2 u_resolution;
  uniform float u_time;

  // Pseudo-random generator
  float random(float2 st) {
    return fract(sin(dot(st.xy, float2(12.9898,78.233))) * 43758.5453123);
  }

  half4 main(float2 xy) {
    // Generate noise based on pixel position + time (animated grain)
    float noise = random(xy + u_time);
    
    // Strength: Keep it very subtle (0.03 - 0.05)
    // Too high = broken TV. Too low = invisible.
    float strength = 0.04; 
    
    // Return white noise with PREMULTIPLIED alpha
    // Skia shaders expect premultiplied colors (rgb * a, a)
    float alpha = noise * strength;
    return half4(alpha, alpha, alpha, alpha);
  }
`)!;

export const FilmGrainOverlay = ({ width, height }: { width: number, height: number }) => {
    const time = useSharedValue(0);

    useFrameCallback((frameInfo) => {
        time.value = frameInfo.timeSinceFirstFrame / 1000;
    });

    const uniforms = useDerivedValue(() => ({
        u_resolution: [width, height],
        u_time: time.value * 5.0, // Speed up slightly since using seconds
    }));

    return (
        <Canvas style={[styles.overlay, { width, height }]} pointerEvents="none">
            <Fill>
                <Shader source={GRAIN_SHADER} uniforms={uniforms} />
            </Fill>
        </Canvas>
    );
};

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 999, // Always on top
    }
});
