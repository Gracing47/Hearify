/**
 * 🔐 Google Calendar OAuth Service
 * 
 * Q1C: Hybrid - expo-auth-session for flow + manual refresh management
 * Q3C: Proactive refresh on app start + reactive on 401
 * Q4C: Minimal scope - calendar.events only
 * 
 * Setup Required:
 * 1. Create project at https://console.cloud.google.com
 * 2. Enable Google Calendar API
 * 3. Create OAuth 2.0 credentials (Web application + Android + iOS)
 * 4. Add .env: EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_client_id
 */

// LAZY IMPORTS: expo-auth-session requires expo-crypto native module
// We defer loading until actually needed to prevent app crash
let AuthSession: typeof import('expo-auth-session') | null = null;
let WebBrowser: typeof import('expo-web-browser') | null = null;

const loadAuthModules = async () => {
    if (!AuthSession) {
        try {
            AuthSession = await import('expo-auth-session');
            WebBrowser = await import('expo-web-browser');
            WebBrowser.maybeCompleteAuthSession();
        } catch (error) {
            console.warn('[GoogleAuth] Native auth modules not available:', error);
            return false;
        }
    }
    return true;
};

import { CalendarTokens, useCalendarStore } from '../store/calendarStore';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Configuration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Google OAuth endpoints
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

// Q4C: Minimal scope - only calendar events, no settings/sharing access
const SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
].join(' ');

// Get client ID from environment
const getClientId = () => {
    const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
        console.warn('[GoogleAuth] EXPO_PUBLIC_GOOGLE_CLIENT_ID not set');
    }
    return clientId || '';
};

// Redirect URI for Expo (async because AuthSession is lazy loaded)
const getRedirectUri = async (): Promise<string> => {
    const loaded = await loadAuthModules();
    if (!loaded || !AuthSession) {
        throw new Error('Auth modules not available');
    }
    return AuthSession.makeRedirectUri({
        scheme: 'hearify',
        path: 'oauth/google',
    });
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Auth Discovery Document
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const discovery = {
    authorizationEndpoint: GOOGLE_AUTH_URL,
    tokenEndpoint: GOOGLE_TOKEN_URL,
    revocationEndpoint: GOOGLE_REVOKE_URL,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OAuth Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface AuthResult {
    success: boolean;
    error?: string;
}

/**
 * Initiate Google OAuth flow
 * Returns tokens on success, stores them in CalendarAuthStore
 */
export async function initiateGoogleAuth(): Promise<AuthResult> {
    // Load auth modules first
    const modulesLoaded = await loadAuthModules();
    if (!modulesLoaded || !AuthSession) {
        return {
            success: false,
            error: 'Kalender-Authentifizierung ist in diesem Build nicht verfügbar. Bitte App neu bauen mit: npx expo run:android'
        };
    }

    const clientId = getClientId();

    if (!clientId) {
        return {
            success: false,
            error: 'Google Client ID nicht konfiguriert. Bitte EXPO_PUBLIC_GOOGLE_CLIENT_ID in .env setzen.'
        };
    }

    try {
        const redirectUri = await getRedirectUri();
        console.log('[GoogleAuth] Redirect URI:', redirectUri);

        // Create auth request
        const authRequest = new AuthSession.AuthRequest({
            clientId,
            scopes: SCOPES.split(' '),
            redirectUri,
            responseType: AuthSession.ResponseType.Code,
            usePKCE: true,
            extraParams: {
                access_type: 'offline', // Request refresh token
                prompt: 'consent',      // Force consent to get refresh token
            },
        });

        // Prompt user
        const result = await authRequest.promptAsync(discovery);

        if (result.type !== 'success' || !result.params.code) {
            console.log('[GoogleAuth] Auth cancelled or failed:', result.type);
            return {
                success: false,
                error: result.type === 'cancel'
                    ? 'Authentifizierung abgebrochen'
                    : 'Authentifizierung fehlgeschlagen'
            };
        }

        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(
            result.params.code,
            authRequest.codeVerifier!,
            redirectUri
        );

        if (!tokens) {
            return { success: false, error: 'Token-Austausch fehlgeschlagen' };
        }

        // Store tokens securely
        await useCalendarStore.getState().setTokens(tokens);

        console.log('[GoogleAuth] Successfully authenticated');
        return { success: true };

    } catch (error) {
        console.error('[GoogleAuth] Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unbekannter Fehler'
        };
    }
}

/**
 * Exchange authorization code for access + refresh tokens
 */
async function exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    redirectUri: string
): Promise<CalendarTokens | null> {
    const clientId = getClientId();

    try {
        const response = await fetch(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: clientId,
                code,
                code_verifier: codeVerifier,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
            }).toString(),
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('[GoogleAuth] Token exchange failed:', errorData);
            return null;
        }

        const data = await response.json();

        // Calculate expiration time
        const expiresAt = Date.now() + (data.expires_in * 1000);

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt,
        };

    } catch (error) {
        console.error('[GoogleAuth] Token exchange error:', error);
        return null;
    }
}

/**
 * Refresh access token using refresh token (Q3C)
 * Called proactively on app start or reactively on 401
 */
export async function refreshAccessToken(): Promise<boolean> {
    const store = useCalendarStore.getState();
    const clientId = getClientId();

    // Get current refresh token from SecureStore
    const currentToken = await store.getAccessToken();
    if (!currentToken) {
        console.log('[GoogleAuth] No token to refresh');
        return false;
    }

    store.setStatus('refreshing');

    try {
        // We need to get the refresh token directly from SecureStore
        const { getItemAsync } = await import('expo-secure-store');
        const refreshToken = await getItemAsync('google_calendar_refresh_token');

        if (!refreshToken) {
            console.error('[GoogleAuth] No refresh token available');
            store.setStatus('error');
            store.setError('Kein Refresh-Token vorhanden');
            return false;
        }

        const response = await fetch(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: clientId,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            }).toString(),
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('[GoogleAuth] Token refresh failed:', errorData);

            // Check if refresh token is invalid (user revoked access)
            if (response.status === 400 || response.status === 401) {
                store.setStatus('error');
                store.setError('Kalender-Zugriff wurde widerrufen. Bitte erneut verbinden.');
                return false;
            }

            store.setStatus('expired');
            return false;
        }

        const data = await response.json();
        const expiresAt = Date.now() + (data.expires_in * 1000);

        // Update tokens (refresh token might not be returned)
        await store.setTokens({
            accessToken: data.access_token,
            refreshToken: data.refresh_token || refreshToken, // Keep old if not returned
            expiresAt,
        });

        console.log('[GoogleAuth] Token refreshed successfully');
        return true;

    } catch (error) {
        console.error('[GoogleAuth] Refresh error:', error);
        store.setStatus('error');
        store.setError('Token-Aktualisierung fehlgeschlagen');
        return false;
    }
}

/**
 * Disconnect Google Calendar (revoke access + clear tokens)
 */
export async function disconnectGoogleCalendar(): Promise<void> {
    const store = useCalendarStore.getState();

    try {
        const accessToken = await store.getAccessToken();

        if (accessToken) {
            // Revoke token at Google
            await fetch(`${GOOGLE_REVOKE_URL}?token=${accessToken}`, {
                method: 'POST',
            });
            console.log('[GoogleAuth] Token revoked at Google');
        }
    } catch (error) {
        console.warn('[GoogleAuth] Revoke failed (continuing with local cleanup):', error);
    }

    // Clear local tokens
    await store.clearTokens();
    console.log('[GoogleAuth] Disconnected from Google Calendar');
}

/**
 * Get valid access token (with auto-refresh if needed)
 * Q3C: Reactive refresh on expired token
 */
export async function getValidAccessToken(): Promise<string | null> {
    const store = useCalendarStore.getState();

    // Check if we need to refresh
    const needsRefresh = await store.needsRefresh();

    if (needsRefresh) {
        console.log('[GoogleAuth] Token needs refresh');
        const refreshed = await refreshAccessToken();

        if (!refreshed) {
            return null;
        }
    }

    return await store.getAccessToken();
}

/**
 * Proactive token validation (Q10C: called on app start)
 */
export async function validateAndRefreshIfNeeded(): Promise<void> {
    const store = useCalendarStore.getState();

    // Initialize store first
    await store.initialize();

    const status = store.status;

    if (status === 'expired') {
        console.log('[GoogleAuth] Token expired on app start - refreshing');
        await refreshAccessToken();
    } else if (status === 'connected') {
        // Check if expiring soon (proactive refresh)
        const needsRefresh = await store.needsRefresh();

        if (needsRefresh) {
            console.log('[GoogleAuth] Token expiring soon - proactive refresh');
            await refreshAccessToken();
        }
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// React Hook for OAuth Flow
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useCallback, useState } from 'react';

export function useGoogleCalendarAuth() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const status = useCalendarStore((s) => s.status);
    const lastError = useCalendarStore((s) => s.lastError);

    const connect = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        const result = await initiateGoogleAuth();

        setIsLoading(false);

        if (!result.success) {
            setError(result.error || 'Verbindung fehlgeschlagen');
        }

        return result.success;
    }, []);

    const disconnect = useCallback(async () => {
        setIsLoading(true);
        await disconnectGoogleCalendar();
        setIsLoading(false);
    }, []);

    return {
        status,
        isLoading,
        error: error || lastError,
        isConnected: status === 'connected',
        connect,
        disconnect,
    };
}
