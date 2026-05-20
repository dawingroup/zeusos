/**
 * AMH REPORT WIZARD
 *
 * 4-step wizard for generating AMH (Accountability, Monitoring & Harmonization) reports.
 * Steps: 1. Select Projects → 2. Configure Sections → 3. Preview → 4. Generate
 */

import { useState, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { getFirestore } from 'firebase/firestore';
import { useAuth } from '@/shared/hooks';
import { useAllProjects } from '../../hooks/project-hooks';
import { useAMHReport } from '../../hooks/useAMHReport';
import { ReportPeriodSelector } from './ReportPeriodSelector';
import type { ReportPeriod, ReportPeriodType } from '../types/report.types';
import type {
  AMHWizardStep,
  AMHSectionKey,
  AMHReportSections,
} from '../../types/amh-report.types';
import {
  AMH_WIZARD_STEPS,
  AMH_SECTION_LABELS,
  DEFAULT_WIZARD_STATE,
} from '../../types/amh-report.types';

export interface AMHReportWizardProps {
  orgId?: string;
  onComplete?: (reportId: string) => void;
  onCancel?: () => void;
  defaultProjectIds?: string[];
}

export function AMHReportWizard({
  orgId: orgIdProp,
  onComplete,
  onCancel,
  defaultProjectIds = [],
}: AMHReportWizardProps = {}) {
  const { user } = useAuth();
  const userId = user?.uid || '';
  const orgId = orgIdProp || (user as any)?.organizationId || 'default';
  const db = getFirestore();
  const { projects: allProjects } = useAllProjects(db, {
    status: ['active', 'mobilization', 'procurement', 'completed'] as any[],
  });

  const { generatePreview, generateReport, isGenerating, error } = useAMHReport(orgId, userId);

  // Wizard state
  const [step, setStep] = useState<AMHWizardStep>('projects');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(defaultProjectIds);
  const [enabledSections, setEnabledSections] = useState<AMHSectionKey[]>(
    DEFAULT_WIZARD_STATE.enabledSections
  );
  const [periodType, setPeriodType] = useState<ReportPeriodType>('monthly');
  const [period, setPeriod] = useState<ReportPeriod | null>(null);
  const [outputFormat, setOutputFormat] = useState<'pdf' | 'docx'>('pdf');
  const [previewData, setPreviewData] = useState<AMHReportSections | null>(null);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const currentStepIndex = AMH_WIZARD_STEPS.findIndex((s) => s.key === step);

  // ─────────────────────────────────────────────────────────────
  // NAVIGATION
  // ─────────────────────────────────────────────────────────────

  const canAdvance = useMemo(() => {
    switch (step) {
      case 'projects':
        return selectedProjectIds.length > 0 && period !== null;
      case 'sections':
        return enabledSections.length > 0;
      case 'preview':
        return previewData !== null;
      case 'generate':
        return true;
      default:
        return false;
    }
  }, [step, selectedProjectIds, period, enabledSections, previewData]);

  const handleNext = useCallback(async () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= AMH_WIZARD_STEPS.length) return;

    // Generate preview when moving to preview step
    if (AMH_WIZARD_STEPS[nextIndex].key === 'preview' && period) {
      try {
        const data = await generatePreview(selectedProjectIds, period, enabledSections);
        setPreviewData(data);
      } catch {
        return; // Stay on current step if preview fails
      }
    }

    setStep(AMH_WIZARD_STEPS[nextIndex].key);
  }, [currentStepIndex, selectedProjectIds, period, enabledSections, generatePreview]);

  const handleBack = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex < 0) {
      onCancel?.();
      return;
    }
    setStep(AMH_WIZARD_STEPS[prevIndex].key);
  }, [currentStepIndex, onCancel]);

  const handleGenerate = useCallback(async () => {
    if (!period) return;
    try {
      const result = await generateReport(
        selectedProjectIds,
        period,
        enabledSections,
        outputFormat
      );
      setGeneratedPdfUrl(result.pdfUrl);
      onComplete?.(result.reportId);
    } catch {
      // Error handled by hook
    }
  }, [selectedProjectIds, period, enabledSections, outputFormat, generateReport, onComplete]);

  // ─────────────────────────────────────────────────────────────
  // PROJECT SELECTION
  // ─────────────────────────────────────────────────────────────

  const toggleProject = useCallback((id: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }, []);

  // ─────────────────────────────────────────────────────────────
  // SECTION TOGGLE
  // ─────────────────────────────────────────────────────────────

  const toggleSection = useCallback((key: AMHSectionKey) => {
    setEnabledSections((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  }, []);

  const toggleExpandSection = useCallback((key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ─────────────────────────────────────────────────────────────
  // FORMAT HELPERS
  // ─────────────────────────────────────────────────────────────

  const formatAmount = (amount: number, currency = 'UGX') => {
    if (currency === 'USD') {
      return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `UGX ${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-xl border shadow-lg overflow-hidden max-w-4xl mx-auto">
      {/* Step indicator */}
      <div className="bg-gray-50 border-b px-6 py-4">
        <div className="flex items-center justify-between">
          {AMH_WIZARD_STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  i < currentStepIndex
                    ? 'bg-green-600 text-white'
                    : i === currentStepIndex
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {i < currentStepIndex ? (
                  <Check className="w-4 h-4" />
                ) : (
                  s.number
                )}
              </div>
              <span
                className={`ml-2 text-sm hidden sm:inline ${
                  i === currentStepIndex ? 'font-medium text-gray-900' : 'text-gray-500'
                }`}
              >
                {s.label}
              </span>
              {i < AMH_WIZARD_STEPS.length - 1 && (
                <div className="w-8 sm:w-16 h-px bg-gray-300 mx-2" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="p-6 min-h-[400px] max-h-[60vh] overflow-y-auto">
        {/* Step 1: Select Projects */}
        {step === 'projects' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Select Projects
              </h3>
              <p className="text-sm text-gray-500">
                Choose which projects to include in the AMH report.
              </p>
            </div>

            {/* Period selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Report Period
              </label>
              <div className="flex gap-2 mb-3">
                {(['monthly', 'quarterly', 'custom'] as ReportPeriodType[]).map((pt) => (
                  <button
                    key={pt}
                    onClick={() => setPeriodType(pt)}
                    className={`px-3 py-1.5 text-sm rounded-full ${
                      periodType === pt
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {pt.charAt(0).toUpperCase() + pt.slice(1)}
                  </button>
                ))}
              </div>
              <ReportPeriodSelector
                periodType={periodType}
                value={period}
                onChange={setPeriod}
              />
            </div>

            {/* Project list */}
            <div className="space-y-2">
              {allProjects.map((project: any) => {
                const isSelected = selectedProjectIds.includes(project.id);
                const utilization = project.budget?.totalBudget
                  ? (((project.budget.totalSpent || 0) / project.budget.totalBudget) * 100).toFixed(0)
                  : '—';

                return (
                  <button
                    key={project.id}
                    onClick={() => toggleProject(project.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          {project.name}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          {project.code}
                        </span>
                        {project.programName && (
                          <span className="text-xs text-gray-400 ml-2">
                            ({project.programName})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">
                          {utilization}% utilized
                        </span>
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="text-sm text-gray-500">
              {selectedProjectIds.length} project{selectedProjectIds.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        )}

        {/* Step 2: Configure Sections */}
        {step === 'sections' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Configure Report Sections
              </h3>
              <p className="text-sm text-gray-500">
                Enable or disable sections for this report.
              </p>
            </div>

            <div className="space-y-2">
              {(Object.entries(AMH_SECTION_LABELS) as [AMHSectionKey, { label: string; description: string }][]).map(
                ([key, config]) => {
                  const isEnabled = enabledSections.includes(key);
                  return (
                    <div
                      key={key}
                      className={`p-4 rounded-lg border transition-colors ${
                        isEnabled ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-900">
                            {config.label}
                          </span>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {config.description}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleSection(key)}
                          className={`relative w-10 h-6 rounded-full transition-colors ${
                            isEnabled ? 'bg-blue-600' : 'bg-gray-300'
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                              isEnabled ? 'left-5' : 'left-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            {/* Output format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Output Format
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setOutputFormat('pdf')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    outputFormat === 'pdf'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  PDF
                </button>
                <button
                  onClick={() => setOutputFormat('docx')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    outputFormat === 'docx'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  DOCX
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Report Preview
              </h3>
              <p className="text-sm text-gray-500">
                Review the data before generating the final report.
              </p>
            </div>

            {previewData && (
              <div className="space-y-3">
                {/* Budget Summary */}
                {enabledSections.includes('budget') && (
                  <div className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleExpandSection('budget')}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100"
                    >
                      <span className="text-sm font-medium">Budget Overview</span>
                      {expandedSections.has('budget') ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    {expandedSections.has('budget') && (
                      <div className="p-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500 block">Total Budget</span>
                            <span className="font-semibold">
                              {formatAmount(previewData.budget.consolidated.totalBudget, previewData.budget.currency)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">Total Spent</span>
                            <span className="font-semibold">
                              {formatAmount(previewData.budget.consolidated.totalSpent, previewData.budget.currency)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">Remaining</span>
                            <span className="font-semibold text-green-600">
                              {formatAmount(previewData.budget.consolidated.totalRemaining, previewData.budget.currency)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">Utilization</span>
                            <span className="font-semibold">
                              {previewData.budget.consolidated.overallUtilization.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Accountability Summary */}
                {enabledSections.includes('accountability') && (
                  <div className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleExpandSection('accountability')}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100"
                    >
                      <span className="text-sm font-medium">
                        Accountability ({previewData.accountability.summary.entryCount} entries)
                      </span>
                      {expandedSections.has('accountability') ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    {expandedSections.has('accountability') && (
                      <div className="p-3 text-sm">
                        <div className="grid grid-cols-3 gap-3 mb-3">
                          <div>
                            <span className="text-gray-500 block">Accounted For</span>
                            <span className="font-semibold">
                              {formatAmount(previewData.accountability.summary.totalAccountedFor)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">Pending</span>
                            <span className="font-semibold text-yellow-600">
                              {formatAmount(previewData.accountability.summary.pendingAccountability)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">Entries</span>
                            <span className="font-semibold">
                              {previewData.accountability.summary.entryCount}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Reconciliation Summary */}
                {enabledSections.includes('reconciliation') && (
                  <div className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleExpandSection('reconciliation')}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100"
                    >
                      <span className="text-sm font-medium">Reconciliation Status</span>
                      {expandedSections.has('reconciliation') ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    {expandedSections.has('reconciliation') && (
                      <div className="p-3 text-sm grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <span className="text-gray-500 block">Advances</span>
                          <span className="font-semibold">
                            {formatAmount(previewData.reconciliation.totalAdvances)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Outstanding</span>
                          <span className={`font-semibold ${previewData.reconciliation.outstandingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatAmount(previewData.reconciliation.outstandingBalance)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Matched</span>
                          <span className="font-semibold">{previewData.reconciliation.matchedToRequisitions}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Overdue</span>
                          <span className="font-semibold text-red-600">{previewData.reconciliation.overduePendingCount}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Documentation Completeness */}
                {enabledSections.includes('documentation') && (
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Documentation Completeness</span>
                      <span className={`text-sm font-semibold ${previewData.documentation.completenessPercent >= 80 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {previewData.documentation.completenessPercent.toFixed(0)}%
                      </span>
                    </div>
                    {previewData.documentation.missingDocuments.length > 0 && (
                      <p className="text-xs text-yellow-600 mt-1">
                        {previewData.documentation.missingDocuments.length} expense(s) with missing documents
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Generate */}
        {step === 'generate' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            {isGenerating ? (
              <>
                <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Generating Report...
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    This may take a moment for large datasets.
                  </p>
                </div>
              </>
            ) : generatedPdfUrl ? (
              <>
                <CheckCircle2 className="w-16 h-16 text-green-500" />
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Report Generated
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Your AMH report is ready to download.
                  </p>
                </div>
                <a
                  href={generatedPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  <Download className="w-5 h-5" />
                  Download {outputFormat.toUpperCase()}
                </a>
              </>
            ) : (
              <>
                <FileText className="w-16 h-16 text-gray-300" />
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Ready to Generate
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedProjectIds.length} projects, {enabledSections.length} sections, {outputFormat.toUpperCase()} format
                  </p>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                >
                  <FileText className="w-5 h-5" />
                  Generate AMH Report
                </button>
              </>
            )}

            {error && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error.message}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between p-4 border-t bg-gray-50">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          {currentStepIndex === 0 ? 'Cancel' : 'Back'}
        </button>

        {step !== 'generate' && (
          <button
            onClick={handleNext}
            disabled={!canAdvance || isGenerating}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default AMHReportWizard;
