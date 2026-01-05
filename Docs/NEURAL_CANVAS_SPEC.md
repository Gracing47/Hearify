# Neural Canvas — Technical Documentation v3.0

> **File:** `components/NeuralCanvas.tsx`  
> **Purpose:** GPU-accelerated semantic visualization of user's thoughts  
> **Framework:** React Native + Skia + Reanimated

---

## Overview

The Neural Canvas is the core visualization engine for the "Neural Horizon" feature. It renders a floating constellation of thought nodes (snippets) with semantic edges, orbital physics, and CTC-controlled animations.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    NeuralCanvas                         │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Shader    │  │   Edges     │  │    Nodes        │  │
│  │ (Background)│  │ (NeuralEdge)│  │  (NeuralNode)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────┤
│            Gesture Layer (Pan + Pinch + Tap)            │
├─────────────────────────────────────────────────────────┤
│              CTC State Machine Integration              │
├─────────────────────────────────────────────────────────┤
│           Focus Navigation (Chronicle → Horizon)        │
└─────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. Background Shader
- **Type:** Skia RuntimeEffect (GLSL)
- **Features:** Deep space gradient + nebula effect + focus aura
- **Uniforms:** time, resolution, camera offset, scale, focus position

### 2. NeuralNode (Sub-component)
- **Rendering:** Semantic shapes with blur effects
- **Shapes (v3.0):**
  - **Hexagon** → Facts (Cyan `#00F0FF`)
  - **Diamond** → Goals (Gold `#FFD700`)
  - **Circle** → Feelings (Pink `#FF0055`)
- **Animation:** Breathing (6s cycle, 2% amplitude), drift, synapse firing
- **LOD Labels:** Text appears at zoom > 0.7x with blur-reveal

### 3. NeuralEdge (Sub-component)
- **Rendering:** Lines between connected nodes
- **Animation:** CTC-modulated opacity, subtle pulsing
- **Data Source:** `edges` table in SQLite

### 4. Gesture System
- **Pan:** Single finger, 35px vertical dead zone
- **Pinch:** Two fingers, piecewise logarithmic scaling
- **Tap:** Node selection → opens ThoughtActionModal/FlashcardModal

### 5. Focus Navigation (v3.0)
- Responds to `focusNodeId` from `contextStore`
- Animates camera to center on the selected node
- Auto-zooms to 1.0x if currently below 0.8x
- Clears focus after 500ms

---

## State Management

### Shared Values (Reanimated)
```typescript
scale           // Camera zoom level (0.2 - 3.0)
translateX/Y    // Camera position
posX/posY       // Float32Array of node positions
time            // Animation time in seconds
labelOpacity    // Fade for text labels
cameraSettled   // True 180ms after last gesture
```

### CTC Integration
The canvas subscribes to the Cognitive Tempo Controller:
- **IDLE:** Full breathing, ambient motion
- **AWARENESS:** Reduced breathing on touch
- **INTENT:** Minimal motion, precision mode
- **REFLECTION:** All motion paused (modal open)

### Context Store Integration (v3.0)
```typescript
// Subscribe to focus navigation
const activeFocusNodeId = useContextStore(state => state.focusNodeId);

// When focusNodeId changes, camera animates to that node
useEffect(() => {
    if (activeFocusNodeId === null) return;
    
    const nodeIndex = nodes.findIndex(n => n.id === activeFocusNodeId);
    if (nodeIndex === -1) return;
    
    const x = posX.value[nodeIndex];
    const y = posY.value[nodeIndex];
    
    translateX.value = withSpring(-x, { damping: 20, stiffness: 100 });
    translateY.value = withSpring(-y, { damping: 20, stiffness: 100 });
    
    if (scale.value < 0.8) {
        scale.value = withSpring(1.0, { damping: 15, stiffness: 80 });
    }
}, [activeFocusNodeId, nodes]);
```

---

## Physics Engine

### Orbital Constellation
- Nodes orbit around center using golden angle distribution
- Base layout computed once on data load
- Radius based on node index (inner = newer)
- Jitter applied for organic feel

### Breathing
- 6-second cycle
- 2% amplitude (scale 0.98 - 1.02)
- Phase offset per node for staggered effect
- Disabled during INTENT/REFLECTION modes

### Time-Normalized Physics
- Delta-time integration for consistent behavior across framerates
- `dt = dtMs / 16.666` normalization factor

---

## Performance Optimizations

1. **React.memo** on NeuralNode and NeuralEdge
2. **useDerivedValue** for all shared value access
3. **Float32Array** for position buffers (zero-copy)
4. **Inline constants** in worklets (no function calls)
5. **Grid-based collision** for label placement
6. **Camera settle detection** for label reveal timing

---

## Props Interface

```typescript
interface NeuralCanvasProps {
    layoutY?: SharedValue<number>;  // From parent for swipe coordination
}
```

---

## Neural Lenses HUD (v3.0)

**File:** `components/NeuralLensesHUD.tsx`

Filter modes accessible via bottom toolbar in HorizonScreen:

| Mode | Icon | Color | Effect |
|------|------|-------|--------|
| EXPLORE | Compass | Purple | All nodes visible |
| LEARN | Book | Cyan | Facts highlighted |
| STRATEGY | Flag | Gold | Goals highlighted |
| REFLECT | Heart | Pink | Feelings highlighted |

Uses `useLensStore` for global filter state.

---

## Database Schema

### snippets
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| content | TEXT | Thought text |
| type | TEXT | 'fact' / 'feeling' / 'goal' |
| importance | REAL | 0.0 - 1.0 salience score |
| timestamp | TEXT | ISO timestamp |
| cluster_label | TEXT | Semantic cluster name |
| cluster_id | INTEGER | Cluster identifier |

### edges
| Column | Type | Description |
|--------|------|-------------|
| source_id | INTEGER | FK to snippets |
| target_id | INTEGER | FK to snippets |
| weight | REAL | Connection strength |

---

## Focus Navigation Flow (v3.0)

```
Chronicle Card Tap
       ↓
navigateToNode(nodeId)
       ↓
contextStore updates:
  - focusNodeId = nodeId
  - activeScreen = 'horizon'
       ↓
PanoramaScreen animates to Horizon zone
       ↓
NeuralCanvas useEffect detects focusNodeId
       ↓
Camera animates to node position with spring
       ↓
Focus cleared after 500ms timeout
```

---

## LOD (Level of Detail) System

| LOD | Scale Range | Labels | Max Labels | Node Detail |
|-----|-------------|--------|------------|-------------|
| LOD1 | 0.2 - 0.7 | Hidden | 0 | Low |
| LOD2 | 0.7 - 1.2 | Visible | 12 | Medium |
| LOD3 | 1.2 - 3.0 | Visible | 6 (focused) | High |

Labels appear with blur-reveal animation after camera settles.

---

## Contracts Reference

### ZOOM_CONTRACT
```typescript
{
    minScale: 0.2,
    maxScale: 3.0,
    initialScale: 0.6,
    friction: 0.02,
    snap: {
        enabled: true,
        velocityThreshold: 100,
        magnetRadius: 50
    }
}
```

### BREATHING_CONTRACT
```typescript
{
    enabledStates: ['IDLE', 'AWARENESS'],
    animation: {
        cycle: 6000,
        amplitude: { scale: [0.98, 1.02] }
    }
}
```

---

## Known Limitations

1. **Edge Glow:** Currently basic lines, no advanced glow shader
2. **Cluster Boundaries:** Convex hull not yet implemented
3. **3-Layer Z-Depth:** All nodes on same layer
4. **Performance:** May slow with 100+ nodes
5. **Rotation:** Implemented but rarely used

---

## Future Enhancements

- [ ] Edge glow shader with thickness based on weight
- [ ] Convex hull cluster visualization
- [ ] Starred node effect (dashed ring + pulse)
- [ ] Minimap for navigation recovery
- [ ] Thread View integration (Hub-and-Spoke)
- [ ] Semantic dimming based on Neural Lens mode

---

## Usage Example

```tsx
import { NeuralCanvas } from '@/components/NeuralCanvas';

// Inside HorizonScreen
<NeuralCanvas layoutY={parentTranslateX} />
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@shopify/react-native-skia` | GPU rendering (Canvas, Shaders) |
| `react-native-reanimated` | Animations & shared values |
| `react-native-gesture-handler` | Touch handling |
| `expo-haptics` | Tactile feedback |
| `@op-engineering/op-sqlite` | Local database |
| `zustand` | State management (CTC, Context) |
