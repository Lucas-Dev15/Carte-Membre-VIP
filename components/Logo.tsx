/** Carré arrondi jaune avec éclair noir (§2.1). */
export function BoltIcon({ size = 24, radius }: { size?: number; radius?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none" }}>
      <rect width="24" height="24" rx={radius ?? 6} fill="#F9B233" />
      <path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="#111114" transform="translate(4.2 4.2) scale(0.65)" />
    </svg>
  );
}

export const BOLT_PATH = "M13 2L4 14h7l-1 8 9-12h-7z";
