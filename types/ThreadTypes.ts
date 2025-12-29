/**
 * 🧵 THREAD TYPES
 * 
 * Hub-and-Spoke data model for the Thread View.
 * A thought is a center (hub) with connections in all directions (spokes).
 */

import { Snippet } from '@/db/schema';

// ═══════════════════════════════════════════════════════════════════
// CONNECTION TYPES
// ═══════════════════════════════════════════════════════════════════

export type ConnectionType = 'TEMPORAL' | 'SEMANTIC' | 'INFERRED';

export type UpstreamRelation = 'CAUSAL' | 'TEMPORAL';
export type DownstreamRelation = 'IMPLICATION' | 'NEXT_STEP' | 'AI_INSIGHT';
export type LateralRelation = 'SIMILAR' | 'SAME_TOPIC' | 'CONTRASTING';

// ═══════════════════════════════════════════════════════════════════
// THREAD CONTEXT
// ═══════════════════════════════════════════════════════════════════

export interface ThreadContext {
    /** The clicked node (center) */
    focus: Snippet;

    /** ⬆️ UPSTREAM (Past/Context) - What came before */
    upstream: {
        nodes: Snippet[];
        relation: UpstreamRelation;
    };

    /** ⬇️ DOWNSTREAM (Future/Implications) - What comes after */
    downstream: {
        nodes: Snippet[];
        relation: DownstreamRelation;
    };

    /** ↔️ LATERAL (Related Topics) - Same topic, different time */
    lateral: {
        nodes: Snippet[];
        similarity: number;
    };

    /** Metadata */
    meta: {
        loadedAt: number;
        hasMoreUpstream: boolean;
        hasMoreDownstream: boolean;
        hasMoreLateral: boolean;
    };
}

// ═══════════════════════════════════════════════════════════════════
// THREAD NODE (Enhanced Snippet for Thread View)
// ═══════════════════════════════════════════════════════════════════

export interface ThreadNode extends Snippet {
    /** Position in the thread */
    threadPosition: 'upstream' | 'focus' | 'downstream' | 'lateral';

    /** Connection to focus node */
    connectionStrength: number;

    /** Visual state */
    isLoading?: boolean;
    isAIGenerated?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// AI ACTION TYPES
// ═══════════════════════════════════════════════════════════════════

export type AIActionType = 'INSIGHT' | 'CHALLENGE' | 'NEXT_STEP';

export interface AIAction {
    id: AIActionType;
    label: string;
    emoji: string;
    prompt: (content: string) => string;
}

export const AI_ACTIONS: Record<AIActionType, AIAction> = {
    INSIGHT: {
        id: 'INSIGHT',
        label: 'Find Pattern',
        emoji: '💡',
        prompt: (content) =>
            `Analyze this thought: "${content}". What pattern connects this to previous entries? Be concise.`,
    },
    CHALLENGE: {
        id: 'CHALLENGE',
        label: 'Challenge',
        emoji: '🤔',
        prompt: (content) =>
            `Play devil's advocate for: "${content}". What am I overlooking? One sentence.`,
    },
    NEXT_STEP: {
        id: 'NEXT_STEP',
        label: 'Action',
        emoji: '⚡',
        prompt: (content) =>
            `Derive a concrete, single next step from: "${content}". Start with a verb.`,
    },
};
