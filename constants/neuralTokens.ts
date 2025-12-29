/**
 * 🎨 NEURAL HORIZON — Design Tokens v2.0
 * Single source of truth for all visual constants.
 * Import this in all visual components.
 */

export const NEURAL_TOKENS = {
    colors: {
        background: '#000000',
        backgroundGradient: 'linear-gradient(180deg, #000000 0%, #0A0A14 100%)',

        node: {
            fact: { base: '#00E5FF', glow: '#00B8D4', shadow: 'rgba(0, 229, 255, 0.6)' },
            feeling: { base: '#FF4D8B', glow: '#E91E63', shadow: 'rgba(255, 77, 139, 0.6)' },
            goal: { base: '#FFD700', glow: '#FFA726', shadow: 'rgba(255, 215, 0, 0.7)' }
        },

        edge: {
            default: 'rgba(255, 255, 255, 0.15)',
            active: 'rgba(255, 255, 255, 0.4)',
            cluster: 'rgba(100, 180, 255, 0.2)'
        },

        text: {
            primary: '#FFFFFF',
            secondary: 'rgba(255, 255, 255, 0.7)',
            muted: 'rgba(255, 255, 255, 0.4)'
        }
    },

    spacing: {
        node: {
            minRadius: 12,
            maxRadius: 28,
            baseRadius: 16,
            magnetRadius: (scale: number) => 80 / scale
        },
        cluster: {
            padding: 20,
            minDistance: 100
        },
        label: {
            offsetY: 8,
            padding: 8,
            gridCellSize: 40
        }
    },

    animation: {
        zoom: {
            friction: 0.92,
            minScale: 0.2,
            maxScale: 3.0,
            initialScale: 0.6,
            snap: {
                damping: 18,
                stiffness: 150,
                mass: 0.5,
                velocityThreshold: 200
            }
        },

        breathing: {
            cycle: 6000,         // 6s (not 4s — calmer)
            amplitude: 0.02,     // 2% (not 5% — subtler)
            easing: 'inOut(sine)'
        },

        labels: {
            revealDuration: 300,
            settleDelay: 180,
            easing: 'out(cubic)',
            blurStart: 8,
            blurEnd: 0
        }
    },

    budgets: {
        motion: {
            maxActiveNodes: 50,
            maxCameraMovesPerSecond: 0.5,
            maxEdgeActivityClusters: 1
        },

        labels: {
            LOD1: 0,
            LOD2: 12,
            LOD3: 6
        },

        attention: {
            highSalience: 3,     // Top 3 get full glow (1.0)
            mediumSalience: 10,  // Top 10 get medium glow (0.6)
            lowGlow: 0.3
        }
    }
} as const;

// Type exports for TypeScript consumers
export type NodeType = 'fact' | 'feeling' | 'goal';
export type NodeColors = typeof NEURAL_TOKENS.colors.node;
