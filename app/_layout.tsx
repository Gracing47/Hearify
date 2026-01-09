import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from 'react-native';
import 'react-native-reanimated';

import { initDatabase } from '../db';
import { validateAndRefreshIfNeeded } from '../services/GoogleAuthService';
import { NotificationService } from '../services/NotificationService';
import { getProfileDbName, useProfileStore } from '../store/profile';


export const unstable_settings = {
  anchor: '(tabs)',
};

function AppContent({ colorScheme }: { colorScheme: 'light' | 'dark' }) {
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme() ?? 'dark';
  const { currentProfile, isLoading, loadProfiles } = useProfileStore();
  const [isDbReady, setIsDbReady] = useState(false);

  // 1. Initial Setup (Profile + Notifications)
  useEffect(() => {
    loadProfiles().catch(console.error);
    NotificationService.requestPermissions().catch(console.error);
    
    // Q10C: Proactive calendar token validation on app start
    validateAndRefreshIfNeeded().catch(err => {
      console.log('[Auth] Calendar validation skipped:', err.message);
    });
  }, []);

  // 2. Database Sync
  useEffect(() => {
    if (isLoading) return;

    const dbName = getProfileDbName(currentProfile);
    initDatabase(dbName)
      .then(() => setIsDbReady(true))
      .catch(err => {
        console.error('[DB] Failed:', err);
        setIsDbReady(true); // Fallback
      });
  }, [currentProfile?.id, isLoading]);

  // Handle Loading State
  if (isLoading || !isDbReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <View style={{ marginTop: 20 }}>
          <Text style={{ color: '#666', fontSize: 12 }}>
            {isLoading ? 'Loading your mind...' : 'Waking up the neural archive...'}
          </Text>
        </View>
      </View>
    );
  }

  // Final App Render
  return <AppContent colorScheme={colorScheme as any} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
  },
});
