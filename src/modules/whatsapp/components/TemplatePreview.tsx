/**
 * TemplatePreview - Preview a template with filled parameters
 */

import type { WhatsAppTemplate } from '../types';

interface Props {
  template: WhatsAppTemplate;
  params: Record<string, string>;
}

export function TemplatePreview({ template, params }: Props) {
  // Replace {{1}}, {{2}}, etc. with parameter values
  let previewText = template.bodyText;
  for (let i = 1; i <= template.parameterCount; i++) {
    const value = params[String(i)] || `[param ${i}]`;
    previewText = previewText.replace(`{{${i}}}`, value);
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
      <p className="text-xs text-green-600 font-medium mb-1">Preview</p>
      {template.headerText && (
        <p className="text-sm font-semibold text-gray-800 mb-1">{template.headerText}</p>
      )}
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{previewText}</p>
      {template.footerText && (
        <p className="text-xs text-gray-500 mt-1">{template.footerText}</p>
      )}
    </div>
  );
}
