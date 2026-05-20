/**
 * ImageSelector - Visual selection interface for clipping images
 */

import { FurnitureImageDetector, type DetectorOptions } from './image-detector';
import type { DetectedImage } from '../types/database';

export interface SelectionEvent {
  type: 'select' | 'deselect' | 'confirm' | 'cancel';
  image?: DetectedImage;
  images?: DetectedImage[];
}

export type SelectionCallback = (event: SelectionEvent) => void;

export class ImageSelector {
  private detector: FurnitureImageDetector;
  private overlay: HTMLDivElement | null = null;
  private isActive = false;
  private detectedImages: DetectedImage[] = [];
  private selectedImages: Set<string> = new Set();
  private callbacks: SelectionCallback[] = [];
  private multiSelectMode = false;

  constructor(detectorOptions?: Partial<DetectorOptions>) {
    this.detector = new FurnitureImageDetector(detectorOptions);
  }

  /**
   * Activate selection mode
   */
  activate(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.detectedImages = this.detector.detectImages();
    this.createOverlay();
    this.highlightDetectedImages();
    this.bindEvents();
  }

  /**
   * Deactivate selection mode
   */
  deactivate(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.removeOverlay();
    this.clearHighlights();
    this.unbindEvents();
    this.selectedImages.clear();
  }

  /**
   * Toggle selection mode
   */
  toggle(): boolean {
    if (this.isActive) {
      this.deactivate();
    } else {
      this.activate();
    }
    return this.isActive;
  }

  /**
   * Set multi-select mode
   */
  setMultiSelectMode(enabled: boolean): void {
    this.multiSelectMode = enabled;
  }

  /**
   * Get currently selected images
   */
  getSelectedImages(): DetectedImage[] {
    return this.detectedImages.filter((img) =>
      this.selectedImages.has(this.getImageKey(img))
    );
  }

  /**
   * Subscribe to selection events
   */
  onSelection(callback: SelectionCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Create the overlay element
   */
  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.id = 'dawin-selector-overlay';
    this.overlay.innerHTML = `
      <style>
        #dawin-selector-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 2147483646;
          pointer-events: none;
        }
        
        .dawin-image-highlight {
          position: absolute;
          border: 3px dashed #2563EB;
          border-radius: 4px;
          pointer-events: auto;
          cursor: pointer;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }
        
        .dawin-image-highlight:hover {
          border-color: #16A34A;
          border-style: solid;
          background: rgba(22, 163, 74, 0.1);
        }
        
        .dawin-image-highlight.selected {
          border-color: #16A34A;
          border-style: solid;
          background: rgba(22, 163, 74, 0.15);
        }
        
        .dawin-image-highlight .dawin-checkbox {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 24px;
          height: 24px;
          background: white;
          border: 2px solid #2563EB;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s;
        }
        
        .dawin-image-highlight:hover .dawin-checkbox,
        .dawin-image-highlight.selected .dawin-checkbox {
          opacity: 1;
        }
        
        .dawin-image-highlight.selected .dawin-checkbox {
          background: #16A34A;
          border-color: #16A34A;
        }
        
        .dawin-image-highlight.selected .dawin-checkbox::after {
          content: '✓';
          color: white;
          font-size: 14px;
          font-weight: bold;
        }
        
        .dawin-tooltip {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 6px 10px;
          border-radius: 4px;
          font-size: 12px;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s;
          margin-bottom: 8px;
        }
        
        .dawin-image-highlight:hover .dawin-tooltip {
          opacity: 1;
        }
        
        #dawin-selector-toolbar {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          padding: 12px 20px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          display: flex;
          align-items: center;
          gap: 16px;
          z-index: 2147483647;
          pointer-events: auto;
          font-family: system-ui, sans-serif;
        }
        
        #dawin-selector-toolbar button {
          padding: 8px 16px;
          border-radius: 6px;
          border: none;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        #dawin-selector-toolbar .primary-btn {
          background: #2563EB;
          color: white;
        }
        
        #dawin-selector-toolbar .primary-btn:hover {
          background: #1d4ed8;
        }
        
        #dawin-selector-toolbar .primary-btn:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }
        
        #dawin-selector-toolbar .secondary-btn {
          background: #f3f4f6;
          color: #374151;
        }
        
        #dawin-selector-toolbar .secondary-btn:hover {
          background: #e5e7eb;
        }
        
        #dawin-selector-toolbar .status {
          color: #6b7280;
          font-size: 14px;
        }
      </style>
      
      <div id="dawin-selector-toolbar">
        <span class="status">
          <span id="dawin-detected-count">${this.detectedImages.length}</span> images found
          <span id="dawin-selected-status"></span>
        </span>
        <button class="secondary-btn" id="dawin-toggle-multi">Multi-select</button>
        <button class="primary-btn" id="dawin-confirm-btn" disabled>Clip Selected</button>
        <button class="secondary-btn" id="dawin-cancel-btn">Cancel (ESC)</button>
      </div>
    `;

    document.body.appendChild(this.overlay);

    // Bind toolbar buttons
    this.overlay.querySelector('#dawin-toggle-multi')?.addEventListener('click', () => {
      this.multiSelectMode = !this.multiSelectMode;
      const btn = this.overlay?.querySelector('#dawin-toggle-multi');
      if (btn) {
        btn.textContent = this.multiSelectMode ? 'Single-select' : 'Multi-select';
      }
    });

    this.overlay.querySelector('#dawin-confirm-btn')?.addEventListener('click', () => {
      this.confirmSelection();
    });

    this.overlay.querySelector('#dawin-cancel-btn')?.addEventListener('click', () => {
      this.emit({ type: 'cancel' });
      this.deactivate();
    });
  }

  /**
   * Remove the overlay
   */
  private removeOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  /**
   * Highlight all detected images
   */
  private highlightDetectedImages(): void {
    if (!this.overlay) return;

    for (const image of this.detectedImages) {
      const highlight = document.createElement('div');
      highlight.className = 'dawin-image-highlight';
      highlight.dataset.imageKey = this.getImageKey(image);

      this.positionHighlight(highlight, image.boundingRect);

      // Add checkbox
      const checkbox = document.createElement('div');
      checkbox.className = 'dawin-checkbox';
      highlight.appendChild(checkbox);

      // Add tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'dawin-tooltip';
      tooltip.textContent = this.getImageLabel(image);
      highlight.appendChild(tooltip);

      // Click handler
      highlight.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleImageSelection(image);
      });

      this.overlay.appendChild(highlight);
    }
  }

  /**
   * Clear all highlights
   */
  private clearHighlights(): void {
    document.querySelectorAll('.dawin-image-highlight').forEach((el) => el.remove());
  }

  /**
   * Position highlight element over image
   */
  private positionHighlight(element: HTMLElement, rect: DOMRect): void {
    element.style.left = `${rect.left + window.scrollX}px`;
    element.style.top = `${rect.top + window.scrollY}px`;
    element.style.width = `${rect.width}px`;
    element.style.height = `${rect.height}px`;
  }

  /**
   * Get label for image tooltip
   */
  private getImageLabel(image: DetectedImage): string {
    if (image.alt) {
      return image.alt.length > 50 ? image.alt.slice(0, 50) + '...' : image.alt;
    }
    return `${Math.round(image.width)}×${Math.round(image.height)}`;
  }

  /**
   * Get unique key for image
   */
  private getImageKey(image: DetectedImage): string {
    return image.highResUrl || image.imageUrl;
  }

  /**
   * Toggle image selection
   */
  private toggleImageSelection(image: DetectedImage): void {
    const key = this.getImageKey(image);

    if (this.selectedImages.has(key)) {
      this.selectedImages.delete(key);
      this.emit({ type: 'deselect', image });
    } else {
      if (!this.multiSelectMode) {
        // Clear previous selections in single-select mode
        this.selectedImages.clear();
        this.updateAllHighlights();
      }
      this.selectedImages.add(key);
      this.emit({ type: 'select', image });
    }

    this.updateHighlight(key);
    this.updateToolbar();
  }

  /**
   * Update highlight visual state
   */
  private updateHighlight(key: string): void {
    const highlight = this.overlay?.querySelector(`[data-image-key="${CSS.escape(key)}"]`);
    if (highlight) {
      highlight.classList.toggle('selected', this.selectedImages.has(key));
    }
  }

  /**
   * Update all highlights
   */
  private updateAllHighlights(): void {
    this.overlay?.querySelectorAll('.dawin-image-highlight').forEach((el) => {
      const key = (el as HTMLElement).dataset.imageKey;
      if (key) {
        el.classList.toggle('selected', this.selectedImages.has(key));
      }
    });
  }

  /**
   * Update toolbar state
   */
  private updateToolbar(): void {
    const count = this.selectedImages.size;
    const status = this.overlay?.querySelector('#dawin-selected-status');
    const confirmBtn = this.overlay?.querySelector('#dawin-confirm-btn') as HTMLButtonElement;

    if (status) {
      status.textContent = count > 0 ? ` · ${count} selected` : '';
    }

    if (confirmBtn) {
      confirmBtn.disabled = count === 0;
      confirmBtn.textContent = count > 0 ? `Clip ${count} Image${count > 1 ? 's' : ''}` : 'Clip Selected';
    }
  }

  /**
   * Confirm selection and emit event
   */
  private confirmSelection(): void {
    const images = this.getSelectedImages();
    if (images.length > 0) {
      this.emit({ type: 'confirm', images });
    }
  }

  /**
   * Emit event to callbacks
   */
  private emit(event: SelectionEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('Selection callback error:', error);
      }
    }
  }

  /**
   * Bind keyboard events
   */
  private bindEvents(): void {
    document.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('scroll', this.handleScroll, { passive: true });
    window.addEventListener('resize', this.handleResize);
  }

  /**
   * Unbind keyboard events
   */
  private unbindEvents(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('scroll', this.handleScroll);
    window.removeEventListener('resize', this.handleResize);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.emit({ type: 'cancel' });
      this.deactivate();
    } else if (e.key === 'Enter' && this.selectedImages.size > 0) {
      e.preventDefault();
      this.confirmSelection();
    }
  };

  private handleScroll = (): void => {
    this.repositionHighlights();
  };

  private handleResize = (): void => {
    this.repositionHighlights();
  };

  /**
   * Reposition highlights after scroll/resize
   */
  private repositionHighlights(): void {
    for (const image of this.detectedImages) {
      const key = this.getImageKey(image);
      const highlight = this.overlay?.querySelector(`[data-image-key="${CSS.escape(key)}"]`) as HTMLElement;
      if (highlight) {
        const newRect = image.element.getBoundingClientRect();
        this.positionHighlight(highlight, newRect);
      }
    }
  }
}

// Export singleton instance
export const imageSelector = new ImageSelector();
