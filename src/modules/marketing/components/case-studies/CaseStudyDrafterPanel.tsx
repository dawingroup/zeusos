/**
 * CaseStudyDrafterPanel
 *
 * Marketing Hub AI tool: pick a DesignProject → Claude drafts a full
 * ProjectCaseStudy → user jumps straight to the case study editor to
 * review + publish.
 *
 * Wraps the `draftCaseStudyFromProject` callable. Used inside the
 * MarketingAgentPage "Case Studies" tab.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, FileText, ArrowRight, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  DesignProjectPicker,
  type DesignProjectPickerValue,
} from '@/subsidiaries/finishes/design-studio/components/scene/DesignProjectPicker';
import {
  draftCaseStudyFromProject,
  type DraftCaseStudyFromProjectResult,
} from '@/shared/services/ai/draftStorefront';

const DEFAULT_SUBSIDIARY = 'finishes';

export default function CaseStudyDrafterPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [picked, setPicked] = useState<DesignProjectPickerValue | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DraftCaseStudyFromProjectResult | null>(null);

  async function handleDraft() {
    if (!user?.uid || !picked) return;
    setError(null);
    setResult(null);
    setDrafting(true);
    try {
      const res = await draftCaseStudyFromProject({
        projectId: picked.id,
        subsidiaryId: DEFAULT_SUBSIDIARY,
      });
      setResult(res);
    } catch (e) {
      setError((e as Error).message || 'Draft failed');
    } finally {
      setDrafting(false);
    }
  }

  function openCaseStudy() {
    // Case studies list page; the new draft will be top of list (status=draft,
    // updatedAt=now). The form is opened from the list via the card edit icon.
    navigate('/marketing/case-studies');
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
          <FileText className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Draft a case study from a DesignProject</h2>
          <p className="text-sm text-gray-500 mt-1">
            Pick a completed (or in-flight) project from Design Manager. Claude reads the project's
            facts — client, location, dates, scope, description — and writes a full case-study
            opening pass: hero, narrative, CTA, and the storefront block. You review, edit, then
            flip the publish gate.
          </p>
        </div>
      </div>

      {/* Picker card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Pick a Design Manager project
          </label>
          <DesignProjectPicker
            value={picked}
            onChange={(v) => {
              setPicked(v);
              setResult(null);
              setError(null);
            }}
            statuses={['active', 'completed']}
            disabled={drafting}
          />
          {picked && (
            <p className="text-xs text-gray-500 mt-2">
              {picked.customerName ? <>For <strong>{picked.customerName}</strong></> : null}
              {picked.code ? <> · <code className="font-mono">{picked.code}</code></> : null}
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action */}
        <div className="flex items-center justify-between pt-3 border-t">
          <p className="text-xs text-gray-500">
            Drafts via <code>claude-sonnet-4</code>. Refuses to fabricate — fields it can't ground in
            the project record are left empty for you to fill in.
          </p>
          <button
            type="button"
            onClick={handleDraft}
            disabled={!picked || drafting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50"
          >
            {drafting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {drafting ? 'Drafting…' : 'Draft case study'}
          </button>
        </div>
      </div>

      {/* Result card */}
      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-emerald-900">Case study drafted</h3>
              <p className="text-sm text-emerald-800 mt-0.5">
                Created from <strong>{result.sourceProject.name}</strong>
                {result.sourceProject.customerName ? ` for ${result.sourceProject.customerName}` : ''}
                {result.sourceProject.completedYear ? ` (${result.sourceProject.completedYear})` : ''}.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-emerald-200 p-3">
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Drafted sections</div>
            <div className="flex flex-wrap gap-1.5">
              {result.draftedFields.length === 0 ? (
                <span className="text-xs text-gray-400">No sections filled (project record may be sparse)</span>
              ) : (
                result.draftedFields.map((f) => (
                  <span key={f} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-800 font-mono">
                    {f}
                  </span>
                ))
              )}
            </div>
            <div className="mt-3 text-xs text-gray-500">
              Handle: <code className="font-mono text-gray-700">{result.handle}</code>
              {' · '}id: <code className="font-mono text-gray-700">{result.caseStudyId}</code>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-emerald-800">
              The draft has <strong>status: draft</strong> and <strong>shouldPublishToShopify: false</strong> — nothing's
              live until you review.
            </p>
            <button
              type="button"
              onClick={openCaseStudy}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-700 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50"
            >
              Open case studies
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Footer help */}
      <div className="text-xs text-gray-500 max-w-prose">
        <strong>Tip:</strong> After review, open the case study's <em>Storefront</em> drawer to set
        sector / area / linked finishes & materials, then toggle <em>Publish to dawinfinishes.com</em>.
        The metaobject lands at <code>/projects/{'{handle}'}</code> within ~15s.
      </div>
    </div>
  );
}
