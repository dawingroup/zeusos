/**
 * Memos — written decision records (DawinOS stream G port, 2026-10-26).
 * See docs/PHASE_6_G_MEMOS.md.
 */
const { memoAction } = require('./callables/memoAction');
const { draftMemoSection } = require('./ai/draftMemoSection');

module.exports = { memoAction, draftMemoSection };
