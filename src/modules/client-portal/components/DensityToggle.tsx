import { usePortalPreferences, type PortalDensity } from '../hooks/usePortalPreferences';

/**
 * DensityToggle — three-position segmented control for the
 * client portal's row density. Mounted in the desktop TopBar so it's
 * always reachable. State persists via usePortalPreferences (localStorage).
 */
export function DensityToggle() {
  const { prefs, setDensity } = usePortalPreferences();

  const options: Array<{ value: PortalDensity; label: string; title: string }> = [
    { value: 'dense',    label: 'D', title: 'Dense rows (32px)' },
    { value: 'balanced', label: 'B', title: 'Balanced rows (40px) — default' },
    { value: 'airy',     label: 'A', title: 'Airy rows (52px)' },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Row density"
      className="h-segment"
      style={{ padding: 2 }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={prefs.density === o.value}
          title={o.title}
          onClick={() => setDensity(o.value)}
          className={'h-segment-i' + (prefs.density === o.value ? ' is-on' : '')}
          style={{
            font: '500 10.5px/1 var(--font-mono)',
            padding: '4px 7px',
            minWidth: 22,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >{o.label}</button>
      ))}
    </div>
  );
}
