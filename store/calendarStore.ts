/**
 * 🗓️ Calendar Auth Store — Google Calendar OAuth State Management
 * 
 * Q2B: Dedicated Zustand store with SecureStore persistence
 * Q3C: Hybrid refresh strategy (proactive + reactive)
 * Q10C: Proactive token validation on app start
 */

import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface CalendarTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number; // Unix timestamp in ms
}

export type CalendarConnectionStatus = 
    | 'disconnected'      // No tokens stored
    | 'connected'         // Valid tokens, ready to use
    | 'expired'           // Access token expired, refresh needed
    | 'refreshing'        // Currently refreshing token
    | 'error';            // Token invalid, re-auth required

export interface CalendarEvent {
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
    isAllDay: boolean;
    // Q5D: Privacy - these fields are NOT sent to AI
    description?: string;
    location?: string;
    attendees?: string[];
}

interface CalendarState {
    // Connection Status
    status: CalendarConnectionStatus;
    lastError: string | null;
    lastSyncAt: number | null;
    
    // Cached Events (Q9A)
    todayEvents: CalendarEvent[];
    weekEvents: CalendarEvent[];
    
    // Actions
    initialize: () => Promise<void>;
    setTokens: (tokens: CalendarTokens) => Promise<void>;
    clearTokens: () => Promise<void>;
    setStatus: (status: CalendarConnectionStatus) => void;
    setError: (error: string | null) => void;
    setTodayEvents: (events: CalendarEvent[]) => void;
    setWeekEvents: (events: CalendarEvent[]) => void;
    
    // Token Management (Q3C)
    getAccessToken: () => Promise<string | null>;
    isTokenExpired: () => Promise<boolean>;
    needsRefresh: () => Promise<boolean>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SecureStore Keys
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const STORAGE_KEYS = {
    ACCESS_TOKEN: 'google_calendar_access_token',
    REFRESH_TOKEN: 'google_calendar_refresh_token',
    EXPIRES_AT: 'google_calendar_expires_at',
} as const;

// Token refresh buffer: refresh 5 minutes before expiry (Q3C)
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Store Implementation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const useCalendarStore = create<CalendarState>((set, get) => ({
    // Initial State
    status: 'disconnected',
    lastError: null,
    lastSyncAt: null,
    todayEvents: [],
    weekEvents: [],
    
    /**
     * Initialize store from SecureStore (Q10C: called on app start)
     */
    initialize: async () => {
        try {
            const [accessToken, refreshToken, expiresAtStr] = await Promise.all([
                SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
                SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
                SecureStore.getItemAsync(STORAGE_KEYS.EXPIRES_AT),
            ]);
            
            if (!accessToken || !refreshToken) {
                set({ status: 'disconnected' });
                console.log('[CalendarStore] No tokens found - disconnected');
                return;
            }
            
            const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0;
            const now = Date.now();
            
            if (now >= expiresAt) {
                // Token expired, needs refresh
                set({ status: 'expired' });
                console.log('[CalendarStore] Token expired - needs refresh');
            } else if (now >= expiresAt - REFRESH_BUFFER_MS) {
                // Token expiring soon, should refresh proactively
                set({ status: 'expired' });
                console.log('[CalendarStore] Token expiring soon - will refresh');
            } else {
                // Token valid
                set({ status: 'connected' });
                console.log('[CalendarStore] Token valid - connected');
            }
        } catch (error) {
            console.error('[CalendarStore] Initialize error:', error);
            set({ status: 'error', lastError: 'Initialisierung fehlgeschlagen' });
        }
    },
    
    /**
     * Store new OAuth tokens securely
     */
    setTokens: async (tokens: CalendarTokens) => {
        try {
            await Promise.all([
                SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken),
                SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken),
                SecureStore.setItemAsync(STORAGE_KEYS.EXPIRES_AT, tokens.expiresAt.toString()),
            ]);
            
            set({ status: 'connected', lastError: null });
            console.log('[CalendarStore] Tokens stored successfully');
        } catch (error) {
            console.error('[CalendarStore] Failed to store tokens:', error);
            set({ status: 'error', lastError: 'Token-Speicherung fehlgeschlagen' });
        }
    },
    
    /**
     * Clear all stored tokens (disconnect)
     */
    clearTokens: async () => {
        try {
            await Promise.all([
                SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
                SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
                SecureStore.deleteItemAsync(STORAGE_KEYS.EXPIRES_AT),
            ]);
            
            set({ 
                status: 'disconnected', 
                lastError: null,
                todayEvents: [],
                weekEvents: [],
                lastSyncAt: null,
            });
            console.log('[CalendarStore] Tokens cleared - disconnected');
        } catch (error) {
            console.error('[CalendarStore] Failed to clear tokens:', error);
        }
    },
    
    setStatus: (status) => set({ status }),
    setError: (error) => set({ lastError: error }),
    setTodayEvents: (events) => set({ todayEvents: events }),
    setWeekEvents: (events) => set({ weekEvents: events, lastSyncAt: Date.now() }),
    
    /**
     * Get current access token (returns null if not available)
     */
    getAccessToken: async () => {
        const state = get();
        
        if (state.status === 'disconnected' || state.status === 'error') {
            return null;
        }
        
        return await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    },
    
    /**
     * Check if token is expired
     */
    isTokenExpired: async () => {
        const expiresAtStr = await SecureStore.getItemAsync(STORAGE_KEYS.EXPIRES_AT);
        if (!expiresAtStr) return true;
        
        const expiresAt = parseInt(expiresAtStr, 10);
        return Date.now() >= expiresAt;
    },
    
    /**
     * Check if token needs proactive refresh (Q3C: 5 min buffer)
     */
    needsRefresh: async () => {
        const expiresAtStr = await SecureStore.getItemAsync(STORAGE_KEYS.EXPIRES_AT);
        if (!expiresAtStr) return true;
        
        const expiresAt = parseInt(expiresAtStr, 10);
        return Date.now() >= (expiresAt - REFRESH_BUFFER_MS);
    },
}));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helper: Get Privacy-Filtered Context for AI (Q5D)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Returns a minimal, privacy-safe summary for AI context
 * Q5D: AI sees only "Du hast 3 Termine heute", not sensitive details
 */
export function getCalendarContextForAI(events: CalendarEvent[]): string {
    if (events.length === 0) {
        return 'Heute stehen keine Termine an.';
    }
    
    if (events.length === 1) {
        const event = events[0];
        const timeStr = formatTimeRange(event.startTime, event.endTime, event.isAllDay);
        return `Du hast heute 1 Termin: "${event.title}" ${timeStr}.`;
    }
    
    // Multiple events: list titles and times only
    const eventList = events
        .slice(0, 5) // Max 5 events to avoid context bloat
        .map(e => {
            const timeStr = formatTimeRange(e.startTime, e.endTime, e.isAllDay);
            return `• "${e.title}" ${timeStr}`;
        })
        .join('\n');
    
    const moreText = events.length > 5 
        ? `\n(+ ${events.length - 5} weitere Termine)` 
        : '';
    
    return `Du hast heute ${events.length} Termine:\n${eventList}${moreText}`;
}

/**
 * Format time range for display
 */
function formatTimeRange(start: Date, end: Date, isAllDay: boolean): string {
    if (isAllDay) {
        return '(ganztägig)';
    }
    
    const formatTime = (d: Date) => 
        d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    
    return `(${formatTime(start)} - ${formatTime(end)})`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Connection Status Labels (German)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const CALENDAR_STATUS_LABELS: Record<CalendarConnectionStatus, string> = {
    disconnected: 'Nicht verbunden',
    connected: 'Verbunden',
    expired: 'Verbindung erneuern',
    refreshing: 'Verbindung wird erneuert...',
    error: 'Verbindungsfehler',
};
