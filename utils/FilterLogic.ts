/**
 * FilterLogic.ts - SQL-Based Multi-Filter for Chronicle Screen
 * 
 * Optimized for <50ms query time with 500+ snippets.
 * Supports GFF intersection, date-range, hashtag-matching, and importance filtering.
 * 
 * Design Philosophy:
 * - All heavy lifting happens in SQLite (native speed)
 * - JavaScript only for query construction and post-processing
 * - Hybrid scoring: 0.7 * semantic relevance + 0.3 * type match
 */

import type { Snippet } from '../db/schema';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export type GFFType = 'goal' | 'feeling' | 'fact';

export type DatePreset = 'today' | 'week' | 'month' | 'all';

export interface ChronicleFilters {
  /** Selected GFF types (empty = all) */
  types: GFFType[];
  
  /** Selected hashtags for intersection */
  hashtags: string[];
  
  /** Temporal preset */
  datePreset: DatePreset;
  
  /** Custom date range (overrides datePreset if set) */
  customDateRange?: {
    start: number; // Unix timestamp
    end: number;   // Unix timestamp
  };
  
  /** Only show starred/important items */
  importanceOnly: boolean;
  
  /** Minimum importance threshold (0.0 - 1.0) */
  minImportance?: number;
  
  /** Search query for content/topic matching */
  searchQuery?: string;
  
  /** Conversation ID filter (for session-based filtering) */
  conversationId?: number;
}

export interface FilteredResult {
  snippet: Snippet;
  /** Match score for hybrid ranking (0-1) */
  matchScore: number;
  /** Whether this is a "soft match" (semantically related but not exact type match) */
  isSoftMatch: boolean;
}

export interface SQLQuery {
  sql: string;
  params: (string | number)[];
}

// =============================================================================
// DATE RANGE HELPERS
// =============================================================================

/**
 * Get timestamp boundaries for date presets
 * All times are in milliseconds (JavaScript Date.now() format)
 */
export function getDateRange(preset: DatePreset): { start: number; end: number } {
  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  switch (preset) {
    case 'today':
      return { start: startOfDay.getTime(), end: now };
    
    case 'week': {
      const weekAgo = new Date(startOfDay);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { start: weekAgo.getTime(), end: now };
    }
    
    case 'month': {
      const monthAgo = new Date(startOfDay);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return { start: monthAgo.getTime(), end: now };
    }
    
    case 'all':
    default:
      return { start: 0, end: now };
  }
}

/**
 * Human-readable date preset labels (German)
 */
export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Heute',
  week: 'Woche',
  month: 'Monat',
  all: 'Alle',
};

// =============================================================================
// SQL QUERY BUILDER
// =============================================================================

/**
 * Build optimized WHERE clause for Chronicle filtering
 * 
 * Performance Strategy:
 * 1. Index-backed columns first (type, timestamp)
 * 2. Range scans before LIKE patterns
 * 3. Parameterized queries for SQLite query cache hits
 * 
 * @returns SQL query string and parameter array for prepared statement
 */
export function buildWhereClause(filters: ChronicleFilters): SQLQuery {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  
  // ==========================================================================
  // 1. GFF TYPE FILTER (Index: idx_snippets_type)
  // ==========================================================================
  if (filters.types.length > 0 && filters.types.length < 3) {
    // Use IN clause for multi-select (optimized by SQLite)
    const placeholders = filters.types.map(() => '?').join(', ');
    conditions.push(`type IN (${placeholders})`);
    params.push(...filters.types);
  }
  // Note: If all 3 types selected or empty, we skip this filter (show all)
  
  // ==========================================================================
  // 2. DATE RANGE FILTER (Uses timestamp index scan)
  // ==========================================================================
  const dateRange = filters.customDateRange ?? getDateRange(filters.datePreset);
  
  if (dateRange.start > 0) {
    conditions.push('timestamp >= ?');
    params.push(dateRange.start);
  }
  
  if (dateRange.end < Date.now()) {
    conditions.push('timestamp <= ?');
    params.push(dateRange.end);
  }
  
  // ==========================================================================
  // 3. IMPORTANCE FILTER
  // ==========================================================================
  if (filters.importanceOnly) {
    // "Starred" items have importance >= 0.8 (adjustable threshold)
    conditions.push('importance >= ?');
    params.push(filters.minImportance ?? 0.8);
  } else if (filters.minImportance !== undefined) {
    conditions.push('importance >= ?');
    params.push(filters.minImportance);
  }
  
  // ==========================================================================
  // 4. HASHTAG FILTER (LIKE-based, least performant - last in chain)
  // ==========================================================================
  if (filters.hashtags.length > 0) {
    // Each hashtag uses LIKE with wildcards
    // SQLite will use full table scan, but post-index-filter this is acceptable
    const hashtagConditions = filters.hashtags.map(() => 'hashtags LIKE ?');
    
    // INTERSECTION: All hashtags must match (AND)
    conditions.push(`(${hashtagConditions.join(' AND ')})`);
    
    // Add % wildcards for substring matching
    filters.hashtags.forEach(tag => {
      // Normalize: ensure # prefix and wrap with wildcards
      const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;
      params.push(`%${normalizedTag}%`);
    });
  }
  
  // ==========================================================================
  // 5. SEARCH QUERY (Content + Topic LIKE)
  // ==========================================================================
  if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
    const query = filters.searchQuery.trim();
    
    // Search in both content and topic columns
    conditions.push('(content LIKE ? OR topic LIKE ?)');
    params.push(`%${query}%`, `%${query}%`);
  }
  
  // ==========================================================================
  // 6. CONVERSATION ID FILTER (Exact match, very fast)
  // ==========================================================================
  if (filters.conversationId !== undefined) {
    conditions.push('conversation_id = ?');
    params.push(filters.conversationId);
  }
  
  // ==========================================================================
  // BUILD FINAL SQL
  // ==========================================================================
  const whereClause = conditions.length > 0 
    ? `WHERE ${conditions.join(' AND ')}` 
    : '';
  
  const sql = `
    SELECT * FROM snippets
    ${whereClause}
    ORDER BY timestamp DESC
  `.trim();
  
  return { sql, params };
}

/**
 * Build a lightweight COUNT query for filter preview
 * Shows "X Ergebnisse" before executing full query
 */
export function buildCountQuery(filters: ChronicleFilters): SQLQuery {
  const { sql, params } = buildWhereClause(filters);
  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
  return { sql: countSql, params };
}

// =============================================================================
// HASHTAG EXTRACTION & AGGREGATION
// =============================================================================

/**
 * Extract all unique hashtags from a set of snippets
 * Returns sorted by frequency (most used first)
 */
export function extractHashtagFrequencies(snippets: Snippet[]): Map<string, number> {
  const frequencies = new Map<string, number>();
  
  snippets.forEach(snippet => {
    if (!snippet.hashtags) return;
    
    // Parse hashtags (comma or space separated)
    const tags = snippet.hashtags
      .split(/[,\s]+/)
      .filter(tag => tag.startsWith('#') && tag.length > 1);
    
    tags.forEach(tag => {
      const normalized = tag.toLowerCase();
      frequencies.set(normalized, (frequencies.get(normalized) ?? 0) + 1);
    });
  });
  
  return frequencies;
}

/**
 * Get top N hashtags sorted by frequency
 */
export function getTopHashtags(snippets: Snippet[], limit: number = 6): string[] {
  const frequencies = extractHashtagFrequencies(snippets);
  
  return Array.from(frequencies.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

/**
 * SQL query to get hashtag frequencies directly from DB (more efficient for large datasets)
 */
export function buildHashtagAggregationQuery(datePreset: DatePreset = 'all'): SQLQuery {
  const dateRange = getDateRange(datePreset);
  
  // Note: This requires post-processing in JavaScript since SQLite doesn't have native array functions
  // But we minimize data transfer by only selecting hashtags column
  const sql = `
    SELECT hashtags FROM snippets
    WHERE hashtags IS NOT NULL AND hashtags != ''
    ${dateRange.start > 0 ? 'AND timestamp >= ?' : ''}
  `.trim();
  
  const params: number[] = dateRange.start > 0 ? [dateRange.start] : [];
  
  return { sql, params };
}

// =============================================================================
// HYBRID SCORING (Semantic + Type Match)
// =============================================================================

/**
 * Calculate hybrid match score for a snippet
 * 
 * Formula: 0.7 * semanticScore + 0.3 * typeMatchScore
 * 
 * @param snippet - The snippet to score
 * @param filters - Current filter settings
 * @param semanticScore - Optional semantic similarity score (0-1) from vector search
 */
export function calculateHybridScore(
  snippet: Snippet,
  filters: ChronicleFilters,
  semanticScore: number = 1.0
): { score: number; isSoftMatch: boolean } {
  // Type match: 1.0 if type is in filter list (or filter is empty), 0.3 if not
  const typeMatch = filters.types.length === 0 || 
    filters.types.includes(snippet.type as GFFType)
    ? 1.0 
    : 0.3;
  
  // Hashtag match bonus: +0.1 per matching hashtag (up to 0.3 max)
  let hashtagBonus = 0;
  if (filters.hashtags.length > 0 && snippet.hashtags) {
    const snippetTags = snippet.hashtags.toLowerCase().split(/[,\s]+/);
    const matchCount = filters.hashtags.filter(tag => 
      snippetTags.includes(tag.toLowerCase())
    ).length;
    hashtagBonus = Math.min(matchCount * 0.1, 0.3);
  }
  
  // Importance boost: High importance items get a small boost
  const importanceBoost = (snippet.importance ?? 0.5) * 0.1;
  
  // Final hybrid score
  const score = Math.min(
    1.0,
    (0.7 * semanticScore) + (0.3 * typeMatch) + hashtagBonus + importanceBoost
  );
  
  // Soft match: Type doesn't match but semantic/hashtag relevance is high
  const isSoftMatch = typeMatch < 1.0 && (semanticScore > 0.6 || hashtagBonus > 0);
  
  return { score, isSoftMatch };
}

/**
 * Sort and rank filtered results by hybrid score
 */
export function rankByHybridScore(
  snippets: Snippet[],
  filters: ChronicleFilters,
  semanticScores?: Map<number, number>
): FilteredResult[] {
  return snippets
    .map(snippet => {
      const semanticScore = semanticScores?.get(snippet.id) ?? 1.0;
      const { score, isSoftMatch } = calculateHybridScore(snippet, filters, semanticScore);
      return { snippet, matchScore: score, isSoftMatch };
    })
    .sort((a, b) => {
      // Primary: Score descending
      if (b.matchScore !== a.matchScore) {
        return b.matchScore - a.matchScore;
      }
      // Secondary: Timestamp descending (newer first)
      return b.snippet.timestamp - a.snippet.timestamp;
    });
}

// =============================================================================
// EMPTY STATE SUGGESTIONS
// =============================================================================

export interface EmptyStateSuggestion {
  type: 'broaden_types' | 'extend_date' | 'remove_hashtags' | 'similar_content';
  label: string;
  action: Partial<ChronicleFilters>;
}

/**
 * Generate intelligent suggestions when filter returns empty results
 */
export function generateEmptyStateSuggestions(
  filters: ChronicleFilters,
  totalSnippetCount: number
): EmptyStateSuggestion[] {
  const suggestions: EmptyStateSuggestion[] = [];
  
  // If no snippets at all
  if (totalSnippetCount === 0) {
    return [{
      type: 'similar_content',
      label: 'Starte eine Konversation, um Gedanken zu sammeln',
      action: {}
    }];
  }
  
  // Suggest broadening GFF types
  if (filters.types.length > 0 && filters.types.length < 3) {
    const missingTypes = (['goal', 'feeling', 'fact'] as GFFType[])
      .filter(t => !filters.types.includes(t));
    
    suggestions.push({
      type: 'broaden_types',
      label: `Auch ${missingTypes.map(t => t === 'goal' ? 'Ziele' : t === 'feeling' ? 'Gefühle' : 'Fakten').join(' & ')} anzeigen`,
      action: { types: [] }
    });
  }
  
  // Suggest extending date range
  if (filters.datePreset !== 'all' && !filters.customDateRange) {
    const nextPreset: Record<DatePreset, DatePreset> = {
      today: 'week',
      week: 'month',
      month: 'all',
      all: 'all'
    };
    
    suggestions.push({
      type: 'extend_date',
      label: `Zeitraum auf "${DATE_PRESET_LABELS[nextPreset[filters.datePreset]]}" erweitern`,
      action: { datePreset: nextPreset[filters.datePreset] }
    });
  }
  
  // Suggest removing hashtag filter
  if (filters.hashtags.length > 0) {
    suggestions.push({
      type: 'remove_hashtags',
      label: `Filter "${filters.hashtags[0]}" entfernen`,
      action: { hashtags: filters.hashtags.slice(1) }
    });
  }
  
  // Suggest removing importance filter
  if (filters.importanceOnly) {
    suggestions.push({
      type: 'broaden_types',
      label: 'Alle Einträge anzeigen (nicht nur wichtige)',
      action: { importanceOnly: false }
    });
  }
  
  return suggestions.slice(0, 3); // Max 3 suggestions
}

// =============================================================================
// DEFAULT FILTER STATE
// =============================================================================

export const DEFAULT_CHRONICLE_FILTERS: ChronicleFilters = {
  types: [],
  hashtags: [],
  datePreset: 'all',
  importanceOnly: false,
  searchQuery: '',
};

/**
 * Check if filters are at default state (no active filtering)
 */
export function isDefaultFilters(filters: ChronicleFilters): boolean {
  return (
    filters.types.length === 0 &&
    filters.hashtags.length === 0 &&
    filters.datePreset === 'all' &&
    !filters.importanceOnly &&
    !filters.searchQuery &&
    !filters.customDateRange &&
    filters.conversationId === undefined
  );
}

/**
 * Get human-readable description of active filters (German)
 */
export function getFilterDescription(filters: ChronicleFilters): string {
  const parts: string[] = [];
  
  if (filters.types.length > 0) {
    const typeLabels = filters.types.map(t => 
      t === 'goal' ? 'Ziele' : t === 'feeling' ? 'Gefühle' : 'Fakten'
    );
    parts.push(typeLabels.join(' & '));
  }
  
  if (filters.datePreset !== 'all') {
    parts.push(DATE_PRESET_LABELS[filters.datePreset]);
  }
  
  if (filters.hashtags.length > 0) {
    parts.push(filters.hashtags.slice(0, 2).join(', ') + 
      (filters.hashtags.length > 2 ? ` +${filters.hashtags.length - 2}` : ''));
  }
  
  if (filters.importanceOnly) {
    parts.push('★ Wichtig');
  }
  
  return parts.length > 0 ? parts.join(' · ') : 'Alle Gedanken';
}
