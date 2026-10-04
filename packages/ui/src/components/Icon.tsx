const PATHS = {
  plus: "M10 4v12M4 10h12",
  home: "M3.5 9 10 3.5 16.5 9v7.5h-4.5v-4.5h-4v4.5H3.5z",
  apps: "M3 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM7 4V3h6v1M3 9h14",
  board: "M3 4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM8 4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1zM13 4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1z",
  calendar: "M3 6.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 8.5h14M7 2.5v3.5M13 2.5v3.5",
  bell: "M5 13.5V9a5 5 0 0 1 10 0v4.5l1.5 2h-13zM8.5 17.5h3",
  interview: "M3.5 4.5h13v9h-7l-4 3v-3h-2z",
  company: "M5.5 3h9A1.5 1.5 0 0 1 16 4.5v12.5H4V4.5A1.5 1.5 0 0 1 5.5 3zM7.5 6.5h1M11.5 6.5h1M7.5 10h1M11.5 10h1M8.5 17v-3h3v3",
  settings: "M10 7.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4",
  search: "M8.5 4a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM12 12l4.5 4.5",
  link: "M8.1 11.9a3.75 3.75 0 0 0 5.3 0l2.9-2.9a3.75 3.75 0 0 0-5.3-5.3L9.5 5.1M11.9 8.1a3.75 3.75 0 0 0-5.3 0L3.7 11a3.75 3.75 0 0 0 5.3 5.3l1.5-1.4",
  external: "M7 4h9v9M16 4 5 15",
  check: "m4.5 10.5 3.5 3.5 7.5-8",
  dash: "M5 10h10",
  x: "m5.5 5.5 9 9M14.5 5.5l-9 9",
  arrow: "M4 10h12M11 5l5 5-5 5",
  info: "M10 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM10 7v4M10 13.5h.01",
  chevronLeft: "m12 5-5 5 5 5",
  chevronRight: "m8 5 5 5-5 5",
  briefcase: "M5 6h10a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM7.5 6V4.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V6",
  upload: "M10 13V3.5M6 7.5l4-4 4 4M4 13v2.5h12V13",
  download: "M10 3.5V13M6 9l4 4 4-4M4 13v2.5h12V13",
  trash: "M4.5 6h11l-1 10.5h-9zM8 3.5h4M3 6h14",
  archive: "M3 4h14v3.5H3zM4.5 7.5V16h11V7.5M8 10.5h4",
  undo: "M7.5 6 4 9.5 7.5 13M4.5 9.5h7a4 4 0 0 1 0 8H9",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, stroke = 1.7 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
