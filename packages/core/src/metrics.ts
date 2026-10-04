import { daysBetween, startOfWeek } from "./dates";
import type { Application, Interview, Stage } from "./model";

export const MIN_SAMPLE = 10;

export interface Rate {
  num: number;
  den: number;
  value: number | null;
  small: boolean;
}

export const rate = (num: number, den: number, minSample = MIN_SAMPLE): Rate => ({
  num,
  den,
  value: den > 0 ? num / den : null,
  small: den < minSample,
});

const submitted = (apps: Application[]) => apps.filter((a) => !a.trashedAt && a.appliedAt);

export const replyRate = (apps: Application[]) => {
  const s = submitted(apps);
  return rate(s.filter((a) => a.repliedAt).length, s.length);
};

export function reachedInterview(app: Application, interviewAppIds: Set<string>) {
  return (
    interviewAppIds.has(app.id) ||
    app.stage === "interviewing" ||
    app.stage === "offer" ||
    app.closeReason === "accepted_offer" ||
    app.closeReason === "declined_offer"
  );
}

export const interviewRate = (apps: Application[], interviews: Interview[]) => {
  const ids = new Set(interviews.map((i) => i.applicationId));
  const s = submitted(apps);
  return rate(s.filter((a) => reachedInterview(a, ids)).length, s.length);
};

const isOffer = (a: Application) => a.stage === "offer" || a.closeReason === "accepted_offer" || a.closeReason === "declined_offer";

export const offerRate = (apps: Application[]) => {
  const s = submitted(apps);
  return rate(s.filter(isOffer).length, s.length);
};

export function stageCounts(apps: Application[]): Record<Stage, number> {
  const out: Record<Stage, number> = { saved: 0, applied: 0, screen: 0, interviewing: 0, offer: 0, closed: 0 };
  for (const a of apps) if (!a.trashedAt) out[a.stage]++;
  return out;
}

export function weeklyCounts(apps: Application[], now = new Date().toISOString(), weeks = 12) {
  const current = new Date(startOfWeek(now)).getTime();
  const out = Array.from({ length: weeks }, (_, i) => ({
    weekStart: new Date(current - (weeks - 1 - i) * 7 * 86_400_000).toISOString(),
    count: 0,
  }));
  for (const a of submitted(apps)) {
    const idx = out.findIndex((w) => w.weekStart === startOfWeek(a.appliedAt!));
    if (idx >= 0) out[idx]!.count++;
  }
  return out;
}

export function bySource(apps: Application[]) {
  const groups = new Map<string, Application[]>();
  for (const a of submitted(apps)) {
    const key = a.source || "Other";
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  return [...groups.entries()]
    .map(([source, list]) => ({ source, reply: rate(list.filter((a) => a.repliedAt).length, list.length) }))
    .sort((a, b) => b.reply.den - a.reply.den);
}

export function medianDaysToReply(apps: Application[]): number | null {
  const days = submitted(apps)
    .filter((a) => a.repliedAt)
    .map((a) => daysBetween(a.appliedAt!, a.repliedAt!))
    .sort((a, b) => a - b);
  if (days.length === 0) return null;
  const mid = Math.floor(days.length / 2);
  return days.length % 2 ? days[mid]! : (days[mid - 1]! + days[mid]!) / 2;
}

export const formatRate = (r: Rate) => (r.value === null ? "—" : r.small ? "too few" : `${Math.round(r.value * 100)}%`);
