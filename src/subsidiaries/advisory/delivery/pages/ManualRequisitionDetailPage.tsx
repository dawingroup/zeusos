/**
 * MANUAL REQUISITION DETAIL PAGE
 *
 * View and manage a single manual requisition including:
 * - Acknowledgement document generation
 * - Accountability entries
 * - Linking to projects
 */

import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Link as LinkIcon,
  FileText,
  Calendar,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Loader2,
  Plus,
  Receipt,
  ClipboardList,
  FileSignature,
  Pencil,
  Eye,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { format, getYear } from 'date-fns';
import { useState, useEffect, useMemo } from 'react';
import {
  useManualRequisition,
  useDeleteManualRequisition,
  useSaveActivityReport,
  useLinkManualRequisition,
  useSaveFundsAcknowledgement,
} from '../hooks/manual-requisition-hooks';
import { db } from '@/core/services/firebase';
import { ProjectService } from '../services/project-service';
import { Project } from '@/subsidiaries/advisory/core/project/types/project.types';
import { ActivityReportUpload } from '../components/accountability/ActivityReportUpload';
import { AccountabilityEntryForm } from '../components/accountability/AccountabilityEntryForm';
import { ProjectLinkingDialog } from '../components/ProjectLinkingDialog';
import { FundsAcknowledgementForm } from '../components/FundsAcknowledgementForm';
import { FundsAcknowledgementDocument } from '../types/funds-acknowledgement';
import {
  ManualRequisitionStatus,
  ManualAccountabilityEntry,
  ActivityReportFormData,
  LinkToProjectData,
  requiresActivityReport,
} from '../types/manual-requisition';
import { AccountabilityStatus, EXPENSE_CATEGORY_LABELS } from '../types/requisition';
import { useAuth } from '@/core/hooks/useAuth';
import { useUpdateManualRequisition } from '../hooks/manual-requisition-hooks';

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date | any): string {
  if (!date) return 'N/A';
  const d = date instanceof Date ? date : date?.toDate?.() || new Date(date);
  return format(d, 'MMM d, yyyy');
}

// ─────────────────────────────────────────────────────────────────
// STATUS BADGES
// ─────────────────────────────────────────────────────────────────

function LinkStatusBadge({ status }: { status: ManualRequisitionStatus }) {
  switch (status) {
    case 'unlinked':
      return (
        <Badge variant="outline" className="text-gray-600 border-gray-300">
          Unlinked
        </Badge>
      );
    case 'linked':
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50">
          Linked
        </Badge>
      );
    case 'reconciled':
      return (
        <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
          Reconciled
        </Badge>
      );
    default:
      return null;
  }
}

function AccountabilityStatusBadge({ status }: { status: AccountabilityStatus }) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    case 'partial':
      return (
        <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
          <TrendingUp className="w-3 h-3 mr-1" />
          Partial
        </Badge>
      );
    case 'complete':
      return (
        <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Complete
        </Badge>
      );
    case 'overdue':
      return (
        <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">
          <AlertCircle className="w-3 h-3 mr-1" />
          Overdue
        </Badge>
      );
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────

export function ManualRequisitionDetailPage() {
  const navigate = useNavigate();
  const { requisitionId } = useParams<{ requisitionId: string }>();
  const { user } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [showFundsAckForm, setShowFundsAckForm] = useState(false);
  const [linkedProject, setLinkedProject] = useState<Project | null>(null);

  // State for editing accountability entries
  const [editingEntry, setEditingEntry] = useState<ManualAccountabilityEntry | null>(null);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [isAddingNewEntry, setIsAddingNewEntry] = useState(false);

  const { requisition, loading, error, refresh } = useManualRequisition(requisitionId || null);
  const { deleteRequisition, loading: deleteLoading } = useDeleteManualRequisition();
  const { updateRequisition, loading: updatingRequisition } = useUpdateManualRequisition();
  const {
    saveRequisitionActivityReport,
    saveAccountabilityActivityReport,
    loading: savingActivityReport,
  } = useSaveActivityReport();
  const {
    linkToProject,
    unlinkFromProject,
    loading: linkingLoading,
  } = useLinkManualRequisition();
  const {
    saveFundsAcknowledgement,
    loading: savingFundsAck,
  } = useSaveFundsAcknowledgement();

  // Fetch linked project for branding information
  useEffect(() => {
    if (requisition?.linkedProjectId) {
      const projectService = ProjectService.getInstance(db);
      projectService.getProject(requisition.linkedProjectId)
        .then(setLinkedProject)
        .catch(console.error);
    } else {
      setLinkedProject(null);
    }
  }, [requisition?.linkedProjectId]);

  const handleDelete = async () => {
    if (requisitionId) {
      await deleteRequisition(requisitionId);
      navigate('/advisory/delivery/backlog');
    }
  };

  const handleLinkToProject = async (data: LinkToProjectData) => {
    if (requisitionId) {
      await linkToProject(requisitionId, data);
      refresh();
    }
  };

  const handleUnlinkFromProject = async () => {
    if (requisitionId) {
      await unlinkFromProject(requisitionId);
      refresh();
    }
  };

  const handleSaveRequisitionActivityReport = async (data: ActivityReportFormData) => {
    if (requisitionId) {
      await saveRequisitionActivityReport(requisitionId, data);
      refresh();
    }
  };

  const handleSaveAccountabilityActivityReport = async (
    accountabilityId: string,
    data: ActivityReportFormData
  ) => {
    if (requisitionId) {
      await saveAccountabilityActivityReport(requisitionId, accountabilityId, data);
      refresh();
    }
  };

  const handleFundsAcknowledgementSaved = async (doc: FundsAcknowledgementDocument, pdfBlob: Blob) => {
    if (requisitionId) {
      await saveFundsAcknowledgement(requisitionId, doc, pdfBlob);
    }
    setShowFundsAckForm(false);
    refresh();
  };

  // Open saved document in new tab
  const handleViewDocument = () => {
    if (requisition?.fundsAcknowledgementDocumentUrl) {
      window.open(requisition.fundsAcknowledgementDocumentUrl, '_blank');
    }
  };

  // Handle editing an accountability entry
  const handleEditEntry = (entry: ManualAccountabilityEntry) => {
    setEditingEntry(entry);
    setIsAddingNewEntry(false);
    setShowEntryForm(true);
  };

  // Handle adding a new accountability entry
  const handleAddEntry = () => {
    setEditingEntry(null);
    setIsAddingNewEntry(true);
    setShowEntryForm(true);
  };

  // Helper function to clean undefined values from an object recursively
  const cleanUndefinedValues = <T extends Record<string, any>>(obj: T): T => {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue;
      if (value === null) {
        cleaned[key] = null;
      } else if (Array.isArray(value)) {
        // Clean each item in arrays (e.g., documents array)
        cleaned[key] = value.map(item => {
          if (typeof item === 'object' && item !== null) {
            return cleanUndefinedValues(item);
          }
          return item;
        });
      } else if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
        // Check if it's a Firebase Timestamp (has toDate method)
        if ('toDate' in value && typeof value.toDate === 'function') {
          cleaned[key] = value;
        } else {
          // Recursively clean nested objects
          cleaned[key] = cleanUndefinedValues(value);
        }
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned as T;
  };

  // Handle saving an accountability entry (new or edited)
  const handleSaveEntry = async (entry: Omit<ManualAccountabilityEntry, 'id'> & { id?: string }) => {
    if (!requisition || !requisitionId) return;

    // Clean the entry to remove undefined values
    const cleanedEntry = cleanUndefinedValues(entry);

    let updatedAccountabilities: ManualAccountabilityEntry[];

    if (isAddingNewEntry) {
      // Add new entry
      const newEntry: ManualAccountabilityEntry = {
        ...cleanedEntry,
        id: cleanedEntry.id || `macc-${Date.now()}`,
      } as ManualAccountabilityEntry;
      updatedAccountabilities = [...requisition.accountabilities, newEntry];
    } else {
      // Update existing entry
      updatedAccountabilities = requisition.accountabilities.map(acc =>
        acc.id === cleanedEntry.id ? { ...acc, ...cleanedEntry } as ManualAccountabilityEntry : acc
      );
    }

    // Clean all accountabilities to ensure no undefined values
    const cleanedAccountabilities = updatedAccountabilities.map(acc => cleanUndefinedValues(acc));

    // Update the requisition with the modified accountabilities
    await updateRequisition(requisitionId, {
      accountabilities: cleanedAccountabilities,
    });

    setShowEntryForm(false);
    setEditingEntry(null);
    setIsAddingNewEntry(false);
    refresh();
  };

  // Helper to convert date to Date object (defined before useMemo)
  const toDateObject = (date: Date | { toDate: () => Date } | string | undefined): Date => {
    if (!date) return new Date();
    if (date instanceof Date) return date;
    if (typeof date === 'object' && 'toDate' in date) return date.toDate();
    return new Date(date);
  };

  // Group accountabilities by year and sort by date descending
  // Must be called before early returns to maintain hook order
  const groupedAccountabilities = useMemo(() => {
    if (!requisition?.accountabilities?.length) return {};

    // Sort entries by date descending
    const sortedEntries = [...requisition.accountabilities].sort((a, b) => {
      const dateA = toDateObject(a.date);
      const dateB = toDateObject(b.date);
      return dateB.getTime() - dateA.getTime();
    });

    // Group by year
    const grouped: Record<number, typeof sortedEntries> = {};
    sortedEntries.forEach(entry => {
      const entryDate = toDateObject(entry.date);
      const year = getYear(entryDate);
      if (!grouped[year]) {
        grouped[year] = [];
      }
      grouped[year].push(entry);
    });

    return grouped;
  }, [requisition?.accountabilities]);

  // Get years in descending order
  const sortedYears = useMemo(() => {
    return Object.keys(groupedAccountabilities)
      .map(Number)
      .sort((a, b) => b - a);
  }, [groupedAccountabilities]);

  // Calculated values
  const accountabilityPercentage = requisition?.amount && requisition.amount > 0
    ? Math.round((requisition.totalAccountedAmount / requisition.amount) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading requisition...</span>
      </div>
    );
  }

  if (error || !requisition) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h2 className="text-lg font-medium text-gray-900">Requisition not found</h2>
        <p className="text-gray-500 mb-4">
          {error?.message || 'The requisition you are looking for does not exist.'}
        </p>
        <Button onClick={() => navigate('/advisory/delivery/backlog')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Backlog
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/advisory/delivery/backlog')}
            className="p-2 hover:bg-gray-100 rounded-lg mt-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">
                {requisition.referenceNumber}
              </h1>
              <LinkStatusBadge status={requisition.linkStatus} />
              <AccountabilityStatusBadge status={requisition.accountabilityStatus} />
            </div>
            <p className="text-gray-500">{requisition.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setLinkDialogOpen(true)}
            className={requisition.linkStatus !== 'unlinked' ? 'text-blue-600 hover:bg-blue-50' : ''}
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            {requisition.linkStatus !== 'unlinked' ? 'Linked' : 'Link to Project'}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/advisory/delivery/backlog/${requisitionId}/edit`)}
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="outline"
            className="text-red-600 hover:bg-red-50"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <KPIGrid cols={4}>
        <KPICard
          label={
            <span className="inline-flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Amount
            </span>
          }
          value={formatCurrency(requisition.amount, requisition.currency)}
        />
        <KPICard
          label={
            <span className="inline-flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Requisition Date
            </span>
          }
          value={formatDate(requisition.requisitionDate)}
        />
        <KPICard
          label={
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Accounted
            </span>
          }
          value={formatCurrency(requisition.totalAccountedAmount, requisition.currency)}
          delta={`${accountabilityPercentage}% complete`}
          trend="up"
        />
        <KPICard
          label={
            <span className="inline-flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Unaccounted
            </span>
          }
          value={formatCurrency(requisition.unaccountedAmount, requisition.currency)}
          trend={requisition.unaccountedAmount > 0 ? 'down' : 'up'}
        />
      </KPIGrid>

      {/* Step 1: Funds Acknowledgement Form */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-blue-600" />
          Step 1: Funds Received Acknowledgement
        </h2>

        {showFundsAckForm ? (
          <FundsAcknowledgementForm
            requisition={requisition}
            project={linkedProject || undefined}
            onDocumentSaved={handleFundsAcknowledgementSaved}
            onClose={() => setShowFundsAckForm(false)}
            isLoading={savingFundsAck}
          />
        ) : requisition.fundsAcknowledgementReceiptNumber ? (
          /* Show completed state if already generated */
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-100 rounded-full">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-green-900">
                    Acknowledgement Document Generated
                  </h3>
                  <p className="text-sm text-green-700 mt-1">
                    Receipt Number: <span className="font-medium">{requisition.fundsAcknowledgementReceiptNumber}</span>
                  </p>
                  {linkedProject?.facilityBranding?.facilityName && (
                    <p className="text-sm text-green-600 mt-1">
                      Facility: {linkedProject.facilityBranding.facilityName}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleViewDocument}
                  variant="outline"
                  className="border-green-300 text-green-700 hover:bg-green-100"
                  disabled={!requisition.fundsAcknowledgementDocumentUrl}
                  title={!requisition.fundsAcknowledgementDocumentUrl ? 'Document not available - generate new to save' : 'View saved document'}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Document
                </Button>
                <Button
                  onClick={() => setShowFundsAckForm(true)}
                  variant="outline"
                  className="border-green-300 text-green-700 hover:bg-green-100"
                >
                  <FileSignature className="w-4 h-4 mr-2" />
                  Generate New
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Show prompt to create acknowledgement */
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <FileSignature className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-blue-900">
                    Generate Funds Acknowledgement
                  </h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Create a professionally branded PDF with facility logos, contact information,
                    transaction details, and digital signature for official records.
                  </p>
                  {requisition.linkStatus === 'unlinked' && (
                    <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Link to a project first for facility branding, or use default branding.
                    </p>
                  )}
                </div>
              </div>
              <Button
                onClick={() => setShowFundsAckForm(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <FileSignature className="w-4 h-4 mr-2" />
                Create Acknowledgement
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Requisition-Level Activity Report */}
      {requisition.fundsAcknowledgementReceiptNumber && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-gray-500" />
            Step 2: Requisition Activity Report
          </h2>
          <ActivityReportUpload
            level="requisition"
            requisitionId={requisitionId!}
            existingReport={requisition.activityReport}
            onReportSaved={handleSaveRequisitionActivityReport}
            disabled={savingActivityReport}
            promptTitle="Requisition Activity Report Required"
            promptDescription="Upload an activity report documenting the overall work progress for this requisition. This provides evidence of how the funds were used."
          />
        </div>
      )}

      {/* Accountability Entries */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-gray-500" />
              Step 3: Accountability Entries
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddEntry}
              disabled={!requisition.fundsAcknowledgementReceiptNumber}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Entry
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!requisition.fundsAcknowledgementReceiptNumber ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">Complete the acknowledgement first</p>
              <p className="text-sm text-gray-400">
                You need to generate an acknowledgement document before adding accountability entries
              </p>
            </div>
          ) : requisition.accountabilities.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed">
              <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No accountability entries yet</p>
              <p className="text-sm text-gray-400">Click "Add Entry" to record expenses</p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedYears.map(year => (
                <div key={year}>
                  {/* Year Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-full">
                      {year}
                    </h3>
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-500">
                      {groupedAccountabilities[year].length} {groupedAccountabilities[year].length === 1 ? 'entry' : 'entries'}
                    </span>
                  </div>

                  {/* Year Entries */}
                  <div className="space-y-4">
                    {groupedAccountabilities[year].map((entry, index) => (
                      <div key={entry.id || index} className="bg-gray-50 rounded-lg p-4 space-y-3">
                        {/* Entry Header */}
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{entry.description}</span>
                              <Badge variant="outline" className="text-xs">
                                {EXPENSE_CATEGORY_LABELS[entry.category] || entry.category}
                              </Badge>
                              {requiresActivityReport(entry.category) && (
                                <Badge
                                  variant="outline"
                                  className={
                                    entry.activityReport
                                      ? 'text-green-600 border-green-300 bg-green-50 text-xs'
                                      : 'text-amber-600 border-amber-300 bg-amber-50 text-xs'
                                  }
                                >
                                  {entry.activityReport ? 'Report Submitted' : 'Report Required'}
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 space-x-4">
                              <span>{formatDate(entry.date)}</span>
                              {entry.vendor && <span>Vendor: {entry.vendor}</span>}
                              {entry.receiptNumber && <span>Receipt: {entry.receiptNumber}</span>}
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <p className="font-semibold">
                              {formatCurrency(entry.amount, requisition.currency)}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditEntry(entry)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 -mt-1"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Activity Report Section for Labour/Services */}
                        {requiresActivityReport(entry.category) && (
                          <div className="pt-3 border-t border-gray-200">
                            <ActivityReportUpload
                              level="accountability"
                              requisitionId={requisitionId!}
                              accountabilityId={entry.id}
                              existingReport={entry.activityReport}
                              onReportSaved={(data) => handleSaveAccountabilityActivityReport(entry.id, data)}
                              disabled={savingActivityReport}
                              promptTitle="Labour/Service Activity Report Required"
                              promptDescription="Upload an activity report documenting the work or services provided for this payment."
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Purpose</dt>
              <dd className="mt-1">{requisition.purpose}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Advance Type</dt>
              <dd className="mt-1 capitalize">{requisition.advanceType.replace(/_/g, ' ')}</dd>
            </div>
            {requisition.paidDate && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Paid Date</dt>
                <dd className="mt-1">{formatDate(requisition.paidDate)}</dd>
              </div>
            )}
            {requisition.accountabilityDueDate && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Accountability Due</dt>
                <dd className="mt-1">{formatDate(requisition.accountabilityDueDate)}</dd>
              </div>
            )}
            {requisition.linkedProjectName && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Linked Project</dt>
                <dd className="mt-1 flex items-center gap-1">
                  <LinkIcon className="w-4 h-4 text-blue-500" />
                  {requisition.linkedProjectName}
                </dd>
              </div>
            )}
            {requisition.sourceDocument && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Source Document</dt>
                <dd className="mt-1">{requisition.sourceDocument}</dd>
              </div>
            )}
            {requisition.notes && (
              <div className="md:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Notes</dt>
                <dd className="mt-1">{requisition.notes}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Requisition</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this requisition? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Linking Dialog */}
      <ProjectLinkingDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        requisition={requisition}
        onLinkToProject={handleLinkToProject}
        onUnlink={handleUnlinkFromProject}
        isLoading={linkingLoading}
      />

      {/* Accountability Entry Form Dialog */}
      <Dialog open={showEntryForm} onOpenChange={(open) => {
        setShowEntryForm(open);
        if (!open) {
          setEditingEntry(null);
          setIsAddingNewEntry(false);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isAddingNewEntry ? 'Add Accountability Entry' : 'Edit Accountability Entry'}
            </DialogTitle>
          </DialogHeader>
          <AccountabilityEntryForm
            requisitionId={requisitionId || 'new'}
            existingEntry={editingEntry || undefined}
            currency={requisition.currency}
            onSave={handleSaveEntry}
            onCancel={() => {
              setShowEntryForm(false);
              setEditingEntry(null);
              setIsAddingNewEntry(false);
            }}
            isLoading={updatingRequisition}
            userId={user?.uid || 'anonymous'}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ManualRequisitionDetailPage;
