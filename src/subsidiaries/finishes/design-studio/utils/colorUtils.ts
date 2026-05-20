/**
 * Color Utilities — Conversion and comparison functions for material matching
 *
 * Supports hex ↔ RGB ↔ CIE Lab conversions and deltaE (CIE76) color distance.
 */

export interface RGB { r: number; g: number; b: number }
export interface Lab { L: number; a: number; b: number }

/** Parse hex color string to RGB (0-255). Supports #RGB and #RRGGBB. */
export function hexToRgb(hex: string): RGB {
  let h = hex.replace(/^#/, '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Convert RGB (0-255) to hex string with # prefix. */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

/** Convert Three.js diffuse array [0-1, 0-1, 0-1] to hex string. */
export function diffuseToHex(diffuse: [number, number, number]): string {
  return rgbToHex(
    Math.round(diffuse[0] * 255),
    Math.round(diffuse[1] * 255),
    Math.round(diffuse[2] * 255),
  );
}

/** Convert RGB (0-255) to CIE Lab via D65 illuminant. */
export function rgbToLab(rgb: RGB): Lab {
  // sRGB → linear RGB
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Linear RGB → XYZ (D65)
  let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  let y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750);
  let z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;

  // XYZ → Lab
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116);
  x = f(x);
  y = f(y);
  z = f(z);

  return {
    L: 116 * y - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  };
}

/** CIE76 color distance between two Lab colors. Lower = more similar. */
export function deltaE(lab1: Lab, lab2: Lab): number {
  return Math.sqrt(
    (lab1.L - lab2.L) ** 2 +
    (lab1.a - lab2.a) ** 2 +
    (lab1.b - lab2.b) ** 2,
  );
}

/** Compute CIE76 deltaE between two hex colors. */
export function hexColorDistance(hex1: string, hex2: string): number {
  return deltaE(rgbToLab(hexToRgb(hex1)), rgbToLab(hexToRgb(hex2)));
}
