/**
 * SideMenu - Elegant Slide-out Navigation Menu
 * Premium glassmorphism drawer for Orbit
 */

import { getAllConversations, type Conversation } from '@/services/ConversationService';
import { useContextStore } from '@/store/contextStore';
import { useConversationStore } from '@/store/conversation';
import * as Haptics from '@/utils/haptics';
import { BlurView } from 'expo-blur';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    SlideInLeft,
    SlideOutLeft,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MENU_WIDTH = SCREEN_WIDTH * 0.8;

interface MenuItem {
    key: 'orbit' | 'horizon' | 'memory';
    label: string;
    icon: string;
}

const menuItems: MenuItem[] = [
    { key: 'orbit', label: 'Orbit', icon: '🏠' },
    { key: 'horizon', label: 'Horizon', icon: '🧠' },
    { key: 'memory', label: 'Chronicle', icon: '📋' },
];

interface SideMenuProps {
    isOpen: boolean;
    onClose: () => void;
    onResumeSession?: (conversationId: string) => void;
}

export function SideMenu({ isOpen, onClose, onResumeSession }: SideMenuProps) {
    const insets = useSafeAreaInsets();
    const activeScreen = useContextStore((state) => state.activeScreen);
    const setActiveScreen = useContextStore((state) => state.setActiveScreen);
    const currentConversationId = useConversationStore((state) => state.currentConversationId);
    
    // Sessions state
    const [recentSessions, setRecentSessions] = useState<Conversation[]>([]);
    const [sessionsExpanded, setSessionsExpanded] = useState(true);

    // Load recent sessions when menu opens
    useEffect(() => {
        if (isOpen) {
            loadRecentSessions();
        }
    }, [isOpen]);

    const loadRecentSessions = async () => {
        try {
            const sessions = await getAllConversations(5);
            setRecentSessions(sessions);
        } catch (error) {
            console.error('[SideMenu] Failed to load sessions:', error);
        }
    };

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

                    {/* 🕰️ Recent Sessions Section */}
                    <View style={styles.sessionsSection}>
                        <TouchableOpacity 
                            style={styles.sessionsSectionHeader}
                            onPress={() => {
                                Haptics.light();
                                setSessionsExpanded(!sessionsExpanded);
                            }}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.sessionsSectionTitle}>Recent Sessions</Text>
                            <Text style={styles.sessionsSectionToggle}>
                                {sessionsExpanded ? '▼' : '▶'}
                            </Text>
                        </TouchableOpacity>
                        
                        {sessionsExpanded && (
                            <ScrollView 
                                style={styles.sessionsScrollView} 
                                showsVerticalScrollIndicator={false}
                            >
                                {recentSessions.length === 0 ? (
                                    <Text style={styles.noSessionsText}>
                                        No conversations yet
                                    </Text>
                                ) : (
                                    recentSessions.map((session) => {
                                        const isCurrentSession = session.id === currentConversationId;
                                        const sessionDate = new Date(session.created_at);
                                        const timeAgo = getRelativeTime(sessionDate);
                                        
                                        return (
                                            <TouchableOpacity
                                                key={session.id}
                                                style={[
                                                    styles.sessionItem,
                                                    isCurrentSession && styles.sessionItemActive
                                                ]}
                                                onPress={() => {
                                                    Haptics.selection();
                                                    onClose();
                                                    if (onResumeSession) {
                                                        setTimeout(() => {
                                                            setActiveScreen('orbit');
                                                            onResumeSession(session.id);
                                                        }, 200);
                                                    }
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <View style={styles.sessionItemContent}>
                                                    <Text 
                                                        style={[
                                                            styles.sessionTitle,
                                                            isCurrentSession && styles.sessionTitleActive
                                                        ]} 
                                                        numberOfLines={1}
                                                    >
                                                        {session.title || 'Untitled Session'}
                                                    </Text>
                                                    <Text style={styles.sessionMeta}>
                                                        {timeAgo} • {session.message_count || 0} messages
                                                    </Text>
                                                </View>
                                                {isCurrentSession && (
                                                    <View style={styles.currentSessionBadge}>
                                                        <Text style={styles.currentSessionBadgeText}>●</Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })
                                )}
                            </ScrollView>
                        )}
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

// Helper function for relative time
function getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
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
    
    // 🕰️ Sessions Section
    sessionsSection: {
        marginTop: 24,
        paddingHorizontal: 16,
        flex: 1,
    },
    sessionsSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        marginBottom: 8,
    },
    sessionsSectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#666',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    sessionsSectionToggle: {
        fontSize: 10,
        color: '#666',
    },
    sessionsScrollView: {
        maxHeight: 200,
    },
    noSessionsText: {
        fontSize: 13,
        color: '#555',
        fontStyle: 'italic',
        paddingVertical: 12,
    },
    sessionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        marginBottom: 4,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    sessionItemActive: {
        backgroundColor: 'rgba(99, 102, 241, 0.12)',
        borderColor: 'rgba(99, 102, 241, 0.25)',
    },
    sessionItemContent: {
        flex: 1,
    },
    sessionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ccc',
        marginBottom: 2,
    },
    sessionTitleActive: {
        color: '#fff',
    },
    sessionMeta: {
        fontSize: 11,
        color: '#666',
    },
    currentSessionBadge: {
        marginLeft: 8,
    },
    currentSessionBadgeText: {
        fontSize: 8,
        color: '#6366f1',
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
