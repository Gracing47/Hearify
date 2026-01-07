/**
 * Notification Service - Neural Nudge System
 * 
 * Manages local and push notifications for the Hearify App.
 * Used for:
 * - Reflection reminders
 * - Daily Delta summaries
 * - Interactive memory confirmations
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Lazy-load modules to prevent crashes if native code is missing (dev client not rebuilt)
let Notifications: any;
let Device: any;

try {
    Notifications = require('expo-notifications');
    Device = require('expo-device');

    // Safe init
    if (Notifications) {
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
            }),
        });
    }
} catch (e) {
    console.warn('[NotificationService] Native modules missing. Please rebuild dev client.');
}

export const NotificationService = {
    /**
     * Request permissions from the user
     */
    async requestPermissions() {
        if (!Device || !Notifications) return false;

        if (!Device.isDevice) {
            console.log('[NotificationService] Not a physical device, skipping permissions');
            return false;
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('[NotificationService] Permission denied');
            return false;
        }

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#6366f1',
            });
        }

        return true;
    },

    /**
     * Get the Expo Push Token
     */
    async getPushToken() {
        if (!Notifications) return null;
        try {
            const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
            if (!projectId) {
                console.warn('[NotificationService] No Eas Project ID found');
            }

            const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
            console.log('[NotificationService] Token:', token);
            return token;
        } catch (e) {
            console.error('[NotificationService] Failed to get token:', e);
            return null;
        }
    },

    /**
     * Schedule a notification for later
     */
    async scheduleNotification(title: string, body: string, seconds: number = 2, data: any = {}) {
        if (!Notifications) return;
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds,
            },
        });
    },

    /**
     * Immediate notification (local)
     */
    async sendLocalNotification(title: string, body: string, data: any = {}) {
        if (!Notifications) {
            console.warn('[NotificationService] Notifications module missing (Rebuild required)');
            return;
        }
        await Notifications.presentNotificationAsync({
            title,
            body,
            data,
            identifier: Date.now().toString(),
        });
    }
};
