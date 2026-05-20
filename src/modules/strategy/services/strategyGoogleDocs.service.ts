// ============================================================================
// STRATEGY GOOGLE DOCS SERVICE
// DawinOS v2.0 - CEO Strategy Command
// Creates a Google Doc from strategy review data: original document as body
// content, AI analysis and recommendations as Google Doc comments.
// ============================================================================

import { getGoogleAccessToken, hasValidGoogleToken, refreshGoogleToken } from '../../../core/services/firebase/auth';
import type { StrategyReviewData, SectionReview } from '../types/strategy.types';
import type { SubsidiaryBranding } from '../../../core/settings/types';
import {
  REVIEW_SECTION_ORDER,
  REVIEW_SECTION_LABELS,
  REVIEW_SECTION_DESCRIPTIONS,
} from '../constants/strategyReview.constants';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface CreateGoogleDocResult {
  success: boolean;
  docId?: string;
  docUrl?: string;
  error?: string;
}

export interface StrategyDocBranding {
  subsidiaryName?: string;
  branding?: SubsidiaryBranding;
}

// ----------------------------------------------------------------------------
// Google API Helpers
// ----------------------------------------------------------------------------

const DRIVE_API_BASE = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

async function makeGoogleRequest<T>(
  url: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let msg = errorText;
    try {
      const parsed = JSON.parse(errorText);
      msg = parsed.error?.message || errorText;
    } catch {
      // keep raw
    }
    throw new Error(`Google API error (${response.status}): ${msg}`);
  }

  return response.json();
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/** Lighten a hex color by mixing with white at a given opacity */
function adjustColorOpacity(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * (1 - opacity));
  return `#${mix(r).toString(16).padStart(2, '0')}${mix(g).toString(16).padStart(2, '0')}${mix(b).toString(16).padStart(2, '0')}`;
}

// ----------------------------------------------------------------------------
// HTML Document Builder — Original document content only
// ----------------------------------------------------------------------------

function buildStrategyHTML(
  reviewData: StrategyReviewData,
  docBranding?: StrategyDocBranding,
): string {
  const title = reviewData.title || 'Business Strategy Review';
  const date = new Date(reviewData.reviewDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Branding defaults
  const b = docBranding?.branding;
  const primaryColor = b?.primaryColor || '#1a365d';
  const orgName = docBranding?.subsidiaryName || 'DawinOS';
  const logoUrl = b?.logoUrl || '';
  const tagline = b?.tagline || '';
  const fontFamily = 'Calibri, Helvetica Neue, Arial, sans-serif';

  // Build section numbers for TOC
  const sectionEntries = REVIEW_SECTION_ORDER.map((sectionKey, i) => {
    const review = reviewData.sectionReviews[
      sectionKey as keyof typeof reviewData.sectionReviews
    ] as SectionReview | undefined;
    return {
      key: sectionKey,
      label: REVIEW_SECTION_LABELS[sectionKey],
      number: i + 1,
      hasContent: !!(review?.currentContent),
    };
  });

  // Derive a lighter shade for the decorative border pattern
  const borderPatternColor = adjustColorOpacity(primaryColor, 0.3);
  const statusLabel = reviewData.status === 'in_progress' ? 'In Progress' : reviewData.status === 'completed' ? 'Completed' : 'Draft';
  const yearStr = new Date(reviewData.reviewDate).getFullYear();

  let html = `
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: ${fontFamily}; font-size: 11pt; color: #333; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 0;">

<!-- ============================================================ -->
<!-- COVER PAGE                                                     -->
<!-- ============================================================ -->
<div style="background-color: ${primaryColor}; padding: 14px; margin: 0 0 32px 0; page-break-after: always;">
  <!-- Decorative border frame -->
  <div style="border: 2px solid ${borderPatternColor}; padding: 60px 48px 40px 48px; min-height: 600px; position: relative;">

    <!-- Subsidiary label with accent line -->
    <div style="border-left: 3px solid #e74c3c; padding-left: 12px; margin-bottom: 32px;">
      <span style="font-size: 11pt; color: rgba(255,255,255,0.85); font-weight: 400; letter-spacing: 0.5px;">
        ${escapeHtml(orgName)}
      </span>
    </div>

    <!-- Main title -->
    <div style="border-left: 3px solid #e74c3c; padding-left: 12px; margin-bottom: 24px;">
      <h1 style="font-size: 32pt; color: #ffffff; margin: 0 0 8px 0; line-height: 1.15; font-weight: 700;">
        ${escapeHtml(title)}
      </h1>
    </div>

    <!-- Subtitle / tagline -->
    <div style="padding-left: 15px; margin-bottom: 48px;">
      <p style="font-size: 12pt; color: rgba(255,255,255,0.8); margin: 0; line-height: 1.5;">
        ${tagline ? escapeHtml(tagline) : `Business Plan and Strategy to guide the implementation`}
      </p>
      <p style="font-size: 10pt; color: rgba(255,255,255,0.6); margin: 8px 0 0 0;">
        ${date} &nbsp;&bull;&nbsp; ${escapeHtml(statusLabel)}
        ${reviewData.overallScore > 0 ? ` &nbsp;&bull;&nbsp; Score: ${reviewData.overallScore}/5` : ''}
      </p>
    </div>

    <!-- Logo in bottom-right -->
    ${logoUrl ? `
    <div style="text-align: right; margin-top: 80px;">
      <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(orgName)}" style="height: 72px; max-width: 240px;" />
    </div>
    ` : `
    <div style="text-align: right; margin-top: 80px;">
      <span style="font-size: 22pt; color: #ffffff; font-weight: 700; letter-spacing: 1px;">${escapeHtml(orgName)}</span>
    </div>
    `}
  </div>
</div>

<!-- ============================================================ -->
<!-- TABLE OF CONTENTS PAGE                                         -->
<!-- ============================================================ -->

<!-- TOC Header -->
<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
  <tr>
    <td style="vertical-align: middle;">
      ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(orgName)}" style="height: 40px; max-width: 180px;" />` : `<span style="font-size: 14pt; color: ${primaryColor}; font-weight: 700;">${escapeHtml(orgName)}</span>`}
    </td>
    <td style="vertical-align: middle; text-align: right;">
      <span style="font-size: 10pt; color: ${primaryColor}; font-weight: 600;">Business Plan and Strategy</span><br/>
      <span style="font-size: 9pt; color: #6b7280;">${escapeHtml(orgName)} &nbsp;&bull;&nbsp; ${date}</span>
    </td>
  </tr>
</table>

<h2 style="font-size: 18pt; color: ${primaryColor}; margin: 0 0 16px 0; font-weight: 700;">
  Table of Contents
</h2>

<table style="width: 100%; border-collapse: collapse; font-size: 10.5pt;">
`;

  sectionEntries.forEach(entry => {
    const review = reviewData.sectionReviews[entry.key as keyof typeof reviewData.sectionReviews] as SectionReview | undefined;
    const scoreText = review && review.score > 0 ? ` &nbsp;<span style="color: #9ca3af; font-size: 9pt;">(${review.score}/5)</span>` : '';
    html += `
  <tr>
    <td style="padding: 5px 0; color: #111827; border-bottom: 1px dotted #d1d5db;">
      <span style="font-weight: 700; color: ${primaryColor}; display: inline-block; width: 24px;">${entry.number}</span>
      <span style="text-transform: uppercase; font-weight: 600; font-size: 10pt; letter-spacing: 0.3px;">${escapeHtml(entry.label)}</span>${scoreText}
    </td>
  </tr>`;
  });

  html += `
</table>

<div style="margin-top: 24px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
  <p style="font-size: 8pt; color: #9ca3af; margin: 0;">
    &copy; ${yearStr} ${escapeHtml(orgName)} &mdash; Business Plan and Strategy
  </p>
</div>

<hr style="border: none; margin: 16px 0 24px 0;" />
`;

  // Sections
  REVIEW_SECTION_ORDER.forEach((sectionKey, index) => {
    const review = reviewData.sectionReviews[
      sectionKey as keyof typeof reviewData.sectionReviews
    ] as SectionReview | undefined;
    if (!review) return;

    const label = REVIEW_SECTION_LABELS[sectionKey];
    const description = REVIEW_SECTION_DESCRIPTIONS[sectionKey] || '';
    const sectionNum = index + 1;

    // Section page header (mirrors the PDF format)
    html += `
<table style="width: 100%; border-collapse: collapse; margin-top: 36px; margin-bottom: 4px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">
  <tr>
    <td style="vertical-align: middle;">
      ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="" style="height: 22px; max-width: 120px;" />` : `<span style="font-size: 9pt; color: ${primaryColor}; font-weight: 600;">${escapeHtml(orgName)}</span>`}
    </td>
    <td style="vertical-align: middle; text-align: right;">
      <span style="font-size: 8pt; color: #9ca3af;">Business Plan and Strategy &bull; ${escapeHtml(orgName)} &bull; ${date}</span>
    </td>
  </tr>
</table>

<h2 style="font-size: 15pt; color: ${primaryColor}; margin: 12px 0 4px 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid ${primaryColor}; padding-bottom: 6px;">
  ${sectionNum} &nbsp;&nbsp; ${escapeHtml(label)}
</h2>`;

    if (description) {
      html += `<p style="font-size: 9pt; color: #9ca3af; margin-top: 2px; margin-bottom: 10px; font-style: italic;">${escapeHtml(description)}</p>`;
    }

    if (review.score > 0) {
      const scoreColor = review.score >= 4 ? '#059669' : review.score >= 3 ? '#d97706' : '#dc2626';
      html += `<p style="font-size: 10pt; color: ${scoreColor}; font-weight: 600; margin: 4px 0 10px 0;">Section Score: ${review.score}/5</p>`;
    }

    // Document content
    const content = review.currentContent;
    if (content) {
      html += `<div style="font-size: 11pt; color: #111827; white-space: pre-wrap; margin: 8px 0; line-height: 1.7;">${escapeHtml(content)}</div>`;
    } else {
      html += `<p style="font-size: 10pt; color: #9ca3af; font-style: italic;">[No content for this section]</p>`;
    }

    // Section footer
    html += `
<div style="margin-top: 16px; border-top: 1px solid #e5e7eb; padding-top: 4px;">
  <p style="font-size: 8pt; color: #9ca3af; margin: 0;">&copy; ${yearStr} ${escapeHtml(orgName)} &ndash; Business Plan and Strategy Page | ${sectionNum}</p>
</div>`;
  });

  // Document Footer
  html += `
<hr style="border: none; border-top: 2px solid ${primaryColor}; margin: 40px 0 12px 0;" />
<table style="width: 100%; font-size: 8pt; color: #9ca3af;">
  <tr>
    <td>&copy; ${yearStr} ${escapeHtml(orgName)}</td>
    <td style="text-align: center;">Business Plan and Strategy &mdash; Confidential</td>
    <td style="text-align: right;">${date}</td>
  </tr>
</table>

</body>
</html>`;

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>');
}

// ----------------------------------------------------------------------------
// Add AI insights as Google Doc comments
// ----------------------------------------------------------------------------

async function addAICommentsToDoc(
  docId: string,
  accessToken: string,
  reviewData: StrategyReviewData,
): Promise<void> {
  for (const sectionKey of REVIEW_SECTION_ORDER) {
    const review = reviewData.sectionReviews[
      sectionKey as keyof typeof reviewData.sectionReviews
    ] as SectionReview | undefined;
    if (!review) continue;

    const label = REVIEW_SECTION_LABELS[sectionKey];
    const hasAnalysis = !!review.updatedContent;
    const hasRecs = review.recommendations.length > 0;
    if (!hasAnalysis && !hasRecs) continue;

    // Build comment body
    const parts: string[] = [];
    if (review.score > 0) {
      parts.push(`Score: ${review.score}/5`);
    }
    if (hasAnalysis) {
      parts.push(`\nAI Analysis:\n${review.updatedContent}`);
    }
    if (hasRecs) {
      parts.push(`\nRecommendations:\n${review.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}`);
    }

    const commentBody = parts.join('\n');

    // Use quotedFileContent to anchor comment to the section heading text
    try {
      await makeGoogleRequest<unknown>(
        `${DRIVE_API}/${docId}/comments?fields=id`,
        accessToken,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: commentBody,
            quotedFileContent: {
              mimeType: 'text/html',
              value: label,
            },
          }),
        },
      );
    } catch (err) {
      // Non-critical — if one comment fails, continue with the rest
      console.warn(`[StrategyGoogleDocs] Failed to add comment for ${sectionKey}:`, err);
    }
  }
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

/**
 * Check if the user has a valid Google token for Docs/Drive operations
 */
export function canCreateGoogleDoc(): boolean {
  return hasValidGoogleToken();
}

/**
 * Get a valid access token, auto-refreshing via popup if expired.
 */
async function ensureAccessToken(): Promise<string | null> {
  const existing = getGoogleAccessToken();
  if (existing) return existing;
  return refreshGoogleToken();
}

/**
 * Create a Google Doc from the strategy review data.
 * The doc body contains the original document content. AI analysis
 * and recommendations are added as Google Doc comments anchored
 * to each section heading.
 */
export async function createStrategyGoogleDoc(
  reviewData: StrategyReviewData,
  docBranding?: StrategyDocBranding,
): Promise<CreateGoogleDocResult> {
  const accessToken = await ensureAccessToken();
  if (!accessToken) {
    return {
      success: false,
      error: 'Google access token not available. Please sign in with Google to grant Docs access.',
    };
  }

  try {
    const html = buildStrategyHTML(reviewData, docBranding);
    const orgPrefix = docBranding?.subsidiaryName ? `${docBranding.subsidiaryName} — ` : '';
    const title = `${orgPrefix}${reviewData.title || 'Strategy Review'} — ${new Date().toLocaleDateString()}`;

    // Upload HTML as a Google Doc (Drive API converts it automatically)
    const metadata = {
      name: title,
      mimeType: 'application/vnd.google-apps.document',
    };

    const boundary = '---strategy-doc-boundary---';
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      '',
      html,
      `--${boundary}--`,
    ].join('\r\n');

    const result = await makeGoogleRequest<{
      id: string;
      name: string;
      webViewLink?: string;
    }>(
      `${DRIVE_API_BASE}?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true`,
      accessToken,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );

    const docUrl =
      result.webViewLink || `https://docs.google.com/document/d/${result.id}/edit`;

    // Add AI insights as comments (non-blocking — doc is already created)
    addAICommentsToDoc(result.id, accessToken, reviewData).catch(err => {
      console.warn('[StrategyGoogleDocs] Failed to add some comments:', err);
    });

    return {
      success: true,
      docId: result.id,
      docUrl,
    };
  } catch (error) {
    console.error('[StrategyGoogleDocs] Failed to create doc:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create Google Doc',
    };
  }
}

/**
 * Open an existing Google Doc by its URL.
 */
export function openGoogleDoc(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Update a single section in a Google Doc using batchUpdate.
 * Deletes the old content range and inserts the new content.
 */
export async function updateGoogleDocSection(
  docId: string,
  sectionRange: { startIndex: number; endIndex: number },
  newContent: string
): Promise<{ success: boolean; newEndIndex: number }> {
  const accessToken = await ensureAccessToken();
  if (!accessToken) {
    throw new Error('Google access token not available. Please sign in with Google.');
  }

  const DOCS_API = 'https://docs.googleapis.com/v1/documents';

  const requests = [
    {
      deleteContentRange: {
        range: {
          startIndex: sectionRange.startIndex,
          endIndex: sectionRange.endIndex,
        },
      },
    },
    {
      insertText: {
        location: { index: sectionRange.startIndex },
        text: newContent,
      },
    },
  ];

  await makeGoogleRequest<unknown>(
    `${DOCS_API}/${docId}:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    },
  );

  const newEndIndex = sectionRange.startIndex + newContent.length;
  return { success: true, newEndIndex };
}

/**
 * Recalculate Google Doc ranges for all sections after an update.
 */
export function recalculateRanges(
  sections: Array<{ googleDocRange: { startIndex: number; endIndex: number } | null }>,
  updatedIndex: number,
  lengthDelta: number
): void {
  for (let i = updatedIndex + 1; i < sections.length; i++) {
    const range = sections[i].googleDocRange;
    if (range) {
      range.startIndex += lengthDelta;
      range.endIndex += lengthDelta;
    }
  }
}

/**
 * Update an existing Google Doc with fresh content from the review.
 */
export async function updateStrategyGoogleDoc(
  reviewData: StrategyReviewData,
  existingDocId: string,
  docBranding?: StrategyDocBranding,
): Promise<CreateGoogleDocResult> {
  const accessToken = await ensureAccessToken();
  if (!accessToken) {
    return {
      success: false,
      error: 'Google access token not available. Please sign in with Google.',
    };
  }

  try {
    await makeGoogleRequest<{ id: string }>(
      `${DRIVE_API}/${existingDocId}?fields=id&supportsAllDrives=true`,
      accessToken,
    );
    return createStrategyGoogleDoc(reviewData, docBranding);
  } catch {
    return createStrategyGoogleDoc(reviewData, docBranding);
  }
}
