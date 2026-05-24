/**
 * Zeus Group Logo Component
 *
 * Renders the Zeus mark for header / sidebar branding. Falls back to a custom
 * uploaded logo from Firebase Storage when `branding.logoUrl` is set.
 *
 * TODO Phase 1.B-cont: rename file + named export to `ZeusGroupLogo` and
 * update every import site. Kept as `DawinGroupLogo` for now to avoid
 * cascading import churn in the same commit as the visual swap.
 *
 * TODO Phase 1.B-cont: replace the inline SVG with Zeus's official polygonal
 * "Z" mark once the asset pack arrives from Jeffrey / studio.
 */

import { useBranding } from '@/shared/hooks/useBranding';

export interface DawinGroupLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export function DawinGroupLogo({
  className = "",
  size = 40,
  showText = false
}: DawinGroupLogoProps) {
  const { branding } = useBranding();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Logo - Custom or Default SVG */}
      {branding.logoUrl ? (
        <img
          src={branding.logoUrl}
          alt="Zeus Group"
          width={size}
          height={size}
          className="flex-shrink-0 object-contain"
        />
      ) : (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
          className="flex-shrink-0"
        >
          {/* Background — vibrant gradient nodding to the Zeus profile's
              rainbow-silk cover art. Yellow (Zeus The Agency) → magenta
              (Odd Gorilla) → cyan (Zeus Digital). */}
          <defs>
            <linearGradient id="zeusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#F5D900', stopOpacity: 1 }} />
              <stop offset="55%" style={{ stopColor: '#E63946', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#00C5E5', stopOpacity: 1 }} />
            </linearGradient>
          </defs>

          {/* Rounded square background */}
          <rect x="2" y="2" width="96" height="96" rx="20" fill="url(#zeusGradient)" />

          {/* Bold "Z" mark — placeholder for Zeus's polygonal Z. */}
          <path
            d="M 22 28 L 78 28 L 78 38 L 40 64 L 78 64 L 78 74 L 22 74 L 22 64 L 60 38 L 22 38 Z"
            fill="white"
          />
        </svg>
      )}

      {/* Optional text */}
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-foreground">Zeus Group</span>
          <span className="text-[10px] text-muted-foreground">#TheZeusWay</span>
        </div>
      )}
    </div>
  );
}

export default DawinGroupLogo;
