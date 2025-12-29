/**
 * 📐 SPATIAL ENGINE — The Z-Axis Projection Core
 * 
 * "Height is visual, Depth is semantic."
 * 
 * Provides 3D -> 2D perspective projection for the Neural Horizon.
 * This allows a "Memory Palace" effect where old/unimportant thoughts
 * drift into the background (Z-distance), while focus items stay sharp and near.
 */

import { interpolate } from 'react-native-reanimated';
import { Snippet } from '../db/schema';

// Kamera-Konstanten
const FOCAL_LENGTH = 800; // Wie "weitwinklig" ist die Linse?

export const SpatialEngine = {
    /**
     * Berechnet die Z-Position (Tiefe) basierend auf Wichtigkeit & Alter.
     * Bereich: -1000 (Weit weg/Archiv) bis +500 (Direkt vor der Nase/Fokus)
     */
    calculateZ: (node: Snippet): number => {
        const now = Date.now();
        const createdAt = node.timestamp; // Snippets use 'timestamp' in schema.ts


        const age = now - createdAt;
        const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 Tage (Deep Archive)

        // 0 = Neu, 1 = Alt
        const recencyFactor = Math.min(age / maxAge, 1);
        const importance = node.importance || 0.5;

        // 🧠 Spatial Logic: 
        // Wichtige Dinge bleiben vorne (Score steigt)
        // Neue Dinge starten vorne (RecencyFactor ist klein)
        // Z-Score 1.0 = Ganz nah, 0.0 = Ganz weit weg
        const zScore = (importance * 0.7) + ((1 - recencyFactor) * 0.3);

        // Mapping auf Welt-Koordinaten
        // -1000 = Hintergrund, +500 = Vordergrund
        return interpolate(zScore, [0, 1], [-1000, 500]);
    },

    /**
     * 3D -> 2D Projektion (Perspective Divide)
     * Läuft im UI-Thread (Worklet) für 60fps
     * 
     * @param x Welt-X
     * @param y Welt-Y
     * @param z Welt-Z
     * @param cameraZ Kamera-Z Position (Zoom-Tiefe)
     */
    project3D: (x: number, y: number, z: number, cameraZ: number) => {
        'worklet';

        // Relative Tiefe zur Kamera
        // Wir addieren FOCAL_LENGTH, damit ein Objekt bei z=0, cameraZ=0 
        // genau den Scale 1.0 (FOCAL_LENGTH / FOCAL_LENGTH) hat.
        const depth = (cameraZ - z) + FOCAL_LENGTH;

        // Schutz vor Division durch Null oder negativer Tiefe (hinter der Kamera)
        if (depth < 50) {
            return {
                x: 0,
                y: 0,
                scale: 0,
                blur: 0,
                visible: false,
                opacity: 0
            };
        }

        const scale = FOCAL_LENGTH / depth;

        // Depth of Field (DoF) Logic:
        // Je weiter weg von der "Fokus-Ebene" (Scale 1), desto unschärfer.
        // Wir begrenzen den Blur für Performance.
        const blur = Math.max(0, Math.abs(1 - scale) * 8);

        // Opacity nimmt mit der Tiefe ab
        const opacity = Math.min(1, scale * 1.5);

        return {
            x: x * scale,   // Perspektivische Verkürzung
            y: y * scale,
            scale: scale,
            blur: blur,
            visible: scale > 0.05,
            opacity: opacity
        };
    }
};
