import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Extrapolate,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { Snippet } from '../db/schema';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FlashcardModalProps {
    visible: boolean;
    node: Snippet | null;
    onClose: () => void;
}

export const FlashcardModal = ({ visible, node, onClose }: FlashcardModalProps) => {
    const [isFlipped, setIsFlipped] = useState(false);

    // Animation Values
    const rotateAnim = useSharedValue(0); // 0 to 180
    const opacityAnim = useSharedValue(0);
    const scaleAnim = useSharedValue(0.8);

    useEffect(() => {
        if (visible) {
            setIsFlipped(false);
            rotateAnim.value = 0;
            opacityAnim.value = withTiming(1, { duration: 300 });
            scaleAnim.value = withSpring(1, { damping: 15 });
        } else {
            opacityAnim.value = withTiming(0, { duration: 200 });
            scaleAnim.value = withTiming(0.8, { duration: 200 });
        }
    }, [visible]);

    const handleFlip = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const target = isFlipped ? 0 : 180;

        rotateAnim.value = withSpring(target, { damping: 12, stiffness: 90 }, (finished) => {
            if (finished) runOnJS(setIsFlipped)(!isFlipped);
        });
    };

    const handleRate = (rating: 'hard' | 'good' | 'easy') => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Here we would save the result (Spaced Repetition)
        onClose();
    };

    // Front Card Style
    const frontAnimatedStyle = useAnimatedStyle(() => {
        const spin = rotateAnim.value;
        return {
            transform: [
                { perspective: 1000 },
                { rotateY: `${spin}deg` }
            ],
            opacity: interpolate(spin, [85, 95], [1, 0], Extrapolate.CLAMP),
            zIndex: spin < 90 ? 1 : 0,
            // Backface visibility fix approach: Hide when rotated 
            // implementation via opacity is smoother for RN
        };
    });

    // Back Card Style
    const backAnimatedStyle = useAnimatedStyle(() => {
        const spin = rotateAnim.value;
        return {
            transform: [
                { perspective: 1000 },
                { rotateY: `${spin - 180}deg` } // Start rotated
            ],
            opacity: interpolate(spin, [85, 95], [0, 1], Extrapolate.CLAMP),
            zIndex: spin > 90 ? 1 : 0,
        };
    });

    const containerStyle = useAnimatedStyle(() => ({
        opacity: opacityAnim.value,
        transform: [{ scale: scaleAnim.value }]
    }));

    if (!visible || !node) return null;

    // JIT Content Generation (Mock)
    let frontContent = node.topic || "Unknown Topic";
    let backContent = node.content;

    // Try parsing utility_data if present (Future proof)
    try {
        if (node.utility_data && node.utility_data !== '{}') {
            const data = JSON.parse(node.utility_data);
            if (data.flashcard) {
                frontContent = data.flashcard.front || frontContent;
                backContent = data.flashcard.back || backContent;
            }
        }
    } catch (e) { /* ignore */ }

    // Fallback if topic is generic
    if (frontContent === 'misc' || frontContent === 'Unknown Topic') {
        frontContent = "Did you know?";
    }

    return (
        <View style={styles.overlay} pointerEvents="box-none">
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill}>
                <Pressable style={styles.backdrop} onPress={onClose} />
            </BlurView>

            <Animated.View style={[styles.cardContainer, containerStyle]}>

                {/* FRONT OF CARD */}
                <Animated.View style={[styles.cardFace, styles.cardFront, frontAnimatedStyle]}>
                    <BlurView intensity={80} tint="dark" style={styles.cardBlur}>
                        <View style={styles.header}>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>FLASHCARD</Text>
                            </View>
                        </View>
                        <View style={styles.content}>
                            <Text style={styles.questionLabel}>TOPIC</Text>
                            <Text style={styles.questionText}>{frontContent}</Text>
                        </View>
                        <Pressable style={styles.flipButton} onPress={handleFlip}>
                            <Text style={styles.flipButtonText}>Reveal Answer</Text>
                        </Pressable>
                    </BlurView>
                </Animated.View>

                {/* BACK OF CARD */}
                <Animated.View style={[styles.cardFace, styles.cardBack, backAnimatedStyle]}>
                    <BlurView intensity={90} tint="systemThickMaterialDark" style={styles.cardBlur}>
                        <View style={styles.header}>
                            <View style={[styles.badge, styles.badgeAnswer]}>
                                <Text style={styles.badgeText}>ANSWER</Text>
                            </View>
                        </View>
                        <View style={styles.content}>
                            <Text style={styles.answerText}>{backContent}</Text>
                        </View>

                        <View style={styles.ratingRow}>
                            <Pressable style={[styles.rateBtn, styles.rateHard]} onPress={() => handleRate('hard')}>
                                <Text style={styles.rateText}>Hard</Text>
                            </Pressable>
                            <Pressable style={[styles.rateBtn, styles.rateGood]} onPress={() => handleRate('good')}>
                                <Text style={styles.rateText}>Good</Text>
                            </Pressable>
                            <Pressable style={[styles.rateBtn, styles.rateEasy]} onPress={() => handleRate('easy')}>
                                <Text style={styles.rateText}>Easy</Text>
                            </Pressable>
                        </View>
                    </BlurView>
                </Animated.View>

            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    cardContainer: {
        width: SCREEN_WIDTH * 0.85,
        height: SCREEN_WIDTH * 1.1, // Aspect ratio like a playing card
        maxWidth: 400,
        maxHeight: 500,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardFace: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 24,
        overflow: 'hidden',
        backfaceVisibility: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    cardFront: {
        backgroundColor: 'rgba(30, 30, 40, 0.9)',
    },
    cardBack: {
        backgroundColor: 'rgba(20, 20, 25, 0.95)',
    },
    cardBlur: {
        flex: 1,
        padding: 24,
        justifyContent: 'space-between',
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
    },
    badge: {
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.4)',
    },
    badgeAnswer: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: 'rgba(16, 185, 129, 0.4)',
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    questionLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 2,
        marginBottom: 16,
    },
    questionText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
        lineHeight: 32,
    },
    answerText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '400',
        lineHeight: 28,
        textAlign: 'center',
    },
    flipButton: {
        backgroundColor: '#fff',
        paddingVertical: 16,
        borderRadius: 30,
        alignItems: 'center',
    },
    flipButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '700',
    },
    ratingRow: {
        flexDirection: 'row',
        gap: 12,
    },
    rateBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
    },
    rateHard: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    rateGood: {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    rateEasy: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    rateText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    }
});
