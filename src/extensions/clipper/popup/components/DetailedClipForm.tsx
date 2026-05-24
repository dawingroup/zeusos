/**
 * DetailedClipForm Component
 * Form for detailed clipping with clip type selection and linkages
 */

import React, { useState, useEffect } from 'react';
import { 
  Lightbulb, 
  Image, 
  Puzzle, 
  ShoppingCart, 
  Palette, 
  Wrench, 
  Rocket,
  ChevronDown,
  X,
  Check,
  Loader2,
  FolderOpen,
  Package
} from 'lucide-react';

export type ClipType = 
  | 'inspiration'
  | 'reference'
  | 'parts-source'
  | 'procurement'
  | 'material'
  | 'asset'
  | 'product-idea';

interface ClipTypeOption {
  value: ClipType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  linkType: 'project' | 'design-item' | 'material' | 'asset' | 'product' | null;
}

const CLIP_TYPE_OPTIONS: ClipTypeOption[] = [
  {
    value: 'inspiration',
    label: 'Inspiration',
    description: 'General design inspiration',
    icon: Lightbulb,
    color: 'text-[var(--rag-amber)]',
    linkType: 'project',
  },
  {
    value: 'reference',
    label: 'Design Reference',
    description: 'Reference for a specific design item',
    icon: Image,
    color: 'text-[var(--rag-blue)]',
    linkType: 'design-item',
  },
  {
    value: 'parts-source',
    label: 'Parts Source',
    description: 'Extract parts from this product',
    icon: Puzzle,
    color: 'text-[var(--rag-blue)]',
    linkType: 'design-item',
  },
  {
    value: 'procurement',
    label: 'Procurement Item',
    description: 'Item to procure for a project',
    icon: ShoppingCart,
    color: 'text-[var(--rag-green)]',
    linkType: 'design-item',
  },
  {
    value: 'material',
    label: 'New Material',
    description: 'Add to materials library',
    icon: Palette,
    color: 'text-[var(--rag-red)]',
    linkType: 'material',
  },
  {
    value: 'asset',
    label: 'New Asset',
    description: 'Hardware or fitting for registry',
    icon: Wrench,
    color: 'text-[var(--rag-amber)]',
    linkType: 'asset',
  },
  {
    value: 'product-idea',
    label: 'Product Idea',
    description: 'New product for launch pipeline',
    icon: Rocket,
    color: 'text-[var(--rag-blue)]',
    linkType: 'product',
  },
];

interface Project {
  id: string;
  name: string;
}

interface DesignItem {
  id: string;
  name: string;
  projectId: string;
}

interface DetailedClipFormProps {
  imageUrl: string;
  sourceUrl: string;
  pageTitle: string;
  onSubmit: (data: {
    clipType: ClipType;
    projectId?: string;
    designItemId?: string;
    notes?: string;
  }) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function DetailedClipForm({
  imageUrl,
  sourceUrl,
  pageTitle,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: DetailedClipFormProps) {
  const [selectedType, setSelectedType] = useState<ClipType>('inspiration');
  const [projects, setProjects] = useState<Project[]>([]);
  const [designItems, setDesignItems] = useState<DesignItem[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedDesignItem, setSelectedDesignItem] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  const selectedOption = CLIP_TYPE_OPTIONS.find(o => o.value === selectedType);
  const needsProject = selectedOption?.linkType === 'project' || selectedOption?.linkType === 'design-item';
  const needsDesignItem = selectedOption?.linkType === 'design-item';

  // Load projects from chrome.storage (cached from web app)
  useEffect(() => {
    const loadProjects = async () => {
      setLoadingProjects(true);
      try {
        const result = await chrome.storage.local.get(['projects']);
        setProjects(result.projects || []);
      } catch (error) {
        console.error('Failed to load projects:', error);
      }
      setLoadingProjects(false);
    };
    loadProjects();
  }, []);

  // Load design items when project changes
  useEffect(() => {
    if (!selectedProject || !needsDesignItem) {
      setDesignItems([]);
      return;
    }

    const loadDesignItems = async () => {
      setLoadingItems(true);
      try {
        const result = await chrome.storage.local.get(['designItems']);
        const allItems: DesignItem[] = result.designItems || [];
        setDesignItems(allItems.filter((item) => item.projectId === selectedProject));
      } catch (error) {
        console.error('Failed to load design items:', error);
      }
      setLoadingItems(false);
    };
    loadDesignItems();
  }, [selectedProject, needsDesignItem]);

  const handleSubmit = () => {
    onSubmit({
      clipType: selectedType,
      projectId: selectedProject || undefined,
      designItemId: selectedDesignItem || undefined,
      notes: notes || undefined,
    });
  };

  const isValid = () => {
    // Make project/design item selection optional for now
    // Users can link later in the web app
    return true;
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <h2 className="font-semibold text-foreground">Save Clip</h2>
        <button
          onClick={onCancel}
          className="p-1 text-[var(--fg-tertiary)] hover:text-muted-foreground rounded"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Image Preview */}
      <div className="p-3 border-b bg-[var(--bg-sunken)]">
        <div className="flex gap-3">
          <img
            src={imageUrl}
            alt={pageTitle}
            className="w-20 h-20 object-cover rounded-lg border"
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground text-sm truncate">{pageTitle}</p>
            <p className="text-xs text-muted-foreground truncate">{sourceUrl}</p>
          </div>
        </div>
      </div>

      {/* Clip Type Selection */}
      <div className="p-3 border-b">
        <label className="block text-xs font-medium text-muted-foreground mb-2">
          What are you clipping this for?
        </label>
        <div className="grid grid-cols-2 gap-2">
          {CLIP_TYPE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedType === option.value;
            return (
              <button
                key={option.value}
                onClick={() => {
                  setSelectedType(option.value);
                  setSelectedProject('');
                  setSelectedDesignItem('');
                }}
                className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                }`}
              >
                <Icon className={`w-4 h-4 ${option.color}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                    {option.label}
                  </p>
                </div>
                {isSelected && <Check className="w-3 h-3 text-primary" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Project/Design Item Selection */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {needsProject && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              <FolderOpen className="w-3 h-3 inline mr-1" />
              Link to Project
            </label>
            <div className="relative">
              <select
                value={selectedProject}
                onChange={(e) => {
                  setSelectedProject(e.target.value);
                  setSelectedDesignItem('');
                }}
                className="w-full px-3 py-2 text-sm border rounded-lg appearance-none bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                disabled={loadingProjects}
              >
                <option value="">Select a project...</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--fg-tertiary)] pointer-events-none" />
            </div>
          </div>
        )}

        {needsDesignItem && selectedProject && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              <Package className="w-3 h-3 inline mr-1" />
              Link to Design Item
            </label>
            <div className="relative">
              <select
                value={selectedDesignItem}
                onChange={(e) => setSelectedDesignItem(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg appearance-none bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                disabled={loadingItems}
              >
                <option value="">Select a design item...</option>
                {designItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--fg-tertiary)] pointer-events-none" />
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this clip..."
            className="w-full px-3 py-2 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            rows={2}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t bg-[var(--bg-sunken)]">
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm font-medium text-muted-foreground bg-card border rounded-lg hover:bg-[var(--bg-sunken)]"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid() || isSubmitting}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save Clip
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DetailedClipForm;
