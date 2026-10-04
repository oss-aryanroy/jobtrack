import { type Application, type Company, type Dataset, type Stage, localDayKey } from "@jobtrack/core";

export const STAGE_COLOR: Record<Stage, string> = {
  saved: "var(--st-saved)",
  applied: "var(--st-applied)",
  screen: "var(--st-screen)",
  interviewing: "var(--st-interviewing)",
  offer: "var(--st-offer)",
  closed: "var(--st-closed)",
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

export const companyMap = (data: Dataset) => new Map(data.companies.map((c) => [c.id, c]));

export const companyName = (companies: Map<string, Company>, app: Application) => companies.get(app.companyId)?.name ?? "Unknown company";

const dayFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const longFmt = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" });

export const fmtDay = (iso?: string) => (iso ? dayFmt.format(new Date(iso)) : "");
export const fmtTime = (iso: string) => timeFmt.format(new Date(iso));
export const fmtWeekday = (iso: string) => weekdayFmt.format(new Date(iso));
export const fmtLong = (iso: string) => longFmt.format(new Date(iso));

export function relativeDay(iso: string, now = new Date().toISOString()) {
  const days = Math.round((new Date(localDayKey(iso)).getTime() - new Date(localDayKey(now)).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 1 && days < 7) return fmtWeekday(iso);
  if (days < 0) return `${-days} days ago`;
  return fmtDay(iso);
}

export const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const fromLocalInput = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
