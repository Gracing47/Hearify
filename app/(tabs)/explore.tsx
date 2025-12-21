/**
 * The Chronicle - Bento Grid Memory View
 * 
 * A beautiful, scannable grid of all your neural memories.
 * Hierarchical layout: Large cards for goals, compact cards for facts/feelings.
 */

import { getAllSnippets } from '@/db';
import { Snippet } from '@/db/schema';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import Animated, { FadeIn, FadeInUp, SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Sentiment color mapping
const getSentimentColor = (sentiment?: string) => {
  switch (sentiment) {
    case 'analytical': return '#3b82f6';  // Blue
    case 'positive': return '#f59e0b';     // Gold
    case 'creative': return '#8b5cf6';     // Purple
    default: return '#6b7280';             // Gray
  }
};

// Type accent colors
const getTypeAccent = (type: string) => {
  switch (type) {
    case 'goal': return { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.25)', text: '#f59e0b' };
    case 'feeling': return { bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.25)', text: '#a855f7' };
    case 'fact': return { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.25)', text: '#10b981' };
    default: return { bg: 'rgba(99, 102, 241, 0.12)', border: 'rgba(99, 102, 241, 0.25)', text: '#6366f1' };
  }
};

export default function MemoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'fact' | 'feeling' | 'goal'>('all');

  const loadSnippets = useCallback(async () => {
    const data = await getAllSnippets();
    setSnippets(data);
  }, []);

  useEffect(() => {
    loadSnippets();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSnippets();
    setRefreshing(false);
  };

  const filteredSnippets = filter === 'all'
    ? snippets
    : snippets.filter(s => s.type === filter);

  // Stats
  const stats = {
    total: snippets.length,
    facts: snippets.filter(s => s.type === 'fact').length,
    feelings: snippets.filter(s => s.type === 'feeling').length,
    goals: snippets.filter(s => s.type === 'goal').length,
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a0a0f', '#0d0d14', '#000']}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
          />
        }
      >
        {/* Header */}
        <Animated.View entering={FadeIn} style={styles.header}>
          <Text style={styles.title}>Chronicle</Text>
          <Text style={styles.subtitle}>Your Neural Memory Archive</Text>
        </Animated.View>

        {/* Stats Banner */}
        <Animated.View entering={FadeInUp.delay(100)} style={styles.statsBanner}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={40} tint="dark" style={styles.statsBannerBlur}>
              <StatsBannerContent stats={stats} />
            </BlurView>
          ) : (
            <View style={styles.statsBannerAndroid}>
              <StatsBannerContent stats={stats} />
            </View>
          )}
        </Animated.View>

        {/* Filter Pills */}
        <Animated.View entering={FadeInUp.delay(200)} style={styles.filterRow}>
          {(['all', 'goal', 'feeling', 'fact'] as const).map((f) => (
            <Pressable
              key={f}
              style={[
                styles.filterPill,
                filter === f && styles.filterPillActive
              ]}
              onPress={() => setFilter(f)}
            >
              <Text style={[
                styles.filterPillText,
                filter === f && styles.filterPillTextActive
              ]}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
              </Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* Bento Grid */}
        {filteredSnippets.length === 0 ? (
          <Animated.View entering={FadeIn} style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🧠</Text>
            <Text style={styles.emptyTitle}>No memories yet</Text>
            <Text style={styles.emptySubtitle}>Start a conversation to capture thoughts</Text>
          </Animated.View>
        ) : (
          <View style={styles.bentoGrid}>
            {filteredSnippets.map((snippet, index) => (
              <MemoryCard
                key={snippet.id}
                snippet={snippet}
                index={index}
                isLarge={snippet.type === 'goal' && index < 2}
                onShowInHorizon={() => {
                  // Navigate to Horizon with focus on this node
                  router.push('/canvas');
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatsBannerContent({ stats }: { stats: { total: number; facts: number; feelings: number; goals: number } }) {
  return (
    <View style={styles.statsRow}>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{stats.total}</Text>
        <Text style={styles.statLabel}>Total</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.facts}</Text>
        <Text style={styles.statLabel}>Facts</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: '#a855f7' }]}>{stats.feelings}</Text>
        <Text style={styles.statLabel}>Feelings</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.goals}</Text>
        <Text style={styles.statLabel}>Goals</Text>
      </View>
    </View>
  );
}

interface MemoryCardProps {
  snippet: Snippet;
  index: number;
  isLarge: boolean;
  onShowInHorizon: () => void;
}

function MemoryCard({ snippet, index, isLarge, onShowInHorizon }: MemoryCardProps) {
  const accent = getTypeAccent(snippet.type);
  const sentimentColor = getSentimentColor(snippet.sentiment);
  const date = new Date(snippet.timestamp);
  const timeAgo = getTimeAgo(date);

  return (
    <Animated.View
      entering={SlideInRight.delay(index * 50).springify()}
      style={[
        styles.card,
        isLarge && styles.cardLarge,
        { backgroundColor: accent.bg, borderColor: accent.border }
      ]}
    >
      {/* Type Badge + Sentiment Dot */}
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: accent.bg, borderColor: accent.border }]}>
          <Text style={[styles.typeBadgeText, { color: accent.text }]}>
            {snippet.type.toUpperCase()}
          </Text>
        </View>
        <View style={[styles.sentimentDot, { backgroundColor: sentimentColor }]} />
      </View>

      {/* Content */}
      <Text
        style={[styles.cardContent, isLarge && styles.cardContentLarge]}
        numberOfLines={isLarge ? 5 : 3}
      >
        {snippet.content}
      </Text>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <Text style={styles.cardTime}>{timeAgo}</Text>
        <Pressable style={styles.horizonButton} onPress={onShowInHorizon}>
          <Text style={styles.horizonButtonText}>🌌 View in Horizon</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  // Header
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontWeight: '500',
  },
  // Stats Banner
  statsBanner: {
    marginBottom: 20,
  },
  statsBannerBlur: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statsBannerAndroid: {
    backgroundColor: 'rgba(26, 26, 32, 0.95)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  // Filter Pills
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterPillActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },
  filterPillTextActive: {
    color: '#6366f1',
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
  },
  // Bento Grid
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '47%',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  cardLarge: {
    width: '100%',
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  sentimentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardContent: {
    fontSize: 14,
    color: '#e5e5e5',
    lineHeight: 20,
    fontWeight: '500',
  },
  cardContentLarge: {
    fontSize: 16,
    lineHeight: 24,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  cardTime: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  horizonButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  horizonButtonText: {
    fontSize: 10,
    color: '#6366f1',
    fontWeight: '600',
  },
});
