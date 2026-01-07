# 🚀 Hearify 2026 — Master Development Plan

> **Version:** 4.0  
> **Last Updated:** 2026-01-05  
> **Philosophy:** "Spatial thoughts, temporal conversation, archival memory, connected insights."  
> **Core Principles:** Invisible AI, True Spatial Depth, Battery-Aware Performance, Trust-First Design

---

## � Table of Contents

1. [Vision & Purpose](#-vision--purpose)
2. [Development Timeline](#-development-timeline)
3. [Phase 0: Foundation (Contracts & Types)](#️-phase-0-foundation-contracts--types)
4. [Sprint 1: Core Neural OS — ✅ COMPLETE](#-sprint-1-core-neural-os--complete)
5. [Sprint 2: Deep Mind — 🚧 IN PROGRESS](#-sprint-2-deep-mind--in-progress)
6. [Sprint 3: Future Vision](#-sprint-3-future-vision)
7. [Contributing Guidelines](#-contributing-guidelines)

---

## 🎯 Vision & Purpose

Hearify is a **neural architecture for thought** — transforming the way humans capture, organize, and connect their ideas. Unlike traditional note-taking apps, Hearify treats thoughts as living entities in a spatial network.

### Key Differentiators:
- **Voice-First**: Capture thoughts naturally via speech
- **Spatial Visualization**: See your mind as a neural network
- **Semantic Understanding**: AI understands context and connections
- **Trust-First AI**: Suggestions are explainable and learnable

---

## 📅 Development Timeline

| Phase | Focus | Status |
|-------|-------|--------|
| Phase 0 | Foundation (Contracts, Types) | ✅ Complete |
| Sprint 1.1 | Ambient Connection Engine | ✅ Complete |
| Sprint 1.2 | Nervous System (Auto-Pilot) | ✅ Complete |
| Sprint 1.3 | Trust Engine (Privacy & Control) | ✅ Complete |
| Sprint 2.1 | Ghost Mode (Incognito) | ✅ Complete |
| Sprint 2.2 | Neural Lenses (Filtering) | ✅ Complete |
| Sprint 2.3 | Knowledge Base (External Docs) | 🔮 Planned |

---

## ⚙️ Phase 0: Foundation (Contracts & Types)

*Before any UI code, we defined the behavioral contracts.*

### Performance Contracts (`constants/contracts.ts`)

The **Eco Mode** system prevents thermal throttling and preserves battery:

```typescript
export const PERFORMANCE_CONTRACTS = {
  neuralCanvas: {
    maxNodes: 500,
    targetFPS: 60,
    lowPower: {
      triggerBatteryLevel: 0.20, // Under 20%
      disableShaders: true,      // No blur/glow
      reduceFrameRate: 30,       // 30fps cap
      aceInterval: 2000          // AI polls every 2s
    }
  },
  animation: {
    maxSimultaneous: 5, // Motion budget
  }
};
```

### Cognitive Tempo Controller (CTC)

The CTC is the "governor" of all motion and interaction:

| State | Description | Visual Behavior |
|-------|-------------|-----------------|
| `IDLE` | No interaction for 10s | Minimal ambient motion |
| `AWARENESS` | Canvas touched | Labels enabled, breathing active |
| `INTENT` | Active gesture in progress | Full motion, labels hidden |
| `REFLECTION` | Modal/Thread open | All canvas motion paused |

---

## ✅ Sprint 1: Core Neural OS — COMPLETE

### 1.1 Ambient Connection Engine (ACE)
> **Goal:** AI becomes invisible and proactive

**Implemented Features:**
- `AmbientConnectionEngine.ts` — Core prediction logic
- `predictionStore.ts` — Zustand store for predictions
- `GhostSuggestion.tsx` — Accept/Reject UI cards
- `nlp.ts` — Local keyword extraction for trust-building

**Key Innovation:** Predictions explain *why* they're relevant:
```
"Both mention 'Performance' and 'Spring'"
```

### 1.2 The Nervous System (Auto-Pilot)
> **Goal:** Unified organism feel

**Implemented Features:**
- `useCameraFlight.ts` — Logarithmic ease-out camera animations
- `ThreadScreen.tsx` — Hub-and-Spoke context view
- `contextStore.ts` — Live sync between Orbit ↔ Horizon

### 1.3 Trust Engine (Privacy & Control)
> **Goal:** Make AI predictable and controllable

**Implemented Features:**
- `feedback_signals` — Database table for rejections
- Deterministic NLP reasons for all suggestions
- ACE Feedback Loop — Immediate filtering of rejected nodes

---

## � Sprint 2: Deep Mind — IN PROGRESS

### 2.1 Ghost Mode (Incognito) — ✅ COMPLETE
> **Problem:** User wants to chat/think without polluting long-term memory

**Implementation:**
- Toggle in Orbit to disable `saveSnippet`
- Visual indicator (Ghost Icon) when active
- Different color scheme in Ghost Mode

### 2.2 Neural Lenses (Filtering) — ✅ COMPLETE
> **Problem:** Graph becomes too dense over time

**Implementation:**
- `NeuralLensesHUD.tsx` — Bottom toolbar for mode selection
- `lensStore.ts` — Global Zustand store for `horizonMode`
- Canvas shader/opacity modulation based on active lens

**Available Lenses:**
| Mode | Highlights | Use Case |
|------|------------|----------|
| EXPLORE | All nodes | Default overview |
| LEARN | Facts (Cyan) | Study mode |
| STRATEGY | Goals (Gold) | Planning mode |
| REFLECT | Feelings (Pink) | Emotional review |

### 2.3 Knowledge Base (External Docs) — 🔮 PLANNED
> **Goal:** Ingest PDF/MD files via MCP

**Planned Implementation:**
- MCP Server integration (`services/mcp/`)
- `external_resources` table (already in schema)
- Resource linking to snippets via `resource_links`

---

## 🔮 Sprint 3: Future Vision

### 3.1 Proactive Daily Deltas
- AI-generated daily summaries
- Sparkline activity charts
- "Thought of the day" surfacing

### 3.2 Collaborative Memory
- Shared thought spaces
- Real-time sync between users
- Permission-based access

### 3.3 Web3 Integration (Optional)
- On-chain thought verification
- NFT memory artifacts
- Decentralized storage

---

## 🤝 Contributing Guidelines

### Before Contributing
1. Read `Docs/APP_ARCHITECTURE_V3.md` for system overview
2. Understand the CTC state machine (all motion is gated)
3. Check `constants/contracts.ts` for behavioral constraints

### Code Standards
- All SharedValues must be worklet-safe
- Use `runOnJS` for React state updates from worklets
- Follow the existing TypeScript patterns

### Testing
```bash
# Start dev server
npx expo start --clear

# Check console for:
# [NeuralCanvas] 🎨 Canvas mounted
# [Gesture] ✋ Pan START
# [ACE] 🔍 Found N predictions
```

### Pull Request Template
```markdown
## What does this PR do?
[Description]

## Which Sprint/Phase?
[e.g., Sprint 2.3]

## Screenshots/Videos
[If applicable]

## Testing Done
[How was this tested?]
```

---

## 📚 Related Documentation

| Document | Purpose |
|----------|---------|
| `APP_ARCHITECTURE_V3.md` | System architecture deep-dive |
| `DEV_HANDOUT.md` | Sprint completion reports |
| `NEURAL_CANVAS_SPEC.md` | Canvas rendering specification |
| `CHRONICLE_V2.md` | Chronicle (Memory) screen features |
| `THREAD_VIEW.md` | Hub-and-Spoke context engine |

---

*Hearify: Where short-term dialogue meets long-term evolution.*
