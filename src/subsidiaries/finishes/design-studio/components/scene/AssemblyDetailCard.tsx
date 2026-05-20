/**
 * AssemblyDetailCard — Shows assembly metadata and BOM summary
 */
import type { SceneAssembly } from '../../types/assembly.types';
import { getAssemblyBOM } from '../../services/assembly.service';

interface AssemblyDetailCardProps {
  assembly: SceneAssembly;
}

export function AssemblyDetailCard({ assembly }: AssemblyDetailCardProps) {
  const bom = getAssemblyBOM(assembly);
  const totalCost = bom.reduce((sum, cat) => sum + cat.subtotal, 0);

  return (
    <div className="rounded-lg border p-4 space-y-3">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gray-200 text-gray-600 rounded">
            {assembly.assemblyType}
          </span>
          {!assembly.isComplete && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">
              Incomplete
            </span>
          )}
        </div>
        <h4 className="text-sm font-semibold mt-1">{assembly.displayName}</h4>
      </div>

      {/* Metrics */}
      <div className="flex gap-4 text-xs text-gray-500">
        <span>{assembly.totalPartCount} parts</span>
        {assembly.totalArea > 0 && <span>{assembly.totalArea.toFixed(2)} m²</span>}
        {totalCost > 0 && <span>UGX {totalCost.toLocaleString()}</span>}
      </div>

      {/* Assembly sequence */}
      {assembly.assemblySequence.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Assembly Steps
          </h5>
          <ol className="list-decimal list-inside text-xs text-gray-600 space-y-0.5">
            {assembly.assemblySequence.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {/* BOM by category */}
      {bom.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Bill of Materials
          </h5>
          {bom.map(cat => (
            <div key={cat.category} className="mb-2">
              <p className="text-xs font-medium text-gray-600 capitalize">{cat.category.replace('_', ' ')}</p>
              <div className="space-y-0.5 ml-2">
                {cat.lineItems.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs text-gray-500">
                    <span className="truncate max-w-[60%]">{item.description || item.inventoryItemName}</span>
                    <span>{item.quantity} {item.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Joint specs */}
      {assembly.jointSpec.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Joints
          </h5>
          <div className="space-y-0.5">
            {assembly.jointSpec.map((joint, i) => (
              <p key={i} className="text-xs text-gray-500">
                {joint.type} — {joint.connectsTo?.join(', ')}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
