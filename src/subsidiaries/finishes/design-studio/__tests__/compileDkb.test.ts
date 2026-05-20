/**
 * compile-dkb Compiler Tests
 *
 * Tests the wiki frontmatter parsing and transformation logic
 * that powers the compile-dkb.ts tool. These tests validate
 * the pure functions without hitting Firestore.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ── Inline parser functions (extracted from compile-dkb.ts for testability) ──

function parseYamlValue(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null' || raw === '~') return null;
  const num = Number(raw);
  if (!isNaN(num) && raw.length > 0) return num;
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

interface FrontmatterData {
  id?: string;
  title?: string;
  category?: string;
  tags?: string[];
  dkbEntryType?: string;
  [key: string]: unknown;
}

function parseFrontmatter(content: string): { data: FrontmatterData; body: string } | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const yamlStr = match[1];
  const body = match[2];

  const data: Record<string, unknown> = {};
  let currentKey = '';
  let currentArrayItems: unknown[] | null = null;
  let currentObjectItems: Record<string, unknown> | null = null;

  for (const line of yamlStr.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('- ') && currentKey) {
      const itemValue = trimmed.slice(2).trim();
      const kvMatch = itemValue.match(/^(\w+):\s*(.+)$/);
      if (kvMatch && currentArrayItems) {
        if (!currentObjectItems) {
          currentObjectItems = {};
        }
        currentObjectItems[kvMatch[1]] = parseYamlValue(kvMatch[2]);
      } else if (currentObjectItems) {
        if (!currentArrayItems) currentArrayItems = [];
        currentArrayItems.push(currentObjectItems);
        currentObjectItems = null;
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

    if (currentKey && currentArrayItems !== null) {
      if (currentObjectItems) {
        currentArrayItems.push(currentObjectItems);
        currentObjectItems = null;
      }
      data[currentKey] = currentArrayItems;
      currentArrayItems = null;
    }

    const topKvMatch = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (topKvMatch) {
      currentKey = topKvMatch[1];
      const value = topKvMatch[2].trim();

      if (value === '' || value === '|') {
        currentArrayItems = null;
        continue;
      }

      if (value.startsWith('[') && value.endsWith(']')) {
        const items = value.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
        data[currentKey] = items;
        currentKey = '';
        continue;
      }

      if (value.startsWith('{') && value.endsWith('}')) {
        data[currentKey] = parseInlineObject(value);
        currentKey = '';
        continue;
      }

      data[currentKey] = parseYamlValue(value);
      currentArrayItems = null;
    }

    if (line.startsWith('  ') && !line.startsWith('  -') && currentKey) {
      const nestedKv = trimmed.match(/^(\w[\w-]*):\s*(.*)/);
      if (nestedKv) {
        const nestedKey = nestedKv[1];
        const nestedValue = nestedKv[2].trim();
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

  if (currentKey && currentArrayItems !== null) {
    if (currentObjectItems) {
      currentArrayItems.push(currentObjectItems);
    }
    data[currentKey] = currentArrayItems;
  }

  return { data: data as FrontmatterData, body };
}

function extractDescription(body: string): string {
  const summaryMatch = body.match(/##\s+Summary\s*\n([\s\S]*?)(?=\n##|\n*$)/);
  if (summaryMatch) {
    return summaryMatch[1].trim().split('\n')[0];
  }
  return body.trim().split('\n')[0] || '';
}

function extractCadQuerySnippet(body: string): string | undefined {
  const match = body.match(/```python\n([\s\S]*?)```/);
  return match ? match[1].trim() : undefined;
}

// ── Tests ──

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const VALID_DIR = path.join(FIXTURES_DIR, 'test-wiki-articles');
const INVALID_DIR = path.join(FIXTURES_DIR, 'test-wiki-invalid');

describe('compile-dkb', () => {
  describe('parseFrontmatter', () => {
    it('parses a valid component article', () => {
      const content = fs.readFileSync(path.join(VALID_DIR, 'test-component.md'), 'utf-8');
      const result = parseFrontmatter(content);

      expect(result).not.toBeNull();
      expect(result!.data.id).toBe('test-side-panel');
      expect(result!.data.title).toBe('Test Side Panel');
      expect(result!.data.dkbEntryType).toBe('component');
      expect(result!.data.dkbComponentCategory).toBe('panel');
      expect(result!.data.tags).toContain('panel');
    });

    it('parses a valid archetype article', () => {
      const content = fs.readFileSync(path.join(VALID_DIR, 'test-archetype.md'), 'utf-8');
      const result = parseFrontmatter(content);

      expect(result).not.toBeNull();
      expect(result!.data.id).toBe('test-base-600');
      expect(result!.data.dkbEntryType).toBe('product_archetype');
      expect(result!.data.dkbProductType).toBe('cabinetry');
      expect(result!.data.dkbAssemblyPatternId).toBe('kitchen-base-pattern');
    });

    it('parses a valid hardware spec article', () => {
      const content = fs.readFileSync(path.join(VALID_DIR, 'test-hardware.md'), 'utf-8');
      const result = parseFrontmatter(content);

      expect(result).not.toBeNull();
      expect(result!.data.id).toBe('test-hinge-clip');
      expect(result!.data.dkbEntryType).toBe('hardware_spec');
      expect(result!.data.dkbHardwareFamily).toBe('hinge');
      expect(result!.data.dkbInventoryItemId).toBe('INV-HINGE-001');
    });

    it('parses inline objects (boring spec, dimension ranges)', () => {
      const content = fs.readFileSync(path.join(VALID_DIR, 'test-hardware.md'), 'utf-8');
      const result = parseFrontmatter(content);
      const boringSpec = result!.data.dkbBoringSpec as Record<string, unknown>;

      expect(boringSpec).toBeDefined();
      expect(boringSpec.diameter).toBe(35);
      expect(boringSpec.depth).toBe(13);
      expect(boringSpec.pattern).toBe('single');
    });

    it('returns null for content without frontmatter', () => {
      const result = parseFrontmatter('# No frontmatter here\n\nJust content.');
      expect(result).toBeNull();
    });
  });

  describe('extractDescription', () => {
    it('extracts Summary section as description', () => {
      const body = '\n## Summary\n\nSide panel component used in carcass construction.\n\n## Details\n\nMore info.';
      const desc = extractDescription(body);
      expect(desc).toBe('Side panel component used in carcass construction.');
    });

    it('falls back to first line when no Summary section', () => {
      const body = 'A simple description without sections.';
      const desc = extractDescription(body);
      expect(desc).toBe('A simple description without sections.');
    });

    it('returns empty string for empty body', () => {
      expect(extractDescription('')).toBe('');
    });
  });

  describe('extractCadQuerySnippet', () => {
    it('extracts python code block from article body', () => {
      const content = fs.readFileSync(path.join(VALID_DIR, 'test-component.md'), 'utf-8');
      const result = parseFrontmatter(content);
      const snippet = extractCadQuerySnippet(result!.body);

      expect(snippet).toBeDefined();
      expect(snippet).toContain('cq.Workplane');
    });

    it('returns undefined when no python block exists', () => {
      const snippet = extractCadQuerySnippet('## Summary\n\nNo code here.');
      expect(snippet).toBeUndefined();
    });
  });

  describe('article without dkbEntryType is skipped', () => {
    it('articles without dkbEntryType have no entry type', () => {
      const content = `---
id: reference-only
title: Reference Article
category: reference/materials
tags: [reference]
sources: []
related: []
confidence: high
---

## Summary

This article has no dkbEntryType and should not compile to Firestore.
`;
      const result = parseFrontmatter(content);
      expect(result).not.toBeNull();
      expect(result!.data.dkbEntryType).toBeUndefined();
    });
  });

  describe('invalid articles', () => {
    it('missing-required-field article has no dkbDimensions', () => {
      const content = fs.readFileSync(path.join(INVALID_DIR, 'missing-required-field.md'), 'utf-8');
      const result = parseFrontmatter(content);

      expect(result).not.toBeNull();
      expect(result!.data.dkbEntryType).toBe('component');
      // dkbDimensions is missing — a validator should catch this
      expect(result!.data.dkbDimensions).toBeUndefined();
    });

    it('bad-dimension-range article has min > max', () => {
      const content = fs.readFileSync(path.join(INVALID_DIR, 'bad-dimension-range.md'), 'utf-8');
      const result = parseFrontmatter(content);

      expect(result).not.toBeNull();
      const dims = result!.data.dkbDimensions as Record<string, Record<string, number>>;
      expect(dims).toBeDefined();
      // Width min (900) > max (100) — invalid
      expect(dims.width.min).toBeGreaterThan(dims.width.max);
    });

    it('draft confidence article still parses', () => {
      const content = fs.readFileSync(path.join(INVALID_DIR, 'bad-dimension-range.md'), 'utf-8');
      const result = parseFrontmatter(content);

      expect(result).not.toBeNull();
      expect(result!.data.confidence).toBe('draft');
    });
  });
});
