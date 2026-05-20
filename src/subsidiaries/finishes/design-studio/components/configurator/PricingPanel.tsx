/**
 * PricingPanel — Real-time pricing with material/labor/overhead/margin breakdown
 */
import type { PricingBreakdown } from '../../types/constraintEngine.types';

interface PricingPanelProps {
  breakdown: PricingBreakdown | null;
  currency?: string;
  isLoading?: boolean;
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === 'USD') {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `UGX ${amount.toLocaleString('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function PricingPanel({ breakdown, currency, isLoading }: PricingPanelProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-3 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!breakdown) return null;

  const curr = currency ?? breakdown.currency;
  const lines = [
    { label: 'Materials', amount: breakdown.materialsCost },
    { label: 'Edge Banding', amount: breakdown.edgeBandingCost },
    { label: 'Hardware', amount: breakdown.hardwareCost },
    { label: 'Labor', amount: breakdown.laborCost },
    { label: 'Overhead', amount: breakdown.overheadCost },
    { label: 'Margin', amount: breakdown.marginAmount },
  ].filter(l => l.amount > 0);

  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-sm font-semibold mb-3">Price Estimate</h3>
      <div className="space-y-1.5">
        {lines.map(line => (
          <div key={line.label} className="flex justify-between text-sm">
            <span className="text-gray-600">{line.label}</span>
            <span>{formatCurrency(line.amount, curr)}</span>
          </div>
        ))}
        <div className="border-t pt-1.5 mt-1.5" />
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal</span>
          <span>{formatCurrency(breakdown.subtotal, curr)}</span>
        </div>
        {breakdown.vatAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">VAT (18%)</span>
            <span>{formatCurrency(breakdown.vatAmount, curr)}</span>
          </div>
        )}
        <div className="border-t pt-1.5 mt-1.5" />
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatCurrency(breakdown.total, curr)}</span>
        </div>
      </div>
    </div>
  );
}
