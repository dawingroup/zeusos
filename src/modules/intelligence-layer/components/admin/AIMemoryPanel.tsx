/**
 * AI Memory Management Panel
 * Intelligence Admin Dashboard — View, search, create, edit, archive business memories
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  Search,
  Plus,
  Archive,
  Trash2,
  Edit3,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Tag,
  Clock,
  Hash,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';

import { useAuth } from '@/core/hooks/useAuth';
import {
  createMemory,
  updateMemory,
  archiveMemory,
  deleteMemory,
  subscribeToMemories,
} from '@/shared/services/ai/aiMemory.service';
import type {
  AIMemoryEntry,
  MemoryCategory,
  MemoryImportance,
} from '@/shared/services/ai/aiMemory.types';

// ============================================
// Constants
// ============================================

const CATEGORY_OPTIONS: { value: MemoryCategory; label: string }[] = [
  { value: 'business_fact', label: 'Business Fact' },
  { value: 'user_preference', label: 'User Preference' },
  { value: 'project_insight', label: 'Project Insight' },
  { value: 'customer_intel', label: 'Customer Intel' },
  { value: 'process_knowledge', label: 'Process Knowledge' },
  { value: 'decision_record', label: 'Decision Record' },
  { value: 'market_intel', label: 'Market Intel' },
  { value: 'financial_insight', label: 'Financial Insight' },
];

const IMPORTANCE_OPTIONS: { value: MemoryImportance; label: string; color: string }[] = [
  { value: 'critical', label: 'Critical', color: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]' },
  { value: 'high', label: 'High', color: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]' },
  { value: 'medium', label: 'Medium', color: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]' },
  { value: 'low', label: 'Low', color: 'bg-[var(--bg-sunken)] text-muted-foreground' },
];

function importanceBadgeClass(importance: MemoryImportance): string {
  return IMPORTANCE_OPTIONS.find(o => o.value === importance)?.color || 'bg-[var(--bg-sunken)] text-muted-foreground';
}

function categoryLabel(category: MemoryCategory): string {
  return CATEGORY_OPTIONS.find(o => o.value === category)?.label || category;
}

// ============================================
// Component
// ============================================

export function AIMemoryPanel() {
  const { user } = useAuth();
  const companyId = (user as any)?.organizationId || 'default';
  const userId = user?.uid || '';

  const [memories, setMemories] = useState<AIMemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [importanceFilter, setImportanceFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingMemory, setEditingMemory] = useState<AIMemoryEntry | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Form state
  const [formCategory, setFormCategory] = useState<MemoryCategory>('business_fact');
  const [formContent, setFormContent] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formImportance, setFormImportance] = useState<MemoryImportance>('medium');
  const [saving, setSaving] = useState(false);

  // Load memories with real-time subscription
  useEffect(() => {
    if (!companyId) return;

    setLoading(true);
    const unsubscribe = subscribeToMemories(
      companyId,
      (data) => {
        setMemories(data);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  // Filtered memories
  const filtered = memories.filter(m => {
    if (categoryFilter !== 'all' && m.category !== categoryFilter) return false;
    if (importanceFilter !== 'all' && m.importance !== importanceFilter) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      return (
        m.content.toLowerCase().includes(q) ||
        (m.summary || '').toLowerCase().includes(q) ||
        m.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Stats
  const stats = {
    total: memories.length,
    byCategory: CATEGORY_OPTIONS.map(c => ({
      label: c.label,
      count: memories.filter(m => m.category === c.value).length,
    })).filter(s => s.count > 0),
    byImportance: IMPORTANCE_OPTIONS.map(i => ({
      ...i,
      count: memories.filter(m => m.importance === i.value).length,
    })).filter(s => s.count > 0),
  };

  // Reset form
  const resetForm = useCallback(() => {
    setFormCategory('business_fact');
    setFormContent('');
    setFormSummary('');
    setFormTags('');
    setFormImportance('medium');
  }, []);

  // Open edit
  const openEdit = useCallback((mem: AIMemoryEntry) => {
    setEditingMemory(mem);
    setFormCategory(mem.category);
    setFormContent(mem.content);
    setFormSummary(mem.summary || '');
    setFormTags(mem.tags.join(', '));
    setFormImportance(mem.importance);
  }, []);

  // Create memory
  const handleCreate = useCallback(async () => {
    if (!formContent.trim()) return;
    setSaving(true);
    try {
      await createMemory(
        {
          category: formCategory,
          content: formContent.trim(),
          summary: formSummary.trim() || formContent.trim().substring(0, 100),
          tags: formTags.split(',').map(t => t.trim()).filter(Boolean),
          importance: formImportance,
          source: { type: 'manual', module: 'admin_panel' },
        },
        companyId,
        userId
      );
      setShowCreateDialog(false);
      resetForm();
    } catch (err) {
      console.error('Failed to create memory:', err);
    } finally {
      setSaving(false);
    }
  }, [formCategory, formContent, formSummary, formTags, formImportance, companyId, userId, resetForm]);

  // Update memory
  const handleUpdate = useCallback(async () => {
    if (!editingMemory || !formContent.trim()) return;
    setSaving(true);
    try {
      await updateMemory(editingMemory.id, {
        category: formCategory,
        content: formContent.trim(),
        summary: formSummary.trim() || formContent.trim().substring(0, 100),
        tags: formTags.split(',').map(t => t.trim()).filter(Boolean),
        importance: formImportance,
      });
      setEditingMemory(null);
      resetForm();
    } catch (err) {
      console.error('Failed to update memory:', err);
    } finally {
      setSaving(false);
    }
  }, [editingMemory, formCategory, formContent, formSummary, formTags, formImportance, resetForm]);

  // Archive
  const handleArchive = useCallback(async (id: string) => {
    try {
      await archiveMemory(id);
    } catch (err) {
      console.error('Failed to archive memory:', err);
    }
  }, []);

  // Delete
  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteMemory(id);
      setConfirmDelete(null);
    } catch (err) {
      console.error('Failed to delete memory:', err);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-[var(--rag-blue)]" />
              <span className="text-sm text-muted-foreground">Total Memories</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        {stats.byImportance.slice(0, 3).map(s => (
          <Card key={s.value}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-xs ${s.color}`}>{s.label}</Badge>
              </div>
              <p className="text-2xl font-bold mt-1">{s.count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search memories..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORY_OPTIONS.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={importanceFilter} onValueChange={setImportanceFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Importance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            {IMPORTANCE_OPTIONS.map(i => (
              <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => { resetForm(); setShowCreateDialog(true); }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Memory
        </Button>
      </div>

      {/* Memory List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Business Memories ({filtered.length})</span>
            {loading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Brain className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{memories.length === 0 ? 'No memories stored yet' : 'No memories match your filters'}</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((mem) => {
                const isExpanded = expandedId === mem.id;
                return (
                  <div key={mem.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                    {/* Row Header */}
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : mem.id)}
                        className="mt-0.5 p-0.5 hover:bg-muted rounded"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">{categoryLabel(mem.category)}</Badge>
                          <Badge variant="outline" className={`text-xs ${importanceBadgeClass(mem.importance)}`}>
                            {mem.importance}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Hash className="h-3 w-3" />{mem.accessCount} accesses
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {mem.createdAt instanceof Date ? mem.createdAt.toLocaleDateString() : 'Unknown'}
                          </span>
                        </div>
                        <p className="text-sm mt-1 line-clamp-2">{mem.summary || mem.content}</p>
                        {mem.tags.length > 0 && (
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            <Tag className="h-3 w-3 text-muted-foreground" />
                            {mem.tags.map(t => (
                              <span key={t} className="text-xs bg-muted px-1.5 py-0.5 rounded">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(mem)} title="Edit">
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleArchive(mem.id)} title="Archive">
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setConfirmDelete(mem.id)} title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="mt-3 ml-8 p-3 bg-muted/50 rounded-lg text-sm space-y-2">
                        <div>
                          <span className="font-medium text-muted-foreground">Full Content:</span>
                          <p className="mt-0.5 whitespace-pre-wrap">{mem.content}</p>
                        </div>
                        {mem.summary && (
                          <div>
                            <span className="font-medium text-muted-foreground">Summary:</span>
                            <p className="mt-0.5">{mem.summary}</p>
                          </div>
                        )}
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>Source: {mem.source?.type || 'unknown'}</span>
                          <span>Module: {mem.source?.module || 'n/a'}</span>
                          <span>Created by: {mem.createdBy}</span>
                          <span>Last accessed: {mem.lastAccessedAt instanceof Date ? mem.lastAccessedAt.toLocaleDateString() : 'Unknown'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Business Memory</DialogTitle>
          </DialogHeader>
          <MemoryForm
            category={formCategory}
            content={formContent}
            summary={formSummary}
            tags={formTags}
            importance={formImportance}
            onCategoryChange={setFormCategory}
            onContentChange={setFormContent}
            onSummaryChange={setFormSummary}
            onTagsChange={setFormTags}
            onImportanceChange={setFormImportance}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!formContent.trim() || saving}>
              {saving ? 'Saving...' : 'Save Memory'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingMemory} onOpenChange={(open) => { if (!open) setEditingMemory(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Memory</DialogTitle>
          </DialogHeader>
          <MemoryForm
            category={formCategory}
            content={formContent}
            summary={formSummary}
            tags={formTags}
            importance={formImportance}
            onCategoryChange={setFormCategory}
            onContentChange={setFormContent}
            onSummaryChange={setFormSummary}
            onTagsChange={setFormTags}
            onImportanceChange={setFormImportance}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMemory(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={!formContent.trim() || saving}>
              {saving ? 'Updating...' : 'Update Memory'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Memory
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete this memory. This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDelete && handleDelete(confirmDelete)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// Reusable Memory Form
// ============================================

interface MemoryFormProps {
  category: MemoryCategory;
  content: string;
  summary: string;
  tags: string;
  importance: MemoryImportance;
  onCategoryChange: (v: MemoryCategory) => void;
  onContentChange: (v: string) => void;
  onSummaryChange: (v: string) => void;
  onTagsChange: (v: string) => void;
  onImportanceChange: (v: MemoryImportance) => void;
}

function MemoryForm({
  category, content, summary, tags, importance,
  onCategoryChange, onContentChange, onSummaryChange, onTagsChange, onImportanceChange,
}: MemoryFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-1 block">Category</label>
          <Select value={category} onValueChange={(v) => onCategoryChange(v as MemoryCategory)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Importance</label>
          <Select value={importance} onValueChange={(v) => onImportanceChange(v as MemoryImportance)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMPORTANCE_OPTIONS.map(i => (
                <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Content</label>
        <Textarea
          placeholder="The business knowledge to remember..."
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          rows={3}
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Summary (optional)</label>
        <Input
          placeholder="Brief one-line summary"
          value={summary}
          onChange={(e) => onSummaryChange(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Tags (comma-separated)</label>
        <Input
          placeholder="e.g. pricing, supplier, cnc"
          value={tags}
          onChange={(e) => onTagsChange(e.target.value)}
        />
      </div>
    </div>
  );
}

export default AIMemoryPanel;
