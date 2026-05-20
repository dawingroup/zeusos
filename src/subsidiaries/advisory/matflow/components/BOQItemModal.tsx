/**
 * BOQ Item Modal - Add/Edit BOQ Items
 * Supports hierarchical structure and auto-calculates amounts
 */

import React, { useState, useEffect } from 'react';
import { X, Save, Plus } from 'lucide-react';
import type { BOQItem } from '../types';

interface BOQItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Partial<BOQItem>) => Promise<void>;
  existingItem?: BOQItem;
  projectId: string;
  allItems: BOQItem[]; // All BOQ items for context
  // For hierarchical context
  parentBill?: string;
  parentElement?: string;
}

export function BOQItemModal({
  isOpen,
  onClose,
  onSave,
  existingItem,
  projectId,
  allItems,
  parentBill,
  parentElement,
}: BOQItemModalProps) {
  const [useExistingHierarchy, setUseExistingHierarchy] = useState(!existingItem);
  const [isSaving, setIsSaving] = useState(false);

  // Standard Method of Measurement (SMM) units for East Africa
  const standardUnits = [
    // Linear
    { value: 'm', label: 'm - Meters (linear)', category: 'Linear' },
    { value: 'mm', label: 'mm - Millimeters', category: 'Linear' },
    { value: 'km', label: 'km - Kilometers', category: 'Linear' },

    // Area
    { value: 'm²', label: 'm² - Square Meters', category: 'Area' },
    { value: 'ha', label: 'ha - Hectares', category: 'Area' },

    // Volume/Capacity
    { value: 'm³', label: 'm³ - Cubic Meters', category: 'Volume' },
    { value: 'l', label: 'l - Liters', category: 'Volume' },

    // Weight/Mass
    { value: 'kg', label: 'kg - Kilograms', category: 'Weight' },
    { value: 't', label: 't - Tonnes', category: 'Weight' },
    { value: 'g', label: 'g - Grams', category: 'Weight' },

    // Enumeration
    { value: 'No.', label: 'No. - Number', category: 'Count' },
    { value: 'nr', label: 'nr - Number', category: 'Count' },
    { value: 'PC', label: 'PC - Pieces', category: 'Count' },
    { value: 'Item', label: 'Item - Individual Item', category: 'Count' },
    { value: 'Pair', label: 'Pair - Pair', category: 'Count' },
    { value: 'Set', label: 'Set - Set', category: 'Count' },

    // Lump Sum
    { value: 'Sum', label: 'Sum - Lump Sum', category: 'Lump Sum' },
    { value: 'LS', label: 'LS - Lump Sum', category: 'Lump Sum' },

    // Time/Labor
    { value: 'hr', label: 'hr - Hours', category: 'Time' },
    { value: 'day', label: 'day - Days', category: 'Time' },
    { value: 'wk', label: 'wk - Weeks', category: 'Time' },
    { value: 'month', label: 'month - Months', category: 'Time' },
  ];

  // Extract unique hierarchy levels from all items
  const existingHierarchy = React.useMemo(() => {
    const bills = new Map<string, { billNumber: string; billName: string }>();
    const elements = new Map<string, { billNumber: string; elementCode: string; elementName: string }>();
    const sections = new Map<string, { billNumber: string; elementCode: string; sectionCode: string; sectionName: string }>();

    allItems.forEach(item => {
      // Bills (Level 1)
      if (item.billNumber && item.billName) {
        bills.set(item.billNumber, { billNumber: item.billNumber, billName: item.billName });
      }

      // Elements (Level 2)
      if (item.billNumber && item.elementCode && item.elementName) {
        const key = `${item.billNumber}.${item.elementCode}`;
        elements.set(key, { billNumber: item.billNumber, elementCode: item.elementCode, elementName: item.elementName });
      }

      // Sections (Level 3)
      if (item.billNumber && item.elementCode && item.sectionCode && item.sectionName) {
        const key = `${item.billNumber}.${item.elementCode}.${item.sectionCode}`;
        sections.set(key, {
          billNumber: item.billNumber,
          elementCode: item.elementCode,
          sectionCode: item.sectionCode,
          sectionName: item.sectionName
        });
      }
    });

    return {
      bills: Array.from(bills.values()),
      elements: Array.from(elements.values()),
      sections: Array.from(sections.values()),
    };
  }, [allItems]);

  const [formData, setFormData] = useState({
    hierarchyLevel: existingItem?.hierarchyLevel || 4,
    billNumber: existingItem?.billNumber || parentBill || '',
    billName: existingItem?.billName || '',
    elementCode: existingItem?.elementCode || parentElement || '',
    elementName: existingItem?.elementName || '',
    sectionCode: existingItem?.sectionCode || '',
    sectionName: existingItem?.sectionName || '',
    itemNumber: existingItem?.itemNumber || '',
    itemName: existingItem?.itemName || '',
    description: existingItem?.description || '',
    unit: existingItem?.unit || '',
    quantityContract: existingItem?.quantityContract || existingItem?.quantity || 0,
    rate: existingItem?.rate || existingItem?.unitRate || 0,
    amount: existingItem?.amount || 0,
    specifications: existingItem?.specifications || '',
  });

  // Auto-suggest next item code when hierarchy changes
  const suggestedItemCode = React.useMemo(() => {
    if (existingItem || formData.hierarchyLevel !== 4) return '';
    if (!formData.billNumber || !formData.elementCode || !formData.sectionCode) return '';

    // Find all items in the same section
    const sameSection = allItems.filter(item =>
      item.billNumber === formData.billNumber &&
      item.elementCode === formData.elementCode &&
      item.sectionCode === formData.sectionCode &&
      item.hierarchyLevel === 4
    );

    if (sameSection.length === 0) return '1';

    // Extract item numbers and find max
    const itemNumbers = sameSection
      .map(item => {
        const parts = (item.hierarchyPath || item.itemNumber || '').split('.');
        return parseInt(parts[parts.length - 1]) || 0;
      })
      .filter(num => !isNaN(num));

    if (itemNumbers.length === 0) return '1';

    const maxNumber = Math.max(...itemNumbers);
    return String(maxNumber + 1);
  }, [formData.billNumber, formData.elementCode, formData.sectionCode, formData.hierarchyLevel, allItems, existingItem]);

  // Auto-calculate amount when quantity or rate changes
  useEffect(() => {
    const calculatedAmount = formData.quantityContract * formData.rate;
    if (calculatedAmount !== formData.amount) {
      setFormData(prev => ({ ...prev, amount: calculatedAmount }));
    }
  }, [formData.quantityContract, formData.rate]);

  // Auto-fill suggested item code when adding Level 4 items
  useEffect(() => {
    if (!existingItem && formData.hierarchyLevel === 4 && suggestedItemCode && !formData.itemNumber) {
      setFormData(prev => ({ ...prev, itemNumber: suggestedItemCode }));
    }
  }, [suggestedItemCode, existingItem, formData.hierarchyLevel, formData.itemNumber]);

  // Handler for selecting existing bill
  const handleSelectBill = (billNumber: string) => {
    const bill = existingHierarchy.bills.find(b => b.billNumber === billNumber);
    if (bill) {
      setFormData(prev => ({
        ...prev,
        billNumber: bill.billNumber,
        billName: bill.billName,
      }));
    }
  };

  // Handler for selecting existing element
  const handleSelectElement = (elementKey: string) => {
    const element = existingHierarchy.elements.find(e => `${e.billNumber}.${e.elementCode}` === elementKey);
    if (element) {
      setFormData(prev => ({
        ...prev,
        billNumber: element.billNumber,
        elementCode: element.elementCode,
        elementName: element.elementName,
      }));
      // Also set bill name if we have it
      const bill = existingHierarchy.bills.find(b => b.billNumber === element.billNumber);
      if (bill) {
        setFormData(prev => ({ ...prev, billName: bill.billName }));
      }
    }
  };

  // Handler for selecting existing section
  const handleSelectSection = (sectionKey: string) => {
    const section = existingHierarchy.sections.find(s =>
      `${s.billNumber}.${s.elementCode}.${s.sectionCode}` === sectionKey
    );
    if (section) {
      setFormData(prev => ({
        ...prev,
        billNumber: section.billNumber,
        elementCode: section.elementCode,
        sectionCode: section.sectionCode,
        sectionName: section.sectionName,
      }));
      // Also set bill and element names
      const bill = existingHierarchy.bills.find(b => b.billNumber === section.billNumber);
      const element = existingHierarchy.elements.find(e =>
        e.billNumber === section.billNumber && e.elementCode === section.elementCode
      );
      setFormData(prev => ({
        ...prev,
        billName: bill?.billName || prev.billName,
        elementName: element?.elementName || prev.elementName,
      }));
    }
  };

  // Build hierarchyPath based on hierarchy level
  const buildHierarchyPath = () => {
    const parts = [];
    if (formData.billNumber) parts.push(formData.billNumber);
    if (formData.hierarchyLevel >= 2 && formData.elementCode) parts.push(formData.elementCode);
    if (formData.hierarchyLevel >= 3 && formData.sectionCode) parts.push(formData.sectionCode);
    if (formData.hierarchyLevel === 4 && formData.itemNumber) {
      // Extract just the last part for work items
      const itemPart = formData.itemNumber.split('.').pop() || formData.itemNumber;
      parts.push(itemPart);
    }
    return parts.join('.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const hierarchyPath = buildHierarchyPath();

      const itemData: Partial<BOQItem> = {
        projectId,
        hierarchyLevel: formData.hierarchyLevel,
        billNumber: formData.billNumber || undefined,
        billName: formData.billName || undefined,
        elementCode: formData.elementCode || undefined,
        elementName: formData.elementName || undefined,
        sectionCode: formData.sectionCode || undefined,
        sectionName: formData.sectionName || undefined,
        itemNumber: hierarchyPath,
        itemName: formData.itemName || undefined,
        hierarchyPath,
        description: formData.description,
        unit: formData.unit,
        quantity: formData.quantityContract,
        quantityContract: formData.quantityContract,
        quantityExecuted: existingItem?.quantityExecuted || 0,
        quantityRemaining: formData.quantityContract - (existingItem?.quantityExecuted || 0),
        rate: formData.rate,
        unitRate: formData.rate,
        amount: formData.amount,
        specifications: formData.specifications || undefined,
        status: existingItem?.status || 'draft',
        isSummaryRow: formData.hierarchyLevel <= 2,
      };

      await onSave(itemData);
      onClose();
    } catch (error) {
      console.error('Error saving BOQ item:', error);
      alert('Failed to save item. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {existingItem ? 'Edit BOQ Item' : 'Add BOQ Item'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Hierarchy Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Item Type
            </label>
            <select
              value={formData.hierarchyLevel}
              onChange={(e) => setFormData({ ...formData, hierarchyLevel: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              disabled={!!existingItem}
            >
              <option value={1}>Bill (Level 1 - Header)</option>
              <option value={2}>Element (Level 2 - Sub-header)</option>
              <option value={3}>Section (Level 3 - Governing Specs)</option>
              <option value={4}>Work Item (Level 4 - Actual Work)</option>
            </select>
          </div>

          {/* Toggle: Use Existing vs Create New */}
          {!existingItem && formData.hierarchyLevel > 1 && existingHierarchy.bills.length > 0 && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useExistingHierarchy}
                  onChange={(e) => setUseExistingHierarchy(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Use existing Bill/Element/Section
                </span>
              </label>
              <span className="text-xs text-gray-500 ml-auto">
                {useExistingHierarchy ? 'Select from existing' : 'Create new'}
              </span>
            </div>
          )}

          {/* Bill Number & Name */}
          {useExistingHierarchy && !existingItem && existingHierarchy.bills.length > 0 ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Bill *
              </label>
              <select
                value={formData.billNumber}
                onChange={(e) => handleSelectBill(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                required
              >
                <option value="">-- Select Existing Bill --</option>
                {existingHierarchy.bills.map(bill => (
                  <option key={bill.billNumber} value={bill.billNumber}>
                    Bill {bill.billNumber}: {bill.billName}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bill Number *
                </label>
                <input
                  type="text"
                  value={formData.billNumber}
                  onChange={(e) => setFormData({ ...formData, billNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="e.g., 1"
                  required
                />
              </div>
              {formData.hierarchyLevel === 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bill Name *
                  </label>
                  <input
                    type="text"
                    value={formData.billName}
                    onChange={(e) => setFormData({ ...formData, billName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="e.g., Preliminaries"
                    required
                  />
                </div>
              )}
            </div>
          )}

          {/* Element Code & Name */}
          {formData.hierarchyLevel >= 2 && (
            useExistingHierarchy && !existingItem && formData.billNumber && existingHierarchy.elements.some(e => e.billNumber === formData.billNumber) ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Element *
                </label>
                <select
                  value={`${formData.billNumber}.${formData.elementCode}`}
                  onChange={(e) => handleSelectElement(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  required
                >
                  <option value="">-- Select Existing Element --</option>
                  {existingHierarchy.elements
                    .filter(e => e.billNumber === formData.billNumber)
                    .map(element => (
                      <option key={`${element.billNumber}.${element.elementCode}`} value={`${element.billNumber}.${element.elementCode}`}>
                        Element {element.billNumber}.{element.elementCode}: {element.elementName}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Element Code *
                  </label>
                  <input
                    type="text"
                    value={formData.elementCode}
                    onChange={(e) => setFormData({ ...formData, elementCode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="e.g., 1"
                    required
                  />
                </div>
                {formData.hierarchyLevel === 2 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Element Name *
                    </label>
                    <input
                      type="text"
                      value={formData.elementName}
                      onChange={(e) => setFormData({ ...formData, elementName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      placeholder="e.g., Earthworks"
                      required
                    />
                  </div>
                )}
              </div>
            )
          )}

          {/* Section Code & Name */}
          {formData.hierarchyLevel >= 3 && (
            useExistingHierarchy && !existingItem && formData.billNumber && formData.elementCode &&
            existingHierarchy.sections.some(s => s.billNumber === formData.billNumber && s.elementCode === formData.elementCode) ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Section *
                </label>
                <select
                  value={`${formData.billNumber}.${formData.elementCode}.${formData.sectionCode}`}
                  onChange={(e) => handleSelectSection(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  required
                >
                  <option value="">-- Select Existing Section --</option>
                  {existingHierarchy.sections
                    .filter(s => s.billNumber === formData.billNumber && s.elementCode === formData.elementCode)
                    .map(section => (
                      <option
                        key={`${section.billNumber}.${section.elementCode}.${section.sectionCode}`}
                        value={`${section.billNumber}.${section.elementCode}.${section.sectionCode}`}
                      >
                        Section {section.billNumber}.{section.elementCode}.{section.sectionCode}: {section.sectionName}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Section Code *
                  </label>
                  <input
                    type="text"
                    value={formData.sectionCode}
                    onChange={(e) => setFormData({ ...formData, sectionCode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="e.g., 1"
                    required
                  />
                </div>
                {formData.hierarchyLevel === 3 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Section Name *
                    </label>
                    <input
                      type="text"
                      value={formData.sectionName}
                      onChange={(e) => setFormData({ ...formData, sectionName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      placeholder="e.g., Concrete Grade C25/30"
                      required
                    />
                  </div>
                )}
              </div>
            )
          )}

          {/* Work Item Number */}
          {formData.hierarchyLevel === 4 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Item Number (last part) *
              </label>
              <input
                type="text"
                value={formData.itemNumber}
                onChange={(e) => setFormData({ ...formData, itemNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                placeholder={suggestedItemCode ? `Auto-suggested: ${suggestedItemCode}` : "e.g., 1"}
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                Full code will be: <span className="font-medium text-gray-900">{buildHierarchyPath() || 'Enter codes above'}</span>
                {suggestedItemCode && !existingItem && (
                  <span className="ml-2 text-green-600">
                    ✓ Next available: {formData.billNumber}.{formData.elementCode}.{formData.sectionCode}.{suggestedItemCode}
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              rows={3}
              placeholder="Item description"
              required
            />
          </div>

          {/* Specifications (for Level 3+) */}
          {formData.hierarchyLevel >= 3 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Specifications
              </label>
              <textarea
                value={formData.specifications}
                onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                rows={2}
                placeholder="Technical specifications, material grades, standards, etc."
              />
            </div>
          )}

          {/* Quantity, Rate, Amount (Only for Level 3+) */}
          {formData.hierarchyLevel >= 3 && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.quantityContract}
                  onChange={(e) => setFormData({ ...formData, quantityContract: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rate (UGX) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (UGX)
                </label>
                <input
                  type="number"
                  value={formData.amount}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  disabled
                />
                <p className="mt-1 text-xs text-gray-500">Auto-calculated</p>
              </div>
            </div>
          )}

          {/* Unit (Only for Level 3+) */}
          {formData.hierarchyLevel >= 3 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unit *
              </label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                required
              >
                <option value="">-- Select Unit --</option>

                <optgroup label="Linear">
                  {standardUnits.filter(u => u.category === 'Linear').map(unit => (
                    <option key={unit.value} value={unit.value}>{unit.label}</option>
                  ))}
                </optgroup>

                <optgroup label="Area">
                  {standardUnits.filter(u => u.category === 'Area').map(unit => (
                    <option key={unit.value} value={unit.value}>{unit.label}</option>
                  ))}
                </optgroup>

                <optgroup label="Volume">
                  {standardUnits.filter(u => u.category === 'Volume').map(unit => (
                    <option key={unit.value} value={unit.value}>{unit.label}</option>
                  ))}
                </optgroup>

                <optgroup label="Weight">
                  {standardUnits.filter(u => u.category === 'Weight').map(unit => (
                    <option key={unit.value} value={unit.value}>{unit.label}</option>
                  ))}
                </optgroup>

                <optgroup label="Count">
                  {standardUnits.filter(u => u.category === 'Count').map(unit => (
                    <option key={unit.value} value={unit.value}>{unit.label}</option>
                  ))}
                </optgroup>

                <optgroup label="Lump Sum">
                  {standardUnits.filter(u => u.category === 'Lump Sum').map(unit => (
                    <option key={unit.value} value={unit.value}>{unit.label}</option>
                  ))}
                </optgroup>

                <optgroup label="Time">
                  {standardUnits.filter(u => u.category === 'Time').map(unit => (
                    <option key={unit.value} value={unit.value}>{unit.label}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center gap-2"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  {existingItem ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {existingItem ? 'Update Item' : 'Add Item'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
