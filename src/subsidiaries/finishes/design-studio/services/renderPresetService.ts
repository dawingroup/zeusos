/**
 * Render Preset Service — Built-in render presets and screenshot capture
 *
 * Provides four render presets (Studio, Room, Transparent, Outdoor) and
 * utilities for viewport capture with optional watermark.
 */

import * as THREE from 'three';

// ============================================================================
// Types
// ============================================================================

export interface RenderEnvironment {
  backgroundType: 'studio' | 'room' | 'transparent' | 'outdoor';
  backgroundColor: string; // hex
  floorColor?: string;
  showGrid: boolean;
}

export interface RenderLighting {
  keyIntensity: number;
  fillIntensity: number;
  ambientIntensity: number;
  rimEnabled: boolean;
}

export interface RenderCamera {
  fov: number;
}

export interface RenderPreset {
  id: string;
  name: string;
  description: string;
  environment: RenderEnvironment;
  lighting: RenderLighting;
  camera: RenderCamera;
}

// ============================================================================
// Built-in Presets
// ============================================================================

export const RENDER_PRESETS: RenderPreset[] = [
  {
    id: 'studio',
    name: 'Studio',
    description: 'Clean white background with soft studio lighting',
    environment: { backgroundType: 'studio', backgroundColor: '#FFFFFF', showGrid: false },
    lighting: { keyIntensity: 1.0, fillIntensity: 0.5, ambientIntensity: 0.6, rimEnabled: true },
    camera: { fov: 45 },
  },
  {
    id: 'room',
    name: 'Room',
    description: 'Warm interior scene with floor plane',
    environment: { backgroundType: 'room', backgroundColor: '#F5F0EB', floorColor: '#D4C5B3', showGrid: false },
    lighting: { keyIntensity: 0.8, fillIntensity: 0.4, ambientIntensity: 0.7, rimEnabled: true },
    camera: { fov: 40 },
  },
  {
    id: 'transparent',
    name: 'Transparent',
    description: 'Clear background for compositing',
    environment: { backgroundType: 'transparent', backgroundColor: '#000000', showGrid: false },
    lighting: { keyIntensity: 1.2, fillIntensity: 0.6, ambientIntensity: 0.5, rimEnabled: false },
    camera: { fov: 45 },
  },
  {
    id: 'outdoor',
    name: 'Outdoor',
    description: 'Bright daylight with blue sky tones',
    environment: { backgroundType: 'outdoor', backgroundColor: '#E8F0F8', showGrid: true },
    lighting: { keyIntensity: 1.4, fillIntensity: 0.3, ambientIntensity: 0.8, rimEnabled: true },
    camera: { fov: 50 },
  },
];

export function getBuiltInPresets(): RenderPreset[] {
  return RENDER_PRESETS;
}

// ============================================================================
// Scene Manipulation
// ============================================================================

/**
 * Apply a render preset to a Three.js scene, adjusting background, lighting, and camera.
 */
export function applyPresetToScene(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  preset: RenderPreset,
): void {
  // Background
  if (preset.environment.backgroundType === 'transparent') {
    scene.background = null;
  } else {
    scene.background = new THREE.Color(preset.environment.backgroundColor);
  }

  // Update camera FOV
  camera.fov = preset.camera.fov;
  camera.updateProjectionMatrix();

  // Update lighting
  scene.traverse((obj) => {
    if (obj instanceof THREE.AmbientLight) {
      obj.intensity = preset.lighting.ambientIntensity;
    }
    if (obj instanceof THREE.DirectionalLight) {
      // Key light is at positive positions, fill light at negative
      if (obj.position.x > 0 && obj.position.y > 0) {
        obj.intensity = preset.lighting.keyIntensity;
      } else if (obj.position.x < 0) {
        obj.intensity = preset.lighting.fillIntensity;
      }
    }
  });

  // Toggle grid visibility
  const grid = scene.getObjectByName('grid');
  if (grid) grid.visible = preset.environment.showGrid;
}

// ============================================================================
// Screenshot Capture
// ============================================================================

export interface CaptureOptions {
  scale?: number; // 1x, 2x, 4x
  format?: 'image/png' | 'image/jpeg';
  quality?: number; // JPEG quality 0-1
}

/**
 * Capture the current viewport as an image Blob.
 * Temporarily resizes the renderer to achieve higher resolution.
 */
export function captureViewport(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  options: CaptureOptions = {},
): Promise<Blob> {
  const { scale = 2, format = 'image/png', quality = 0.92 } = options;

  return new Promise((resolve, reject) => {
    const canvas = renderer.domElement;
    const originalWidth = canvas.width;
    const originalHeight = canvas.height;
    const origPixelRatio = renderer.getPixelRatio();

    // Temporarily render at higher resolution
    renderer.setPixelRatio(1);
    renderer.setSize(originalWidth * scale, originalHeight * scale, false);
    renderer.render(scene, camera);

    canvas.toBlob(
      (blob) => {
        // Restore original size
        renderer.setPixelRatio(origPixelRatio);
        renderer.setSize(originalWidth, originalHeight, false);
        renderer.render(scene, camera);

        if (blob) resolve(blob);
        else reject(new Error('Failed to capture viewport'));
      },
      format,
      quality,
    );
  });
}

/**
 * Add a watermark to a captured image Blob.
 * Returns a new Blob with the watermark composited.
 */
export async function addWatermark(
  imageBlob: Blob,
  text: string,
  options?: { opacity?: number; fontSize?: number },
): Promise<Blob> {
  const { opacity = 0.3, fontSize = 16 } = options || {};

  const img = new Image();
  const url = URL.createObjectURL(imageBlob);

  return new Promise((resolve, reject) => {
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Failed to get canvas context')); return; }

      ctx.drawImage(img, 0, 0);

      // Draw watermark text at bottom-right
      ctx.globalAlpha = opacity;
      ctx.font = `${fontSize}px "Outfit", Arial, sans-serif`;
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(text, canvas.width - 20, canvas.height - 15);

      // Optional: add date
      ctx.font = `${fontSize * 0.7}px "Outfit", Arial, sans-serif`;
      ctx.fillText(new Date().toLocaleDateString(), canvas.width - 20, canvas.height - 15 + fontSize * 0.8);

      ctx.globalAlpha = 1;

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create watermarked image'));
        },
        'image/png',
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}
