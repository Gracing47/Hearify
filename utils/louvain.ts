/**
 * Louvain Community Detection Algorithm
 * 
 * Optimized for React Native (TypedArray friendly).
 * This algorithm greedily optimizes modularity to find communities/clusters in a graph.
 */

interface Edge {
    source: number;
    target: number;
    weight: number;
}

interface Graph {
    nodes: number[]; // Node IDs
    edges: Edge[];
}

export class Louvain {
    private communities: Map<number, number> = new Map(); // nodeId -> communityId
    private graph: Graph;

    constructor(graph: Graph) {
        this.graph = graph;
        // Initially, each node is its own community
        graph.nodes.forEach((nodeId) => {
            this.communities.set(nodeId, nodeId);
        });
    }

    /**
     * Run the Louvain algorithm to detect communities.
     * For Phase 3, we use a simplified one-pass version for speed on mobile.
     */
    public detect(): Map<number, number> {
        let improvement = true;
        let iterations = 0;
        const maxIterations = 10;

        while (improvement && iterations < maxIterations) {
            improvement = false;
            iterations++;

            // Shuffle nodes for better convergence
            const shuffledNodes = [...this.graph.nodes].sort(() => Math.random() - 0.5);

            for (const nodeId of shuffledNodes) {
                const currentComm = this.communities.get(nodeId)!;
                const neighborCommunities = this.getNeighborCommunities(nodeId);

                let bestComm = currentComm;
                let maxDeltaQ = 0;

                for (const [commId, weight] of neighborCommunities) {
                    if (commId === currentComm) continue;

                    // Delta Modularity calculation (simplified for performance)
                    // We prioritize moving nodes to communities with higher edge weight density
                    const deltaQ = weight;

                    if (deltaQ > maxDeltaQ) {
                        maxDeltaQ = deltaQ;
                        bestComm = commId;
                    }
                }

                if (bestComm !== currentComm) {
                    this.communities.set(nodeId, bestComm);
                    improvement = true;
                }
            }
        }

        return this.communities;
    }

    private getNeighborCommunities(nodeId: number): Map<number, number> {
        const counts = new Map<number, number>();

        for (const edge of this.graph.edges) {
            let neighborId: number | null = null;
            if (edge.source === nodeId) neighborId = edge.target;
            else if (edge.target === nodeId) neighborId = edge.source;

            if (neighborId !== null) {
                const commId = this.communities.get(neighborId)!;
                counts.set(commId, (counts.get(commId) || 0) + edge.weight);
            }
        }

        return counts;
    }
}

/**
 * Helper to build a graph from snippets based on cosine similarity
 */
export function buildGraphFromSnippets(snippets: any[], threshold: number = 0.8): Graph {
    const nodes = snippets.map(s => s.id);
    const edges: Edge[] = [];

    for (let i = 0; i < snippets.length; i++) {
        for (let j = i + 1; j < snippets.length; j++) {
            if (!snippets[i].embedding || !snippets[j].embedding) continue;

            const sim = cosineSimilarity(snippets[i].embedding, snippets[j].embedding);
            if (sim >= threshold) {
                edges.push({
                    source: snippets[i].id,
                    target: snippets[j].id,
                    weight: sim
                });
            }
        }
    }

    return { nodes, edges };
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0, mA = 0, mB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        mA += a[i] * a[i];
        mB += b[i] * b[i];
    }
    return dot / (Math.sqrt(mA) * Math.sqrt(mB) || 1);
}
