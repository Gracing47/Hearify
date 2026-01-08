/**
 * 🔍 Lens Filter Service — Visual MECE for Neural Horizon
 * 
 * Implements the "McKinsey View" of the knowledge graph:
 * Filters nodes based on active lens and GFF relationships.
 * 
 * Strategy Lens Example:
 * - Show all GOAL nodes
 * - Show FACT nodes connected to active goals (resources)
 * - Show FEELING nodes connected to active goals (blockers/motivation)
 * - Hide unrelated noise
 * 
 * This is the "glue" that makes the graph actionable.
 */

import { getDb } from '@/db';
import { Snippet } from '@/db/schema';

export type LensMode = 'ALL' | 'STRATEGY' | 'FEELINGS' | 'FACTS' | 'RECENT';

export interface FilteredNode extends Snippet {
  relevanceScore: number; // 0-1, for visual weight/opacity
  connectionReason?: string; // Why this node is shown (for debugging)
}

/**
 * Filter snippets based on active lens mode
 * Implements Visual MECE (Mutually Exclusive, Collectively Exhaustive)
 */
export async function filterNodesByLens(
  lensMode: LensMode,
  focusNodeId?: number | null
): Promise<FilteredNode[]> {
  const db = getDb();

  // ALL mode: No filtering
  if (lensMode === 'ALL') {
    const result = await db.execute('SELECT * FROM snippets ORDER BY timestamp DESC');
    return (result.rows || []).map((node: any) => ({
      ...node,
      relevanceScore: 1.0,
      connectionReason: 'All nodes visible'
    }));
  }

  // RECENT mode: Last 24 hours
  if (lensMode === 'RECENT') {
    const dayAgo = Date.now() - 86400000;
    const result = await db.execute(
      'SELECT * FROM snippets WHERE timestamp >= ? ORDER BY timestamp DESC',
      [dayAgo]
    );
    return (result.rows || []).map((node: any) => ({
      ...node,
      relevanceScore: 1.0,
      connectionReason: 'Recent activity'
    }));
  }

  // STRATEGY mode: Goals + connected Facts/Feelings
  if (lensMode === 'STRATEGY') {
    return filterStrategyLens(focusNodeId);
  }

  // FEELINGS mode: Show all feelings + connected goals
  if (lensMode === 'FEELINGS') {
    return filterFeelingsLens();
  }

  // FACTS mode: Show all facts + connected goals
  if (lensMode === 'FACTS') {
    return filterFactsLens();
  }

  // Default: return all
  const result = await db.execute('SELECT * FROM snippets');
  return (result.rows || []).map((node: any) => ({
    ...node,
    relevanceScore: 1.0
  }));
}

/**
 * STRATEGY LENS: Goals + supporting Facts + blocking Feelings
 * 
 * Logic:
 * 1. Show all GOAL nodes (primary focus)
 * 2. Find FACT nodes semantically connected to goals (resources)
 * 3. Find FEELING nodes that mention goals (motivation/friction)
 * 4. Hide unrelated noise
 */
async function filterStrategyLens(focusNodeId?: number | null): Promise<FilteredNode[]> {
  const db = getDb();
  const nodes: FilteredNode[] = [];

  // 1. Get all goal nodes
  const goalsResult = await db.execute(
    'SELECT * FROM snippets WHERE type = ? ORDER BY importance DESC, timestamp DESC',
    ['goal']
  );
  const goals = goalsResult.rows || [];

  // Add all goals with full relevance
  goals.forEach((goal: any) => {
    nodes.push({
      ...goal,
      relevanceScore: focusNodeId === goal.id ? 1.0 : 0.9,
      connectionReason: focusNodeId === goal.id ? 'Focused goal' : 'Active goal'
    });
  });

  if (goals.length === 0) {
    // No goals exist, show hint
    return [];
  }

  // 2. Get facts connected via semantic edges
  const goalIds = goals.map((g: any) => g.id);
  
  // Find facts that have edges to goals
  const factsResult = await db.execute(
    `SELECT DISTINCT s.* 
     FROM snippets s
     INNER JOIN semantic_edges e ON (s.id = e.source_id OR s.id = e.target_id)
     WHERE s.type = 'fact' 
     AND (e.source_id IN (${goalIds.join(',')}) OR e.target_id IN (${goalIds.join(',')}))
     LIMIT 50`
  );

  (factsResult.rows || []).forEach((fact: any) => {
    nodes.push({
      ...fact,
      relevanceScore: 0.7,
      connectionReason: 'Resource for goal'
    });
  });

  // 3. Get feelings that might reference goals (keyword matching as fallback)
  const feelingsResult = await db.execute(
    'SELECT * FROM snippets WHERE type = ? ORDER BY timestamp DESC LIMIT 20',
    ['feeling']
  );

  (feelingsResult.rows || []).forEach((feeling: any) => {
    // Check if feeling mentions any goal keywords
    const isRelevant = goals.some((goal: any) => {
      const goalKeywords = goal.content.toLowerCase().split(' ');
      return goalKeywords.some((kw: string) => 
        kw.length > 4 && feeling.content.toLowerCase().includes(kw)
      );
    });

    if (isRelevant) {
      nodes.push({
        ...feeling,
        relevanceScore: 0.6,
        connectionReason: 'Emotional context for goal'
      });
    }
  });

  return nodes;
}

/**
 * FEELINGS LENS: All feelings + related goals
 */
async function filterFeelingsLens(): Promise<FilteredNode[]> {
  const db = getDb();
  const nodes: FilteredNode[] = [];

  // Get all feelings
  const feelingsResult = await db.execute(
    'SELECT * FROM snippets WHERE type = ? ORDER BY timestamp DESC',
    ['feeling']
  );

  (feelingsResult.rows || []).forEach((feeling: any) => {
    nodes.push({
      ...feeling,
      relevanceScore: 1.0,
      connectionReason: 'Primary feeling'
    });
  });

  // Get connected goals (via edges or keyword matching)
  const goalsResult = await db.execute(
    'SELECT * FROM snippets WHERE type = ? AND importance > 0 ORDER BY timestamp DESC LIMIT 10',
    ['goal']
  );

  (goalsResult.rows || []).forEach((goal: any) => {
    nodes.push({
      ...goal,
      relevanceScore: 0.7,
      connectionReason: 'Related goal'
    });
  });

  return nodes;
}

/**
 * FACTS LENS: All facts + related goals
 */
async function filterFactsLens(): Promise<FilteredNode[]> {
  const db = getDb();
  const nodes: FilteredNode[] = [];

  // Get all facts
  const factsResult = await db.execute(
    'SELECT * FROM snippets WHERE type = ? ORDER BY timestamp DESC',
    ['fact']
  );

  (factsResult.rows || []).forEach((fact: any) => {
    nodes.push({
      ...fact,
      relevanceScore: 1.0,
      connectionReason: 'Knowledge node'
    });
  });

  // Get related goals
  const goalsResult = await db.execute(
    'SELECT * FROM snippets WHERE type = ? ORDER BY importance DESC LIMIT 15',
    ['goal']
  );

  (goalsResult.rows || []).forEach((goal: any) => {
    nodes.push({
      ...goal,
      relevanceScore: 0.6,
      connectionReason: 'Goal context'
    });
  });

  return nodes;
}

/**
 * Get filter statistics for UI display
 */
export async function getLensStats(): Promise<{
  totalNodes: number;
  goals: number;
  facts: number;
  feelings: number;
}> {
  const db = getDb();

  const result = await db.execute(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN type = 'goal' THEN 1 ELSE 0 END) as goals,
      SUM(CASE WHEN type = 'fact' THEN 1 ELSE 0 END) as facts,
      SUM(CASE WHEN type = 'feeling' THEN 1 ELSE 0 END) as feelings
    FROM snippets
  `);

  const row = result.rows?.[0] as any;

  return {
    totalNodes: row?.total || 0,
    goals: row?.goals || 0,
    facts: row?.facts || 0,
    feelings: row?.feelings || 0,
  };
}
