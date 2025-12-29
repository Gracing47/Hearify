import { findSimilarSnippets, getDb } from '@/db';
import { useCTC } from '@/store/CognitiveTempoController';
import { useContextStore } from '@/store/contextStore';
import { SatelliteEngine } from './SatelliteEngine';

// Birth energy is modulated by CTC state

// Simple native queue to avoid ESM issues with p-queue
class SimpleQueue {
    private queue: (() => Promise<void>)[] = [];
    private running = 0;
    private concurrency = 2;

    add(task: () => Promise<void>) {
        this.queue.push(task);
        this.run();
    }

    private async run() {
        while (this.running < this.concurrency && this.queue.length > 0) {
            const task = this.queue.shift();
            if (task) {
                this.running++;
                task().finally(() => {
                    this.running--;
                    this.run();
                });
            }
        }
    }
}

class SatelliteInsertEngine {
    private insertQueue = new SimpleQueue();

    /**
     * 🚀 Orchestrates background processing after a core insert.
     * Runs non-blocking to ensure instant UI feedback.
     */
    async processPostInsert(snippetId: number, embeddingRich: Float32Array) {
        const startTime = Date.now();

        // Phase A2: Calculate birth energy from CTC state
        const ctcLimits = useCTC.getState().limits;
        const birthEnergyMultiplier = ctcLimits.birthEnergyMultiplier;

        // Queue background operations
        this.insertQueue.add(() => this.computeSemanticEdges(snippetId, embeddingRich));
        this.insertQueue.add(() => this.updateClusterCentroids(snippetId));
        // 🧠 CONTENT ENRICHMENT (Flashcards & Strategy)
        this.insertQueue.add(() => this.enrichNodeContent(snippetId));

        // After processing, trigger Horizon refresh with birth energy
        setTimeout(() => {
            const duration = Date.now() - startTime;
            console.log(`[Satellite] Pipeline complete for node ${snippetId}: ${duration}ms (birth energy: ${birthEnergyMultiplier.toFixed(2)})`);

            try {
                // 🚀 HOLOGRAPHIC SYNC: Trigger Horizon to reload nodes
                useContextStore.getState().triggerNodeRefresh();
            } catch (e) {
                // Store might not be ready
            }
        }, 100);
    }

    private async computeSemanticEdges(nodeId: number, embedding: Float32Array) {
        const db = getDb();
        const timestamp = Date.now();

        const similarNodes = await findSimilarSnippets(embedding, 12);
        let connectionCount = 0;

        for (const node of similarNodes) {
            if (node.id === nodeId) continue;

            const dist = (node as any).distance || 0;
            const similarity = 1 - dist;

            if (similarity > 0.55) {
                const edgeType = similarity > 0.85 ? 'strong' : 'weak';
                const visualPriority = Math.floor(similarity * 100);

                await db.execute(
                    'INSERT OR IGNORE INTO semantic_edges (source_id, target_id, weight, edge_type, visual_priority, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [nodeId, node.id, similarity, edgeType, visualPriority, timestamp]
                );

                await db.execute(
                    'INSERT OR IGNORE INTO semantic_edges (source_id, target_id, weight, edge_type, visual_priority, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [node.id, nodeId, similarity, edgeType, visualPriority, timestamp]
                );

                connectionCount++;

                await db.execute(
                    'UPDATE snippets SET connection_count = connection_count + 1 WHERE id = ?',
                    [node.id]
                );
            }
        }

        await db.execute(
            'UPDATE snippets SET connection_count = ? WHERE id = ?',
            [connectionCount, nodeId]
        );
    }

    private async updateClusterCentroids(nodeId: number) {
        const db = getDb();

        const snippetRes = await db.execute('SELECT cluster_id, x, y, z, importance FROM snippets WHERE id = ?', [nodeId]);
        const snippet = snippetRes.rows?.[0] as any;

        if (!snippet || !snippet.cluster_id) return;

        const clusterId = snippet.cluster_id;
        const clusterNodes = await db.execute('SELECT x, y, z, importance FROM snippets WHERE cluster_id = ?', [clusterId]);
        const nodes = clusterNodes.rows || [];

        if (nodes.length === 0) return;

        let sumX = 0, sumY = 0, sumZ = 0, sumImp = 0;
        for (const n of nodes as any[]) {
            sumX += n.x || 0;
            sumY += n.y || 0;
            sumZ += n.z || 0;
            sumImp += n.importance || 1;
        }

        const count = nodes.length;
        await db.execute(
            'INSERT OR REPLACE INTO cluster_centroids (cluster_id, x, y, z, node_count, avg_importance, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [clusterId, sumX / count, sumY / count, sumZ / count, count, sumImp / count, Date.now()]
        );
    }

    private async enrichNodeContent(nodeId: number) {
        const db = getDb();
        const res = await db.execute('SELECT content, type FROM snippets WHERE id = ?', [nodeId]);
        const row = res.rows?.[0] as any;
        if (row) {
            await SatelliteEngine.enrichSnippet(db, nodeId, row.content, row.type);
        }
    }
}

export const satelliteEngine = new SatelliteInsertEngine();
