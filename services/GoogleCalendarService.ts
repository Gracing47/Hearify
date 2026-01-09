/**
 * 🗓️ Google Calendar Service — Event Management & Smart Scheduling
 * 
 * Q4C: calendar.events scope only
 * Q7C: Smart conflict detection with AI-suggested alternatives
 * Q5D: Privacy filtering for AI context
 * Q6B: Returns proposals for user confirmation
 */

import { CalendarEvent, getCalendarContextForAI, useCalendarStore } from '../store/calendarStore';
import { getValidAccessToken, refreshAccessToken } from './GoogleAuthService';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface GoogleCalendarEvent {
    id: string;
    summary: string;
    description?: string;
    location?: string;
    start: {
        dateTime?: string;
        date?: string;
        timeZone?: string;
    };
    end: {
        dateTime?: string;
        date?: string;
        timeZone?: string;
    };
    attendees?: Array<{ email: string; displayName?: string }>;
    status: string;
}

interface GoogleCalendarListResponse {
    items: GoogleCalendarEvent[];
    nextPageToken?: string;
}

interface FreeBusyResponse {
    calendars: {
        primary: {
            busy: Array<{ start: string; end: string }>;
        };
    };
}

export interface TimeSlot {
    start: Date;
    end: Date;
    durationMinutes: number;
}

export interface EventProposal {
    title: string;
    startTime: Date;
    endTime: Date;
    description?: string;
    hasConflict: boolean;
    alternativeSlots?: TimeSlot[];
}

export interface CreateEventResult {
    success: boolean;
    eventId?: string;
    error?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API Base
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

/**
 * Make authenticated API request with auto-refresh on 401 (Q3C)
 */
async function calendarApiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T | null> {
    let accessToken = await getValidAccessToken();
    
    if (!accessToken) {
        console.warn('[CalendarService] No valid access token');
        return null;
    }
    
    const makeRequest = async (token: string) => {
        const response = await fetch(`${CALENDAR_API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });
        
        return response;
    };
    
    let response = await makeRequest(accessToken);
    
    // Q3C: Reactive refresh on 401
    if (response.status === 401) {
        console.log('[CalendarService] Token expired, refreshing...');
        const refreshed = await refreshAccessToken();
        
        if (!refreshed) {
            console.error('[CalendarService] Token refresh failed');
            return null;
        }
        
        accessToken = await getValidAccessToken();
        if (!accessToken) return null;
        
        response = await makeRequest(accessToken);
    }
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error('[CalendarService] API Error:', response.status, errorText);
        return null;
    }
    
    return await response.json();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Read Operations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get events for today
 */
export async function getTodayEvents(): Promise<CalendarEvent[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return await getEventsInRange(today, tomorrow);
}

/**
 * Get events for the next 7 days (Q9A: for caching)
 */
export async function getWeekEvents(): Promise<CalendarEvent[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);
    
    return await getEventsInRange(today, weekLater);
}

/**
 * Get events in a date range
 */
export async function getEventsInRange(
    startDate: Date,
    endDate: Date
): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '50',
    });
    
    const response = await calendarApiRequest<GoogleCalendarListResponse>(
        `/calendars/primary/events?${params}`
    );
    
    if (!response) {
        return [];
    }
    
    // Transform to our CalendarEvent type
    return response.items
        .filter(event => event.status !== 'cancelled')
        .map(transformGoogleEvent);
}

/**
 * Transform Google Calendar event to our format
 */
function transformGoogleEvent(event: GoogleCalendarEvent): CalendarEvent {
    const isAllDay = !!event.start.date;
    
    return {
        id: event.id,
        title: event.summary || 'Ohne Titel',
        startTime: new Date(event.start.dateTime || event.start.date || ''),
        endTime: new Date(event.end.dateTime || event.end.date || ''),
        isAllDay,
        // Q5D: These fields are stored but NOT sent to AI
        description: event.description,
        location: event.location,
        attendees: event.attendees?.map(a => a.displayName || a.email),
    };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Conflict Detection (Q7C)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if a time slot has conflicts using FreeBusy API
 */
export async function checkConflicts(
    startTime: Date,
    endTime: Date
): Promise<{ hasConflict: boolean; busySlots: Array<{ start: Date; end: Date }> }> {
    const response = await calendarApiRequest<FreeBusyResponse>(
        '/freeBusy',
        {
            method: 'POST',
            body: JSON.stringify({
                timeMin: startTime.toISOString(),
                timeMax: endTime.toISOString(),
                items: [{ id: 'primary' }],
            }),
        }
    );
    
    if (!response) {
        return { hasConflict: false, busySlots: [] };
    }
    
    const busySlots = response.calendars.primary.busy.map(slot => ({
        start: new Date(slot.start),
        end: new Date(slot.end),
    }));
    
    return {
        hasConflict: busySlots.length > 0,
        busySlots,
    };
}

/**
 * Find free time slots around a preferred time (Q7C: Smart alternatives)
 */
export async function findFreeSlots(
    preferredTime: Date,
    durationMinutes: number = 60,
    searchWindowHours: number = 8
): Promise<TimeSlot[]> {
    // Search from 2 hours before to searchWindowHours after preferred time
    const searchStart = new Date(preferredTime);
    searchStart.setHours(searchStart.getHours() - 2);
    
    const searchEnd = new Date(preferredTime);
    searchEnd.setHours(searchEnd.getHours() + searchWindowHours);
    
    // Get busy times
    const response = await calendarApiRequest<FreeBusyResponse>(
        '/freeBusy',
        {
            method: 'POST',
            body: JSON.stringify({
                timeMin: searchStart.toISOString(),
                timeMax: searchEnd.toISOString(),
                items: [{ id: 'primary' }],
            }),
        }
    );
    
    if (!response) {
        return [];
    }
    
    const busySlots = response.calendars.primary.busy.map(slot => ({
        start: new Date(slot.start),
        end: new Date(slot.end),
    }));
    
    // Find free slots
    const freeSlots: TimeSlot[] = [];
    let currentTime = searchStart;
    
    // Working hours: 8:00 - 20:00
    const workDayStart = 8;
    const workDayEnd = 20;
    
    // Sort busy slots by start time
    busySlots.sort((a, b) => a.start.getTime() - b.start.getTime());
    
    for (const busy of busySlots) {
        // Check if there's a gap before this busy slot
        if (currentTime < busy.start) {
            const slotEnd = new Date(currentTime);
            slotEnd.setMinutes(slotEnd.getMinutes() + durationMinutes);
            
            // Only include if within working hours
            if (currentTime.getHours() >= workDayStart && 
                slotEnd.getHours() <= workDayEnd &&
                slotEnd <= busy.start) {
                freeSlots.push({
                    start: new Date(currentTime),
                    end: slotEnd,
                    durationMinutes,
                });
            }
        }
        
        // Move current time to after this busy slot
        if (busy.end > currentTime) {
            currentTime = busy.end;
        }
    }
    
    // Check for free time after all busy slots
    const finalSlotEnd = new Date(currentTime);
    finalSlotEnd.setMinutes(finalSlotEnd.getMinutes() + durationMinutes);
    
    if (finalSlotEnd <= searchEnd &&
        currentTime.getHours() >= workDayStart &&
        finalSlotEnd.getHours() <= workDayEnd) {
        freeSlots.push({
            start: new Date(currentTime),
            end: finalSlotEnd,
            durationMinutes,
        });
    }
    
    // Return up to 3 best alternatives
    return freeSlots.slice(0, 3);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Write Operations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create a new calendar event
 */
export async function createEvent(
    title: string,
    startTime: Date,
    endTime: Date,
    description?: string
): Promise<CreateEventResult> {
    const eventBody = {
        summary: title,
        description: description || `Erstellt von Hearify`,
        start: {
            dateTime: startTime.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
            dateTime: endTime.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
    };
    
    const response = await calendarApiRequest<GoogleCalendarEvent>(
        '/calendars/primary/events',
        {
            method: 'POST',
            body: JSON.stringify(eventBody),
        }
    );
    
    if (!response) {
        return { success: false, error: 'Termin konnte nicht erstellt werden' };
    }
    
    console.log('[CalendarService] Event created:', response.id);
    return { success: true, eventId: response.id };
}

/**
 * Create event proposal with conflict check (Q6B, Q7C)
 * Returns proposal for user confirmation, with alternatives if conflict detected
 */
export async function createEventProposal(
    title: string,
    preferredStartTime: Date,
    durationMinutes: number = 60
): Promise<EventProposal> {
    const endTime = new Date(preferredStartTime);
    endTime.setMinutes(endTime.getMinutes() + durationMinutes);
    
    // Check for conflicts
    const { hasConflict } = await checkConflicts(preferredStartTime, endTime);
    
    let alternativeSlots: TimeSlot[] | undefined;
    
    if (hasConflict) {
        // Q7C: Find smart alternatives
        alternativeSlots = await findFreeSlots(preferredStartTime, durationMinutes);
    }
    
    return {
        title,
        startTime: preferredStartTime,
        endTime,
        hasConflict,
        alternativeSlots,
    };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Sync & Cache Management (Q9A)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Sync calendar events to local store and SQLite cache
 */
export async function syncCalendarEvents(): Promise<boolean> {
    const store = useCalendarStore.getState();
    
    try {
        // Fetch today's events
        const todayEvents = await getTodayEvents();
        store.setTodayEvents(todayEvents);
        
        // Fetch week events for cache
        const weekEvents = await getWeekEvents();
        store.setWeekEvents(weekEvents);
        
        // TODO: Persist to SQLite for offline access (Q9A)
        // await persistEventsToCache(weekEvents);
        
        console.log(`[CalendarService] Synced ${todayEvents.length} today, ${weekEvents.length} this week`);
        return true;
        
    } catch (error) {
        console.error('[CalendarService] Sync failed:', error);
        return false;
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI Context Integration (Q5D, Q8B)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get privacy-filtered calendar context for AI (Q5D)
 * AI sees only: "Du hast 3 Termine heute" + titles + times
 */
export function getAICalendarContext(): string {
    const store = useCalendarStore.getState();
    return getCalendarContextForAI(store.todayEvents);
}

/**
 * Get calendar facts for GFF synthesis (Q8B)
 * Returns structured data for DeltaService
 */
export function getCalendarFactsForDelta(): {
    totalEvents: number;
    nextEvent: { title: string; startsIn: number } | null;
    busyHours: number;
    hasMorningFree: boolean;
} {
    const store = useCalendarStore.getState();
    const events = store.todayEvents;
    const now = new Date();
    
    // Find next upcoming event
    const nextEvent = events
        .filter(e => e.startTime > now)
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0];
    
    // Calculate busy hours
    let busyMs = 0;
    for (const event of events) {
        if (!event.isAllDay) {
            busyMs += event.endTime.getTime() - event.startTime.getTime();
        }
    }
    const busyHours = Math.round(busyMs / (1000 * 60 * 60) * 10) / 10;
    
    // Check if morning is free (before 12:00)
    const morningEnd = new Date(now);
    morningEnd.setHours(12, 0, 0, 0);
    
    const hasMorningFree = !events.some(e => 
        e.startTime < morningEnd && e.endTime > now && !e.isAllDay
    );
    
    return {
        totalEvents: events.length,
        nextEvent: nextEvent ? {
            title: nextEvent.title,
            startsIn: Math.round((nextEvent.startTime.getTime() - now.getTime()) / (1000 * 60)), // minutes
        } : null,
        busyHours,
        hasMorningFree,
    };
}
