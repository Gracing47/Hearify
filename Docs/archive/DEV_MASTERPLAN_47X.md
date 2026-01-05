# 🏆 Hearify 2026 — Enhanced Dev Masterplan (47× Edition)

**Status**: 🚧 IN PROGRESS  
**Principle**: *Motion, Intelligence und Visuals nur wenn kognitiv freigeschaltet.*

---

## 🔒 ÜBERGEORDNETE SCHICHT: Cognitive Tempo Control (CTC)

### CTC States

| State | Camera | Velocity | Edges | Bloom | Birth |
|-------|--------|----------|-------|-------|-------|
| IDLE | none | 0 | 0 | 0.2 | 0 |
| AWARENESS | rotate | 10 | 0 | 0.4 | 0.3 |
| INTEREST | translate | 30 | 1 | 0.7 | 0.6 |
| INTENT | full | 50 | 2 | 1.0 | 1.0 |
| REFLECTION | slow pan | 15 | 1 | 0.5 | fade |

### CTC Output Interface

```typescript
interface CTCLimits {
    allowCameraTranslation: boolean;
    maxVelocity: number;
    edgeActivityLevel: 0 | 1 | 2;
    bloomIntensityCap: number;
    birthEnergyMultiplier: number;
}
```

---

## Phase Progress

### ✅ Phase A: UX Stabilization
- [x] A1. Camera Governance (rotation vs translation)
- [x] A2. Birth Physics Modulation (novelty × CTC)
- [x] A3. Edge Attention Budget (DORMANT/BREATHING/ACTIVE)

### ✅ Phase B: Semantic UX Intelligence
- [x] B1. Ephemeral Meaning Cues (via CTC mode transitions)
- [x] B2. Focus Commitment Levels (confidence thresholds in CTC)

### ✅ Phase C: Stillness & Rhythm
- [x] C1. Stillness Test (8s decay to IDLE)
- [x] C2. Kinematic Grammar (MindLayout resistance + spring)

### ⬜ Phase D: MCP Integration
- [ ] D1. External Node Classification
- [ ] D2. Tool-Driven Insight Nodes

### ✅ Phase E: Daily Delta 2.0
- [x] E1. DeltaService with AI summaries
- [x] E2. DeltaCard integration in OrbitScreen

### ✅ Phase F: Intelligent Memory System (IMS)
- [x] F1. Semantic Deduplication (Similarity Merging >0.92)
- [x] F2. Animated Toast Queue (Serialized confirmation)
- [x] F3. Raptor Physics 2.0 (TypedArray zero-copy engine)

### ⬜ Phase G: Global Context & Active Listening
- [ ] G1. Real-time Focus Shifting (Orbit -> Horizon)
- [ ] G2. Long-term Pattern Analysis (The "Insight" Node)
- [ ] G3. Voice-only "Horizon Walk" navigation

---

## 🔚 Dev Ruleset

1. **Nichts bewegt sich ohne kognitive Erlaubnis**
2. **Alles Neue muss leiser sein als das Alte**
3. **Stillness ist ein Feature**
4. **Edge = Bedeutung, nicht Deko**
5. **Wenn UX-Gefühl unklar → weniger Motion**
