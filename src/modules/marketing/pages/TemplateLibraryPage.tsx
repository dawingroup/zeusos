/**
 * TemplateLibraryPage
 * Content template management (Phase 5 - Placeholder)
 */

import { MessageSquare, Info } from 'lucide-react';

export default function TemplateLibraryPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Template Library</h1>
        <p className="text-muted-foreground">Manage reusable content templates</p>
      </div>

      {/* Coming Soon Message */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-8 text-center">
        <div className="inline-flex p-4 bg-purple-100 rounded-full mb-4">
          <MessageSquare className="h-12 w-12 text-purple-600" />
        </div>
        <h2 className="text-xl font-semibold text-purple-900 mb-2">
          Template Library Coming Soon
        </h2>
        <p className="text-purple-800 mb-4">
          Content template management will be available in Phase 5 of the Marketing Hub rollout.
        </p>
        <div className="bg-white border border-purple-200 rounded-lg p-4 max-w-2xl mx-auto">
          <div className="flex items-start gap-2 text-left">
            <Info className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-purple-900">
              <p className="font-medium mb-2">Planned Features:</p>
              <ul className="list-disc list-inside space-y-1 text-purple-800">
                <li>WhatsApp message templates with placeholder support</li>
                <li>Social media post templates</li>
                <li>Template categories and search</li>
                <li>Usage tracking and analytics</li>
                <li>Template versioning and approval workflow</li>
                <li>A/B testing templates</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Current WhatsApp Templates Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Using WhatsApp Templates</p>
            <p className="mt-1">
              Currently, WhatsApp templates are managed in the WhatsApp module. When creating campaigns,
              you can select from approved templates. Full template management will be centralized here in Phase 5.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
