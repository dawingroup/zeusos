/**
 * Which grant a PERSON needs before an agent tool runs for them.
 *
 * The handlers read and write through the Admin SDK, so the rules never see the
 * caller: without this any staff member — or a prompt-injected action chip they
 * click — reaches the books and the HR files. Tools not listed are open to staff
 * (onAiCall has already refused everyone else). Sensitive tools need what the
 * rules ask for on the same data: a parent-org principal or an admin.
 *
 * Ported from DawinOS agents/toolCapabilities.js, against ZeusOS's parent-org
 * model rather than DawinOS module grants.
 */
'use strict';

const { HttpsError } = require('firebase-functions/v2/https');
const { isParentOrgUser: isParentOrgUserFromFirestore, loadUserDoc: loadUserDocFromFirestore, isSuper } = require('../assignment/lib/auth');

const PRIVILEGED_TOOLS = new Set(['read.employees', 'read.finance_journals', 'read.audit_trail']);

async function assertToolCapability(auth, toolId, deps = {}) {
  if (!PRIVILEGED_TOOLS.has(toolId)) return;
  const load = deps.loadUserDoc || loadUserDocFromFirestore;
  const isParent = deps.isParentOrgUser || isParentOrgUserFromFirestore;
  const user = await load(auth.uid);
  // The same fallback chain as assertParentOrgPrincipal, not a second definition.
  if (isSuper(auth.token, user) || (await isParent(auth.uid))) return;
  throw new HttpsError('permission-denied', `You do not have access to run ${toolId}.`);
}

/**
 * A task a person confirmed lands on that person unless the chip named someone,
 * instead of floating unassigned. Returns a new object; never mutates the input.
 */
function withChipDefaults(toolId, input, uid) {
  const base = input && typeof input === 'object' ? input : {};
  if (toolId === 'write.create_task' && !base.assignedToUserId) return { ...base, assignedToUserId: uid };
  return base;
}

module.exports = { PRIVILEGED_TOOLS, assertToolCapability, withChipDefaults };
