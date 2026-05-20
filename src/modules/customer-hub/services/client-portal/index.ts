/**
 * Client-portal services — anchored under customer-hub because the
 * portal is the customer-facing surface of DawinOS and these services
 * own the customer↔project↔portal-account data path.
 *
 * Three responsibilities:
 *   - `clientPortalAccess` — read-side: resolve which projects a user
 *     can see, load project / sales-order / quote / approval data.
 *   - `portalAccessGate`   — role check: is the viewer staff or a
 *     client? Used by every portal hook before fetching.
 *   - `portalAuth`         — portal-specific auth (magic link, phone
 *     OTP, sign-out).
 *   - `portalApprovalActions` — write-side: approve / reject signoffs
 *     and change orders from the portal.
 *   - `drawingPinsService` — write-side: pin CRUD + comment threads
 *     on the `drawingPins` collection.
 *
 * Re-exported as a barrel so consumers can import from
 * `@/modules/customer-hub/services/client-portal` and stay decoupled
 * from individual file names.
 */

export * from './clientPortalAccess';
export * from './portalAccessGate';
export * from './portalAuth';
export * from './portalApprovalActions';
export * from './drawingPinsService';
