# 🧠 Hearify App Architecture v4.0 — Third-Party Developer Guide

> **Version:** 4.0  
> **Last Updated:** 2026-01-05  
> **Philosophy:** Spatial thoughts, temporal conversation, archival memory, connected insights.  
> **Target Audience:** External developers, contributors, and integration partners.

---

## 📋 Table of Contents

1. [Executive Summary](#-executive-summary)
2. [Technology Stack](#️-technology-stack)
3. [Core Pillars](#️-core-pillars)
4. [Data Architecture](#-data-architecture)
5. [State Management](#-state-management)
6. [AI & Intelligence Layer](#-ai--intelligence-layer)
7. [Navigation System](#-navigation-system)
8. [File Structure](#-file-structure)
9. [Design Language](#-design-language)
10. [Getting Started](#-getting-started)
11. [Enhancement Ideas](#-enhancement-ideas)

---

## 📌 Executive Summary

**Hearify** is a React Native (Expo) application that transforms thought capture into a spatial, AI-enhanced experience. Users speak or type their thoughts, which are:

1. **Classified** into Facts, Feelings, or Goals
2. **Vectorized** for semantic similarity search
3. **Visualized** as a 3D neural network
4. **Connected** automatically via AI-powered edge detection

The app uses a **Trinity Interface**: three screens representing different cognitive modes (Orbit → Input, Horizon → Visualization, Chronicle → Archive).

---

## 🛠️ Technology Stack

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| **Framework** | React Native (Expo) | 54.x | Cross-platform mobile |
| **Language** | TypeScript | 5.9.x | Type safety |
| **Rendering** | @shopify/react-native-skia | 2.2.12 | GPU-accelerated canvas, shaders |
| **Animation** | react-native-reanimated | 4.1.x | 60fps worklet animations |
| **Gestures** | react-native-gesture-handler | 2.28.x | Simultaneous pan/pinch/tap |
| **Database** | @op-engineering/op-sqlite | 15.x | Native SQLite + vector extensions |
| **State** | Zustand | 5.x | Lightweight global state |
| **AI (Chat)** | OpenAI GPT-4o-mini | - | Fast conversational responses |
| **AI (TTS)** | OpenAI TTS-1-HD | - | High-quality text-to-speech |
| **AI (Reasoning)** | DeepSeek R1 | - | Deep insight generation |
| **Haptics** | expo-haptics | 15.x | Tactile feedback |
| **Blur Effects** | expo-blur | 15.x | iOS glassmorphism |

### Key Dependencies (package.json)

```json
{
  "dependencies": {
    "@shopify/react-native-skia": "2.2.12",
    "react-native-reanimated": "~4.1.1",
    "react-native-gesture-handler": "~2.28.0",
    "@op-engineering/op-sqlite": "^15.1.14",
    "zustand": "^5.0.2",
    "expo": "~54.0.30"
  }
}
```

---

## 🏗️ Core Pillars

The application rests on three interconnected screens, each representing a cognitive mode:

### 1. 🌌 Horizon (Spatial Cognition)
**Files:** `NeuralCanvas.tsx`, `HorizonScreen.tsx`

The **Horizon** is a 3D visualization of the user's mind as a neural network.

| Feature | Description |
|---------|-------------|
| **Nodes** | Each thought is a node with shape based on type |
| **Edges** | Semantic connections between related thoughts |
| **Physics** | "Raptor Physics" via Reanimated worklets |
| **LOD System** | Labels appear at higher zoom levels |
| **Neural Lenses** | Filter by type (EXPLORE/LEARN/STRATEGY/REFLECT) |

**Semantic Shapes:**
- **Hexagon** → Facts (Cyan `#00F0FF`)
- **Diamond** → Goals (Gold `#FFD700`)
- **Circle** → Feelings (Pink `#FF0055`)

**Gestures:**
- Pan → Navigate the canvas
- Pinch → Zoom in/out (precision-mapped)
- Tap Node → Open Thought Action Modal

### 2. ⚛️ Orbit (Temporal Cognition)
**Files:** `OrbitScreen.tsx`, `NeuralOrb.tsx`

The **Orbit** is the conversational interface — the "Now".

| Feature | Description |
|---------|-------------|
| **Thinking Orb** | Skia shader representing AI state |
| **Voice Input** | Real-time speech-to-text |
| **Text Input** | Manual thought entry |
| **Ghost Suggestions** | ACE-powered related thoughts |
| **Interruptible AI** | Stop AI mid-response |

### 3. 📜 Chronicle (Archival Cognition)
**Files:** `MemoryScreen.tsx`, `ThreadScreen.tsx`

The **Chronicle** is the memory archive — a timeline of all captured thoughts.

| Feature | Description |
|---------|-------------|
| **Timeline View** | SectionList grouped by date |
| **Insight Header** | Weekly summary with sparklines |
| **Shape Icons** | Same visual language as Horizon |
| **Time-Travel** | Tap card → Navigate to Horizon |

---

## 💾 Data Architecture

### Database Schema (`db/schema.ts`)

**Primary Table: `snippets`**
```sql
CREATE TABLE snippets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  type TEXT CHECK(type IN ('fact', 'feeling', 'goal')),
  sentiment TEXT CHECK(sentiment IN ('analytical', 'positive', 'creative', 'neutral')),
  topic TEXT DEFAULT 'misc',
  timestamp INTEGER NOT NULL,
  x REAL DEFAULT 0,           -- 3D position
  y REAL DEFAULT 0,
  z REAL DEFAULT 0,
  importance REAL DEFAULT 1.0,
  connection_count INTEGER DEFAULT 0,
  last_accessed INTEGER,
  cluster_id INTEGER,
  cluster_label TEXT,
  reasoning TEXT,             -- AI reasoning chain
  utility_data TEXT           -- JSON for personas (flashcards, etc.)
);
```

**Vector Tables (sqlite-vec):**
```sql
-- Fast search (384-dim for real-time)
CREATE VIRTUAL TABLE vec_snippets_fast USING vec0(
  id INTEGER PRIMARY KEY,
  embedding float[384]
);

-- Rich search (1536-dim for deep context)
CREATE VIRTUAL TABLE vec_snippets USING vec0(
  id INTEGER PRIMARY KEY,
  embedding float[1536]
);
```

**Supporting Tables:**
- `semantic_edges` — Pre-computed thought connections
- `cluster_centroids` — Cluster metadata for visualization
- `daily_deltas` — AI-generated daily summaries
- `feedback_signals` — User accept/reject for trust learning
- `external_resources` — MCP resource ingestion (planned)

### TypeScript Interface

```typescript
interface Snippet {
  id: number;
  cluster_id: number;
  content: string;
  type: 'fact' | 'feeling' | 'goal';
  sentiment: 'analytical' | 'positive' | 'creative' | 'neutral';
  topic: string;
  timestamp: number;
  embedding?: Float32Array;
  x: number;
  y: number;
  z: number;
  importance: number;
  connection_count: number;
  last_accessed: number | null;
  reasoning?: string;
  utility_data?: string;
}
```

---

## 🔄 State Management

All global state uses **Zustand** stores:

### 1. CognitiveTempoController (CTC)
**File:** `store/CognitiveTempoController.ts`

The "governor" of all motion and visual intensity:

```typescript
type CognitiveMode = 'IDLE' | 'AWARENESS' | 'INTENT' | 'REFLECTION';

interface CTCState {
  mode: CognitiveMode;
  limits: CTCLimits;  // Motion budget, camera permissions
  touch(): void;       // Reset stillness timer
  enterReflection(): void;  // Modal opened
  exitReflection(): void;   // Modal closed
}
```

**State Transitions:**
```
IDLE ──(touch canvas)──> AWARENESS
AWARENESS ──(gesture start)──> INTENT
INTENT ──(gesture end + 180ms)──> AWARENESS
AWARENESS ──(open modal)──> REFLECTION
REFLECTION ──(close modal)──> AWARENESS
AWARENESS ──(10s stillness)──> IDLE
```

### 2. ContextStore
**File:** `store/contextStore.ts`

Navigation and focus state:

```typescript
interface ContextState {
  activeScreen: 'horizon' | 'orbit' | 'chronicle';
  focusNodeId: number | null;
  navigateToNode(id: number): void;
  setActiveScreen(screen: string): void;
}
```

### 3. LensStore
**File:** `store/lensStore.ts`

Neural lens filtering mode:

```typescript
type LensMode = 'EXPLORE' | 'LEARN' | 'STRATEGY' | 'REFLECT';

interface LensState {
  mode: LensMode;
  setMode(mode: LensMode): void;
}
```

### 4. PredictionStore
**File:** `store/predictionStore.ts`

ACE predictions and feedback:

```typescript
interface PredictionState {
  predictions: Prediction[];
  tier: 'PREMIUM' | 'STANDARD' | 'ECO';
  setPredictions(p: Prediction[]): void;
  clearPredictions(): void;
}
```

---

## 🤖 AI & Intelligence Layer

### Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  AI Service Layer                        │
├─────────────────────────────────────────────────────────┤
│  openai-chat.ts     │ GPT-4o-mini responses             │
│  openai-tts.ts      │ TTS-1-HD speech synthesis         │
│  deepseek.ts        │ DeepSeek R1 reasoning             │
│  groq.ts            │ Fast fallback (Llama)             │
├─────────────────────────────────────────────────────────┤
│  SatelliteEngine.ts │ Main AI response orchestration    │
│  SatelliteInsertEngine.ts │ Snippet extraction from chat│
├─────────────────────────────────────────────────────────┤
│  AmbientConnectionEngine.ts │ Proactive suggestions     │
│  SemanticDedupService.ts    │ Duplicate detection       │
│  ThreadService.ts           │ Hub-and-spoke context     │
└─────────────────────────────────────────────────────────┘
```

### Ambient Connection Engine (ACE)

The ACE watches user context and surfaces relevant connections:

```typescript
class AmbientConnectionEngine {
  // Debounced search with tier-aware timing
  debouncedFind(input: string, callback): void;
  
  // Record user feedback for learning
  recordFeedback(nodeId: number, action: 'ACCEPT' | 'REJECT'): void;
  
  // Performance tiers
  setTier(tier: 'PREMIUM' | 'STANDARD' | 'ECO'): void;
}
```

**Debounce Timers:**
- PREMIUM: 300ms
- STANDARD: 500ms
- ECO: 3000ms

### Thread Context Engine

For deep-diving into a thought's connections:

```typescript
interface ThreadContext {
  focus: Snippet;              // Center node
  upstream: {                  // Past/Context
    nodes: Snippet[];
    relation: 'CAUSAL' | 'TEMPORAL';
  };
  downstream: {                // Future/Implications
    nodes: Snippet[];
    relation: 'IMPLICATION' | 'NEXT_STEP' | 'AI_INSIGHT';
  };
  lateral: {                   // Related topics
    nodes: Snippet[];
    similarity: number;
  };
}
```

---

## 🧭 Navigation System

### Trinity Triptych (`PanoramaScreen.tsx`)

A spatial canvas with edge-swipe navigation:

```
← HORIZON (Graph)  |  ORBIT (Chat) [START]  |  CHRONICLE (Archive) →
      Zone 1              Zone 2                    Zone 3
```

**Implementation:**
- 3x screen width canvas
- 40px transparent edge zones
- Spring animation with velocity prediction
- Synced with `contextStore.activeScreen`

### Thread View (`ThreadScreen.tsx`)

Modal overlay for hub-and-spoke context:

```
ThreadScreen (Modal)
├── Header (Back + Title)
├── ScrollView
│   ├── ⬆️ UPSTREAM (Context/Past)
│   ├── 🎯 FOCUS HUB (Center)
│   └── ⬇️ DOWNSTREAM (Implications)
└── TrinityActionDock (AI Actions)
    ├── 💡 Find Pattern
    ├── 🤔 Challenge
    └── ⚡ Action
```

---

## 📁 File Structure

```
Hearify/
├── app/                          # Expo Router entry
│   ├── _layout.tsx               # Root layout + GestureHandler
│   ├── onboarding.tsx            # First-time user flow
│   └── (tabs)/                   # Tab navigation
│
├── components/
│   ├── NeuralCanvas.tsx          # 🎯 Main 3D visualization (1400+ lines)
│   ├── NeuralLensesHUD.tsx       # Filter mode selector
│   ├── NeuralOrb.tsx             # Thinking orb shader
│   ├── GhostSuggestion.tsx       # ACE prediction cards
│   ├── ThoughtActionModal.tsx    # Node action menu
│   ├── FlashcardModal.tsx        # Flashcard generation
│   ├── ToastContainer.tsx        # Notification system
│   ├── navigation/
│   │   ├── PanoramaScreen.tsx    # Trinity triptych
│   │   └── MindLayout.tsx        # Screen wrapper
│   └── screens/
│       ├── HorizonScreen.tsx     # Graph view
│       ├── OrbitScreen.tsx       # Chat interface
│       ├── MemoryScreen.tsx      # Chronicle timeline
│       └── ThreadScreen.tsx      # Context deep-dive
│
├── constants/
│   ├── contracts.ts              # 🎯 All UX behavioral contracts
│   ├── neuralTokens.ts           # Design tokens (colors, spacing)
│   └── theme.ts                  # Theme constants
│
├── db/
│   ├── index.ts                  # Database initialization
│   └── schema.ts                 # 🎯 All table definitions
│
├── hooks/
│   ├── useCameraFlight.ts        # Animated camera transitions
│   ├── useEcoMode.ts             # Battery-aware performance
│   ├── useTTS.ts                 # Text-to-speech hook
│   └── useVoiceCapture.ts        # Speech-to-text hook
│
├── services/
│   ├── AmbientConnectionEngine.ts # 🎯 Proactive AI suggestions
│   ├── SatelliteEngine.ts         # AI response generation
│   ├── SatelliteInsertEngine.ts   # Snippet extraction
│   ├── SemanticDedupService.ts    # Duplicate detection
│   ├── ThreadService.ts           # Thread context builder
│   ├── DeltaService.ts            # Daily delta summaries
│   ├── openai-chat.ts             # GPT-4o-mini
│   ├── openai-tts.ts              # TTS-1-HD
│   ├── deepseek.ts                # DeepSeek R1
│   └── mcp/                       # MCP integrations (planned)
│
├── store/
│   ├── CognitiveTempoController.ts # 🎯 Motion governor
│   ├── contextStore.ts             # Navigation state
│   ├── lensStore.ts                # Neural lens mode
│   ├── predictionStore.ts          # ACE predictions
│   ├── toastStore.ts               # Notification queue
│   └── conversation.ts             # Chat history
│
├── types/
│   └── ThreadTypes.ts             # Thread data models
│
├── utils/
│   ├── nlp.ts                     # Tokenization, keyword extraction
│   ├── vectorMath.ts              # Cosine similarity, etc.
│   ├── textAnalysis.ts            # Text processing
│   ├── haptics.ts                 # Haptic feedback helpers
│   └── shapes.ts                  # Shape path generators
│
└── Docs/
    ├── MASTER_EXECUTION_PLAN.md   # Development roadmap
    ├── APP_ARCHITECTURE_V3.md     # This file
    ├── DEV_HANDOUT.md             # Sprint reports
    ├── NEURAL_CANVAS_SPEC.md      # Canvas specification
    ├── CHRONICLE_V2.md            # Chronicle features
    └── THREAD_VIEW.md             # Thread engine docs
```

---

## 🎨 Design Language: "Organic Immersion"

### Color Palette

| Purpose | Color | Hex |
|---------|-------|-----|
| Facts | Cyan | `#00F0FF` |
| Feelings | Pink | `#FF0055` |
| Goals | Gold | `#FFD700` |
| Focus/Accent | Purple | `#818cf8` |
| Background | Deep Black | `#0a0a12` |
| Surface | Dark Gray | `rgba(255,255,255,0.05)` |

### Typography
- System fonts (San Francisco on iOS, Roboto on Android)
- Monospace for data/stats

### Visual Effects
- **Glassmorphism:** BlurView on iOS, solid dark on Android
- **Haptics:** Rich tactile feedback on all interactions
- **Semantic Shapes:** Consistent hexagon/diamond/circle across screens

### Animation Principles
- All motion gated by CTC state
- Spring physics for natural feel
- 60fps target (30fps in Eco Mode)

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI
- iOS Simulator or Android Emulator (or physical device)

### Installation

```bash
# Clone the repository
git clone https://github.com/Hearify-Team/Hearify.git
cd Hearify

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your API keys

# Start development server
npx expo start --clear
```

### Environment Variables

```env
OPENAI_API_KEY=sk-...         # Required for chat + TTS
DEEPSEEK_API_KEY=...          # Optional for reasoning
GROQ_API_KEY=...              # Optional fallback
```

### Running on Device

```bash
# iOS Simulator
npx expo start --ios

# Android Emulator
npx expo start --android

# Physical device (scan QR code)
npx expo start
```

---

## 💡 Enhancement Ideas

Here are areas where third-party contributions would be valuable:

### 1. Performance Optimizations
- [ ] Implement node virtualization for 1000+ thoughts
- [ ] Add WebGL fallback for older devices
- [ ] Optimize vector search with approximate nearest neighbors

### 2. AI Enhancements
- [ ] Support for local LLMs (Ollama, llama.cpp)
- [ ] Multi-language NLP support
- [ ] Improved emotion detection

### 3. Visualization
- [ ] 3D cluster visualization (WebGL)
- [ ] Timeline heatmap view
- [ ] Export to knowledge graph formats (OWL, RDF)

### 4. Integrations
- [ ] Calendar integration (relate thoughts to events)
- [ ] Notion/Obsidian export
- [ ] Apple Health mood correlation

### 5. Accessibility
- [ ] VoiceOver/TalkBack optimization
- [ ] High contrast mode
- [ ] Reduced motion mode

### 6. Data & Privacy
- [ ] End-to-end encryption
- [ ] Local-only mode (no API calls)
- [ ] Data export/import (JSON, Markdown)

---

## 📞 Contact

For questions about the architecture or contribution guidelines, please open an issue on GitHub or contact the Hearify team.

---

*Built with ❤️ for the thinking human.*
