/**
 * 🌅 Daily Delta Service — Morning Reflection Engine
 * 
 * Generates AI-powered summaries of the previous day's thoughts.
 * Uses DeepSeek for intelligent synthesis and pattern recognition.
 */

import { getDeepSeekKey } from '../config/api';
import { getDb, isDatabaseReady } from '../db';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

export interface DailyDelta {
    id: number;
    date: string;
    summary: string;
    highlights: string[];
    mood: 'analytical' | 'reflective' | 'creative' | 'mixed';
    nodeCount: number;
    topClusters: string[];
    createdAt: number;
    gffBreakdown?: {
        goals: number;
        facts: number;
        feelings: number;
        primaryGoal?: string;
        dominantFeeling?: string;
        keyInsight?: string;
    };
}

const DELTA_PROMPT = `You are an intelligent reflection engine for Hearify, a cognitive operating system.

Given the user's thoughts from the past 24 hours AND their calendar context, generate a strategic daily summary using the GFF Framework (Goals, Feelings, Facts).

YOUR TASK:
Analyze the thoughts and calendar to create a synthesis that:
1. Identifies the primary GOAL focus (what they're working toward)
2. Counts key FACTS recorded (insights, learnings, data points)
3. Assesses FEELINGS state (energy, friction, motivation)
4. Considers CALENDAR context (meetings, busy hours, free slots)
5. Suggests strategic adjustments if needed

CALENDAR AWARENESS (Q8B Integration):
- Use calendar data as a FACT to inform planning
- If morning is free but user has afternoon meetings → suggest focused work AM
- If user recorded a goal but calendar is packed → flag friction
- If next meeting is soon → recommend wrapping up current task

RESPONSE FORMAT (strict JSON):
{
  "summary": "Today you focused on [Goal: X]. You recorded Y [Facts] regarding Z, but your [Feelings] suggest A. Your calendar shows B. Consider C.",
  "highlights": ["Primary goal: X", "Y facts captured", "Energy: high/low", "Calendar: Z meetings", "Recommendation: ..."],
  "mood": "analytical",
  "gffBreakdown": {
    "goals": 3,
    "facts": 7,
    "feelings": 2,
    "primaryGoal": "Become top AM at Google",
    "dominantFeeling": "motivated",
    "keyInsight": "Best work happens in morning"
  },
  "calendarInsight": "Morning free until 14:00 - ideal for deep work"
}

MOOD CLASSIFICATION:
- "analytical" - Heavy on facts and goal-planning
- "reflective" - Balanced feelings and introspection
- "creative" - Exploratory, ideation-focused
- "mixed" - Varied activity across GFF

GFF SYNTHESIS RULES:
1. If goals > 5: User is in planning mode → encourage focus
2. If feelings show friction: Suggest goal adjustment or break
3. If facts dominate: User is learning → validate progress
4. If no clear goal detected: Suggest defining one
5. If calendar is packed: Acknowledge constraints, suggest realistic scope
6. If calendar has free slots: Recommend high-priority goal for that window

Be strategic, concise, and actionable. This is JARVIS, not a passive journal.`;

/**
 * Generate a Daily Delta for a specific date
 */
export async function generateDelta(targetDate: Date = new Date()): Promise<DailyDelta | null> {
    if (!isDatabaseReady()) {
        console.warn('[DeltaService] Database not ready');
        return null;
    }

    const db = await getDb();
    const dateStr = formatDateKey(targetDate);

    // Check if delta already exists for this date
    const existing = await db.execute(
        'SELECT * FROM daily_deltas WHERE date = ?',
        [dateStr]
    );

    if (existing.rows && existing.rows.length > 0) {
        return rowToDelta(existing.rows[0]);
    }

    // Get snippets from the target day
    const dayStart = getStartOfDay(targetDate);
    const dayEnd = dayStart + 86400000; // 24 hours in ms

    const snippetsResult = await db.execute(
        'SELECT content, type, sentiment, topic FROM snippets WHERE timestamp >= ? AND timestamp < ? ORDER BY timestamp ASC',
        [dayStart, dayEnd]
    );

    const snippets = snippetsResult.rows || [];

    if (snippets.length === 0) {
        return null; // No data for this day
    }

    // Calculate GFF counts
    const gffCounts = {
        goals: snippets.filter((s: any) => s.type === 'goal').length,
        facts: snippets.filter((s: any) => s.type === 'fact').length,
        feelings: snippets.filter((s: any) => s.type === 'feeling').length,
    };

    // Build context for AI
    const thoughtsText = snippets
        .map((s: any) => `[${s.type.toUpperCase()}] ${s.content}`)
        .join('\n');

    // Get cluster info
    const clustersResult = await db.execute(
        'SELECT DISTINCT cluster_label FROM snippets WHERE timestamp >= ? AND timestamp < ? AND cluster_label IS NOT NULL LIMIT 5',
        [dayStart, dayEnd]
    );
    const topClusters = (clustersResult.rows || []).map((r: any) => r.cluster_label).filter(Boolean);

    // Q8B: Get calendar context if connected
    let calendarFacts: CalendarFacts | undefined;
    try {
        const { getCalendarFactsForDelta } = await import('./GoogleCalendarService');
        const { useCalendarStore } = await import('../store/calendarStore');
        
        if (useCalendarStore.getState().status === 'connected') {
            calendarFacts = getCalendarFactsForDelta();
            console.log('[DeltaService] Calendar context added:', calendarFacts);
        }
    } catch (error) {
        console.log('[DeltaService] Calendar not available for Delta');
    }

    // Generate summary with AI (pass GFF counts + calendar for context)
    const aiResult = await callDeepSeekDelta(thoughtsText, gffCounts, calendarFacts);

    if (!aiResult) {
        console.warn('[DeltaService] AI generation failed');
        return null;
    }

    // Store in database
    const now = Date.now();
    const insertResult = await db.execute(
        `INSERT INTO daily_deltas (date, summary, highlights, mood, node_count, top_clusters, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            dateStr,
            aiResult.summary,
            JSON.stringify(aiResult.highlights),
            aiResult.mood,
            snippets.length,
            JSON.stringify(topClusters),
            now
        ]
    );

    return {
        id: insertResult.insertId!,
        date: dateStr,
        summary: aiResult.summary,
        highlights: aiResult.highlights,
        mood: aiResult.mood,
        nodeCount: snippets.length,
        topClusters,
        createdAt: now
    };
}

/**
 * Get recent deltas for display
 */
export async function getRecentDeltas(limit: number = 7): Promise<DailyDelta[]> {
    if (!isDatabaseReady()) return [];

    const db = await getDb();
    const result = await db.execute(
        'SELECT * FROM daily_deltas ORDER BY date DESC LIMIT ?',
        [limit]
    );

    return (result.rows || []).map(rowToDelta);
}

/**
 * Get delta for a specific date
 */
export async function getDeltaForDate(date: Date): Promise<DailyDelta | null> {
    if (!isDatabaseReady()) return null;

    const db = await getDb();
    const dateStr = formatDateKey(date);

    const result = await db.execute(
        'SELECT * FROM daily_deltas WHERE date = ?',
        [dateStr]
    );

    if (result.rows && result.rows.length > 0) {
        return rowToDelta(result.rows[0]);
    }

    return null;
}

/**
 * Generate delta for yesterday (common use case)
 */
export async function generateYesterdayDelta(): Promise<DailyDelta | null> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return generateDelta(yesterday);
}

// --- Internal Helpers ---

type MoodType = 'analytical' | 'reflective' | 'creative' | 'mixed';

interface CalendarFacts {
    totalEvents: number;
    nextEvent: { title: string; startsIn: number } | null;
    busyHours: number;
    hasMorningFree: boolean;
}

async function callDeepSeekDelta(
    thoughts: string,
    gffCounts?: { goals: number; facts: number; feelings: number },
    calendarFacts?: CalendarFacts
): Promise<{ summary: string; highlights: string[]; mood: MoodType; gffBreakdown?: any } | null> {
    try {
        const apiKey = await getDeepSeekKey();
        if (!apiKey) {
            console.warn('[DeltaService] No DeepSeek API key');
            return null;
        }

        const gffContext = gffCounts
            ? `\n\n[GFF COUNTS] Goals: ${gffCounts.goals}, Facts: ${gffCounts.facts}, Feelings: ${gffCounts.feelings}`
            : '';

        // Q8B: Add calendar context for smarter Delta generation
        let calendarContext = '';
        if (calendarFacts) {
            const parts = [];
            parts.push(`Termine heute: ${calendarFacts.totalEvents}`);
            parts.push(`Geblockte Stunden: ${calendarFacts.busyHours}h`);
            parts.push(`Vormittag frei: ${calendarFacts.hasMorningFree ? 'Ja' : 'Nein'}`);
            
            if (calendarFacts.nextEvent) {
                parts.push(`Nächster Termin: "${calendarFacts.nextEvent.title}" in ${calendarFacts.nextEvent.startsIn} Minuten`);
            }
            
            calendarContext = `\n\n[KALENDER KONTEXT] ${parts.join(' | ')}`;
        }

        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: DELTA_PROMPT },
                    { role: 'user', content: `Here are the thoughts from yesterday:${gffContext}${calendarContext}\n\n${thoughts}` }
                ],
                temperature: 0.7,
                max_tokens: 500
            }),
        });

        if (!response.ok) {
            console.error('[DeltaService] API error:', await response.text());
            return null;
        }

        const result = await response.json();
        const content = result.choices?.[0]?.message?.content || '';

        // Parse JSON response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.warn('[DeltaService] No JSON in response');
            return null;
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const validMoods: MoodType[] = ['analytical', 'reflective', 'creative', 'mixed'];
        const mood: MoodType = validMoods.includes(parsed.mood) ? parsed.mood : 'mixed';

        return {
            summary: parsed.summary || 'No summary available.',
            highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
            mood,
            gffBreakdown: parsed.gffBreakdown || undefined
        };
    } catch (error) {
        console.error('[DeltaService] Generation error:', error);
        return null;
    }
}

function formatDateKey(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

function getStartOfDay(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

function rowToDelta(row: any): DailyDelta {
    return {
        id: row.id,
        date: row.date,
        summary: row.summary,
        highlights: JSON.parse(row.highlights || '[]'),
        mood: row.mood,
        nodeCount: row.node_count,
        topClusters: JSON.parse(row.top_clusters || '[]'),
        createdAt: row.created_at
    };
}
