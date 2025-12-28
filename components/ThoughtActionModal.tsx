/**
 * 💭 THOUGHT ACTION MODAL — STATE OF THE ART 2025
 * Premium glassmorphic interface with animated gradient cards,
 * fluid micro-interactions, and cinematic visual hierarchy.
 * 
 * "No thought shall ever be forgotten"
 */

import { Snippet } from '@/db/schema';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import {
    Dimensions,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View
} from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    FadeInDown,
    FadeOut,
    interpolate,
    SlideInDown,
    SlideOutDown,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Premium color palette
const COLORS = {
    chronicle: {
        gradient: ['#667eea', '#764ba2'] as [string, string],
        glow: 'rgba(102, 126, 234, 0.4)',
    },
    reflect: {
        gradient: ['#f093fb', '#f5576c'] as [string, string],
        glow: 'rgba(240, 147, 251, 0.4)',
    },
    connect: {
        gradient: ['#4facfe', '#00f2fe'] as [string, string],
        glow: 'rgba(79, 172, 254, 0.4)',
    },
    star: {
        gradient: ['#fa709a', '#fee140'] as [string, string],
        glow: 'rgba(254, 225, 64, 0.4)',
    },
};

// Type accent configurations
const TYPE_CONFIG: Record<string, { gradient: [string, string]; icon: string; label: string }> = {
    fact: { gradient: ['#22d3ee', '#0891b2'], icon: '📊', label: 'Fact' },
    feeling: { gradient: ['#e879f9', '#c026d3'], icon: '💜', label: 'Feeling' },
    goal: { gradient: ['#fde047', '#f59e0b'], icon: '🎯', label: 'Goal' },
};

interface ThoughtActionModalProps {
    visible: boolean;
    snippet: Snippet | null;
    onClose: () => void;
    onChronicle: (snippet: Snippet) => void;
    onConnect: (snippet: Snippet) => void;
    onReflect: (snippet: Snippet) => void;
    onStar: (snippet: Snippet) => void;
}

// Animated Action Card Component
const ActionCard = ({
    icon,
    label,
    sublabel,
    colors,
    glowColor,
    delay,
    onPress,
    size = 'normal'
}: {
    icon: string;
    label: string;
    sublabel: string;
    colors: [string, string];
    glowColor: string;
    delay: number;
    onPress: () => void;
    size?: 'normal' | 'large';
}) => {
    const scaleAnim = useSharedValue(1);
    const glowAnim = useSharedValue(0);

    useEffect(() => {
        // Subtle glow pulse animation
        glowAnim.value = withDelay(
            delay + 300,
            withRepeat(
                withSequence(
                    withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
                    withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                true
            )
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scaleAnim.value }],
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: interpolate(glowAnim.value, [0, 1], [0.3, 0.7]),
        transform: [{ scale: interpolate(glowAnim.value, [0, 1], [1, 1.1]) }],
    }));

    const handlePressIn = () => {
        scaleAnim.value = withSpring(0.95, { damping: 15, stiffness: 400 });
    };

    const handlePressOut = () => {
        scaleAnim.value = withSpring(1, { damping: 15, stiffness: 400 });
    };

    const cardWidth = size === 'large' ? SCREEN_WIDTH - 48 : (SCREEN_WIDTH - 60) / 2;

    return (
        <Animated.View
            entering={FadeInDown.delay(delay).springify().damping(18)}
            style={{ width: cardWidth }}
        >
            <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onPress();
                }}
            >
                <Animated.View style={[styles.actionCard, animatedStyle]}>
                    {/* Glow Effect */}
                    <Animated.View style={[styles.cardGlow, glowStyle, { backgroundColor: glowColor }]} />

                    {/* Glass Background */}
                    <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill}>
                        <View style={styles.cardGlassOverlay} />
                    </BlurView>

                    {/* Gradient Border */}
                    <LinearGradient
                        colors={[...colors, 'transparent']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.cardBorderGradient}
                    />

                    {/* Content */}
                    <View style={styles.cardContent}>
                        {/* Icon with gradient background */}
                        <View style={styles.iconContainer}>
                            <LinearGradient
                                colors={colors}
                                style={styles.iconGradient}
                            >
                                <Text style={styles.actionIcon}>{icon}</Text>
                            </LinearGradient>
                        </View>

                        <Text style={styles.actionLabel}>{label}</Text>
                        <Text style={styles.actionSublabel}>{sublabel}</Text>
                    </View>
                </Animated.View>
            </Pressable>
        </Animated.View>
    );
};

export const ThoughtActionModal = ({
    visible,
    snippet,
    onClose,
    onChronicle,
    onConnect,
    onReflect,
    onStar
}: ThoughtActionModalProps) => {
    const backdropOpacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            backdropOpacity.value = withTiming(1, { duration: 300 });
        } else {
            backdropOpacity.value = withTiming(0, { duration: 200 });
        }
    }, [visible]);

    if (!snippet) return null;

    const typeConfig = TYPE_CONFIG[snippet.type] || TYPE_CONFIG.fact;

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const handleBackdropPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            {/* Cinematic Backdrop */}
            <Pressable style={styles.backdrop} onPress={handleBackdropPress}>
                <Animated.View
                    entering={FadeIn.duration(300)}
                    exiting={FadeOut.duration(200)}
                    style={StyleSheet.absoluteFill}
                >
                    <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.6)']}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>
            </Pressable>

            {/* Modal Panel */}
            <View style={styles.modalContainer} pointerEvents="box-none">
                <Animated.View
                    entering={SlideInDown.springify().damping(20).stiffness(90)}
                    exiting={SlideOutDown.duration(300)}
                    style={styles.panel}
                >
                    {/* Panel Glass */}
                    <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill}>
                        <LinearGradient
                            colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.02)']}
                            style={StyleSheet.absoluteFill}
                        />
                    </BlurView>

                    {/* Top Accent Line */}
                    <LinearGradient
                        colors={typeConfig.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.accentLine}
                    />

                    {/* Handle */}
                    <View style={styles.handleContainer}>
                        <View style={styles.handle} />
                    </View>

                    {/* Thought Preview */}
                    <Animated.View
                        entering={FadeInDown.delay(100).springify()}
                        style={styles.thoughtPreview}
                    >
                        {/* Type Badge */}
                        <View style={styles.header}>
                            <LinearGradient
                                colors={typeConfig.gradient}
                                style={styles.typeBadge}
                            >
                                <Text style={styles.typeIcon}>{typeConfig.icon}</Text>
                                <Text style={styles.typeLabel}>{typeConfig.label}</Text>
                            </LinearGradient>
                            <Text style={styles.dateText}>{formatDate(snippet.timestamp)}</Text>
                        </View>

                        {/* Thought Content */}
                        <Text style={styles.thoughtText} numberOfLines={3}>
                            {snippet.content}
                        </Text>

                        {/* Topic */}
                        {snippet.topic && snippet.topic !== 'misc' && (
                            <View style={styles.topicChip}>
                                <Text style={styles.topicText}>#{snippet.topic}</Text>
                            </View>
                        )}
                    </Animated.View>

                    {/* Divider with glow */}
                    <Animated.View
                        entering={FadeIn.delay(200)}
                        style={styles.dividerContainer}
                    >
                        <LinearGradient
                            colors={['transparent', 'rgba(99, 102, 241, 0.3)', 'transparent']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.divider}
                        />
                    </Animated.View>

                    {/* Action Grid - 2x2 */}
                    <View style={styles.actionGrid}>
                        <View style={styles.actionRow}>
                            <ActionCard
                                icon="📖"
                                label="Chronicle"
                                sublabel="Save to Memory"
                                colors={COLORS.chronicle.gradient}
                                glowColor={COLORS.chronicle.glow}
                                delay={150}
                                onPress={() => onChronicle(snippet)}
                            />
                            <ActionCard
                                icon="💭"
                                label="Reflect"
                                sublabel="Discuss with AI"
                                colors={COLORS.reflect.gradient}
                                glowColor={COLORS.reflect.glow}
                                delay={200}
                                onPress={() => onReflect(snippet)}
                            />
                        </View>
                        <View style={styles.actionRow}>
                            <ActionCard
                                icon="🔗"
                                label="Connect"
                                sublabel="Link thoughts"
                                colors={COLORS.connect.gradient}
                                glowColor={COLORS.connect.glow}
                                delay={250}
                                onPress={() => onConnect(snippet)}
                            />
                            <ActionCard
                                icon="⭐"
                                label="Star"
                                sublabel="Mark important"
                                colors={COLORS.star.gradient}
                                glowColor={COLORS.star.glow}
                                delay={300}
                                onPress={() => onStar(snippet)}
                            />
                        </View>
                    </View>

                    {/* Bottom Safe Area */}
                    <View style={styles.bottomSafe} />
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    panel: {
        backgroundColor: 'rgba(15, 15, 25, 0.95)',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderBottomWidth: 0,
    },
    accentLine: {
        height: 3,
        width: '100%',
    },
    handleContainer: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 4,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
    thoughtPreview: {
        paddingHorizontal: 24,
        paddingTop: 8,
        paddingBottom: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    typeIcon: {
        fontSize: 14,
    },
    typeLabel: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    dateText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 13,
    },
    thoughtText: {
        color: '#fff',
        fontSize: 18,
        lineHeight: 28,
        fontWeight: '500',
        letterSpacing: 0.2,
    },
    topicChip: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginTop: 12,
    },
    topicText: {
        color: '#a5b4fc',
        fontSize: 13,
        fontWeight: '600',
    },
    dividerContainer: {
        paddingHorizontal: 24,
    },
    divider: {
        height: 1,
        width: '100%',
    },
    actionGrid: {
        padding: 16,
        paddingTop: 20,
        gap: 12,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    actionCard: {
        height: 130,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    cardGlow: {
        position: 'absolute',
        top: -20,
        left: '10%',
        width: '80%',
        height: 40,
        borderRadius: 50,
    },
    cardGlassOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(30, 30, 45, 0.7)',
    },
    cardBorderGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
    },
    cardContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    iconContainer: {
        marginBottom: 10,
    },
    iconGradient: {
        width: 52,
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    actionIcon: {
        fontSize: 26,
    },
    actionLabel: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.3,
        marginBottom: 2,
    },
    actionSublabel: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 12,
        fontWeight: '500',
    },
    bottomSafe: {
        height: 34,
    },
});
