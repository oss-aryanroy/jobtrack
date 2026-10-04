import { addDays, localDayKey } from "./dates";
import { type Application, type Dataset, type FollowUp, type FollowUpKind, type Interview, type Settings, newId } from "./model";

export const planAfterApply = (app: Application, settings: Settings): FollowUp => ({
  id: newId(),
  applicationId: app.id,
  dueAt: addDays(app.appliedAt ?? app.createdAt, settings.followUpDays),
  kind: "after_apply",
  attempt: 1,
});

export const planAfterInterview = (interview: Interview, settings: Settings): FollowUp => ({
  id: newId(),
  applicationId: interview.applicationId,
  dueAt: addDays(interview.startsAt, Math.max(1, Math.round(settings.followUpDays * 0.8))),
  kind: "after_interview",
  attempt: 1,
});

export const cancelOpenFollowUps = (followUps: FollowUp[], applicationId: string, now: string, kinds: FollowUpKind[]) =>
  followUps.map((f) => (f.applicationId === applicationId && !f.doneAt && kinds.includes(f.kind) ? { ...f, doneAt: now } : f));

export function completeFollowUp(data: Dataset, followUpId: string, now = new Date().toISOString()): Dataset {
  const fu = data.followUps.find((f) => f.id === followUpId);
  if (!fu || fu.doneAt) return data;
  const app = data.applications.find((a) => a.id === fu.applicationId);
  const followUps = data.followUps.map((f) => (f.id === followUpId ? { ...f, doneAt: now } : f));
  const stillWaiting = app?.stage === "applied" && fu.kind !== "after_interview";
  if (!stillWaiting || fu.attempt >= data.settings.maxTries) return { ...data, followUps };
  const next: FollowUp = {
    id: newId(),
    applicationId: fu.applicationId,
    dueAt: addDays(now, data.settings.repeatDays),
    kind: "repeat",
    attempt: fu.attempt + 1,
  };
  return { ...data, followUps: [...followUps, next] };
}

export function snoozeFollowUp(data: Dataset, followUpId: string, days: number, now = new Date().toISOString()): Dataset {
  return {
    ...data,
    followUps: data.followUps.map((f) => (f.id === followUpId ? { ...f, dueAt: addDays(now, days) } : f)),
  };
}

export function markNoReply(data: Dataset, followUpId: string, now = new Date().toISOString()): Dataset {
  const fu = data.followUps.find((f) => f.id === followUpId);
  if (!fu) return data;
  return {
    ...data,
    followUps: data.followUps.map((f) => (f.applicationId === fu.applicationId && !f.doneAt ? { ...f, doneAt: now } : f)),
    applications: data.applications.map((a) =>
      a.id === fu.applicationId ? { ...a, stage: "closed", closeReason: "no_reply", updatedAt: now } : a,
    ),
  };
}

export interface FollowUpBuckets {
  overdue: FollowUp[];
  today: FollowUp[];
  upcoming: FollowUp[];
}

export function bucketFollowUps(followUps: FollowUp[], now = new Date().toISOString(), hiddenApps = new Set<string>()): FollowUpBuckets {
  const today = localDayKey(now);
  const out: FollowUpBuckets = { overdue: [], today: [], upcoming: [] };
  for (const f of followUps) {
    if (f.doneAt || hiddenApps.has(f.applicationId)) continue;
    const day = localDayKey(f.dueAt);
    if (day < today) out.overdue.push(f);
    else if (day === today) out.today.push(f);
    else out.upcoming.push(f);
  }
  const byDue = (a: FollowUp, b: FollowUp) => a.dueAt.localeCompare(b.dueAt);
  out.overdue.sort(byDue);
  out.today.sort(byDue);
  out.upcoming.sort(byDue);
  return out;
}
