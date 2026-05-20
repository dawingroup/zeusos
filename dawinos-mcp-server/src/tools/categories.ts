/**
 * MCP Tools for Inventory Category Management
 *
 * dawinos_list_categories   — List all categories (tree or flat)
 * dawinos_create_category   — Create a new category
 * dawinos_update_category   — Update an existing category
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb, serverTimestamp, serializeDoc, formatTimestamp } from '../services/firebase.js';
import { invalidateCategoryCache } from '../services/categoryRegistry.js';

const COLLECTION = 'inventoryCategories';
const MAX_DEPTH = 3;

function toKebab(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

interface CategoryNode {
  slug: string;
  name: string;
  depth: number;
  sortOrder: number;
  parentSlug: string | null;
  allowItems: boolean;
  expenseOnIssue: boolean;
  isSystem: boolean;
  isActive: boolean;
  itemCount: number;
  icon: string | null;
  color: string | null;
  description: string | null;
  children: CategoryNode[];
}

function buildTree(items: CategoryNode[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];

  for (const item of items) {
    map.set(item.slug, { ...item, children: [] });
  }

  for (const item of items) {
    const node = map.get(item.slug)!;
    if (item.parentSlug && map.has(item.parentSlug)) {
      map.get(item.parentSlug)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function renderTree(nodes: CategoryNode[], indent = 0): string {
  const lines: string[] = [];
  for (const node of nodes) {
    const prefix = '  '.repeat(indent);
    const flags: string[] = [];
    if (!node.isActive) flags.push('INACTIVE');
    if (node.isSystem) flags.push('system');
    if (!node.allowItems) flags.push('group-only');
    if (node.expenseOnIssue) flags.push('expense-on-issue');
    const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
    lines.push(`${prefix}- **${node.name}** (\`${node.slug}\`) — ${node.itemCount} items${flagStr}`);
    if (node.children.length > 0) {
      lines.push(renderTree(node.children, indent + 1));
    }
  }
  return lines.join('\n');
}

export function registerCategoryTools(server: McpServer): void {
  // ─── List Categories ──────────────────────────────────────────────────────
  server.registerTool(
    'dawinos_list_categories',
    {
      title: 'List Inventory Categories',
      description: `List all inventory categories with hierarchy, item counts, and behavior flags.

Returns a tree view by default, or a flat list with flat=true.
Use include_inactive=true to see disabled categories.`,
      inputSchema: {
        include_inactive: z.boolean().default(false).describe('Include disabled categories'),
        flat: z.boolean().default(false).describe('Return flat list instead of tree structure'),
        response_format: z.enum(['markdown', 'json']).default('markdown'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const db = getDb();
        let query: FirebaseFirestore.Query = db.collection(COLLECTION).orderBy('sortOrder');
        if (!params.include_inactive) {
          query = query.where('isActive', '==', true);
        }

        const snap = await query.get();
        const items: CategoryNode[] = snap.docs.map(d => {
          const data = d.data();
          return {
            slug: d.id,
            name: data.name,
            depth: data.depth ?? 0,
            sortOrder: data.sortOrder ?? 0,
            parentSlug: data.parentSlug ?? null,
            allowItems: data.allowItems ?? true,
            expenseOnIssue: data.expenseOnIssue ?? false,
            isSystem: data.isSystem ?? false,
            isActive: data.isActive ?? true,
            itemCount: data.itemCount ?? 0,
            icon: data.icon ?? null,
            color: data.color ?? null,
            description: data.description ?? null,
            children: [],
          };
        });

        if (params.response_format === 'json') {
          const result = params.flat ? items : buildTree(items);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        // Markdown
        if (params.flat) {
          const header = '| Slug | Name | Parent | Items | Flags |';
          const sep = '|------|------|--------|-------|-------|';
          const rows = items.map(c => {
            const flags: string[] = [];
            if (!c.isActive) flags.push('inactive');
            if (c.isSystem) flags.push('system');
            if (!c.allowItems) flags.push('group');
            if (c.expenseOnIssue) flags.push('expense');
            return `| ${c.slug} | ${c.name} | ${c.parentSlug || '—'} | ${c.itemCount} | ${flags.join(', ') || '—'} |`;
          });
          return { content: [{ type: 'text', text: `## Inventory Categories\n\n${header}\n${sep}\n${rows.join('\n')}` }] };
        }

        const tree = buildTree(items);
        const text = `## Inventory Categories\n\n${renderTree(tree)}\n\nTotal: ${items.length} categories`;
        return { content: [{ type: 'text', text }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error listing categories: ${err.message}` }], isError: true };
      }
    },
  );

  // ─── Create Category ──────────────────────────────────────────────────────
  server.registerTool(
    'dawinos_create_category',
    {
      title: 'Create Inventory Category',
      description: `Create a new inventory category.

The slug is auto-generated from the name if omitted. dry_run defaults to true — set to false to commit.`,
      inputSchema: {
        name: z.string().min(1).max(100).describe('Display name'),
        slug: z.string().min(2).max(50).optional().describe('URL-safe identifier. Auto-generated from name if omitted.'),
        description: z.string().optional(),
        parent_slug: z.string().optional().describe('Slug of parent category for nesting. Omit for top-level.'),
        icon: z.string().optional().describe('Lucide icon name'),
        color: z.string().optional().describe('Hex color for badge, e.g. "#4A90D9"'),
        allow_items: z.boolean().default(true).describe('False for grouping nodes that hold no items directly'),
        default_classification: z.enum(['material', 'product', 'kit']).optional(),
        expense_on_issue: z.boolean().default(false).describe('If true, items trigger expense journal on stock issue'),
        sort_order: z.number().int().optional().describe('Order within parent level. Auto-assigned if omitted.'),
        dry_run: z.boolean().default(true).describe('Compute diff without writing. Default true.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const db = getDb();
        const slug = params.slug || toKebab(params.name);

        // Validate slug format
        if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length >= 2) {
          return { content: [{ type: 'text', text: `Invalid slug "${slug}". Must be kebab-case (lowercase letters, numbers, hyphens).` }] };
        }

        // Check uniqueness
        const existing = await db.collection(COLLECTION).doc(slug).get();
        if (existing.exists) {
          return { content: [{ type: 'text', text: `Category "${slug}" already exists.` }] };
        }

        // Validate parent
        let depth = 0;
        let path: string[] = [];
        if (params.parent_slug) {
          const parentDoc = await db.collection(COLLECTION).doc(params.parent_slug).get();
          if (!parentDoc.exists) {
            return { content: [{ type: 'text', text: `Parent category "${params.parent_slug}" not found.` }] };
          }
          const parentData = parentDoc.data()!;
          depth = (parentData.depth ?? 0) + 1;
          path = [...(parentData.path ?? []), params.parent_slug];

          if (depth >= MAX_DEPTH) {
            return { content: [{ type: 'text', text: `Maximum nesting depth is ${MAX_DEPTH}. Parent "${params.parent_slug}" is at depth ${parentData.depth}.` }] };
          }
        }

        // Auto-assign sort order
        let sortOrder = params.sort_order;
        if (sortOrder === undefined) {
          const siblings = await db.collection(COLLECTION)
            .where('parentSlug', '==', params.parent_slug ?? null)
            .orderBy('sortOrder', 'desc')
            .limit(1)
            .get();
          sortOrder = siblings.empty ? 0 : (siblings.docs[0].data().sortOrder ?? 0) + 1;
        }

        const docData = {
          slug,
          name: params.name,
          description: params.description ?? null,
          icon: params.icon ?? null,
          color: params.color ?? null,
          parentSlug: params.parent_slug ?? null,
          sortOrder,
          depth,
          path,
          isSystem: false,
          isActive: true,
          allowItems: params.allow_items,
          expenseOnIssue: params.expense_on_issue,
          defaultClassification: params.default_classification ?? 'material',
          itemCount: 0,
          qboExpenseAccountId: null,
          qboExpenseAccountName: null,
          qboAssetAccountId: null,
          qboAssetAccountName: null,
          createdAt: serverTimestamp(),
          createdBy: 'mcp-agent',
          updatedAt: serverTimestamp(),
          updatedBy: 'mcp-agent',
        };

        if (params.dry_run) {
          return { content: [{ type: 'text', text: `## Dry Run — Create Category\n\n**Slug:** ${slug}\n**Name:** ${params.name}\n**Parent:** ${params.parent_slug || 'top-level'}\n**Depth:** ${depth}\n**Allow Items:** ${params.allow_items}\n**Expense on Issue:** ${params.expense_on_issue}\n**Sort Order:** ${sortOrder}\n\nSet dry_run=false to commit.` }] };
        }

        await db.collection(COLLECTION).doc(slug).set(docData);
        invalidateCategoryCache();

        return { content: [{ type: 'text', text: `## Category Created\n\n**Slug:** ${slug}\n**Name:** ${params.name}\n**Parent:** ${params.parent_slug || 'top-level'}\n**Depth:** ${depth}\n**Allow Items:** ${params.allow_items}\n**Expense on Issue:** ${params.expense_on_issue}` }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error creating category: ${err.message}` }], isError: true };
      }
    },
  );

  // ─── Update Category ──────────────────────────────────────────────────────
  server.registerTool(
    'dawinos_update_category',
    {
      title: 'Update Inventory Category',
      description: `Update an existing inventory category's properties.

System categories cannot be deleted or have their slug changed. dry_run defaults to true.`,
      inputSchema: {
        slug: z.string().min(1).describe('Category to update'),
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        parent_slug: z.string().nullable().optional().describe('Move to new parent. Null = top-level.'),
        icon: z.string().nullable().optional(),
        color: z.string().nullable().optional(),
        allow_items: z.boolean().optional(),
        expense_on_issue: z.boolean().optional(),
        is_active: z.boolean().optional(),
        sort_order: z.number().int().optional(),
        qbo_expense_account_id: z.string().nullable().optional().describe('QBO expense account ID for journal entries'),
        qbo_expense_account_name: z.string().nullable().optional(),
        qbo_asset_account_id: z.string().nullable().optional().describe('QBO inventory asset account ID'),
        qbo_asset_account_name: z.string().nullable().optional(),
        dry_run: z.boolean().default(true).describe('Compute diff without writing. Default true.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const db = getDb();
        const docRef = db.collection(COLLECTION).doc(params.slug);
        const snap = await docRef.get();

        if (!snap.exists) {
          return { content: [{ type: 'text', text: `Category "${params.slug}" not found.` }] };
        }

        const current = snap.data()!;
        const update: Record<string, unknown> = {
          updatedAt: serverTimestamp(),
          updatedBy: 'mcp-agent',
        };
        const changes: string[] = [];

        if (params.name !== undefined && params.name !== current.name) {
          update.name = params.name;
          changes.push(`name: "${current.name}" → "${params.name}"`);
        }
        if (params.description !== undefined) {
          update.description = params.description;
          changes.push(`description updated`);
        }
        if (params.icon !== undefined) {
          update.icon = params.icon;
          changes.push(`icon: ${params.icon ?? 'cleared'}`);
        }
        if (params.color !== undefined) {
          update.color = params.color;
          changes.push(`color: ${params.color ?? 'cleared'}`);
        }
        if (params.allow_items !== undefined && params.allow_items !== current.allowItems) {
          if (!params.allow_items && current.itemCount > 0) {
            return { content: [{ type: 'text', text: `Cannot disable allowItems — category has ${current.itemCount} items. Move items first.` }] };
          }
          update.allowItems = params.allow_items;
          changes.push(`allowItems: ${current.allowItems} → ${params.allow_items}`);
        }
        if (params.expense_on_issue !== undefined && params.expense_on_issue !== current.expenseOnIssue) {
          update.expenseOnIssue = params.expense_on_issue;
          changes.push(`expenseOnIssue: ${current.expenseOnIssue} → ${params.expense_on_issue}`);
        }
        if (params.is_active !== undefined && params.is_active !== current.isActive) {
          update.isActive = params.is_active;
          changes.push(`isActive: ${current.isActive} → ${params.is_active}`);
        }
        if (params.sort_order !== undefined && params.sort_order !== current.sortOrder) {
          update.sortOrder = params.sort_order;
          changes.push(`sortOrder: ${current.sortOrder} → ${params.sort_order}`);
        }

        // QBO account mapping
        if (params.qbo_expense_account_id !== undefined) {
          update.qboExpenseAccountId = params.qbo_expense_account_id;
          changes.push(`qboExpenseAccountId: ${params.qbo_expense_account_id ?? 'cleared'}`);
        }
        if (params.qbo_expense_account_name !== undefined) {
          update.qboExpenseAccountName = params.qbo_expense_account_name;
        }
        if (params.qbo_asset_account_id !== undefined) {
          update.qboAssetAccountId = params.qbo_asset_account_id;
          changes.push(`qboAssetAccountId: ${params.qbo_asset_account_id ?? 'cleared'}`);
        }
        if (params.qbo_asset_account_name !== undefined) {
          update.qboAssetAccountName = params.qbo_asset_account_name;
        }

        // Handle parent change
        if (params.parent_slug !== undefined && params.parent_slug !== current.parentSlug) {
          let newDepth = 0;
          let newPath: string[] = [];

          if (params.parent_slug !== null) {
            // Prevent circular nesting
            if (params.parent_slug === params.slug) {
              return { content: [{ type: 'text', text: `Cannot nest a category under itself.` }] };
            }
            const parentDoc = await db.collection(COLLECTION).doc(params.parent_slug).get();
            if (!parentDoc.exists) {
              return { content: [{ type: 'text', text: `Parent category "${params.parent_slug}" not found.` }] };
            }
            const parentData = parentDoc.data()!;
            // Check if the new parent is a descendant of this category
            if (parentData.path && parentData.path.includes(params.slug)) {
              return { content: [{ type: 'text', text: `Cannot nest "${params.slug}" under "${params.parent_slug}" — would create a circular reference.` }] };
            }
            newDepth = (parentData.depth ?? 0) + 1;
            newPath = [...(parentData.path ?? []), params.parent_slug];
            if (newDepth >= MAX_DEPTH) {
              return { content: [{ type: 'text', text: `Maximum nesting depth is ${MAX_DEPTH}.` }] };
            }
          }

          update.parentSlug = params.parent_slug;
          update.depth = newDepth;
          update.path = newPath;
          changes.push(`parent: "${current.parentSlug ?? 'top-level'}" → "${params.parent_slug ?? 'top-level'}"`);
        }

        if (changes.length === 0) {
          return { content: [{ type: 'text', text: `No changes to apply to category "${params.slug}".` }] };
        }

        if (params.dry_run) {
          return { content: [{ type: 'text', text: `## Dry Run — Update Category "${params.slug}"\n\nChanges:\n${changes.map(c => `- ${c}`).join('\n')}\n\nSet dry_run=false to commit.` }] };
        }

        await docRef.update(update);
        invalidateCategoryCache();

        return { content: [{ type: 'text', text: `## Category Updated: "${params.slug}"\n\n${changes.map(c => `- ${c}`).join('\n')}` }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error updating category: ${err.message}` }], isError: true };
      }
    },
  );
}
