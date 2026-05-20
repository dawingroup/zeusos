/**
 * HardwareScheduleView — Hardware list with quantities and boring specs
 */
import type { HardwareScheduleEntry } from '../../types/mdp.types';

interface HardwareScheduleViewProps {
  schedule: HardwareScheduleEntry[];
}

export function HardwareScheduleView({ schedule }: HardwareScheduleViewProps) {
  if (schedule.length === 0) {
    return <p className="text-sm text-gray-500">No hardware schedule available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-2 pr-4">Hardware</th>
            <th className="py-2 pr-4">Qty</th>
            <th className="py-2 pr-4">Boring</th>
            <th className="py-2 pr-4">Notes</th>
          </tr>
        </thead>
        <tbody>
          {schedule.map((entry, idx) => (
            <tr key={`${entry.hardwareName}-${idx}`} className="border-b">
              <td className="py-2 pr-4">{entry.hardwareName}</td>
              <td className="py-2 pr-4">{entry.quantity}</td>
              <td className="py-2 pr-4">
                {entry.boringRequired && entry.boringSpec
                  ? `${entry.boringSpec.diameter}mm x ${entry.boringSpec.depth}mm`
                  : '-'}
              </td>
              <td className="py-2 pr-4 text-gray-500">{entry.notes || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
