import * as React from 'react';

export type IconName =
  | 'home' | 'inbox' | 'doc' | 'plans' | 'chat' | 'chart' | 'calendar'
  | 'box' | 'money' | 'flag' | 'pin' | 'bell' | 'search'
  | 'arrow-r' | 'arrow-l' | 'arrow-tr' | 'plus' | 'check' | 'x'
  | 'menu' | 'more' | 'download' | 'expand' | 'pencil' | 'comment'
  | 'image' | 'paperclip' | 'send' | 'dot' | 'star' | 'logo' | 'matflow'
  | 'mail';

interface IconProps {
  name: IconName;
  size?: number;
  stroke?: number;
  color?: string;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 18, stroke = 1.5, color, style }: IconProps) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: { ...(color ? { color } : null), ...style },
  };
  switch (name) {
    case 'home':       return <svg {...props}><path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2v-9z"/></svg>;
    case 'inbox':      return <svg {...props}><path d="M3 13h6l2 3h2l2-3h6"/><path d="M5 5h14l2 8v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6L5 5z"/></svg>;
    case 'doc':        return <svg {...props}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z"/><path d="M14 3v6h6"/></svg>;
    case 'plans':      return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18M15 13h4"/></svg>;
    case 'chat':       return <svg {...props}><path d="M21 12a8 8 0 1 1-3.2-6.4L21 4l-1 4.2A8 8 0 0 1 21 12z"/></svg>;
    case 'chart':      return <svg {...props}><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-7"/></svg>;
    case 'calendar':   return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>;
    case 'box':        return <svg {...props}><path d="M21 8L12 3 3 8v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v10"/></svg>;
    case 'money':      return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M15 9a3 3 0 0 0-6 0c0 3 6 2 6 5a3 3 0 0 1-6 0M12 6v2M12 16v2"/></svg>;
    case 'flag':       return <svg {...props}><path d="M4 21V4M4 4h13l-2 4 2 4H4"/></svg>;
    case 'pin':        return <svg {...props}><circle cx="12" cy="10" r="3"/><path d="M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z"/></svg>;
    case 'bell':       return <svg {...props}><path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2zM10 21a2 2 0 0 0 4 0"/></svg>;
    case 'search':     return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></svg>;
    case 'arrow-r':    return <svg {...props}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'arrow-l':    return <svg {...props}><path d="M19 12H5M11 18l-6-6 6-6"/></svg>;
    case 'arrow-tr':   return <svg {...props}><path d="M7 17L17 7M9 7h8v8"/></svg>;
    case 'plus':       return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case 'check':      return <svg {...props}><path d="M5 12l5 5L20 7"/></svg>;
    case 'x':          return <svg {...props}><path d="M6 6l12 12M18 6l-12 12"/></svg>;
    case 'menu':       return <svg {...props}><path d="M4 7h16M4 12h16M4 17h16"/></svg>;
    case 'more':       return <svg {...props}><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>;
    case 'download':   return <svg {...props}><path d="M12 4v12M6 11l6 6 6-6M5 20h14"/></svg>;
    case 'expand':     return <svg {...props}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>;
    case 'pencil':     return <svg {...props}><path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="M14 6l4 4"/></svg>;
    case 'comment':    return <svg {...props}><path d="M21 11a8 8 0 1 1-3.2-6.4L21 4l-1 4.2A8 8 0 0 1 21 11zM8 11h8M8 8h5"/></svg>;
    case 'image':      return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>;
    case 'paperclip':  return <svg {...props}><path d="M21 12l-9 9a5 5 0 0 1-7-7l9-9a3 3 0 0 1 4 4l-9 9a1 1 0 0 1-1-1l8-8"/></svg>;
    case 'send':       return <svg {...props}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>;
    case 'dot':        return <svg {...props}><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>;
    case 'star':       return <svg {...props}><path d="M12 3l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6z"/></svg>;
    case 'logo':       return <svg {...props}><path d="M4 4h8a8 8 0 0 1 0 16H4V4z"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></svg>;
    case 'matflow':    return <svg {...props}><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h8M6 8v8M18 8v8M8 18h8"/></svg>;
    case 'mail':       return <svg {...props}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>;
    default:           return <svg {...props}><circle cx="12" cy="12" r="6"/></svg>;
  }
}
