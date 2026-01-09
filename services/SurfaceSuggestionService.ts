/**
 * 🌊 Surface Suggestion Service — Proactive Context Bubbling
 * 
 * Surfaces relevant thoughts for user attention based on heuristics:
 * - Stale Goals: importance > 0.8 AND last_update > 7 days
 * - Active Feelings: sentiment = 'friction' AND timestamp < 24h
 * - Key Facts: high connection count AND recently accessed
 * 
 * UI: 2-3 glass-morphism cards above Neural Orb
 * Action: Tap starts new session with pre-filled context
 */

import { getAllSnippets, getDb, isDatabaseReady } from '@/db';
import type { Snippet } from '@/db/schema';

// ============================================================================
// TYPES
// ============================================================================

export interface SurfaceSuggestion {
  id: number;
  type: 'stale-goal' | 'active-feeling' | 'key-fact';
  snippet: Snippet;
  reason: string;
  promptHint: string; // Pre-filled context for new session
  priority: number; // 0-1, higher = more important
}

// ============================================================================
// HEURISTICS CONFIG
// ============================================================================

const HEURISTICS = {
  staleGoal: {
    maxAgeDays: 7, // Goals not mentioned in 7+ days
    minImportance: 0.5,
  },
  activeFeeling: {
    maxAgeHours: 48, // Feelings from last 48 hours
    negativeSentiments: ['friction', 'analytical'], // Needs reflection
  },
  keyFact: {
    minConnections: 2, // High connectivity
    maxAgeDays: 14,
  },
};

// ============================================================================
// MAIN SERVICE
// ============================================================================

/**
 * Get surface suggestions based on user's thought patterns
 */
export async function getSurfaceSuggestions(limit: number = 3): Promise<SurfaceSuggestion[]> {
  if (!isDatabaseReady()) return [];

  try {
    const snippets = await getAllSnippets();
    const suggestions: SurfaceSuggestion[] = [];
    const now = Date.now();

    // ================================================================
    // HEURISTIC 1: Stale Goals
    // ================================================================
    const goals = snippets.filter(s => s.type === 'goal');
    const staleGoals = goals.filter(s => {
      const ageInDays = (now - s.timestamp) / (1000 * 60 * 60 * 24);
      const importance = s.importance ?? 0;
      return ageInDays >= HEURISTICS.staleGoal.maxAgeDays && 
             importance >= HEURISTICS.staleGoal.minImportance;
    });

    for (const goal of staleGoals.slice(0, 2)) {
      const ageInDays = Math.floor((now - goal.timestamp) / (1000 * 60 * 60 * 24));
      suggestions.push({
        id: goal.id,
        type: 'stale-goal',
        snippet: goal,
        reason: `Haven't mentioned in ${ageInDays} days`,
        promptHint: `You set a goal: "${goal.content.slice(0, 50)}..." — Are you still working on this?`,
        priority: 0.9 - (ageInDays / 30), // Higher priority for more recent stale goals
      });
    }

    // ================================================================
    // HEURISTIC 2: Active Feelings (Friction/Needs Attention)
    // ================================================================
    const feelings = snippets.filter(s => s.type === 'feeling');
    const activeFeelings = feelings.filter(s => {
      const ageInHours = (now - s.timestamp) / (1000 * 60 * 60);
      const sentiment = s.sentiment || 'neutral';
      const hashtags = s.hashtags || '';
      
      // Check for friction signals
      const hasFriction = hashtags.includes('#friction') || 
                          hashtags.includes('#energy-low') ||
                          hashtags.includes('#burnout') ||
                          hashtags.includes('#anxiety');
      
      return ageInHours <= HEURISTICS.activeFeeling.maxAgeHours && hasFriction;
    });

    for (const feeling of activeFeelings.slice(0, 1)) {
      const ageInHours = Math.floor((now - feeling.timestamp) / (1000 * 60 * 60));
      suggestions.push({
        id: feeling.id,
        type: 'active-feeling',
        snippet: feeling,
        reason: ageInHours < 24 ? 'Recent friction' : 'Still processing',
        promptHint: `You mentioned: "${feeling.content.slice(0, 50)}..." — Want to talk about this?`,
        priority: 0.95, // High priority for emotional states
      });
    }

    // ================================================================
    // HEURISTIC 3: Key Facts (High Connectivity)
    // ================================================================
    const facts = snippets.filter(s => s.type === 'fact');
    
    // Get connection counts from semantic_edges
    const db = getDb();
    const edgeCounts = await db.execute(`
      SELECT source_id, COUNT(*) as connections 
      FROM semantic_edges 
      GROUP BY source_id 
      HAVING connections >= ?
    `, [HEURISTICS.keyFact.minConnections]);

    const highConnectivityIds = new Set(
      (edgeCounts.rows || []).map((r: any) => r.source_id)
    );

    const keyFacts = facts.filter(s => {
      const ageInDays = (now - s.timestamp) / (1000 * 60 * 60 * 24);
      return highConnectivityIds.has(s.id) && ageInDays <= HEURISTICS.keyFact.maxAgeDays;
    });

    for (const fact of keyFacts.slice(0, 1)) {
      suggestions.push({
        id: fact.id,
        type: 'key-fact',
        snippet: fact,
        reason: 'Connected to multiple thoughts',
        promptHint: `Key insight: "${fact.content.slice(0, 50)}..." — Relevant to today?`,
        priority: 0.7,
      });
    }

    // ================================================================
    // FALLBACK: Recent High-Importance Items
    // ================================================================
    if (suggestions.length < limit) {
      const recentImportant = snippets
        .filter(s => (s.importance ?? 0) > 0.5)
        .filter(s => !suggestions.some(sug => sug.id === s.id))
        .slice(0, limit - suggestions.length);

      for (const item of recentImportant) {
        const typeLabel = item.type === 'goal' ? 'Goal' : item.type === 'feeling' ? 'Feeling' : 'Fact';
        suggestions.push({
          id: item.id,
          type: item.type === 'goal' ? 'stale-goal' : item.type === 'feeling' ? 'active-feeling' : 'key-fact',
          snippet: item,
          reason: 'Marked as important',
          promptHint: `${typeLabel}: "${item.content.slice(0, 50)}..."`,
          priority: 0.5,
        });
      }
    }

    // Sort by priority and limit
    return suggestions
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit);

  } catch (error) {
    console.error('[SurfaceSuggestion] Error:', error);
    return [];
  }
}

/**
 * Get suggestion icon based on type
 */
export function getSuggestionIcon(type: SurfaceSuggestion['type']): string {
  switch (type) {
    case 'stale-goal': return 'flag-outline';
    case 'active-feeling': return 'heart-outline';
    case 'key-fact': return 'bulb-outline';
    default: return 'sparkles-outline';
  }
}

/**
 * Get suggestion color based on type
 */
export function getSuggestionColor(type: SurfaceSuggestion['type']): string {
  switch (type) {
    case 'stale-goal': return '#ffd54f';
    case 'active-feeling': return '#ff1f6d';
    case 'key-fact': return '#08d0ff';
    default: return '#818cf8';
  }
}
