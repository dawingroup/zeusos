/**
 * Import Shopify Materials to Launch Pipeline
 *
 * Fetches all products from the connected Shopify store and creates
 * corresponding launchProduct documents in Firestore for any that
 * don't already exist in the pipeline.
 *
 * Run with:
 *   node scripts/import-shopify-materials.cjs
 *   node scripts/import-shopify-materials.cjs --dry-run
 *   node scripts/import-shopify-materials.cjs --status=active
 *   node scripts/import-shopify-materials.cjs --status=draft
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

// ─── CLI Flags ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const STATUS_FLAG = args.find(a => a.startsWith('--status='));
const FILTER_STATUS = STATUS_FLAG ? STATUS_FLAG.split('=')[1] : null; // null = all statuses

if (DRY_RUN) console.log('\n🔍  DRY RUN — no documents will be created\n');

// ─── Shopify API Helpers ─────────────────────────────────────────────────────

/**
 * Fetch Shopify credentials from Firestore
 */
async function getShopifyConfig() {
  const doc = await db.doc('systemConfig/shopifyConfig').get();
  if (!doc.exists) throw new Error('Shopify config not found in systemConfig/shopifyConfig');

  const data = doc.data();
  if (data.status !== 'connected') throw new Error(`Shopify status is "${data.status}", not "connected"`);
  if (!data.shopDomain || !data.accessToken) throw new Error('Missing shopDomain or accessToken');

  return { shopDomain: data.shopDomain, accessToken: data.accessToken };
}

/**
 * Fetch all Shopify products with pagination (250 per page max)
 */
async function fetchAllShopifyProducts(shopDomain, accessToken, statusFilter) {
  const allProducts = [];
  const statuses = statusFilter ? [statusFilter] : ['active', 'draft', 'archived'];

  for (const status of statuses) {
    let url = `https://${shopDomain}/admin/api/2024-01/products.json?status=${status}&limit=250`;

    while (url) {
      const response = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Shopify API error ${response.status} for status="${status}": ${text}`);
      }

      const { products } = await response.json();
      allProducts.push(...products);
      console.log(`  Fetched ${products.length} ${status} products (total so far: ${allProducts.length})`);

      // Check for next page via Link header
      const linkHeader = response.headers.get('link');
      url = null;
      if (linkHeader) {
        const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        if (nextMatch) url = nextMatch[1];
      }
    }
  }

  return allProducts;
}

// ─── Field Mapping ───────────────────────────────────────────────────────────

/**
 * Infer product category from Shopify product_type and tags
 */
function inferCategory(productType, tags) {
  const combined = `${productType || ''} ${tags || ''}`.toLowerCase();

  if (combined.includes('casework') || combined.includes('cabinet')) return 'casework';
  if (combined.includes('millwork') || combined.includes('trim') || combined.includes('molding')) return 'millwork';
  if (combined.includes('door')) return 'doors';
  if (combined.includes('fixture') || combined.includes('vanity') || combined.includes('sink')) return 'fixtures';
  if (combined.includes('special')) return 'specialty';

  // Material-specific heuristics
  if (combined.includes('sheet') || combined.includes('mdf') || combined.includes('plywood') ||
      combined.includes('board') || combined.includes('panel') || combined.includes('melamine')) return 'casework';
  if (combined.includes('wood') || combined.includes('timber') || combined.includes('lumber')) return 'furniture';
  if (combined.includes('hardware') || combined.includes('hinge') || combined.includes('handle')) return 'fixtures';
  if (combined.includes('finish') || combined.includes('paint') || combined.includes('stain') ||
      combined.includes('lacquer') || combined.includes('varnish')) return 'specialty';
  if (combined.includes('edge') || combined.includes('banding')) return 'millwork';

  return 'furniture';
}

/**
 * Strip HTML tags from a string
 */
function stripHtml(html) {
  return (html || '').replace(/<[^>]*>/g, '').trim();
}

/**
 * Map a Shopify product to a launchProduct document
 */
function mapToLaunchProduct(shopifyProduct) {
  const now = new Date();
  const tags = shopifyProduct.tags
    ? shopifyProduct.tags.split(',').map(t => t.trim()).filter(Boolean)
    : [];

  const description = stripHtml(shopifyProduct.body_html);

  // Map variants
  const variants = (shopifyProduct.variants || []).map(v => {
    const options = {};
    if (v.option1 && shopifyProduct.options?.[0]) {
      options[shopifyProduct.options[0].name] = v.option1;
    }
    if (v.option2 && shopifyProduct.options?.[1]) {
      options[shopifyProduct.options[1].name] = v.option2;
    }
    if (v.option3 && shopifyProduct.options?.[2]) {
      options[shopifyProduct.options[2].name] = v.option3;
    }
    return {
      id: `var_${v.id}`,
      title: v.title,
      sku: v.sku || '',
      price: parseFloat(v.price) || 0,
      compareAtPrice: v.compare_at_price ? parseFloat(v.compare_at_price) : null,
      inventoryQuantity: v.inventory_quantity || 0,
      weight: v.weight || null,
      weightUnit: v.weight_unit || null,
      options,
    };
  });

  // Map images → deliverables
  const deliverables = (shopifyProduct.images || []).map((img, idx) => ({
    id: `del_img_${img.id || idx}`,
    type: idx === 0 ? 'hero_images' : 'detail_shots',
    stage: 'launched',
    name: img.alt || `Product Image ${idx + 1}`,
    url: img.src,
    mimeType: 'image/jpeg',
    uploadedAt: now,
    uploadedBy: 'shopify-import-script',
  }));

  // Extract SEO metadata from metafields if present
  let seoMetadata = null;
  if (shopifyProduct.metafields_global_title_tag || shopifyProduct.metafields_global_description_tag) {
    seoMetadata = {
      metaTitle: shopifyProduct.metafields_global_title_tag || shopifyProduct.title,
      metaDescription: shopifyProduct.metafields_global_description_tag || '',
      keywords: tags.slice(0, 10),
    };
  }

  // Build materials list from product type + tags for specifications
  const materialHints = [];
  if (shopifyProduct.product_type) materialHints.push(shopifyProduct.product_type);
  const materialTags = tags.filter(t =>
    /wood|mdf|plywood|veneer|laminate|oak|maple|walnut|birch|pine|melamine|formica|board|panel/i.test(t)
  );
  materialHints.push(...materialTags);

  return {
    name: shopifyProduct.title || 'Untitled',
    handle: (shopifyProduct.handle || shopifyProduct.title || 'untitled')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    description,
    category: inferCategory(shopifyProduct.product_type, shopifyProduct.tags),
    currentStage: 'launched',
    stageHistory: [{
      from: 'launched',
      to: 'launched',
      transitionedAt: now,
      transitionedBy: 'shopify-import-script',
      notes: `Imported from Shopify (product ${shopifyProduct.id})`,
    }],
    deliverables,
    specifications: {
      materials: materialHints,
      finishes: [],
      colors: tags.filter(t => /color|colour|red|blue|green|black|white|brown|grey|gray|natural|clear/i.test(t)),
      features: [],
    },
    ...(seoMetadata ? { seoMetadata } : {}),
    shopifySync: {
      shopifyProductId: shopifyProduct.id.toString(),
      shopifyVariantIds: (shopifyProduct.variants || []).map(v => v.id.toString()),
      status: 'synced',
      lastSyncedAt: now,
      shopifyHandle: shopifyProduct.handle,
    },
    auditHistory: [],
    pricing: {
      basePrice: parseFloat(shopifyProduct.variants?.[0]?.price || '0'),
      compareAtPrice: shopifyProduct.variants?.[0]?.compare_at_price
        ? parseFloat(shopifyProduct.variants[0].compare_at_price)
        : null,
      currency: 'USD',
      taxable: true,
    },
    variants: variants.length > 0 ? variants : null,
    priority: 'medium',
    tags,
    notes: `Auto-imported from Shopify on ${now.toISOString().split('T')[0]}`,
    sourceShopifyStatus: shopifyProduct.status,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Shopify Materials → Launch Pipeline Import Script');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Get Shopify credentials
  console.log('1. Reading Shopify config from Firestore...');
  const { shopDomain, accessToken } = await getShopifyConfig();
  console.log(`   Store: ${shopDomain}\n`);

  // 2. Fetch all Shopify products
  console.log(`2. Fetching Shopify products${FILTER_STATUS ? ` (status=${FILTER_STATUS})` : ' (all statuses)'}...`);
  const shopifyProducts = await fetchAllShopifyProducts(shopDomain, accessToken, FILTER_STATUS);
  console.log(`   Total fetched: ${shopifyProducts.length}\n`);

  if (shopifyProducts.length === 0) {
    console.log('No Shopify products found. Exiting.');
    process.exit(0);
  }

  // 3. Get existing launchProducts linked to Shopify
  console.log('3. Checking existing launchProducts for Shopify links...');
  const existingSnap = await db.collection('launchProducts').get();
  const linkedShopifyIds = new Set();

  existingSnap.forEach(doc => {
    const data = doc.data();
    if (data.shopifySync?.shopifyProductId) {
      linkedShopifyIds.add(data.shopifySync.shopifyProductId.toString());
    }
  });
  console.log(`   Existing launchProducts: ${existingSnap.size}`);
  console.log(`   Already linked to Shopify: ${linkedShopifyIds.size}\n`);

  // 4. Filter to unlinked products
  const unlinked = shopifyProducts.filter(p => !linkedShopifyIds.has(p.id.toString()));
  const alreadyLinked = shopifyProducts.length - unlinked.length;

  console.log('4. Analysis:');
  console.log(`   Already linked (skip): ${alreadyLinked}`);
  console.log(`   Unlinked (to import):  ${unlinked.length}\n`);

  if (unlinked.length === 0) {
    console.log('✅ All Shopify products are already linked. Nothing to import.');
    process.exit(0);
  }

  // 5. Preview unlinked products
  console.log('5. Products to import:');
  console.log('   ┌─────────────────┬────────────────────────────────────────┬──────────┬──────────┐');
  console.log('   │ Shopify ID      │ Title                                  │ Status   │ Variants │');
  console.log('   ├─────────────────┼────────────────────────────────────────┼──────────┼──────────┤');

  for (const p of unlinked) {
    const title = (p.title || 'Untitled').substring(0, 38).padEnd(38);
    const id = p.id.toString().padEnd(15);
    const status = (p.status || '?').padEnd(8);
    const variants = (p.variants?.length || 0).toString().padEnd(8);
    console.log(`   │ ${id} │ ${title} │ ${status} │ ${variants} │`);
  }

  console.log('   └─────────────────┴────────────────────────────────────────┴──────────┴──────────┘\n');

  if (DRY_RUN) {
    console.log('🔍  DRY RUN complete. Run without --dry-run to import these products.');
    process.exit(0);
  }

  // 6. Import
  console.log(`6. Importing ${unlinked.length} products into launchProducts...\n`);

  let imported = 0;
  let errors = 0;
  const errorDetails = [];

  for (const shopifyProduct of unlinked) {
    try {
      const launchProduct = mapToLaunchProduct(shopifyProduct);
      const docRef = await db.collection('launchProducts').add(launchProduct);

      imported++;
      console.log(`   ✅ [${imported}/${unlinked.length}] "${shopifyProduct.title}" → ${docRef.id}`);
    } catch (err) {
      errors++;
      errorDetails.push({ id: shopifyProduct.id, title: shopifyProduct.title, error: err.message });
      console.error(`   ❌ [${imported + errors}/${unlinked.length}] "${shopifyProduct.title}": ${err.message}`);
    }
  }

  // 7. Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Import Complete');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Imported:       ${imported}`);
  console.log(`  Already linked: ${alreadyLinked}`);
  console.log(`  Errors:         ${errors}`);
  console.log(`  Total Shopify:  ${shopifyProducts.length}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (errorDetails.length > 0) {
    console.log('Error details:');
    errorDetails.forEach(e => {
      console.log(`  - Shopify #${e.id} ("${e.title}"): ${e.error}`);
    });
    console.log('');
  }

  console.log('Next steps:');
  console.log('  1. Visit the Launch Pipeline → Catalog Health tab to see audit scores');
  console.log('  2. Open individual products to AI-enhance descriptions, SEO, and images');
  console.log('  3. Re-sync enhanced products back to Shopify with the Publish button');
  console.log('  4. The daily scheduled audit will now cover all imported products\n');

  process.exit(errors > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
