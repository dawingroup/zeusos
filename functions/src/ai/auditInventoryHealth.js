/**
 * Audit Inventory Health Cloud Function
 *
 * Analyses a batch of inventory items to identify data quality issues,
 * potential duplicates, naming inconsistencies, and items needing attention.
 * Uses a two-phase approach: deterministic checks + Claude AI analysis.
 *
 * Enhanced with:
 * - Structured duplicate group detection
 * - Auto-correctable issue generation
 * - Configurable agent instructions
 * - Orphan SKU / phantom stock / unit mismatch detection
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { logger } = require('firebase-functions/v2');
const { createMessageWithRetry, parseJsonFromResponse } = require('../utils/claudeClient');
const { checkRateLimit } = require('../utils/rateLimiter');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const MAX_ITEMS = 150;

const DEFAULT_KNOWN_BRANDS = [
  'plascon', 'sadolin', 'sweco', 'ingco', 'meite', 'blum', 'salice',
  'hafele', 'hettich', 'grass', 'starke', 'dtc-gtv', 'dtc', 'gtv',
  'lp', 'formica', 'titus', 'vauth-sagel', 'kessebohmer', 'pg bison',
  'nile ply', 'fenzi', 'rehau', 'roma', 'elgon',
];

// ============================================
// Helpers
// ============================================

function generateCorrectionId() {
  return 'corr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function generateGroupId() {
  return 'dg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/**
 * Normalise a string for fuzzy comparison: lowercase, trim, collapse whitespace,
 * strip common noise words and punctuation.
 */
function normalise(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Simple token-based similarity (Jaccard index on word tokens).
 */
function tokenSimilarity(a, b) {
  const tokA = new Set(normalise(a).split(' ').filter(Boolean));
  const tokB = new Set(normalise(b).split(' ').filter(Boolean));
  if (tokA.size === 0 && tokB.size === 0) return 1;
  if (tokA.size === 0 || tokB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokA) {
    if (tokB.has(t)) intersection++;
  }
  return intersection / (tokA.size + tokB.size - intersection);
}

// ============================================
// Phase 1: Deterministic Analysis (no AI)
// ============================================

function runDeterministicChecks(items, agentInstructions) {
  const issues = [];
  const corrections = [];

  for (const item of items) {
    // Missing description
    if (!item.description || item.description.trim().length < 5) {
      issues.push({
        itemId: item.id,
        itemName: item.name,
        itemSku: item.sku || '',
        severity: 'warning',
        category: 'incomplete-data',
        message: 'Missing or very short description',
        suggestedAction: 'Add a description covering key properties and manufacturing uses',
        confidence: 1.0,
      });
    }

    // Category set to "other" — likely needs recategorisation
    if (item.category === 'other') {
      issues.push({
        itemId: item.id,
        itemName: item.name,
        itemSku: item.sku || '',
        severity: 'warning',
        category: 'miscategorized',
        message: 'Category is set to "other" — may need proper categorisation',
        suggestedAction: 'Review and assign a specific category (sheet-goods, solid-wood, hardware, etc.)',
        confidence: 0.9,
      });
    }

    // Zero cost for active item
    if (item.status === 'active' && (!item.pricing || !item.pricing.costPerUnit || item.pricing.costPerUnit === 0)) {
      issues.push({
        itemId: item.id,
        itemName: item.name,
        itemSku: item.sku || '',
        severity: 'critical',
        category: 'pricing-concern',
        message: 'Active item has zero or missing cost — affects costing accuracy',
        suggestedAction: 'Set the cost per unit from supplier quotes or purchase history',
        confidence: 1.0,
      });
    }

    // Zero stock for active item
    if (item.status === 'active' && item.inventory && item.inventory.inStock === 0) {
      issues.push({
        itemId: item.id,
        itemName: item.name,
        itemSku: item.sku || '',
        severity: 'warning',
        category: 'low-stock',
        message: 'Active item is out of stock',
        suggestedAction: 'Reorder from supplier or update status to out-of-stock',
        confidence: 1.0,
      });
    }

    // Below reorder level
    if (
      item.status === 'active' &&
      item.inventory &&
      item.inventory.reorderLevel &&
      item.inventory.inStock > 0 &&
      item.inventory.inStock <= item.inventory.reorderLevel
    ) {
      issues.push({
        itemId: item.id,
        itemName: item.name,
        itemSku: item.sku || '',
        severity: 'warning',
        category: 'low-stock',
        message: `Stock (${item.inventory.inStock}) at or below reorder level (${item.inventory.reorderLevel})`,
        suggestedAction: 'Create a purchase order to replenish stock',
        confidence: 1.0,
      });
    }

    // No supplier pricing
    if (!item.supplierPricing || item.supplierPricing.length === 0) {
      issues.push({
        itemId: item.id,
        itemName: item.name,
        itemSku: item.sku || '',
        severity: 'info',
        category: 'incomplete-data',
        message: 'No supplier pricing configured',
        suggestedAction: 'Add at least one supplier with pricing for procurement',
        confidence: 1.0,
      });
    }

    // Sheet goods / solid wood without dimensions
    if (
      (item.category === 'sheet-goods' || item.category === 'solid-wood') &&
      (!item.dimensions || (!item.dimensions.thickness && !item.dimensions.length && !item.dimensions.width))
    ) {
      issues.push({
        itemId: item.id,
        itemName: item.name,
        itemSku: item.sku || '',
        severity: 'warning',
        category: 'incomplete-data',
        message: `${item.category === 'sheet-goods' ? 'Sheet goods' : 'Solid wood'} item missing dimensions`,
        suggestedAction: 'Add thickness, length, and width in millimetres',
        confidence: 1.0,
      });
    }

    // No tags
    if (!item.tags || item.tags.length === 0) {
      issues.push({
        itemId: item.id,
        itemName: item.name,
        itemSku: item.sku || '',
        severity: 'info',
        category: 'incomplete-data',
        message: 'No tags set — reduces searchability',
        suggestedAction: 'Add tags for material type, colour, finish, and use-cases',
        confidence: 1.0,
      });
    }

    // --- New deterministic checks ---

    // Orphan SKU: item references a familyId that doesn't exist in this batch
    if (item.familyId) {
      const parentExists = items.some(i => i.id === item.familyId);
      if (!parentExists) {
        issues.push({
          itemId: item.id,
          itemName: item.name,
          itemSku: item.sku || '',
          severity: 'warning',
          category: 'orphan-sku',
          message: `References family "${item.familyId}" but the parent item was not found`,
          suggestedAction: 'Verify the family parent still exists or clear the familyId reference',
          confidence: 0.95,
        });
      }
    }

    // Phantom stock: discontinued item still has stock
    if (item.status === 'discontinued' && item.inventory && item.inventory.inStock > 0) {
      const correction = {
        id: generateCorrectionId(),
        itemId: item.id,
        itemName: item.name,
        itemSku: item.sku || '',
        type: 'archive-stale',
        severity: 'warning',
        description: `Discontinued item still shows ${item.inventory.inStock} units in stock`,
        field: 'status',
        currentValue: 'discontinued',
        suggestedValue: 'out-of-stock',
        confidence: 0.8,
        source: 'deterministic',
      };
      issues.push({
        itemId: item.id,
        itemName: item.name,
        itemSku: item.sku || '',
        severity: 'warning',
        category: 'phantom-stock',
        message: `Discontinued item still shows ${item.inventory.inStock} units in stock — may be phantom`,
        suggestedAction: 'Verify physical stock count or set to out-of-stock',
        confidence: 0.8,
        correction,
      });
      corrections.push(correction);
    }

    // Missing SKU
    if (!item.sku || item.sku.trim() === '') {
      const correction = {
        id: generateCorrectionId(),
        itemId: item.id,
        itemName: item.name,
        itemSku: '',
        type: 'fix-sku',
        severity: 'critical',
        description: 'Item has no SKU assigned',
        field: 'sku',
        currentValue: null,
        suggestedValue: '(auto-generate)',
        confidence: 1.0,
        source: 'deterministic',
      };
      issues.push({
        itemId: item.id,
        itemName: item.name,
        itemSku: '',
        severity: 'critical',
        category: 'incomplete-data',
        message: 'Item has no SKU assigned — required for transactions',
        suggestedAction: 'Generate a SKU using the smart SKU generator',
        confidence: 1.0,
        correction,
      });
      corrections.push(correction);
    }

    // Missing aliases for items with known abbreviations in name
    if (item.name && (!item.aliases || item.aliases.length === 0)) {
      const nameNorm = normalise(item.name);
      const hasAbbrev = /\b(mdf|hdf|plyw?|hdw|pvc|abs|ss|ms)\b/.test(nameNorm);
      if (hasAbbrev) {
        issues.push({
          itemId: item.id,
          itemName: item.name,
          itemSku: item.sku || '',
          severity: 'info',
          category: 'naming-inconsistency',
          message: 'Item name contains abbreviations but has no aliases for searchability',
          suggestedAction: 'Add full-form aliases (e.g., MDF → Medium Density Fibreboard)',
          confidence: 0.75,
        });
      }
    }

    // --- Brand-in-title detection ---
    const knownBrands = (agentInstructions?.knownBrands && agentInstructions.knownBrands.length > 0)
      ? agentInstructions.knownBrands.map(b => b.toLowerCase().trim())
      : DEFAULT_KNOWN_BRANDS;

    if (item.name) {
      const nameTokens = item.name.split(/[\s\-—]+/).map(t => t.toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean);
      // Check first 1-2 tokens for a brand match (brands are typically prefixes)
      const firstTwoTokens = nameTokens.slice(0, 2).join(' ');
      const matchedBrand = knownBrands.find(brand => {
        const brandTokens = brand.split(/\s+/);
        if (brandTokens.length === 1) {
          return nameTokens[0] === brand;
        }
        // Multi-word brand: check if first N tokens match
        return firstTwoTokens.startsWith(brand);
      });

      if (matchedBrand) {
        const brandProper = item.name.split(/[\s\-—]+/).slice(0, matchedBrand.split(/\s+/).length).join(' ');
        const cleanedName = item.name.replace(new RegExp('^' + brandProper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\-—]*', 'i'), '').trim();
        const groupId = 'bg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);

        if (cleanedName && cleanedName !== item.name) {
          // Correction 1: Clean the name
          const corrName = {
            id: generateCorrectionId(),
            itemId: item.id,
            itemName: item.name,
            itemSku: item.sku || '',
            type: 'extract-brand',
            severity: 'warning',
            description: `Remove brand "${brandProper}" from item name`,
            field: 'name',
            currentValue: item.name,
            suggestedValue: cleanedName,
            confidence: 0.9,
            source: 'deterministic',
            correctionGroup: groupId,
          };
          // Correction 2: Set the brand field
          const corrBrand = {
            id: generateCorrectionId(),
            itemId: item.id,
            itemName: item.name,
            itemSku: item.sku || '',
            type: 'extract-brand',
            severity: 'warning',
            description: `Set brand field to "${brandProper}"`,
            field: 'brand',
            currentValue: item.brand || null,
            suggestedValue: brandProper,
            confidence: 0.9,
            source: 'deterministic',
            correctionGroup: groupId,
          };
          // Correction 3: Update displayName
          const corrDisplay = {
            id: generateCorrectionId(),
            itemId: item.id,
            itemName: item.name,
            itemSku: item.sku || '',
            type: 'extract-brand',
            severity: 'warning',
            description: `Set functional display name without brand`,
            field: 'displayName',
            currentValue: item.displayName || item.name,
            suggestedValue: cleanedName,
            confidence: 0.85,
            source: 'deterministic',
            correctionGroup: groupId,
          };

          corrections.push(corrName, corrBrand, corrDisplay);
          issues.push({
            itemId: item.id,
            itemName: item.name,
            itemSku: item.sku || '',
            severity: 'warning',
            category: 'brand-in-title',
            message: `Brand "${brandProper}" is embedded in the item name — should be in the brand field`,
            suggestedAction: `Rename to "${cleanedName}" and set brand to "${brandProper}"`,
            confidence: 0.9,
            correction: corrName,
          });
        }
      }
    }

    // --- Missing structuredName for categorisable items ---
    const structurableCategories = ['hardware', 'edge-banding', 'finishing', 'adhesives', 'fasteners'];
    if (
      structurableCategories.includes(item.category) &&
      (!item.structuredName || !item.structuredName.function)
    ) {
      issues.push({
        itemId: item.id,
        itemName: item.name,
        itemSku: item.sku || '',
        severity: 'info',
        category: 'missing-structured-name',
        message: 'Missing structured name fields — reduces matching quality for PO alternatives and BOM substitution',
        suggestedAction: 'Run AI enhancement to populate function, keySpecs, and qualityTier fields',
        confidence: 0.95,
      });
    }

    // --- Missing displayName ---
    if (!item.displayName || item.displayName === item.name) {
      issues.push({
        itemId: item.id,
        itemName: item.name,
        itemSku: item.sku || '',
        severity: 'info',
        category: 'incomplete-data',
        message: 'No functional display name set — item shows raw name instead of structured functional name',
        suggestedAction: 'Run AI enhancement to generate a clean functional display name',
        confidence: 0.8,
      });
    }
  }

  // --- Family candidate detection (flat items that could be grouped) ---
  const familyCandidateGroups = [];
  const flatItems = items.filter(i => !i.familyId && !i.isFamily);
  const catGroups = {};
  for (const fi of flatItems) {
    const key = `${fi.category}:${fi.subcategory || ''}`;
    if (!catGroups[key]) catGroups[key] = [];
    catGroups[key].push(fi);
  }

  for (const [, group] of Object.entries(catGroups)) {
    if (group.length < 2) continue;
    // Find pairs with moderate similarity (potential family members, not duplicates)
    const familyBucket = [];
    const seen = new Set();
    for (let i = 0; i < group.length; i++) {
      if (seen.has(group[i].id)) continue;
      const cluster = [group[i]];
      for (let j = i + 1; j < group.length; j++) {
        if (seen.has(group[j].id)) continue;
        const sim = tokenSimilarity(group[i].name, group[j].name);
        // Moderate similarity: likely same function, different variant/brand
        if (sim >= 0.4 && sim < 0.8) {
          cluster.push(group[j]);
          seen.add(group[j].id);
        }
      }
      if (cluster.length >= 2) {
        seen.add(group[i].id);
        familyBucket.push(cluster);
      }
    }
    familyCandidateGroups.push(...familyBucket);
  }

  // Emit family candidate recommendations
  const familyRecommendations = familyCandidateGroups.map(cluster => ({
    priority: 'medium',
    title: `Group ${cluster.length} items into a family`,
    description: `These items may serve the same function and could be grouped: ${cluster.map(c => `"${c.name}"`).join(', ')}`,
    affectedItemIds: cluster.map(c => c.id),
    actionType: 'create-family',
  }));

  // Also emit issues for family candidates
  for (const cluster of familyCandidateGroups) {
    for (const member of cluster) {
      issues.push({
        itemId: member.id,
        itemName: member.name,
        itemSku: member.sku || '',
        severity: 'info',
        category: 'family-candidate',
        message: `Could be grouped into a product family with ${cluster.length - 1} similar item(s)`,
        suggestedAction: 'Review and create a product family to improve PO alternatives and BOM matching',
        relatedItemIds: cluster.filter(c => c.id !== member.id).map(c => c.id),
        confidence: 0.6,
      });
    }
  }

  // --- Deterministic duplicate detection (exact + fuzzy name matching) ---
  const duplicateGroups = [];
  const visited = new Set();

  for (let i = 0; i < items.length; i++) {
    if (visited.has(items[i].id)) continue;
    const group = [items[i]];

    for (let j = i + 1; j < items.length; j++) {
      if (visited.has(items[j].id)) continue;

      const normA = normalise(items[i].name);
      const normB = normalise(items[j].name);

      // Exact normalised name match
      if (normA === normB && normA.length > 2) {
        group.push(items[j]);
        visited.add(items[j].id);
        continue;
      }

      // Same MPN across vendor sources
      if (items[i].vendorSources && items[j].vendorSources) {
        const mpnsA = items[i].vendorSources.map(v => v.mpn?.toLowerCase()).filter(Boolean);
        const mpnsB = items[j].vendorSources.map(v => v.mpn?.toLowerCase()).filter(Boolean);
        const sharedMpn = mpnsA.some(m => mpnsB.includes(m));
        if (sharedMpn) {
          group.push(items[j]);
          visited.add(items[j].id);
          continue;
        }
      }

      // High token similarity (>= 0.8) in same category
      if (items[i].category === items[j].category) {
        const sim = tokenSimilarity(items[i].name, items[j].name);
        if (sim >= 0.8) {
          group.push(items[j]);
          visited.add(items[j].id);
        }
      }
    }

    if (group.length > 1) {
      visited.add(items[i].id);
      const primary = group[0];
      duplicateGroups.push({
        id: generateGroupId(),
        confidence: group.length === 2 && normalise(group[0].name) === normalise(group[1].name) ? 0.95 : 0.75,
        duplicateType: normalise(group[0].name) === normalise(group[1]?.name) ? 'exact-name' : 'fuzzy-name',
        primaryItemId: primary.id,
        candidates: group.map(g => ({
          itemId: g.id,
          itemName: g.name,
          itemSku: g.sku || '',
          category: g.category,
          subcategory: g.subcategory || '',
          matchReason: g.id === primary.id ? 'Primary item' : 'Name similarity or shared MPN',
        })),
        summary: `${group.length} items appear to be the same product: "${primary.name}"`,
        suggestedResolution: group.length === 2 ? 'merge' : 'review',
      });

      // Add issues for each duplicate
      for (const g of group) {
        if (g.id === primary.id) continue;
        issues.push({
          itemId: g.id,
          itemName: g.name,
          itemSku: g.sku || '',
          severity: 'warning',
          category: 'potential-duplicate',
          message: `May be a duplicate of "${primary.name}" (${primary.sku || 'no SKU'})`,
          suggestedAction: 'Review and merge or add as alias',
          relatedItemIds: [primary.id],
          confidence: 0.8,
        });
      }
    }
  }

  return { issues, corrections, duplicateGroups, familyRecommendations };
}

// ============================================
// Phase 2: Claude AI Analysis
// ============================================

function buildSystemPrompt(agentInstructions) {
  let prompt = `You are an inventory data analyst for DawinOS, an ERP system used by a premium furniture manufacturing and interior design company in East Africa.

You perform thorough inventory audits. Your analysis must identify:

1. POTENTIAL DUPLICATES: Items that appear to be the same product with different names, SKUs, or slight variations. Group them with a confidence score. Look for:
   - Similar names with spelling differences or abbreviation variations
   - Same material type with minor naming differences
   - Different names for the same product
   - Items that share a manufacturer part number (MPN)

2. NAMING INCONSISTENCIES: Items where naming patterns are inconsistent:
   - Inconsistent use of "mm" vs spelling out "millimetre"
   - Mixed capitalisation styles
   - Abbreviation vs full-form mixing
   - Missing brand prefixes/suffixes when others have them

3. MISCATEGORISED ITEMS: Items in the wrong category based on their name and properties.

4. CORRECTABLE ISSUES: For each issue you find, generate a specific correction action if possible:
   - Field name, current value, suggested value, confidence (0-1)
   - Types: field-update, recategorize, fix-sku, fix-unit, fill-missing, standardize-name, archive-stale

5. POORLY DEFINED ITEMS: Items that are vague, ambiguous, or lack specificity:
   - Generic names like "Material", "Item", "Part" without qualification
   - Missing key distinguishing attributes (thickness, grade, finish)
   - Descriptions that don't differentiate from similar items

6. BRAND-IN-TITLE: Detect brand names embedded in item titles (e.g., "Plascon NC Furniture Lacquer"). When found:
   - Generate extract-brand corrections: one for name (remove brand), one for brand (set brand field), one for displayName (functional name)
   - Link these corrections with a shared correctionGroup ID
   - The functional name should describe what the item IS, not who makes it

7. FAMILY GROUPING CANDIDATES: Identify flat items (no familyId, not isFamily) that serve the same function but differ by brand, size, or quality tier. These should be grouped into product families. Suggest create-family in recommendations.

8. STRUCTURED NAME BACKFILL: For items missing structuredName fields, suggest:
   - function: core functional purpose (e.g., "Full Overlay Hinge", "NC Furniture Lacquer")
   - keySpecs: distinguishing specifications (e.g., "110° Soft-Close", "5L Gloss")
   - qualityTier: "Premium" | "Standard" | "Economy" (if determinable from price/brand context)
   - Generate populate-structured-name corrections with field "structuredName.function", "structuredName.keySpecs", etc.

VALID CATEGORIES: sheet-goods | solid-wood | hardware | edge-banding | finishing | adhesives | fasteners | other`;

  // Inject agent instructions if provided
  if (agentInstructions) {
    if (agentInstructions.customContext) {
      prompt += `\n\nADDITIONAL CONTEXT FROM ADMINISTRATOR:\n${agentInstructions.customContext}`;
    }

    if (agentInstructions.namingRules) {
      const nr = agentInstructions.namingRules;
      prompt += `\n\nNAMING CONVENTIONS TO ENFORCE:`;
      prompt += `\n- Capitalisation: ${nr.capitalisation}`;
      prompt += `\n- Abbreviation style: ${nr.abbreviationStyle}`;
      prompt += `\n- Include brand in name: ${nr.includeBrandInName ? 'yes' : 'no'}`;
      prompt += `\n- Name separator: "${nr.nameSeparator}"`;
      if (nr.prefixSuffix) {
        prompt += `\n- Prefix/suffix conventions: ${nr.prefixSuffix}`;
      }
    }

    if (agentInstructions.categoryGuidance) {
      prompt += `\n\nCATEGORY GUIDANCE:\n${agentInstructions.categoryGuidance}`;
    }

    if (agentInstructions.knownAliases && agentInstructions.knownAliases.length > 0) {
      prompt += `\n\nKNOWN ALIASES (do NOT flag as duplicates):`;
      for (const alias of agentInstructions.knownAliases) {
        prompt += `\n- "${alias.primary}" aliases: [${alias.aliases.join(', ')}] — ${alias.reason}`;
      }
    }

    if (agentInstructions.severityOverrides && agentInstructions.severityOverrides.length > 0) {
      prompt += `\n\nSEVERITY OVERRIDES:`;
      for (const so of agentInstructions.severityOverrides) {
        prompt += `\n- ${so.category}: set severity to ${so.severity}${so.condition ? ` (when: ${so.condition})` : ''}`;
      }
    }

    if (agentInstructions.additionalRules && agentInstructions.additionalRules.length > 0) {
      prompt += `\n\nADDITIONAL RULES:`;
      for (const rule of agentInstructions.additionalRules) {
        prompt += `\n- ${rule}`;
      }
    }

    if (agentInstructions.knownBrands && agentInstructions.knownBrands.length > 0) {
      prompt += `\n\nKNOWN BRANDS (check these in item titles for extraction):\n${agentInstructions.knownBrands.join(', ')}`;
    }
  }

  prompt += `\n\nReturn ONLY valid JSON — no markdown, no explanation outside the JSON.`;

  return prompt;
}

function buildAuditUserMessage(items) {
  const itemTable = items
    .map(i => {
      const price = i.pricing ? `${i.pricing.costPerUnit || 0} ${i.pricing.currency || 'UGX'}/${i.pricing.unit || 'ea'}` : 'no price';
      const aliases = i.aliases && i.aliases.length > 0 ? i.aliases.join('; ') : '-';
      const dims = i.dimensions ? `${i.dimensions.length || '-'}x${i.dimensions.width || '-'}x${i.dimensions.thickness || '-'}mm` : '-';
      const family = i.isFamily ? 'PARENT' : (i.familyId ? `child:${i.familyId.slice(0, 8)}` : 'flat');
      const sn = i.structuredName
        ? `fn:${i.structuredName.function || '-'} specs:${i.structuredName.keySpecs || '-'} tier:${i.structuredName.qualityTier || '-'}`
        : '-';
      return `| ${i.id} | ${i.sku || '-'} | ${i.name} | ${i.displayName || '-'} | ${i.category} | ${i.subcategory || '-'} | ${i.brand || '-'} | ${price} | ${dims} | ${aliases} | ${family} | ${sn} |`;
    })
    .join('\n');

  return `## Inventory Items (${items.length} total)

| ID | SKU | Name | DisplayName | Category | Subcategory | Brand | Price | Dimensions | Aliases | Family | StructuredName |
|----|-----|------|-------------|----------|-------------|-------|-------|------------|---------|--------|----------------|
${itemTable}

## Required Response Format
{
  "aiIssues": [
    {
      "itemId": "item-id",
      "itemName": "item name",
      "itemSku": "SKU",
      "severity": "critical|warning|info",
      "category": "potential-duplicate|naming-inconsistency|miscategorized|incomplete-data|unit-mismatch|orphan-sku|brand-in-title|missing-structured-name|family-candidate",
      "message": "Description of the issue",
      "suggestedAction": "What to do about it",
      "relatedItemIds": ["other-item-id"],
      "confidence": 0.85,
      "correction": {
        "id": "corr_unique",
        "itemId": "item-id",
        "itemName": "item name",
        "itemSku": "SKU",
        "type": "field-update|recategorize|fix-sku|fix-unit|fill-missing|standardize-name|archive-stale|extract-brand|populate-structured-name",
        "severity": "warning",
        "description": "What this correction does",
        "field": "fieldName (use dot notation for nested: structuredName.function)",
        "currentValue": "current",
        "suggestedValue": "suggested",
        "confidence": 0.85,
        "source": "ai",
        "correctionGroup": "optional group ID for related corrections"
      }
    }
  ],
  "duplicateGroups": [
    {
      "id": "dg_unique",
      "confidence": 0.9,
      "duplicateType": "exact-name|fuzzy-name|same-mpn|same-specs|sku-variant",
      "primaryItemId": "best-item-id",
      "candidates": [
        {
          "itemId": "item-id",
          "itemName": "name",
          "itemSku": "SKU",
          "category": "category",
          "subcategory": "sub",
          "matchReason": "why this is a duplicate"
        }
      ],
      "summary": "Explanation of this duplicate group",
      "suggestedResolution": "merge|create-family|alias|review"
    }
  ],
  "corrections": [
    {
      "id": "corr_unique",
      "itemId": "item-id",
      "itemName": "item name",
      "itemSku": "SKU",
      "type": "standardize-name|extract-brand|populate-structured-name",
      "severity": "info",
      "description": "What needs fixing",
      "field": "name (or structuredName.function, structuredName.keySpecs, etc.)",
      "currentValue": "current value",
      "suggestedValue": "Corrected Value",
      "confidence": 0.9,
      "source": "ai",
      "correctionGroup": "optional group ID"
    }
  ],
  "recommendations": [
    {
      "priority": "high|medium|low",
      "title": "Short title",
      "description": "What to do and why",
      "affectedItemIds": ["id1", "id2"],
      "actionType": "enhance|merge|recategorize|update-pricing|restock|correct|archive|create-family|extract-brands"
    }
  ],
  "aiNotes": "Summary of overall inventory health observations"
}`;
}

// ============================================
// Cloud Function
// ============================================

exports.auditInventoryHealth = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    cors: true,
    timeoutSeconds: 300,
    memory: '2GiB',
    maxInstances: 5,
  },
  async (request) => {
    // Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const userId = request.auth.uid;
    const { items, options } = request.data;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new HttpsError('invalid-argument', 'Items array is required and must not be empty');
    }

    // Rate limit
    const rateResult = await checkRateLimit(userId, 'audit', db);
    if (!rateResult.allowed) {
      throw new HttpsError(
        'resource-exhausted',
        `Rate limit exceeded. ${rateResult.remaining} requests remaining.`
      );
    }

    const apiKey = ANTHROPIC_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'ANTHROPIC_API_KEY not configured');
    }

    // Cap items
    const cappedItems = items.slice(0, MAX_ITEMS);
    const agentInstructions = options?.agentInstructions || null;

    try {
      logger.info(`Auditing inventory health: ${cappedItems.length} items for user ${userId}`);

      // Phase 1: Deterministic checks
      const deterministicResult = runDeterministicChecks(cappedItems, agentInstructions);
      logger.info(
        `Phase 1 found ${deterministicResult.issues.length} issues, ` +
        `${deterministicResult.corrections.length} corrections, ` +
        `${deterministicResult.duplicateGroups.length} duplicate groups`
      );

      // Phase 2: AI analysis
      const systemPrompt = buildSystemPrompt(agentInstructions);
      const userMessage = buildAuditUserMessage(cappedItems);

      let aiIssues = [];
      let aiDuplicateGroups = [];
      let aiCorrections = [];
      let aiRecommendations = [];
      let aiNotes = '';
      let aiParseError = null;

      try {
        const responseText = await createMessageWithRetry(apiKey, 'standard', systemPrompt, userMessage, 2);
        const parsed = parseJsonFromResponse(responseText);

        if (parsed) {
          aiIssues = (parsed.aiIssues || []).map(issue => ({
            ...issue,
            itemSku: issue.itemSku || '',
          }));
          aiDuplicateGroups = parsed.duplicateGroups || [];
          aiCorrections = (parsed.corrections || []).map(c => ({
            ...c,
            source: 'ai',
          }));
          aiRecommendations = parsed.recommendations || [];
          aiNotes = parsed.aiNotes || '';
        }
      } catch (aiErr) {
        logger.warn('Phase 2 AI analysis failed, returning deterministic results only:', aiErr.message);
        aiParseError = aiErr.message;
      }

      // Merge deterministic + AI results
      const severityOrder = { critical: 0, warning: 1, info: 2 };

      // Merge issues
      const allIssues = [...deterministicResult.issues, ...aiIssues].sort(
        (a, b) => (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2)
      );

      // Merge duplicate groups — deduplicate by checking primary item overlap
      const seenPrimaryIds = new Set(deterministicResult.duplicateGroups.map(g => g.primaryItemId));
      const mergedDuplicateGroups = [
        ...deterministicResult.duplicateGroups,
        ...aiDuplicateGroups.filter(g => !seenPrimaryIds.has(g.primaryItemId)),
      ];

      // Merge corrections — deduplicate by itemId + field
      const seenCorrectionKeys = new Set(
        deterministicResult.corrections.map(c => `${c.itemId}:${c.field}`)
      );
      const mergedCorrections = [
        ...deterministicResult.corrections,
        ...aiCorrections.filter(c => !seenCorrectionKeys.has(`${c.itemId}:${c.field}`)),
      ];

      // Apply severity overrides from agent instructions
      if (agentInstructions?.severityOverrides) {
        for (const override of agentInstructions.severityOverrides) {
          if (override.severity === 'ignore') {
            // Remove issues of this category
            const idx = allIssues.length;
            for (let i = idx - 1; i >= 0; i--) {
              if (allIssues[i].category === override.category) {
                allIssues.splice(i, 1);
              }
            }
          } else {
            // Override severity
            for (const issue of allIssues) {
              if (issue.category === override.category) {
                issue.severity = override.severity;
              }
            }
          }
        }
        // Re-sort after overrides
        allIssues.sort(
          (a, b) => (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2)
        );
      }

      // Build summary
      const summary = {
        totalItems: cappedItems.length,
        itemsWithIssues: new Set(allIssues.map(i => i.itemId)).size,
        criticalCount: allIssues.filter(i => i.severity === 'critical').length,
        warningCount: allIssues.filter(i => i.severity === 'warning').length,
        infoCount: allIssues.filter(i => i.severity === 'info').length,
        duplicateGroupCount: mergedDuplicateGroups.length,
        correctableCount: mergedCorrections.length,
      };

      logger.info(
        `Audit complete: ${summary.itemsWithIssues} items with issues ` +
        `(${summary.criticalCount} critical, ${summary.warningCount} warnings, ${summary.infoCount} info), ` +
        `${summary.duplicateGroupCount} duplicate groups, ${summary.correctableCount} corrections`
      );

      return {
        success: true,
        audit: {
          summary,
          issues: allIssues,
          recommendations: [...(deterministicResult.familyRecommendations || []), ...aiRecommendations],
          duplicateGroups: mergedDuplicateGroups,
          corrections: mergedCorrections,
          aiNotes,
          ...(aiParseError ? { aiParseError } : {}),
        },
      };
    } catch (err) {
      logger.error('Inventory audit failed:', err);
      throw new HttpsError('internal', `Inventory audit failed: ${err.message}`);
    }
  }
);
