# 🚀 Hearify 2026: The Master Dev Plan (vFinal)

> **Version:** Final  
> **Date:** 2024-12-28  
> **Ziel:** Transformation von "3 Screens" zu "One Neural OS"  
> **Timeline:** 4 Sprints (ca. 4 Wochen)  
> **Core Principles:** Invisible AI, True Spatial Depth, Battery-Aware Performance

---

## 🗓️ Phase 0: The Law (Contracts & Types)

*Bevor eine Zeile UI-Code geschrieben wird, definieren wir die Spielregeln.*

### 0.1 Performance Contracts (`constants/contracts.ts`)

Implementiere den **Eco Mode** direkt zu Beginn, um Thermal Throttling zu verhindern.

```typescript
export const PERFORMANCE_CONTRACTS = {
  neuralCanvas: {
    maxNodes: 500,
    targetFPS: 60,
    // 🔋 ECO MODE LOGIC
    lowPower: {
      triggerBatteryLevel: 0.20, // Unter 20%
      disableShaders: true,      // Kein Blur/Glow
      reduceFrameRate: 30,       // 30fps Cap
      aceInterval: 2000          // AI sucht nur alle 2s
    }
  },
  animation: {
    maxSimultaneous: 5, // Motion Budget
  }
};
```

---

## 🗓️ Sprint 1.1: Ambient Connection Engine (ACE) — ✅ COMPLETE
- **Goal**: The AI becomes invisible and proactive.
- **Features**: Ghost Suggestions, Haptic Feedback, Stability Fixes.

## 🗓️ Sprint 1.2: The Nervous System (Auto-Pilot) — ✅ COMPLETE
- **Goal**: Unified organism feel.
- **Features**:
  - `useCameraFlight`: Logarithmic Ease-Out flight.
  - `ThreadScreen`: Hub-and-Spoke view for context.
  - `contextStore`: Live context synchronization Orbit <-> Horizon.

## 🗓️ Sprint 1.3: The Trust Engine (Privacy & Control) — ✅ COMPLETE
- **Goal**: Make the AI predictable and controllable.
- **Features**:
  - `feedback_signals`: Database table for rejections.
  - Deterministic NLP: "Reasons" for suggestions (Mentions: X, Y).
  - ACE Feedback Loop: Immediate filtering of rejected nodes.

---

## 🔮 Sprint 2: The Deep Mind (Focus & Privacy) 🚧 IN PROGRESS
- **Goal**: Advanced memory control and visualization.
- **Focus**: Privacy (Ghost Mode) and Filtering (Neural Lenses).

### 2.1 Ghost Mode (Incognito)
- **Problem**: User wants to chat/think without polluting long-term memory.
- **Solution**: Toggle in Orbit to disable `saveSnippet`.
- **UI**: Visual indicator (Ghost Icon), different color scheme?

### 2.2 Neural Lenses (Filtering)
- **Problem**: Graph becomes too dense.
- **Solution**: `NeuralLensesHUD` to switch modes (Explore, Learn, Strategy, Reflect).
- **Tech**: `lensStore` + `NeuralCanvas` shader/opacity modulation.

### 2.3 Knowledge Base (External Docs)
- **Goal**: Ingest PDF/MD files via MCP (Later).

---
