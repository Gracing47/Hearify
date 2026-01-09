/**
 * ChronicleStore - Zustand Store for Chronicle Filter Persistence
 * 
 * Persists filter state across app restarts using SecureStore.
 * Provides reactive hooks for UI components.
 */

import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';
import type { BatchContext } from '../services/BatchSynthesisService';
import type { ChronicleFilters, DatePreset, EmptyStateSuggestion, GFFType } from '../utils/FilterLogic';
import { DEFAULT_CHRONICLE_FILTERS, getFilterDescription, isDefaultFilters } from '../utils/FilterLogic';

// SecureStore adapter for Zustand persistence
const secureStoreAdapter: StateStorage = {
  getItem: async (name: string) => {
    const value = await SecureStore.getItemAsync(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string) => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string) => {
    await SecureStore.deleteItemAsync(name);
  },
};

// =============================================================================
// STORE STATE INTERFACE
// =============================================================================

interface ChronicleState {
  // =========================================================================
  // FILTER STATE
  // =========================================================================
  
  /** Current active filters */
  filters: ChronicleFilters;
  
  /** Recent hashtags for quick access (last 10 used) */
  recentHashtags: string[];
  
  /** Favorite/pinned hashtags */
  pinnedHashtags: string[];
  
  /** Search history for autocomplete (last 5 searches) */
  searchHistory: string[];
  
  // =========================================================================
  // MULTI-SELECT STATE (Phase 6: Batch Synthesis)
  // =========================================================================
  
  /** Is multi-select mode active? */
  isSelectionMode: boolean;
  
  /** Set of selected snippet IDs (max 10) */
  selectedSnippetIds: Set<number>;
  
  /** Selection limit (Miller's Law: 7±2, we use 10 for safety) */
  selectionLimit: number;
  
  /** Pending batch reflect payload (passed to Orbit) */
  pendingBatchReflect: {
    context: BatchContext;
    systemPrompt: string;
    userMessage: string;
    disconnectionWarning?: string;
  } | null;
  
  // =========================================================================
  // UI STATE
  // =========================================================================
  
  /** Is the filter panel expanded? */
  isPanelExpanded: boolean;
  
  /** Is the hashtag modal visible? */
  isHashtagModalVisible: boolean;
  
  /** Is the date picker modal visible? */
  isDatePickerVisible: boolean;
  
  /** Current result count (for preview) */
  resultCount: number | null;
  
  /** Is currently loading filtered results? */
  isLoading: boolean;
  
  // =========================================================================
  // ACTIONS
  // =========================================================================
  
  // Filter Actions
  setTypes: (types: GFFType[]) => void;
  toggleType: (type: GFFType) => void;
  setDatePreset: (preset: DatePreset) => void;
  setCustomDateRange: (start: number, end: number) => void;
  clearCustomDateRange: () => void;
  toggleImportanceOnly: () => void;
  setSearchQuery: (query: string) => void;
  addHashtag: (tag: string) => void;
  removeHashtag: (tag: string) => void;
  clearHashtags: () => void;
  setConversationId: (id: number | undefined) => void;
  resetFilters: () => void;
  applyFilterSuggestion: (suggestion: EmptyStateSuggestion) => void;
  
  // Multi-Select Actions (Phase 6)
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;
  toggleSnippetSelection: (snippetId: number) => boolean; // Returns success
  selectSnippet: (snippetId: number) => boolean;
  deselectSnippet: (snippetId: number) => void;
  clearSelection: () => void;
  isSnippetSelected: (snippetId: number) => boolean;
  getSelectedCount: () => number;
  canSelectMore: () => boolean;
  setPendingBatchReflect: (payload: ChronicleState['pendingBatchReflect']) => void;
  clearPendingBatchReflect: () => void;
  
  // UI Actions
  togglePanel: () => void;
  showHashtagModal: () => void;
  hideHashtagModal: () => void;
  showDatePicker: () => void;
  hideDatePicker: () => void;
  setResultCount: (count: number | null) => void;
  setIsLoading: (loading: boolean) => void;
  
  // History Actions
  addToSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;
  pinHashtag: (tag: string) => void;
  unpinHashtag: (tag: string) => void;
  
  // Computed Getters
  getFilterDescription: () => string;
  isDefaultState: () => boolean;
  getActiveFilterCount: () => number;
}

// =============================================================================
// STORE IMPLEMENTATION
// =============================================================================

export const useChronicleStore = create<ChronicleState>()(
  persist(
    (set, get) => ({
      // =========================================================================
      // INITIAL STATE
      // =========================================================================
      
      filters: { ...DEFAULT_CHRONICLE_FILTERS },
      recentHashtags: [],
      pinnedHashtags: [],
      searchHistory: [],
      
      // Multi-Select State (Phase 6)
      isSelectionMode: false,
      selectedSnippetIds: new Set<number>(),
      selectionLimit: 10, // Miller's Law: 7±2
      pendingBatchReflect: null,
      
      // UI State
      isPanelExpanded: true,
      isHashtagModalVisible: false,
      isDatePickerVisible: false,
      resultCount: null,
      isLoading: false,
      
      // =========================================================================
      // MULTI-SELECT ACTIONS (Phase 6: Batch Synthesis)
      // =========================================================================
      
      enterSelectionMode: () => set({ isSelectionMode: true }),
      
      exitSelectionMode: () => set({ 
        isSelectionMode: false, 
        selectedSnippetIds: new Set<number>() 
      }),
      
      toggleSnippetSelection: (snippetId: number) => {
        const { selectedSnippetIds, selectionLimit } = get();
        const newSet = new Set(selectedSnippetIds);
        
        if (newSet.has(snippetId)) {
          newSet.delete(snippetId);
          set({ selectedSnippetIds: newSet });
          return true;
        } else if (newSet.size < selectionLimit) {
          newSet.add(snippetId);
          set({ selectedSnippetIds: newSet, isSelectionMode: true });
          return true;
        }
        return false; // Limit reached
      },
      
      selectSnippet: (snippetId: number) => {
        const { selectedSnippetIds, selectionLimit } = get();
        if (selectedSnippetIds.size >= selectionLimit) return false;
        
        const newSet = new Set(selectedSnippetIds);
        newSet.add(snippetId);
        set({ selectedSnippetIds: newSet, isSelectionMode: true });
        return true;
      },
      
      deselectSnippet: (snippetId: number) => {
        const { selectedSnippetIds } = get();
        const newSet = new Set(selectedSnippetIds);
        newSet.delete(snippetId);
        set({ selectedSnippetIds: newSet });
      },
      
      clearSelection: () => set({ selectedSnippetIds: new Set<number>() }),
      
      isSnippetSelected: (snippetId: number) => get().selectedSnippetIds.has(snippetId),
      
      getSelectedCount: () => get().selectedSnippetIds.size,
      
      canSelectMore: () => get().selectedSnippetIds.size < get().selectionLimit,
      
      setPendingBatchReflect: (payload) => set({ pendingBatchReflect: payload }),
      
      clearPendingBatchReflect: () => set({ pendingBatchReflect: null }),
      
      // =========================================================================
      // FILTER ACTIONS
      // =========================================================================
      
      setTypes: (types) => set((state) => ({
        filters: { ...state.filters, types }
      })),
      
      toggleType: (type) => set((state) => {
        const currentTypes = state.filters.types;
        const newTypes = currentTypes.includes(type)
          ? currentTypes.filter(t => t !== type)
          : [...currentTypes, type];
        return { filters: { ...state.filters, types: newTypes } };
      }),
      
      setDatePreset: (preset) => set((state) => ({
        filters: { 
          ...state.filters, 
          datePreset: preset,
          customDateRange: undefined // Clear custom when preset is selected
        }
      })),
      
      setCustomDateRange: (start, end) => set((state) => ({
        filters: { 
          ...state.filters, 
          customDateRange: { start, end },
          datePreset: 'all' // Reset preset when custom range is set
        }
      })),
      
      clearCustomDateRange: () => set((state) => ({
        filters: { ...state.filters, customDateRange: undefined }
      })),
      
      toggleImportanceOnly: () => set((state) => ({
        filters: { ...state.filters, importanceOnly: !state.filters.importanceOnly }
      })),
      
      setSearchQuery: (query) => set((state) => ({
        filters: { ...state.filters, searchQuery: query }
      })),
      
      addHashtag: (tag) => set((state) => {
        const normalizedTag = tag.startsWith('#') ? tag.toLowerCase() : `#${tag.toLowerCase()}`;
        
        // Don't add duplicates
        if (state.filters.hashtags.includes(normalizedTag)) {
          return state;
        }
        
        // Update recent hashtags
        const newRecentHashtags = [
          normalizedTag,
          ...state.recentHashtags.filter(t => t !== normalizedTag)
        ].slice(0, 10);
        
        return {
          filters: { ...state.filters, hashtags: [...state.filters.hashtags, normalizedTag] },
          recentHashtags: newRecentHashtags
        };
      }),
      
      removeHashtag: (tag) => set((state) => {
        const normalizedTag = tag.startsWith('#') ? tag.toLowerCase() : `#${tag.toLowerCase()}`;
        return {
          filters: { 
            ...state.filters, 
            hashtags: state.filters.hashtags.filter(t => t !== normalizedTag) 
          }
        };
      }),
      
      clearHashtags: () => set((state) => ({
        filters: { ...state.filters, hashtags: [] }
      })),
      
      setConversationId: (id) => set((state) => ({
        filters: { ...state.filters, conversationId: id }
      })),
      
      resetFilters: () => set({
        filters: { ...DEFAULT_CHRONICLE_FILTERS },
        resultCount: null
      }),
      
      applyFilterSuggestion: (suggestion) => set((state) => ({
        filters: { ...state.filters, ...suggestion.action }
      })),
      
      // =========================================================================
      // UI ACTIONS
      // =========================================================================
      
      togglePanel: () => set((state) => ({
        isPanelExpanded: !state.isPanelExpanded
      })),
      
      showHashtagModal: () => set({ isHashtagModalVisible: true }),
      hideHashtagModal: () => set({ isHashtagModalVisible: false }),
      
      showDatePicker: () => set({ isDatePickerVisible: true }),
      hideDatePicker: () => set({ isDatePickerVisible: false }),
      
      setResultCount: (count) => set({ resultCount: count }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      
      // =========================================================================
      // HISTORY ACTIONS
      // =========================================================================
      
      addToSearchHistory: (query) => set((state) => {
        if (!query.trim()) return state;
        
        const newHistory = [
          query.trim(),
          ...state.searchHistory.filter(q => q !== query.trim())
        ].slice(0, 5);
        
        return { searchHistory: newHistory };
      }),
      
      clearSearchHistory: () => set({ searchHistory: [] }),
      
      pinHashtag: (tag) => set((state) => {
        const normalizedTag = tag.startsWith('#') ? tag.toLowerCase() : `#${tag.toLowerCase()}`;
        if (state.pinnedHashtags.includes(normalizedTag)) return state;
        
        return {
          pinnedHashtags: [...state.pinnedHashtags, normalizedTag].slice(0, 10)
        };
      }),
      
      unpinHashtag: (tag) => set((state) => {
        const normalizedTag = tag.startsWith('#') ? tag.toLowerCase() : `#${tag.toLowerCase()}`;
        return {
          pinnedHashtags: state.pinnedHashtags.filter(t => t !== normalizedTag)
        };
      }),
      
      // =========================================================================
      // COMPUTED GETTERS
      // =========================================================================
      
      getFilterDescription: () => getFilterDescription(get().filters),
      
      isDefaultState: () => isDefaultFilters(get().filters),
      
      getActiveFilterCount: () => {
        const { filters } = get();
        let count = 0;
        
        if (filters.types.length > 0) count++;
        if (filters.hashtags.length > 0) count += filters.hashtags.length;
        if (filters.datePreset !== 'all' || filters.customDateRange) count++;
        if (filters.importanceOnly) count++;
        if (filters.searchQuery && filters.searchQuery.trim()) count++;
        
        return count;
      },
    }),
    {
      name: 'chronicle-filters',
      storage: createJSONStorage(() => secureStoreAdapter),
      // Only persist filter-related state, not UI state
      partialize: (state) => ({
        filters: state.filters,
        recentHashtags: state.recentHashtags,
        pinnedHashtags: state.pinnedHashtags,
        searchHistory: state.searchHistory,
      }),
    }
  )
);

// =============================================================================
// SELECTOR HOOKS (Optimized Re-renders)
// =============================================================================

/** Select only filter state for components that only need filters */
export const useChronicleFilters = () => useChronicleStore((state) => state.filters);

/** Select only GFF types for type pills */
export const useChronicleTypes = () => useChronicleStore((state) => state.filters.types);

/** Select only hashtags for hashtag chips */
export const useChronicleHashtags = () => useChronicleStore((state) => state.filters.hashtags);

/** Select only date preset for date pills */
export const useChronicleDate = () => useChronicleStore((state) => ({
  preset: state.filters.datePreset,
  customRange: state.filters.customDateRange
}));

/** Select only importance filter */
export const useChronicleImportance = () => useChronicleStore((state) => state.filters.importanceOnly);

/** Select search query */
export const useChronicleSearch = () => useChronicleStore((state) => state.filters.searchQuery);

/** Select UI state for panel */
export const useChronicleUI = () => useChronicleStore((state) => ({
  isPanelExpanded: state.isPanelExpanded,
  isHashtagModalVisible: state.isHashtagModalVisible,
  isDatePickerVisible: state.isDatePickerVisible,
  resultCount: state.resultCount,
  isLoading: state.isLoading,
}));

/** Select recent and pinned hashtags for modal */
export const useChronicleHashtagHistory = () => useChronicleStore((state) => ({
  recent: state.recentHashtags,
  pinned: state.pinnedHashtags,
}));

/** Select search history for autocomplete */
export const useChronicleSearchHistory = () => useChronicleStore((state) => state.searchHistory);

// =============================================================================
// ACTION HOOKS (Stable References)
// =============================================================================

/** All filter actions */
export const useChronicleActions = () => useChronicleStore((state) => ({
  setTypes: state.setTypes,
  toggleType: state.toggleType,
  setDatePreset: state.setDatePreset,
  setCustomDateRange: state.setCustomDateRange,
  clearCustomDateRange: state.clearCustomDateRange,
  toggleImportanceOnly: state.toggleImportanceOnly,
  setSearchQuery: state.setSearchQuery,
  addHashtag: state.addHashtag,
  removeHashtag: state.removeHashtag,
  clearHashtags: state.clearHashtags,
  setConversationId: state.setConversationId,
  resetFilters: state.resetFilters,
  applyFilterSuggestion: state.applyFilterSuggestion,
  togglePanel: state.togglePanel,
  showHashtagModal: state.showHashtagModal,
  hideHashtagModal: state.hideHashtagModal,
  showDatePicker: state.showDatePicker,
  hideDatePicker: state.hideDatePicker,
  addToSearchHistory: state.addToSearchHistory,
  pinHashtag: state.pinHashtag,
  unpinHashtag: state.unpinHashtag,
  // Multi-Select Actions (Phase 6)
  enterSelectionMode: state.enterSelectionMode,
  exitSelectionMode: state.exitSelectionMode,
  toggleSnippetSelection: state.toggleSnippetSelection,
  selectSnippet: state.selectSnippet,
  deselectSnippet: state.deselectSnippet,
  clearSelection: state.clearSelection,
}));

// =============================================================================
// MULTI-SELECT SELECTOR HOOKS (Phase 6)
// =============================================================================

/** Select multi-select mode state */
export const useSelectionMode = () => useChronicleStore((state) => state.isSelectionMode);

/** Select selected snippet IDs */
export const useSelectedSnippetIds = () => useChronicleStore((state) => state.selectedSnippetIds);

/** Select selected count */
export const useSelectedCount = () => useChronicleStore((state) => state.selectedSnippetIds.size);

/** Select selection limit */
export const useSelectionLimit = () => useChronicleStore((state) => state.selectionLimit);

/** Check if a specific snippet is selected */
export const useIsSnippetSelected = (snippetId: number) => 
  useChronicleStore((state) => state.selectedSnippetIds.has(snippetId));

/** Select pending batch reflect payload */
export const usePendingBatchReflect = () => useChronicleStore((state) => state.pendingBatchReflect);

/** Multi-select actions only */
export const useSelectionActions = () => useChronicleStore((state) => ({
  enterSelectionMode: state.enterSelectionMode,
  exitSelectionMode: state.exitSelectionMode,
  toggleSnippetSelection: state.toggleSnippetSelection,
  selectSnippet: state.selectSnippet,
  deselectSnippet: state.deselectSnippet,
  clearSelection: state.clearSelection,
  isSnippetSelected: state.isSnippetSelected,
  getSelectedCount: state.getSelectedCount,
  canSelectMore: state.canSelectMore,
  setPendingBatchReflect: state.setPendingBatchReflect,
  clearPendingBatchReflect: state.clearPendingBatchReflect,
}));