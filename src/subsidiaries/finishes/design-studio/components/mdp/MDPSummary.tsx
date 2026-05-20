/**
 * MDPSummary — Overview card with product, config, price, MO/quote refs
 */
import type { ManufacturingDataPackage } from '../../types/mdp.types';

interface MDPSummaryProps {
  mdp: ManufacturingDataPackage;
}

export function MDPSummary({ mdp }: MDPSummaryProps) {
  const formatCurrency = (amount: number) =>
    mdp.pricingBreakdown.currency === 'USD'
      ? `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      : `UGX ${amount.toLocaleString()}`;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h3 className="font-semibold">Manufacturing Data Package</h3>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500">BOM Lines</span>
          <p className="font-medium">{mdp.bom.length}</p>
        </div>
        <div>
          <span className="text-gray-500">Total</span>
          <p className="font-medium">{formatCurrency(mdp.pricingBreakdown.total)}</p>
        </div>
        {mdp.cutList && (
          <div>
            <span className="text-gray-500">Cut List Parts</span>
            <p className="font-medium">{mdp.cutList.length}</p>
          </div>
        )}
        {mdp.hardwareSchedule && (
          <div>
            <span className="text-gray-500">Hardware Items</span>
            <p className="font-medium">{mdp.hardwareSchedule.length}</p>
          </div>
        )}
        {mdp.shortages.length > 0 && (
          <div>
            <span className="text-gray-500">Shortages</span>
            <p className="font-medium text-amber-600">{mdp.shortages.length}</p>
          </div>
        )}
        {mdp.manufacturingOrderId && (
          <div>
            <span className="text-gray-500">MO ID</span>
            <p className="font-medium font-mono text-xs">{mdp.manufacturingOrderId}</p>
          </div>
        )}
        {mdp.quoteId && (
          <div>
            <span className="text-gray-500">Quote ID</span>
            <p className="font-medium font-mono text-xs">{mdp.quoteId}</p>
          </div>
        )}
      </div>
    </div>
  );
}
