/**
 * DOCUMENT SCANNER SERVICE
 *
 * High-quality document scanning powered by Gemini Vision AI.
 *
 * Pipeline:
 *   Photo → Gemini detects document corners → Inward-nudge refinement
 *   → Perspective warp → Auto-trim background → Color-accurate enhancement
 *
 * Key quality decisions:
 * - Trust Gemini corners, only nudge inward (never outward) to avoid background
 * - Normalize paper to true white (255), not off-white
 * - Preserve original color hue — only adjust brightness, not color balance
 * - Gentle contrast that keeps ink detail while whitening paper
 */

interface Point {
  x: number;
  y: number;
}

interface ScanResult {
  dataUrl: string;
  cornersDetected: boolean;
}

const CORNER_DETECTION_PROMPT = `You are a document edge detector. Find the document, receipt, invoice, or paper in this photo.

Return ONLY valid JSON (no markdown, no code fences). Format:
{
  "detected": true,
  "corners": {
    "topLeft": {"x": 0.12, "y": 0.08},
    "topRight": {"x": 0.91, "y": 0.06},
    "bottomRight": {"x": 0.93, "y": 0.95},
    "bottomLeft": {"x": 0.10, "y": 0.97}
  }
}

Critical rules:
- x and y are normalized coordinates (0.0 to 1.0) as fractions of image width and height
- Corners MUST be in clockwise order: topLeft, topRight, bottomRight, bottomLeft
- Place each corner slightly INSIDE the paper edge (1-2% inward from the physical boundary)
- This ensures the scan captures only paper content with zero background
- For receipts: top = just below the torn/cut paper edge, bottom = just above the bottom edge
- For crumpled or curled documents, place corners on the innermost visible content boundary
- If the document fills >90% of the image with barely any background visible, return: {"detected": false, "corners": null}
- If no document/paper is visible, return: {"detected": false, "corners": null}`;

export class DocumentScannerService {
  private static instance: DocumentScannerService;
  private genAI: any = null;

  private constructor() {}

  static getInstance(): DocumentScannerService {
    if (!DocumentScannerService.instance) {
      DocumentScannerService.instance = new DocumentScannerService();
    }
    return DocumentScannerService.instance;
  }

  private async getGenAI(): Promise<any> {
    if (!this.genAI) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('VITE_GEMINI_API_KEY not configured');
      }
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
    return this.genAI;
  }

  /**
   * Full scan pipeline.
   */
  async scan(imageDataUrl: string): Promise<ScanResult> {
    const img = await this.loadImage(imageDataUrl);

    // 1. Detect corners using Gemini Vision
    let corners: Point[] | null = null;
    try {
      corners = await this.detectCornersWithGemini(img);
    } catch (err) {
      console.warn('Gemini corner detection failed, using fallback:', err);
    }

    if (!corners) {
      return {
        dataUrl: await this.enhanceScan(imageDataUrl),
        cornersDetected: false,
      };
    }

    // 2. Nudge corners inward by 1% to guarantee no background
    const nudged = this.nudgeCornersInward(corners, 0.01);

    // 3. Perspective warp (flatten)
    const flattened = this.perspectiveWarp(img, nudged);

    // 4. Auto-trim any remaining background border
    const trimmed = this.autoTrimBackground(flattened);

    // 5. Color-accurate enhancement
    const enhanced = this.adaptiveEnhance(trimmed);

    return {
      dataUrl: enhanced.toDataURL('image/jpeg', 0.94),
      cornersDetected: true,
    };
  }

  // ─── Gemini Vision Corner Detection ────────────────────────

  private async detectCornersWithGemini(
    img: HTMLImageElement
  ): Promise<Point[] | null> {
    const genAI = await this.getGenAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const downscaled = this.downscaleForDetection(img);
    const base64 = downscaled.split(',')[1];
    const imgWidth = img.width;
    const imgHeight = img.height;

    const result = await model.generateContent([
      CORNER_DETECTION_PROMPT,
      { inlineData: { data: base64, mimeType: 'image/jpeg' } },
    ]);

    const text = result.response.text();
    const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    if (!parsed.detected || !parsed.corners) {
      return null;
    }

    const c = parsed.corners;
    const keys = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const;
    for (const key of keys) {
      if (!c[key] || typeof c[key].x !== 'number' || typeof c[key].y !== 'number') {
        return null;
      }
      if (c[key].x < 0 || c[key].x > 1 || c[key].y < 0 || c[key].y > 1) {
        return null;
      }
    }

    return [
      { x: c.topLeft.x * imgWidth, y: c.topLeft.y * imgHeight },
      { x: c.topRight.x * imgWidth, y: c.topRight.y * imgHeight },
      { x: c.bottomRight.x * imgWidth, y: c.bottomRight.y * imgHeight },
      { x: c.bottomLeft.x * imgWidth, y: c.bottomLeft.y * imgHeight },
    ];
  }

  // ─── Corner Nudging ────────────────────────────────────────

  /**
   * Nudge each corner toward the center of the quadrilateral by a percentage.
   * This ensures we crop slightly inside the document, avoiding background edges.
   */
  private nudgeCornersInward(corners: Point[], fraction: number): Point[] {
    // Compute centroid
    const cx = corners.reduce((s, p) => s + p.x, 0) / 4;
    const cy = corners.reduce((s, p) => s + p.y, 0) / 4;

    return corners.map(corner => ({
      x: corner.x + (cx - corner.x) * fraction,
      y: corner.y + (cy - corner.y) * fraction,
    }));
  }

  // ─── Perspective Warp ──────────────────────────────────────

  private perspectiveWarp(
    sourceImg: HTMLImageElement,
    corners: Point[]
  ): HTMLCanvasElement {
    const [tl, tr, br, bl] = corners;

    const widthTop = Math.sqrt((tr.x - tl.x) ** 2 + (tr.y - tl.y) ** 2);
    const widthBottom = Math.sqrt((br.x - bl.x) ** 2 + (br.y - bl.y) ** 2);
    const heightLeft = Math.sqrt((bl.x - tl.x) ** 2 + (bl.y - tl.y) ** 2);
    const heightRight = Math.sqrt((br.x - tr.x) ** 2 + (br.y - tr.y) ** 2);

    const outW = Math.round(Math.max(widthTop, widthBottom));
    const outH = Math.round(Math.max(heightLeft, heightRight));

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = sourceImg.width;
    srcCanvas.height = sourceImg.height;
    const srcCtx = srcCanvas.getContext('2d')!;
    srcCtx.drawImage(sourceImg, 0, 0);
    const srcData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    const outCtx = outCanvas.getContext('2d')!;
    const outData = outCtx.createImageData(outW, outH);

    for (let oy = 0; oy < outH; oy++) {
      const v = oy / outH;
      for (let ox = 0; ox < outW; ox++) {
        const u = ox / outW;

        const topX = tl.x + u * (tr.x - tl.x);
        const topY = tl.y + u * (tr.y - tl.y);
        const botX = bl.x + u * (br.x - bl.x);
        const botY = bl.y + u * (br.y - bl.y);

        const srcX = topX + v * (botX - topX);
        const srcY = topY + v * (botY - topY);

        // Bilinear pixel interpolation
        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        const x1 = Math.min(x0 + 1, srcCanvas.width - 1);
        const y1 = Math.min(y0 + 1, srcCanvas.height - 1);
        const fx = srcX - x0;
        const fy = srcY - y0;

        if (x0 >= 0 && x0 < srcCanvas.width && y0 >= 0 && y0 < srcCanvas.height) {
          const oi = (oy * outW + ox) * 4;
          for (let c = 0; c < 3; c++) {
            const v00 = srcData.data[(y0 * srcCanvas.width + x0) * 4 + c];
            const v10 = srcData.data[(y0 * srcCanvas.width + x1) * 4 + c];
            const v01 = srcData.data[(y1 * srcCanvas.width + x0) * 4 + c];
            const v11 = srcData.data[(y1 * srcCanvas.width + x1) * 4 + c];
            outData.data[oi + c] = Math.round(
              v00 * (1 - fx) * (1 - fy) +
              v10 * fx * (1 - fy) +
              v01 * (1 - fx) * fy +
              v11 * fx * fy
            );
          }
          outData.data[oi + 3] = 255;
        }
      }
    }

    outCtx.putImageData(outData, 0, 0);
    return outCanvas;
  }

  // ─── Auto-Trim Background ─────────────────────────────────

  /**
   * After perspective warp, detect and trim remaining background strips.
   * Scans inward from each edge comparing to paper interior brightness.
   */
  private autoTrimBackground(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d')!;
    const { width, height } = canvas;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const brightness = (x: number, y: number): number => {
      const idx = (y * width + x) * 4;
      return data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
    };

    // Sample paper brightness from center
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    const sz = Math.min(50, Math.floor(Math.min(width, height) / 4));
    let paperSum = 0, paperCount = 0;
    for (let dy = -sz; dy <= sz; dy++) {
      for (let dx = -sz; dx <= sz; dx++) {
        paperSum += brightness(cx + dx, cy + dy);
        paperCount++;
      }
    }
    const paperBright = paperSum / paperCount;

    const maxTrimX = Math.floor(width * 0.08);
    const maxTrimY = Math.floor(height * 0.08);
    const threshold = 40;

    const scanEdge = (getVal: (i: number) => number, max: number): number => {
      let trim = 0;
      for (let i = 0; i < max; i++) {
        if (Math.abs(getVal(i) - paperBright) > threshold) {
          trim = i + 1;
        } else {
          break;
        }
      }
      return trim;
    };

    const colAvg = (x: number): number => {
      let s = 0;
      const n = Math.min(20, height);
      const step = Math.floor(height / n);
      for (let i = 0; i < n; i++) s += brightness(x, i * step);
      return s / n;
    };
    const rowAvg = (y: number): number => {
      let s = 0;
      const n = Math.min(20, width);
      const step = Math.floor(width / n);
      for (let i = 0; i < n; i++) s += brightness(i * step, y);
      return s / n;
    };

    const trimLeft = scanEdge(i => colAvg(i), maxTrimX);
    const trimRight = scanEdge(i => colAvg(width - 1 - i), maxTrimX);
    const trimTop = scanEdge(i => rowAvg(i), maxTrimY);
    const trimBottom = scanEdge(i => rowAvg(height - 1 - i), maxTrimY);

    if (trimLeft === 0 && trimRight === 0 && trimTop === 0 && trimBottom === 0) {
      return canvas;
    }

    const newW = width - trimLeft - trimRight;
    const newH = height - trimTop - trimBottom;
    if (newW < width * 0.7 || newH < height * 0.7) return canvas; // safety

    const trimmed = document.createElement('canvas');
    trimmed.width = newW;
    trimmed.height = newH;
    trimmed.getContext('2d')!.drawImage(canvas, trimLeft, trimTop, newW, newH, 0, 0, newW, newH);
    return trimmed;
  }

  // ─── Adaptive Enhancement ──────────────────────────────────

  /**
   * Color-accurate scan enhancement:
   * 1. Estimate local paper background (75th percentile, large blocks)
   * 2. Normalize each pixel so paper → pure white (255)
   * 3. Gentle contrast boost that preserves ink color and detail
   * 4. Unsharp mask for crisp text
   *
   * Key: normalizes to 255 (not 240) so white paper stays white, not cream.
   * Uses luminance-only normalization to preserve original color hue.
   */
  private adaptiveEnhance(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imageData;

    // Step 1: Compute grayscale luminance
    const gray = new Float32Array(width * height);
    for (let i = 0; i < gray.length; i++) {
      const idx = i * 4;
      gray[i] = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
    }

    // Step 2: Large-block background estimation (75th percentile)
    const BLOCK = Math.max(48, Math.round(Math.min(width, height) / 15));
    const blocksX = Math.ceil(width / BLOCK);
    const blocksY = Math.ceil(height / BLOCK);
    const blockBg = new Float32Array(blocksX * blocksY);

    for (let by = 0; by < blocksY; by++) {
      for (let bx = 0; bx < blocksX; bx++) {
        const y0 = by * BLOCK;
        const y1 = Math.min(y0 + BLOCK, height);
        const x0 = bx * BLOCK;
        const x1 = Math.min(x0 + BLOCK, width);

        const vals: number[] = [];
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            vals.push(gray[y * width + x]);
          }
        }
        vals.sort((a, b) => a - b);
        blockBg[by * blocksX + bx] = vals[Math.floor(vals.length * 0.75)];
      }
    }

    // Step 3: Normalize + contrast
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        // Bilinear interpolation of block backgrounds
        const bxf = (x / BLOCK) - 0.5;
        const byf = (y / BLOCK) - 0.5;
        const bx0 = Math.max(0, Math.floor(bxf));
        const by0 = Math.max(0, Math.floor(byf));
        const bx1 = Math.min(blocksX - 1, bx0 + 1);
        const by1 = Math.min(blocksY - 1, by0 + 1);
        const fx = Math.max(0, Math.min(1, bxf - bx0));
        const fy = Math.max(0, Math.min(1, byf - by0));

        const bg =
          blockBg[by0 * blocksX + bx0] * (1 - fx) * (1 - fy) +
          blockBg[by0 * blocksX + bx1] * fx * (1 - fy) +
          blockBg[by1 * blocksX + bx0] * (1 - fx) * fy +
          blockBg[by1 * blocksX + bx1] * fx * fy;

        // Normalization factor: map local paper background to 255 (true white)
        const localBg = Math.max(bg, 60);
        const normFactor = 255 / localBg;

        // Apply luminance-based normalization to each channel
        // This preserves color ratios (hue) while adjusting brightness
        for (let c = 0; c < 3; c++) {
          let val = data[idx + c] * normFactor;

          // Gentle contrast: only boost the gap between paper and ink
          // Paper (val > 220): push gently toward 255
          // Ink (val < 120): darken slightly for readability
          // Mid-tones: leave mostly alone
          if (val > 220) {
            val = 220 + (val - 220) * 1.5; // push paper → white
          } else if (val < 120) {
            val = val * 0.85; // gentle ink darkening
          }

          data[idx + c] = Math.min(255, Math.max(0, Math.round(val)));
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Step 4: Unsharp mask for crisp text
    this.unsharpMask(ctx, width, height, 0.5);

    return canvas;
  }

  /**
   * Unsharp mask: sharpen text edges.
   */
  private unsharpMask(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    amount: number
  ): void {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d')!;

    tempCtx.filter = 'blur(1px)';
    tempCtx.drawImage(ctx.canvas, 0, 0);

    const original = ctx.getImageData(0, 0, width, height);
    const blurred = tempCtx.getImageData(0, 0, width, height);

    for (let i = 0; i < original.data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const diff = original.data[i + c] - blurred.data[i + c];
        original.data[i + c] = Math.min(255, Math.max(0,
          Math.round(original.data[i + c] + amount * diff)
        ));
      }
    }

    ctx.putImageData(original, 0, 0);
  }

  /**
   * Enhance without perspective correction (fallback).
   */
  private async enhanceScan(imageDataUrl: string): Promise<string> {
    const img = await this.loadImage(imageDataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    this.adaptiveEnhance(canvas);
    return canvas.toDataURL('image/jpeg', 0.94);
  }

  // ─── Helpers ───────────────────────────────────────────────

  /**
   * Downscale to ~1024px for Gemini detection.
   */
  private downscaleForDetection(img: HTMLImageElement): string {
    const MAX_DIM = 1024;
    if (img.width <= MAX_DIM && img.height <= MAX_DIM) {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      c.getContext('2d')!.drawImage(img, 0, 0);
      return c.toDataURL('image/jpeg', 0.85);
    }

    const scale = MAX_DIM / Math.max(img.width, img.height);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);

    return canvas.toDataURL('image/jpeg', 0.85);
  }

  private loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }
}
