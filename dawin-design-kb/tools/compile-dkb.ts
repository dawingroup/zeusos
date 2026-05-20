#!/usr/bin/env npx ts-node
/**
 * compile-dkb.ts — Wiki → Firestore Compiler
 *
 * Reads all .md files under dawin-design-kb/wiki/,
 * parses YAML frontmatter, validates, and writes to the
 * `designKnowledgeBase` Firestore collection.
 *
 * Usage:
 *   npx ts-node dawin-design-kb/tools/compile-dkb.ts
 *
 * Requires: GOOGLE_APPLICATION_CREDENTIALS or Firebase admin auth
 */

import * as fs from 'fs';
import * as path from 'path';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const COLLECTION = 'designKnowledgeBase';
const BATCH_SIZE = 500;

interface CompileReport {
  timestamp: Date;
  articlesScanned: number;
  entriesCompiled: number;
  entriesSkipped: number;
  errors: { articlePath: string; error: string }[];
}

interface FrontmatterData {
  id: string;
  title: string;
  category: string;
  tags: string[];
  sources: string[];
  related: string[];
  confidence: string;
  dkbEntryType?: string;
  [key: string]: unknown;
}

/**
 * Parse YAML frontmatter from markdown content.
 * Simple parser that handles the subset of YAML used in wiki articles.
 */
function parseFrontmatter(content: string): { data: FrontmatterData; body: string } | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const yamlStr = match[1];
  const body = match[2];

  // Simple YAML parser for our frontmatter format
  const data: Record<string, unknown> = {};
  let currentKey = '';
  let currentArrayItems: unknown[] | null = null;
  let currentObjectItems: Record<string, unknown> | null = null;

  for (const line of yamlStr.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Array item under current key
    if (trimmed.startsWith('- ') && currentKey) {
      const itemValue = trimmed.slice(2).trim();

      // Check if it's a key: value pair (object in array)
      const kvMatch = itemValue.match(/^(\w+):\s*(.+)$/);
      if (kvMatch && currentArrayItems) {
        // Start or continue object in array
        if (!currentObjectItems) {
          currentObjectItems = {};
        }
        currentObjectItems[kvMatch[1]] = parseYamlValue(kvMatch[2]);
      } else if (currentObjectItems) {
        // Flush previous object
        if (!currentArrayItems) currentArrayItems = [];
        currentArrayItems.push(currentObjectItems);
        currentObjectItems = null;
        // Start new item
        if (kvMatch) {
          currentObjectItems = { [kvMatch[1]]: parseYamlValue(kvMatch[2]) };
        } else {
          currentArrayItems.push(parseYamlValue(itemValue));
        }
      } else {
        if (!currentArrayItems) currentArrayItems = [];
        currentArrayItems.push(parseYamlValue(itemValue));
      }
      continue;
    }

    // Flush any pending array/object
    if (currentKey && currentArrayItems !== null) {
      if (currentObjectItems) {
        currentArrayItems.push(currentObjectItems);
        currentObjectItems = null;
      }
      data[currentKey] = currentArrayItems;
      currentArrayItems = null;
    }

    // Top-level key: value
    const topKvMatch = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (topKvMatch) {
      currentKey = topKvMatch[1];
      const value = topKvMatch[2].trim();

      if (value === '' || value === '|') {
        // Possibly a multi-line value or array follows
        currentArrayItems = null;
        continue;
      }

      // Inline array: [a, b, c]
      if (value.startsWith('[') && value.endsWith(']')) {
        const items = value.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
        data[currentKey] = items;
        currentKey = '';
        continue;
      }

      // Inline object: { min: 300, max: 900, ... }
      if (value.startsWith('{') && value.endsWith('}')) {
        data[currentKey] = parseInlineObject(value);
        currentKey = '';
        continue;
      }

      data[currentKey] = parseYamlValue(value);
      currentArrayItems = null;
    }

    // Nested key under indented block
    if (line.startsWith('  ') && !line.startsWith('  -') && currentKey) {
      const nestedKv = trimmed.match(/^(\w[\w-]*):\s*(.*)/);
      if (nestedKv) {
        const nestedKey = nestedKv[1];
        const nestedValue = nestedKv[2].trim();
        // Treat as sub-object of current key
        if (typeof data[currentKey] !== 'object' || Array.isArray(data[currentKey])) {
          data[currentKey] = {};
        }
        if (nestedValue.startsWith('{') && nestedValue.endsWith('}')) {
          (data[currentKey] as Record<string, unknown>)[nestedKey] = parseInlineObject(nestedValue);
        } else {
          (data[currentKey] as Record<string, unknown>)[nestedKey] = parseYamlValue(nestedValue);
        }
      }
    }
  }

  // Flush final pending
  if (currentKey && currentArrayItems !== null) {
    if (currentObjectItems) {
      currentArrayItems.push(currentObjectItems);
    }
    data[currentKey] = currentArrayItems;
  }

  return { data: data as FrontmatterData, body };
}

function parseYamlValue(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null' || raw === '~') return null;
  const num = Number(raw);
  if (!isNaN(num) && raw.length > 0) return num;
  // Strip quotes
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

function parseInlineObject(raw: string): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  const inner = raw.slice(1, -1).trim();
  const pairs = inner.split(',').map(s => s.trim());
  for (const pair of pairs) {
    const m = pair.match(/^(\w[\w-]*):\s*(.+)$/);
    if (m) {
      obj[m[1]] = parseYamlValue(m[2].trim());
    }
  }
  return obj;
}

/**
 * Extract the Summary section content as the description field.
 */
function extractDescription(body: string): string {
  const summaryMatch = body.match(/##\s+Summary\s*\n([\s\S]*?)(?=\n##|\n*$)/);
  if (summaryMatch) {
    return summaryMatch[1].trim().split('\n')[0]; // First paragraph
  }
  return body.trim().split('\n')[0] || '';
}

/**
 * Transform wiki frontmatter into a Firestore DKB document.
 */
function transformToFirestoreDoc(
  data: FrontmatterData,
  body: string,
  articlePath: string,
): Record<string, unknown> | null {
  if (!data.dkbEntryType) return null; // Skip non-DKB articles

  const now = admin.firestore.FieldValue.serverTimestamp();
  const base = {
    entryType: data.dkbEntryType,
    name: data.title || data.id,
    description: extractDescription(body),
    tags: data.tags || [],
    isActive: true,
    version: 1,
    sourceArticlePath: articlePath,
    lastCompiled: now,
    createdAt: now,
    updatedAt: now,
    createdBy: 'compile-dkb',
  };

  switch (data.dkbEntryType) {
    case 'component':
      return {
        ...base,
        componentCategory: data.dkbComponentCategory || 'panel',
        dimensions: data.dkbDimensions || { width: {}, depth: {}, height: {}, unit: 'mm' },
        materialRequirements: data.dkbMaterialRequirements || [],
        hardwareRequirements: data.dkbHardwareRequirements || [],
        edgeBandingRules: data.dkbEdgeBandingRules || [],
        jointTypes: data.dkbJointTypes || [],
        cadQuerySnippet: extractCadQuerySnippet(body),
      };

    case 'product_archetype':
      return {
        ...base,
        productType: data.dkbProductType || 'cabinetry',
        standardDimensions: data.dkbStandardDimensions || { width: {}, depth: {}, height: {}, unit: 'mm' },
        assemblyPatternId: data.dkbAssemblyPatternId || '',
        defaultFinishCategory: data.dkbDefaultFinishCategory || 'board',
        typicalHardware: data.dkbTypicalHardware || [],
        bomEstimate: data.dkbBomEstimate || [],
        searchTerms: data.tags || [],
        aiPromptContext: extractAiPromptContext(body, data),
        constraints: extractConstraints(body),
      };

    case 'hardware_spec':
      return {
        ...base,
        hardwareFamily: data.dkbHardwareFamily || '',
        inventoryItemId: data.dkbInventoryItemId || '',
        manufacturer: data.dkbManufacturer,
        modelNumber: data.dkbModelNumber,
        boringSpec: data.dkbBoringSpec || { diameter: 5, depth: 12, offsetFromEdge: 37, pattern: 'single' },
        mountingClearances: data.dkbMountingClearances || { top: 0, bottom: 0, side: 0 },
        weightCapacityKg: data.dkbWeightCapacityKg,
        compatibilityRules: data.dkbCompatibilityRules || [],
      };

    case 'material_rule':
      return {
        ...base,
        ruleCategory: data.dkbRuleCategory || 'finish_substrate',
        condition: data.dkbCondition || '',
        compatiblePairs: data.dkbCompatiblePairs || [],
        incompatiblePairs: data.dkbIncompatiblePairs || [],
      };

    case 'dimensional_standard':
      return {
        ...base,
        scope: data.dkbScope || 'dawin',
        standardName: data.dkbStandardName || data.title,
        values: data.dkbValues || {},
        unit: 'mm',
        source: data.dkbSource,
      };

    default:
      return base;
  }
}

function extractCadQuerySnippet(body: string): string | undefined {
  const match = body.match(/```python\n([\s\S]*?)```/);
  return match ? match[1].trim() : undefined;
}

function extractAiPromptContext(body: string, data: FrontmatterData): string {
  const dims = data.dkbStandardDimensions as Record<string, unknown> | undefined;
  const parts: string[] = [];

  if (data.title) parts.push(`Product: ${data.title}`);
  if (dims) {
    const w = dims.width as Record<string, number> | undefined;
    const d = dims.depth as Record<string, number> | undefined;
    const h = dims.height as Record<string, number> | undefined;
    if (w && d && h) {
      parts.push(`Standard dimensions: ${w.default}mm W × ${d.default}mm D × ${h.default}mm H`);
    }
  }

  const summaryMatch = body.match(/##\s+Summary\s*\n([\s\S]*?)(?=\n##|\n*$)/);
  if (summaryMatch) parts.push(summaryMatch[1].trim());

  return parts.join('. ');
}

function extractConstraints(body: string): Array<{ condition: string; action: string; reason: string }> {
  const constraintsSection = body.match(/##\s+Constraints\s*\n([\s\S]*?)(?=\n##|\n*$)/);
  if (!constraintsSection) return [];

  const constraints: Array<{ condition: string; action: string; reason: string }> = [];
  const lines = constraintsSection[1].split('\n');
  let current: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    const m = trimmed.match(/^-?\s*(\w+):\s*"?(.*?)"?\s*$/);
    if (m) {
      current[m[1]] = m[2];
      if (current.condition && current.action && current.reason) {
        constraints.push({
          condition: current.condition,
          action: current.action,
          reason: current.reason,
        });
        current = {};
      }
    }
  }

  return constraints;
}

/**
 * Recursively find all .md files in a directory.
 */
function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Main compile function.
 */
async function compile(): Promise<CompileReport> {
  const wikiDir = path.resolve(__dirname, '../wiki');
  const report: CompileReport = {
    timestamp: new Date(),
    articlesScanned: 0,
    entriesCompiled: 0,
    entriesSkipped: 0,
    errors: [],
  };

  const mdFiles = findMarkdownFiles(wikiDir);
  report.articlesScanned = mdFiles.length;

  console.log(`\n📚 Scanning ${mdFiles.length} wiki articles in ${wikiDir}\n`);

  const docsToWrite: Array<{ id: string; data: Record<string, unknown> }> = [];

  for (const filePath of mdFiles) {
    const relativePath = path.relative(wikiDir, filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseFrontmatter(content);

    if (!parsed) {
      report.errors.push({ articlePath: relativePath, error: 'No valid frontmatter found' });
      continue;
    }

    if (!parsed.data.dkbEntryType) {
      report.entriesSkipped++;
      console.log(`  ⏭  ${relativePath} — no dkbEntryType, skipping`);
      continue;
    }

    try {
      const firestoreDoc = transformToFirestoreDoc(parsed.data, parsed.body, relativePath);
      if (!firestoreDoc) {
        report.entriesSkipped++;
        continue;
      }

      const docId = parsed.data.id || path.basename(filePath, '.md');
      docsToWrite.push({ id: docId, data: firestoreDoc });
      console.log(`  ✅ ${relativePath} → ${parsed.data.dkbEntryType}/${docId}`);
    } catch (err) {
      report.errors.push({
        articlePath: relativePath,
        error: (err as Error).message,
      });
      console.log(`  ❌ ${relativePath} — ${(err as Error).message}`);
    }
  }

  // Write in batches
  console.log(`\n📝 Writing ${docsToWrite.length} entries to Firestore...`);

  for (let i = 0; i < docsToWrite.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = docsToWrite.slice(i, i + BATCH_SIZE);

    for (const { id, data } of chunk) {
      const ref = db.collection(COLLECTION).doc(id);
      batch.set(ref, data, { merge: true });
    }

    await batch.commit();
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} docs written`);
  }

  report.entriesCompiled = docsToWrite.length;

  // Print summary
  console.log('\n' + '═'.repeat(50));
  console.log(`  Scanned:  ${report.articlesScanned}`);
  console.log(`  Compiled: ${report.entriesCompiled}`);
  console.log(`  Skipped:  ${report.entriesSkipped}`);
  console.log(`  Errors:   ${report.errors.length}`);
  console.log('═'.repeat(50) + '\n');

  if (report.errors.length > 0) {
    console.log('Errors:');
    for (const err of report.errors) {
      console.log(`  ${err.articlePath}: ${err.error}`);
    }
  }

  return report;
}

// Run
compile()
  .then((report) => {
    process.exit(report.errors.length > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
