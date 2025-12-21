/**
 * Obsidian Void 2.0 - Floating Glass Tab Navigation
 * Award-Winning UI with absolute positioning and blur effects
 */

import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarActiveTintColor: '#6366f1',
          tabBarInactiveTintColor: '#666',
          tabBarShowLabel: true,
          tabBarLabelStyle: styles.tabLabel,
          // Floating Glass Tab Bar
          tabBarStyle: {
            position: 'absolute',
            bottom: insets.bottom + 16,
            left: 20,
            right: 20,
            height: 70,
            borderRadius: 35,
            backgroundColor: 'rgba(20, 20, 20, 0.85)',
            borderTopWidth: 0,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.08)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.5,
            shadowRadius: 20,
            elevation: 20,
            paddingBottom: 0,
            paddingTop: 10,
          },
          tabBarBackground: () => (
            Platform.OS === 'ios' ? (
              <BlurView
                intensity={40}
                tint="dark"
                style={StyleSheet.absoluteFill}
              />
            ) : null
          ),
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Hearify',
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeIconWrapper : undefined}>
                <IconSymbol size={24} name="house.fill" color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="canvas"
          options={{
            title: 'Horizon',
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeIconWrapper : undefined}>
                <IconSymbol size={24} name="brain.head.profile" color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Memory',
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeIconWrapper : undefined}>
                <IconSymbol size={24} name="list.bullet.indent" color={color} />
              </View>
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginTop: 4,
  },
  activeIconWrapper: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 12,
    padding: 6,
  },
});
