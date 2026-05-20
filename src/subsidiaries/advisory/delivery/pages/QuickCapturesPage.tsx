/**
 * Quick Captures Page
 *
 * Renders the Quick Captures Inbox within the DeliveryLayout.
 */

import { QuickCapturesInbox } from '../components/quick-capture/QuickCapturesInbox';

export function QuickCapturesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quick Captures</h1>
        <p className="text-sm text-gray-500 mt-1">
          Field expenditures pending requisition linkage. Link within 48 hours.
        </p>
      </div>
      <QuickCapturesInbox />
    </div>
  );
}
