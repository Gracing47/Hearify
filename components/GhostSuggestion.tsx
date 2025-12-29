/**
 * 👻 Ghost Suggestion Component — Sprint 1.1
 * 
 * The UI layer for ACE predictions.
 * Shows semi-transparent, pulsing cards in the Orbit view.
 * 
 * Features:
 * - Accept/Reject interaction (Feedback Pivot)
 * - Keyword-based reason display (Trust Pivot)
 * - Smooth enter/exit animations
 * - Shape icons matching node type
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect } from 'react';
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    FadeOut,
    interpolate,
    SlideInRight,
    SlideOutRight,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';

import { ace } from '../services/AmbientConnectionEngine';
import { usePredictionStore, type Prediction } from '../store/predictionStore';
import * as Haptics from '../utils/haptics';

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;
const CARD_HEIGHT = 72;

const SHAPE_ICONS = {
    fact: '◆',      // Diamond
    feeling: '●',   // Circle
    goal: '⬢',     // Hexagon
};

const TYPE_COLORS = {
    fact: '#60A5FA',    // Blue
    feeling: '#F472B6', // Pink
    goal: '#34D399',    // Green
};

// ============================================================================
// ANIMATED WRAPPER
// ============================================================================

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

// ============================================================================
// SINGLE GHOST SUGGESTION
// ============================================================================

interface GhostSuggestionProps {
    prediction: Prediction;
    index: number;
    onAccept: (prediction: Prediction) => void;
    onReject: (prediction: Prediction) => void;
}

const GhostSuggestion: React.FC<GhostSuggestionProps> = ({
    prediction,
    index,
    onAccept,
    onReject
}) => {
    const pulseAnim = useSharedValue(0);
    const glowAnim = useSharedValue(0);

    const nodeType = prediction.node.type;
    const color = TYPE_COLORS[nodeType] || '#60A5FA';

    useEffect(() => {
        // Subtle pulse animation
        pulseAnim.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
                withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
            ),
            -1, // Infinite
            true
        );

        // Glow animation on mount
        glowAnim.value = withDelay(
            index * 100,
            withTiming(1, { duration: 500 })
        );
    }, []);

    const cardStyle = useAnimatedStyle(() => {
        const scale = interpolate(pulseAnim.value, [0, 1], [1, 1.02]);
        const opacity = interpolate(glowAnim.value, [0, 1], [0, 0.95]);

        return {
            transform: [{ scale }],
            opacity
        };
    });

    const glowStyle = useAnimatedStyle(() => {
        const glowOpacity = interpolate(pulseAnim.value, [0, 1], [0.3, 0.6]);
        return { opacity: glowOpacity };
    });

    const handleAccept = useCallback(() => {
        Haptics.impactHeavy();
        onAccept(prediction);
    }, [prediction, onAccept]);

    const handleReject = useCallback(() => {
        Haptics.selection();
        onReject(prediction);
    }, [prediction, onReject]);

    // Truncate content for display
    const displayContent = prediction.node.content.length > 60
        ? prediction.node.content.substring(0, 60) + '...'
        : prediction.node.content;

    return (
        <Animated.View
            entering={SlideInRight.delay(index * 100).duration(300)}
            exiting={SlideOutRight.duration(200)}
            style={[styles.cardContainer, { marginTop: index === 0 ? 0 : 8 }]}
        >
            <AnimatedTouchable
                onPress={handleAccept}
                activeOpacity={0.9}
                style={[styles.card, cardStyle]}
            >
                {/* Background Glow */}
                <AnimatedLinearGradient
                    colors={[`${color}20`, `${color}05`, 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.glowBackground, glowStyle]}
                />

                {/* Card Content */}
                <View style={styles.cardContent}>
                    {/* Shape Icon */}
                    <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
                        <Text style={[styles.shapeIcon, { color }]}>
                            {SHAPE_ICONS[nodeType]}
                        </Text>
                    </View>

                    {/* Text Content */}
                    <View style={styles.textContainer}>
                        <Text numberOfLines={1} style={styles.contentText}>
                            {displayContent}
                        </Text>

                        {/* Trust Pivot: Show Keywords */}
                        {prediction.reason && (
                            <Text style={[styles.reasonText, { color }]}>
                                {prediction.reason}
                            </Text>
                        )}
                    </View>

                    {/* Confidence Badge */}
                    <View style={styles.confidenceBadge}>
                        <Text style={styles.confidenceText}>
                            {Math.round(prediction.confidence * 100)}%
                        </Text>
                    </View>
                </View>

                {/* Border Glow Effect */}
                <Animated.View style={[styles.borderGlow, { borderColor: color }, glowStyle]} />
            </AnimatedTouchable>

            {/* Reject Button - Feedback Pivot */}
            <TouchableOpacity
                style={styles.rejectButton}
                onPress={handleReject}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <Ionicons name="close" size={16} color="#666" />
            </TouchableOpacity>
        </Animated.View>
    );
};

// ============================================================================
// GHOST SUGGESTIONS CONTAINER
// ============================================================================

interface GhostSuggestionsContainerProps {
    onConnectionCreated?: (prediction: Prediction) => void;
}

export const GhostSuggestionsContainer: React.FC<GhostSuggestionsContainerProps> = ({
    onConnectionCreated
}) => {
    const predictions = usePredictionStore(state => state.predictions);
    const isProcessing = usePredictionStore(state => state.isProcessing);

    const handleAccept = useCallback((prediction: Prediction) => {
        // Record feedback
        ace.recordFeedback(prediction.nodeId, 'ACCEPTED');

        // Notify parent (e.g., to create edge in NeuralCanvas)
        onConnectionCreated?.(prediction);

        if (__DEV__) {
            console.log('[Ghost] ✅ Accepted:', prediction.node.content.substring(0, 30));
        }
    }, [onConnectionCreated]);

    const handleReject = useCallback((prediction: Prediction) => {
        // Record feedback - this will also remove from predictions via store
        ace.recordFeedback(prediction.nodeId, 'REJECTED');

        if (__DEV__) {
            console.log('[Ghost] ❌ Rejected:', prediction.node.content.substring(0, 30));
        }
    }, []);

    // Don't render if no predictions
    if (predictions.length === 0 && !isProcessing) {
        return null;
    }

    return (
        <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={styles.container}
        >
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerText}>
                    {isProcessing ? '🔍 Suche...' : '💡 Verbindungen'}
                </Text>
                {predictions.length > 0 && (
                    <Text style={styles.countBadge}>
                        {predictions.length}
                    </Text>
                )}
            </View>

            {/* Predictions List */}
            {predictions.map((prediction, index) => (
                <GhostSuggestion
                    key={prediction.id}
                    prediction={prediction}
                    index={index}
                    onAccept={handleAccept}
                    onReject={handleReject}
                />
            ))}
        </Animated.View>
    );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },

    headerText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#888',
        letterSpacing: 0.3,
    },

    countBadge: {
        marginLeft: 8,
        paddingHorizontal: 8,
        paddingVertical: 2,
        backgroundColor: 'rgba(96, 165, 250, 0.2)',
        borderRadius: 10,
        fontSize: 12,
        fontWeight: '600',
        color: '#60A5FA',
        overflow: 'hidden',
    },

    cardContainer: {
        position: 'relative',
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
    },

    card: {
        flex: 1,
        backgroundColor: 'rgba(30, 30, 40, 0.9)',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },

    glowBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },

    cardContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
    },

    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },

    shapeIcon: {
        fontSize: 20,
        fontWeight: 'bold',
    },

    textContainer: {
        flex: 1,
        marginRight: 12,
    },

    contentText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#E8E8E8',
        lineHeight: 20,
    },

    reasonText: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
        opacity: 0.9,
    },

    confidenceBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 8,
    },

    confidenceText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#888',
    },

    borderGlow: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'transparent',
    },

    rejectButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
});

// ============================================================================
// EXPORTS
// ============================================================================

export default GhostSuggestion;
