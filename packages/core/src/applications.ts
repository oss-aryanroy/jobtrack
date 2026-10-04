import { addDays } from "./dates";
import {
  type Activity,
  type Application,
  type CloseReason,
  type Company,
  type Dataset,
  type Interview,
  type Stage,
  CLOSE_REASON_LABELS,
  STAGE_LABELS,
  newId,
} from "./model";
import type { QuickParse } from "./quick";
import { cancelOpenFollowUps, planAfterApply, planAfterInterview } from "./followups";

const STAGE_ORDER: Record<Stage, number> = { saved: 0, applied: 1, screen: 2, interviewing: 3, offer: 4, closed: 5 };

export const normalizeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function findOrCreateCompany(companies: Company[], name: string): { company: Company; created: boolean } {
  const clean = name.trim() || "Unknown company";
  const key = normalizeName(clean);
  const existing = companies.find((c) => normalizeName(c.name) === key);
  if (existing) return { company: existing, created: false };
  return { company: { id: newId(), name: clean, notes: "" }, created: true };
}

const activity = (applicationId: string, at: string, kind: string, text: string): Activity => ({
  id: newId(),
  applicationId,
  at,
  kind,
  text,
});

export interface Change {
  dataset: Dataset;
  applicationId: string;
}

export function addApplication(data: Dataset, input: QuickParse & { stage?: Stage }, now = new Date().toISOString()): Change {
  const { company, created } = findOrCreateCompany(data.companies, input.company ?? "");
  const stage = input.stage ?? data.settings.defaultStage;
  const app: Application = {
    id: newId(),
    companyId: company.id,
    role: input.role?.trim() || "Untitled role",
    url: input.url,
    jobId: input.jobId,
    source: input.source,
    stage,
    priority: 0,
    tags: [],
    notes: "",
    appliedAt: STAGE_ORDER[stage] >= STAGE_ORDER.applied ? now : undefined,
    createdAt: now,
    updatedAt: now,
  };
  const followUps = app.appliedAt ? [planAfterApply(app, data.settings)] : [];
  return {
    applicationId: app.id,
    dataset: {
      ...data,
      companies: created ? [...data.companies, company] : data.companies,
      applications: [...data.applications, app],
      followUps: [...data.followUps, ...followUps],
      activities: [...data.activities, activity(app.id, now, "created", stage === "saved" ? "Saved" : "Applied")],
    },
  };
}

export function changeStage(
  data: Dataset,
  applicationId: string,
  stage: Stage,
  closeReason?: CloseReason,
  now = new Date().toISOString(),
): Dataset {
  const app = data.applications.find((a) => a.id === applicationId);
  if (!app || (app.stage === stage && app.closeReason === closeReason)) return data;
  const reason = stage === "closed" ? (closeReason ?? "rejected") : undefined;
  const heardBack = (STAGE_ORDER[stage] >= STAGE_ORDER.screen && stage !== "closed") || reason === "rejected";
  const updated: Application = {
    ...app,
    stage,
    closeReason: reason,
    appliedAt: app.appliedAt ?? (STAGE_ORDER[stage] >= STAGE_ORDER.applied ? now : undefined),
    repliedAt: app.repliedAt ?? (heardBack ? now : undefined),
    updatedAt: now,
  };
  const text =
    stage === "closed" ? `Closed: ${CLOSE_REASON_LABELS[updated.closeReason!]}` : `Moved to ${STAGE_LABELS[stage]}`;
  let followUps = data.followUps;
  if (stage !== "applied") followUps = cancelOpenFollowUps(followUps, applicationId, now, ["after_apply", "repeat"]);
  if (stage === "applied" && !app.appliedAt) followUps = [...followUps, planAfterApply(updated, data.settings)];
  return {
    ...data,
    applications: data.applications.map((a) => (a.id === applicationId ? updated : a)),
    followUps,
    activities: [...data.activities, activity(applicationId, now, "stage", text)],
  };
}

export function updateApplication(
  data: Dataset,
  applicationId: string,
  patch: Partial<Omit<Application, "id" | "createdAt">>,
  now = new Date().toISOString(),
): Dataset {
  return {
    ...data,
    applications: data.applications.map((a) => (a.id === applicationId ? { ...a, ...patch, updatedAt: now } : a)),
  };
}

export const archiveApplication = (data: Dataset, id: string, now = new Date().toISOString()) =>
  updateApplication(data, id, { archivedAt: now }, now);

export const trashApplication = (data: Dataset, id: string, now = new Date().toISOString()) =>
  updateApplication(data, id, { trashedAt: now }, now);

export const restoreApplication = (data: Dataset, id: string, now = new Date().toISOString()) =>
  updateApplication(data, id, { trashedAt: undefined, archivedAt: undefined }, now);

export function deletePermanently(data: Dataset, id: string): Dataset {
  return {
    ...data,
    applications: data.applications.filter((a) => a.id !== id),
    interviews: data.interviews.filter((i) => i.applicationId !== id),
    followUps: data.followUps.filter((f) => f.applicationId !== id),
    activities: data.activities.filter((a) => a.applicationId !== id),
  };
}

export function addInterview(
  data: Dataset,
  applicationId: string,
  startsAt: string,
  round: Interview["round"] = "other",
  now = new Date().toISOString(),
): Dataset {
  const interview: Interview = { id: newId(), applicationId, startsAt, durationMinutes: 60, round, prep: "", outcomeNote: "" };
  const app = data.applications.find((a) => a.id === applicationId);
  let next: Dataset = { ...data, interviews: [...data.interviews, interview] };
  if (app && STAGE_ORDER[app.stage] < STAGE_ORDER.interviewing) next = changeStage(next, applicationId, "interviewing", undefined, now);
  return {
    ...next,
    followUps: [...next.followUps, planAfterInterview(interview, data.settings)],
    activities: [...next.activities, activity(applicationId, now, "interview", "Interview scheduled")],
  };
}

export function recordOutcome(
  data: Dataset,
  interviewId: string,
  outcome: Interview["outcome"],
  note = "",
  now = new Date().toISOString(),
): Dataset {
  const interview = data.interviews.find((i) => i.id === interviewId);
  if (!interview) return data;
  return {
    ...data,
    interviews: data.interviews.map((i) => (i.id === interviewId ? { ...i, outcome, outcomeNote: note } : i)),
    activities: [...data.activities, activity(interview.applicationId, now, "interview", "Interview outcome recorded")],
  };
}

export const interviewEnd = (i: Interview) => addDays(i.startsAt, i.durationMinutes / 1440);

export const isVisible = (a: Application) => !a.trashedAt && !a.archivedAt;
export const isActive = (a: Application) => isVisible(a) && a.stage !== "closed";
