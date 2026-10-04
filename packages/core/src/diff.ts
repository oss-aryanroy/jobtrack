import type { Dataset, Settings } from "./model";

export const TABLES = ["companies", "applications", "interviews", "followUps", "activities"] as const;
export type Table = (typeof TABLES)[number];
type Row = { id: string };

export interface DatasetDiff {
  upserts: Partial<Record<Table, Row[]>>;
  deletes: Partial<Record<Table, string[]>>;
  settings?: Settings;
}

export function diffDatasets(prev: Dataset, next: Dataset): DatasetDiff {
  const diff: DatasetDiff = { upserts: {}, deletes: {} };
  for (const table of TABLES) {
    const before = new Map<string, Row>((prev[table] as Row[]).map((r) => [r.id, r]));
    const upserts: Row[] = [];
    for (const row of next[table] as Row[]) {
      if (before.get(row.id) !== row) upserts.push(row);
      before.delete(row.id);
    }
    if (upserts.length) diff.upserts[table] = upserts;
    if (before.size) diff.deletes[table] = [...before.keys()];
  }
  if (prev.settings !== next.settings) diff.settings = next.settings;
  return diff;
}

export const isEmptyDiff = (d: DatasetDiff) =>
  !d.settings && Object.keys(d.upserts).length === 0 && Object.keys(d.deletes).length === 0;
