import { Skia } from "@shopify/react-native-skia";

/**
 * Generates a Hexagon Path (for FACT nodes)
 * @param size
 */
export const getHexagonPath = (size: number) => {
    const path = Skia.Path.Make();
    const radius = size;
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
    }
    path.close();
    return path;
};

/**
 * Generates a Diamond/Arrow Path (for GOAL nodes)
 * @param size 
 */
export const getDiamondPath = (size: number) => {
    const path = Skia.Path.Make();
    const radius = size * 1.2;

    // Diamond shape pointing top-right
    path.moveTo(0, -radius); // Top
    path.lineTo(radius * 0.8, 0); // Right
    path.lineTo(0, radius); // Bottom
    path.lineTo(-radius * 0.8, 0); // Left
    path.close();

    return path;
};
