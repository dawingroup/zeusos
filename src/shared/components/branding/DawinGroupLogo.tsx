/**
 * Dawin Group Logo Component
 * Professional logo for header branding
 * Supports custom uploaded logos via Firebase Storage
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

  console.log('[DawinGroupLogo] Current branding:', branding);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Logo - Custom or Default SVG */}
      {branding.logoUrl ? (
        <img
          src={branding.logoUrl}
          alt="Logo"
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
          {/* Background with gradient */}
          <defs>
            <linearGradient id="dawinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#872E5C', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#E18425', stopOpacity: 1 }} />
            </linearGradient>
          </defs>

          {/* Rounded square background */}
          <rect x="2" y="2" width="96" height="96" rx="20" fill="url(#dawinGradient)" />

          {/* Letter D */}
          <path
            d="M 20 25 L 20 75 L 42 75 C 55 75 62 68 62 50 C 62 32 55 25 42 25 Z M 30 35 L 40 35 C 48 35 52 40 52 50 C 52 60 48 65 40 65 L 30 65 Z"
            fill="white"
          />

          {/* Letter G - stylized */}
          <path
            d="M 68 40 C 72 36 76 34 80 34 C 84 34 88 36 90 40 L 85 44 C 84 42 82 40 80 40 C 76 40 73 43 73 50 C 73 57 76 60 80 60 C 82 60 84 59 85 57 L 85 52 L 80 52 L 80 47 L 90 47 L 90 60 C 88 63 84 66 80 66 C 72 66 67 61 67 50 C 67 39 72 34 80 34 Z"
            fill="white"
          />
        </svg>
      )}

      {/* Optional text */}
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-gray-900">Dawin Group</span>
          <span className="text-[10px] text-gray-500">Manufacturing Excellence</span>
        </div>
      )}
    </div>
  );
}

export default DawinGroupLogo;
