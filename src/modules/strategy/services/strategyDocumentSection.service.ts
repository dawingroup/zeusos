// ============================================================================
// STRATEGY DOCUMENT SECTION SERVICE - Strategy Plan Update Tool
// Section CRUD, parsing, reassembly, and rewrite management
// ============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import { DOCUMENT_SECTIONS } from '../constants/strategy.constants';
import { SECTION_TYPE_KEYWORDS, DEFAULT_DATA_SOURCE_MAPPING } from '../constants/sectionMapping.constants';
import { writeAuditEntry } from './sectionAuditLog.service';
import type {
  DocumentSection,
  SectionType,
  RewriteStatus,
} from '../types/documentSection.types';

// ============================================================================
// CONTENT HASHING
// ============================================================================

async function hashContent(content: string): Promise<string> {
  const normalised = content.trim().replace(/\s+/g, ' ').toLowerCase();
  const data = new TextEncoder().encode(normalised);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================================
// SECTION PARSER
// ============================================================================

interface ParsedSection {
  headingText: string;
  headingLevel: 1 | 2 | 3;
  content: string;
}

/**
 * Parse document text into sections by heading patterns.
 * Supports: markdown headings, numbered headings, all-caps lines.
 */
function parseDocumentText(text: string): ParsedSection[] {
  const lines = text.split('\n');
  const sections: ParsedSection[] = [];
  let currentHeading: { text: string; level: 1 | 2 | 3 } | null = null;
  let currentContent: string[] = [];

  function flush() {
    if (currentHeading) {
      sections.push({
        headingText: currentHeading.text,
        headingLevel: currentHeading.level,
        content: currentContent.join('\n').trim(),
      });
    } else if (currentContent.length > 0 && currentContent.join('').trim()) {
      // Content before any heading → general section
      sections.push({
        headingText: 'Introduction',
        headingLevel: 1,
        content: currentContent.join('\n').trim(),
      });
    }
    currentContent = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Markdown-style headings: # Heading, ## Heading, ### Heading
    const mdMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (mdMatch) {
      flush();
      currentHeading = {
        text: mdMatch[2].trim(),
        level: mdMatch[1].length as 1 | 2 | 3,
      };
      continue;
    }

    // 2. Numbered headings: 1. Title, 3.2 Title
    const numMatch = trimmed.match(/^(\d+\.?\d*\.?)\s+([A-Z][\w\s&/,:-]{2,})$/);
    if (numMatch) {
      const depth = numMatch[1].split('.').filter(Boolean).length;
      flush();
      currentHeading = {
        text: numMatch[2].trim(),
        level: Math.min(depth, 3) as 1 | 2 | 3,
      };
      continue;
    }

    // 3. All-caps short lines followed by blank line
    if (
      trimmed.length >= 3 &&
      trimmed.length <= 80 &&
      trimmed === trimmed.toUpperCase() &&
      /[A-Z]/.test(trimmed) &&
      !/^\d+$/.test(trimmed) &&
      (i + 1 >= lines.length || lines[i + 1].trim() === '')
    ) {
      flush();
      // Title-case the all-caps heading
      const titleCased = trimmed
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
      currentHeading = { text: titleCased, level: 1 };
      continue;
    }

    currentContent.push(line);
  }

  flush();

  // Fallback: no headings found → single general section
  if (sections.length === 0 && text.trim()) {
    sections.push({
      headingText: 'Document Content',
      headingLevel: 1,
      content: text.trim(),
    });
  }

  return sections;
}

// ============================================================================
// SECTION TYPE CLASSIFIER
// ============================================================================

function classifySectionType(heading: string, content: string): SectionType {
  const searchText = `${heading} ${content.substring(0, 200)}`.toLowerCase();

  const types: SectionType[] = [
    'financial', 'market', 'operations', 'growth',
    'risk', 'people', 'governance',
  ];

  for (const type of types) {
    const keywords = SECTION_TYPE_KEYWORDS[type];
    if (keywords.some((kw) => searchText.includes(kw))) {
      return type;
    }
  }

  return 'general';
}

// ============================================================================
// PARSE AND STORE SECTIONS
// ============================================================================

export async function parseAndStoreSections(
  companyId: string,
  reviewId: string,
  documentText: string,
  _googleDocId?: string
): Promise<DocumentSection[]> {
  const parsed = parseDocumentText(documentText);
  const colPath = DOCUMENT_SECTIONS(companyId, reviewId);
  const now = Timestamp.now();

  // Build parent mapping for hierarchy
  let lastLevel1Id: string | null = null;
  let lastLevel2Id: string | null = null;

  const sections: DocumentSection[] = [];

  // Use batch writes (max 500 per batch)
  const batchSize = 450;
  let batch = writeBatch(db);
  let batchCount = 0;

  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    const docRef = doc(collection(db, colPath));
    const sectionType = classifySectionType(p.headingText, p.content);
    const contentHash = await hashContent(p.content);

    // Determine parent
    let parentSectionId: string | null = null;
    if (p.headingLevel === 2) parentSectionId = lastLevel1Id;
    else if (p.headingLevel === 3) parentSectionId = lastLevel2Id || lastLevel1Id;

    const section: DocumentSection = {
      id: docRef.id,
      sectionIndex: i,
      headingText: p.headingText,
      headingLevel: p.headingLevel,
      parentSectionId,
      content: p.content,
      contentHash,
      sectionType,
      dataSourceMapping: DEFAULT_DATA_SOURCE_MAPPING[sectionType] || [],
      alignmentScore: null,
      lastAssessedAt: null,
      pendingRewrite: null,
      rewriteStatus: 'none' as RewriteStatus,
      version: 1,
      googleDocRange: null,
      createdAt: now,
      updatedAt: now,
    };

    batch.set(docRef, section);
    sections.push(section);
    batchCount++;

    // Track hierarchy
    if (p.headingLevel === 1) lastLevel1Id = docRef.id;
    if (p.headingLevel === 2) lastLevel2Id = docRef.id;

    // Flush batch if needed
    if (batchCount >= batchSize) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  return sections;
}

// ============================================================================
// GET SECTIONS
// ============================================================================

export async function getSections(
  companyId: string,
  reviewId: string
): Promise<DocumentSection[]> {
  const colPath = DOCUMENT_SECTIONS(companyId, reviewId);
  const q = query(collection(db, colPath), orderBy('sectionIndex', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as DocumentSection);
}

// ============================================================================
// GET SINGLE SECTION
// ============================================================================

export async function getSection(
  companyId: string,
  reviewId: string,
  sectionId: string
): Promise<DocumentSection | null> {
  const colPath = DOCUMENT_SECTIONS(companyId, reviewId);
  const snap = await getDoc(doc(db, colPath, sectionId));
  return snap.exists() ? (snap.data() as DocumentSection) : null;
}

// ============================================================================
// UPDATE SECTION CONTENT
// ============================================================================

export async function updateSectionContent(
  companyId: string,
  reviewId: string,
  sectionId: string,
  newContent: string,
  userId: string
): Promise<void> {
  const section = await getSection(companyId, reviewId, sectionId);
  if (!section) throw new Error('Section not found');

  const newHash = await hashContent(newContent);
  if (newHash === section.contentHash) return; // No change

  const colPath = DOCUMENT_SECTIONS(companyId, reviewId);
  const docRef = doc(db, colPath, sectionId);

  await updateDoc(docRef, {
    content: newContent,
    contentHash: newHash,
    version: section.version + 1,
    updatedAt: Timestamp.now(),
  });

  // Write audit entry
  await writeAuditEntry(companyId, reviewId, {
    sectionId,
    sectionHeading: section.headingText,
    changeType: 'manual_edit',
    beforeHash: section.contentHash,
    afterHash: newHash,
    beforeSummary: section.content.substring(0, 200),
    afterSummary: newContent.substring(0, 200),
    dataSourcesQueried: [],
    dataSnapshot: {},
    alignmentScoreBefore: section.alignmentScore,
    alignmentScoreAfter: section.alignmentScore,
    rationale: 'Manual content update',
    triggeredBy: 'manual',
    approvedBy: userId,
  });
}

// ============================================================================
// SET SECTION REWRITE (pending approval)
// ============================================================================

export async function setSectionRewrite(
  companyId: string,
  reviewId: string,
  sectionId: string,
  rewriteContent: string
): Promise<void> {
  const colPath = DOCUMENT_SECTIONS(companyId, reviewId);
  await updateDoc(doc(db, colPath, sectionId), {
    pendingRewrite: rewriteContent,
    rewriteStatus: 'pending_review' as RewriteStatus,
    updatedAt: Timestamp.now(),
  });
}

// ============================================================================
// APPROVE REWRITE
// ============================================================================

export async function approveRewrite(
  companyId: string,
  reviewId: string,
  sectionId: string,
  userId: string
): Promise<void> {
  const section = await getSection(companyId, reviewId, sectionId);
  if (!section) throw new Error('Section not found');
  if (!section.pendingRewrite) throw new Error('No pending rewrite to approve');

  const newHash = await hashContent(section.pendingRewrite);
  const colPath = DOCUMENT_SECTIONS(companyId, reviewId);

  await updateDoc(doc(db, colPath, sectionId), {
    content: section.pendingRewrite,
    contentHash: newHash,
    pendingRewrite: null,
    rewriteStatus: 'applied' as RewriteStatus,
    version: section.version + 1,
    updatedAt: Timestamp.now(),
  });

  await writeAuditEntry(companyId, reviewId, {
    sectionId,
    sectionHeading: section.headingText,
    changeType: 'rewrite',
    beforeHash: section.contentHash,
    afterHash: newHash,
    beforeSummary: section.content.substring(0, 200),
    afterSummary: section.pendingRewrite.substring(0, 200),
    dataSourcesQueried: section.dataSourceMapping,
    dataSnapshot: {},
    alignmentScoreBefore: section.alignmentScore,
    alignmentScoreAfter: null,
    rationale: 'Rewrite approved and applied',
    triggeredBy: 'manual',
    approvedBy: userId,
  });
}

// ============================================================================
// REJECT REWRITE
// ============================================================================

export async function rejectRewrite(
  companyId: string,
  reviewId: string,
  sectionId: string,
  userId: string,
  reason?: string
): Promise<void> {
  const section = await getSection(companyId, reviewId, sectionId);
  if (!section) throw new Error('Section not found');

  const colPath = DOCUMENT_SECTIONS(companyId, reviewId);

  await updateDoc(doc(db, colPath, sectionId), {
    pendingRewrite: null,
    rewriteStatus: 'rejected' as RewriteStatus,
    updatedAt: Timestamp.now(),
  });

  await writeAuditEntry(companyId, reviewId, {
    sectionId,
    sectionHeading: section.headingText,
    changeType: 'assessment_only',
    beforeHash: section.contentHash,
    afterHash: section.contentHash,
    beforeSummary: section.content.substring(0, 200),
    afterSummary: section.content.substring(0, 200),
    dataSourcesQueried: [],
    dataSnapshot: {},
    alignmentScoreBefore: section.alignmentScore,
    alignmentScoreAfter: section.alignmentScore,
    rationale: reason || 'Rewrite rejected',
    triggeredBy: 'manual',
    approvedBy: userId,
  });
}

// ============================================================================
// REASSEMBLE DOCUMENT
// ============================================================================

export async function reassembleDocument(
  companyId: string,
  reviewId: string
): Promise<string> {
  const sections = await getSections(companyId, reviewId);

  return sections
    .map((s) => {
      const prefix = '#'.repeat(s.headingLevel);
      return `${prefix} ${s.headingText}\n\n${s.content}`;
    })
    .join('\n\n');
}
