/**
 * useFilteredSnippets Hook - SQL-Based Chronicle Filtering
 * 
 * Executes filtered queries directly in SQLite for <50ms performance.
 * Integrates with ChronicleStore for reactive filter updates.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDb } from '../db';
import type { Snippet } from '../db/schema';
import { useChronicleFilters, useChronicleStore } from '../store/chronicleStore';
import {
    buildCountQuery,
    buildWhereClause,
    generateEmptyStateSuggestions,
    getTopHashtags,
    rankByHybridScore,
    type ChronicleFilters,
    type EmptyStateSuggestion,
    type FilteredResult
} from '../utils/FilterLogic';

// =============================================================================
// TYPES
// =============================================================================

interface UseFilteredSnippetsResult {
  /** Filtered and ranked snippets */
  results: FilteredResult[];
  
  /** Raw snippets (without ranking) */
  snippets: Snippet[];
  
  /** Total count of filtered results */
  count: number;
  
  /** Is loading results */
  isLoading: boolean;
  
  /** Error message if query failed */
  error: string | null;
  
  /** Suggestions when results are empty */
  emptySuggestions: EmptyStateSuggestion[];
  
  /** Top hashtags in current result set */
  topHashtags: string[];
  
  /** Total snippet count in database (for empty state context) */
  totalCount: number;
  
  /** Manually trigger refresh */
  refresh: () => Promise<void>;
  
  /** Query execution time in ms */
  queryTimeMs: number;
}

// =============================================================================
// DEBOUNCE HELPER
// =============================================================================

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
}

// =============================================================================
// MAIN HOOK
// =============================================================================

export function useFilteredSnippets(
  /** Optional external filters (overrides store) */
  externalFilters?: ChronicleFilters,
  /** Debounce delay for search queries (ms) */
  searchDebounceMs: number = 300
): UseFilteredSnippetsResult {
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  
  const [results, setResults] = useState<FilteredResult[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [count, setCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topHashtags, setTopHashtags] = useState<string[]>([]);
  const [queryTimeMs, setQueryTimeMs] = useState(0);
  
  // Store integration
  const storeFilters = useChronicleFilters();
  const setResultCount = useChronicleStore((s) => s.setResultCount);
  const setStoreLoading = useChronicleStore((s) => s.setIsLoading);
  
  // Use external filters if provided, otherwise use store
  const filters = externalFilters ?? storeFilters;
  
  // Debounce search query to avoid excessive queries while typing
  const debouncedSearchQuery = useDebounce(filters.searchQuery ?? '', searchDebounceMs);
  
  // Create stable filter reference for dependencies
  const filtersWithDebouncedSearch = useMemo(() => ({
    ...filters,
    searchQuery: debouncedSearchQuery
  }), [filters, debouncedSearchQuery]);
  
  // Query counter for stale result prevention
  const queryIdRef = useRef(0);
  
  // ---------------------------------------------------------------------------
  // EXECUTE QUERY
  // ---------------------------------------------------------------------------
  
  const executeQuery = useCallback(async (queryFilters: ChronicleFilters) => {
    const currentQueryId = ++queryIdRef.current;
    const startTime = performance.now();
    
    setIsLoading(true);
    setStoreLoading(true);
    setError(null);
    
    try {
      const database = getDb();
      
      // Build SQL query
      const { sql, params } = buildWhereClause(queryFilters);
      
      console.log('[Chronicle] Executing query:', sql, params);
      
      // Execute filtered query
      const result = await database.execute(sql, params);
      const rows = (result.rows as unknown as Snippet[]) || [];
      
      // Check if this query is still relevant (prevent race conditions)
      if (currentQueryId !== queryIdRef.current) {
        console.log('[Chronicle] Stale query result ignored');
        return;
      }
      
      // Get total count for empty state context
      const totalResult = await database.execute('SELECT COUNT(*) as count FROM snippets');
      const total = (totalResult.rows?.[0] as { count: number })?.count ?? 0;
      
      // Rank results with hybrid scoring
      const rankedResults = rankByHybridScore(rows, queryFilters);
      
      // Extract top hashtags from results
      const hashtags = getTopHashtags(rows, 6);
      
      const endTime = performance.now();
      const executionTime = Math.round(endTime - startTime);
      
      console.log(`[Chronicle] Query completed: ${rows.length} results in ${executionTime}ms`);
      
      // Update state
      setSnippets(rows);
      setResults(rankedResults);
      setCount(rows.length);
      setTotalCount(total);
      setTopHashtags(hashtags);
      setQueryTimeMs(executionTime);
      setResultCount(rows.length);
      
    } catch (err) {
      console.error('[Chronicle] Query failed:', err);
      
      if (currentQueryId === queryIdRef.current) {
        setError(err instanceof Error ? err.message : 'Query failed');
        setResults([]);
        setSnippets([]);
        setCount(0);
      }
    } finally {
      if (currentQueryId === queryIdRef.current) {
        setIsLoading(false);
        setStoreLoading(false);
      }
    }
  }, [setResultCount, setStoreLoading]);
  
  // ---------------------------------------------------------------------------
  // EFFECT: Run query when filters change
  // ---------------------------------------------------------------------------
  
  useEffect(() => {
    executeQuery(filtersWithDebouncedSearch);
  }, [filtersWithDebouncedSearch, executeQuery]);
  
  // ---------------------------------------------------------------------------
  // REFRESH HANDLER
  // ---------------------------------------------------------------------------
  
  const refresh = useCallback(async () => {
    await executeQuery(filtersWithDebouncedSearch);
  }, [executeQuery, filtersWithDebouncedSearch]);
  
  // ---------------------------------------------------------------------------
  // EMPTY STATE SUGGESTIONS
  // ---------------------------------------------------------------------------
  
  const emptySuggestions = useMemo(() => {
    if (count > 0) return [];
    return generateEmptyStateSuggestions(filtersWithDebouncedSearch, totalCount);
  }, [count, filtersWithDebouncedSearch, totalCount]);
  
  // ---------------------------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------------------------
  
  return {
    results,
    snippets,
    count,
    isLoading,
    error,
    emptySuggestions,
    topHashtags,
    totalCount,
    refresh,
    queryTimeMs,
  };
}

// =============================================================================
// LIGHTWEIGHT COUNT HOOK (For Preview)
// =============================================================================

/**
 * Hook that only returns count (for filter preview badges)
 * Much lighter than full query
 */
export function useFilterCount(filters: ChronicleFilters): number | null {
  const [count, setCount] = useState<number | null>(null);
  
  // Debounce to avoid excessive queries
  const debouncedFilters = useDebounce(filters, 200);
  
  useEffect(() => {
    let cancelled = false;
    
    const fetchCount = async () => {
      try {
        const database = getDb();
        const { sql, params } = buildCountQuery(debouncedFilters);
        const result = await database.execute(sql, params);
        
        if (!cancelled) {
          const countValue = (result.rows?.[0] as { count: number })?.count ?? 0;
          setCount(countValue);
        }
      } catch (err) {
        console.warn('[Chronicle] Count query failed:', err);
        if (!cancelled) setCount(null);
      }
    };
    
    fetchCount();
    
    return () => { cancelled = true; };
  }, [debouncedFilters]);
  
  return count;
}

// =============================================================================
// HASHTAG AGGREGATION HOOK
// =============================================================================

/**
 * Hook to get all unique hashtags with frequencies
 * For hashtag modal / cloud
 */
export function useAllHashtags(): { 
  hashtags: Array<{ tag: string; count: number }>; 
  isLoading: boolean;
} {
  const [hashtags, setHashtags] = useState<Array<{ tag: string; count: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    let cancelled = false;
    
    const fetchHashtags = async () => {
      try {
        const database = getDb();
        const result = await database.execute(
          "SELECT hashtags FROM snippets WHERE hashtags IS NOT NULL AND hashtags != ''"
        );
        
        if (cancelled) return;
        
        // Aggregate hashtags in JavaScript
        const frequencies = new Map<string, number>();
        
        const rows = (result.rows || []) as unknown as Array<{ hashtags: string }>;
        rows.forEach((row) => {
          if (!row.hashtags) return;
          
          const tags = row.hashtags
            .split(/[,\s]+/)
            .filter(tag => tag.startsWith('#') && tag.length > 1);
          
          tags.forEach(tag => {
            const normalized = tag.toLowerCase();
            frequencies.set(normalized, (frequencies.get(normalized) ?? 0) + 1);
          });
        });
        
        // Convert to sorted array
        const sorted = Array.from(frequencies.entries())
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count);
        
        setHashtags(sorted);
      } catch (err) {
        console.warn('[Chronicle] Hashtag aggregation failed:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    
    fetchHashtags();
    
    return () => { cancelled = true; };
  }, []);
  
  return { hashtags, isLoading };
}

// =============================================================================
// CONVERSATION SNIPPETS HOOK
// =============================================================================

/**
 * Get snippets for a specific conversation (for session view)
 */
export function useConversationSnippets(conversationId: number | null): {
  snippets: Snippet[];
  isLoading: boolean;
} {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (conversationId === null) {
      setSnippets([]);
      setIsLoading(false);
      return;
    }
    
    let cancelled = false;
    
    const fetchSnippets = async () => {
      try {
        const database = getDb();
        const result = await database.execute(
          'SELECT * FROM snippets WHERE conversation_id = ? ORDER BY timestamp ASC',
          [conversationId]
        );
        
        if (!cancelled) {
          setSnippets((result.rows as unknown as Snippet[]) || []);
        }
      } catch (err) {
        console.warn('[Chronicle] Conversation snippets query failed:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    
    setIsLoading(true);
    fetchSnippets();
    
    return () => { cancelled = true; };
  }, [conversationId]);
  
  return { snippets, isLoading };
}
