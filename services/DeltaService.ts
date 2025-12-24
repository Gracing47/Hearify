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
}

const DELTA_PROMPT = `You are an intelligent reflection engine for a personal memory app.

Given the user's thoughts from the past 24 hours, generate a brief morning reflection.

REQUIREMENTS:
1. Write a 2-3 sentence summary capturing the main theme or focus
2. Identify 2-4 key highlights (short phrases)
3. Determine the overall mood: analytical, reflective, creative, or mixed
4. If no meaningful patterns exist, acknowledge this gracefully

RESPONSE FORMAT (strict JSON):
{
  "summary": "Your personalized summary here...",
  "highlights": ["highlight 1", "highlight 2"],
  "mood": "reflective"
}

Be warm, concise, and insightful. No fluff.`;

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

    // Generate summary with AI
    const aiResult = await callDeepSeekDelta(thoughtsText);

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

async function callDeepSeekDelta(thoughts: string): Promise<{ summary: string; highlights: string[]; mood: MoodType } | null> {
    try {
        const apiKey = await getDeepSeekKey();
        if (!apiKey) {
            console.warn('[DeltaService] No DeepSeek API key');
            return null;
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
                    { role: 'user', content: `Here are the thoughts from yesterday:\n\n${thoughts}` }
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
            mood
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
