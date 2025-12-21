/**
 * Profile Store - Manages user profiles for Hearify
 * 
 * Each profile gets its own isolated SQLite database.
 * This enables multi-user testing and personal data separation.
 */

import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

export interface Profile {
    id: string;
    name: string;
    avatarEmoji: string;
    createdAt: number;
    isOnboarded: boolean;
}

interface ProfileState {
    // Current active profile
    currentProfile: Profile | null;
    allProfiles: Profile[];
    isLoading: boolean;

    // Actions
    loadProfiles: () => Promise<void>;
    createProfile: (name: string, avatarEmoji?: string) => Promise<Profile>;
    switchProfile: (profileId: string) => Promise<void>;
    deleteProfile: (profileId: string) => Promise<void>;
    completeOnboarding: () => Promise<void>;
}

const PROFILES_KEY = 'hearify_profiles';
const ACTIVE_PROFILE_KEY = 'hearify_active_profile';

// Generate a simple unique ID
const generateId = () => `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useProfileStore = create<ProfileState>((set, get) => ({
    currentProfile: null,
    allProfiles: [],
    isLoading: true,

    loadProfiles: async () => {
        try {
            // Load all profiles
            const profilesJson = await SecureStore.getItemAsync(PROFILES_KEY);
            const profiles: Profile[] = profilesJson ? JSON.parse(profilesJson) : [];

            // Load active profile ID
            const activeProfileId = await SecureStore.getItemAsync(ACTIVE_PROFILE_KEY);

            // Find the active profile
            const currentProfile = activeProfileId
                ? profiles.find(p => p.id === activeProfileId) || null
                : profiles[0] || null;

            set({ allProfiles: profiles, currentProfile, isLoading: false });
            console.log('[ProfileStore] Loaded profiles:', profiles.length, 'Active:', currentProfile?.name);
        } catch (error) {
            console.error('[ProfileStore] Failed to load profiles:', error);
            set({ isLoading: false });
        }
    },

    createProfile: async (name: string, avatarEmoji: string = '🧠') => {
        const newProfile: Profile = {
            id: generateId(),
            name,
            avatarEmoji,
            createdAt: Date.now(),
            isOnboarded: false,
        };

        const { allProfiles } = get();
        const updatedProfiles = [...allProfiles, newProfile];

        // Save to SecureStore
        await SecureStore.setItemAsync(PROFILES_KEY, JSON.stringify(updatedProfiles));
        await SecureStore.setItemAsync(ACTIVE_PROFILE_KEY, newProfile.id);

        set({ allProfiles: updatedProfiles, currentProfile: newProfile });
        console.log('[ProfileStore] Created profile:', newProfile.name);

        return newProfile;
    },

    switchProfile: async (profileId: string) => {
        const { allProfiles } = get();
        const profile = allProfiles.find(p => p.id === profileId);

        if (profile) {
            await SecureStore.setItemAsync(ACTIVE_PROFILE_KEY, profileId);
            set({ currentProfile: profile });
            console.log('[ProfileStore] Switched to profile:', profile.name);
        }
    },

    deleteProfile: async (profileId: string) => {
        const { allProfiles, currentProfile } = get();
        const updatedProfiles = allProfiles.filter(p => p.id !== profileId);

        await SecureStore.setItemAsync(PROFILES_KEY, JSON.stringify(updatedProfiles));

        // If we deleted the active profile, switch to another
        if (currentProfile?.id === profileId) {
            const newActive = updatedProfiles[0] || null;
            if (newActive) {
                await SecureStore.setItemAsync(ACTIVE_PROFILE_KEY, newActive.id);
            } else {
                await SecureStore.deleteItemAsync(ACTIVE_PROFILE_KEY);
            }
            set({ allProfiles: updatedProfiles, currentProfile: newActive });
        } else {
            set({ allProfiles: updatedProfiles });
        }

        console.log('[ProfileStore] Deleted profile:', profileId);
    },

    completeOnboarding: async () => {
        const { currentProfile, allProfiles } = get();
        if (!currentProfile) return;

        const updatedProfile = { ...currentProfile, isOnboarded: true };
        const updatedProfiles = allProfiles.map(p =>
            p.id === currentProfile.id ? updatedProfile : p
        );

        await SecureStore.setItemAsync(PROFILES_KEY, JSON.stringify(updatedProfiles));
        set({ currentProfile: updatedProfile, allProfiles: updatedProfiles });

        console.log('[ProfileStore] Onboarding completed for:', currentProfile.name);
    },
}));

/**
 * Get the database name for a profile
 * This ensures complete data isolation between profiles
 */
export function getProfileDbName(profile: Profile | null): string {
    if (!profile) return 'hearify_default.db';
    return `hearify_${profile.id}.db`;
}
