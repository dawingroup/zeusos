import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  queryCollection,
  fetchAllMatching,
  getDocument,
  getDb,
  serializeDoc,
  formatTimestamp,
  formatCurrency,
  truncateIfNeeded,
  serverTimestamp,
  FieldValue,
} from '../services/firebase.js';
import {
  COLLECTIONS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  INVENTORY_STATUSES,
  INVENTORY_TIERS,
  FINISH_CATEGORIES,
} from '../constants.js';
import {
  getValidCategorySlugs,
  validateCategorySlug,
  invalidateCategoryCache,
} from '../services/categoryRegistry.js';
import type { InventoryItem, StockLevel, StockAdjustment, FinishDocument } from '../types.js';
import {
  assertItemExists,
  loadItem,
  computeDiff,
  deepEqual,
  emptyEnvelope,
  findSkuCollision,
  findBatchSkuCollisions,
  scanSkuReferences,
  commitBatch,
  type WriteEnvelope,
  type ItemDiff,
  type WriteWarning,
} from '../inventory/write-helpers.js';
import { formatEnvelope } from '../inventory/format-envelope.js';

export function registerInventoryTools(server: McpServer): void {
  // ─── Tool 1: Search Inventory ─────────────────────────────────────────────────
  server.registerTool(
    'dawinos_search_inventory',
    {
      title: 'Search Inventory Items',
      description: `Search and filter inventory items in DawinOS.

Parameters:
- query (optional): Text search across name, displayName, SKU, brand, description, subcategory, and tags (case-insensitive substring match)
- category (optional): Filter by category (dynamic — run dawinos_list_categories to see current list)
- classification (optional): Filter by type: material | product | kit
- status (optional): Filter by status. Values: ${INVENTORY_STATUSES.join(' | ')}
- tier (optional): Filter by tier: catalogue (permanent stock) | project (job-specific)
- restockable (optional): Filter by restockability (true/false)
- currency (optional): Filter by pricing currency. Values: UGX | AED | KES | USD | EUR | GBP
- is_family (optional): true → only family parents; false → only non-parents
- parent_id (optional): Return only children of this family / parent item
- include_archived (optional): Include archived items — excluded by default (default false)
- low_stock_only (optional): Only return items where stockOnHand <= reorderLevel
- limit (optional): Max results, default ${DEFAULT_PAGE_SIZE}, max ${MAX_PAGE_SIZE}
- offset (optional): Pagination offset (no upper cap)
- compact (optional): true → return minimal columns to save tokens
- fields (optional): Array of field names to return (json format only)
- response_format (optional): 'markdown' (default) or 'json'

Returns: Table of inventory items with stock levels, cost price, and supplier info.
Low-stock items are flagged with ⚠️. Cost / currency / unit are read from the
nested 'pricing' object (canonical) with fall-back to legacy top-level fields.

Note: Stock field is 'stockOnHand'. Cost field is 'pricing.costPerUnit' (canonical) or 'costPrice' (legacy).
Category values use kebab-case (e.g. 'sheet-goods', 'edge-banding').
Archived items are excluded by default — pass include_archived=true to see them.`,
      inputSchema: {
        query: z.string().optional().describe('Text search on name, SKU, brand, description, tags'),
        category: z
          .string()
          .optional()
          .describe('Category filter (dynamic — validated at runtime against inventoryCategories collection)'),
        classification: z
          .enum(['material', 'product', 'kit'])
          .optional()
          .describe('Item classification'),
        status: z
          .enum(INVENTORY_STATUSES)
          .optional()
          .describe(`Status filter: ${INVENTORY_STATUSES.join(' | ')}`),
        tier: z
          .enum(INVENTORY_TIERS)
          .optional()
          .describe('Filter by tier: catalogue | project'),
        restockable: z
          .boolean()
          .optional()
          .describe('Filter by restockability'),
        currency: z
          .enum(['UGX', 'AED', 'KES', 'USD', 'EUR', 'GBP'])
          .optional()
          .describe('Filter by pricing currency'),
        is_family: z
          .boolean()
          .optional()
          .describe('true → only family parents, false → only non-parents'),
        parent_id: z
          .string()
          .optional()
          .describe('Return only children of this family / parent item'),
        include_archived: z
          .boolean()
          .default(false)
          .describe('Include archived items (excluded by default)'),
        low_stock_only: z
          .boolean()
          .default(false)
          .describe('Only return items at or below reorder level'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_PAGE_SIZE)
          .default(DEFAULT_PAGE_SIZE)
          .describe(`Max results (default ${DEFAULT_PAGE_SIZE}, max ${MAX_PAGE_SIZE})`),
        offset: z.number().int().min(0).default(0).describe('Pagination offset (no upper cap)'),
        compact: z
          .boolean()
          .default(false)
          .describe('Compact output: minimal columns / fields'),
        fields: z
          .array(z.string())
          .optional()
          .describe('Field allow-list for json responses'),
        response_format: z
          .enum(['markdown', 'json'])
          .default('markdown')
          .describe("'markdown' or 'json'"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const {
          query,
          category,
          classification,
          status,
          tier,
          restockable,
          currency,
          is_family,
          parent_id,
          include_archived,
          low_stock_only,
          limit,
          offset,
          compact,
          fields,
          response_format,
        } = params;

        // Validate category against dynamic registry
        if (category) {
          const catError = await validateCategorySlug(category);
          if (catError) return { content: [{ type: 'text', text: catError }] };
        }

        // Server-side filters use indexed top-level fields only.
        const filters: { field: string; op: FirebaseFirestore.WhereFilterOp; value: unknown }[] =
          [];
        if (category) filters.push({ field: 'category', op: '==', value: category });
        if (classification) filters.push({ field: 'classification', op: '==', value: classification });
        if (status) filters.push({ field: 'status', op: '==', value: status });
        if (tier) filters.push({ field: 'tier', op: '==', value: tier });
        if (restockable !== undefined) filters.push({ field: 'restockable', op: '==', value: restockable });
        if (parent_id) filters.push({ field: 'parentItemId', op: '==', value: parent_id });
        if (is_family === true) filters.push({ field: 'isFamily', op: '==', value: true });

        // Default to active items only (mirrors inventoryTools.js pattern)
        if (!status && !include_archived) {
          filters.push({ field: 'status', op: '==', value: 'active' });
        }

        // We always need client-side filtering for: text query, currency
        // (nested + orphan top-level), low-stock, is_family=false (negation),
        // and to enforce a stable post-filter offset. Cheaper to fetch all
        // matching docs once than to risk the offset/over-fetch bug.
        const allMatching = await fetchAllMatching<InventoryItem>(COLLECTIONS.INVENTORY_ITEMS, {
          filters,
        });

        let filtered: InventoryItem[] = allMatching;

        // Client-side text search across name, displayName, SKU, brand,
        // description, subcategory, tags. Case-insensitive substring match.
        if (query) {
          const term = query.toLowerCase();
          filtered = filtered.filter((i) => {
            const haystack = [
              i.name,
              i.displayName,
              i.sku,
              i.brand,
              i.description,
              i.subcategory,
              i.classification,
              i.category,
              ...(i.tags ?? []),
            ]
              .filter((v): v is string => typeof v === 'string')
              .map((v) => v.toLowerCase());
            return haystack.some((v) => v.includes(term));
          });
        }

        // Currency filter — accept either nested pricing.currency or legacy
        // top-level currency so the filter still works during the orphan
        // backfill window.
        if (currency) {
          const target = currency.toUpperCase();
          filtered = filtered.filter((i) => {
            const c = (i.pricing?.currency || i.currency || '').toUpperCase();
            return c === target;
          });
        }

        // is_family=false → only non-parents (must check field is not true)
        if (is_family === false) {
          filtered = filtered.filter((i) => i.isFamily !== true);
        }

        // Low-stock filter
        if (low_stock_only) {
          filtered = filtered.filter((i) => {
            const stock = i.stockOnHand ?? i.inventory?.inStock ?? 0;
            const reorder = i.reorderLevel ?? i.inventory?.reorderLevel ?? 0;
            return reorder > 0 && stock <= reorder;
          });
        }

        const totalAfterFilters = filtered.length;
        const paginated = filtered.slice(offset, offset + limit);
        const hasMore = offset + paginated.length < totalAfterFilters;

        if (paginated.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No inventory items found matching your filters. (matched=${totalAfterFilters}, offset=${offset})`,
              },
            ],
          };
        }

        // Helper: read canonical pricing fields with fall-back to legacy.
        const getCost = (i: InventoryItem) =>
          typeof i.pricing?.costPerUnit === 'number' ? i.pricing!.costPerUnit : i.costPrice;
        const getCurrency = (i: InventoryItem) => i.pricing?.currency ?? i.currency;
        const getUnit = (i: InventoryItem) => i.pricing?.unit ?? i.unit;

        if (response_format === 'json') {
          const project = (i: InventoryItem) => {
            const base = {
              id: i.id,
              sku: i.sku,
              name: i.name,
              category: i.category,
              classification: i.classification,
              status: i.status,
              stockOnHand: i.stockOnHand ?? i.inventory?.inStock ?? 0,
              reorderLevel: i.reorderLevel ?? i.inventory?.reorderLevel ?? 0,
              costPerUnit: getCost(i),
              currency: getCurrency(i),
              unit: getUnit(i),
              isFamily: i.isFamily ?? false,
              parentItemId: i.parentItemId,
              familyId: i.familyId,
            };
            if (compact) return base;
            const full = serializeDoc(i as unknown as Record<string, unknown>) as Record<
              string,
              unknown
            >;
            if (fields && fields.length > 0) {
              const out: Record<string, unknown> = { id: i.id };
              for (const f of fields) out[f] = full[f];
              return out;
            }
            return full;
          };

          const result = {
            total: totalAfterFilters,
            count: paginated.length,
            offset,
            limit,
            hasMore,
            nextOffset: hasMore ? offset + limit : undefined,
            items: paginated.map(project),
          };
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        // Markdown format
        const lines: string[] = [];
        lines.push(`## Inventory Items (${paginated.length} of ${totalAfterFilters} shown)\n`);

        if (compact) {
          // Compact mode emits a JSON code block so agents can parse the
          // result directly (no markdown-table regex). Includes `id` so
          // results can be fed straight into batch_update_inventory.
          const compactItems = paginated.map((item) => ({
            id: item.id,
            sku: item.sku ?? null,
            name: item.name ?? null,
            category: item.category ?? null,
            stock: item.stockOnHand ?? item.inventory?.inStock ?? 0,
            cost: getCost(item) ?? null,
            currency: getCurrency(item) ?? null,
            unit: getUnit(item) ?? null,
            is_family: item.isFamily ?? false,
          }));
          lines.push('```json');
          lines.push(JSON.stringify(compactItems, null, 2));
          lines.push('```');
        } else {
          // Default markdown table — `ID` is the first column so the
          // Firestore document ID is always available for downstream
          // update_inventory_item / batch_update_inventory calls.
          lines.push(`| ID | Name | SKU | Category | Stock | Reorder | Cost Price | Unit |`);
          lines.push(`|----|------|-----|----------|-------|---------|-----------|------|`);
          for (const item of paginated) {
            const stock = item.stockOnHand ?? item.inventory?.inStock ?? 0;
            const reorder = item.reorderLevel ?? item.inventory?.reorderLevel ?? 0;
            const isLow = reorder > 0 && stock <= reorder;
            const flag = isLow ? ' ⚠️' : '';
            const cost = getCost(item);
            const cur = getCurrency(item);
            const unit = getUnit(item) ?? '-';
            lines.push(
              `| \`${item.id}\` | ${item.name ?? 'N/A'}${flag} | ${item.sku ?? '-'} | ${item.category ?? '-'} | ${stock} | ${reorder || '-'} | ${formatCurrency(cost, cur)} | ${unit} |`
            );
          }
        }

        if (hasMore) {
          lines.push(`\n_Use offset=${offset + limit} for next page (${totalAfterFilters - offset - paginated.length} more)._`);
        }

        return { content: [{ type: 'text', text: truncateIfNeeded(lines.join('\n')) }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error searching inventory: ${(error as Error).message}` }],
        };
      }
    }
  );

  // ─── Tool 2: Get Finish Library ───────────────────────────────────────────────
  server.registerTool(
    'dawinos_get_finish_library',
    {
      title: 'Browse Finish Library',
      description: `Browse and search the DawinOS Finish Library — the catalog of surface finishes, materials, and textures used in design projects.

Parameters:
- category (optional): Filter by finish category. Values: ${FINISH_CATEGORIES.join(' | ')}
- subtype (optional): Filter by subtype within category (e.g. 'melamine', 'gloss', 'emulsion')
- availability (optional): Filter by availability: in_stock | made_to_order | discontinued | seasonal
- search (optional): Text search on name, code, or tags
- is_active (optional): Filter by active status (default: true — only active finishes)
- limit (optional): Max results, default ${DEFAULT_PAGE_SIZE}, max ${MAX_PAGE_SIZE}
- offset (optional): Pagination offset
- response_format (optional): 'markdown' (default) or 'json'

Returns: Finish name, code, category, subtype, hex color, pattern type, availability, and tags.`,
      inputSchema: {
        category: z
          .enum(FINISH_CATEGORIES)
          .optional()
          .describe(`Finish category: ${FINISH_CATEGORIES.join(' | ')}`),
        subtype: z.string().optional().describe('Subtype filter (e.g. melamine, gloss, emulsion)'),
        availability: z
          .enum(['in_stock', 'made_to_order', 'discontinued', 'seasonal'])
          .optional()
          .describe('Availability filter'),
        search: z.string().optional().describe('Text search on name, code, or tags'),
        is_active: z
          .boolean()
          .default(true)
          .describe('Filter by active status (default true)'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_PAGE_SIZE)
          .default(DEFAULT_PAGE_SIZE)
          .describe(`Max results (default ${DEFAULT_PAGE_SIZE}, max ${MAX_PAGE_SIZE})`),
        offset: z.number().int().min(0).default(0).describe('Pagination offset'),
        response_format: z
          .enum(['markdown', 'json'])
          .default('markdown')
          .describe("'markdown' or 'json'"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const { category, subtype, availability, search, is_active, limit, offset, response_format } =
          params;

        // Validate category against dynamic registry
        if (category) {
          const catError = await validateCategorySlug(category);
          if (catError) return { content: [{ type: 'text', text: catError }] };
        }

        const filters: { field: string; op: FirebaseFirestore.WhereFilterOp; value: unknown }[] =
          [];
        if (category) filters.push({ field: 'category', op: '==', value: category });
        if (availability) filters.push({ field: 'availability', op: '==', value: availability });
        if (is_active) filters.push({ field: 'isActive', op: '==', value: true });

        const { items, total } = await queryCollection<FinishDocument>(COLLECTIONS.FINISH_LIBRARY, {
          filters,
          limit: search || subtype ? limit * 4 : limit,
          offset: search || subtype ? 0 : offset,
        });

        let filtered = items;
        if (subtype) {
          const term = subtype.toLowerCase();
          filtered = filtered.filter((f) => (f.subtype ?? '').toLowerCase().includes(term));
        }
        if (search) {
          const term = search.toLowerCase();
          filtered = filtered.filter(
            (f) =>
              (f.name ?? '').toLowerCase().includes(term) ||
              (f.code ?? '').toLowerCase().includes(term) ||
              (f.tags ?? []).some((t) => t.toLowerCase().includes(term))
          );
        }

        const paginated =
          search || subtype ? filtered.slice(offset, offset + limit) : filtered.slice(0, limit);
        const hasMore =
          search || subtype
            ? offset + paginated.length < filtered.length
            : offset + paginated.length < total;

        if (paginated.length === 0) {
          return {
            content: [{ type: 'text', text: 'No finishes found matching your filters.' }],
          };
        }

        if (response_format === 'json') {
          const result = {
            total: search || subtype ? filtered.length : total,
            count: paginated.length,
            offset,
            limit,
            hasMore,
            items: paginated.map((f) => serializeDoc(f as unknown as Record<string, unknown>)),
          };
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        const lines: string[] = [
          `## Finish Library (${paginated.length} shown)\n`,
          `| Code | Name | Category | Subtype | Color | Pattern | Availability |`,
          `|------|------|----------|---------|-------|---------|-------------|`,
        ];

        for (const f of paginated) {
          const colorSwatch = f.hexColor ? `🎨 ${f.hexColor}` : '-';
          lines.push(
            `| ${f.code ?? '-'} | ${f.name ?? 'N/A'} | ${f.category ?? '-'} | ${f.subtype ?? '-'} | ${colorSwatch} | ${f.patternType ?? '-'} | ${f.availability ?? '-'} |`
          );
          if (f.tags && f.tags.length > 0) {
            // Inline tags below the row as a subtle note
          }
        }

        if (hasMore) {
          lines.push(`\n_Use offset=${offset + limit} for next page._`);
        }

        return { content: [{ type: 'text', text: truncateIfNeeded(lines.join('\n')) }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error fetching finish library: ${(error as Error).message}` }],
        };
      }
    }
  );

  // ─── Tool 3: Stock Levels ─────────────────────────────────────────────────────
  server.registerTool(
    'dawinos_stock_levels',
    {
      title: 'Get Stock Levels',
      description: `Query the stockLevels collection for inventory availability across warehouses.

Parameters:
- inventory_item_id (optional): Filter to stock levels for one specific inventory item
- warehouse_id (optional): Filter to one warehouse
- low_stock_only (optional): Only return records where quantityAvailable <= reorderPoint
- limit (optional): Max results, default ${DEFAULT_PAGE_SIZE}, max ${MAX_PAGE_SIZE}
- offset (optional): Pagination offset
- response_format (optional): 'markdown' (default) or 'json'

Returns: Stock levels with quantityOnHand, quantityAllocated, quantityAvailable per item per warehouse.

Note: This is the 'stockLevels' collection — a separate collection from 'inventoryItems'.
Fields are: quantityOnHand, quantityAllocated, quantityAvailable (not 'stockOnHand').`,
      inputSchema: {
        inventory_item_id: z.string().optional().describe('Filter to one inventory item ID'),
        warehouse_id: z.string().optional().describe('Filter to one warehouse ID'),
        low_stock_only: z
          .boolean()
          .default(false)
          .describe('Only return records at or below reorder point'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_PAGE_SIZE)
          .default(DEFAULT_PAGE_SIZE)
          .describe(`Max results (default ${DEFAULT_PAGE_SIZE}, max ${MAX_PAGE_SIZE})`),
        offset: z.number().int().min(0).default(0).describe('Pagination offset'),
        response_format: z
          .enum(['markdown', 'json'])
          .default('markdown')
          .describe("'markdown' or 'json'"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const { inventory_item_id, warehouse_id, low_stock_only, limit, offset, response_format } =
          params;

        const filters: { field: string; op: FirebaseFirestore.WhereFilterOp; value: unknown }[] =
          [];
        if (inventory_item_id)
          filters.push({ field: 'inventoryItemId', op: '==', value: inventory_item_id });
        if (warehouse_id) filters.push({ field: 'warehouseId', op: '==', value: warehouse_id });

        const { items, total } = await queryCollection<StockLevel>(COLLECTIONS.STOCK_LEVELS, {
          filters,
          limit: low_stock_only ? limit * 4 : limit,
          offset: low_stock_only ? 0 : offset,
        });

        let filtered = items;
        if (low_stock_only) {
          filtered = filtered.filter(
            (s) =>
              (s.reorderPoint ?? 0) > 0 &&
              (s.quantityAvailable ?? 0) <= (s.reorderPoint ?? 0)
          );
        }

        const paginated = low_stock_only ? filtered.slice(offset, offset + limit) : filtered;
        const hasMore =
          low_stock_only
            ? offset + paginated.length < filtered.length
            : offset + paginated.length < total;

        if (paginated.length === 0) {
          return {
            content: [{ type: 'text', text: 'No stock level records found matching your filters.' }],
          };
        }

        if (response_format === 'json') {
          const result = {
            total: low_stock_only ? filtered.length : total,
            count: paginated.length,
            offset,
            limit,
            hasMore,
            items: paginated.map((s) => serializeDoc(s as unknown as Record<string, unknown>)),
          };
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        const lines: string[] = [
          `## Stock Levels (${paginated.length} shown)\n`,
          `| Item | Warehouse | On Hand | Allocated | Available | Reorder Point |`,
          `|------|-----------|---------|-----------|-----------|---------------|`,
        ];

        for (const s of paginated) {
          const isLow =
            (s.reorderPoint ?? 0) > 0 && (s.quantityAvailable ?? 0) <= (s.reorderPoint ?? 0);
          const flag = isLow ? ' ⚠️' : '';
          const extras: string[] = [];
          const inv = (s as unknown as Record<string, unknown>)['inventory'] as Record<string, unknown> | undefined;
          if (inv?.['volumeOnHand'] != null) extras.push(`vol: ${inv['volumeOnHand']}m³`);
          if (inv?.['piecesOnHand'] != null) extras.push(`pcs: ${inv['piecesOnHand']}`);
          const extraStr = extras.length > 0 ? ` (${extras.join(', ')})` : '';
          lines.push(
            `| ${s.itemName ?? s.inventoryItemId ?? 'N/A'}${flag} | ${s.warehouseId ?? '-'} | ${s.quantityOnHand ?? 0}${extraStr} | ${s.quantityAllocated ?? 0} | ${s.quantityAvailable ?? 0} | ${s.reorderPoint ?? '-'} |`
          );
        }

        if (hasMore) {
          lines.push(`\n_Use offset=${offset + limit} for next page._`);
        }

        return { content: [{ type: 'text', text: truncateIfNeeded(lines.join('\n')) }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error fetching stock levels: ${(error as Error).message}` }],
        };
      }
    }
  );

  // ─── Tool 4: List Stock Adjustments ──────────────────────────────────────────
  server.registerTool(
    'dawinos_list_stock_adjustments',
    {
      title: 'List Stock Adjustments',
      description: `List stock adjustment records from the stock_adjustments collection.

Parameters:
- status (optional): Filter by adjustment status (e.g. 'approved', 'draft', 'submitted')
- adjustment_type (optional): Filter by type (e.g. 'physical_count_variance', 'damage_spoilage', 'production_consumption')
- date_from (optional): Filter createdAt >= this date (YYYY-MM-DD)
- date_to (optional): Filter createdAt <= this date (YYYY-MM-DD)
- limit (optional): Max results, default ${DEFAULT_PAGE_SIZE}, max ${MAX_PAGE_SIZE}
- offset (optional): Pagination offset
- response_format (optional): 'markdown' (default) or 'json'

Returns: Adjustment records with adjustment number, type, status, net value impact, and line item summary.

Note: Collection is 'stock_adjustments' (snake_case). Line items are embedded in the document.`,
      inputSchema: {
        status: z
          .string()
          .optional()
          .describe('Filter by status (e.g. approved, draft, submitted)'),
        adjustment_type: z
          .string()
          .optional()
          .describe('Filter by adjustment type (e.g. physical_count_variance, damage_spoilage)'),
        date_from: z.string().optional().describe('Filter createdAt >= date (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('Filter createdAt <= date (YYYY-MM-DD)'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_PAGE_SIZE)
          .default(DEFAULT_PAGE_SIZE)
          .describe(`Max results (default ${DEFAULT_PAGE_SIZE}, max ${MAX_PAGE_SIZE})`),
        offset: z.number().int().min(0).default(0).describe('Pagination offset'),
        response_format: z
          .enum(['markdown', 'json'])
          .default('markdown')
          .describe("'markdown' or 'json'"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const { status, adjustment_type, date_from, date_to, limit, offset, response_format } =
          params;

        const filters: { field: string; op: FirebaseFirestore.WhereFilterOp; value: unknown }[] =
          [];
        if (status) filters.push({ field: 'status', op: '==', value: status });
        if (adjustment_type)
          filters.push({ field: 'adjustmentType', op: '==', value: adjustment_type });

        const { items, total } = await queryCollection<StockAdjustment>(
          COLLECTIONS.STOCK_ADJUSTMENTS,
          {
            filters,
            orderByField: 'createdAt',
            orderByDirection: 'desc',
            limit: date_from || date_to ? limit * 3 : limit,
            offset: date_from || date_to ? 0 : offset,
          }
        );

        let filtered = items;
        if (date_from) {
          const from = new Date(date_from).getTime();
          filtered = filtered.filter((a) => {
            const ts = a.createdAt;
            if (!ts) return true;
            const d = typeof (ts as { toDate?: unknown }).toDate === 'function'
              ? (ts as { toDate: () => Date }).toDate().getTime()
              : 0;
            return d >= from;
          });
        }
        if (date_to) {
          const to = new Date(date_to + 'T23:59:59Z').getTime();
          filtered = filtered.filter((a) => {
            const ts = a.createdAt;
            if (!ts) return true;
            const d = typeof (ts as { toDate?: unknown }).toDate === 'function'
              ? (ts as { toDate: () => Date }).toDate().getTime()
              : Infinity;
            return d <= to;
          });
        }

        const paginated =
          date_from || date_to ? filtered.slice(offset, offset + limit) : filtered.slice(0, limit);
        const hasMore =
          date_from || date_to
            ? offset + paginated.length < filtered.length
            : offset + paginated.length < total;

        if (paginated.length === 0) {
          return {
            content: [{ type: 'text', text: 'No stock adjustments found matching your filters.' }],
          };
        }

        if (response_format === 'json') {
          const result = {
            total: date_from || date_to ? filtered.length : total,
            count: paginated.length,
            offset,
            limit,
            hasMore,
            items: paginated.map((a) => serializeDoc(a as unknown as Record<string, unknown>)),
          };
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        const lines: string[] = [
          `## Stock Adjustments (${paginated.length} shown)\n`,
          `| Adj # | Type | Status | Line Items | Net Value | Created By | Date |`,
          `|-------|------|--------|-----------|-----------|-----------|------|`,
        ];

        for (const adj of paginated) {
          const lineCount = adj.lineCount ?? (adj.lineItems ?? []).length;
          lines.push(
            `| ${adj.adjustmentNumber ?? adj.id.slice(0, 8)} | ${adj.adjustmentType ?? '-'} | ${adj.status ?? '-'} | ${lineCount} | ${formatCurrency(adj.netValueImpact)} | ${adj.createdBy ?? '-'} | ${formatTimestamp(adj.createdAt)} |`
          );
        }

        if (hasMore) {
          lines.push(`\n_Use offset=${offset + limit} for next page._`);
        }

        return { content: [{ type: 'text', text: truncateIfNeeded(lines.join('\n')) }] };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error listing stock adjustments: ${(error as Error).message}` }],
        };
      }
    }
  );

  // ─── Tool 5: Create Inventory Item ───────────────────────────────────────────
  server.registerTool(
    'dawinos_create_inventory_item',
    {
      title: 'Create Inventory Item',
      description: `Create a new inventory item in DawinOS.

The item is created with status='active', source='manual', stockOnHand=0.
Default tier is 'catalogue' (permanent stock). Use tier='project' for job-specific items.
Required: sku, name, category, unit.

Category is dynamic — run dawinos_list_categories to see current list.
Common unit values: pcs, m2, m, lm, kg, L, set.`,
      inputSchema: {
        sku: z.string().min(1).describe('Stock keeping unit — must be unique'),
        name: z.string().min(1).describe('Item display name'),
        category: z
          .string().min(1)
          .describe('Category slug (validated at runtime against inventoryCategories collection)'),
        unit: z.string().min(1).describe('Unit of measure: pcs, m2, m, lm, kg, L, set'),
        purchase_uom: z.string().optional().describe('UOM when purchased (e.g. "box", "roll")'),
        stock_uom: z.string().optional().describe('UOM when stored (e.g. "pcs", "m")'),
        description: z.string().optional(),
        classification: z.string().optional().describe('Classification, e.g. raw-material, finished-good, consumable'),
        cost_price: z.number().nonnegative().optional().describe('Cost per unit'),
        currency: z.enum(['UGX', 'USD']).optional().default('UGX'),
        reorder_level: z.number().nonnegative().optional().default(0),
        tags: z.array(z.string()).optional().describe('Search tags'),
        primary_supplier: z.string().optional().describe('Supplier name'),
        is_family: z.boolean().optional().default(false).describe('True if this is a product family (parent)'),
        family_id: z.string().optional().describe('Parent family document ID (for child SKUs)'),
        tier: z.enum(INVENTORY_TIERS).optional().default('catalogue').describe('Item tier: catalogue (permanent) or project (job-specific)'),
        restockable: z.boolean().optional().default(true).describe('Whether item can be reordered'),
        project_ids: z.array(z.string()).optional().default([]).describe('Project/MO IDs for project-tier items'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        // Validate category against dynamic registry
        const catError = await validateCategorySlug(params.category);
        if (catError) return { content: [{ type: 'text', text: catError }] };

        const db = getDb();
        const currency = params.currency ?? 'UGX';

        const docData: Record<string, unknown> = {
          sku: params.sku,
          name: params.name,
          category: params.category,
          unit: params.unit,
          ...(params.purchase_uom !== undefined ? { purchaseUom: params.purchase_uom } : {}),
          ...(params.stock_uom !== undefined ? { stockUom: params.stock_uom } : {}),
          description: params.description ?? '',
          classification: params.classification ?? null,
          status: 'active',
          isFamily: params.is_family ?? false,
          isOrderable: !(params.is_family ?? false),
          isBomSelectable: true,
          familyId: params.family_id ?? null,
          tags: params.tags ?? [],
          aliases: [],
          tier: params.tier ?? 'catalogue',
          restockable: params.restockable ?? true,
          linkedProjectIds: params.project_ids ?? [],
          source: 'manual',
          preferredSupplierName: params.primary_supplier ?? null,
          inventory: {
            inStock: 0,
            reorderLevel: params.reorder_level ?? 0,
          },
          pricing: {
            costPerUnit: params.cost_price ?? null,
            currency,
            unit: params.unit,
          },
          createdAt: serverTimestamp(),
          createdBy: 'mcp-agent',
          updatedAt: serverTimestamp(),
          updatedBy: 'mcp-agent',
        };

        const ref = await db.collection(COLLECTIONS.INVENTORY_ITEMS).add(docData);

        return {
          content: [
            {
              type: 'text',
              text: `## Inventory Item Created\n\n**ID:** ${ref.id}\n**SKU:** ${params.sku}\n**Name:** ${params.name}\n**Category:** ${params.category}\n**Unit:** ${params.unit}\n**Cost Price:** ${params.cost_price != null ? formatCurrency(params.cost_price, currency) : 'N/A'}\n**Reorder Level:** ${params.reorder_level ?? 0}\n**Status:** active`,
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error creating inventory item: ${(err as Error).message}` }],
        };
      }
    }
  );

  // ─── Tool 6: Update Inventory Item ───────────────────────────────────────────
  server.registerTool(
    'dawinos_update_inventory_item',
    {
      title: 'Update Inventory Item',
      description: `Update fields on an existing inventory item (partial update).

Supports renaming the SKU, changing name/description/category/status, updating pricing
(writes canonical \`pricing.costPerUnit\`/\`pricing.currency\`/\`pricing.unit\`), adjusting
reorder level, changing tier (catalogue/project), toggling restockable, and setting
classification/primary_supplier/tags/project links.

Brand-cleanup surface: \`display_name\`, \`aliases\`, \`brand\`. If \`name\` changes and
\`display_name\` is not provided, \`displayName\` mirrors \`name\` automatically.

Safety rails:
  - \`dry_run: true\` (default: false) — computes the diff and all pre-checks WITHOUT
    writing. Use for every rename or sensitive change before committing.
  - SKU uniqueness is pre-checked. If \`sku\` collides with another item the tool aborts
    with a collision warning.
  - Cross-reference scan runs whenever \`sku\` changes. If BOQ rows / POs / quotes /
    manufacturing orders reference this item, warnings are surfaced. To proceed anyway,
    pass \`allow_cross_ref: true\`.

Returns a WriteEnvelope: planned/committed counts, the full diff, warnings, errors.`,
      inputSchema: {
        item_id: z.string().min(1).describe('Inventory item document ID'),
        sku: z.string().min(1).optional().describe('Rename SKU (uniqueness pre-checked)'),
        name: z.string().optional(),
        display_name: z.string().optional().describe('Override displayName independently of name. If omitted and name is set, displayName mirrors name.'),
        aliases: z.array(z.string()).optional().describe('Search aliases array (full replacement)'),
        brand: z.string().nullable().optional().describe('Brand label. Pass null to clear.'),
        description: z.string().optional(),
        category: z
          .string()
          .optional()
          .describe('Category slug (validated at runtime against inventoryCategories collection)'),
        unit: z.string().optional(),
        purchase_uom: z.string().optional().describe('UOM when purchased (e.g. "box", "roll")'),
        stock_uom: z.string().optional().describe('UOM when stored (e.g. "pcs", "m")'),
        status: z.enum(INVENTORY_STATUSES).optional(),
        cost_price: z.number().nonnegative().optional(),
        currency: z.enum(['UGX', 'USD']).optional(),
        reorder_level: z.number().nonnegative().optional(),
        classification: z.string().optional(),
        primary_supplier: z.string().optional(),
        tags: z.array(z.string()).optional(),
        tier: z.enum(INVENTORY_TIERS).optional().describe('Item tier'),
        restockable: z.boolean().optional().describe('Whether item can be reordered'),
        project_ids: z.array(z.string()).optional().describe('Project/MO IDs — replaces linkedProjectIds'),
        dry_run: z
          .boolean()
          .default(false)
          .describe('If true, compute diff + checks only. No writes. Default false.'),
        allow_cross_ref: z
          .boolean()
          .default(false)
          .describe(
            'If true, cross-reference warnings on SKU rename are demoted to info (still surfaced, not blocking). Default false = warnings block commit.'
          ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const toolName = 'dawinos_update_inventory_item';
      const env: WriteEnvelope = emptyEnvelope(params.dry_run ? 'dry_run' : 'commit');
      try {
        // Validate category against dynamic registry
        if (params.category !== undefined) {
          const catError = await validateCategorySlug(params.category);
          if (catError) {
            env.errors.push(catError);
            return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
          }
        }

        const item = await loadItem(params.item_id);
        if (!item) {
          env.errors.push(`Inventory item "${params.item_id}" not found.`);
          return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
        }

        const before = item.data;
        const beforeSku = (before['sku'] as string) || '';
        const beforeName = (before['name'] as string) || '';

        // Build the Firestore write (dot-notation for nested partial updates) and
        // a parallel list of human-readable changes for the envelope diff.
        const update: Record<string, unknown> = {};
        const changes: Array<{ path: string; before: unknown; after: unknown }> = [];
        const existingPricing = (before['pricing'] as Record<string, unknown>) || {};
        const existingInventory = (before['inventory'] as Record<string, unknown>) || {};

        const recordChange = (path: string, prev: unknown, next: unknown) => {
          if (!deepEqual(prev, next)) changes.push({ path, before: prev, after: next });
        };

        if (params.sku !== undefined && params.sku !== beforeSku) {
          update['sku'] = params.sku;
          recordChange('sku', beforeSku, params.sku);
        }
        if (params.name !== undefined && params.name !== before['name']) {
          update['name'] = params.name;
          recordChange('name', before['name'], params.name);
        }
        if (params.display_name !== undefined && params.display_name !== before['displayName']) {
          update['displayName'] = params.display_name;
          recordChange('displayName', before['displayName'], params.display_name);
        }
        if (params.aliases !== undefined && !deepEqual(params.aliases, before['aliases'])) {
          update['aliases'] = params.aliases;
          recordChange('aliases', before['aliases'], params.aliases);
        }
        if (params.brand !== undefined && params.brand !== before['brand']) {
          update['brand'] = params.brand;
          recordChange('brand', before['brand'], params.brand);
        }
        // Mirror: if name changed but display_name was not provided, keep
        // displayName in lockstep with name.
        if (
          params.name !== undefined &&
          params.display_name === undefined &&
          params.name !== before['displayName']
        ) {
          update['displayName'] = params.name;
          recordChange('displayName', before['displayName'], params.name);
        }
        if (params.description !== undefined && params.description !== before['description']) {
          update['description'] = params.description;
          recordChange('description', before['description'], params.description);
        }
        if (params.category !== undefined && params.category !== before['category']) {
          update['category'] = params.category;
          recordChange('category', before['category'], params.category);
        }
        if (params.unit !== undefined && params.unit !== before['unit']) {
          update['unit'] = params.unit;
          update['pricing.unit'] = params.unit;
          recordChange('unit', before['unit'], params.unit);
          recordChange('pricing.unit', existingPricing['unit'], params.unit);
        }
        if (params.purchase_uom !== undefined && params.purchase_uom !== before['purchaseUom']) {
          update['purchaseUom'] = params.purchase_uom;
          recordChange('purchaseUom', before['purchaseUom'], params.purchase_uom);
        }
        if (params.stock_uom !== undefined && params.stock_uom !== before['stockUom']) {
          update['stockUom'] = params.stock_uom;
          recordChange('stockUom', before['stockUom'], params.stock_uom);
        }
        if (params.status !== undefined && params.status !== before['status']) {
          update['status'] = params.status;
          recordChange('status', before['status'], params.status);
        }
        if (params.cost_price !== undefined && params.cost_price !== existingPricing['costPerUnit']) {
          update['pricing.costPerUnit'] = params.cost_price;
          recordChange('pricing.costPerUnit', existingPricing['costPerUnit'], params.cost_price);
          // Clear orphan top-level costPrice from legacy writes.
          if (before['costPrice'] !== undefined) update['costPrice'] = FieldValue.delete();
        }
        if (params.currency !== undefined && params.currency !== existingPricing['currency']) {
          update['pricing.currency'] = params.currency;
          recordChange('pricing.currency', existingPricing['currency'], params.currency);
          if (before['currency'] !== undefined) update['currency'] = FieldValue.delete();
        }
        if (
          params.reorder_level !== undefined &&
          params.reorder_level !== existingInventory['reorderLevel']
        ) {
          update['inventory.reorderLevel'] = params.reorder_level;
          recordChange('inventory.reorderLevel', existingInventory['reorderLevel'], params.reorder_level);
        }
        if (params.classification !== undefined && params.classification !== before['classification']) {
          update['classification'] = params.classification;
          recordChange('classification', before['classification'], params.classification);
        }
        if (
          params.primary_supplier !== undefined &&
          params.primary_supplier !== before['preferredSupplierName']
        ) {
          update['preferredSupplierName'] = params.primary_supplier;
          recordChange('preferredSupplierName', before['preferredSupplierName'], params.primary_supplier);
        }
        if (params.tags !== undefined && !deepEqual(params.tags, before['tags'])) {
          update['tags'] = params.tags;
          recordChange('tags', before['tags'], params.tags);
        }
        if (params.tier !== undefined && params.tier !== before['tier']) {
          update['tier'] = params.tier;
          recordChange('tier', before['tier'], params.tier);
        }
        if (params.restockable !== undefined && params.restockable !== before['restockable']) {
          update['restockable'] = params.restockable;
          recordChange('restockable', before['restockable'], params.restockable);
        }
        if (
          params.project_ids !== undefined &&
          !deepEqual(params.project_ids, before['linkedProjectIds'])
        ) {
          update['linkedProjectIds'] = params.project_ids;
          recordChange('linkedProjectIds', before['linkedProjectIds'], params.project_ids);
        }

        // No-op short circuit.
        if (Object.keys(update).length === 0) {
          env.warnings.push({
            kind: 'noop',
            itemId: params.item_id,
            message: 'No fields provided to update.',
          });
          return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
        }

        // SKU uniqueness pre-check.
        if (params.sku !== undefined && params.sku !== beforeSku) {
          const owner = await findSkuCollision(params.sku, params.item_id);
          if (owner) {
            env.warnings.push({
              kind: 'collision',
              itemId: params.item_id,
              message: `SKU "${params.sku}" is already owned by ${owner}. Aborting.`,
            });
            return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
          }
        }

        // Cross-reference scan — only on SKU rename (the only change where
        // downstream systems might care about the old identifier).
        if (params.sku !== undefined && params.sku !== beforeSku) {
          const xrefWarnings = await scanSkuReferences(params.item_id, { oldSku: beforeSku });
          env.warnings.push(...xrefWarnings);
          if (xrefWarnings.length > 0 && !params.allow_cross_ref) {
            env.errors.push(
              `SKU rename blocked by cross-reference warnings. Pass allow_cross_ref: true to proceed.`
            );
            return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
          }
        }

        const diff: ItemDiff = {
          itemId: params.item_id,
          sku: beforeSku,
          name: beforeName,
          changes,
        };
        env.diffs.push(diff);
        env.itemsPlanned = 1;

        if (params.dry_run) {
          return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
        }

        // Commit.
        const result = await commitBatch([{ ref: item.ref, update }], toolName);
        env.itemsCommitted = result.committed;
        env.errors.push(...result.errors);

        return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
      } catch (err) {
        env.errors.push(`Error: ${(err as Error).message}`);
        return {
          isError: true,
          content: [{ type: 'text', text: formatEnvelope(env, toolName) }],
        };
      }
    }
  );

  // ─── Tool 7: Create Stock Adjustment ─────────────────────────────────────────
  server.registerTool(
    'dawinos_create_stock_adjustment',
    {
      title: 'Create Stock Adjustment',
      description: `Create a stock adjustment in DawinOS (draft status).

A Cloud Function trigger automatically assigns an adjustment number (ADJ-YYYY-NNNN).
The adjustment is created as draft — it will be auto-approved if the total value is below
the auto-approval threshold (500,000 UGX) and the type is eligible.

Adjustment types:
  physical_count_variance — result of a stock count discrepancy
  damage_spoilage         — damaged or spoiled goods
  shrinkage_loss          — unexplained loss
  offcut_adjustment       — offcut/scrap material
  correction              — data correction

Each line item needs: inventory_item_id, item_name, adjustment_type (increase|decrease), quantity, unit_cost.`,
      inputSchema: {
        type: z
          .enum(['physical_count_variance', 'damage_spoilage', 'shrinkage_loss', 'offcut_adjustment', 'correction'])
          .describe('Type of adjustment'),
        reason: z.string().min(1).describe('Reason for the adjustment'),
        line_items: z
          .array(
            z.object({
              inventory_item_id: z.string().min(1),
              item_name: z.string().min(1),
              adjustment_type: z.enum(['increase', 'decrease']),
              quantity: z.number().positive(),
              unit_cost: z.number().nonnegative(),
              notes: z.string().optional(),
            })
          )
          .min(1)
          .describe('Items to adjust — at least one required'),
        notes: z.string().optional().describe('Overall adjustment notes'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const db = getDb();

        const lineItems = params.line_items.map((li) => ({
          inventoryItemId: li.inventory_item_id,
          itemName: li.item_name,
          adjustmentType: li.adjustment_type,
          quantity: li.quantity,
          unitCost: li.unit_cost,
          totalValue: li.quantity * li.unit_cost,
          notes: li.notes ?? null,
        }));

        const totalIncreaseValue = lineItems
          .filter((li) => li.adjustmentType === 'increase')
          .reduce((s, li) => s + li.totalValue, 0);
        const totalDecreaseValue = lineItems
          .filter((li) => li.adjustmentType === 'decrease')
          .reduce((s, li) => s + li.totalValue, 0);
        const netValueImpact = totalIncreaseValue - totalDecreaseValue;

        const docData: Record<string, unknown> = {
          adjustmentNumber: '',   // assigned by Cloud Function trigger
          type: params.type,
          reason: params.reason,
          notes: params.notes ?? null,
          status: 'draft',
          lineItems,
          itemIds: lineItems.map((li) => li.inventoryItemId),
          totalIncreaseValue,
          totalDecreaseValue,
          netValueImpact,
          lineCount: lineItems.length,
          organizationId: 'default',
          subsidiaryId: null,
          isAutoApproved: false,
          qboSyncStatus: 'pending',
          createdBy: 'mcp-agent',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const ref = await db.collection(COLLECTIONS.STOCK_ADJUSTMENTS).add(docData);

        return {
          content: [
            {
              type: 'text',
              text: `## Stock Adjustment Created\n\n**ID:** ${ref.id}\n**Type:** ${params.type}\n**Reason:** ${params.reason}\n**Line Items:** ${lineItems.length}\n**Net Value Impact:** ${formatCurrency(netValueImpact)}\n  ↑ Increases: ${formatCurrency(totalIncreaseValue)}\n  ↓ Decreases: ${formatCurrency(totalDecreaseValue)}\n**Status:** draft\n\nAdjustment number will be assigned automatically. If total value ≤ UGX 500,000 and type is eligible, it will be auto-approved.`,
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error creating stock adjustment: ${(err as Error).message}` }],
        };
      }
    }
  );

  // ─── Tool 8: Delete Inventory Item ───────────────────────────────────────────
  server.registerTool(
    'dawinos_delete_inventory_item',
    {
      title: 'Delete Inventory Item',
      description: `Permanently delete an inventory item from DawinOS.

⚠️ This is irreversible. Only delete items that have no stock movements, no BOM references,
and no linked purchase orders. For items you want to retire, prefer updating status to
'discontinued' using dawinos_update_inventory_item instead.

Requires confirmation: pass confirm=true to execute. Without it, returns a dry-run summary.`,
      inputSchema: {
        item_id: z.string().min(1).describe('Inventory item document ID to delete'),
        confirm: z.boolean().default(false).describe('Must be true to actually delete. Without it, returns a dry-run preview.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const db = getDb();
        const ref = db.collection(COLLECTIONS.INVENTORY_ITEMS).doc(params.item_id);
        const snap = await ref.get();

        if (!snap.exists) {
          return { content: [{ type: 'text', text: `Inventory item "${params.item_id}" not found.` }] };
        }

        const data = snap.data()!;
        const name = (data['name'] as string) ?? params.item_id;
        const sku = (data['sku'] as string) ?? 'N/A';
        const stockOnHand = (data['stockOnHand'] as number) ?? 0;

        if (!params.confirm) {
          return {
            content: [
              {
                type: 'text',
                text: `## Delete Preview (dry run)\n\n**Item:** ${name} (SKU: ${sku})\n**ID:** ${params.item_id}\n**Current Stock On Hand:** ${stockOnHand}\n\n⚠️ This action is **irreversible**.\n${stockOnHand > 0 ? `\n🚨 **Warning:** This item has ${stockOnHand} units in stock. Deleting it will not update stock levels.\n` : ''}\nTo confirm deletion, call again with \`confirm: true\`.`,
              },
            ],
          };
        }

        await ref.delete();

        return {
          content: [
            {
              type: 'text',
              text: `**Deleted:** ${name} (SKU: ${sku}, ID: ${params.item_id})`,
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error deleting inventory item: ${(err as Error).message}` }],
        };
      }
    }
  );

  // ─── Tool 9: Batch Update Inventory ──────────────────────────────────────────
  server.registerTool(
    'dawinos_batch_update_inventory',
    {
      title: 'Batch Update Inventory Items',
      description: `Update multiple inventory items in a single call (up to 50 items).

Each update targets one item by ID and can change any combination of:
name, description, category, unit, purchase_uom, stock_uom, status, cost_price,
currency, reorder_level, classification, primary_supplier, tags, tier, restockable, project_ids.

Category is dynamic — run dawinos_list_categories to see current list.

All updates are applied atomically in a single Firestore batch write.
Returns a summary of how many succeeded or failed.`,
      inputSchema: {
        updates: z
          .array(
            z.object({
              item_id: z.string().min(1),
              name: z.string().optional(),
              description: z.string().optional(),
              category: z.string().optional(),
              unit: z.string().optional(),
              purchase_uom: z.string().optional(),
              stock_uom: z.string().optional(),
              status: z.enum(INVENTORY_STATUSES).optional(),
              cost_price: z.number().nonnegative().optional(),
              currency: z.enum(['UGX', 'USD']).optional(),
              reorder_level: z.number().nonnegative().optional(),
              classification: z.string().optional(),
              primary_supplier: z.string().optional(),
              tags: z.array(z.string()).optional(),
              tier: z.enum(INVENTORY_TIERS).optional(),
              restockable: z.boolean().optional(),
              project_ids: z.array(z.string()).optional(),
            })
          )
          .min(1)
          .max(50)
          .describe('Array of item updates — 1 to 50 items'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        // Validate all categories upfront
        const catsToCheck = params.updates.map(u => u.category).filter(Boolean) as string[];
        if (catsToCheck.length > 0) {
          const validSlugs = await getValidCategorySlugs();
          const invalid = [...new Set(catsToCheck)].filter(c => !validSlugs.includes(c));
          if (invalid.length > 0) {
            return { content: [{ type: 'text', text: `Invalid categories: ${invalid.join(', ')}. Valid: ${validSlugs.join(', ')}` }] };
          }
        }

        const db = getDb();
        const batch = db.batch();
        const results: Array<{ item_id: string; status: 'queued' | 'skipped'; fields: string[] }> = [];

        for (const u of params.updates) {
          const ref = db.collection(COLLECTIONS.INVENTORY_ITEMS).doc(u.item_id);
          const update: Record<string, unknown> = {
            updatedAt: serverTimestamp(),
            updatedBy: 'mcp-agent',
          };
          const changed: string[] = [];

          if (u.name !== undefined) { update['name'] = u.name; changed.push('name'); }
          if (u.description !== undefined) { update['description'] = u.description; changed.push('description'); }
          if (u.category !== undefined) { update['category'] = u.category; changed.push('category'); }
          if (u.unit !== undefined) {
            update['unit'] = u.unit;
            update['pricing.unit'] = u.unit;
            changed.push('unit');
          }
          if (u.purchase_uom !== undefined) { update['purchaseUom'] = u.purchase_uom; changed.push('purchaseUom'); }
          if (u.stock_uom !== undefined) { update['stockUom'] = u.stock_uom; changed.push('stockUom'); }
          if (u.status !== undefined) { update['status'] = u.status; changed.push('status'); }
          if (u.cost_price !== undefined) {
            update['pricing.costPerUnit'] = u.cost_price;
            update['costPrice'] = FieldValue.delete();
            changed.push('pricing.costPerUnit');
          }
          if (u.currency !== undefined) {
            update['pricing.currency'] = u.currency;
            update['currency'] = FieldValue.delete();
            changed.push('pricing.currency');
          }
          if (u.reorder_level !== undefined) {
            update['inventory.reorderLevel'] = u.reorder_level;
            changed.push('inventory.reorderLevel');
          }
          if (u.classification !== undefined) { update['classification'] = u.classification; changed.push('classification'); }
          if (u.primary_supplier !== undefined) { update['preferredSupplierName'] = u.primary_supplier; changed.push('preferredSupplierName'); }
          if (u.tags !== undefined) { update['tags'] = u.tags; changed.push('tags'); }
          if (u.tier !== undefined) { update['tier'] = u.tier; changed.push('tier'); }
          if (u.restockable !== undefined) { update['restockable'] = u.restockable; changed.push('restockable'); }
          if (u.project_ids !== undefined) { update['linkedProjectIds'] = u.project_ids; changed.push('linkedProjectIds'); }

          if (changed.length === 0) {
            results.push({ item_id: u.item_id, status: 'skipped', fields: [] });
            continue;
          }

          batch.update(ref, update);
          results.push({ item_id: u.item_id, status: 'queued', fields: changed });
        }

        const queued = results.filter((r) => r.status === 'queued');
        const skipped = results.filter((r) => r.status === 'skipped');

        if (queued.length === 0) {
          return { content: [{ type: 'text', text: 'No fields provided for any item — nothing updated.' }] };
        }

        await batch.commit();

        const lines = [
          `## Batch Update Complete`,
          `**Updated:** ${queued.length} items | **Skipped (no fields):** ${skipped.length} items`,
          '',
          ...queued.map((r) => `- \`${r.item_id}\` → ${r.fields.join(', ')}`),
        ];
        if (skipped.length > 0) {
          lines.push('', `**Skipped IDs:** ${skipped.map((r) => r.item_id).join(', ')}`);
        }

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error in batch update: ${(err as Error).message}` }],
        };
      }
    }
  );

  // ─── Tool 10: Set Family Definitions ─────────────────────────────────────────
  server.registerTool(
    'dawinos_set_family_definitions',
    {
      title: 'Set Family Variant Attribute Definitions',
      description: `Set the \`variantAttributeDefinitions\` array on a family parent item.

Use this to add, remove, or replace the list of variant axes a family uses (e.g.
["quality_tier", "overlay"]). Typical use case: stripping brand/model axes during
a catalog cleanup, or adding a new axis to an existing family.

The item MUST have \`isFamily: true\`. The tool aborts otherwise.

Parameters:
  - \`definitions\`: full replacement array (mode=replace, default)
  - \`add\`: axes to add to the existing array (mode=modify)
  - \`remove\`: axes to remove from the existing array (mode=modify)

Pick ONE mode — do not combine \`definitions\` with \`add\`/\`remove\`.

Returns a WriteEnvelope with the diff.`,
      inputSchema: {
        item_id: z.string().min(1).describe('Family parent document ID'),
        definitions: z
          .array(z.string())
          .optional()
          .describe('Full replacement array. Use this OR add/remove, not both.'),
        add: z.array(z.string()).optional().describe('Axes to add (modify mode)'),
        remove: z.array(z.string()).optional().describe('Axes to remove (modify mode)'),
        dry_run: z.boolean().default(false).describe('Compute diff without writing. Default false.'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const toolName = 'dawinos_set_family_definitions';
      const env: WriteEnvelope = emptyEnvelope(params.dry_run ? 'dry_run' : 'commit');
      try {
        const item = await loadItem(params.item_id);
        if (!item) {
          env.errors.push(`Inventory item "${params.item_id}" not found.`);
          return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
        }

        if (!item.data['isFamily']) {
          env.errors.push(
            `Item ${params.item_id} is not a family parent (isFamily !== true). Refusing to set variantAttributeDefinitions.`
          );
          return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
        }

        const hasReplace = Array.isArray(params.definitions);
        const hasModify = Array.isArray(params.add) || Array.isArray(params.remove);
        if (hasReplace && hasModify) {
          env.errors.push(`Pass either "definitions" OR add/remove, not both.`);
          return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
        }
        if (!hasReplace && !hasModify) {
          env.errors.push(`No changes requested. Pass "definitions", "add", or "remove".`);
          return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
        }

        const before = (item.data['variantAttributeDefinitions'] as string[]) || [];
        let after: string[];
        if (hasReplace) {
          after = [...params.definitions!];
        } else {
          const set = new Set(before);
          for (const a of params.add || []) set.add(a);
          for (const r of params.remove || []) set.delete(r);
          after = [...set];
        }

        if (deepEqual(before, after)) {
          env.warnings.push({
            kind: 'noop',
            itemId: params.item_id,
            message: 'variantAttributeDefinitions already in the requested state.',
          });
          return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
        }

        env.diffs.push({
          itemId: params.item_id,
          sku: (item.data['sku'] as string) || '',
          name: (item.data['name'] as string) || '',
          changes: [{ path: 'variantAttributeDefinitions', before, after }],
        });
        env.itemsPlanned = 1;

        if (params.dry_run) {
          return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
        }

        const result = await commitBatch(
          [{ ref: item.ref, update: { variantAttributeDefinitions: after } }],
          toolName
        );
        env.itemsCommitted = result.committed;
        env.errors.push(...result.errors);

        return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
      } catch (err) {
        env.errors.push(`Error: ${(err as Error).message}`);
        return { isError: true, content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
      }
    }
  );

  // ─── Tool 11: Set Variant Attributes ─────────────────────────────────────────
  server.registerTool(
    'dawinos_set_variant_attributes',
    {
      title: 'Set Child Item Variant Attributes',
      description: `Set or modify the \`variantAttributes\` array on a child item, and
optionally the \`parametricTags\` map kept in sync with it.

variantAttributes is an array of {key, value} pairs. parametricTags is a flat map
used for indexing. The two are usually kept in sync — if you change one, change the other.

Modes (pick one):
  - \`attributes\`: full replacement array
  - \`set\`: object of {axis: value} to merge (existing axes updated, new ones appended)
  - \`remove_keys\`: axes to delete from the array

\`parametric_tags\` is applied independently — if provided, it REPLACES the map entirely
(pass the full desired map; use \`sync_tags: true\` to auto-derive it from variantAttributes).

Returns a WriteEnvelope with the diff.`,
      inputSchema: {
        item_id: z.string().min(1).describe('Child inventory item ID'),
        attributes: z
          .array(z.object({ key: z.string(), value: z.any() }))
          .optional()
          .describe('Full replacement variantAttributes array'),
        set: z
          .record(z.any())
          .optional()
          .describe('Axis→value updates to merge into existing array'),
        remove_keys: z.array(z.string()).optional().describe('Axes to delete'),
        parametric_tags: z
          .record(z.any())
          .optional()
          .describe('Full replacement parametricTags map'),
        sync_tags: z
          .boolean()
          .default(false)
          .describe('If true, derive parametricTags from the new variantAttributes array'),
        dry_run: z.boolean().default(false).describe('Compute diff without writing. Default false.'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const toolName = 'dawinos_set_variant_attributes';
      const env: WriteEnvelope = emptyEnvelope(params.dry_run ? 'dry_run' : 'commit');
      try {
        const item = await loadItem(params.item_id);
        if (!item) {
          env.errors.push(`Inventory item "${params.item_id}" not found.`);
          return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
        }

        const modes = [
          Array.isArray(params.attributes),
          params.set !== undefined,
          Array.isArray(params.remove_keys),
        ].filter(Boolean).length;
        if (modes > 1) {
          env.errors.push(`Pass exactly one of: attributes, set, remove_keys.`);
          return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
        }
        if (
          modes === 0 &&
          params.parametric_tags === undefined &&
          !params.sync_tags
        ) {
          env.errors.push(`No changes requested.`);
          return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
        }

        const beforeAttrs =
          (item.data['variantAttributes'] as Array<{ key: string; value: unknown }>) || [];
        const beforeTags = (item.data['parametricTags'] as Record<string, unknown>) || {};

        // Compute new attributes.
        let afterAttrs: Array<{ key: string; value: unknown }>;
        if (Array.isArray(params.attributes)) {
          afterAttrs = params.attributes.map((a) => ({ key: a.key, value: a.value }));
        } else if (params.set) {
          const byKey = new Map(beforeAttrs.map((a) => [a.key, a]));
          for (const [k, v] of Object.entries(params.set)) {
            byKey.set(k, { key: k, value: v });
          }
          afterAttrs = [...byKey.values()];
        } else if (Array.isArray(params.remove_keys)) {
          const removeSet = new Set(params.remove_keys);
          afterAttrs = beforeAttrs.filter((a) => !removeSet.has(a.key));
        } else {
          afterAttrs = beforeAttrs;
        }

        // Compute new tags.
        let afterTags: Record<string, unknown>;
        if (params.parametric_tags !== undefined) {
          afterTags = { ...params.parametric_tags };
        } else if (params.sync_tags) {
          afterTags = {};
          for (const a of afterAttrs) afterTags[a.key] = a.value;
        } else {
          afterTags = beforeTags;
        }

        const update: Record<string, unknown> = {};
        const changes = [];
        if (!deepEqual(beforeAttrs, afterAttrs)) {
          update['variantAttributes'] = afterAttrs;
          changes.push({ path: 'variantAttributes', before: beforeAttrs, after: afterAttrs });
        }
        if (!deepEqual(beforeTags, afterTags)) {
          update['parametricTags'] = afterTags;
          changes.push({ path: 'parametricTags', before: beforeTags, after: afterTags });
        }

        if (Object.keys(update).length === 0) {
          env.warnings.push({
            kind: 'noop',
            itemId: params.item_id,
            message: 'No effective change to variantAttributes or parametricTags.',
          });
          return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
        }

        env.diffs.push({
          itemId: params.item_id,
          sku: (item.data['sku'] as string) || '',
          name: (item.data['name'] as string) || '',
          changes,
        });
        env.itemsPlanned = 1;

        if (params.dry_run) {
          return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
        }

        const result = await commitBatch([{ ref: item.ref, update }], toolName);
        env.itemsCommitted = result.committed;
        env.errors.push(...result.errors);
        return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
      } catch (err) {
        env.errors.push(`Error: ${(err as Error).message}`);
        return { isError: true, content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
      }
    }
  );

  // ─── Tool 12: Update Family Membership ───────────────────────────────────────
  server.registerTool(
    'dawinos_update_family_membership',
    {
      title: 'Update Family Membership',
      description: `Attach or detach a child item from a family parent.

Keeps both sides in sync in a single batch:
  - Parent's \`familySkuIds\` array (adds or removes the child ID)
  - Child's \`familyId\` field (set or cleared)
  - Child's \`parentItemId\` field (set or cleared, some data has both)

Modes:
  - \`action: "attach"\` — parent gains child in familySkuIds, child gains familyId
  - \`action: "detach"\` — parent drops child, child clears familyId+parentItemId

Pre-checks:
  - Parent must have \`isFamily: true\`
  - On attach, if child already has a different \`familyId\`, aborts unless
    \`allow_reparent: true\`

Returns a WriteEnvelope showing both doc diffs.`,
      inputSchema: {
        parent_id: z.string().min(1).describe('Family parent inventory item ID'),
        child_id: z.string().min(1).describe('Child inventory item ID'),
        action: z.enum(['attach', 'detach']).describe('attach or detach'),
        allow_reparent: z
          .boolean()
          .default(false)
          .describe('Allow attach even if child belongs to another family'),
        dry_run: z.boolean().default(false).describe('Compute diff without writing. Default false.'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const toolName = 'dawinos_update_family_membership';
      const env: WriteEnvelope = emptyEnvelope(params.dry_run ? 'dry_run' : 'commit');
      try {
        const [parent, child] = await Promise.all([
          loadItem(params.parent_id),
          loadItem(params.child_id),
        ]);
        if (!parent) {
          env.errors.push(`Parent "${params.parent_id}" not found.`);
          return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
        }
        if (!child) {
          env.errors.push(`Child "${params.child_id}" not found.`);
          return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
        }
        if (!parent.data['isFamily']) {
          env.errors.push(`Parent ${params.parent_id} is not a family (isFamily !== true).`);
          return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
        }

        const beforeIds = (parent.data['familySkuIds'] as string[]) || [];
        const beforeFamilyId = (child.data['familyId'] as string) || '';
        const beforeParentItemId = (child.data['parentItemId'] as string) || '';

        let afterIds: string[];
        let afterChildFamilyId: string | null;
        let afterChildParentItemId: string | null;

        if (params.action === 'attach') {
          if (beforeFamilyId && beforeFamilyId !== params.parent_id && !params.allow_reparent) {
            env.errors.push(
              `Child ${params.child_id} already belongs to family ${beforeFamilyId}. Pass allow_reparent: true to move it.`
            );
            return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
          }
          afterIds = beforeIds.includes(params.child_id)
            ? beforeIds
            : [...beforeIds, params.child_id];
          afterChildFamilyId = params.parent_id;
          afterChildParentItemId = params.parent_id;
        } else {
          afterIds = beforeIds.filter((id) => id !== params.child_id);
          afterChildFamilyId = null;
          afterChildParentItemId = null;
        }

        const parentUpdate: Record<string, unknown> = {};
        const childUpdate: Record<string, unknown> = {};
        const parentChanges = [];
        const childChanges = [];

        if (!deepEqual(beforeIds, afterIds)) {
          parentUpdate['familySkuIds'] = afterIds;
          parentChanges.push({ path: 'familySkuIds', before: beforeIds, after: afterIds });
        }
        if (beforeFamilyId !== (afterChildFamilyId || '')) {
          if (afterChildFamilyId === null) {
            childUpdate['familyId'] = FieldValue.delete();
          } else {
            childUpdate['familyId'] = afterChildFamilyId;
          }
          childChanges.push({
            path: 'familyId',
            before: beforeFamilyId || undefined,
            after: afterChildFamilyId || undefined,
          });
        }
        if (beforeParentItemId !== (afterChildParentItemId || '')) {
          if (afterChildParentItemId === null) {
            childUpdate['parentItemId'] = FieldValue.delete();
          } else {
            childUpdate['parentItemId'] = afterChildParentItemId;
          }
          childChanges.push({
            path: 'parentItemId',
            before: beforeParentItemId || undefined,
            after: afterChildParentItemId || undefined,
          });
        }

        if (Object.keys(parentUpdate).length === 0 && Object.keys(childUpdate).length === 0) {
          env.warnings.push({
            kind: 'noop',
            itemId: params.child_id,
            message: `Membership already in the requested state (action=${params.action}).`,
          });
          return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
        }

        if (parentChanges.length > 0) {
          env.diffs.push({
            itemId: params.parent_id,
            sku: (parent.data['sku'] as string) || '',
            name: (parent.data['name'] as string) || '',
            changes: parentChanges,
          });
          env.itemsPlanned++;
        }
        if (childChanges.length > 0) {
          env.diffs.push({
            itemId: params.child_id,
            sku: (child.data['sku'] as string) || '',
            name: (child.data['name'] as string) || '',
            changes: childChanges,
          });
          env.itemsPlanned++;
        }

        if (params.dry_run) {
          return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
        }

        const writes = [];
        if (Object.keys(parentUpdate).length > 0) {
          writes.push({ ref: parent.ref, update: parentUpdate });
        }
        if (Object.keys(childUpdate).length > 0) {
          writes.push({ ref: child.ref, update: childUpdate });
        }
        const result = await commitBatch(writes, toolName);
        env.itemsCommitted = result.committed;
        env.errors.push(...result.errors);
        return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
      } catch (err) {
        env.errors.push(`Error: ${(err as Error).message}`);
        return { isError: true, content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
      }
    }
  );

  // ─── Tool 13: Batch Inventory Rewrite ────────────────────────────────────────
  server.registerTool(
    'dawinos_batch_inventory_rewrite',
    {
      title: 'Batch Inventory Rewrite',
      description: `Apply arbitrary partial patches to many inventory items in one call.

Designed to replace bespoke brand-cleanup Firebase Admin scripts. Each patch targets
one item by ID and can set any combination of:

  - \`sku\`, \`name\`, \`description\`, \`status\`, \`category\`, \`unit\`
  - \`display_name\`, \`aliases\`, \`brand\`, \`tags\`, \`preferred_supplier_name\` (brand-cleanup surface)
  - \`variant_attributes\` (full replacement array)
  - \`parametric_tags\` (full replacement map)
  - \`variant_attribute_definitions\` (full replacement array — family parents only)
  - \`cost_price\`, \`currency\` (writes nested pricing.*)

If \`name\` is patched but \`display_name\` is not, \`displayName\` is mirrored from \`name\`
to keep list-view labels in lockstep with the canonical name.

Safety rails (MATCH the single-item tool):
  - \`dry_run: true\` by DEFAULT for this batch tool. Pass \`dry_run: false\` to commit.
  - SKU uniqueness pre-checked across the entire batch + the collection at rest.
  - Missing items surface as \`missing\` warnings (batch proceeds with the rest).
  - Max 500 patches per call.

Returns a WriteEnvelope with all per-item diffs, collision warnings, and errors.`,
      inputSchema: {
        patches: z
          .array(
            z.object({
              item_id: z.string().min(1),
              sku: z.string().optional(),
              name: z.string().optional(),
              description: z.string().optional(),
              status: z.enum(['active', 'discontinued', 'out-of-stock']).optional(),
              category: z.string().optional(),
              unit: z.string().optional(),
              display_name: z.string().optional(),
              aliases: z.array(z.string()).optional(),
              brand: z.string().nullable().optional(),
              tags: z.array(z.string()).optional(),
              preferred_supplier_name: z.string().nullable().optional(),
              variant_attributes: z
                .array(z.object({ key: z.string(), value: z.any() }))
                .optional(),
              parametric_tags: z.record(z.any()).optional(),
              variant_attribute_definitions: z.array(z.string()).optional(),
              cost_price: z.number().nonnegative().optional(),
              currency: z.enum(['UGX', 'USD']).optional(),
            })
          )
          .min(1)
          .max(500)
          .describe('Array of patches (1 to 500)'),
        dry_run: z
          .boolean()
          .default(true)
          .describe('If true (DEFAULT for this tool), compute diff without writing.'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const toolName = 'dawinos_batch_inventory_rewrite';
      const env: WriteEnvelope = emptyEnvelope(params.dry_run ? 'dry_run' : 'commit');
      try {
        // Validate all categories upfront
        const catsToCheck = params.patches.map((p: any) => p.category).filter(Boolean) as string[];
        if (catsToCheck.length > 0) {
          const validSlugs = await getValidCategorySlugs();
          const invalid = [...new Set(catsToCheck)].filter(c => !validSlugs.includes(c));
          if (invalid.length > 0) {
            env.errors.push(`Invalid categories: ${invalid.join(', ')}. Valid: ${validSlugs.join(', ')}`);
            return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
          }
        }

        // Load all items in parallel. Missing items surface as warnings, not fatal.
        const loaded = await Promise.all(
          params.patches.map(async (p) => ({ patch: p, item: await loadItem(p.item_id) }))
        );

        const writes: Array<{ ref: FirebaseFirestore.DocumentReference; update: Record<string, unknown> }> = [];
        const skuRenames: Array<{ itemId: string; newSku: string }> = [];

        for (const { patch, item } of loaded) {
          if (!item) {
            env.warnings.push({
              kind: 'missing',
              itemId: patch.item_id,
              message: `Item ${patch.item_id} not found. Skipping.`,
            });
            continue;
          }

          const before = item.data;
          const update: Record<string, unknown> = {};
          const changes: Array<{ path: string; before: unknown; after: unknown }> = [];

          const beforeSku = (before['sku'] as string) || '';

          if (patch.sku !== undefined && patch.sku !== beforeSku) {
            update['sku'] = patch.sku;
            changes.push({ path: 'sku', before: beforeSku, after: patch.sku });
            skuRenames.push({ itemId: patch.item_id, newSku: patch.sku });
          }
          if (patch.name !== undefined && patch.name !== before['name']) {
            update['name'] = patch.name;
            changes.push({ path: 'name', before: before['name'], after: patch.name });
          }
          if (patch.description !== undefined && patch.description !== before['description']) {
            update['description'] = patch.description;
            changes.push({
              path: 'description',
              before: before['description'],
              after: patch.description,
            });
          }
          if (patch.status !== undefined && patch.status !== before['status']) {
            update['status'] = patch.status;
            changes.push({ path: 'status', before: before['status'], after: patch.status });
          }
          if (patch.category !== undefined && patch.category !== before['category']) {
            update['category'] = patch.category;
            changes.push({ path: 'category', before: before['category'], after: patch.category });
          }
          if (patch.unit !== undefined && patch.unit !== before['unit']) {
            update['unit'] = patch.unit;
            changes.push({ path: 'unit', before: before['unit'], after: patch.unit });
          }
          if (patch.display_name !== undefined && patch.display_name !== before['displayName']) {
            update['displayName'] = patch.display_name;
            changes.push({ path: 'displayName', before: before['displayName'], after: patch.display_name });
          }
          if (patch.aliases !== undefined && !deepEqual(patch.aliases, before['aliases'])) {
            update['aliases'] = patch.aliases;
            changes.push({ path: 'aliases', before: before['aliases'], after: patch.aliases });
          }
          if (patch.brand !== undefined && patch.brand !== before['brand']) {
            update['brand'] = patch.brand;
            changes.push({ path: 'brand', before: before['brand'], after: patch.brand });
          }
          if (patch.tags !== undefined && !deepEqual(patch.tags, before['tags'])) {
            update['tags'] = patch.tags;
            changes.push({ path: 'tags', before: before['tags'], after: patch.tags });
          }
          if (
            patch.preferred_supplier_name !== undefined &&
            patch.preferred_supplier_name !== before['preferredSupplierName']
          ) {
            update['preferredSupplierName'] = patch.preferred_supplier_name;
            changes.push({
              path: 'preferredSupplierName',
              before: before['preferredSupplierName'],
              after: patch.preferred_supplier_name,
            });
          }
          // Mirror: if name was patched but display_name was not, keep displayName
          // in lockstep with name. Matches the item-creation lifecycle.
          if (
            patch.name !== undefined &&
            patch.display_name === undefined &&
            patch.name !== before['displayName']
          ) {
            update['displayName'] = patch.name;
            changes.push({
              path: 'displayName',
              before: before['displayName'],
              after: patch.name,
            });
          }
          if (patch.variant_attributes !== undefined) {
            const beforeAttrs = before['variantAttributes'] || [];
            if (!deepEqual(beforeAttrs, patch.variant_attributes)) {
              update['variantAttributes'] = patch.variant_attributes;
              changes.push({
                path: 'variantAttributes',
                before: beforeAttrs,
                after: patch.variant_attributes,
              });
            }
          }
          if (patch.parametric_tags !== undefined) {
            const beforeTags = before['parametricTags'] || {};
            if (!deepEqual(beforeTags, patch.parametric_tags)) {
              update['parametricTags'] = patch.parametric_tags;
              changes.push({
                path: 'parametricTags',
                before: beforeTags,
                after: patch.parametric_tags,
              });
            }
          }
          if (patch.variant_attribute_definitions !== undefined) {
            if (!before['isFamily']) {
              env.warnings.push({
                kind: 'other',
                itemId: patch.item_id,
                message: `Tried to set variantAttributeDefinitions on non-family item. Skipping this field.`,
              });
            } else {
              const beforeDefs = before['variantAttributeDefinitions'] || [];
              if (!deepEqual(beforeDefs, patch.variant_attribute_definitions)) {
                update['variantAttributeDefinitions'] = patch.variant_attribute_definitions;
                changes.push({
                  path: 'variantAttributeDefinitions',
                  before: beforeDefs,
                  after: patch.variant_attribute_definitions,
                });
              }
            }
          }
          if (patch.cost_price !== undefined || patch.currency !== undefined) {
            const existingPricing = (before['pricing'] as Record<string, unknown>) || {};
            const newPricing: Record<string, unknown> = { ...existingPricing };
            if (patch.cost_price !== undefined) newPricing['costPerUnit'] = patch.cost_price;
            if (patch.currency !== undefined) newPricing['currency'] = patch.currency;
            if (!deepEqual(existingPricing, newPricing)) {
              update['pricing'] = newPricing;
              changes.push({ path: 'pricing', before: existingPricing, after: newPricing });
            }
          }

          if (Object.keys(update).length === 0) continue;

          writes.push({ ref: item.ref, update });
          env.diffs.push({
            itemId: patch.item_id,
            sku: beforeSku,
            name: (before['name'] as string) || '',
            changes,
          });
        }

        env.itemsPlanned = writes.length;

        // SKU collision pre-check across the whole batch.
        if (skuRenames.length > 0) {
          const collisions = await findBatchSkuCollisions(skuRenames);
          env.warnings.push(...collisions);
          if (collisions.length > 0) {
            env.errors.push(
              `Batch aborted: ${collisions.length} SKU collision(s). No writes performed.`
            );
            return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
          }
        }

        if (params.dry_run) {
          return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
        }

        if (writes.length === 0) {
          env.warnings.push({
            kind: 'noop',
            message: 'No effective changes — every patch was a no-op.',
          });
          return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
        }

        const result = await commitBatch(writes, toolName);
        env.itemsCommitted = result.committed;
        env.errors.push(...result.errors);

        return { content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
      } catch (err) {
        env.errors.push(`Error: ${(err as Error).message}`);
        return { isError: true, content: [{ type: 'text', text: formatEnvelope(env, toolName) }] };
      }
    }
  );
}
