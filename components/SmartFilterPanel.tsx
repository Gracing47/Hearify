/**
 * SmartFilterPanel - Chronicle Discovery Panel
 * 
 * Zone-based filter UI with GFF Intent Selectors, Temporal Presets,
 * SearchBar, and Hashtag Cloud following Obsidian Void 2.0 design.
 * 
 * Layout Hierarchy (Top-Down):
 * - Zone A: GFF Intent Selectors (Goal, Feeling, Fact)
 * - Zone B: Temporal & Importance Presets
 * - Zone C: Search & Tag Hub
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { memo, useCallback, useMemo } from 'react';
import {
    Dimensions,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    Layout,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import {
    useChronicleActions,
    useChronicleDate,
    useChronicleFilters,
    useChronicleHashtagHistory,
    useChronicleImportance,
    useChronicleSearch,
    useChronicleTypes,
    useChronicleUI
} from '../store/chronicleStore';
import type { DatePreset, GFFType } from '../utils/FilterLogic';
import { DATE_PRESET_LABELS } from '../utils/FilterLogic';

// =============================================================================
// CONSTANTS
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** GFF Colors matching TYPE_CONFIG from MemoryScreen */
const GFF_COLORS: Record<GFFType, string> = {
  goal: '#ffd54f',
  feeling: '#ff1f6d',
  fact: '#08d0ff',
};

/** GFF Icons (Unicode for performance) */
const GFF_ICONS: Record<GFFType, string> = {
  goal: '◆',
  feeling: '●',
  fact: '⬢',
};

/** GFF Labels (German) */
const GFF_LABELS: Record<GFFType, string> = {
  goal: 'Ziele',
  feeling: 'Gefühle',
  fact: 'Fakten',
};

/** Spring animation config */
const SPRING_CONFIG = {
  damping: 25,
  stiffness: 120,
};

// =============================================================================
// GFF FILTER PILL COMPONENT
// =============================================================================

interface GFFPillProps {
  type: GFFType;
  isActive: boolean;
  onPress: () => void;
}

const GFFPill = memo<GFFPillProps>(({ type, isActive, onPress }) => {
  const scale = useSharedValue(1);
  
  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, SPRING_CONFIG);
  }, [scale]);
  
  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
  }, [scale]);
  
  const handlePress = useCallback(() => {
    Haptics.selectionAsync();
    onPress();
  }, [onPress]);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: withTiming(
      isActive ? GFF_COLORS[type] : 'rgba(255, 255, 255, 0.04)',
      { duration: 200 }
    ),
    borderColor: withTiming(
      isActive ? GFF_COLORS[type] : `${GFF_COLORS[type]}50`,
      { duration: 200 }
    ),
    shadowColor: GFF_COLORS[type],
    shadowOpacity: withTiming(isActive ? 0.6 : 0, { duration: 200 }),
    shadowRadius: withTiming(isActive ? 12 : 0, { duration: 200 }),
  }));
  
  const textStyle = useAnimatedStyle(() => ({
    color: withTiming(isActive ? '#000000' : '#ffffff', { duration: 200 }),
  }));
  
  const iconStyle = useAnimatedStyle(() => ({
    color: withTiming(isActive ? '#000000' : GFF_COLORS[type], { duration: 200 }),
  }));
  
  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.gffPill, animatedStyle]}>
        <Animated.Text style={[styles.gffIcon, iconStyle]}>
          {GFF_ICONS[type]}
        </Animated.Text>
        <Animated.Text style={[styles.gffLabel, textStyle]}>
          {GFF_LABELS[type]}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
});

GFFPill.displayName = 'GFFPill';

// =============================================================================
// DATE PRESET PILL COMPONENT
// =============================================================================

interface DatePillProps {
  preset: DatePreset;
  isActive: boolean;
  onPress: () => void;
}

const DatePill = memo<DatePillProps>(({ preset, isActive, onPress }) => {
  const handlePress = useCallback(() => {
    Haptics.selectionAsync();
    onPress();
  }, [onPress]);
  
  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(
      isActive ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)',
      { duration: 150 }
    ),
    borderColor: withTiming(
      isActive ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)',
      { duration: 150 }
    ),
  }));
  
  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.datePill, animatedStyle]}>
        <Text style={[styles.datePillText, isActive && styles.datePillTextActive]}>
          {DATE_PRESET_LABELS[preset]}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

DatePill.displayName = 'DatePill';

// =============================================================================
// IMPORTANCE PILL COMPONENT
// =============================================================================

interface ImportancePillProps {
  isActive: boolean;
  onPress: () => void;
}

const ImportancePill = memo<ImportancePillProps>(({ isActive, onPress }) => {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);
  
  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(
      isActive ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.04)',
      { duration: 150 }
    ),
    borderColor: withTiming(
      isActive ? '#ffd54f' : 'rgba(255, 255, 255, 0.1)',
      { duration: 150 }
    ),
  }));
  
  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.datePill, animatedStyle]}>
        <Text style={[styles.starIcon, isActive && styles.starIconActive]}>★</Text>
        <Text style={[styles.datePillText, isActive && styles.importanceTextActive]}>
          Wichtig
        </Text>
      </Animated.View>
    </Pressable>
  );
});

ImportancePill.displayName = 'ImportancePill';

// =============================================================================
// HASHTAG CHIP COMPONENT
// =============================================================================

interface HashtagChipProps {
  tag: string;
  isActive: boolean;
  size?: 'small' | 'normal';
  onPress: () => void;
  onRemove?: () => void;
}

const HashtagChip = memo<HashtagChipProps>(({ 
  tag, 
  isActive, 
  size = 'normal',
  onPress, 
  onRemove 
}) => {
  const handlePress = useCallback(() => {
    Haptics.selectionAsync();
    onPress();
  }, [onPress]);
  
  const handleRemove = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRemove?.();
  }, [onRemove]);
  
  return (
    <Animated.View 
      entering={FadeIn.duration(200)} 
      exiting={FadeOut.duration(150)}
      layout={Layout.springify()}
    >
      <Pressable onPress={handlePress}>
        <View style={[
          styles.hashtagChip, 
          isActive && styles.hashtagChipActive,
          size === 'small' && styles.hashtagChipSmall
        ]}>
          <Text style={[
            styles.hashtagText,
            isActive && styles.hashtagTextActive,
            size === 'small' && styles.hashtagTextSmall
          ]}>
            {tag}
          </Text>
          {isActive && onRemove && (
            <Pressable onPress={handleRemove} hitSlop={8}>
              <Ionicons name="close-circle" size={14} color="rgba(0,0,0,0.6)" />
            </Pressable>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
});

HashtagChip.displayName = 'HashtagChip';

// =============================================================================
// SEARCH BAR COMPONENT
// =============================================================================

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
}

const SearchBar = memo<SearchBarProps>(({ value, onChangeText, onSubmit }) => {
  const handleClear = useCallback(() => {
    Haptics.selectionAsync();
    onChangeText('');
  }, [onChangeText]);
  
  return (
    <View style={styles.searchContainer}>
      <Ionicons 
        name="search" 
        size={18} 
        color="rgba(255,255,255,0.4)" 
        style={styles.searchIcon} 
      />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder="Gedanken durchsuchen..."
        placeholderTextColor="rgba(255,255,255,0.3)"
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <Pressable onPress={handleClear} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
        </Pressable>
      )}
    </View>
  );
});

SearchBar.displayName = 'SearchBar';

// =============================================================================
// MAIN SMART FILTER PANEL COMPONENT
// =============================================================================

export interface SmartFilterPanelProps {
  /** Top hashtags from current results (passed from parent) */
  topHashtags?: string[];
  /** Current result count */
  resultCount?: number | null;
  /** Callback when date picker should open */
  onOpenDatePicker?: () => void;
  /** Callback when hashtag modal should open */
  onOpenHashtagModal?: () => void;
}

export const SmartFilterPanel = memo<SmartFilterPanelProps>(({
  topHashtags = [],
  resultCount,
  onOpenDatePicker,
  onOpenHashtagModal,
}) => {
  // ---------------------------------------------------------------------------
  // STORE HOOKS
  // ---------------------------------------------------------------------------
  
  const types = useChronicleTypes();
  const { preset: datePreset, customRange } = useChronicleDate();
  const importanceOnly = useChronicleImportance();
  const searchQuery = useChronicleSearch();
  const activeHashtags = useChronicleFilters().hashtags;
  const { isPanelExpanded, isLoading } = useChronicleUI();
  const { recent: recentHashtags } = useChronicleHashtagHistory();
  
  const {
    toggleType,
    setDatePreset,
    toggleImportanceOnly,
    setSearchQuery,
    addHashtag,
    removeHashtag,
    addToSearchHistory,
    showDatePicker,
    showHashtagModal,
  } = useChronicleActions();
  
  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------
  
  const handleSearchSubmit = useCallback(() => {
    if (searchQuery && searchQuery.trim()) {
      addToSearchHistory(searchQuery.trim());
    }
  }, [searchQuery, addToSearchHistory]);
  
  const handleDatePickerOpen = useCallback(() => {
    Haptics.selectionAsync();
    showDatePicker();
    onOpenDatePicker?.();
  }, [showDatePicker, onOpenDatePicker]);
  
  const handleHashtagModalOpen = useCallback(() => {
    Haptics.selectionAsync();
    showHashtagModal();
    onOpenHashtagModal?.();
  }, [showHashtagModal, onOpenHashtagModal]);
  
  // ---------------------------------------------------------------------------
  // MEMOIZED DATA
  // ---------------------------------------------------------------------------
  
  /** Combine top hashtags with recent, excluding active ones */
  const displayHashtags = useMemo(() => {
    const combined = [...new Set([...topHashtags, ...recentHashtags])];
    return combined
      .filter(tag => !activeHashtags.includes(tag))
      .slice(0, 6);
  }, [topHashtags, recentHashtags, activeHashtags]);
  
  const hasMoreHashtags = useMemo(() => {
    return recentHashtags.length > 6 || topHashtags.length > 6;
  }, [recentHashtags, topHashtags]);
  
  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  
  return (
    <View style={styles.container}>
      {/* ===================================================================== */}
      {/* ZONE A: GFF Intent Selectors */}
      {/* ===================================================================== */}
      <View style={styles.zoneA}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gffRow}
        >
          {(['goal', 'feeling', 'fact'] as GFFType[]).map((type) => (
            <GFFPill
              key={type}
              type={type}
              isActive={types.includes(type)}
              onPress={() => toggleType(type)}
            />
          ))}
        </ScrollView>
      </View>
      
      {/* ===================================================================== */}
      {/* ZONE B: Temporal & Importance Presets */}
      {/* ===================================================================== */}
      <View style={styles.zoneB}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateRow}
        >
          {(['today', 'week', 'month', 'all'] as DatePreset[]).map((preset) => (
            <DatePill
              key={preset}
              preset={preset}
              isActive={datePreset === preset && !customRange}
              onPress={() => setDatePreset(preset)}
            />
          ))}
          
          {/* Importance Filter */}
          <ImportancePill
            isActive={importanceOnly}
            onPress={toggleImportanceOnly}
          />
          
          {/* Custom Date Picker Trigger */}
          <Pressable onPress={handleDatePickerOpen} style={styles.datePickerButton}>
            <Ionicons 
              name="calendar-outline" 
              size={18} 
              color={customRange ? '#ffd54f' : 'rgba(255,255,255,0.5)'} 
            />
          </Pressable>
        </ScrollView>
      </View>
      
      {/* ===================================================================== */}
      {/* ZONE C: Search & Tag Hub */}
      {/* ===================================================================== */}
      <View style={styles.zoneC}>
        {/* Search Bar */}
        <SearchBar
          value={searchQuery ?? ''}
          onChangeText={setSearchQuery}
          onSubmit={handleSearchSubmit}
        />
        
        {/* Active Hashtag Chips */}
        {activeHashtags.length > 0 && (
          <View style={styles.activeHashtagsRow}>
            {activeHashtags.map((tag) => (
              <HashtagChip
                key={tag}
                tag={tag}
                isActive={true}
                onPress={() => {}} // Already active, no action
                onRemove={() => removeHashtag(tag)}
              />
            ))}
          </View>
        )}
        
        {/* Hashtag Cloud (Top 6 + More) */}
        {displayHashtags.length > 0 && (
          <View style={styles.hashtagCloud}>
            {displayHashtags.map((tag) => (
              <HashtagChip
                key={tag}
                tag={tag}
                isActive={false}
                size="small"
                onPress={() => addHashtag(tag)}
              />
            ))}
            
            {hasMoreHashtags && (
              <Pressable onPress={handleHashtagModalOpen} style={styles.moreHashtagsButton}>
                <Text style={styles.moreHashtagsText}>+mehr</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
      
      {/* ===================================================================== */}
      {/* Result Count Badge */}
      {/* ===================================================================== */}
      {resultCount !== null && resultCount !== undefined && (
        <Animated.View 
          entering={FadeIn.duration(200)} 
          style={styles.resultBadge}
        >
          <Text style={styles.resultBadgeText}>
            {isLoading ? '...' : `${resultCount} Ergebnis${resultCount !== 1 ? 'se' : ''}`}
          </Text>
        </Animated.View>
      )}
    </View>
  );
});

SmartFilterPanel.displayName = 'SmartFilterPanel';

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
  },
  
  // Zone A: GFF Pills
  zoneA: {
    // High priority zone
  },
  gffRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 2,
  },
  gffPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  gffIcon: {
    fontSize: 14,
    fontWeight: '700',
  },
  gffLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  
  // Zone B: Date & Importance
  zoneB: {
    // Secondary priority
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  datePillText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  datePillTextActive: {
    color: '#ffffff',
  },
  starIcon: {
    fontSize: 12,
    color: 'rgba(255,215,0,0.5)',
  },
  starIconActive: {
    color: '#ffd54f',
  },
  importanceTextActive: {
    color: '#ffd54f',
  },
  datePickerButton: {
    width: 36,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  
  // Zone C: Search & Tags
  zoneC: {
    gap: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#ffffff',
    paddingVertical: 0,
  },
  
  // Active Hashtags
  activeHashtagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  
  // Hashtag Cloud
  hashtagCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  hashtagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  hashtagChipActive: {
    backgroundColor: 'rgba(8, 208, 255, 0.2)',
    borderWidth: 1,
    borderColor: '#08d0ff',
  },
  hashtagChipSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  hashtagText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  hashtagTextActive: {
    color: '#08d0ff',
  },
  hashtagTextSmall: {
    fontSize: 10,
  },
  moreHashtagsButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  moreHashtagsText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  
  // Result Badge
  resultBadge: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  resultBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
});

export default SmartFilterPanel;
