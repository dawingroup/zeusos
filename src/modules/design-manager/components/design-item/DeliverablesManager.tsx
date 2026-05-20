/**
 * Deliverables Manager Component
 * Manages design deliverables (files, drawings, models) for a design item.
 * Supports multi-item assignment and shows RAG aspects satisfied by the upload.
 */

import { useState, useMemo } from 'react';
import {
  FileText, Upload, Download, Trash2, Eye, Check,
  FileImage, Box, FileSpreadsheet, Clock, ChevronDown, ChevronUp,
  Share2, Globe, CheckCircle2, Users
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { Deliverable, DeliverableType, DesignStage, DesignItem } from '../../types';
import { STAGE_ORDER } from '../../utils/stage-gate';
import { toggleDeliverablePortalSharing } from '../../services/firestore';
import { DELIVERABLE_RAG_MAP } from '../../constants/deliverableConstants';

export interface DeliverablesManagerProps {
  deliverables: Deliverable[];
  currentStage: DesignStage;
  projectId: string;
  itemId: string;
  userId: string;
  onUpload: (file: File, type: DeliverableType, name: string, description: string, coversTypes?: DeliverableType[], targetItemIds?: string[]) => Promise<void>;
  onDelete: (deliverableId: string) => Promise<void>;
  onApprove: (deliverableId: string) => Promise<void>;
  onRefresh?: () => void;
  isReadOnly?: boolean;
  /** All design items in the project — enables multi-item assignment */
  projectItems?: DesignItem[];
  className?: string;
}

const DELIVERABLE_TYPES: { value: DeliverableType; label: string; icon: typeof FileText }[] = [
  { value: 'concept-sketch', label: 'Concept Sketch', icon: FileImage },
  { value: 'mood-board', label: 'Mood Board', icon: FileImage },
  { value: '3d-model', label: '3D Model', icon: Box },
  { value: 'rendering', label: 'Rendering', icon: FileImage },
  { value: 'shop-drawing', label: 'Shop Drawing', icon: FileText },
  { value: 'cut-list', label: 'Cut List', icon: FileSpreadsheet },
  { value: 'bom', label: 'Bill of Materials', icon: FileSpreadsheet },
  { value: 'assembly-instructions', label: 'Assembly Instructions', icon: FileText },
  { value: 'specification-sheet', label: 'Specification Sheet', icon: FileText },
  { value: 'client-presentation', label: 'Client Presentation', icon: FileImage },
  { value: 'other', label: 'Other', icon: FileText },
];

const STAGE_DELIVERABLES: Record<DesignStage, DeliverableType[]> = {
  'concept': ['concept-sketch', 'mood-board'],
  'preliminary': ['3d-model', 'rendering', 'client-presentation'],
  'technical': ['shop-drawing', 'cut-list', 'bom', 'specification-sheet'],
  'pre-production': ['assembly-instructions'],
  'production-ready': ['shop-drawing', 'cut-list', 'bom', 'assembly-instructions'],
  'procure-identify': [],
  'procure-quote': [],
  'procure-approve': [],
  'procure-order': [],
  'procure-received': [],
  // Architectural/Design Document stages
  'arch-brief': ['concept-sketch', 'client-presentation'],
  'arch-schematic': ['concept-sketch', '3d-model', 'rendering'],
  'arch-development': ['3d-model', 'rendering', 'specification-sheet'],
  'arch-construction-docs': ['shop-drawing', 'specification-sheet'],
  'arch-approved': ['shop-drawing', 'specification-sheet', 'client-presentation'],
  // Construction stages (typically don't use deliverables the same way)
  'const-scope': [],
  'const-spec': ['specification-sheet'],
  'const-quote': [],
  'const-approve': [],
  'const-in-progress': [],
  'const-inspection': [],
  'const-complete': ['specification-sheet', 'client-presentation'],
};

const STATUS_CONFIG = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
  review: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'In Review' },
  approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Approved' },
  superseded: { bg: 'bg-red-100', text: 'text-red-800', label: 'Superseded' },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DeliverablesManager({
  deliverables,
  currentStage,
  projectId,
  itemId,
  userId,
  onUpload,
  onDelete,
  onApprove,
  onRefresh,
  isReadOnly = false,
  projectItems,
  className,
}: DeliverablesManagerProps) {
  const [showUpload, setShowUpload] = useState(false);
  const [uploadType, setUploadType] = useState<DeliverableType>('shop-drawing');
  const [uploadName, setUploadName] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [coveredTypes, setCoveredTypes] = useState<Set<DeliverableType>>(new Set());
  const [expandedStages, setExpandedStages] = useState<Set<DesignStage>>(new Set([currentStage]));
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [targetItemIds, setTargetItemIds] = useState<Set<string>>(new Set([itemId]));
  const [showItemSelector, setShowItemSelector] = useState(false);

  // Other items in the project (excluding current item)
  const otherItems = useMemo(
    () => (projectItems || []).filter(i => i.id !== itemId),
    [projectItems, itemId]
  );

  // RAG aspects that will be auto-updated based on selected type + covered types
  const ragAspects = useMemo(() => {
    const aspectMap = new Map<string, string>();
    const addAspects = (type: DeliverableType) => {
      const aspects = DELIVERABLE_RAG_MAP[type];
      if (aspects) {
        for (const a of aspects) {
          aspectMap.set(a.path, a.label);
        }
      }
    };
    addAspects(uploadType);
    coveredTypes.forEach(t => addAspects(t));
    return Array.from(aspectMap.entries()).map(([path, label]) => ({ path, label }));
  }, [uploadType, coveredTypes]);

  const handleTogglePortalShare = async (deliverable: Deliverable) => {
    if (!projectId || !itemId || !userId) return;
    
    setSharingId(deliverable.id);
    try {
      await toggleDeliverablePortalSharing(
        projectId,
        itemId,
        deliverable.id,
        !deliverable.sharedToPortal,
        userId
      );
      onRefresh?.();
    } catch (error) {
      console.error('Failed to toggle portal sharing:', error);
    } finally {
      setSharingId(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadName.trim()) return;

    setIsUploading(true);
    try {
      const coversArray = coveredTypes.size > 0 ? Array.from(coveredTypes) : undefined;
      const itemIds = targetItemIds.size > 1 ? Array.from(targetItemIds) : undefined;
      await onUpload(selectedFile, uploadType, uploadName, uploadDescription, coversArray, itemIds);
      setShowUpload(false);
      setSelectedFile(null);
      setUploadName('');
      setUploadDescription('');
      setCoveredTypes(new Set());
      setTargetItemIds(new Set([itemId]));
      setShowItemSelector(false);
    } catch (error) {
      console.error('Failed to upload:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const toggleStage = (stage: DesignStage) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      if (next.has(stage)) {
        next.delete(stage);
      } else {
        next.add(stage);
      }
      return next;
    });
  };

  // Group deliverables by stage
  const groupedDeliverables = deliverables.reduce((acc, del) => {
    if (!acc[del.stage]) acc[del.stage] = [];
    acc[del.stage].push(del);
    return acc;
  }, {} as Record<DesignStage, Deliverable[]>);

  // Recommended deliverables for current stage
  const recommendedTypes = (STAGE_DELIVERABLES[currentStage] || []);
  const existingTypes = new Set(deliverables.filter(d => d.stage === currentStage).map(d => d.type));
  const missingTypes = recommendedTypes.filter(t => !existingTypes.has(t));

  const getTypeIcon = (type: DeliverableType) => {
    const typeConfig = DELIVERABLE_TYPES.find(t => t.value === type);
    return typeConfig?.icon || FileText;
  };

  const stages: DesignStage[] = STAGE_ORDER;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Deliverables</h3>
            <p className="text-sm text-gray-500">
              {deliverables.length} file{deliverables.length !== 1 ? 's' : ''} uploaded
            </p>
          </div>
          {!isReadOnly && (
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload File
            </button>
          )}
        </div>
      </div>

      {/* Missing Deliverables Alert */}
      {missingTypes.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-2 text-amber-800 font-medium mb-2">
            <Clock className="w-5 h-5" />
            Recommended for {currentStage} stage
          </div>
          <div className="flex flex-wrap gap-2">
            {missingTypes.map(type => {
              const typeConfig = DELIVERABLE_TYPES.find(t => t.value === type);
              return (
                <span
                  key={type}
                  className="px-3 py-1 bg-amber-100 text-amber-800 text-sm rounded-full"
                >
                  {typeConfig?.label || type}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload Form */}
      {showUpload && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
          <h4 className="font-semibold text-gray-900">Upload Deliverable</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">File Type</label>
              <select
                value={uploadType}
                onChange={e => setUploadType(e.target.value as DeliverableType)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                {DELIVERABLE_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={uploadName}
                onChange={e => setUploadName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="e.g., Reception Desk - Shop Drawing v1"
              />
            </div>
            
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
              <input
                type="text"
                value={uploadDescription}
                onChange={e => setUploadDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Brief description of this deliverable..."
              />
            </div>

            {/* Multi-type checklist — mark other deliverable types this document also covers */}
            {(() => {
              const checklistTypes = (STAGE_DELIVERABLES[currentStage] || [])
                .filter(t => t !== uploadType && !existingTypes.has(t));
              if (checklistTypes.length === 0) return null;
              return (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    This document also covers:
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {checklistTypes.map(type => {
                      const typeConfig = DELIVERABLE_TYPES.find(t => t.value === type);
                      return (
                        <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={coveredTypes.has(type)}
                            onChange={(e) => {
                              setCoveredTypes(prev => {
                                const next = new Set(prev);
                                e.target.checked ? next.add(type) : next.delete(type);
                                return next;
                              });
                            }}
                            className="rounded border-gray-300"
                          />
                          {typeConfig?.label || type}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* RAG aspects preview — show which readiness aspects this file will satisfy */}
            {ragAspects.length > 0 && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Readiness aspects satisfied:
                </label>
                <div className="flex flex-wrap gap-2">
                  {ragAspects.map(aspect => (
                    <span
                      key={aspect.path}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-green-100 text-green-800 border border-green-200"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      {aspect.label}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  These RAG aspects will be automatically marked green for all target items
                </p>
              </div>
            )}

            {/* Multi-item assignment — assign this file to other items in the project */}
            {otherItems.length > 0 && (
              <div className="col-span-2">
                <button
                  type="button"
                  onClick={() => setShowItemSelector(!showItemSelector)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  <Users className="w-4 h-4" />
                  Assign to other items
                  {targetItemIds.size > 1 && (
                    <span className="px-1.5 py-0.5 text-xs rounded-full bg-primary text-white">
                      {targetItemIds.size} items
                    </span>
                  )}
                  {showItemSelector ? (
                    <ChevronUp className="w-4 h-4 ml-auto" />
                  ) : (
                    <ChevronDown className="w-4 h-4 ml-auto" />
                  )}
                </button>

                {showItemSelector && (
                  <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                    {/* Current item (always checked, disabled) */}
                    <label className="flex items-center gap-3 px-3 py-2 bg-primary/5 border-b border-gray-100">
                      <input
                        type="checkbox"
                        checked
                        disabled
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-medium text-gray-900 truncate">
                        Current item (this one)
                      </span>
                    </label>
                    {/* Select/deselect all */}
                    <div className="px-3 py-1.5 border-b border-gray-100 flex justify-end">
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => {
                          if (targetItemIds.size === otherItems.length + 1) {
                            setTargetItemIds(new Set([itemId]));
                          } else {
                            setTargetItemIds(new Set([itemId, ...otherItems.map(i => i.id)]));
                          }
                        }}
                      >
                        {targetItemIds.size === otherItems.length + 1 ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    {otherItems.map(otherItem => (
                      <label
                        key={otherItem.id}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors',
                          targetItemIds.has(otherItem.id) && 'bg-blue-50'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={targetItemIds.has(otherItem.id)}
                          onChange={(e) => {
                            setTargetItemIds(prev => {
                              const next = new Set(prev);
                              e.target.checked ? next.add(otherItem.id) : next.delete(otherItem.id);
                              return next;
                            });
                          }}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm truncate block">
                            {otherItem.itemCode} — {otherItem.name}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 capitalize flex-shrink-0">
                          {otherItem.currentStage.replace(/-/g, ' ')}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-gray-500" />
                    <span className="text-sm">{selectedFile.name}</span>
                    <span className="text-xs text-gray-500">({formatFileSize(selectedFile.size)})</span>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                      <Upload className="w-8 h-8" />
                      <span className="text-sm">Click to select a file</span>
                    </div>
                  </label>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowUpload(false);
                setSelectedFile(null);
                setCoveredTypes(new Set());
                setTargetItemIds(new Set([itemId]));
                setShowItemSelector(false);
              }}
              className="px-4 py-2 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || !uploadName.trim() || isUploading}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              {isUploading ? 'Uploading...' : targetItemIds.size > 1 ? `Upload to ${targetItemIds.size} Items` : 'Upload'}
            </button>
          </div>
        </div>
      )}

      {/* Deliverables by Stage */}
      {stages.map(stage => {
        const stageDeliverables = groupedDeliverables[stage] || [];
        if (stageDeliverables.length === 0 && stage !== currentStage) return null;
        
        const isExpanded = expandedStages.has(stage);
        const isCurrentStage = stage === currentStage;
        
        return (
          <div 
            key={stage} 
            className={cn(
              'bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden',
              isCurrentStage && 'border-primary'
            )}
          >
            <button
              onClick={() => toggleStage(stage)}
              className={cn(
                'w-full flex items-center justify-between p-4',
                isCurrentStage ? 'bg-primary/5' : 'bg-gray-50',
                'hover:bg-gray-100 transition-colors'
              )}
            >
              <div className="flex items-center gap-3">
                <h4 className="font-medium text-gray-900 capitalize">{stage.replace('-', ' ')}</h4>
                <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                  {stageDeliverables.length} file{stageDeliverables.length !== 1 ? 's' : ''}
                </span>
                {isCurrentStage && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-primary text-white">
                    Current
                  </span>
                )}
              </div>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </button>
            
            {isExpanded && (
              <div className="p-4 space-y-3">
                {stageDeliverables.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No deliverables uploaded for this stage yet
                  </p>
                ) : (
                  stageDeliverables.map(deliverable => {
                    const Icon = getTypeIcon(deliverable.type);
                    const statusConfig = STATUS_CONFIG[deliverable.status];
                    
                    return (
                      <div 
                        key={deliverable.id}
                        className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <Icon className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{deliverable.name}</span>
                              <span className={cn('px-2 py-0.5 text-xs rounded-full', statusConfig.bg, statusConfig.text)}>
                                {statusConfig.label}
                              </span>
                              <span className="text-xs text-gray-500">v{deliverable.version}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span>{DELIVERABLE_TYPES.find(t => t.value === deliverable.type)?.label}</span>
                              <span>{formatFileSize(deliverable.fileSize)}</span>
                              <span>{deliverable.fileType.toUpperCase()}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {/* Share to Portal Button */}
                          {!isReadOnly && (
                            <button
                              onClick={() => handleTogglePortalShare(deliverable)}
                              disabled={sharingId === deliverable.id}
                              className={cn(
                                'p-2 rounded transition-colors',
                                deliverable.sharedToPortal
                                  ? 'text-green-600 bg-green-50 hover:bg-green-100'
                                  : 'text-gray-500 hover:bg-gray-100'
                              )}
                              title={deliverable.sharedToPortal ? 'Shared to Portal (click to unshare)' : 'Share to Client Portal'}
                            >
                              {deliverable.sharedToPortal ? (
                                <Globe className="w-4 h-4" />
                              ) : (
                                <Share2 className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          {deliverable.storageUrl && (
                            <a
                              href={deliverable.storageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-gray-500 hover:bg-gray-100 rounded"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </a>
                          )}
                          {deliverable.storageUrl && (
                            <a
                              href={deliverable.storageUrl}
                              download
                              className="p-2 text-gray-500 hover:bg-gray-100 rounded"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                          {!isReadOnly && deliverable.status === 'review' && (
                            <button
                              onClick={() => onApprove(deliverable.id)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded"
                              title="Approve"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          {!isReadOnly && deliverable.status === 'draft' && (
                            <button
                              onClick={() => onDelete(deliverable.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Empty State */}
      {deliverables.length === 0 && !showUpload && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No deliverables yet</h3>
          <p className="text-sm text-gray-500">Upload files to track design progress</p>
        </div>
      )}
    </div>
  );
}

export default DeliverablesManager;
