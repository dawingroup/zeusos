/**
 * KnowledgeBasePage — Admin UI for the furniture type knowledge base
 *
 * CRUD interface for managing furniture types used by the AI part
 * recognition system in the Workshop Viewer.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, Save, X, ChevronDown, ChevronRight,
  Bed, Armchair, Monitor, Layers,
  Box, Package,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import {
  getFurnitureTypes,
  createFurnitureType,
  updateFurnitureType,
  deactivateFurnitureType,
} from '@/subsidiaries/finishes/design-studio/services/furnitureTypeService';
import type {
  FurnitureType,
  FurnitureCategory,
  ConstructionMethod,
  ExpectedPart,
  AssemblyGroupTemplate,
} from '@/subsidiaries/finishes/design-studio/types/furniture-type.types';

const CATEGORY_OPTIONS: { value: FurnitureCategory; label: string }[] = [
  { value: 'cabinet', label: 'Cabinet' },
  { value: 'storage', label: 'Storage' },
  { value: 'bed', label: 'Bed' },
  { value: 'desk', label: 'Desk' },
  { value: 'table', label: 'Table' },
  { value: 'chair', label: 'Chair' },
  { value: 'other', label: 'Other' },
];

const CONSTRUCTION_OPTIONS: { value: ConstructionMethod; label: string }[] = [
  { value: 'frameless_euro', label: 'Frameless Euro' },
  { value: 'face_frame', label: 'Face Frame' },
  { value: 'post_and_rail', label: 'Post & Rail' },
  { value: 'slab', label: 'Slab' },
  { value: 'panel', label: 'Panel' },
  { value: 'upholstered', label: 'Upholstered' },
  { value: 'other', label: 'Other' },
];

const ROLE_OPTIONS = [
  'side', 'top_bottom', 'back', 'shelf', 'mobile_shelf', 'vertical_division',
  'door', 'drawer', 'drawer_component', 'rail', 'stile', 'panel', 'bar',
  'cover', 'plinth', 'muntin', 'counter_front', 'other',
];

const PURCHASE_CATEGORIES = [
  'board_material', 'hardware', 'edging', 'glass', 'fabric', 'upholstery', 'timber', 'metal', 'other',
];

function getCategoryIcon(category: FurnitureCategory) {
  switch (category) {
    case 'cabinet': return <Box className="h-4 w-4" />;
    case 'bed': return <Bed className="h-4 w-4" />;
    case 'chair': return <Armchair className="h-4 w-4" />;
    case 'desk': return <Monitor className="h-4 w-4" />;
    case 'storage': return <Package className="h-4 w-4" />;
    case 'table': return <Box className="h-4 w-4" />;
    default: return <Layers className="h-4 w-4" />;
  }
}

export default function KnowledgeBasePage() {
  const [types, setTypes] = useState<FurnitureType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state for add/edit
  const [form, setForm] = useState<Partial<FurnitureType>>({});

  const loadTypes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFurnitureTypes();
      setTypes(data);
    } catch (err) {
      console.error('Failed to load furniture types:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTypes(); }, [loadTypes]);

  const startEdit = (type: FurnitureType) => {
    setEditingId(type.id);
    setForm({ ...type });
    setExpandedId(type.id);
  };

  const startAdd = () => {
    setShowAddForm(true);
    setEditingId(null);
    setForm({
      name: '',
      category: 'cabinet',
      icon: 'Box',
      description: '',
      constructionMethod: 'frameless_euro',
      expectedParts: [],
      assemblyGroups: [],
      namingPatterns: { convention: 'descriptive', prefixes: {}, includePosition: true, includeNumber: true },
      sortOrder: types.length + 1,
    });
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateFurnitureType(editingId, form, 'admin');
      } else {
        const id = form.name!.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        await createFurnitureType({ ...form, id, isActive: true } as FurnitureType, 'admin');
      }
      await loadTypes();
      setEditingId(null);
      setShowAddForm(false);
      setForm({});
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (typeId: string) => {
    if (!confirm('Deactivate this furniture type?')) return;
    await deactivateFurnitureType(typeId);
    await loadTypes();
  };

  const addExpectedPart = () => {
    setForm(f => ({
      ...f,
      expectedParts: [...(f.expectedParts || []), { role: 'panel' as any, nameTemplate: '', quantity: 1 }],
    }));
  };

  const removeExpectedPart = (index: number) => {
    setForm(f => ({
      ...f,
      expectedParts: (f.expectedParts || []).filter((_, i) => i !== index),
    }));
  };

  const updateExpectedPart = (index: number, updates: Partial<ExpectedPart>) => {
    setForm(f => ({
      ...f,
      expectedParts: (f.expectedParts || []).map((p, i) => i === index ? { ...p, ...updates } : p),
    }));
  };

  const addAssemblyGroup = () => {
    setForm(f => ({
      ...f,
      assemblyGroups: [...(f.assemblyGroups || []), { name: '', category: 'other' as any, description: '', roles: [], purchaseCategory: 'board_material' as any }],
    }));
  };

  const removeAssemblyGroup = (index: number) => {
    setForm(f => ({
      ...f,
      assemblyGroups: (f.assemblyGroups || []).filter((_, i) => i !== index),
    }));
  };

  const updateAssemblyGroup = (index: number, updates: Partial<AssemblyGroupTemplate>) => {
    setForm(f => ({
      ...f,
      assemblyGroups: (f.assemblyGroups || []).map((g, i) => i === index ? { ...g, ...updates } : g),
    }));
  };

  const isEditing = editingId !== null || showAddForm;
  const editForm = form;

  // Group types by category for display
  const grouped = new Map<FurnitureCategory, FurnitureType[]>();
  for (const t of types) {
    if (!grouped.has(t.category)) grouped.set(t.category, []);
    grouped.get(t.category)!.push(t);
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold">Furniture Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">
            {types.length} furniture types — used by AI part recognition in Workshop Viewer
          </p>
        </div>
        <Button size="sm" onClick={startAdd} disabled={isEditing}>
          <Plus className="h-4 w-4 mr-1" /> Add Type
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}

      {/* Add form */}
      {showAddForm && (
        <div className="border rounded-lg p-4 mb-4 bg-muted/20">
          <h3 className="text-sm font-semibold mb-3">New Furniture Type</h3>
          {renderForm()}
        </div>
      )}

      {/* Type list grouped by category */}
      {CATEGORY_OPTIONS.map(cat => {
        const catTypes = grouped.get(cat.value);
        if (!catTypes || catTypes.length === 0) return null;

        return (
          <div key={cat.value} className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              {getCategoryIcon(cat.value)}
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {cat.label} ({catTypes.length})
              </h2>
            </div>

            <div className="space-y-1">
              {catTypes.map(type => {
                const isExpanded = expandedId === type.id;
                const isEditingThis = editingId === type.id;

                return (
                  <div key={type.id} className="border rounded-lg overflow-hidden">
                    {/* Row header */}
                    <div
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/30"
                      onClick={() => setExpandedId(isExpanded ? null : type.id)}
                    >
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <span className="text-sm font-medium flex-1">{type.name}</span>
                      <span className="text-[10px] text-muted-foreground">{type.expectedParts?.length || 0} parts</span>
                      <span className="text-[10px] text-muted-foreground">{type.assemblyGroups?.length || 0} groups</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{type.constructionMethod}</span>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => startEdit(type)} className="p-1 rounded hover:bg-muted" title="Edit">
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button onClick={() => handleDelete(type.id)} className="p-1 rounded hover:bg-destructive/10" title="Deactivate">
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail / edit form */}
                    {isExpanded && (
                      <div className="px-3 py-3 border-t bg-muted/10">
                        {isEditingThis ? (
                          renderForm()
                        ) : (
                          <div className="space-y-3">
                            <p className="text-xs text-muted-foreground">{type.description}</p>

                            {/* Expected parts */}
                            <div>
                              <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Expected Parts</div>
                              <div className="grid grid-cols-2 gap-1">
                                {(type.expectedParts || []).map((p, i) => (
                                  <div key={i} className="text-xs flex items-center gap-1.5 py-0.5">
                                    <span className="text-muted-foreground">{typeof p.quantity === 'number' ? `${p.quantity}x` : 'n×'}</span>
                                    <span>{p.nameTemplate}</span>
                                    <span className="text-[10px] text-muted-foreground">({p.role})</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Assembly groups */}
                            <div>
                              <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Assembly Groups</div>
                              <div className="space-y-1">
                                {(type.assemblyGroups || []).map((g, i) => (
                                  <div key={i} className="text-xs flex items-center gap-2">
                                    <span className="font-medium">{g.name}</span>
                                    <span className="text-[10px] px-1 rounded bg-muted text-muted-foreground">{g.purchaseCategory}</span>
                                    <span className="text-muted-foreground">— {g.roles?.join(', ')}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  function renderForm() {
    return (
      <div className="space-y-4">
        {/* Basic info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px]">Name</Label>
            <Input value={editForm.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-7 text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">Category</Label>
            <select
              value={editForm.category || 'cabinet'}
              onChange={e => setForm(f => ({ ...f, category: e.target.value as FurnitureCategory }))}
              className="w-full h-7 text-xs border rounded px-2 bg-background"
            >
              {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <Label className="text-[10px]">Description</Label>
            <Input value={editForm.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="h-7 text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">Construction Method</Label>
            <select
              value={editForm.constructionMethod || 'frameless_euro'}
              onChange={e => setForm(f => ({ ...f, constructionMethod: e.target.value as ConstructionMethod }))}
              className="w-full h-7 text-xs border rounded px-2 bg-background"
            >
              {CONSTRUCTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-[10px]">Sort Order</Label>
            <Input type="number" value={editForm.sortOrder || 1} onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 1 }))} className="h-7 text-xs" />
          </div>
        </div>

        {/* Expected parts */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-[10px] font-semibold uppercase">Expected Parts</Label>
            <button onClick={addExpectedPart} className="text-[10px] text-primary hover:underline">+ Add Part</button>
          </div>
          <div className="space-y-1">
            {(editForm.expectedParts || []).map((p, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <select value={p.role} onChange={e => updateExpectedPart(i, { role: e.target.value as any })} className="h-6 text-[10px] border rounded px-1 bg-background w-28">
                  {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <Input value={p.nameTemplate} onChange={e => updateExpectedPart(i, { nameTemplate: e.target.value })} placeholder="Name template" className="h-6 text-[10px] flex-1" />
                <Input value={typeof p.quantity === 'number' ? p.quantity : ''} onChange={e => updateExpectedPart(i, { quantity: e.target.value ? parseInt(e.target.value) : 'varies' })} placeholder="Qty" className="h-6 text-[10px] w-12" />
                <button onClick={() => removeExpectedPart(i)} className="p-0.5 text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Assembly groups */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-[10px] font-semibold uppercase">Assembly Groups</Label>
            <button onClick={addAssemblyGroup} className="text-[10px] text-primary hover:underline">+ Add Group</button>
          </div>
          <div className="space-y-1">
            {(editForm.assemblyGroups || []).map((g, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Input value={g.name} onChange={e => updateAssemblyGroup(i, { name: e.target.value })} placeholder="Group name" className="h-6 text-[10px] w-32" />
                <select value={g.purchaseCategory} onChange={e => updateAssemblyGroup(i, { purchaseCategory: e.target.value as any })} className="h-6 text-[10px] border rounded px-1 bg-background w-28">
                  {PURCHASE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <Input value={g.description || ''} onChange={e => updateAssemblyGroup(i, { description: e.target.value })} placeholder="Description" className="h-6 text-[10px] flex-1" />
                <button onClick={() => removeAssemblyGroup(i)} className="p-0.5 text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Save / Cancel */}
        <div className="flex gap-2 pt-2 border-t">
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs">
            <Save className="h-3 w-3 mr-1" /> {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setShowAddForm(false); setForm({}); }} className="h-7 text-xs">
            Cancel
          </Button>
        </div>
      </div>
    );
  }
}
