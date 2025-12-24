/**
 * 🌟 SEMANTIC NODE 2.0 — AWARD-WINNING EDITION
 * ─────────────────────────────────────────────
 * Features:
 * - Glowing Energy Orbs with dynamic color
 * - Pulsing animation based on importance
 * - Focus ring on selection
 * - Type-based neon colors
 */

import {
    Blur,
    Circle,
    Group,
    Shadow,
    Text as SkiaText
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
    z: SharedValue<number>;
    type: 'fact' | 'feeling' | 'goal';
    content: string;
    importance: SharedValue<number>;
    time: SharedValue<number>;
    zoomLevel: SharedValue<number>;
    isFocused: boolean;
    isFiltered: boolean;
    font: any;
}

// 🎨 Type-based neon colors
const TYPE_COLORS = {
    fact: { core: '#22d3ee', glow: 'rgba(34, 211, 238, 0.6)' },      // Cyan
    feeling: { core: '#e879f9', glow: 'rgba(232, 121, 249, 0.6)' },  // Magenta
    goal: { core: '#fde047', glow: 'rgba(253, 224, 71, 0.6)' },      // Gold
};

export const SemanticNode = ({
    x, y, z, type, content, importance, time, zoomLevel, isFocused, isFiltered, font
}: SemanticNodeProps) => {
    const colors = TYPE_COLORS[type] || TYPE_COLORS.fact;

    // Truncate content for label
    const label = content.length > 25 ? content.substring(0, 22) + '...' : content;

    // 🔥 Distance-based scaling and blur (DoF)
    const distanceFactor = useDerivedValue(() => {
        // Perspective factor: nodes at -500 are smaller
        return 1 / (1 + Math.abs(z.value) / 1000);
    });

    const distanceBlur = useDerivedValue(() => {
        return Math.min(Math.abs(z.value) / 150, 10);
    });

    // Dynamic radius based on importance (1.0 - 2.0 range)
    const baseRadius = useDerivedValue(() => {
        const imp = importance.value;
        const importanceScale = 8 + (imp - 1) * 8; // 8 to 16px based on importance
        return importanceScale * distanceFactor.value;
    });

    // Breathing pulse
    const pulseRadius = useDerivedValue(() => {
        const imp = importance.value;
        const pulse = 1 + Math.sin(time.value * 2 + (imp * 10)) * 0.08;
        return baseRadius.value * pulse;
    });

    const nodeOpacity = useDerivedValue(() => {
        const base = isFiltered ? 0.05 : 0.8;
        const focus = (isFocused) ? 1.0 : (base * distanceFactor.value);
        return focus;
    });

    const focusRingOpacity = useDerivedValue(() => {
        if (!isFocused) return 0;
        return 0.5 + Math.sin(time.value * 5) * 0.5;
    });

    // 🔥 Text Visibility: Only show when zoom > 1.8 and node is near
    const textOpacity = useDerivedValue(() => {
        const zoomFade = interpolate(zoomLevel.value, [1.5, 2.5], [0, 1], Extrapolate.CLAMP);
        const depthFade = interpolate(Math.abs(z.value), [0, 400], [1, 0], Extrapolate.CLAMP);
        return zoomFade * depthFade;
    });

    const textBlur = useDerivedValue(() => {
        return interpolate(zoomLevel.value, [1.5, 2.5], [10, 0], Extrapolate.CLAMP);
    });

    return (
        <Group opacity={nodeOpacity}>
            {/* Outer Glow */}
            <Circle cx={x} cy={y} r={useDerivedValue(() => pulseRadius.value * 2.2)} color={colors.glow}>
                <Blur blur={useDerivedValue(() => 12 + distanceBlur.value)} />
            </Circle>

            {/* Core */}
            <Circle cx={x} cy={y} r={pulseRadius} color={colors.core}>
                <Shadow dx={0} dy={0} blur={useDerivedValue(() => 10 + distanceBlur.value)} color={colors.core} />
                <Blur blur={distanceBlur} />
            </Circle>

            {/* Inner Highlight */}
            <Circle
                cx={useDerivedValue(() => x.value - pulseRadius.value * 0.3)}
                cy={useDerivedValue(() => y.value - pulseRadius.value * 0.3)}
                r={useDerivedValue(() => pulseRadius.value * 0.3)}
                color="rgba(255, 255, 255, 0.5)"
            >
                <Blur blur={2} />
            </Circle>

            {/* Focus Ring */}
            <Group opacity={focusRingOpacity}>
                <Circle
                    cx={x}
                    cy={y}
                    r={useDerivedValue(() => pulseRadius.value + 6)}
                    style="stroke"
                    strokeWidth={2}
                    color="white"
                />
            </Group>

            {/* 🔥 Progressive Text Reveal */}
            <Group opacity={textOpacity}>
                <SkiaText
                    x={useDerivedValue(() => x.value + pulseRadius.value + 8)}
                    y={useDerivedValue(() => y.value + 4)}
                    text={label}
                    font={font}
                    color="white"
                >
                    <Blur blur={textBlur} />
                </SkiaText>
            </Group>
        </Group>
    );
};
