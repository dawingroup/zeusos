// ============================================================================
// STRATEGY ASSESSMENT SERVICE - Strategy Plan Update Tool
// AI-powered section assessment and rewrite generation
// ============================================================================

import { Timestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import { analyzeStrategySection } from './strategyAI.service';
import {
  getSections,
  getSection,
  setSectionRewrite,
} from './strategyDocumentSection.service';
import { writeAuditEntry } from './sectionAuditLog.service';
import { DOCUMENT_SECTIONS } from '../constants/strategy.constants';
import { DEFAULT_DATA_SOURCE_MAPPING } from '../constants/sectionMapping.constants';
import type {
  DocumentSection,
  SectionAssessment,
  AssessmentCycleResult,
  SectionType,
  SectionAuditEntry,
} from '../types/documentSection.types';

// ============================================================================
// FETCH DATA FOR SECTION TYPE
// ============================================================================

/**
 * Fetch business data relevant to a section type.
 * Calls the same data sources CrossModuleContext uses via the AI endpoint.
 */
export async function fetchDataForSectionType(
  companyId: string,
  sectionType: SectionType
): Promise<Record<string, unknown>> {
  const sources = DEFAULT_DATA_SOURCE_MAPPING[sectionType] || [];
  if (sources.length === 0) return {};

  // Return the mapping so the AI service can query the right data
  return {
    sectionType,
    dataSources: sources,
    companyId,
  };
}

// ============================================================================
// ASSESS SECTION
// ============================================================================

export async function assessSection(
  companyId: string,
  reviewId: string,
  sectionId: string,
  dataPackage?: Record<string, unknown>
): Promise<SectionAssessment> {
  const section = await getSection(companyId, reviewId, sectionId);
  if (!section) throw new Error('Section not found');

  // Fetch data if not provided
  const data = dataPackage || await fetchDataForSectionType(companyId, section.sectionType);

  // Call AI for alignment assessment
  const response = await analyzeStrategySection({
    companyId,
    reviewId,
    section: 'document_section',
    documentSectionId: sectionId,
    assessmentMode: 'assess_alignment',
    currentData: {
      sectionContent: section.content,
      sectionHeading: section.headingText,
      sectionType: section.sectionType,
      ...data,
    },
    question: `Assess the alignment of this strategy section "${section.headingText}" with current business data. Score from 1-5 (1=completely misaligned, 5=fully aligned). Identify specific gaps and outdated claims. Respond in JSON: {"score": number, "gaps": string[], "outdatedClaims": string[], "recommendation": "rewrite"|"minor_update"|"no_action"|"flag_for_ceo"}`,
  });

  // Parse assessment from AI response
  const assessment = parseAssessmentResponse(
    response.message,
    section,
    data
  );

  // Update section with assessment results
  const colPath = DOCUMENT_SECTIONS(companyId, reviewId);
  await updateDoc(doc(db, colPath, sectionId), {
    alignmentScore: assessment.score,
    lastAssessedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  // Write audit entry for assessment
  await writeAuditEntry(companyId, reviewId, {
    sectionId,
    sectionHeading: section.headingText,
    changeType: 'assessment_only',
    beforeHash: section.contentHash,
    afterHash: section.contentHash,
    beforeSummary: section.content.substring(0, 200),
    afterSummary: section.content.substring(0, 200),
    dataSourcesQueried: assessment.dataSourcesQueried,
    dataSnapshot: assessment.dataSnapshot,
    alignmentScoreBefore: section.alignmentScore,
    alignmentScoreAfter: assessment.score,
    rationale: `Assessment: ${assessment.gaps.length} gaps found, recommendation: ${assessment.recommendation}`,
    triggeredBy: 'manual',
    approvedBy: null,
  });

  return assessment;
}

// ============================================================================
// GENERATE REWRITE
// ============================================================================

export async function generateRewrite(
  companyId: string,
  reviewId: string,
  sectionId: string,
  assessment: SectionAssessment
): Promise<string> {
  const section = await getSection(companyId, reviewId, sectionId);
  if (!section) throw new Error('Section not found');

  const response = await analyzeStrategySection({
    companyId,
    reviewId,
    section: 'document_section',
    documentSectionId: sectionId,
    assessmentMode: 'generate_rewrite',
    currentData: {
      sectionContent: section.content,
      sectionHeading: section.headingText,
      sectionType: section.sectionType,
      assessment: {
        score: assessment.score,
        gaps: assessment.gaps,
        outdatedClaims: assessment.outdatedClaims,
        recommendation: assessment.recommendation,
      },
      ...assessment.dataSnapshot,
    },
    question: `Rewrite this strategy section "${section.headingText}" to address the identified gaps and incorporate current business data. Maintain the same tone, structure, and strategic intent. Return only the rewritten section content, no JSON wrapper.`,
  });

  const rewriteText = response.message || response.conversationMessage?.content || '';

  await setSectionRewrite(companyId, reviewId, sectionId, rewriteText);

  return rewriteText;
}

// ============================================================================
// RUN FULL ASSESSMENT CYCLE
// ============================================================================

export async function runFullCycle(
  companyId: string,
  reviewId: string,
  options?: {
    rewriteThreshold?: number;
    autoApplyRewrites?: boolean;
    sectionIds?: string[];
    skipTypes?: SectionType[];
    onProgress?: (current: number, total: number) => void;
  }
): Promise<AssessmentCycleResult> {
  const threshold = options?.rewriteThreshold ?? 3;
  const allSections = await getSections(companyId, reviewId);

  // Filter sections
  let sections = allSections;
  if (options?.sectionIds?.length) {
    sections = sections.filter((s) => options.sectionIds!.includes(s.id));
  }
  if (options?.skipTypes?.length) {
    sections = sections.filter((s) => !options.skipTypes!.includes(s.sectionType));
  }

  const assessments: SectionAssessment[] = [];
  const auditEntries: SectionAuditEntry[] = [];
  let sectionsRewritten = 0;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    options?.onProgress?.(i + 1, sections.length);

    // Fetch data and assess
    const data = await fetchDataForSectionType(companyId, section.sectionType);
    const assessment = await assessSection(companyId, reviewId, section.id, data);
    assessments.push(assessment);

    // Rewrite if below threshold
    if (assessment.score <= threshold && assessment.recommendation !== 'no_action') {
      await generateRewrite(companyId, reviewId, section.id, assessment);
      sectionsRewritten++;
    }
  }

  // Compute overall alignment score
  const scoredAssessments = assessments.filter((a) => a.score > 0);
  const overallAlignmentScore = scoredAssessments.length > 0
    ? Math.round(
        (scoredAssessments.reduce((sum, a) => sum + a.score, 0) / scoredAssessments.length) * 10
      ) / 10
    : 0;

  // Update review document metadata
  const reviewDocPath = `companies/${companyId}/strategy_reviews/${reviewId}`;
  await updateDoc(doc(db, reviewDocPath), {
    lastFullAssessmentAt: Timestamp.now(),
    overallAlignmentScore,
    sectionsNeedingRewrite: sectionsRewritten,
    updatedAt: new Date().toISOString(),
  });

  return {
    reviewId,
    timestamp: Timestamp.now(),
    totalSections: allSections.length,
    assessedSections: assessments.length,
    sectionsRewritten,
    overallAlignmentScore,
    assessments,
    auditEntries,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function parseAssessmentResponse(
  responseText: string,
  section: DocumentSection,
  dataSnapshot: Record<string, unknown>
): SectionAssessment {
  try {
    const jsonStr = extractJSON(responseText);
    const parsed = JSON.parse(jsonStr);

    return {
      sectionId: section.id,
      sectionHeading: section.headingText,
      score: Math.max(1, Math.min(5, Number(parsed.score) || 3)),
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
      outdatedClaims: Array.isArray(parsed.outdatedClaims) ? parsed.outdatedClaims : [],
      recommendation: validateRecommendation(parsed.recommendation),
      dataSnapshot,
      dataSourcesQueried: section.dataSourceMapping,
    };
  } catch {
    // Fallback if AI response isn't valid JSON
    return {
      sectionId: section.id,
      sectionHeading: section.headingText,
      score: 3,
      gaps: ['Unable to parse AI assessment — manual review recommended'],
      outdatedClaims: [],
      recommendation: 'flag_for_ceo',
      dataSnapshot,
      dataSourcesQueried: section.dataSourceMapping,
    };
  }
}

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : text;
}

function validateRecommendation(
  rec: unknown
): 'rewrite' | 'minor_update' | 'no_action' | 'flag_for_ceo' {
  const valid = ['rewrite', 'minor_update', 'no_action', 'flag_for_ceo'];
  return valid.includes(rec as string)
    ? (rec as 'rewrite' | 'minor_update' | 'no_action' | 'flag_for_ceo')
    : 'flag_for_ceo';
}
