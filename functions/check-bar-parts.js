/**
 * Diagnostic: Check all design items for bar vs sheet vs untyped parts
 * Run: node check-bar-parts.js
 */
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

async function check() {
  const projects = await db.collection('designProjects').get();
  console.log(`Scanning ${projects.size} projects...\n`);

  let allMaterials = new Map(); // material → { bar: count, sheet: count, untyped: count, sampleDims: [] }

  for (const proj of projects.docs) {
    const items = await db.collection('designProjects').doc(proj.id).collection('designItems').get();
    for (const item of items.docs) {
      const data = item.data();
      const parts = data.parts || [];
      if (parts.length === 0) continue;

      const barParts = parts.filter(p => p.partType === 'bar');
      const sheetParts = parts.filter(p => p.partType === 'sheet');
      const untyped = parts.filter(p => p.partType === undefined || p.partType === null);

      console.log('─────────────────────────────────');
      console.log(`Project: ${data.projectCode || proj.id} | Item: ${data.name || data.itemCode || item.id}`);
      console.log(`  Total: ${parts.length} | bar: ${barParts.length} | sheet: ${sheetParts.length} | untyped: ${untyped.length}`);

      if (barParts.length > 0) {
        const mats = [...new Set(barParts.map(p => p.materialName))];
        console.log(`  Bar materials: ${mats.join(', ')}`);
        barParts.slice(0, 3).forEach(p => {
          console.log(`    ✓ "${p.name}" | ${p.materialName} | L=${p.length} W=${p.width} T=${p.thickness} | profile=${p.barProfile || '-'}`);
        });
      }

      if (untyped.length > 0) {
        console.log(`  ⚠ Untyped parts (need classification):`);
        untyped.forEach(p => {
          console.log(`    ? "${p.name}" | ${p.materialName} | L=${p.length} W=${p.width} T=${p.thickness} Q=${p.quantity}`);
        });
      }

      if (sheetParts.length > 0) {
        const mats = [...new Set(sheetParts.map(p => p.materialName))];
        console.log(`  Sheet materials: ${mats.join(', ')}`);
      }

      // Collect all materials for summary
      parts.forEach(p => {
        const mat = p.materialName || 'Unknown';
        if (!allMaterials.has(mat)) {
          allMaterials.set(mat, { bar: 0, sheet: 0, untyped: 0, samples: [] });
        }
        const entry = allMaterials.get(mat);
        if (p.partType === 'bar') entry.bar++;
        else if (p.partType === 'sheet') entry.sheet++;
        else entry.untyped++;

        if (entry.samples.length < 2) {
          entry.samples.push({ name: p.name, L: p.length, W: p.width, T: p.thickness });
        }
      });
    }
  }

  console.log('\n\n═══════════════════════════════════════');
  console.log('MATERIAL SUMMARY — All unique materials');
  console.log('═══════════════════════════════════════');
  const sorted = [...allMaterials.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [mat, counts] of sorted) {
    const type = counts.bar > 0 ? '🔧 BAR' : counts.untyped > 0 ? '❓ UNTYPED' : '📋 SHEET';
    console.log(`\n${type} | "${mat}" | bar:${counts.bar} sheet:${counts.sheet} untyped:${counts.untyped}`);
    counts.samples.forEach(s => {
      console.log(`       sample: "${s.name}" L=${s.L} W=${s.W} T=${s.T}`);
    });
  }
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
