import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  queryCollection,
  getDocument,
  getDb,
  formatCurrency,
  formatTimestamp,
  truncateIfNeeded,
  serverTimestamp,
} from '../services/firebase.js';
import type { QueryFilter } from '../services/firebase.js';
import { MATFLOW_PATHS, MAX_PAGE_SIZE } from '../constants.js';

const FORMULA_CATEGORIES = [
  'CONCRETE',
  'STEEL',
  'MASONRY',
  'TIMBER',
  'ROOFING',
  'PLUMBING',
  'ELECTRICAL',
  'FINISHES',
  'DOORS_WINDOWS',
  'HARDWARE',
  'AGGREGATES',
  'EARTHWORKS',
  'OTHER',
] as const;

interface FormulaComponent {
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  wastagePercent: number;
}

interface Formula {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  outputUnit: string;
  components: FormulaComponent[];
  laborFormula?: string;
  materialFormula?: string;
  equipmentFormula?: string;
  defaultLaborRate?: number;
  defaultMaterialRate?: number;
  defaultEquipmentRate?: number;
  keywords?: string[];
  usageCount: number;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export function registerMatflowTools(server: McpServer): void {

  // ─── dawinos_list_formulas ────────────────────────────────────────────────────
  server.registerTool('dawinos_list_formulas', {
    title: 'List Construction Formulas',
    description: `List construction formulas from the MatFlow formula library — Dawin Advisory's AAQS-standard material calculation library for infrastructure delivery.

Each formula defines the material components (with quantities and wastage) required to produce one unit of a construction output (e.g. 1m³ of C25 concrete, 1m² of 230mm brick wall).

Categories: CONCRETE, STEEL, MASONRY, TIMBER, ROOFING, PLUMBING, ELECTRICAL, FINISHES, DOORS_WINDOWS, HARDWARE, AGGREGATES, EARTHWORKS, OTHER`,
    inputSchema: {
      category: z.enum(FORMULA_CATEGORIES).optional()
        .describe('Filter by material category'),
      limit: z.number().int().min(1).max(MAX_PAGE_SIZE).optional()
        .describe('Max results (default: 50)'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const filters: QueryFilter[] = [
        { field: 'isActive', op: '==', value: true },
      ];
      if (params.category) {
        filters.push({ field: 'category', op: '==', value: params.category });
      }

      const { items, total } = await queryCollection<Formula>(MATFLOW_PATHS.formulas, {
        filters,
        orderByField: 'category',
        orderByDirection: 'asc',
        limit: params.limit ?? 50,
      });

      if (!items.length) {
        return { content: [{ type: 'text' as const, text: 'No formulas found.' }] };
      }

      const lines = [
        `**MatFlow Formula Library** (${items.length} of ${total})${params.category ? ` — ${params.category}` : ''}`,
        '',
        '| Code | Name | Category | Output Unit | Components |',
        '|------|------|----------|-------------|------------|',
      ];

      for (const f of items) {
        lines.push(
          `| ${f.code ?? '—'} | ${f.name} | ${f.category} | ${f.outputUnit} | ${f.components?.length ?? 0} |`
        );
      }

      lines.push('', `_Use \`dawinos_get_formula\` with a code to see full component details._`);
      lines.push(`_Use \`dawinos_calculate_materials\` with a code + quantity to get a bill of materials._`);

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── dawinos_get_formula ──────────────────────────────────────────────────────
  server.registerTool('dawinos_get_formula', {
    title: 'Get Construction Formula',
    description: `Get full details of a construction formula from the MatFlow library — including all material components with quantities, units, and wastage percentages. Also shows default rates and any calculation expressions.

Provide either \`formula_id\` (Firestore doc ID) or \`code\` (e.g. "C25", "BRICK_230").`,
    inputSchema: {
      formula_id: z.string().optional().describe('Firestore document ID'),
      code: z.string().optional().describe('Formula code (e.g. "C25", "BRICK_230", "Y16")'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    if (!params.formula_id && !params.code) {
      return { isError: true, content: [{ type: 'text' as const, text: 'Provide either formula_id or code.' }] };
    }

    try {
      let formula: Formula | null = null;

      if (params.formula_id) {
        formula = await getDocument<Formula>(MATFLOW_PATHS.formulas, params.formula_id);
      } else if (params.code) {
        const { items } = await queryCollection<Formula>(MATFLOW_PATHS.formulas, {
          filters: [{ field: 'code', op: '==', value: params.code.toUpperCase() }],
          limit: 1,
        });
        formula = items[0] ?? null;
      }

      if (!formula) {
        return { content: [{ type: 'text' as const, text: `Formula not found.` }] };
      }

      const lines = [
        `**${formula.code} — ${formula.name}**`,
        `Category: ${formula.category}${formula.subcategory ? ` / ${formula.subcategory}` : ''}  |  Output unit: **${formula.outputUnit}**`,
        `Usage count: ${formula.usageCount ?? 0}  |  Active: ${formula.isActive ? 'yes' : 'no'}`,
      ];

      if (formula.description) {
        lines.push('', formula.description);
      }

      lines.push('', '**Material Components per 1 ' + formula.outputUnit + ':**', '');
      lines.push('| Material | Quantity | Unit | Wastage | Net Qty |');
      lines.push('|----------|----------|------|---------|---------|');

      for (const c of (formula.components ?? [])) {
        const net = c.quantity * (1 + (c.wastagePercent ?? 0) / 100);
        lines.push(
          `| ${c.materialName} | ${c.quantity} | ${c.unit} | ${c.wastagePercent ?? 0}% | ${net.toFixed(3)} ${c.unit} |`
        );
      }

      // Rates
      const rateLines: string[] = [];
      if (formula.defaultLaborRate) rateLines.push(`Labor: UGX ${formula.defaultLaborRate.toLocaleString()}/${formula.outputUnit}`);
      if (formula.defaultMaterialRate) rateLines.push(`Material: UGX ${formula.defaultMaterialRate.toLocaleString()}/${formula.outputUnit}`);
      if (formula.defaultEquipmentRate) rateLines.push(`Equipment: UGX ${formula.defaultEquipmentRate.toLocaleString()}/${formula.outputUnit}`);
      if (rateLines.length) {
        lines.push('', '**Default Rates:**', ...rateLines);
      }

      // Formulas
      if (formula.laborFormula) lines.push('', `Labor formula: \`${formula.laborFormula}\``);
      if (formula.materialFormula) lines.push(`Material formula: \`${formula.materialFormula}\``);
      if (formula.equipmentFormula) lines.push(`Equipment formula: \`${formula.equipmentFormula}\``);

      if (formula.keywords?.length) {
        lines.push('', `Keywords: ${formula.keywords.join(', ')}`);
      }

      return { content: [{ type: 'text' as const, text: truncateIfNeeded(lines.join('\n')) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── dawinos_search_formulas ──────────────────────────────────────────────────
  server.registerTool('dawinos_search_formulas', {
    title: 'Search Construction Formulas',
    description: `Search the MatFlow formula library by keyword. Matches against the formula's keywords array, then filters by name/code/description. Useful for finding the right formula before calling \`dawinos_calculate_materials\`.

Examples: "concrete grade 25", "brick wall", "rebar", "plaster", "roofing sheet"`,
    inputSchema: {
      query: z.string().describe('Search term (e.g. "concrete", "brick wall", "Y16 rebar")'),
      category: z.enum(FORMULA_CATEGORIES).optional()
        .describe('Narrow to a specific category'),
      limit: z.number().int().min(1).max(50).optional()
        .describe('Max results (default: 20)'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    try {
      const words = params.query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const primaryWord = words[0];

      if (!primaryWord) {
        return { isError: true, content: [{ type: 'text' as const, text: 'Query too short — provide at least one word with 3+ characters.' }] };
      }

      const filters: QueryFilter[] = [
        { field: 'isActive', op: '==', value: true },
        { field: 'keywords', op: 'array-contains', value: primaryWord },
      ];
      if (params.category) {
        filters.push({ field: 'category', op: '==', value: params.category });
      }

      const { items } = await queryCollection<Formula>(MATFLOW_PATHS.formulas, {
        filters,
        orderByField: 'usageCount',
        orderByDirection: 'desc',
        limit: (params.limit ?? 20) * 3, // over-fetch for client-side filtering
      });

      // Client-side filter remaining words against name/code/description
      const remaining = words.slice(1);
      const filtered = remaining.length
        ? items.filter(f => {
            const haystack = `${f.name} ${f.code} ${f.description ?? ''}`.toLowerCase();
            return remaining.every(w => haystack.includes(w));
          })
        : items;

      const results = filtered.slice(0, params.limit ?? 20);

      if (!results.length) {
        return { content: [{ type: 'text' as const, text: `No formulas found for "${params.query}".` }] };
      }

      const lines = [
        `**Formula Search: "${params.query}"** — ${results.length} result${results.length !== 1 ? 's' : ''}`,
        '',
        '| Code | Name | Category | Output Unit | Used |',
        '|------|------|----------|-------------|------|',
      ];

      for (const f of results) {
        lines.push(
          `| ${f.code ?? '—'} | ${f.name} | ${f.category} | ${f.outputUnit} | ${f.usageCount ?? 0}× |`
        );
      }

      lines.push('', `_Use \`dawinos_get_formula\` with a code for full details, or \`dawinos_calculate_materials\` to compute a bill of materials._`);

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── dawinos_calculate_materials ─────────────────────────────────────────────
  server.registerTool('dawinos_calculate_materials', {
    title: 'Calculate Material Requirements (BOQ)',
    description: `Apply a MatFlow construction formula to a BOQ quantity and produce a bill of materials. For each component, calculates the net quantity required including wastage.

Example: Apply "C25" formula to 45m³ → shows exact quantities of cement bags, sand, aggregate, water needed with wastage factored in, plus cost estimate if rates are available.

Use \`dawinos_search_formulas\` or \`dawinos_list_formulas\` to find the right formula code first.`,
    inputSchema: {
      quantity: z.number().positive().describe('BOQ quantity (in the formula\'s output unit)'),
      formula_id: z.string().optional().describe('Firestore document ID of the formula'),
      code: z.string().optional().describe('Formula code (e.g. "C25", "BRICK_230")'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async (params) => {
    if (!params.formula_id && !params.code) {
      return { isError: true, content: [{ type: 'text' as const, text: 'Provide either formula_id or code.' }] };
    }

    try {
      let formula: Formula | null = null;

      if (params.formula_id) {
        formula = await getDocument<Formula>(MATFLOW_PATHS.formulas, params.formula_id);
      } else if (params.code) {
        const { items } = await queryCollection<Formula>(MATFLOW_PATHS.formulas, {
          filters: [{ field: 'code', op: '==', value: params.code.toUpperCase() }],
          limit: 1,
        });
        formula = items[0] ?? null;
      }

      if (!formula) {
        return { content: [{ type: 'text' as const, text: `Formula not found.` }] };
      }

      const qty = params.quantity;
      const components = formula.components ?? [];

      const lines = [
        `**Bill of Materials — ${formula.code}: ${formula.name}**`,
        `Quantity: **${qty} ${formula.outputUnit}**`,
        '',
        '| Material | Per Unit | Wastage | Req Qty | Purchase Qty | Unit | Est. Cost |',
        '|----------|----------|---------|---------|--------------|------|-----------|',
      ];

      let totalEstCost: number | null = null;

      for (const c of components) {
        const baseQty = qty * c.quantity;
        const netQty = baseQty * (1 + (c.wastagePercent ?? 0) / 100);
        const wastageAdded = netQty - baseQty;

        // Attempt cost estimate if formula has a material rate
        let costCell = '—';
        if (formula.defaultMaterialRate) {
          // Rough cost: pro-rate the formula-level rate by component contribution
          // (formula-level rate covers all materials combined; show as total below)
          costCell = '—';
        }

          const purchaseQty = (c as any).moq
          ? Math.ceil(netQty / (c as any).moq) * (c as any).moq
          : netQty;
        const purchaseCell = purchaseQty !== netQty
          ? `**${purchaseQty.toFixed(2)}** _(MOQ ${(c as any).moq}${(c as any).packUnit ? ' ' + (c as any).packUnit : ''})_`
          : netQty.toFixed(2);

        lines.push(
          `| ${c.materialName} | ${c.quantity} | ${c.wastagePercent ?? 0}% (+${wastageAdded.toFixed(2)}) | ${netQty.toFixed(2)} | ${purchaseCell} | ${c.unit} | ${costCell} |`
        );
      }

      // Formula-level cost estimate
      lines.push('');

      const costLines: string[] = [];
      if (formula.defaultMaterialRate) {
        const matCost = qty * formula.defaultMaterialRate;
        costLines.push(`Material: ${formatCurrency(matCost, 'UGX')} (@ UGX ${formula.defaultMaterialRate.toLocaleString()}/${formula.outputUnit})`);
        totalEstCost = (totalEstCost ?? 0) + matCost;
      }
      if (formula.defaultLaborRate) {
        const labCost = qty * formula.defaultLaborRate;
        costLines.push(`Labour: ${formatCurrency(labCost, 'UGX')} (@ UGX ${formula.defaultLaborRate.toLocaleString()}/${formula.outputUnit})`);
        totalEstCost = (totalEstCost ?? 0) + labCost;
      }
      if (formula.defaultEquipmentRate) {
        const eqCost = qty * formula.defaultEquipmentRate;
        costLines.push(`Equipment: ${formatCurrency(eqCost, 'UGX')} (@ UGX ${formula.defaultEquipmentRate.toLocaleString()}/${formula.outputUnit})`);
        totalEstCost = (totalEstCost ?? 0) + eqCost;
      }

      if (costLines.length) {
        lines.push('**Cost Estimate:**', ...costLines);
        if (totalEstCost !== null) {
          lines.push(`**Total: ${formatCurrency(totalEstCost, 'UGX')}**`);
        }
      } else {
        lines.push('_No default rates set on this formula — cost estimate not available._');
      }

      lines.push(
        '',
        `_Formula: ${formula.id} | Updated: ${formatTimestamp(formula.updatedAt)}_`,
        `_Note: Rates are default estimates. Adjust for site conditions and current market prices._`,
      );

      return { content: [{ type: 'text' as const, text: truncateIfNeeded(lines.join('\n')) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── dawinos_create_formula ───────────────────────────────────────────────────
  server.registerTool('dawinos_create_formula', {
    title: 'Create Construction Formula',
    description: `Add a new construction formula to the MatFlow library. The formula defines material components (with quantities and wastage) required per unit of output.

Provide a unique \`code\` (e.g. "C30_PUMPED", "BLOCK_200_PLASTERED"), a category, output unit, and at least one component.`,
    inputSchema: {
      code: z.string().describe('Unique formula code (e.g. "C25", "BRICK_230") — will be uppercased'),
      name: z.string().describe('Human-readable name (e.g. "Reinforced Concrete Grade 25")'),
      category: z.enum(FORMULA_CATEGORIES).describe('Material category'),
      output_unit: z.string().describe('Unit of output (e.g. "m³", "m²", "lm", "kg")'),
      description: z.string().optional().describe('Detailed description of the formula'),
      subcategory: z.string().optional().describe('Optional subcategory'),
      components: z.array(z.object({
        material_name: z.string().describe('Material name'),
        material_id: z.string().optional().describe('Optional inventory item ID'),
        quantity: z.number().positive().describe('Quantity per unit of output'),
        unit: z.string().describe('Unit of measurement for this material'),
        wastage_percent: z.number().min(0).max(100).describe('Wastage percentage (e.g. 5 for 5%)'),
        moq: z.number().positive().optional().describe('Minimum purchasable quantity (e.g. 50 for a 50 kg bag of cement)'),
        pack_unit: z.string().optional().describe('Pack label shown alongside MOQ (e.g. "bag", "roll", "sheet")'),
      })).min(1).describe('Material components'),
      default_labor_rate: z.number().optional().describe('Default labour cost per output unit (UGX)'),
      default_material_rate: z.number().optional().describe('Default material cost per output unit (UGX)'),
      default_equipment_rate: z.number().optional().describe('Default equipment cost per output unit (UGX)'),
      keywords: z.array(z.string()).optional().describe('Search keywords (auto-generated if omitted)'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, async (params) => {
    try {
      const db = getDb();
      const code = params.code.toUpperCase();

      // Check code uniqueness
      const { items: existing } = await queryCollection<Formula>(MATFLOW_PATHS.formulas, {
        filters: [{ field: 'code', op: '==', value: code }],
        limit: 1,
      });
      if (existing.length) {
        return { isError: true, content: [{ type: 'text' as const, text: `Formula code "${code}" already exists (ID: ${existing[0].id}). Use dawinos_update_formula to modify it.` }] };
      }

      // Auto-generate keywords from name, code, description, category
      const autoKeywords = [
        ...code.toLowerCase().split('_'),
        ...params.name.toLowerCase().split(/\s+/),
        params.category.toLowerCase(),
        ...(params.subcategory ? params.subcategory.toLowerCase().split(/\s+/) : []),
        ...(params.description ? params.description.toLowerCase().split(/\s+/).filter(w => w.length > 3) : []),
      ].filter((w, i, arr) => w.length > 2 && arr.indexOf(w) === i);

      const keywords = params.keywords?.length ? params.keywords : autoKeywords;

      const components: FormulaComponent[] = params.components.map(c => ({
        materialId: c.material_id ?? '',
        materialName: c.material_name,
        quantity: c.quantity,
        unit: c.unit,
        wastagePercent: c.wastage_percent,
        ...(c.moq != null ? { moq: c.moq } : {}),
        ...(c.pack_unit != null ? { packUnit: c.pack_unit } : {}),
      }));

      const doc = {
        code,
        name: params.name,
        category: params.category,
        outputUnit: params.output_unit,
        description: params.description ?? '',
        subcategory: params.subcategory ?? '',
        components,
        keywords,
        defaultLaborRate: params.default_labor_rate ?? null,
        defaultMaterialRate: params.default_material_rate ?? null,
        defaultEquipmentRate: params.default_equipment_rate ?? null,
        laborFormula: null,
        materialFormula: null,
        equipmentFormula: null,
        usageCount: 0,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const ref = await db.collection(MATFLOW_PATHS.formulas).add(doc);

      return {
        content: [{
          type: 'text' as const,
          text: [
            `**Formula created: ${code}**`,
            `ID: ${ref.id}`,
            `Name: ${params.name}`,
            `Category: ${params.category} | Output unit: ${params.output_unit}`,
            `Components: ${components.length}`,
            `Keywords: ${keywords.join(', ')}`,
          ].join('\n'),
        }],
      };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── dawinos_update_formula ───────────────────────────────────────────────────
  server.registerTool('dawinos_update_formula', {
    title: 'Update Construction Formula',
    description: `Update an existing MatFlow construction formula. All fields are optional — only supplied fields are changed.

Provide \`formula_id\` or \`code\` to identify the formula. You can update the name, description, components, default rates, keywords, or active status.

To replace all components, supply the full new \`components\` array. To deactivate a formula use \`is_active: false\`.`,
    inputSchema: {
      formula_id: z.string().optional().describe('Firestore document ID'),
      code: z.string().optional().describe('Formula code (e.g. "C25")'),
      name: z.string().optional(),
      description: z.string().optional(),
      subcategory: z.string().optional(),
      output_unit: z.string().optional(),
      category: z.enum(FORMULA_CATEGORIES).optional(),
      components: z.array(z.object({
        material_name: z.string(),
        material_id: z.string().optional(),
        quantity: z.number().positive(),
        unit: z.string(),
        wastage_percent: z.number().min(0).max(100),
        moq: z.number().positive().optional().describe('Minimum purchasable quantity'),
        pack_unit: z.string().optional().describe('Pack label (e.g. "bag", "roll")'),
      })).optional().describe('Replace all components with this list'),
      default_labor_rate: z.number().optional(),
      default_material_rate: z.number().optional(),
      default_equipment_rate: z.number().optional(),
      keywords: z.array(z.string()).optional().describe('Replace keywords with this list'),
      is_active: z.boolean().optional().describe('Set false to deactivate the formula'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, async (params) => {
    if (!params.formula_id && !params.code) {
      return { isError: true, content: [{ type: 'text' as const, text: 'Provide either formula_id or code.' }] };
    }

    try {
      let formulaId = params.formula_id;

      if (!formulaId && params.code) {
        const { items } = await queryCollection<Formula>(MATFLOW_PATHS.formulas, {
          filters: [{ field: 'code', op: '==', value: params.code.toUpperCase() }],
          limit: 1,
        });
        if (!items.length) {
          return { isError: true, content: [{ type: 'text' as const, text: `Formula "${params.code}" not found.` }] };
        }
        formulaId = items[0].id;
      }

      const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };

      if (params.name !== undefined) updates['name'] = params.name;
      if (params.description !== undefined) updates['description'] = params.description;
      if (params.subcategory !== undefined) updates['subcategory'] = params.subcategory;
      if (params.output_unit !== undefined) updates['outputUnit'] = params.output_unit;
      if (params.category !== undefined) updates['category'] = params.category;
      if (params.default_labor_rate !== undefined) updates['defaultLaborRate'] = params.default_labor_rate;
      if (params.default_material_rate !== undefined) updates['defaultMaterialRate'] = params.default_material_rate;
      if (params.default_equipment_rate !== undefined) updates['defaultEquipmentRate'] = params.default_equipment_rate;
      if (params.keywords !== undefined) updates['keywords'] = params.keywords;
      if (params.is_active !== undefined) updates['isActive'] = params.is_active;

      if (params.components !== undefined) {
        updates['components'] = params.components.map(c => ({
          materialId: c.material_id ?? '',
          materialName: c.material_name,
          quantity: c.quantity,
          unit: c.unit,
          wastagePercent: c.wastage_percent,
          ...(c.moq != null ? { moq: c.moq } : {}),
          ...(c.pack_unit != null ? { packUnit: c.pack_unit } : {}),
        }));
      }

      const db = getDb();
      await db.collection(MATFLOW_PATHS.formulas).doc(formulaId!).update(updates as unknown as Record<string, unknown>);

      const updatedFields = Object.keys(updates).filter(k => k !== 'updatedAt');

      return {
        content: [{
          type: 'text' as const,
          text: [
            `**Formula updated: ${params.code ?? formulaId}**`,
            `Fields changed: ${updatedFields.join(', ')}`,
            params.components ? `Components replaced: ${params.components.length} items` : '',
          ].filter(Boolean).join('\n'),
        }],
      };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });

  // ─── dawinos_delete_formula ───────────────────────────────────────────────────
  server.registerTool('dawinos_delete_formula', {
    title: 'Delete (Deactivate) Construction Formula',
    description: `Soft-delete a MatFlow formula by setting \`isActive: false\`. The formula remains in Firestore for audit purposes but will no longer appear in list/search results.

To permanently restore it, use \`dawinos_update_formula\` with \`is_active: true\`.

Requires \`confirm: true\` to proceed.`,
    inputSchema: {
      formula_id: z.string().optional().describe('Firestore document ID'),
      code: z.string().optional().describe('Formula code (e.g. "C25")'),
      confirm: z.boolean().describe('Must be true to proceed with deactivation'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  }, async (params) => {
    if (!params.formula_id && !params.code) {
      return { isError: true, content: [{ type: 'text' as const, text: 'Provide either formula_id or code.' }] };
    }

    if (!params.confirm) {
      // Dry-run: show what would be deactivated
      try {
        let formula: Formula | null = null;
        if (params.formula_id) {
          formula = await getDocument<Formula>(MATFLOW_PATHS.formulas, params.formula_id);
        } else if (params.code) {
          const { items } = await queryCollection<Formula>(MATFLOW_PATHS.formulas, {
            filters: [{ field: 'code', op: '==', value: params.code.toUpperCase() }],
            limit: 1,
          });
          formula = items[0] ?? null;
        }
        if (!formula) {
          return { isError: true, content: [{ type: 'text' as const, text: `Formula not found.` }] };
        }
        return {
          content: [{
            type: 'text' as const,
            text: [
              `**Dry run — Formula to deactivate:**`,
              `Code: ${formula.code}  |  Name: ${formula.name}`,
              `Category: ${formula.category}  |  Components: ${formula.components?.length ?? 0}`,
              `Usage count: ${formula.usageCount ?? 0}`,
              '',
              `Re-run with \`confirm: true\` to deactivate.`,
            ].join('\n'),
          }],
        };
      } catch (err) {
        return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
      }
    }

    try {
      let formulaId = params.formula_id;

      if (!formulaId && params.code) {
        const { items } = await queryCollection<Formula>(MATFLOW_PATHS.formulas, {
          filters: [{ field: 'code', op: '==', value: params.code.toUpperCase() }],
          limit: 1,
        });
        if (!items.length) {
          return { isError: true, content: [{ type: 'text' as const, text: `Formula "${params.code}" not found.` }] };
        }
        formulaId = items[0].id;
      }

      const db = getDb();
      await db.collection(MATFLOW_PATHS.formulas).doc(formulaId!).update({
        isActive: false,
        updatedAt: serverTimestamp(),
      });

      return {
        content: [{
          type: 'text' as const,
          text: `Formula ${params.code ?? formulaId} deactivated. Use \`dawinos_update_formula\` with \`is_active: true\` to restore it.`,
        }],
      };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: `Error: ${String(err)}` }] };
    }
  });
}
