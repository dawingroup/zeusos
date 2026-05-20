/**
 * ProjectionToggle — Segmented control: Perspective / Orthographic
 */

interface ProjectionToggleProps {
  projection: 'perspective' | 'orthographic';
  onChange: (p: 'perspective' | 'orthographic') => void;
}

export function ProjectionToggle({ projection, onChange }: ProjectionToggleProps) {
  return (
    <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5">
      <button
        type="button"
        onClick={() => onChange('perspective')}
        className={`px-2.5 py-1 text-xs font-medium rounded ${
          projection === 'perspective' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
        }`}
        title="Perspective projection"
      >
        Pers
      </button>
      <button
        type="button"
        onClick={() => onChange('orthographic')}
        className={`px-2.5 py-1 text-xs font-medium rounded ${
          projection === 'orthographic' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
        }`}
        title="Orthographic projection"
      >
        Ortho
      </button>
    </div>
  );
}
