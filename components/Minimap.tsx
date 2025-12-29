/**
 * 🗺️ MINIMAP — Neural Horizon v2.0
 * 
 * Recovery navigation tool that auto-appears when user is "lost".
 * Shows cluster positions only (no node detail) for clarity.
 * 
 * Contract (MINIMAP_CONTRACT):
 * - Auto-appear: zoom < 0.55 OR 2 rapid pans in 3s without selection
 * - Manual toggle: three-finger tap (sticky)
 * - Content: cluster dots, viewport frame, optional compass
 */

import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
    interpolate,
    SharedValue,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { MINIMAP_CONTRACT } from '../constants/contracts';
import { NEURAL_TOKENS } from '../constants/neuralTokens';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Minimap dimensions from contract
const MINIMAP_WIDTH = MINIMAP_CONTRACT.style.size.width;
const MINIMAP_HEIGHT = MINIMAP_CONTRACT.style.size.height;

// World bounds (approximate, should match NeuralCanvas)
const WORLD_BOUNDS = {
    minX: -500,
    maxX: 500,
    minY: -500,
    maxY: 500,
};

interface MinimapProps {
    // Camera state from NeuralCanvas
    translateX: SharedValue<number>;
    translateY: SharedValue<number>;
    scale: SharedValue<number>;

    // Cluster data
    clusters: Array<{
        id: number;
        centerX: number;
        centerY: number;
        color?: string;
    }>;

    // Manual visibility control
    visible?: boolean;
    onVisibilityChange?: (visible: boolean) => void;
}

export const Minimap = ({
    translateX,
    translateY,
    scale,
    clusters,
    visible: externalVisible,
    onVisibilityChange,
}: MinimapProps) => {
    const [internalVisible, setInternalVisible] = useState(false);
    const [isSticky, setIsSticky] = useState(false);
    const opacity = useSharedValue(0);
    const panTracker = React.useRef<number[]>([]);

    const isVisible = externalVisible ?? internalVisible;

    // Auto-appear logic
    useEffect(() => {
        const checkAutoAppear = () => {
            if (isSticky) return; // Don't auto-hide if sticky

            const currentScale = scale.value;
            const shouldAppear = currentScale < MINIMAP_CONTRACT.autoAppear.conditions.zoomThreshold;

            if (shouldAppear && !isVisible) {
                show(false);
            } else if (!shouldAppear && isVisible && !isSticky) {
                hide();
            }
        };

        // Check periodically
        const interval = setInterval(checkAutoAppear, 500);
        return () => clearInterval(interval);
    }, [scale, isVisible, isSticky]);

    // Track rapid pans for "lost" detection
    const trackPan = useCallback(() => {
        const now = Date.now();
        panTracker.current.push(now);

        // Keep only pans within the time window
        const windowStart = now - MINIMAP_CONTRACT.autoAppear.conditions.rapidPans.withinMs;
        panTracker.current = panTracker.current.filter(t => t > windowStart);

        // Check if user is "lost"
        if (panTracker.current.length >= MINIMAP_CONTRACT.autoAppear.conditions.rapidPans.count && !isVisible) {
            show(false);
        }
    }, [isVisible]);

    // Show minimap
    const show = useCallback((sticky = false) => {
        setInternalVisible(true);
        setIsSticky(sticky);
        onVisibilityChange?.(true);
        opacity.value = withSpring(1, { damping: 20 });
    }, [onVisibilityChange]);

    // Hide minimap
    const hide = useCallback(() => {
        opacity.value = withTiming(0, { duration: 200 });
        setTimeout(() => {
            setInternalVisible(false);
            setIsSticky(false);
            onVisibilityChange?.(false);
        }, 200);
    }, [onVisibilityChange]);

    // Toggle (for three-finger tap)
    const toggle = useCallback(() => {
        if (isVisible) {
            hide();
        } else {
            show(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    }, [isVisible, show, hide]);

    // Transform world coordinates to minimap coordinates
    const worldToMinimap = useCallback((worldX: number, worldY: number) => {
        const x = ((worldX - WORLD_BOUNDS.minX) / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX)) * MINIMAP_WIDTH;
        const y = ((worldY - WORLD_BOUNDS.minY) / (WORLD_BOUNDS.maxY - WORLD_BOUNDS.minY)) * MINIMAP_HEIGHT;
        return { x, y };
    }, []);

    // Animated container style
    const containerStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: interpolate(opacity.value, [0, 1], [0.9, 1]) }],
    }));

    // Animated viewport frame (shows current camera view on minimap)
    const viewportStyle = useAnimatedStyle(() => {
        const viewWidth = (SCREEN_WIDTH / scale.value) / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) * MINIMAP_WIDTH;
        const viewHeight = (SCREEN_HEIGHT / scale.value) / (WORLD_BOUNDS.maxY - WORLD_BOUNDS.minY) * MINIMAP_HEIGHT;

        const centerX = -translateX.value;
        const centerY = -translateY.value;
        const { x: minimapX, y: minimapY } = worldToMinimap(centerX, centerY);

        return {
            width: Math.min(viewWidth, MINIMAP_WIDTH),
            height: Math.min(viewHeight, MINIMAP_HEIGHT),
            left: Math.max(0, Math.min(minimapX - viewWidth / 2, MINIMAP_WIDTH - viewWidth)),
            top: Math.max(0, Math.min(minimapY - viewHeight / 2, MINIMAP_HEIGHT - viewHeight)),
        };
    });

    if (!isVisible && opacity.value === 0) return null;

    return (
        <Animated.View style={[styles.container, containerStyle]}>
            <BlurView intensity={MINIMAP_CONTRACT.style.blur} tint="dark" style={styles.blurContainer}>
                <View style={styles.minimapContent}>
                    {/* Cluster dots */}
                    <Canvas style={styles.canvas}>
                        <Group>
                            {clusters.map((cluster, i) => {
                                const { x, y } = worldToMinimap(cluster.centerX, cluster.centerY);
                                return (
                                    <Circle
                                        key={cluster.id}
                                        cx={x}
                                        cy={y}
                                        r={6}
                                        color={cluster.color || NEURAL_TOKENS.colors.edge.cluster}
                                        opacity={0.8}
                                    />
                                );
                            })}
                        </Group>
                    </Canvas>

                    {/* Viewport frame */}
                    <Animated.View style={[styles.viewportFrame, viewportStyle]} />
                </View>

                {/* Close button (only when sticky) */}
                {isSticky && (
                    <Pressable style={styles.closeButton} onPress={hide}>
                        <View style={styles.closeIcon} />
                    </Pressable>
                )}
            </BlurView>
        </Animated.View>
    );
};

// Expose toggle for parent integration
Minimap.displayName = 'Minimap';

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 100,
        right: 16,
        zIndex: 100,
    },
    blurContainer: {
        width: MINIMAP_WIDTH,
        height: MINIMAP_HEIGHT,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: MINIMAP_CONTRACT.style.border,
        backgroundColor: MINIMAP_CONTRACT.style.background,
    },
    minimapContent: {
        flex: 1,
        position: 'relative',
    },
    canvas: {
        flex: 1,
    },
    viewportFrame: {
        position: 'absolute',
        borderWidth: 2,
        borderColor: 'rgba(99, 102, 241, 0.8)',
        borderRadius: 4,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
    },
    closeButton: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeIcon: {
        width: 10,
        height: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        borderRadius: 1,
    },
});
