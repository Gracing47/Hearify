import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { initDatabase } from '../db';
import { getProfileDbName, useProfileStore } from '../store/profile';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();

  const { currentProfile, isLoading, loadProfiles } = useProfileStore();
  const [isDbReady, setIsDbReady] = useState(false);

  // Load profiles on app start
  useEffect(() => {
    loadProfiles();
  }, []);

  // Initialize database when profile changes
  useEffect(() => {
    if (isLoading) return;

    const initDb = async () => {
      const dbName = getProfileDbName(currentProfile);
      await initDatabase(dbName);
      setIsDbReady(true);
    };

    initDb();
  }, [currentProfile, isLoading]);

  // Handle routing based on profile state
  useEffect(() => {
    if (isLoading || !isDbReady) return;

    const inOnboarding = segments[0] === 'onboarding';

    if (!currentProfile) {
      // No profile exists, go to onboarding
      if (!inOnboarding) {
        router.replace('/onboarding' as any);
      }
    } else if (!currentProfile.isOnboarded) {
      // Profile exists but onboarding not complete
      if (!inOnboarding) {
        router.replace('/onboarding' as any);
      }
    } else {
      // Profile is ready, go to main app
      if (inOnboarding) {
        router.replace('/(tabs)' as any);
      }
    }
  }, [currentProfile, isLoading, isDbReady, segments]);

  // Show loading screen while initializing
  if (isLoading || !isDbReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
  },
});
