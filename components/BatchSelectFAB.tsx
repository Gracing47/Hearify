/**
 * BatchSelectFAB - Floating Action Bar for Multi-Select Mode
 * 
 * Phase 6: Appears when snippets are selected in Chronicle
 * Shows count, clear button, and "Reflect" action
 * 
 * Design: Obsidian Void 2.0 with glass morphism
 */

import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    FadeIn,
    SlideInDown,
    SlideOutDown,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { prepareBatchPayload } from '../services/BatchSynthesisService';
import {
    useChronicleStore,
    useSelectedCount,
    useSelectionLimit,
    useSelectionMode,
} from '../store/chronicleStore';
import { useContextStore } from '../store/contextStore';

// =============================================================================
// SPRING CONFIG
// =============================================================================

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 150,
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface CountBadgeProps {
  count: number;
  limit: number;
}

const CountBadge = memo<CountBadgeProps>(({ count, limit }) => {
  const isAtLimit = count >= limit;
  
  return (
    <View style={[styles.countBadge, isAtLimit && styles.countBadgeLimit]}>
      <Text style={[styles.countText, isAtLimit && styles.countTextLimit]}>
        {count}/{limit}
      </Text>
    </View>
  );
});

CountBadge.displayName = 'CountBadge';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const BatchSelectFAB = memo(() => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const isSelectionMode = useSelectionMode();
  const selectedCount = useSelectedCount();
  const selectionLimit = useSelectionLimit();
  
  const exitSelectionMode = useChronicleStore((s) => s.exitSelectionMode);
  const clearSelection = useChronicleStore((s) => s.clearSelection);
  const selectedSnippetIds = useChronicleStore((s) => s.selectedSnippetIds);
  
  // Animation values
  const reflectScale = useSharedValue(1);
  
  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------
  
  const handleClearSelection = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearSelection();
  }, [clearSelection]);
  
  const handleExitMode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    exitSelectionMode();
  }, [exitSelectionMode]);
  
  const handleReflect = useCallback(async () => {
    if (selectedCount === 0) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    try {
      // Prepare batch payload
      const payload = await prepareBatchPayload(selectedSnippetIds);
      
      if (!payload) {
        console.error('[BatchFAB] Failed to prepare payload');
        return;
      }
      
      console.log('[BatchFAB] Starting batch reflect with', payload.context.count, 'snippets');
      
      // Store batch context for Orbit to pick up
      useChronicleStore.getState().setPendingBatchReflect(payload);
      
      // Navigate to Orbit
      useContextStore.getState().setActiveScreen('orbit');
      
      // Clear selection after navigating
      setTimeout(() => {
        exitSelectionMode();
      }, 300);
      
    } catch (error) {
      console.error('[BatchFAB] Reflect failed:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [selectedCount, selectedSnippetIds, exitSelectionMode]);
  
  // ---------------------------------------------------------------------------
  // ANIMATED STYLES
  // ---------------------------------------------------------------------------
  
  const reflectButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reflectScale.value }],
  }));
  
  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  
  // Don't render if not in selection mode
  if (!isSelectionMode) return null;
  
  return (
    <Animated.View
      entering={SlideInDown.springify().damping(20).stiffness(150)}
      exiting={SlideOutDown.springify().damping(25).stiffness(200)}
      style={[
        styles.container,
        { bottom: insets.bottom + 90 } // Above tab bar
      ]}
    >
      <BlurView intensity={40} tint="dark" style={styles.blur}>
        {/* Left: Clear/Exit Buttons */}
        <View style={styles.leftSection}>
          <Pressable
            style={styles.iconButton}
            onPress={handleExitMode}
            hitSlop={8}
          >
            <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
          </Pressable>
          
          {selectedCount > 0 && (
            <Animated.View entering={FadeIn.duration(200)}>
              <Pressable
                style={styles.clearButton}
                onPress={handleClearSelection}
              >
                <Text style={styles.clearText}>Auswahl aufheben</Text>
              </Pressable>
            </Animated.View>
          )}
        </View>
        
        {/* Center: Count Badge */}
        <CountBadge count={selectedCount} limit={selectionLimit} />
        
        {/* Right: Reflect Button */}
        <Animated.View style={reflectButtonStyle}>
          <Pressable
            style={[
              styles.reflectButton,
              selectedCount === 0 && styles.reflectButtonDisabled
            ]}
            onPress={handleReflect}
            onPressIn={() => {
              reflectScale.value = withSpring(0.95, SPRING_CONFIG);
            }}
            onPressOut={() => {
              reflectScale.value = withSpring(1, SPRING_CONFIG);
            }}
            disabled={selectedCount === 0}
          >
            <Ionicons 
              name="sparkles" 
              size={18} 
              color={selectedCount === 0 ? 'rgba(255,255,255,0.3)' : '#000'} 
            />
            <Text style={[
              styles.reflectText,
              selectedCount === 0 && styles.reflectTextDisabled
            ]}>
              Reflektieren
            </Text>
          </Pressable>
        </Animated.View>
      </BlurView>
    </Animated.View>
  );
});

BatchSelectFAB.displayName = 'BatchSelectFAB';

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  blur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  
  // Left Section
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  clearText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  
  // Count Badge
  countBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  countBadgeLimit: {
    backgroundColor: 'rgba(255, 213, 79, 0.2)',
    borderColor: 'rgba(255, 213, 79, 0.4)',
  },
  countText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#a5b4fc',
    letterSpacing: 0.5,
  },
  countTextLimit: {
    color: '#ffd54f',
  },
  
  // Reflect Button
  reflectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffd54f',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  reflectButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  reflectText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  reflectTextDisabled: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
});

export default BatchSelectFAB;
