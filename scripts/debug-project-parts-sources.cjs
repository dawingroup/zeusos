/**
 * Debug: enumerate every Firestore location where DF-2026-694 parts
 * could be stored. The designItems subcollection says 347, but DM
 * reports 710 — that gap is either cached elsewhere or the UI is
 * reading from a path we haven't audited.
 */
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

const PROJECT_CODE = 'DF-2026-694';

async function main() {
  const projSnap = await db.collection('designProjects').where('code', '==', PROJECT_CODE).limit(1).get();
  if (projSnap.empty) { console.error('no project'); process.exit(1); }
  const project = projSnap.docs[0];
  const projData = project.data();
  console.log(`\nProject ${project.id} · "${projData.name}"\n`);

  // 1. Item-level .parts
  const itemsSnap = await project.ref.collection('designItems').get();
  let itemsTotalParts = 0;
  for (const d of itemsSnap.docs) {
    itemsTotalParts += (d.data().parts || []).length;
  }
  console.log(`📦 designItems/*.parts total: ${itemsTotalParts}`);

  // 2. consolidatedCutlist cache
  const cc = projData.consolidatedCutlist;
  if (cc) {
    const groups = cc.materialGroups || [];
    const partsInGroups = groups.reduce((s, g) => s + (g.parts?.length || 0), 0);
    const quantitySum = groups.reduce((s, g) => s + (g.parts || []).reduce((ss, p) => ss + (p.quantity || 0), 0), 0);
    console.log(`📊 project.consolidatedCutlist:`);
    console.log(`     groups: ${groups.length}`);
    console.log(`     total parts (row count): ${partsInGroups}`);
    console.log(`     totalParts field: ${cc.totalParts}`);
    console.log(`     totalUniquePartsCount: ${cc.totalUniquePartsCount}`);
    console.log(`     sum of quantities: ${quantitySum}`);
    console.log(`     isStale: ${cc.isStale}`);
    console.log(`     generatedAt: ${cc.generatedAt?.toDate?.()?.toISOString?.() || '—'}`);
  } else {
    console.log(`📊 project.consolidatedCutlist: (absent)`);
  }

  // 3. projectParts subcollection (shared special parts)
  const projPartsSnap = await project.ref.collection('projectParts').get();
  console.log(`\n📁 designProjects/${project.id}/projectParts: ${projPartsSnap.size} docs`);

  // 4. Any item with manufacturing sub-doc containing parts?
  console.log(`\n📁 per-item manufacturing.{standardParts,specialParts}:`);
  let mSum = 0;
  for (const d of itemsSnap.docs) {
    const data = d.data();
    const m = data.manufacturing || {};
    const std = m.standardParts?.length || 0;
    const spec = m.specialParts?.length || 0;
    mSum += std + spec;
    if (std + spec > 0) {
      console.log(`     ${d.id.slice(0,8)}… ${data.name}: ${std} std + ${spec} spec`);
    }
  }
  console.log(`   total std+spec across items: ${mSum}`);

  // 5. Sum by partType in cutlist cache to see where 710 might come from
  if (cc?.materialGroups) {
    console.log(`\n📊 consolidatedCutlist by partType:`);
    const byType = new Map();
    let cutQtySum = 0;
    for (const g of cc.materialGroups) {
      for (const p of (g.parts || [])) {
        byType.set(p.partType || 'sheet', (byType.get(p.partType || 'sheet') || 0) + 1);
        cutQtySum += p.quantity || 0;
      }
    }
    for (const [t, n] of byType) console.log(`   ${n} ${t}`);
    console.log(`   sum of quantities: ${cutQtySum}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
