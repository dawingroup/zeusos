/**
 * HardwareSpecCard — Card showing hardware spec from DKB
 * Displays name, supplier, boring pattern, compatible components
 */
import type { HardwareSpecEntry } from '../../types/knowledgeBase.types';

interface HardwareSpecCardProps {
  spec: HardwareSpecEntry;
}

export function HardwareSpecCard({ spec }: HardwareSpecCardProps) {
  const { boringSpec, mountingClearances } = spec;

  return (
    <div className="border border-border rounded-lg p-3 bg-card">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-xs font-semibold">{spec.name}</h4>
          <p className="text-[10px] text-muted-foreground">{spec.description}</p>
        </div>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
          {spec.hardwareFamily}
        </span>
      </div>

      {spec.manufacturer && (
        <div className="mt-2 text-[10px]">
          <span className="text-muted-foreground">Manufacturer:</span>{' '}
          {spec.manufacturer} {spec.modelNumber && `(${spec.modelNumber})`}
        </div>
      )}

      {/* Boring pattern diagram (simplified) */}
      <div className="mt-2 border border-dashed border-border rounded p-2">
        <div className="text-[9px] font-medium text-muted-foreground uppercase mb-1">
          Boring Pattern
        </div>
        <div className="grid grid-cols-3 gap-1 text-[10px]">
          <div>
            <span className="text-muted-foreground">Diameter:</span> {boringSpec.diameter}mm
          </div>
          <div>
            <span className="text-muted-foreground">Depth:</span> {boringSpec.depth}mm
          </div>
          <div>
            <span className="text-muted-foreground">Offset:</span> {boringSpec.offsetFromEdge}mm
          </div>
        </div>
        <div className="text-[10px] mt-1">
          <span className="text-muted-foreground">Pattern:</span>{' '}
          {boringSpec.pattern === 'line_32mm' ? 'System 32 line boring' : boringSpec.pattern}
        </div>
      </div>

      {/* Mounting clearances */}
      <div className="mt-2 text-[10px]">
        <span className="text-muted-foreground">Clearances:</span>{' '}
        T:{mountingClearances.top}mm B:{mountingClearances.bottom}mm S:{mountingClearances.side}mm
      </div>

      {spec.weightCapacityKg && (
        <div className="text-[10px]">
          <span className="text-muted-foreground">Capacity:</span> {spec.weightCapacityKg}kg
        </div>
      )}

      {spec.compatibilityRules.length > 0 && (
        <div className="mt-2">
          <div className="text-[9px] font-medium text-muted-foreground uppercase">Rules</div>
          <ul className="text-[10px] list-disc list-inside">
            {spec.compatibilityRules.map((rule, i) => (
              <li key={i}>{rule}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
