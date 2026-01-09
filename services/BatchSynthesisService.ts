/**
 * BatchSynthesisService - AI-Powered Multi-Snippet Analysis
 * 
 * Phase 6: Transforms selected snippets into a structured synthesis context
 * for JARVIS to analyze patterns, conflicts, and synergies.
 * 
 * Design Philosophy:
 * - "Synthesis over Analysis" - The value is in connecting, not listing
 * - GFF-Aware: Recognizes Goal/Feeling/Fact dynamics
 * - Token-Efficient: Extracts essentials, not full history
 */

import type { Snippet } from '../db/schema';

// =============================================================================
// TYPES
// =============================================================================

export interface BatchContext {
  /** Number of snippets in batch */
  count: number;
  
  /** GFF breakdown */
  gffBreakdown: {
    goals: number;
    feelings: number;
    facts: number;
  };
  
  /** Formatted snippet summaries for AI */
  formattedContent: string;
  
  /** Time range of selected snippets */
  timeRange: {
    earliest: number;
    latest: number;
    spanDays: number;
  };
  
  /** Unique hashtags across selection */
  sharedHashtags: string[];
  
  /** Topic clusters */
  topics: string[];
  
  /** Snippet IDs for reference */
  snippetIds: number[];
}

export interface SynthesisPromptConfig {
  /** Focus on specific analysis type */
  focusArea?: 'patterns' | 'conflicts' | 'synergies' | 'all';
  
  /** Language for response */
  language?: 'de' | 'en';
  
  /** Include action suggestions */
  includeActions?: boolean;
}

// =============================================================================
// BATCH CONTEXT BUILDER
// =============================================================================

/**
 * Build structured context from selected snippets
 * This is the "Extract + Meta" approach (Q6)
 */
export function buildBatchContext(snippets: Snippet[]): BatchContext {
  if (snippets.length === 0) {
    return {
      count: 0,
      gffBreakdown: { goals: 0, feelings: 0, facts: 0 },
      formattedContent: '',
      timeRange: { earliest: 0, latest: 0, spanDays: 0 },
      sharedHashtags: [],
      topics: [],
      snippetIds: [],
    };
  }

  // GFF Breakdown
  const gffBreakdown = {
    goals: snippets.filter(s => s.type === 'goal').length,
    feelings: snippets.filter(s => s.type === 'feeling').length,
    facts: snippets.filter(s => s.type === 'fact').length,
  };

  // Time Range
  const timestamps = snippets.map(s => s.timestamp);
  const earliest = Math.min(...timestamps);
  const latest = Math.max(...timestamps);
  const spanDays = Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24));

  // Hashtag Aggregation
  const hashtagSet = new Set<string>();
  snippets.forEach(s => {
    if (s.hashtags) {
      s.hashtags.split(/[,\s]+/).forEach(tag => {
        if (tag.startsWith('#')) hashtagSet.add(tag.toLowerCase());
      });
    }
  });

  // Topic Aggregation
  const topicSet = new Set<string>();
  snippets.forEach(s => {
    if (s.topic && s.topic !== 'misc') topicSet.add(s.topic);
  });

  // Format content for AI (GFF-grouped)
  const formattedContent = formatSnippetsForAI(snippets);

  return {
    count: snippets.length,
    gffBreakdown,
    formattedContent,
    timeRange: { earliest, latest, spanDays },
    sharedHashtags: Array.from(hashtagSet),
    topics: Array.from(topicSet),
    snippetIds: snippets.map(s => s.id),
  };
}

/**
 * Format snippets in a GFF-grouped structure for AI consumption
 */
function formatSnippetsForAI(snippets: Snippet[]): string {
  const goals = snippets.filter(s => s.type === 'goal');
  const feelings = snippets.filter(s => s.type === 'feeling');
  const facts = snippets.filter(s => s.type === 'fact');

  const sections: string[] = [];

  if (goals.length > 0) {
    sections.push(`## 🎯 ZIELE (${goals.length})\n${goals.map((s, i) => 
      `${i + 1}. "${s.content}"${s.hashtags ? ` [${s.hashtags}]` : ''}`
    ).join('\n')}`);
  }

  if (feelings.length > 0) {
    sections.push(`## 💭 GEFÜHLE (${feelings.length})\n${feelings.map((s, i) => 
      `${i + 1}. "${s.content}"${s.hashtags ? ` [${s.hashtags}]` : ''}`
    ).join('\n')}`);
  }

  if (facts.length > 0) {
    sections.push(`## 📚 FAKTEN (${facts.length})\n${facts.map((s, i) => 
      `${i + 1}. "${s.content}"${s.hashtags ? ` [${s.hashtags}]` : ''}`
    ).join('\n')}`);
  }

  return sections.join('\n\n');
}

// =============================================================================
// SYNTHESIS PROMPT GENERATOR
// =============================================================================

/**
 * Generate the specialized synthesis system prompt
 * This is "The Synthesis Prompt" from the implementation plan
 */
export function generateSynthesisPrompt(
  context: BatchContext,
  config: SynthesisPromptConfig = {}
): string {
  const { focusArea = 'all', language = 'de', includeActions = true } = config;

  const basePrompt = language === 'de' ? SYNTHESIS_PROMPT_DE : SYNTHESIS_PROMPT_EN;
  
  // Build focus instruction
  let focusInstruction = '';
  if (focusArea !== 'all') {
    const focusMap = {
      patterns: 'Konzentriere dich besonders auf wiederkehrende MUSTER und Themen.',
      conflicts: 'Konzentriere dich besonders auf WIDERSPRÜCHE und innere Konflikte.',
      synergies: 'Konzentriere dich besonders auf SYNERGIEN und wie diese Gedanken sich gegenseitig verstärken.',
    };
    focusInstruction = `\n\n🎯 FOKUS: ${focusMap[focusArea]}`;
  }

  // Build action instruction
  const actionInstruction = includeActions 
    ? '\n\n📋 Schließe mit 2-3 konkreten NÄCHSTEN SCHRITTEN ab, die der Nutzer sofort umsetzen kann.'
    : '';

  return `${basePrompt}${focusInstruction}${actionInstruction}`;
}

/**
 * Generate the user message that contains the batch content
 */
export function generateBatchUserMessage(context: BatchContext): string {
  const timeDescription = context.timeRange.spanDays === 0 
    ? 'heute'
    : context.timeRange.spanDays === 1 
      ? 'in den letzten 24 Stunden'
      : `über ${context.timeRange.spanDays} Tage`;

  const hashtagInfo = context.sharedHashtags.length > 0
    ? `\n📌 Gemeinsame Tags: ${context.sharedHashtags.slice(0, 5).join(', ')}`
    : '';

  return `Ich habe ${context.count} Gedanken ausgewählt (${timeDescription}):
- ${context.gffBreakdown.goals} Ziele
- ${context.gffBreakdown.feelings} Gefühle  
- ${context.gffBreakdown.facts} Fakten${hashtagInfo}

---

${context.formattedContent}

---

Analysiere diese Gedanken und zeige mir die verborgenen Zusammenhänge.`;
}

// =============================================================================
// SYSTEM PROMPTS
// =============================================================================

const SYNTHESIS_PROMPT_DE = `Du bist ein kognitiver Analyst, der dem Nutzer hilft, tiefe Zusammenhänge zwischen seinen Gedanken zu erkennen.

Der Nutzer hat mehrere Gedanken aus seiner persönlichen Wissensbank ausgewählt. Deine Aufgabe ist es, diese Gedanken zu SYNTHETISIEREN – nicht nur zusammenzufassen.

## 🔍 ANALYSE-FRAMEWORK

### 1. MUSTER (Patterns)
Identifiziere wiederkehrende Themen, Wörter oder emotionale Töne. Frage dich:
- Welche Themen tauchen in mehreren Gedanken auf?
- Gibt es eine zeitliche oder kausale Verbindung?
- Welche unbewussten Prioritäten zeigen sich?

### 2. WIDERSPRÜCHE (Conflicts)
Finde Spannungen zwischen Zielen und Gefühlen oder zwischen verschiedenen Fakten:
- Widerspricht ein Ziel einem Gefühl?
- Gibt es Fakten, die ein Ziel erschweren?
- Wo zeigt sich innerer Konflikt?

### 3. SYNERGIEN (Synergies)
Entdecke, wie Gedanken sich gegenseitig verstärken können:
- Welche Fakten unterstützen welche Ziele?
- Welche Gefühle könnten als Antrieb dienen?
- Wie können diese Gedanken zu einem kohärenten Plan werden?

## 📝 ANTWORT-FORMAT

Antworte in diesem Format:

**🔗 Synthese**
[2-3 Sätze, die den KERN der Verbindung erfassen]

**🔍 Erkannte Muster**
- [Muster 1]
- [Muster 2]

**⚡ Spannungsfelder** (falls vorhanden)
- [Konflikt zwischen X und Y]

**✨ Potenzial**
[Was diese Kombination von Gedanken ermöglichen könnte]

Sei prägnant, aber tiefgründig. Vermeide oberflächliche Zusammenfassungen.`;

const SYNTHESIS_PROMPT_EN = `You are a cognitive analyst helping the user discover deep connections between their thoughts.

The user has selected multiple thoughts from their personal knowledge base. Your task is to SYNTHESIZE these thoughts – not just summarize them.

## 🔍 ANALYSIS FRAMEWORK

### 1. PATTERNS
Identify recurring themes, words, or emotional tones:
- What themes appear across multiple thoughts?
- Is there a temporal or causal connection?
- What unconscious priorities emerge?

### 2. CONFLICTS
Find tensions between goals and feelings, or between different facts:
- Does a goal contradict a feeling?
- Are there facts that make a goal harder?
- Where does inner conflict show?

### 3. SYNERGIES
Discover how thoughts can reinforce each other:
- Which facts support which goals?
- Which feelings could serve as motivation?
- How can these thoughts become a coherent plan?

## 📝 RESPONSE FORMAT

Respond in this format:

**🔗 Synthesis**
[2-3 sentences capturing the CORE connection]

**🔍 Patterns Found**
- [Pattern 1]
- [Pattern 2]

**⚡ Tension Points** (if any)
- [Conflict between X and Y]

**✨ Potential**
[What this combination of thoughts could enable]

Be concise but profound. Avoid superficial summaries.`;

// =============================================================================
// DISCONNECTION DETECTION (Q2: Type Mixing)
// =============================================================================

/**
 * Detect if selected snippets appear disconnected
 * Returns suggestion for user if disconnection is high
 */
export function detectDisconnection(context: BatchContext): {
  isDisconnected: boolean;
  suggestion?: string;
} {
  // If only 1-2 items, can't really be disconnected
  if (context.count <= 2) {
    return { isDisconnected: false };
  }

  // Check 1: No shared hashtags across 3+ items
  const noSharedHashtags = context.sharedHashtags.length === 0 && context.count >= 3;

  // Check 2: Extreme GFF imbalance (e.g., 1 fact among 5 goals)
  const { goals, feelings, facts } = context.gffBreakdown;
  const types = [goals, feelings, facts].filter(n => n > 0);
  const hasIsolatedType = types.length >= 2 && Math.min(...types) === 1 && Math.max(...types) >= 3;

  // Check 3: Very wide time span (> 30 days) without shared context
  const wideTimeSpan = context.timeRange.spanDays > 30 && context.sharedHashtags.length === 0;

  const isDisconnected = (noSharedHashtags && hasIsolatedType) || wideTimeSpan;

  if (isDisconnected) {
    return {
      isDisconnected: true,
      suggestion: 'Diese Gedanken scheinen thematisch weit auseinander zu liegen. Möchtest du sie trotzdem gemeinsam analysieren, oder lieber in Gruppen aufteilen?',
    };
  }

  return { isDisconnected: false };
}

// =============================================================================
// HELPER: Get Snippets by IDs
// =============================================================================

import { getDb } from '../db';

/**
 * Fetch full snippet data for selected IDs
 */
export async function getSnippetsByIds(ids: number[]): Promise<Snippet[]> {
  if (ids.length === 0) return [];

  try {
    const database = getDb();
    const placeholders = ids.map(() => '?').join(', ');
    const result = await database.execute(
      `SELECT * FROM snippets WHERE id IN (${placeholders}) ORDER BY timestamp DESC`,
      ids
    );
    return (result.rows as unknown as Snippet[]) || [];
  } catch (error) {
    console.error('[BatchSynthesis] Failed to fetch snippets:', error);
    return [];
  }
}

/**
 * Prepare complete batch payload for Orbit
 */
export async function prepareBatchPayload(selectedIds: Set<number>): Promise<{
  context: BatchContext;
  systemPrompt: string;
  userMessage: string;
  disconnectionWarning?: string;
} | null> {
  const ids = Array.from(selectedIds);
  if (ids.length === 0) return null;

  const snippets = await getSnippetsByIds(ids);
  if (snippets.length === 0) return null;

  const context = buildBatchContext(snippets);
  const disconnection = detectDisconnection(context);
  const systemPrompt = generateSynthesisPrompt(context);
  const userMessage = generateBatchUserMessage(context);

  return {
    context,
    systemPrompt,
    userMessage,
    disconnectionWarning: disconnection.suggestion,
  };
}
