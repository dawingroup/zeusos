/**
 * ViewportToolbar — Container composing ViewPresetSelector + ProjectionToggle +
 * RecenterButton + CameraSubjectIndicator at the top of a 3D viewport.
 */
import type { CameraSubject } from '../../types/framing.types';
import type { ViewPresetKey } from '../../constants/framing.constants';
import { VIEW_PRESETS } from '../../constants/framing.constants';
import { ViewPresetSelector } from './ViewPresetSelector';
import { ProjectionToggle } from './ProjectionToggle';
import { RecenterButton } from './RecenterButton';
import { CameraSubjectIndicator } from './CameraSubjectIndicator';

interface ViewportToolbarProps {
  currentPreset: ViewPresetKey;
  onPresetChange: (p: ViewPresetKey) => void;
  onProjectionChange: (p: 'perspective' | 'orthographic') => void;
  onRecenter: () => void;
  isUserControlled: boolean;
  subject: CameraSubject;
  subjectLabel?: string;
  className?: string;
}

export function ViewportToolbar({
  currentPreset,
  onPresetChange,
  onProjectionChange,
  onRecenter,
  isUserControlled,
  subject,
  subjectLabel,
  className,
}: ViewportToolbarProps) {
  const projection = VIEW_PRESETS[currentPreset].projection;

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className ?? ''}`}>
      <CameraSubjectIndicator
        subject={subject}
        isUserControlled={isUserControlled}
        subjectLabel={subjectLabel}
      />
      <div className="flex-1" />
      <ViewPresetSelector currentPreset={currentPreset} onSelect={onPresetChange} />
      <ProjectionToggle projection={projection} onChange={onProjectionChange} />
      <RecenterButton onClick={onRecenter} isUserControlled={isUserControlled} />
    </div>
  );
}
