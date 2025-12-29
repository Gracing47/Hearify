import { DB } from '@op-engineering/op-sqlite';
import { useContextStore } from '../store/contextStore';

// 🛠️ Types for JSON Schema
interface FlashcardData {
    front: string;
    back: string;
    confidence_score: number;
    last_reviewed: string | null;
}

interface StrategyData {
    parent_goal: string;
    action_steps: { id: number; text: string; done: boolean }[];
    priority: 'low' | 'medium' | 'high';
}

type EnrichmentData = {
    flashcard?: FlashcardData;
    strategy?: StrategyData;
};

// 🧠 MOCK AI (Simulate Network/Processing Latency)
// In production, this would call OpenAI/DeepSeek/Claude via MCP
const mockAIProcess = async (text: string, type: string): Promise<EnrichmentData> => {
    // Simulate network latency (1.2s) to test non-blocking UI
    await new Promise(resolve => setTimeout(resolve, 1200));

    if (type === 'fact') {
        return {
            flashcard: {
                front: text.length > 40 ? text.substring(0, 40) + '...' : text,
                back: `Auto-Generated Context for "${text}":\n\nThis content is populated by the Satellite Engine to simulate an AI elaboration. It demonstrates the asynchronous enrichment pipeline.`,
                confidence_score: 0.0,
                last_reviewed: null,
            },
        };
    }

    if (type === 'goal') {
        return {
            strategy: {
                parent_goal: 'Strategic Objective',
                priority: 'high',
                action_steps: [
                    { id: 1, text: 'Analyze constraints', done: true },
                    { id: 2, text: 'Execute implementation', done: false },
                    { id: 3, text: 'Verify outcomes', done: false },
                ],
            },
        };
    }

    return {};
};

export const SatelliteEngine = {
    /**
     * "Fire-and-Forget" Enrichment.
     * Runs after insert/update and does NOT block the UI Thread.
     * Uses op-sqlite (JSI) for database access.
     */
    async enrichSnippet(db: DB, snippetId: number, content: string, type: string) {
        if (__DEV__) console.log(`🛰️ Satellite: Processing Snippet #${snippetId} (${type})...`);

        try {
            // 1. Generate Content (Heavy Async Task)
            if (type !== 'fact' && type !== 'goal') return;

            const data = await mockAIProcess(content, type);

            if (Object.keys(data).length === 0) return;

            // 2. Write-Back to DB (Atomic Update)
            await db.execute(
                'UPDATE snippets SET utility_data = ? WHERE id = ?',
                [JSON.stringify(data), snippetId]
            );

            if (__DEV__) console.log(`✨ Satellite: Snippet #${snippetId} enriched!`);

            // 3. Trigger UI Refresh (Holographic Sync)
            // Informs the UI that data has changed, allowing FlashcardModal to re-read utility_data
            // if it pulls fresh from DB or if we trigger a global refresh.
            // Note: Current FlashcardModal implementation reads from 'node' prop. 
            // NeuralCanvas needs to reload nodes for the prop to update.
            useContextStore.getState().triggerNodeRefresh();

        } catch (error) {
            console.error('❌ Satellite Error:', error);
        }
    }
};
