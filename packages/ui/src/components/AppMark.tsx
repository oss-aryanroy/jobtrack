export function AppMark({ size = 84 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="100 100 824 824" role="img" aria-label="JobTrack">
      <defs>
        <linearGradient id="jt-mark-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#5B21B6" />
        </linearGradient>
      </defs>
      <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#jt-mark-bg)" />
      <path d="M600 262 L600 590 A170 170 0 0 1 260 590" fill="none" stroke="#fff" strokeWidth="96" strokeLinecap="round" />
      <circle cx="742" cy="262" r="46" fill="#fff" fillOpacity="0.45" />
      <circle cx="742" cy="412" r="46" fill="#fff" fillOpacity="0.7" />
      <circle cx="742" cy="562" r="56" fill="#F5B83D" />
    </svg>
  );
}
