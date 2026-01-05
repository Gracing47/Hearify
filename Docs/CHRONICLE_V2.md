# Chronicle 2.0 — The Neural Archive

> **Version:** 2.0  
> **Date:** 2024-12-28  
> **Philosophy:** From "data display" to "knowledge generation"

---

## Overview

Chronicle has been transformed from a simple grid of cards into **The Neural Archive** — a McKinsey-style intelligent dashboard that shows not just *what* happened, but *why* and *what it means*.

---

## Architecture

```
MemoryScreen (Chronicle 2.0)
├── Insight Header ("The Analyst")
│   ├── Weekly summary
│   ├── Sparkline chart (7 days)
│   └── Shape icon stats
├── Filter Pills
│   ├── All / Goals / Feelings / Facts
│   └── Shape icons for visual consistency
├── Timeline View ("The Time-Stream")
│   ├── SectionList (grouped by date)
│   └── TimelineItem (memoized)
│       ├── Vertical timeline line
│       ├── Shape node (Hexagon/Diamond/Circle)
│       └── Content card
└── Empty State
```

---

## Key Components

### 1. Insight Header

The "Weekly Insight" widget provides at-a-glance analysis:

```typescript
interface InsightHeaderProps {
    snippets: Snippet[];
    stats: { total: number; facts: number; feelings: number; goals: number };
}
```

**Features:**
- **Dominant Type Detection:** Identifies most frequent thought type
- **Weekly Activity:** Shows 7-day thought volume
- **Sparkline Chart:** View-based bar chart (no SVG dependencies)
- **Shape Icons:** Visual consistency with Horizon

### 2. Timeline View

Replaces the previous grid with a chronological timeline:

**Grouping Logic:**
- Today
- Yesterday
- Weekday name (for last 7 days)
- Date (for older entries)

**Timeline Item Structure:**
```
┌────────────────────────────────────────┐
│  ●  [Shape Node]                       │
│  │                                     │
│  │  ┌─────────────────────────────┐   │
│  │  │ TYPE    TIME                │   │
│  │  │ Content text...             │   │
│  │  │ [View in Horizon] btn       │   │
│  │  └─────────────────────────────┘   │
│  │                                     │
└──┼─────────────────────────────────────┘
   │
```

### 3. Shape Icons

View-based CSS shapes matching Horizon nodes:

| Type | Shape | Color | Implementation |
|------|-------|-------|----------------|
| Fact | Hexagon | `#00F0FF` | Rotated square with borderRadius |
| Goal | Diamond | `#FFD700` | Rotated square |
| Feeling | Circle | `#FF0055` | Circle with borderRadius |

---

## Performance Optimizations

1. **React.memo** on TimelineItem with custom comparison
2. **Removed animation delays** (no `SlideInRight.delay()`)
3. **SectionList** with `stickySectionHeadersEnabled={false}`
4. **Sparkline uses Views** instead of SVG (no native module)

---

## Navigation Integration

### Time-Travel Navigation

When a card is tapped:
1. `Haptics.impactAsync()` for feedback
2. `navigateToNode(snippetId)` called
3. Context store updates:
   - `focusNodeId = snippetId`
   - `activeScreen = 'horizon'`
4. PanoramaScreen scrolls to Horizon
5. NeuralCanvas centers camera on node

### Code Flow
```typescript
const handleNavigateToNode = useCallback((snippetId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    useContextStore.getState().navigateToNode(snippetId);
}, []);
```

---

## Filter System

Filter pills at the top allow type-based filtering:

```typescript
const [filter, setFilter] = useState<'all' | 'fact' | 'feeling' | 'goal'>('all');

const filteredSnippets = filter === 'all'
    ? snippets
    : snippets.filter(s => s.type === filter);
```

Each pill shows the corresponding shape icon for visual consistency.

---

## Data Model

Uses same `Snippet` type from `db/schema.ts`:

```typescript
interface Snippet {
    id: number;
    content: string;
    type: 'fact' | 'feeling' | 'goal';
    timestamp: string;
    importance: number;
    cluster_label?: string;
}
```

---

## File Structure

```
components/screens/MemoryScreen.tsx
├── TYPE_CONFIG          # Color/icon mapping
├── ShapeIcon            # CSS-based shapes
├── Sparkline            # View-based bar chart
├── InsightHeader        # Weekly summary widget
├── TimelineItem         # Memoized list item
└── MemoryScreen         # Main component
```

---

## Dependencies

- `react-native-reanimated` — Animations
- `expo-haptics` — Tactile feedback
- `expo-blur` — BlurView for header
- `expo-linear-gradient` — Backgrounds
- `@expo/vector-icons` — Ionicons

---

## Future Enhancements

- [ ] Pattern Deck ("Strategy" cards with AI insights)
- [ ] Thread View integration (tap to open Hub-and-Spoke)
- [ ] Semantic search
- [ ] Export/share functionality
- [ ] Pull-to-refresh with visual feedback
