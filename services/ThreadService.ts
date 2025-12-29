/**
 * 🧵 THREAD SERVICE
 * 
 * Data fetcher for the Hub-and-Spoke Thread View.
 * Finds upstream (past), downstream (future), and lateral (related) connections.
 */

import { THREAD_MOTION_BUDGET } from '@/constants/contracts';
import { getDb } from '@/db';
import { Snippet } from '@/db/schema';
import { ThreadContext } from '@/types/ThreadTypes';

// ═══════════════════════════════════════════════════════════════════
// MAIN FUNCTION: Build Thread Context
// ═══════════════════════════════════════════════════════════════════

export async function buildThreadContext(focusNode: Snippet): Promise<ThreadContext> {
    const db = await getDb();

    // Fetch all related data in parallel
    const [upstream, downstream, lateral] = await Promise.all([
        fetchUpstream(db, focusNode),
        fetchDownstream(db, focusNode),
        fetchLateral(db, focusNode),
    ]);

    return {
        focus: focusNode,
        upstream: {
            nodes: upstream.nodes,
            relation: upstream.relation,
        },
        downstream: {
            nodes: downstream.nodes,
            relation: downstream.relation,
        },
        lateral: {
            nodes: lateral.nodes,
            similarity: lateral.avgSimilarity,
        },
        meta: {
            loadedAt: Date.now(),
            hasMoreUpstream: upstream.hasMore,
            hasMoreDownstream: downstream.hasMore,
            hasMoreLateral: lateral.hasMore,
        },
    };
}

// ═══════════════════════════════════════════════════════════════════
// UPSTREAM: Find what came before (temporal + causal)
// ═══════════════════════════════════════════════════════════════════

async function fetchUpstream(db: any, focusNode: Snippet) {
    const limit = THREAD_MOTION_BUDGET.maxUpstreamNodes;

    // Strategy 1: Find nodes that are connected via edges (causal)
    const connectedQuery = `
        SELECT s.* FROM snippets s
        INNER JOIN edges e ON (e.source_id = s.id OR e.target_id = s.id)
        WHERE (e.source_id = ? OR e.target_id = ?)
          AND s.id != ?
          AND s.timestamp < ?
        ORDER BY s.timestamp DESC
        LIMIT ?
    `;

    const connectedResult = await db.execute(connectedQuery, [
        focusNode.id, focusNode.id, focusNode.id, focusNode.timestamp, limit
    ]);

    let nodes: Snippet[] = connectedResult.rows?.map((r: any) => ({ ...r })) || [];
    let relation: 'CAUSAL' | 'TEMPORAL' = 'CAUSAL';

    // Strategy 2: If no connected nodes, fall back to temporal proximity
    if (nodes.length === 0) {
        const temporalQuery = `
            SELECT * FROM snippets
            WHERE id != ? AND timestamp < ?
            ORDER BY timestamp DESC
            LIMIT ?
        `;
        const temporalResult = await db.execute(temporalQuery, [
            focusNode.id, focusNode.timestamp, limit
        ]);
        nodes = temporalResult.rows?.map((r: any) => ({ ...r })) || [];
        relation = 'TEMPORAL';
    }

    // Check if there are more
    const countQuery = `
        SELECT COUNT(*) as count FROM snippets
        WHERE id != ? AND timestamp < ?
    `;
    const countResult = await db.execute(countQuery, [focusNode.id, focusNode.timestamp]);
    const totalCount = countResult.rows?.[0]?.count || 0;

    return {
        nodes,
        relation,
        hasMore: totalCount > limit,
    };
}

// ═══════════════════════════════════════════════════════════════════
// DOWNSTREAM: Find what came after (implications)
// ═══════════════════════════════════════════════════════════════════

async function fetchDownstream(db: any, focusNode: Snippet) {
    const limit = THREAD_MOTION_BUDGET.maxDownstreamNodes;

    // Strategy 1: Find nodes that are connected via edges + newer
    const connectedQuery = `
        SELECT s.* FROM snippets s
        INNER JOIN edges e ON (e.source_id = s.id OR e.target_id = s.id)
        WHERE (e.source_id = ? OR e.target_id = ?)
          AND s.id != ?
          AND s.timestamp > ?
        ORDER BY s.timestamp ASC
        LIMIT ?
    `;

    const connectedResult = await db.execute(connectedQuery, [
        focusNode.id, focusNode.id, focusNode.id, focusNode.timestamp, limit
    ]);

    let nodes: Snippet[] = connectedResult.rows?.map((r: any) => ({ ...r })) || [];
    let relation: 'IMPLICATION' | 'NEXT_STEP' = 'IMPLICATION';

    // Strategy 2: If no connected nodes, find goals that might be related
    if (nodes.length === 0) {
        const goalsQuery = `
            SELECT * FROM snippets
            WHERE id != ? AND timestamp > ? AND type = 'goal'
            ORDER BY timestamp ASC
            LIMIT ?
        `;
        const goalsResult = await db.execute(goalsQuery, [
            focusNode.id, focusNode.timestamp, limit
        ]);
        nodes = goalsResult.rows?.map((r: any) => ({ ...r })) || [];
        relation = 'NEXT_STEP';
    }

    // Check if there are more
    const countQuery = `
        SELECT COUNT(*) as count FROM snippets
        WHERE id != ? AND timestamp > ?
    `;
    const countResult = await db.execute(countQuery, [focusNode.id, focusNode.timestamp]);
    const totalCount = countResult.rows?.[0]?.count || 0;

    return {
        nodes,
        relation,
        hasMore: totalCount > limit,
    };
}

// ═══════════════════════════════════════════════════════════════════
// LATERAL: Find related topics (semantic similarity)
// ═══════════════════════════════════════════════════════════════════

async function fetchLateral(db: any, focusNode: Snippet) {
    const limit = THREAD_MOTION_BUDGET.maxLateralNodes;

    // Strategy 1: Same cluster label
    let nodes: Snippet[] = [];
    let avgSimilarity = 0;

    if (focusNode.cluster_label) {
        const clusterQuery = `
            SELECT * FROM snippets
            WHERE id != ? AND cluster_label = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `;
        const clusterResult = await db.execute(clusterQuery, [
            focusNode.id, focusNode.cluster_label, limit
        ]);
        nodes = clusterResult.rows?.map((r: any) => ({ ...r })) || [];
        avgSimilarity = 0.7; // Same cluster = high similarity
    }

    // Strategy 2: Same type if no cluster matches
    if (nodes.length === 0) {
        const typeQuery = `
            SELECT * FROM snippets
            WHERE id != ? AND type = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `;
        const typeResult = await db.execute(typeQuery, [
            focusNode.id, focusNode.type, limit
        ]);
        nodes = typeResult.rows?.map((r: any) => ({ ...r })) || [];
        avgSimilarity = 0.4; // Same type = medium similarity
    }

    // Check if there are more
    const countQuery = `
        SELECT COUNT(*) as count FROM snippets
        WHERE id != ? AND (cluster_label = ? OR type = ?)
    `;
    const countResult = await db.execute(countQuery, [
        focusNode.id, focusNode.cluster_label || '', focusNode.type
    ]);
    const totalCount = countResult.rows?.[0]?.count || 0;

    return {
        nodes,
        avgSimilarity,
        hasMore: totalCount > limit,
    };
}
