# 🪟 Neural Glass — The 47x UI Transformation

> *"An app that breathes like a living organism."*

---

## The Vision

Standard apps feel static and lifeless. Hearify should feel like a **presence** — responsive, ambient, and alive. This document outlines the "Neural Glass" transformation that elevates Hearify from a functional prototype to an award-winning experience.

---

## 🏛️ Architecture: Neural Intelligence Flow

The data flow is no longer linear — it's **orchestrated**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    NEURAL INTELLIGENCE ORCHESTRATION                     │
└─────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
    │   CAPTURE    │  →   │VECTORIZATION │  →   │SEMANTIC SEARCH│
    │ Voice/Text   │      │OpenAI Embed  │      │SQLite-Vec KNN │
    └──────────────┘      └──────────────┘      └──────┬───────┘
                                                       │
                                          ┌────────────┴────────────┐
                                          │     Context Found?      │
                                          └────────────┬────────────┘
                                                ╱            ╲
                                           Yes ╱              ╲ No
                                              ▼                ▼
                                    ┌─────────────┐    ┌─────────────┐
                                    │RAG INJECTION│    │COLD REASON  │
                                    │ + DeepSeek  │    │  DeepSeek   │
                                    └──────┬──────┘    └──────┬──────┘
                                           └──────┬───────────┘
                                                  ▼
                                    ┌─────────────────────────┐
                                    │     MANIFESTATION       │
                                    │ TTS Speak + Response    │
                                    └────────────┬────────────┘
                                                 ▼
                                    ┌─────────────────────────┐
                                    │    HORIZON UPDATE       │
                                    │ New Node + Semantic Edges│
                                    └─────────────────────────┘
```

---

## 🎨 Screen Transformations

### 1. HomeScreen (The Presence)

**Before:** Standard chat interface with floating input bar.

**After:** Ambient welcome state that transforms with context.

| Element | Implementation |
|---------|---------------|
| Neural Orb | Central visual anchor, state-driven animations |
| Floating Input | Glassmorphic bar with state indicators |
| Message Thread | Minimal bubbles with reasoning boxes |
| Burger Menu | Slide-out navigation (no visible tab bar) |

**Key Files:** `app/(tabs)/index.tsx`, `components/NeuralOrb.tsx`

---

### 2. Horizon (The Universe)

**Before:** Canvas with basic header.

**After:** Immersive full-screen universe with glassmorphic HUD.

| Element | Implementation |
|---------|---------------|
| Neural Canvas | Full-screen infinite canvas with semantic physics |
| Top Bar | Floating title + LIVE pulse indicator |
| Stats Panel | Bottom glassmorphic panel with animated node counts |
| Gesture Hints | Subtle onboarding text |
| HUD Toggle | Hide/show interface for pure immersion |

**Key Features:**
- Live stats refresh every 5 seconds
- Animated pulse indicator
- Platform-specific BlurView (iOS) / solid background (Android)
- Stats animate when values change

**Key Files:** `app/(tabs)/canvas.tsx`, `components/NeuralCanvas.tsx`

---

### 3. Chronicle (The Archive)

**Before:** Settings screen placeholder.

**After:** Bento Grid memory archive with filter system.

| Element | Implementation |
|---------|---------------|
| Stats Banner | Glassmorphic total counts |
| Filter Pills | All / Goals / Feelings / Facts toggle |
| Bento Grid | Large cards for goals, compact for facts/feelings |
| Memory Cards | Type badge, sentiment dot, time ago, Horizon link |
| Pull-to-Refresh | Native refresh control |

**Key Features:**
- Cards animate in sequence (SlideInRight)
- Sentiment color coding (blue/gold/purple/gray)
- "View in Horizon" navigation button
- Empty state with onboarding prompt

**Key Files:** `app/(tabs)/explore.tsx`

---

## 🎭 Visual Language

### Color Palette

```
Background:       #000000 → #0a0a0f → #0d0d14
Surface Glass:    rgba(26, 26, 32, 0.95)
Border Subtle:    rgba(255, 255, 255, 0.08)
Accent Primary:   #6366f1 (Indigo)
Accent Success:   #10b981 (Emerald)
Accent Warning:   #f59e0b (Amber)
Accent Creative:  #8b5cf6 (Purple)
```

### Glassmorphism Rules

1. **iOS:** Use `<BlurView intensity={40-60} tint="dark" />`
2. **Android:** Use solid `rgba(22, 22, 28, 0.95)` background
3. **Border:** Always add subtle `borderWidth: 1` with white alpha 0.08
4. **Shadow:** iOS-only shadows with blur radius 10-20

### Animation Principles
1.  **Singularity Bloom**: Radical scaling transition (**1x → 15x**) to bridge dimensions.
2.  **Birth Ejection**: Momentum-based entrance for new data.
3.  **Active Awareness**: Subtle drift and depth-of-field shifts based on user focus.
4.  **Entrance**: `FadeIn`, `FadeInUp`, `SlideInRight` with staggered delays.
5.  **Friction**: Natural spring physics with `springify()`.

---

## 🏆 The 47x Pillars — Implementation Checklist

| Pillar | Status | Implementation |
|--------|--------|----------------|
| **Topographical Memory** | ✅ | Neural Horizon with force-directed semantic clustering |
| **Ambient Voice Stream** | ✅ | Voice capture with whisper transcription |
| **Local-Only Vector Vault** | ✅ | op-sqlite + sqlite-vec (JSI, no cloud) |
| **The Presence** | ✅ | Unified visual language, animations, glassmorphism |

---

## 📱 Testing Checklist

- [ ] Horizon loads without errors
- [ ] Stats update when new memories are added
- [ ] Chronicle filter pills work correctly
- [ ] Cards animate on scroll
- [ ] Pull-to-refresh works on Chronicle
- [ ] HUD toggle hides/shows interface on Horizon
- [ ] Gesture hints are visible
- [ ] Back button navigates correctly

---

1. **Singularity Bloom:** **COMPLETED**
2. **Haptic Feedback:** Vibrate on node selection
3. **Sound Design:** Ambient audio cues
4. **Particle Effects:** **COMPLETED** (Floating nebula gas clouds)
5. **Temporal Layers:** **COMPLETED** (Depth-based Z-friction)
6. **Cluster Labels:** **COMPLETED** (AI-generated topic names)
7. **Daily Delta**: **COMPLETED** (AI-powered morning summary)
8. **Intelligent Memory System**: **COMPLETED** (Deduplication + Toast Queue)

---

*Last Updated: 2025-12-24*
