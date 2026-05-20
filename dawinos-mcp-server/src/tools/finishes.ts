/**
 * Finish Library write surface.
 *
 * Pairs with the read-only `dawinos_get_finish_library` tool in inventory.ts.
 * All writes target COLLECTIONS.FINISH_LIBRARY with organizationId=DEFAULT_ORG_ID.
 *
 * Tool inventory:
 *   - dawinos_create_finish_library_entry
 *   - dawinos_update_finish_library_entry
 *   - dawinos_delete_finish_library_entry   (soft by default, hard_delete opt-in)
 *   - dawinos_bulk_import_finishes          (batch insert, up to 50 rows)
 *   - dawinos_link_finish_to_inventory      (add/remove linked inventory IDs)
 *
 * Category validation uses the STATIC FINISH_CATEGORIES enum, not the dynamic
 * inventoryCategories registry — these are different taxonomies.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb, serverTimestamp } from '../services/firebase.js';
import {
  COLLECTIONS,
  DEFAULT_ORG_ID,
  FINISH_CATEGORIES,
} from '../constants.js';

const AVAILABILITY_VALUES = ['in_stock', 'made_to_order', 'discontinued', 'seasonal'] as const;
const PATTERN_VALUES = [
  'solid', 'woodgrain', 'marble', 'textile', 'geometric', 'speckled', 'custom',
] as const;
const SOURCE_VALUES = ['manual', 'supplier_catalogue', 'imported'] as const;

const AGENT_USER = 'mcp-agent';
const MAX_BULK_ROWS = 50;

// ─── Shared entry schema (used by create + bulk) ─────────────────────────────

const finishEntrySchema = z.object({
  code: z.string().min(1).describe('Finish code / SKU — should be unique'),
  name: z.string().min(1).describe('Display name (e.g. "PG Bison Supamatt White")'),
  category: z.enum(FINISH_CATEGORIES).describe(`Finish category: ${FINISH_CATEGORIES.join(' | ')}`),
  subtype: z.string().min(1).describe('Subtype within category (e.g. "melamine", "gloss")'),
  hex: z.string().optional().describe('Primary hex colour, e.g. "#FAFAFA"'),
  secondary_hex: z.string().optional().describe('Secondary hex for woodgrain/marble patterns'),
  pattern: z.enum(PATTERN_VALUES).optional().describe(`Pattern type: ${PATTERN_VALUES.join(' | ')}`),
  availability: z.enum(AVAILABILITY_VALUES).default('in_stock').describe('Availability state'),
  tags: z.array(z.string()).optional().default([]),
  notes: z.string().optional(),
  thumbnail_url: z.string().optional(),
  cost_modifier: z.number().optional().describe('Pricing delta vs base'),
  cost_modifier_type: z.enum(['percentage', 'absolute']).optional(),
  cost_modifier_unit: z.string().optional(),
  linked_inventory_ids: z
    .array(z.string()).optional().default([])
    .describe('Inventory item IDs this finish is supplied by (one finish → many SKU variants)'),
  primary_supplier: z.string().optional().describe('Supplier name for catalogue traceability'),
  is_active: z.boolean().optional().default(true),
  source: z.enum(SOURCE_VALUES).optional().default('manual'),
});
type FinishEntry = z.infer<typeof finishEntrySchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build the Firestore doc payload from a validated entry. Strips undefined
 * fields so Firestore doesn't reject the write.
 */
function buildDocData(entry: FinishEntry, timestamps: {
  createdAt?: FirebaseFirestore.FieldValue;
  updatedAt: FirebaseFirestore.FieldValue;
}): Record<string, unknown> {
  const data: Record<string, unknown> = {
    organizationId: DEFAULT_ORG_ID,
    code: entry.code,
    name: entry.name,
    category: entry.category,
    subtype: entry.subtype,
    availability: entry.availability,
    tags: entry.tags ?? [],
    isActive: entry.is_active ?? true,
    source: entry.source ?? 'manual',
    linkedInventoryItemIds: entry.linked_inventory_ids ?? [],
    updatedAt: timestamps.updatedAt,
    updatedBy: AGENT_USER,
  };
  if (timestamps.createdAt) {
    data.createdAt = timestamps.createdAt;
    data.createdBy = AGENT_USER;
  }
  if (entry.hex !== undefined) data.hexColor = entry.hex;
  if (entry.secondary_hex !== undefined) data.secondaryColor = entry.secondary_hex;
  if (entry.pattern !== undefined) data.patternType = entry.pattern;
  if (entry.notes !== undefined) data.notes = entry.notes;
  if (entry.thumbnail_url !== undefined) data.thumbnailUrl = entry.thumbnail_url;
  if (entry.cost_modifier !== undefined) data.costModifier = entry.cost_modifier;
  if (entry.cost_modifier_type !== undefined) data.costModifierType = entry.cost_modifier_type;
  if (entry.cost_modifier_unit !== undefined) data.costModifierUnit = entry.cost_modifier_unit;
  if (entry.primary_supplier !== undefined) data.primarySupplier = entry.primary_supplier;
  // Legacy singular mirror: if exactly one linked ID is supplied, also write
  // `inventoryItemId` so readers still on the old field keep working.
  if ((entry.linked_inventory_ids ?? []).length === 1) {
    data.inventoryItemId = entry.linked_inventory_ids![0];
  }
  return data;
}

/**
 * Check that every linked inventory ID exists. Returns the list of missing IDs
 * — callers decide whether that's a warning or an abort.
 */
async function findMissingInventoryIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  const results = await Promise.all(
    ids.map((id) => db.collection(COLLECTIONS.INVENTORY_ITEMS).doc(id).get())
  );
  return ids.filter((_, i) => !results[i].exists);
}

async function findDuplicateCode(code: string, excludeId?: string): Promise<string | null> {
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.FINISH_LIBRARY)
    .where('organizationId', '==', DEFAULT_ORG_ID)
    .where('code', '==', code)
    .limit(2)
    .get();
  const hit = snap.docs.find((d) => d.id !== excludeId);
  return hit ? hit.id : null;
}

// ─── Tool registrations ──────────────────────────────────────────────────────

export function registerFinishTools(server: McpServer): void {
  // ─── Create ────────────────────────────────────────────────────────────────
  server.registerTool(
    'dawinos_create_finish_library_entry',
    {
      title: 'Create Finish Library Entry',
      description: `Create a single finish in the DawinOS Finish Library.

Writes to the finishLibrary collection scoped to organizationId='${DEFAULT_ORG_ID}'.
Category is validated against the static FINISH_CATEGORIES enum (${FINISH_CATEGORIES.join(' | ')}).
\`code\` uniqueness is pre-checked within the organization — the tool aborts on collision.
If \`linked_inventory_ids\` is supplied, each ID is verified to exist in inventoryItems;
missing IDs surface as a warning but do not block creation.`,
      inputSchema: finishEntrySchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const entry = params as FinishEntry;
        const duplicate = await findDuplicateCode(entry.code);
        if (duplicate) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Code collision: another finish with code "${entry.code}" already exists (id=${duplicate}). Use dawinos_update_finish_library_entry instead.`,
            }],
          };
        }

        const warnings: string[] = [];
        const missing = await findMissingInventoryIds(entry.linked_inventory_ids ?? []);
        if (missing.length > 0) {
          warnings.push(`Linked inventory IDs not found: ${missing.join(', ')} (finish was still created — fix links via dawinos_link_finish_to_inventory)`);
        }

        const now = serverTimestamp();
        const docData = buildDocData(entry, { createdAt: now, updatedAt: now });

        const db = getDb();
        const ref = await db.collection(COLLECTIONS.FINISH_LIBRARY).add(docData);

        const lines = [
          `## Finish Created`,
          ``,
          `**ID:** ${ref.id}`,
          `**Code:** ${entry.code}`,
          `**Name:** ${entry.name}`,
          `**Category / Subtype:** ${entry.category} / ${entry.subtype}`,
          `**Availability:** ${entry.availability}`,
          `**Active:** ${entry.is_active ?? true}`,
          `**Linked inventory:** ${(entry.linked_inventory_ids ?? []).length} items`,
        ];
        if (warnings.length > 0) {
          lines.push(``, `### Warnings`, ...warnings.map((w) => `- ⚠️ ${w}`));
        }

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error creating finish: ${(err as Error).message}` }],
        };
      }
    }
  );

  // ─── Update ────────────────────────────────────────────────────────────────
  server.registerTool(
    'dawinos_update_finish_library_entry',
    {
      title: 'Update Finish Library Entry',
      description: `Partial update of an existing finish. Supply the fields to change.

Supports dry_run=true to preview the diff without writing. Renaming \`code\`
triggers a uniqueness pre-check that aborts on collision.`,
      inputSchema: {
        finish_id: z.string().min(1).describe('Finish document ID'),
        code: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
        category: z.enum(FINISH_CATEGORIES).optional(),
        subtype: z.string().min(1).optional(),
        hex: z.string().optional(),
        secondary_hex: z.string().optional(),
        pattern: z.enum(PATTERN_VALUES).optional(),
        availability: z.enum(AVAILABILITY_VALUES).optional(),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
        thumbnail_url: z.string().optional(),
        cost_modifier: z.number().optional(),
        cost_modifier_type: z.enum(['percentage', 'absolute']).optional(),
        cost_modifier_unit: z.string().optional(),
        linked_inventory_ids: z.array(z.string()).optional()
          .describe('Full replacement for the linked inventory list. Use dawinos_link_finish_to_inventory for incremental changes.'),
        primary_supplier: z.string().optional(),
        is_active: z.boolean().optional(),
        source: z.enum(SOURCE_VALUES).optional(),
        dry_run: z.boolean().default(false).describe('If true, compute the diff but do not write'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const { finish_id, dry_run, ...updates } = params as Record<string, unknown> & {
          finish_id: string;
          dry_run?: boolean;
        };

        const db = getDb();
        const ref = db.collection(COLLECTIONS.FINISH_LIBRARY).doc(finish_id);
        const snap = await ref.get();
        if (!snap.exists) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Finish ${finish_id} not found.` }],
          };
        }

        if (typeof updates.code === 'string') {
          const duplicate = await findDuplicateCode(updates.code, finish_id);
          if (duplicate) {
            return {
              isError: true,
              content: [{
                type: 'text',
                text: `Code collision: "${updates.code}" is already used by finish ${duplicate}.`,
              }],
            };
          }
        }

        const fieldMap: Record<string, string> = {
          code: 'code',
          name: 'name',
          category: 'category',
          subtype: 'subtype',
          hex: 'hexColor',
          secondary_hex: 'secondaryColor',
          pattern: 'patternType',
          availability: 'availability',
          tags: 'tags',
          notes: 'notes',
          thumbnail_url: 'thumbnailUrl',
          cost_modifier: 'costModifier',
          cost_modifier_type: 'costModifierType',
          cost_modifier_unit: 'costModifierUnit',
          linked_inventory_ids: 'linkedInventoryItemIds',
          primary_supplier: 'primarySupplier',
          is_active: 'isActive',
          source: 'source',
        };

        const before = snap.data() ?? {};
        const patch: Record<string, unknown> = {};
        const diff: { field: string; before: unknown; after: unknown }[] = [];

        for (const [apiKey, firestoreKey] of Object.entries(fieldMap)) {
          if (updates[apiKey] === undefined) continue;
          const next = updates[apiKey];
          const prev = before[firestoreKey];
          if (JSON.stringify(prev) === JSON.stringify(next)) continue;
          patch[firestoreKey] = next;
          diff.push({ field: firestoreKey, before: prev, after: next });
        }

        const warnings: string[] = [];
        if (Array.isArray(updates.linked_inventory_ids)) {
          const missing = await findMissingInventoryIds(updates.linked_inventory_ids as string[]);
          if (missing.length > 0) {
            warnings.push(`Linked inventory IDs not found: ${missing.join(', ')}`);
          }
        }

        if (diff.length === 0) {
          return { content: [{ type: 'text', text: `No changes detected for finish ${finish_id}.` }] };
        }

        const renderedDiff = diff
          .map((d) => `  - ${d.field}: ${JSON.stringify(d.before)} → ${JSON.stringify(d.after)}`)
          .join('\n');

        if (dry_run) {
          const lines = [
            `## Dry run — ${diff.length} field(s) would change`,
            ``,
            renderedDiff,
          ];
          if (warnings.length > 0) {
            lines.push(``, `### Warnings`, ...warnings.map((w) => `- ⚠️ ${w}`));
          }
          return { content: [{ type: 'text', text: lines.join('\n') }] };
        }

        patch.updatedAt = serverTimestamp();
        patch.updatedBy = AGENT_USER;
        await ref.update(patch);

        const lines = [
          `## Finish Updated`,
          ``,
          `**ID:** ${finish_id}`,
          ``,
          renderedDiff,
        ];
        if (warnings.length > 0) {
          lines.push(``, `### Warnings`, ...warnings.map((w) => `- ⚠️ ${w}`));
        }
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error updating finish: ${(err as Error).message}` }],
        };
      }
    }
  );

  // ─── Delete ────────────────────────────────────────────────────────────────
  server.registerTool(
    'dawinos_delete_finish_library_entry',
    {
      title: 'Delete Finish Library Entry',
      description: `Archive a finish. Default behavior is a SOFT delete (sets isActive=false).

Pass hard_delete=true to permanently remove the document. Hard delete warns if
the finish has linked inventory items, because BOQs / quotes may still reference
it by code.`,
      inputSchema: {
        finish_id: z.string().min(1),
        hard_delete: z.boolean().default(false).describe('If true, physically delete the document'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const { finish_id, hard_delete } = params as { finish_id: string; hard_delete?: boolean };
        const db = getDb();
        const ref = db.collection(COLLECTIONS.FINISH_LIBRARY).doc(finish_id);
        const snap = await ref.get();
        if (!snap.exists) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Finish ${finish_id} not found.` }],
          };
        }
        const data = snap.data() ?? {};
        const linkCount = Array.isArray(data.linkedInventoryItemIds)
          ? data.linkedInventoryItemIds.length
          : 0;

        if (hard_delete) {
          await ref.delete();
          const warning = linkCount > 0
            ? `\n\n⚠️ This finish had ${linkCount} linked inventory item(s). Any BOQ/quote references are now dangling.`
            : '';
          return {
            content: [{
              type: 'text',
              text: `## Finish Hard-Deleted\n\n**ID:** ${finish_id}\n**Code:** ${data.code ?? '—'}${warning}`,
            }],
          };
        }

        if (data.isActive === false) {
          return {
            content: [{ type: 'text', text: `Finish ${finish_id} is already archived.` }],
          };
        }
        await ref.update({
          isActive: false,
          updatedAt: serverTimestamp(),
          updatedBy: AGENT_USER,
        });
        return {
          content: [{
            type: 'text',
            text: `## Finish Archived (soft delete)\n\n**ID:** ${finish_id}\n**Code:** ${data.code ?? '—'}\n\nPass hard_delete=true to permanently remove.`,
          }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error deleting finish: ${(err as Error).message}` }],
        };
      }
    }
  );

  // ─── Bulk import ───────────────────────────────────────────────────────────
  server.registerTool(
    'dawinos_bulk_import_finishes',
    {
      title: 'Bulk Import Finishes',
      description: `Atomic batch insert of finishes (up to ${MAX_BULK_ROWS} rows).

All rows are validated up front — if ANY row fails validation or has a code
that collides with an existing finish or a sibling row in the same batch, the
whole import aborts with a per-row report. On success the batch commits
atomically, so either all rows land or none do.`,
      inputSchema: {
        entries: z
          .array(finishEntrySchema)
          .min(1)
          .max(MAX_BULK_ROWS)
          .describe(`Finish entries (1-${MAX_BULK_ROWS})`),
        default_source: z.enum(SOURCE_VALUES).optional().default('imported')
          .describe('Source tag applied to entries that do not specify one'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const { entries, default_source } = params as {
          entries: FinishEntry[];
          default_source: (typeof SOURCE_VALUES)[number];
        };

        // Sibling-row collision check
        const codeToIndex = new Map<string, number>();
        for (let i = 0; i < entries.length; i++) {
          const code = entries[i].code;
          if (codeToIndex.has(code)) {
            return {
              isError: true,
              content: [{
                type: 'text',
                text: `Duplicate code in batch: "${code}" appears at rows ${codeToIndex.get(code)! + 1} and ${i + 1}.`,
              }],
            };
          }
          codeToIndex.set(code, i);
        }

        // Check against existing docs
        const db = getDb();
        const existing = await Promise.all(
          entries.map((e) => findDuplicateCode(e.code))
        );
        const existingCollisions = existing
          .map((hit, i) => (hit ? { code: entries[i].code, existingId: hit } : null))
          .filter((x): x is { code: string; existingId: string } => x !== null);
        if (existingCollisions.length > 0) {
          const lines = [
            `Batch aborted — ${existingCollisions.length} row(s) collide with existing finishes:`,
            ...existingCollisions.map((c) => `  - ${c.code} (existing id=${c.existingId})`),
          ];
          return { isError: true, content: [{ type: 'text', text: lines.join('\n') }] };
        }

        // Pre-flight inventory-link verification across all entries
        const allIds = Array.from(new Set(entries.flatMap((e) => e.linked_inventory_ids ?? [])));
        const missingIds = new Set(await findMissingInventoryIds(allIds));

        const batch = db.batch();
        const now = serverTimestamp();
        const created: { code: string; id: string }[] = [];
        for (const entry of entries) {
          const entryWithSource = { ...entry, source: entry.source ?? default_source };
          const ref = db.collection(COLLECTIONS.FINISH_LIBRARY).doc();
          batch.set(ref, buildDocData(entryWithSource, { createdAt: now, updatedAt: now }));
          created.push({ code: entry.code, id: ref.id });
        }
        await batch.commit();

        const lines = [
          `## Bulk Import Complete`,
          ``,
          `**Rows inserted:** ${created.length}`,
          ``,
          `| Code | New ID |`,
          `|------|--------|`,
          ...created.map((c) => `| ${c.code} | ${c.id} |`),
        ];
        if (missingIds.size > 0) {
          lines.push(
            ``,
            `### Warnings`,
            `- ⚠️ Unknown linked inventory IDs referenced by one or more rows: ${Array.from(missingIds).join(', ')}`,
          );
        }

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error in bulk import: ${(err as Error).message}` }],
        };
      }
    }
  );

  // ─── Link / unlink inventory ───────────────────────────────────────────────
  server.registerTool(
    'dawinos_link_finish_to_inventory',
    {
      title: 'Link Finish to Inventory',
      description: `Attach or detach inventory item IDs from a finish's linkedInventoryItemIds array.

Use when a finish needs to point at its concrete SKU variants (e.g. 16mm / 18mm
sheet). Non-destructive — won't touch the legacy singular \`inventoryItemId\`.`,
      inputSchema: {
        finish_id: z.string().min(1),
        add: z.array(z.string()).optional().default([]).describe('Inventory IDs to attach'),
        remove: z.array(z.string()).optional().default([]).describe('Inventory IDs to detach'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const { finish_id, add, remove } = params as {
          finish_id: string;
          add: string[];
          remove: string[];
        };

        if (add.length === 0 && remove.length === 0) {
          return { content: [{ type: 'text', text: 'No add/remove IDs supplied.' }] };
        }

        const db = getDb();
        const ref = db.collection(COLLECTIONS.FINISH_LIBRARY).doc(finish_id);
        const snap = await ref.get();
        if (!snap.exists) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Finish ${finish_id} not found.` }],
          };
        }

        const warnings: string[] = [];
        const missing = await findMissingInventoryIds(add);
        if (missing.length > 0) {
          warnings.push(`Inventory IDs not found (still linked as requested): ${missing.join(', ')}`);
        }

        const current: string[] = Array.isArray(snap.data()?.linkedInventoryItemIds)
          ? (snap.data()!.linkedInventoryItemIds as string[])
          : [];
        const next = new Set(current);
        for (const id of add) next.add(id);
        for (const id of remove) next.delete(id);
        const nextArr = Array.from(next);

        await ref.update({
          linkedInventoryItemIds: nextArr,
          updatedAt: serverTimestamp(),
          updatedBy: AGENT_USER,
        });

        const lines = [
          `## Finish Links Updated`,
          ``,
          `**Finish:** ${finish_id}`,
          `**Added:** ${add.length} | **Removed:** ${remove.length}`,
          `**Total linked now:** ${nextArr.length}`,
        ];
        if (warnings.length > 0) {
          lines.push(``, `### Warnings`, ...warnings.map((w) => `- ⚠️ ${w}`));
        }
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error updating finish links: ${(err as Error).message}` }],
        };
      }
    }
  );
}
