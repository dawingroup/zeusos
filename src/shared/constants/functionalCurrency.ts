/**
 * The group's functional currency, locale and clock — ONE place.
 *
 * Every `organizations/{orgId}` doc carries its own `base_currency`; this is
 * the GROUP default a bare amount is read in when a document predates
 * multi-currency or carries no `currency` field. The seed sets
 * `organizations/zeus-group.base_currency = 'UGX'`; changing the group's
 * functional currency is a one-line change here plus a data migration — never
 * a scattered edit.
 *
 * Pure constants, dependency-free: the money, tax and FX helpers import these
 * and must stay importable from anywhere (a neutral layer must not import a
 * module).
 */

export const FUNCTIONAL_CURRENCY = 'UGX';

/** Locale every money string in the app is rendered in. */
export const MONEY_LOCALE = 'en-UG';

/**
 * The business clock. All five brands operate in East Africa Time (UTC+3, no
 * DST) — Kampala, Nairobi, Dar es Salaam and Kigali share it — so one offset
 * serves every date-to-period derivation.
 */
export const BUSINESS_TIMEZONE = 'Africa/Nairobi';
export const EAT_UTC_OFFSET_MS = 3 * 3600000;
