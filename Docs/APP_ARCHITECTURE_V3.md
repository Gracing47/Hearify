# Hearify App Architecture v3.0 — The Neural Archive Edition

> **Version:** 3.0 (Chronicle 2.0 + Thread View)  
> **Date:** 2024-12-28  
> **Philosophy:** Spatial thoughts, temporal conversation, archival memory, connected insights.

---

## 🏗️ Core Pillars

The application is built upon three distinct but interconnected pillars, representing different modes of cognition:

### 1. 🌌 Horizon (Spatial Cognition)
**Implementation:** `NeuralCanvas.tsx`, `HorizonScreen.tsx`

The **Horizon** is the spatial representation of the user's mind. It visualizes thoughts as a living, breathing neural network.

*   **Visual Logic:** Nodes orbit in concentric rings based on recency and importance.
*   **Semantic Shapes (v3.0):**
    *   **Hexagon** → Facts (Cyan `#00F0FF`)
    *   **Diamond** → Goals (Gold `#FFD700`)
    *   **Circle** → Feelings (Pink `#FF0055`)
*   **Physics:** "Raptor Physics" engine using `react-native-reanimated` Worklets and SharedBuffers (Float32Array) for zero-copy 60/120fps performance.
*   **Interaction:**
    *   **Drag/Pan:** Explore the mind map.
    *   **Pinch/Rotate:** Deep zoom into details (LOD System).
    *   **Tap Node:** Opens Thought Action Modal with connected actions.
*   **Neural Lenses HUD (v3.0):**
    *   **EXPLORE** - Default view, all nodes visible
    *   **LEARN** - Facts highlighted
    *   **STRATEGY** - Goals highlighted
    *   **REFLECT** - Feelings highlighted
*   **Focus Navigation (v3.0):** Clicking a Chronicle card auto-navigates to Horizon and centers camera on the selected node.

### 2. ⚛️ Orbit (Temporal Cognition)
**Implementation:** `OrbitScreen.tsx`, `ThinkingOrb.tsx`

The **Orbit** is the "Now". It's the conversational interface where users interact with the AI via Voice or Text.

*   **Thinking Orb:** A fluid shader (`Skia`) representing the AI's listening/processing state.
*   **Live Transcription:** Real-time speech-to-text integration.
*   **AI Models (v3.0):**
    *   **GPT-4o-mini** - Fast, affordable responses
    *   **OpenAI TTS-1-HD** - High-quality text-to-speech

### 3. 📜 Chronicle (Archival Cognition) — v3.0 "Neural Archive"
**Implementation:** `MemoryScreen.tsx`, `ThreadScreen.tsx`

The **Chronicle** has been transformed from a simple list into **The Neural Archive** — a McKinsey-style intelligent dashboard.

#### Chronicle 2.0 Features:

*   **Insight Header ("The Analyst"):**
    *   Weekly summary with dominant focus area
    *   Sparkline chart showing 7-day activity
    *   Shape icons for quick type counts (Facts/Feelings/Goals)

*   **Timeline View ("The Time-Stream"):**
    *   `SectionList` grouped by date (Today, Yesterday, Weekday, Date)
    *   Vertical timeline with connected shape nodes
    *   Memoized items for 60fps scroll performance

*   **Shape Icons (Visual Consistency):**
    *   Same Hexagon/Diamond/Circle shapes as Horizon
    *   Reinforces mental model across screens

*   **Time-Travel Navigation:**
    *   Tap any card → Navigate to Horizon with camera focused on that node
    *   Haptic feedback on interaction

---

## 🧵 Thread View (v3.0) — Hub-and-Spoke Context Engine

**Implementation:** `ThreadScreen.tsx`, `ThreadService.ts`, `ThreadTypes.ts`

A deep-dive modal that shows a thought's full context using the **Hub-and-Spoke** model:

### Architecture:
```
ThreadScreen (Modal)
├── Header (Back + Title)
├── ScrollView
│   ├── ⬆️ UPSTREAM (Context/Past)
│   │   └── ThreadNode (dimmed) + SteppedConnection
│   ├── 🎯 FOCUS HUB (Center)
│   │   ├── ThreadNode (focus, large)
│   │   └── Lateral Scroll (related topics)
│   └── ⬇️ DOWNSTREAM (Implications/Future)
│       └── ThreadNode (highlight)
└── TrinityActionDock (AI Actions)
    ├── 💡 Find Pattern
    ├── 🤔 Challenge
    └── ⚡ Action
```

### Data Model (`ThreadTypes.ts`):
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
}
```

### Contracts (`contracts.ts`):
*   **CTC Mode INTENT:** Thread blocked, no AI actions
*   **CTC Mode IDLE:** Auto-close after 30s
*   **Motion Budget:** Max 3 animated nodes simultaneously

---

## 🔗 The Unifier: Thought Action Card

**Implementation:** `ThoughtActionModal.tsx`, `FlashcardModal.tsx`

The **Thought Action Card** bridges the Spatial (Horizon) and Actionable layers.

*   **Connected Animation:** Card expands from node's coordinate using Spring Physics.
*   **Functions:**
    *   **Reflect:** Start a deeper AI conversation.
    *   **Chronicle:** View history/context in Thread View.
    *   **Star:** Mark as critical (visual boost on Horizon).
    *   **Connect:** Manually link to other nodes.

---

## 🌐 Navigation: Trinity Triptych (v3.0)

**Implementation:** `PanoramaScreen.tsx`

A spatial canvas (3x screen width) with edge-swipe navigation:

```
 ← HORIZON (Graph)  |  ORBIT (Chat) [START]  |  CHRONICLE (Archive) →
       Zone 1              Zone 2                    Zone 3
```

*   **Edge Swipe Zones:** 40px transparent overlays at screen edges
*   **Separate Gesture Instances:** Left and right edges use independent gestures
*   **Spring Animation:** Smooth transitions with velocity-based prediction
*   **Zone Sync:** `contextStore.activeScreen` syncs with visual position

---

## 🛠️ Technical Stack (v3.0)

| Category | Technology |
|----------|------------|
| **Rendering** | `@shopify/react-native-skia` (Canvas, Shaders, Effects) |
| **Animation** | `react-native-reanimated` (Worklets, Shared Values) |
| **State** | `zustand` (CTC, ContextStore, LensStore) |
| **Database** | `op-sqlite` (Local Vector DB) |
| **Gestures** | `react-native-gesture-handler` (Simultaneous Pan/Pinch/Rotation) |
| **AI** | OpenAI GPT-4o-mini, TTS-1-HD |
| **Haptics** | `expo-haptics` (Selection, Impact, Notification) |

---

## 📁 Key Files & Folders

```
components/
├── NeuralCanvas.tsx       # Horizon graph rendering + physics
├── NeuralLensesHUD.tsx    # Filter mode selector
├── navigation/
│   └── PanoramaScreen.tsx # Trinity triptych navigation
└── screens/
    ├── HorizonScreen.tsx  # Graph view wrapper
    ├── OrbitScreen.tsx    # Chat interface
    ├── MemoryScreen.tsx   # Chronicle 2.0 timeline
    └── ThreadScreen.tsx   # Hub-and-Spoke context view

constants/
├── contracts.ts           # All UX contracts (CTC, Zoom, LOD, Thread)
└── neuralTokens.ts        # Design tokens

services/
├── SatelliteEngine.ts     # AI response generation
├── SatelliteInsertEngine.ts # Snippet extraction
└── ThreadService.ts       # Thread context builder

store/
├── contextStore.ts        # Global navigation state
├── lensStore.ts           # Neural lens mode
└── CognitiveTempoController.ts # CTC state machine

types/
└── ThreadTypes.ts         # Thread data model
```

---

## 🎨 Design Language: "Organic Immersion"

*   **Colors:**
    *   Cyan `#00F0FF` (Facts)
    *   Pink `#FF0055` (Feelings)
    *   Gold `#FFD700` (Goals)
    *   Purple `#818cf8` (Focus/Accent)
*   **Typography:** System Fonts (San Francisco/Roboto) for max legibility.
*   **Feel:**
    *   **Glassmorphism:** Blur interactions (BlurView on iOS, solid dark on Android).
    *   **Haptics:** Rich tactile feedback on all interactions.
    *   **Semantic Shapes:** Consistent hexagon/diamond/circle across all screens.
