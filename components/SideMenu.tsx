/**
 * SideMenu - Elegant Slide-out Navigation Menu
 * Premium glassmorphism drawer for Orbit
 */

import { useContextStore } from '@/store/contextStore';
import { BlurView } from 'expo-blur';
import React from 'react';
import {
    Dimensions,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    SlideInLeft,
    SlideOutLeft,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MENU_WIDTH = SCREEN_WIDTH * 0.75;

interface MenuItem {
    key: 'orbit' | 'horizon' | 'memory';
    label: string;
    icon: string;
}

const menuItems: MenuItem[] = [
    { key: 'orbit', label: 'Orbit', icon: '🏠' },
    { key: 'horizon', label: 'Horizon', icon: '🧠' },
    { key: 'memory', label: 'Memory', icon: '📋' },
];

interface SideMenuProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SideMenu({ isOpen, onClose }: SideMenuProps) {
    const insets = useSafeAreaInsets();
    const activeScreen = useContextStore((state) => state.activeScreen);
    const setActiveScreen = useContextStore((state) => state.setActiveScreen);

    const handleNavigation = (screen: MenuItem['key']) => {
        onClose();
        setTimeout(() => {
            setActiveScreen(screen);
        }, 150);
    };

    if (!isOpen) return null;

    return (
        <Modal
            visible={isOpen}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                {/* Backdrop */}
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(200)}
                    style={StyleSheet.absoluteFill}
                >
                    <Pressable style={styles.backdrop} onPress={onClose} />
                </Animated.View>

                {/* Menu Panel */}
                <Animated.View
                    entering={SlideInLeft.duration(400).springify().damping(25).stiffness(80)}
                    exiting={SlideOutLeft.duration(300)}
                    style={[styles.menuPanel, { paddingTop: insets.top + 20 }]}
                >
                    {Platform.OS === 'ios' && (
                        <BlurView
                            intensity={80}
                            tint="dark"
                            style={StyleSheet.absoluteFill}
                        />
                    )}

                    {/* Header */}
                    <View style={styles.menuHeader}>
                        <Text style={styles.menuTitle}>Orbit</Text>
                        <Text style={styles.menuSubtitle}>Neural Companion</Text>
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Menu Items */}
                    <View style={styles.menuItems}>
                        {menuItems.map((item) => {
                            const isActive = activeScreen === item.key;
                            return (
                                <TouchableOpacity
                                    key={item.key}
                                    style={[styles.menuItem, isActive && styles.menuItemActive]}
                                    onPress={() => handleNavigation(item.key)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.menuItemIcon}>{item.icon}</Text>
                                    <Text style={[styles.menuItemLabel, isActive && styles.menuItemLabelActive]}>
                                        {item.label}
                                    </Text>
                                    {isActive && <View style={styles.activeIndicator} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Footer */}
                    <View style={[styles.menuFooter, { paddingBottom: insets.bottom + 20 }]}>
                        <View style={styles.divider} />
                        <TouchableOpacity
                            style={styles.settingsItem}
                            activeOpacity={0.7}
                            onPress={async () => {
                                const { NotificationService } = require('@/services/NotificationService');
                                await NotificationService.sendLocalNotification(
                                    '🧠 Neural Nudge',
                                    'This is a test from your digital consciousness.'
                                );
                            }}
                        >
                            <Text style={styles.menuItemIcon}>🔔</Text>
                            <Text style={styles.settingsLabel}>Test Notification</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.settingsItem} activeOpacity={0.7}>
                            <Text style={styles.menuItemIcon}>⚙️</Text>
                            <Text style={styles.settingsLabel}>Einstellungen</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

// Burger Icon Component for Header
export function BurgerMenuButton({ onPress }: { onPress: () => void }) {
    return (
        <TouchableOpacity style={styles.burgerButton} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.burgerLine} />
            <View style={[styles.burgerLine, styles.burgerLineShort]} />
            <View style={styles.burgerLine} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    menuPanel: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: MENU_WIDTH,
        backgroundColor: Platform.OS === 'ios' ? 'rgba(15, 15, 15, 0.95)' : '#0f0f0f',
        borderRightWidth: 1,
        borderRightColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
    },
    menuHeader: {
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
    menuTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: -0.5,
    },
    menuSubtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        marginHorizontal: 24,
    },
    menuItems: {
        flex: 1,
        paddingTop: 16,
        paddingHorizontal: 12,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginBottom: 4,
    },
    menuItemActive: {
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
    },
    menuItemIcon: {
        fontSize: 22,
        marginRight: 16,
    },
    menuItemLabel: {
        fontSize: 17,
        fontWeight: '600',
        color: '#888',
        flex: 1,
    },
    menuItemLabelActive: {
        color: '#fff',
    },
    activeIndicator: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#6366f1',
    },
    menuFooter: {
        paddingHorizontal: 12,
    },
    settingsItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        marginTop: 16,
    },
    settingsLabel: {
        fontSize: 15,
        color: '#666',
        fontWeight: '500',
    },
    // Burger Button
    burgerButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 5,
    },
    burgerLine: {
        width: 22,
        height: 2,
        backgroundColor: '#fff',
        borderRadius: 1,
    },
    burgerLineShort: {
        width: 16,
        alignSelf: 'flex-start',
        marginLeft: 11,
    },
});
