/**
 * Inspect the quantity distribution of parts on each DesignItem to
 * understand why sum(quantity)=711 when rowcount=347.
 */
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

async function main() {
  const projSnap = await db.collection('designProjects').where('code', '==', 'DF-2026-694').limit(1).get();
  const project = projSnap.docs[0];
  const itemsSnap = await project.ref.collection('designItems').get();

  console.log('Per-item row count vs quantity sum (and qty distribution):\n');
  for (const d of itemsSnap.docs) {
    const data = d.data();
    const parts = data.parts || [];
    if (parts.length === 0) continue;
    const qtySum = parts.reduce((s, p) => s + (p.quantity || 0), 0);
    const qtyDist = new Map();
    for (const p of parts) {
      const q = p.quantity || 0;
      qtyDist.set(q, (qtyDist.get(q) || 0) + 1);
    }
    const distStr = Array.from(qtyDist.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([q, n]) => `qty${q}×${n}`)
      .join(' ');
    console.log(`  ${(data.name || d.id).padEnd(45)} ${String(parts.length).padStart(3)} rows · qtyΣ=${String(qtySum).padStart(4)} · [${distStr}]`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
