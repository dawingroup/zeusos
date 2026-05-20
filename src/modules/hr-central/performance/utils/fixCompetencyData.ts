// ============================================================================
// UTILITY: Fix Competency Data
// One-time utility to update competencies with missing companyId
// ============================================================================

import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';

/**
 * Fix competencies that were seeded with empty companyId
 * This updates all competencies with empty companyId to use the specified companyId
 */
export async function fixCompetenciesWithEmptyCompanyId(correctCompanyId: string): Promise<number> {
  console.log('[Fix Competencies] Starting fix for empty companyId...');
  console.log('[Fix Competencies] Will update to companyId:', correctCompanyId);

  // Query for competencies with empty companyId
  const q = query(
    collection(db, 'competencies'),
    where('companyId', '==', '')
  );

  const snapshot = await getDocs(q);
  console.log('[Fix Competencies] Found', snapshot.docs.length, 'competencies with empty companyId');

  let updated = 0;
  for (const docSnap of snapshot.docs) {
    try {
      await updateDoc(doc(db, 'competencies', docSnap.id), {
        companyId: correctCompanyId,
      });
      updated++;
    } catch (error) {
      console.error('[Fix Competencies] Error updating doc', docSnap.id, error);
    }
  }

  console.log('[Fix Competencies] Successfully updated', updated, 'competencies');
  return updated;
}

/**
 * Get organization ID from user's email domain
 * e.g., onzimai@dawin.group -> dawin-group
 */
export function getOrganizationIdFromEmail(email: string): string {
  const domain = email.split('@')[1];
  return domain.replace(/\./g, '-');
}
