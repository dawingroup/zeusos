// ============================================================================
// BANK RECONCILIATION COMPONENT
// DawinOS v2.0 - Financial Management Module
// Bank statement reconciliation interface
// ============================================================================

import React, { useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  Building2,
  Calendar,
  ArrowRight,
  Check,
} from 'lucide-react';
import { BankReconciliation as BankReconciliationType, CashTransaction } from '../../types/cashflow.types';
import { formatCurrency, CurrencyCode } from '../../constants/currency.constants';
import { RECONCILIATION_STATUS_LABELS } from '../../constants/cashflow.constants';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface BankReconciliationProps {
  reconciliation: BankReconciliationType;
  unmatchedTransactions?: CashTransaction[];
  onMatchTransaction?: (transactionId: string, bankRef?: string) => void;
  onComplete?: () => void;
}

const steps = ['Enter Statement', 'Match Transactions', 'Review Adjustments', 'Complete'];

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------

export const BankReconciliation: React.FC<BankReconciliationProps> = ({
  reconciliation,
  unmatchedTransactions = [],
  onMatchTransaction,
  onComplete,
}) => {
  const [activeStep, setActiveStep] = useState(
    reconciliation.status === 'completed' ? 3 :
    reconciliation.status === 'in_progress' ? 1 : 0
  );
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());

  const currency = reconciliation.currency as CurrencyCode;

  const handleToggleTransaction = (transactionId: string) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(transactionId)) {
      newSelected.delete(transactionId);
    } else {
      newSelected.add(transactionId);
    }
    setSelectedTransactions(newSelected);
  };

  const handleMatchSelected = () => {
    selectedTransactions.forEach(id => {
      onMatchTransaction?.(id);
    });
    setSelectedTransactions(new Set());
  };

  const getStatusColor = () => {
    switch (reconciliation.status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'variance':
        return 'bg-red-100 text-red-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#872E5C]" />
              Bank Reconciliation
            </h3>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {reconciliation.bankAccountName} • Statement Date: {reconciliation.statementDate.toLocaleDateString()}
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
            {RECONCILIATION_STATUS_LABELS[reconciliation.status]}
          </span>
        </div>
      </div>

      {/* Stepper */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center">
          {steps.map((step, index) => (
            <React.Fragment key={step}>
              <div className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index < activeStep
                    ? 'bg-green-500 text-white'
                    : index === activeStep
                    ? 'bg-[#872E5C] text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {index < activeStep ? <Check className="w-4 h-4" /> : index + 1}
                </div>
                <span className={`ml-2 text-sm ${
                  index <= activeStep ? 'text-gray-900 font-medium' : 'text-gray-500'
                }`}>
                  {step}
                </span>
              </div>
              {index < steps.length - 1 && (
                <ArrowRight className="w-4 h-4 text-gray-300 mx-4" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Balance Summary */}
      <div className="px-6 py-4 grid grid-cols-2 gap-6">
        {/* Bank Statement */}
        <div className="p-4 border border-gray-200 rounded-lg">
          <h4 className="text-sm font-medium text-gray-500 mb-3">Bank Statement</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Opening Balance</span>
              <span className="text-sm font-mono">
                {formatCurrency(reconciliation.statementOpeningBalance, currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Closing Balance</span>
              <span className="text-sm font-mono font-semibold">
                {formatCurrency(reconciliation.statementClosingBalance, currency)}
              </span>
            </div>
            <div className="border-t border-gray-100 pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Adjusted Balance</span>
                <span className="text-sm font-mono font-bold text-[#872E5C]">
                  {formatCurrency(reconciliation.adjustedBankBalance, currency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Book Balance */}
        <div className="p-4 border border-gray-200 rounded-lg">
          <h4 className="text-sm font-medium text-gray-500 mb-3">Book Balance</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Opening Balance</span>
              <span className="text-sm font-mono">
                {formatCurrency(reconciliation.bookOpeningBalance, currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Closing Balance</span>
              <span className="text-sm font-mono font-semibold">
                {formatCurrency(reconciliation.bookClosingBalance, currency)}
              </span>
            </div>
            <div className="border-t border-gray-100 pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Adjusted Balance</span>
                <span className="text-sm font-mono font-bold text-[#872E5C]">
                  {formatCurrency(reconciliation.adjustedBookBalance, currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Difference Alert */}
      {reconciliation.difference !== 0 && (
        <div className="mx-6 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-medium text-sm">
              Difference of {formatCurrency(Math.abs(reconciliation.difference), currency)} between bank and book balances
            </span>
          </div>
        </div>
      )}

      {reconciliation.isReconciled && (
        <div className="mx-6 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle className="w-4 h-4" />
            <span className="font-medium text-sm">
              Reconciliation complete! Bank and book balances match.
            </span>
          </div>
        </div>
      )}

      {/* Unmatched Transactions */}
      {unmatchedTransactions.length > 0 && (
        <div className="px-6 pb-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-medium text-gray-900">
              Unmatched Book Transactions ({unmatchedTransactions.length})
            </h4>
            <button
              onClick={handleMatchSelected}
              disabled={selectedTransactions.size === 0}
              className="px-3 py-1.5 bg-[#872E5C] text-white text-sm rounded-lg hover:bg-[#6b2449] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Match Selected ({selectedTransactions.size})
            </button>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-10 px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selectedTransactions.size === unmatchedTransactions.length && unmatchedTransactions.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTransactions(new Set(unmatchedTransactions.map(t => t.id)));
                        } else {
                          setSelectedTransactions(new Set());
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Date</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Description</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Reference</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {unmatchedTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedTransactions.has(tx.id)}
                        onChange={() => handleToggleTransaction(tx.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      {tx.date.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-gray-900">{tx.description}</td>
                    <td className="px-4 py-2 text-gray-600">{tx.reference || '-'}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={tx.type === 'inflow' ? 'text-green-600' : 'text-red-600'}>
                        {tx.type === 'inflow' ? '+' : '-'}
                        {formatCurrency(tx.amount, tx.currency as CurrencyCode)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reconciled Items */}
      {reconciliation.reconciledItems.length > 0 && (
        <div className="px-6 pb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Reconciled Items ({reconciliation.reconciledItems.length})
          </h4>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Date</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Description</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Book Ref</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Bank Ref</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reconciliation.reconciledItems.map((item, index) => (
                  <tr key={index} className="bg-green-50/50">
                    <td className="px-4 py-2 text-gray-900">
                      {item.date.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-gray-900">{item.description}</td>
                    <td className="px-4 py-2 text-gray-600">{item.reference || '-'}</td>
                    <td className="px-4 py-2 text-gray-600">{item.matchedBankReference || '-'}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={item.type === 'deposit' ? 'text-green-600' : 'text-red-600'}>
                        {item.type === 'deposit' ? '+' : '-'}
                        {formatCurrency(item.amount, currency)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between">
        <button
          onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
          disabled={activeStep === 0}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>

        {activeStep < 3 ? (
          <button
            onClick={() => setActiveStep(activeStep + 1)}
            className="px-4 py-2 bg-[#872E5C] text-white rounded-lg hover:bg-[#6b2449]"
          >
            Next
          </button>
        ) : (
          <button
            onClick={onComplete}
            disabled={reconciliation.isReconciled || Math.abs(reconciliation.difference) >= 100}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Complete Reconciliation
          </button>
        )}
      </div>
    </div>
  );
};

export default BankReconciliation;
