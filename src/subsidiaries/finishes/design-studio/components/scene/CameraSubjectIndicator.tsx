/**
 * CameraSubjectIndicator — Subtle label showing what's currently framed
 */
import type { CameraSubject } from '../../types/framing.types';

interface CameraSubjectIndicatorProps {
  subject: CameraSubject;
  isUserControlled?: boolean;
  subjectLabel?: string;    // Override display name (e.g. from cabinet roster)
}

const TYPE_LABELS: Record<CameraSubject['type'], string> = {
  scene: 'Scene',
  cabinet: 'Cabinet',
  assembly: 'Assembly',
  part: 'Part',
  custom_bounds: 'Custom',
};

export function CameraSubjectIndicator({
  subject,
  isUserControlled,
  subjectLabel,
}: CameraSubjectIndicatorProps) {
  const typeLabel = TYPE_LABELS[subject.type];
  const name = subjectLabel ?? (subject.id === 'root' ? 'All' : subject.id);

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium transition-opacity ${
      isUserControlled ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-700'
    }`}>
      <span className="opacity-60">Framing:</span>
      <span className="font-semibold">{typeLabel}</span>
      {name !== 'All' && (
        <>
          <span className="opacity-60">·</span>
          <span className="font-mono">{name}</span>
        </>
      )}
    </div>
  );
}
