# 🌌 Neural Horizon — The Ultimate Semantic Constellation

> *"Your mind, visualized as a living ecosystem in the void."*

---

## Overview

The **Neural Horizon** is a high-performance, spatially-aware memory interface. It moves beyond static lists, transforming thoughts into a dynamic 3D constellation where ideas live, breathe, and connect. Powered by custom GLSL shaders and a native physics engine, it provides an unparalleled immersive experience for exploring your personal knowledge graph.

---

## 🎯 Visual Identity: The "Neon Void"

### 1. Neural Orbs (Memory Nodes)
Each memory is a glowing energy orb, pulsing with its own "life force" (importance).

| Type | Color Palette | Semantic Meaning |
|:---:|:---|:---|
| **Fact** | 💎 **Cyan / Electric Blue** | Objective knowledge, data, and observations. |
| **Feeling** | 🌸 **Magenta / Neon Pink** | Emotional states, sentiments, and perspectives. |
| **Goal** | 🌟 **Gold / Sunfire** | Intentions, aspirations, and future targets. |

### 2. Depth-of-Field (DoF) & Parallax
The Horizon exists in a true 3D spatial coordinate system:
*   **Z-Parallax**: Nodes scale and move at different speeds based on depth.
*   **Organic Bokeh**: Distant nodes naturally blur into the background nebula, focusing your attention on the local context.
*   **Progressive Reveal**: Text labels don't just "pop" in; they emerge through a smooth blur-mask as the camera approaches.

### 3. Edge Dynamics: Information Flow
Connections between nodes are not static lines.
*   **Traveler Particles**: Heat-white "pulses" of light travel along semantic edges, visualizing the flow of information between related concepts.
*   **Dynamic Weight**: Thicker, brighter lines represent stronger semantic bonds (Similarity > 0.85).
*   **Transition Awareness**: Edges only materialize once the "Bloom" from the Singularity transition reaches sufficient intensity.

### 4. The Singularity Bloom
The Horizon reacts to the user's transition from Orbit:
*   **Nucleus Entry**: As you swipe up, the central Orb expands, acting as a "Keyhole" into the Horizon space.
*   **Visual Materialization**: The constellation "wakes up" as the camera enters the Horizon space, with nodes and clusters fading in through a cinematic exposure-ramp.

---

## ⚙️ Technical Architecture

### The "Magnetic Orbit" Physics Engine
Horizon uses a refined force-directed simulation running at 60fps on native UI worklets.

1.  **Semantic Clustering**: Nodes are strongly attracted to their **Cluster Centroids**, creating organic "galaxies" of related thought.
2.  **Magnetic Orbit Force**: Nodes exhibit a subtle orbital swirl around cluster centers, giving the system a "living" feel.
4.  **Thought Ejection (Shotgun Birth)**: New nodes are "shot" into a wide area (±300px) with high initial velocity to prevent overlap singularities.
5.  **Semantic Awareness (Focus Drift)**: The camera focal point subtly drifts towards the areas of the graph currently relevant to the conversation.
6.  **Raptor Physics 2.0**: All physics states (Pos/Vel/Cluster) reside in high-performance **TypedArrays (Float32Array)** for zero-copy, bridge-less calculations at 60fps.

### Advanced Shader Pipeline (Skia GLSL)

*   **Deep Space Nebula**: A multi-layered background shader with parallax star fields and volumetric gas clouds that react to node "energy".
*   **Volumetric Cluster Auras**: Clusters are enveloped in soft, colored nebulae using density falloff shaders (Organic Turbulence).
*   **Film Grain Overlay**: A subtle high-frequency grain ensures the "Glassmorphic" UI feels premium and cinematic.

---

## 🛠️ The Extreme Performance Stack

| Layer | Technology | Purpose |
|:---|:---|:---|
| **Engine** | `@shopify/react-native-skia` | GPU-accelerated drawing & shaders. |
| **Physics** | `react-native-reanimated` | 60fps UI-thread physics loop (Worklets). |
| **Database** | `@op-engineering/op-sqlite` | High-speed JSI-based persistence. |
| **Vectors** | `sqlite-vec` | Native SIMD-accelerated similarity search. |
| **Global Sync**| `Zustand` | Holographic state management (Trinity Flow). |

---

## 🔄 Data Lifecycle: The "Trinity Flow"

1.  **Capture (Orbit)**: Your voice/text is instantly vectorized and classified.
2.  **Imms Filter (IMS)**: The **Intelligent Memory System** checks for duplicates (>0.92 cosine) and either merges or creates a new node.
3.  **Manifestation (Horizon)**: The node is "born" in the Horizon, finding its place via KNN search against the deep archive.
4.  **Reflection (Memory)**: High-density bento-grids allow for chronological review and "throwing" data back into active consideration.

---

## 🚀 The Future: 2026 & Beyond

*   **MCP Expansion**: Bringing GitHub PRs, Slack messages, and Notion docs into the constellation as "External Resource Nodes".
*   **AI Summary Nodes**: Large-scale clusters will automatically generate "Super Nodes" that summarize an entire topic.
*   **Temporal Decay**: Older, less relevant nodes will slowly drift into the "Deep Archive" (lower Z-depth and opacity).

