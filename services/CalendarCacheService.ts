/**
 * 🗓️ Calendar Cache Service — SQLite Offline Support
 * 
 * Q9A: 7-day event cache for offline resilience
 * JARVIS bleibt kontextbewusst auch im Tunnel oder Flugzeug
 */

import { getDb, isDatabaseReady } from '../db';
import { CalendarEvent } from '../store/calendarStore';

// Cache expires after 7 days
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Cache Write Operations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Persist calendar events to SQLite cache
 */
export async function cacheCalendarEvents(events: CalendarEvent[]): Promise<void> {
    if (!isDatabaseReady()) {
        console.warn('[CalendarCache] Database not ready');
        return;
    }
    
    const db = await getDb();
    const now = Date.now();
    const expiresAt = now + CACHE_DURATION_MS;
    
    try {
        // Use transaction for atomic write
        await db.execute('BEGIN TRANSACTION');
        
        for (const event of events) {
            await db.execute(
                `INSERT OR REPLACE INTO calendar_events_cache 
                 (id, title, start_time, end_time, is_all_day, description, location, attendees, cached_at, expires_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    event.id,
                    event.title,
                    event.startTime.getTime(),
                    event.endTime.getTime(),
                    event.isAllDay ? 1 : 0,
                    event.description || null,
                    event.location || null,
                    event.attendees ? JSON.stringify(event.attendees) : null,
                    now,
                    expiresAt,
                ]
            );
        }
        
        await db.execute('COMMIT');
        console.log(`[CalendarCache] Cached ${events.length} events`);
        
    } catch (error) {
        await db.execute('ROLLBACK');
        console.error('[CalendarCache] Cache write failed:', error);
    }
}

/**
 * Clear expired cache entries
 */
export async function clearExpiredCache(): Promise<void> {
    if (!isDatabaseReady()) return;
    
    const db = await getDb();
    const now = Date.now();
    
    try {
        const result = await db.execute(
            'DELETE FROM calendar_events_cache WHERE expires_at < ?',
            [now]
        );
        
        if (result.rowsAffected && result.rowsAffected > 0) {
            console.log(`[CalendarCache] Cleared ${result.rowsAffected} expired entries`);
        }
    } catch (error) {
        console.error('[CalendarCache] Clear expired failed:', error);
    }
}

/**
 * Clear all cached events (used on disconnect)
 */
export async function clearAllCachedEvents(): Promise<void> {
    if (!isDatabaseReady()) return;
    
    const db = await getDb();
    
    try {
        await db.execute('DELETE FROM calendar_events_cache');
        console.log('[CalendarCache] All cached events cleared');
    } catch (error) {
        console.error('[CalendarCache] Clear all failed:', error);
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Cache Read Operations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get cached events for today (offline fallback)
 */
export async function getCachedTodayEvents(): Promise<CalendarEvent[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return await getCachedEventsInRange(today, tomorrow);
}

/**
 * Get cached events for a date range
 */
export async function getCachedEventsInRange(
    startDate: Date,
    endDate: Date
): Promise<CalendarEvent[]> {
    if (!isDatabaseReady()) return [];
    
    const db = await getDb();
    const now = Date.now();
    
    try {
        const result = await db.execute(
            `SELECT * FROM calendar_events_cache 
             WHERE start_time >= ? AND start_time < ? AND expires_at > ?
             ORDER BY start_time ASC`,
            [startDate.getTime(), endDate.getTime(), now]
        );
        
        return (result.rows || []).map(rowToCalendarEvent);
        
    } catch (error) {
        console.error('[CalendarCache] Read failed:', error);
        return [];
    }
}

/**
 * Get all valid cached events (next 7 days)
 */
export async function getAllCachedEvents(): Promise<CalendarEvent[]> {
    if (!isDatabaseReady()) return [];
    
    const db = await getDb();
    const now = Date.now();
    
    try {
        const result = await db.execute(
            `SELECT * FROM calendar_events_cache 
             WHERE expires_at > ?
             ORDER BY start_time ASC`,
            [now]
        );
        
        return (result.rows || []).map(rowToCalendarEvent);
        
    } catch (error) {
        console.error('[CalendarCache] Read all failed:', error);
        return [];
    }
}

/**
 * Check if cache has valid data for today
 */
export async function hasCachedEventsForToday(): Promise<boolean> {
    if (!isDatabaseReady()) return false;
    
    const db = await getDb();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const now = Date.now();
    
    try {
        const result = await db.execute(
            `SELECT COUNT(*) as count FROM calendar_events_cache 
             WHERE start_time >= ? AND start_time < ? AND expires_at > ?`,
            [today.getTime(), tomorrow.getTime(), now]
        );
        
        const count = Number(result.rows?.[0]?.count || 0);
        return count > 0;
        
    } catch (error) {
        console.error('[CalendarCache] Check cache failed:', error);
        return false;
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helper Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Transform database row to CalendarEvent
 */
function rowToCalendarEvent(row: any): CalendarEvent {
    return {
        id: row.id,
        title: row.title,
        startTime: new Date(row.start_time),
        endTime: new Date(row.end_time),
        isAllDay: row.is_all_day === 1,
        description: row.description || undefined,
        location: row.location || undefined,
        attendees: row.attendees ? JSON.parse(row.attendees) : undefined,
    };
}

/**
 * Get cache statistics (for debugging/UI)
 */
export async function getCacheStats(): Promise<{
    totalEvents: number;
    oldestCachedAt: Date | null;
    newestCachedAt: Date | null;
}> {
    if (!isDatabaseReady()) {
        return { totalEvents: 0, oldestCachedAt: null, newestCachedAt: null };
    }
    
    const db = await getDb();
    const now = Date.now();
    
    try {
        const result = await db.execute(
            `SELECT COUNT(*) as count, MIN(cached_at) as oldest, MAX(cached_at) as newest 
             FROM calendar_events_cache WHERE expires_at > ?`,
            [now]
        );
        
        const row = result.rows?.[0];
        
        return {
            totalEvents: Number(row?.count || 0),
            oldestCachedAt: row?.oldest ? new Date(row.oldest as number) : null,
            newestCachedAt: row?.newest ? new Date(row.newest as number) : null,
        };
        
    } catch (error) {
        console.error('[CalendarCache] Stats failed:', error);
        return { totalEvents: 0, oldestCachedAt: null, newestCachedAt: null };
    }
}
