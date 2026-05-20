/**
 * BOQ Summary Component
 * Shows hierarchical summary of Control BOQ with Bill and Element totals
 */

import React, { useMemo } from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import type { BOQItem } from '../types';

interface BOQSummaryProps {
  items: BOQItem[];
  onNavigateToItems?: (filter: { billNumber?: string; elementCode?: string }) => void;
}

interface BillSummary {
  billNumber: string;
  billName: string;
  totalItems: number;
  totalValue: number;
  elements: ElementSummary[];
}

interface ElementSummary {
  elementCode: string;
  elementName: string;
  totalItems: number;
  totalValue: number;
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000000) return `UGX ${(amount / 1000000000).toFixed(2)}B`;
  if (amount >= 1000000) return `UGX ${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `UGX ${(amount / 1000).toFixed(1)}K`;
  return `UGX ${amount.toLocaleString()}`;
}

export function BOQSummary({ items, onNavigateToItems }: BOQSummaryProps) {
  const [expandedBills, setExpandedBills] = React.useState<Set<string>>(new Set(['1']));

  const billSummaries = useMemo(() => {
    // Group items by bill and element
    const billMap = new Map<string, BillSummary>();

    items.forEach(item => {
      const billNumber = item.billNumber || '0';
      const billName = item.billName || 'Uncategorized';
      const elementCode = item.elementCode || '';
      const elementName = item.elementName || '';

      // Get or create bill summary
      if (!billMap.has(billNumber)) {
        billMap.set(billNumber, {
          billNumber,
          billName,
          totalItems: 0,
          totalValue: 0,
          elements: [],
        });
      }

      const bill = billMap.get(billNumber)!;

      // Skip summary rows
      if (item.isSummaryRow) {
        return;
      }

      // Add to bill totals
      bill.totalItems++;
      bill.totalValue += item.amount || 0;

      // Find or create element summary
      let element = bill.elements.find(e => e.elementCode === elementCode);
      if (!element && elementCode) {
        element = {
          elementCode,
          elementName,
          totalItems: 0,
          totalValue: 0,
        };
        bill.elements.push(element);
      }

      // Add to element totals
      if (element) {
        element.totalItems++;
        element.totalValue += item.amount || 0;
      }
    });

    // Sort bills by bill number
    const bills = Array.from(billMap.values()).sort((a, b) => {
      const aNum = parseInt(a.billNumber) || 0;
      const bNum = parseInt(b.billNumber) || 0;
      return aNum - bNum;
    });

    // Sort elements within each bill
    bills.forEach(bill => {
      bill.elements.sort((a, b) => {
        const aNum = parseInt(a.elementCode) || 0;
        const bNum = parseInt(b.elementCode) || 0;
        return aNum - bNum;
      });
    });

    return bills;
  }, [items]);

  const totalValue = useMemo(() => {
    return billSummaries.reduce((sum, bill) => sum + bill.totalValue, 0);
  }, [billSummaries]);

  const totalItems = useMemo(() => {
    return billSummaries.reduce((sum, bill) => sum + bill.totalItems, 0);
  }, [billSummaries]);

  const toggleBill = (billNumber: string) => {
    const newExpanded = new Set(expandedBills);
    if (newExpanded.has(billNumber)) {
      newExpanded.delete(billNumber);
    } else {
      newExpanded.add(billNumber);
    }
    setExpandedBills(newExpanded);
  };

  return (
    <div className="space-y-4">
      {/* Overall Summary */}
      <div className="bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Control BOQ Summary</h3>
            <p className="text-sm text-gray-600 mt-1">{billSummaries.length} Bills • {totalItems} Items</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">Total Contract Value</div>
            <div className="text-2xl font-bold text-amber-700">{formatCurrency(totalValue)}</div>
          </div>
        </div>
      </div>

      {/* Bill Summaries */}
      <div className="space-y-3">
        {billSummaries.map(bill => (
          <div key={bill.billNumber} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Bill Header */}
            <div
              className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer"
              onClick={() => toggleBill(bill.billNumber)}
            >
              <div className="flex items-center gap-3 flex-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBill(bill.billNumber);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {expandedBills.has(bill.billNumber) ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </button>
                <FileText className="w-5 h-5 text-amber-600" />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">
                    Bill {bill.billNumber}: {bill.billName}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {bill.elements.length} Elements • {bill.totalItems} Items
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">Bill Total</div>
                <div className="text-lg font-bold text-gray-900">{formatCurrency(bill.totalValue)}</div>
              </div>
            </div>

            {/* Element Breakdown */}
            {expandedBills.has(bill.billNumber) && bill.elements.length > 0 && (
              <div className="border-t border-gray-200 bg-gray-50">
                <div className="px-4 py-2 bg-gray-100 border-b border-gray-200">
                  <div className="flex items-center justify-between text-xs font-medium text-gray-600 uppercase">
                    <span>Element</span>
                    <span>Items</span>
                    <span>Value</span>
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {bill.elements.map(element => (
                    <div
                      key={`${bill.billNumber}.${element.elementCode}`}
                      className="flex items-center justify-between p-3 hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => {
                        if (onNavigateToItems) {
                          onNavigateToItems({
                            billNumber: bill.billNumber,
                            elementCode: element.elementCode,
                          });
                        }
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {bill.billNumber}.{element.elementCode} {element.elementName}
                        </div>
                      </div>
                      <div className="flex items-center gap-6 ml-4">
                        <div className="text-sm text-gray-600 w-16 text-center">
                          {element.totalItems}
                        </div>
                        <div className="text-sm font-semibold text-gray-900 w-32 text-right">
                          {formatCurrency(element.totalValue)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* View All Items Button */}
                <div className="p-3 bg-gray-50 border-t border-gray-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onNavigateToItems) {
                        onNavigateToItems({ billNumber: bill.billNumber });
                      }
                    }}
                    className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                  >
                    View all items in Bill {bill.billNumber} →
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {billSummaries.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p>No BOQ items to summarize</p>
        </div>
      )}
    </div>
  );
}
