/**
 * ZeusOS Subsidiaries
 *
 * Phase 1.C removed the DawinOS-era subsidiaries (Finishes, Technology, Capital
 * placeholder, Construction). Only Advisory survives — and it will be renamed
 * to `agency-core` in Phase 3 as the financial backbone for Campaigns.
 *
 * Zeus's actual sub-brands (Zeus The Agency, Zeus Digital, Labyrinth, Odd
 * Gorilla, House of Zeus) are modelled as `SubsidiaryAccess` IDs on Users
 * (see `src/types/subsidiary.ts`), not as separate code packages.
 */

export * as Advisory from './advisory';
