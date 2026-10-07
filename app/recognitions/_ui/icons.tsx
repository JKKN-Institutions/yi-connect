/**
 * A small, hand-drawn icon set for Recognitions — deliberately not the icon
 * library the rest of the codebase uses. 1.6px strokes, round joins.
 */
type P = { size?: number; className?: string; title?: string };

function Svg({ size = 18, className, title, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** The mark: a medal on a split ribbon. */
export function MedalMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M9 2h6l3 9h-6z" fill="#1f5a43" />
      <path d="M23 2h-6l-3 9h6z" fill="#12372a" />
      <circle cx="16" cy="20" r="9" fill="#b4862f" />
      <circle cx="16" cy="20" r="6.2" fill="none" stroke="#f6f1e4" strokeWidth="1.2" />
      <path d="M16 15.8l1.3 2.7 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4z" fill="#f6f1e4" />
    </svg>
  );
}

export const IconCheck = (p: P) => (
  <Svg {...p}><path d="M5 12.5l4.2 4.2L19 7" /></Svg>
);
export const IconLock = (p: P) => (
  <Svg {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Svg>
);
export const IconArrowRight = (p: P) => (
  <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
);
export const IconArrowLeft = (p: P) => (
  <Svg {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Svg>
);
export const IconDownload = (p: P) => (
  <Svg {...p}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></Svg>
);
export const IconUpload = (p: P) => (
  <Svg {...p}><path d="M12 20V9M7 14l5-5 5 5M5 4h14" /></Svg>
);
export const IconEyeOff = (p: P) => (
  <Svg {...p}><path d="M3 3l18 18" /><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4.5 9.5 6-.5.8-1.7 2.4-3.4 3.8M6.3 7.8C4.4 9.2 3 11.1 2.5 12c1 1.5 4.5 6 9.5 6 1.6 0 3-.4 4.3-1.1" /></Svg>
);
export const IconSeal = (p: P) => (
  <Svg {...p}><circle cx="12" cy="10" r="6" /><path d="M8.5 15l-1.5 6 5-2.5 5 2.5-1.5-6" /></Svg>
);
export const IconClock = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>
);
export const IconReturn = (p: P) => (
  <Svg {...p}><path d="M9 7L4 12l5 5" /><path d="M4 12h11a5 5 0 0 1 0 10h-2" /></Svg>
);
export const IconQuill = (p: P) => (
  <Svg {...p}><path d="M20 4c-6 0-11 4-13 11l-2 5 5-2c7-2 10-8 10-14z" /><path d="M7 17l6-6" /></Svg>
);
export const IconGate = (p: P) => (
  <Svg {...p}><path d="M4 21V8l8-5 8 5v13" /><path d="M9 21v-6h6v6" /></Svg>
);
