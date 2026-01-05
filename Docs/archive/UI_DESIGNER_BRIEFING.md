# 🎨 UI Designer Briefing — Hearify Neural Horizon

> **Ziel:** Die App auf State-of-the-Art 2025+ Level bringen
> **Erstellt:** 2024-12-27
> **Status:** Active Development

---

## 📱 App Überblick

Hearify ist eine **AI-gestützte Gedächtnis-App**, die Gedanken (Snippets) in einer interaktiven 3D-ähnlichen Visualisierung darstellt — dem "Neural Horizon". 

### Aktuelle Screens
1. **Orbit** — Chat-Interface mit AI (Haupteingabe)
2. **Horizon** — Neuronale Visualisierung aller Gedanken als interaktive Orbs
3. **Chronicles** — Listenansicht/Bento-Grid aller Gedanken

---

## 🔍 Offene Design-Fragen

### 1. Neural Horizon Interaktion

**Kontext:** Nutzer zoomen und pannen in einer "Galaxy" von Gedanken-Nodes.

| Frage | Details |
|-------|---------|
| Wie sollte die **Zoom-Kurve** aussehen? | Linear vs. Exponential? Friction/Deceleration? |
| Was ist die ideale **Initial-Zoom-Stufe**? | Aktuell 0.4x — zu weit raus? |
| Soll es **Snap-to-Node** beim Zoom geben? | Auto-Focus auf nächsten Node? |
| Wie visualisiert man **Cluster-Grenzen**? | Nebel? Linien? Farbfelder? |
| Brauchen wir einen **Minimap/Overview**? | Kleine Karte in Ecke? |

### 2. Level-of-Detail (LOD) System

**Kontext:** Beim Reinzoomen erscheinen Text-Labels unter den Nodes.

| Frage | Details |
|-------|---------|
| Ab welchem **Zoom-Level** soll Text erscheinen? | Aktuell: 60% — zu früh/spät? |
| Wie lang soll das **Text-Snippet** sein? | Aktuell: 30 Zeichen |
| Soll Text **zentriert** oder **linksbündig** sein? | |
| Brauchen wir **Blur-Reveal**-Animation? | Text "entsteht aus Nebel"? |
| Was passiert bei **Text-Überlappung**? | Collision Detection? Hiding? |

### 3. Node-Design

**Kontext:** Jeder Gedanke ist ein farbiger Orb mit Glow-Effekt.

| Frage | Details |
|-------|---------|
| Sind die **aktuellen Farben** optimal? | Fact=Cyan, Feeling=Magenta, Goal=Gold |
| Sollen Nodes **Icons** statt nur Farben haben? | Emoji? Custom Icons? |
| Wie groß sollen Nodes **relativ zur Importance** sein? | Mehr Connections = größer? |
| Brauchen wir **3D-Tiefe** (Z-Axis)? | Parallax beim Pannen? |
| Wie visualisiert man **"Starred"** Nodes? | Ring? Badge? Größer? |

### 4. Thought Action Modal

**Kontext:** Erscheint beim Tap auf einen Node.

| Frage | Details |
|-------|---------|
| Ist das **2x2 Grid** optimal für Actions? | Oder horizontal swipe? |
| Welche **zusätzlichen Actions** brauchen wir? | Delete? Archive? Share? |
| Soll das Modal **Full-Screen** werden können? | Zum Lesen langer Gedanken? |
| Wie zeigt man **Connection-Vorschläge**? | "Related thoughts" im Modal? |

### 5. Statistik-Panel (Bottom HUD)

**Kontext:** Zeigt Anzahl der Nodes nach Typ.

| Frage | Details |
|-------|---------|
| Soll das Panel **ausblendbar** sein? | Mehr Platz für Canvas? |
| Brauchen wir **Animationen** bei Zahlenänderung? | Counter-Animation? |
| Welche **zusätzlichen Stats** wären nützlich? | Top-Cluster? Aktivität heute? |

---

## 📐 Design Research Tasks

### A. Inspirationen sammeln

1. **Datenvisualisierung Apps**
   - Analyse von: Notion, Roam Research, Obsidian Graph View
   - Was macht ihre Node-Visualisierung gut?

2. **Premium Mobile UIs**
   - Referenzen von: Apple Health, Spotify, Linear
   - Glassmorphism vs. Neumorphism Trends 2025

3. **Neural/Brain Visualizations**
   - BrainNet Viewer, Connectome tools
   - Was macht neuronale Netze "echt" aussehen?

### B. Prototypen erstellen

| Priorität | Prototype | Format |
|-----------|-----------|--------|
| 🔴 Hoch | Zoom-Interaktion mit LOD | Video/Lottie |
| 🔴 Hoch | Synapse-Blink Animation | After Effects → Lottie |
| 🟡 Mittel | Thought Modal Redesign | Figma |
| 🟡 Mittel | Cluster-Visualisierung | Figma |
| 🟢 Nice | Onboarding Flow | Figma Prototype |

### C. Technische Constraints

**Wichtig für Designer zu wissen:**

- **Framework:** React Native + Expo
- **Rendering:** @shopify/react-native-skia (GPU-basiert)
- **Animationen:** react-native-reanimated (60fps Worklets)
- **Performance-Limit:** ~100 Nodes bei 60fps
- **Fonts:** Nur System-Fonts eingebaut (Inter-Alternative nötig)

---

## 🎯 Konkrete Deliverables Anfrage

### Phase 1: Quick Wins (Diese Woche)

1. **Farbpalette V2**
   - Überarbeitete Type-Farben (Fact/Feeling/Goal)
   - Hintergrund-Gradient optimiert
   - Glow-Intensitäten definiert

2. **Zoom Animation Kurve**
   - Easing-Kurve für Pinch-Zoom
   - Deceleration-Werte für Momentum

3. **LOD Text-Styling**
   - Font-Größe, Farbe, Shadow
   - Position relativ zu Node
   - Fade-In Kurve

### Phase 2: Major Features (Nächste 2 Wochen)

1. **Thought Modal V2**
   - Full-Screen Expansion
   - Connection/Related Thoughts
   - Edit-Modus

2. **Node Hierarchy Design**
   - Size = Importance
   - Visual Clusters
   - Temporal Layers (Alt vs. Neu)

3. **Empty States**
   - Erste Gedanken hinzufügen
   - Keine Connections vorhanden
   - Filter zeigt nichts

---

## 💡 Brainstorming Vorschläge

### Mögliche Features für Discussion

1. **"Thinking Pulse"** — Kürzlich hinzugefügte Nodes pulsieren stärker
2. **"Memory Lane"** — Chronologischer Pfad durch Gedanken
3. **"Focus Mode"** — Ein Node im Zentrum, Related drumherum
4. **"Daily Constellation"** — Tägliche Zusammenfassung als Sternbild
5. **"Thought Streaks"** — Verbindungslinien zeigen Gedankenfluss

---

## 📞 Nächste Schritte

1. **Review dieser Fragen** mit Designer
2. **Erste Prototypen** für Zoom & LOD
3. **Sync-Meeting** um Richtung zu bestimmen
4. **Iterative Implementation** mit Developer Feedback

---

## 🔗 Ressourcen

- [Figma Design System] — *Link hier einfügen*
- [Skia Documentation](https://shopify.github.io/react-native-skia/)
- [Reanimated Curves](https://docs.swmansion.com/react-native-reanimated/)
- [Lottie für React Native](https://airbnb.io/lottie/)

---

*Letzte Aktualisierung: 27.12.2024*
