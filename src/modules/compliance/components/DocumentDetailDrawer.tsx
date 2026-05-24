/**
 * DocumentDetailDrawer
 * Rich compliance tracking view with checklist, requirements,
 * history timeline, file upload, status actions, and edit mode.
 */

import { useState, useRef } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/core/components/ui/sheet';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import {
  FileText,
  Download,
  Upload,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Calendar,
  Building2,
  Tag,
  Edit2,
  Save,
  Loader2,
  ClipboardCheck,
  ListChecks,
  History,
  Info,
  Circle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type {
  ComplianceDocument,
  ComplianceDocumentStatus,
  ComplianceChecklistItem,
} from '../types';
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_COLORS,
  CATEGORY_LABELS,
  REGULATORY_BODY_LABELS,
  FREQUENCY_LABELS,
  HISTORY_ACTION_LABELS,
} from '../types/constants';

interface DocumentDetailDrawerProps {
  document: ComplianceDocument | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<ComplianceDocument>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUploadFile: (documentId: string, file: File) => Promise<unknown>;
  onToggleChecklist: (docId: string, itemId: string) => Promise<ComplianceDocument>;
  onChangeStatus: (docId: string, newStatus: ComplianceDocumentStatus) => Promise<void>;
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-1.5">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  count,
  collapsed,
  onToggle,
}: {
  icon: React.ElementType;
  title: string;
  count?: string;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const content = (
    <>
      <Icon className="h-4 w-4 text-emerald-600 shrink-0" />
      <span className="text-sm font-medium flex-1">{title}</span>
      {count && (
        <span className="text-xs text-muted-foreground">{count}</span>
      )}
      {onToggle && (
        collapsed
          ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </>
  );

  if (onToggle) {
    return (
      <button onClick={onToggle} className="flex items-center gap-2 w-full text-left">
        {content}
      </button>
    );
  }

  return <div className="flex items-center gap-2">{content}</div>;
}

const STATUS_ACTIONS: { from: ComplianceDocumentStatus; to: ComplianceDocumentStatus; label: string }[] = [
  { from: 'missing', to: 'pending_verification', label: 'Mark Pending Verification' },
  { from: 'pending_verification', to: 'valid', label: 'Verify & Mark Valid' },
  { from: 'expired', to: 'pending_verification', label: 'Mark Pending Renewal' },
  { from: 'expiring_soon', to: 'valid', label: 'Mark as Renewed' },
];

const HISTORY_ICONS: Record<string, React.ElementType> = {
  uploaded: Upload,
  verified: CheckCircle,
  expired: AlertTriangle,
  renewed: CheckCircle,
  status_changed: Circle,
  checklist_updated: ClipboardCheck,
  note_added: Edit2,
};

export function DocumentDetailDrawer({
  document: doc,
  open,
  onClose,
  onUpdate,
  onDelete,
  onUploadFile,
  onToggleChecklist,
  onChangeStatus,
}: DocumentDetailDrawerProps) {
  const [editing, setEditing] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editRef, setEditRef] = useState('');
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editIssuedDate, setEditIssuedDate] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [togglingItem, setTogglingItem] = useState<string | null>(null);
  const [historyCollapsed, setHistoryCollapsed] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!doc) return null;

  const startEdit = () => {
    setEditNotes(doc.notes || '');
    setEditRef(doc.referenceNumber || '');
    setEditExpiryDate(doc.expiryDate ? doc.expiryDate.toDate().toISOString().split('T')[0] : '');
    setEditIssuedDate(doc.issuedDate ? doc.issuedDate.toDate().toISOString().split('T')[0] : '');
    setEditing(true);
  };

  const saveEdit = async () => {
    const updates: Record<string, unknown> = {
      notes: editNotes || undefined,
      referenceNumber: editRef || undefined,
    };
    if (editExpiryDate) {
      const { Timestamp } = await import('firebase/firestore');
      updates.expiryDate = Timestamp.fromDate(new Date(editExpiryDate));
    }
    if (editIssuedDate) {
      const { Timestamp } = await import('firebase/firestore');
      updates.issuedDate = Timestamp.fromDate(new Date(editIssuedDate));
    }
    await onUpdate(doc.id, updates as Partial<ComplianceDocument>);
    setEditing(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUploadFile(doc.id, file);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await onDelete(doc.id);
    onClose();
  };

  const handleToggleChecklist = async (item: ComplianceChecklistItem) => {
    setTogglingItem(item.id);
    try {
      await onToggleChecklist(doc.id, item.id);
    } finally {
      setTogglingItem(null);
    }
  };

  const availableActions = STATUS_ACTIONS.filter(a => a.from === doc.status);
  const expiryDate = doc.expiryDate?.toDate();
  const issuedDate = doc.issuedDate?.toDate();
  const checklist = doc.checklist || [];
  const completedCount = checklist.filter(c => c.completed).length;
  const progress = doc.complianceProgress ?? (checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0);
  const history = [...(doc.history || [])].sort((a, b) => {
    const aTime = a.performedAt?.toDate?.()?.getTime?.() || 0;
    const bTime = b.performedAt?.toDate?.()?.getTime?.() || 0;
    return bTime - aTime;
  });

  return (
    <Sheet open={open} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {/* Header */}
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-emerald-600" />
            {doc.name}
          </SheetTitle>
          <div className="flex items-center gap-2 mt-2">
            <span className={cn('text-xs px-2.5 py-1 rounded-full border font-medium', DOCUMENT_STATUS_COLORS[doc.status])}>
              {DOCUMENT_STATUS_LABELS[doc.status]}
            </span>
            <span className="text-xs text-muted-foreground">
              {CATEGORY_LABELS[doc.category]}
            </span>
          </div>
          {doc.description && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {doc.description}
            </p>
          )}
          {/* Progress Bar */}
          {checklist.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Compliance Progress</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <div className="h-2 bg-[var(--bg-sunken)] rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    progress === 100 ? 'bg-green-500' : progress >= 50 ? 'bg-emerald-500' : 'bg-amber-500'
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Status Actions */}
          {availableActions.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {availableActions.map(action => (
                <Button
                  key={action.to}
                  size="sm"
                  variant="outline"
                  onClick={() => onChangeStatus(doc.id, action.to)}
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                  {action.label}
                </Button>
              ))}
            </div>
          )}

          {/* Document File Section */}
          <div className="rounded-lg border bg-[var(--bg-sunken)] p-4 space-y-3">
            <SectionHeader icon={FileText} title="Document File" />
            {doc.fileUrl ? (
              <div className="flex items-center justify-between bg-card rounded-md border p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="text-sm truncate">{doc.fileName || 'Document'}</span>
                  {doc.fileSize && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      ({(doc.fileSize / 1024).toFixed(0)} KB)
                    </span>
                  )}
                </div>
                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline">
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Download
                  </Button>
                </a>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No file uploaded yet</p>
            )}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xls,.xlsx"
                onChange={handleFileUpload}
              />
              <Button
                size="sm"
                variant={doc.fileUrl ? 'outline' : 'default'}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                )}
                {doc.fileUrl ? 'Replace File' : 'Upload File'}
              </Button>
            </div>
          </div>

          {/* Compliance Checklist */}
          {checklist.length > 0 && (
            <div className="rounded-lg border p-4 space-y-3">
              <SectionHeader
                icon={ListChecks}
                title="Compliance Checklist"
                count={`${completedCount} of ${checklist.length}`}
              />
              <div className="space-y-2">
                {checklist
                  .sort((a, b) => a.order - b.order)
                  .map(item => (
                    <div
                      key={item.id}
                      className={cn(
                        'flex items-start gap-3 p-2 rounded-md transition-colors',
                        item.completed ? 'bg-green-50' : 'hover:bg-[var(--bg-sunken)]'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => handleToggleChecklist(item)}
                        disabled={togglingItem === item.id}
                        className="mt-1 h-4 w-4 rounded border-[var(--border-default)] text-emerald-600 focus:ring-emerald-500 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm',
                          item.completed && 'line-through text-muted-foreground'
                        )}>
                          {item.title}
                          {item.isRequired && !item.completed && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                        )}
                        {item.completed && item.completedAt && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Completed {item.completedAt.toDate().toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {togglingItem === item.id && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Requirements */}
          {doc.requirements && doc.requirements.length > 0 && (
            <div className="rounded-lg border p-4 space-y-3">
              <SectionHeader icon={Info} title="Requirements" />
              <ul className="space-y-1.5">
                {doc.requirements.map((req, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-emerald-500 mt-1 shrink-0">&#8226;</span>
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Details */}
          <div className="rounded-lg border p-4 space-y-1">
            <SectionHeader icon={Tag} title="Details" />
            <div className="mt-2">
              <InfoRow icon={Tag} label="Category" value={CATEGORY_LABELS[doc.category]} />
              <InfoRow icon={Building2} label="Regulatory Body" value={doc.regulatoryBody ? REGULATORY_BODY_LABELS[doc.regulatoryBody] : undefined} />
              <InfoRow icon={Clock} label="Renewal Frequency" value={FREQUENCY_LABELS[doc.renewalFrequency]} />
              <InfoRow icon={Calendar} label="Issued Date" value={issuedDate?.toLocaleDateString()} />
              <InfoRow
                icon={doc.status === 'expired' ? AlertTriangle : Calendar}
                label="Expiry Date"
                value={expiryDate?.toLocaleDateString()}
              />
              {!editing && (
                <>
                  <InfoRow icon={Tag} label="Reference Number" value={doc.referenceNumber} />
                  {doc.notes && <InfoRow icon={FileText} label="Notes" value={doc.notes} />}
                </>
              )}
            </div>
          </div>

          {/* Edit Mode */}
          {editing && (
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-medium">Edit Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Issued Date</Label>
                  <Input type="date" value={editIssuedDate} onChange={e => setEditIssuedDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Expiry Date</Label>
                  <Input type="date" value={editExpiryDate} onChange={e => setEditExpiryDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Reference Number</Label>
                <Input value={editRef} onChange={e => setEditRef(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  className="w-full text-sm border rounded-md px-3 py-2 bg-background min-h-[60px] resize-y"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit}>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Compliance History */}
          {history.length > 0 && (
            <div className="rounded-lg border p-4 space-y-3">
              <SectionHeader
                icon={History}
                title="Compliance History"
                count={`${history.length} entries`}
                collapsed={historyCollapsed}
                onToggle={() => setHistoryCollapsed(!historyCollapsed)}
              />
              {!historyCollapsed && (
                <div className="relative ml-2 pl-4 border-l-2 border-[var(--border-subtle)] space-y-3">
                  {history.map(entry => {
                    const Icon = HISTORY_ICONS[entry.action] || Circle;
                    const time = entry.performedAt?.toDate?.();
                    return (
                      <div key={entry.id} className="relative">
                        <div className="absolute -left-[1.35rem] top-0.5 h-4 w-4 rounded-full bg-card border-2 border-[var(--border-default)] flex items-center justify-center">
                          <Icon className="h-2.5 w-2.5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm">{entry.description}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                            <span>{HISTORY_ACTION_LABELS[entry.action] || entry.action}</span>
                            {time && <span>{time.toLocaleDateString()} {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                            {entry.performedBy !== 'system' && entry.performedBy !== 'current_user' && (
                              <span>by {entry.performedBy}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            {!editing && (
              <Button variant="outline" size="sm" onClick={startEdit}>
                <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
            )}
            <Button
              variant={confirmDelete ? 'destructive' : 'outline'}
              size="sm"
              onClick={handleDelete}
              className={confirmDelete ? '' : 'text-destructive'}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              {confirmDelete ? 'Confirm Delete' : 'Delete'}
            </Button>
            {confirmDelete && (
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
