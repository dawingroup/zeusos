/**
 * Report Template Selector Component
 * Dropdown for selecting report templates
 */

import React from 'react';
import type { ReportTemplate, ReportType } from '../types';
import { REPORT_TYPE_LABELS, REPORT_TYPE_DESCRIPTIONS } from '../templates';

interface ReportTemplateSelectorProps {
  templates: ReportTemplate[];
  selectedTemplate: ReportTemplate | null;
  onSelect: (template: ReportTemplate | null) => void;
  filterByType?: ReportType;
  disabled?: boolean;
  className?: string;
}

export function ReportTemplateSelector({
  templates,
  selectedTemplate,
  onSelect,
  filterByType,
  disabled = false,
  className = '',
}: ReportTemplateSelectorProps) {
  // Filter templates by type if specified
  const filteredTemplates = filterByType
    ? templates.filter((t) => t.type === filterByType)
    : templates;

  // Group templates by type
  const templatesByType = filteredTemplates.reduce(
    (acc, template) => {
      const type = template.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(template);
      return acc;
    },
    {} as Record<ReportType, ReportTemplate[]>
  );

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const templateId = e.target.value;
    if (!templateId) {
      onSelect(null);
      return;
    }
    const template = templates.find((t) => t.id === templateId);
    onSelect(template || null);
  };

  return (
    <div className={`report-template-selector ${className}`}>
      <label
        htmlFor="report-template"
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        Report Template
      </label>
      <select
        id="report-template"
        value={selectedTemplate?.id || ''}
        onChange={handleChange}
        disabled={disabled}
        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary focus:ring-1 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <option value="">Select a template...</option>
        {filterByType ? (
          // Flat list when filtering by type
          filteredTemplates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
              {template.isDefault && ' (Default)'}
            </option>
          ))
        ) : (
          // Grouped by type when showing all
          Object.entries(templatesByType).map(([type, typeTemplates]) => (
            <optgroup
              key={type}
              label={REPORT_TYPE_LABELS[type as ReportType] || type}
            >
              {typeTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                  {template.isDefault && ' (Default)'}
                </option>
              ))}
            </optgroup>
          ))
        )}
      </select>
      {selectedTemplate && (
        <p className="mt-1 text-xs text-gray-500">
          {selectedTemplate.description ||
            REPORT_TYPE_DESCRIPTIONS[selectedTemplate.type]}
        </p>
      )}
    </div>
  );
}

export default ReportTemplateSelector;
