/**
 * Semantic Intelligence Service
 * 
 * Orchestrates the "Insight Engine":
 * 1. Community Detection (Louvain)
 * 2. Cluster Labeling (AI)
 * 3. Pattern Detection (Bridges, Voids, Echo Chambers)
 */

import {
    getAllClusters,
    getAllSnippetsWithFastEmbeddings,
    updateSnippetCluster,
    upsertCluster
} from '../db';
import { Louvain, buildGraphFromSnippets } from '../utils/louvain';
import { generateClusterLabel } from './openai';

export class IntelligenceService {
    /**
     * Run the periodic clustering process
     */
    static async runClustering() {
        console.log('[Intelligence] Starting Community Detection...');
        const snippets = await getAllSnippetsWithFastEmbeddings();
        if (snippets.length < 3) return;

        const graph = buildGraphFromSnippets(snippets, 0.75);
        const louvain = new Louvain(graph);
        const communityMap = louvain.detect();

        // Group by community
        const clusterGroups = new Map<number, number[]>(); // commId -> nodeIds
        communityMap.forEach((commId, nodeId) => {
            if (!clusterGroups.has(commId)) clusterGroups.set(commId, []);
            clusterGroups.get(commId)!.push(nodeId);
        });

        // Update database
        for (const [commId, nodeIds] of clusterGroups.entries()) {
            if (nodeIds.length < 2) continue; // Ignore single-node "clusters"

            // Generate AI Label
            const clusterSnippets = snippets.filter(s => nodeIds.includes(s.id));
            const label = await generateClusterLabel(clusterSnippets);

            const clusterIdInDb = await upsertCluster(null, label, nodeIds.length);

            for (const nodeId of nodeIds) {
                await updateSnippetCluster(nodeId, clusterIdInDb);
            }
        }

        console.log(`[Intelligence] detected ${clusterGroups.size} communities.`);
    }

    /**
     * Insight Engine: Bridges, Voids, Echo Chambers
     */
    static async detectInsights() {
        const snippets = await getAllSnippetsWithFastEmbeddings();
        const clusters = await getAllClusters();

        const insights = [];

        // 1. THOUGHT BRIDGES (Unexpected Connections)
        // Find snippets from DIFFERENT clusters with high similarity
        for (let i = 0; i < snippets.length; i++) {
            for (let j = i + 1; j < snippets.length; j++) {
                const s1 = snippets[i];
                const s2 = snippets[j];
                if (s1.cluster_id && s2.cluster_id && s1.cluster_id !== s2.cluster_id) {
                    const sim = this.cosineSimilarity(s1.embedding, s2.embedding);
                    if (sim > 0.82) {
                        insights.push({
                            type: 'bridge',
                            nodes: [s1.id, s2.id],
                            description: `Unexpected link between thoughts in different clusters.`
                        });
                    }
                }
            }
        }

        // 2. ECHO CHAMBERS (Repetitive Thinking)
        for (const cluster of clusters) {
            if (cluster.node_count > 15) {
                insights.push({
                    type: 'echo',
                    clusterId: cluster.id,
                    description: `Densely packed cluster: "${cluster.label}". You might be over-focusing here.`
                });
            }
        }

        // 3. KNOWLEDGE VOIDS (Isolated Thoughts)
        const isolated = snippets.filter(s => !s.cluster_id);
        if (isolated.length > 5) {
            insights.push({
                type: 'void',
                description: `You have several isolated thoughts. Try linking them to existing goals!`
            });
        }

        return insights;
    }


    private static cosineSimilarity(a?: Float32Array, b?: Float32Array): number {
        if (!a || !b) return 0;
        let dot = 0, mA = 0, mB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            mA += a[i] * a[i];
            mB += b[i] * b[i];
        }
        return dot / (Math.sqrt(mA) * Math.sqrt(mB) || 1);
    }
}
