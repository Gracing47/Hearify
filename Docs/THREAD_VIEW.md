# Thread View — Hub-and-Spoke Context Engine

> **Version:** 1.0  
> **Date:** 2024-12-28  
> **Philosophy:** Every thought is a hub with connections in all directions

---

## Overview

The Thread View is a deep-dive modal that shows a thought's full context using the **Hub-and-Spoke** model. Instead of a linear timeline, it visualizes relationships:

- **Upstream (Past):** What led to this thought
- **Focus (Center):** The selected thought
- **Downstream (Future):** What came from this thought
- **Lateral (Related):** Similar topics across time

---

## Architecture

```
ThreadScreen (Modal)
├── Header
│   ├── Back button
│   └── Title: "Thread View"
├── ScrollView
│   ├── ⬆️ UPSTREAM Section
│   │   ├── Section Header (blue)
│   │   └── ThreadNode[] (dimmed)
│   │       └── SteppedConnection
│   ├── 🎯 FOCUS HUB
│   │   ├── ThreadNode (focus, large)
│   │   └── Lateral Scroll (horizontal)
│   │       └── Related topic cards
│   └── ⬇️ DOWNSTREAM Section
│       ├── SteppedConnection (gradient)
│       ├── Section Header (green)
│       └── ThreadNode[] (highlight)
└── TrinityActionDock (fixed bottom)
    ├── 💡 Find Pattern
    ├── 🤔 Challenge
    └── ⚡ Action
```

---

## Data Model

### ThreadContext

```typescript
interface ThreadContext {
    focus: Snippet;           // The clicked node (center)
    
    upstream: {               // ⬆️ What came before
        nodes: Snippet[];
        relation: 'CAUSAL' | 'TEMPORAL';
    };
    
    downstream: {             // ⬇️ What comes after
        nodes: Snippet[];
        relation: 'IMPLICATION' | 'NEXT_STEP';
    };
    
    lateral: {                // ↔️ Related topics
        nodes: Snippet[];
        similarity: number;
    };
    
    meta: {
        loadedAt: number;
        hasMoreUpstream: boolean;
        hasMoreDownstream: boolean;
        hasMoreLateral: boolean;
    };
}
```

### AI Actions

```typescript
const AI_ACTIONS = {
    INSIGHT: {
        label: 'Find Pattern',
        emoji: '💡',
        prompt: (content) => `Analyze: "${content}". What pattern connects this?`,
    },
    CHALLENGE: {
        label: 'Challenge',
        emoji: '🤔',
        prompt: (content) => `Devil's advocate for: "${content}". What's overlooked?`,
    },
    NEXT_STEP: {
        label: 'Action',
        emoji: '⚡',
        prompt: (content) => `Derive a next step from: "${content}".`,
    },
};
```

---

## Contracts

### THREAD_CONTRACT

```typescript
export const THREAD_CONTRACT = {
    availability: {
        canOpen: (ctcMode) => ctcMode !== 'INTENT',
        autoCloseTimeout: 30000, // 30s idle closes thread
    },
    
    visualBehavior: {
        REFLECTION: {
            threadExpanded: true,
            aiActionsEnabled: true,
            motionScale: 1.0,
            showUpstream: true,
            showDownstream: true,
            showLateral: true,
        },
        AWARENESS: {
            threadExpanded: false,
            aiActionsEnabled: false,
            motionScale: 0.0,
            showUpstream: true,
            showDownstream: false,
            showLateral: false,
        },
        INTENT: {
            threadExpanded: false,
            aiActionsEnabled: false,
            motionScale: 0.0,
            showUpstream: false,
            showDownstream: false,
            showLateral: false,
        },
        IDLE: {
            threadExpanded: true,
            aiActionsEnabled: true,
            motionScale: 0.6,
            showUpstream: true,
            showDownstream: true,
            showLateral: true,
        },
    },
};
```

### THREAD_MOTION_BUDGET

```typescript
export const THREAD_MOTION_BUDGET = {
    maxActiveAnimations: 3,      // Focus Node + 2 neighbors
    scrollParallax: 0.15,
    transitionDuration: 300,     // Snappy, not floaty
    useSteppedGradients: true,   // No SVG
    maxUpstreamNodes: 5,
    maxDownstreamNodes: 5,
    maxLateralNodes: 8,
};
```

---

## ThreadService

**File:** `services/ThreadService.ts`

Fetches upstream, downstream, and lateral connections:

### Upstream Strategy
1. Find nodes connected via edges that are older
2. Fallback: Temporal proximity (most recent before focus)

### Downstream Strategy  
1. Find nodes connected via edges that are newer
2. Fallback: Goals created after focus

### Lateral Strategy
1. Same cluster label
2. Fallback: Same type

```typescript
export async function buildThreadContext(focusNode: Snippet): Promise<ThreadContext>
```

---

## Visual Components

### SteppedConnection

Zero-SVG connector using Views:

```typescript
const SteppedConnection = ({ direction, color, isGradient }) => (
    <View style={styles.connectorContainer}>
        <View style={[styles.connectorLine, { backgroundColor: color }]} />
        <View style={[styles.connectorDot, { backgroundColor: color }]} />
    </View>
);
```

### ThreadNode

Node card with variant styling:

| Variant | Use | Style |
|---------|-----|-------|
| `dimmed` | Upstream nodes | Subtle background |
| `focus` | Center node | Purple border, larger text |
| `highlight` | Downstream nodes | Green tint |

### TrinityActionDock

Fixed bottom bar with AI action buttons:
- Only visible when `aiActionsEnabled === true`
- Triggers satellite engine for AI responses
- Shows loading state during generation

---

## Color Palette

```typescript
export const THREAD_COLORS = {
    upstream: {
        line: '#3b82f6',    // Blue
        dot: '#60a5fa',
    },
    focus: {
        border: '#818cf8',  // Purple
        glow: 'rgba(129, 140, 248, 0.3)',
    },
    downstream: {
        line: '#22c55e',    // Green
        dot: '#4ade80',
    },
    lateral: {
        line: '#f59e0b',    // Amber
        dot: '#fbbf24',
    },
};
```

---

## File Structure

```
components/screens/ThreadScreen.tsx   # Main component
services/ThreadService.ts            # Data fetcher
types/ThreadTypes.ts                 # Type definitions
constants/contracts.ts               # THREAD_CONTRACT, THREAD_MOTION_BUDGET
```

---

## Exit Criteria

### Performance
- [ ] Opens in < 200ms
- [ ] 60fps scroll with 20 nodes

### UX & Logic
- [ ] Focus node visually centered and larger
- [ ] CTC respects: No AI in INTENT mode
- [ ] Auto-close after 30s idle

### AI Value
- [ ] "Challenge" creates new node in < 3s
- [ ] New node auto-connected via edge

---

## Future Enhancements

- [ ] Integrate with SatelliteEngine for real AI responses
- [ ] Manual connect functionality
- [ ] Animation on node creation
- [ ] Shared element transition from Chronicle
