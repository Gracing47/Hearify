/**
 * Haptic feedback patterns for neural interactions
 * 
 * Dev notes:
 * - Using expo-haptics for cross-platform haptic feedback
 * - Patterns designed to feel "neural" and empathetic
 */

import * as Haptics from 'expo-haptics';

/**
 * Haptic feedback when starting to listen
 */
export function listening(): void {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/**
 * Haptic feedback during AI thinking/processing
 */
export function thinking(): void {
    Haptics.selectionAsync();
}

/**
 * Haptic feedback when AI starts speaking
 */
export function speaking(): void {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/**
 * Haptic feedback for errors
 */
export function error(): void {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

/**
 * Subtle pulse for background activity
 */
export function pulse(): void {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
}

/**
 * Haptic feedback for selection (tap)
 */
export function selection(): void {
    Haptics.selectionAsync();
}

/**
 * Light haptic for UI toggles
 */
export function light(): void {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}
