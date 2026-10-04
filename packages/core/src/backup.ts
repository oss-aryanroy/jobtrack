import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import * as pb from "./gen/jobtrack/v1/jobtrack_pb";
import {
  type Application,
  type CloseReason,
  type Dataset,
  type FollowUpKind,
  type Outcome,
  type Round,
  type SalaryPeriod,
  type Stage,
  CLOSE_REASONS,
  FOLLOW_UP_KINDS,
  OUTCOMES,
  ROUNDS,
  STAGES,
  defaultSettings,
} from "./model";

export const FORMAT_VERSION = 1;
export const FILE_EXTENSION = ".jobtrack";

const enumIn = <T extends string>(values: readonly T[], n: number) => (n > 0 ? values[n - 1] : undefined);
const enumOut = <T extends string>(values: readonly T[], v: T | undefined) => (v ? values.indexOf(v) + 1 : 0);
const PERIODS: SalaryPeriod[] = ["year", "month", "hour"];
const opt = (s: string) => (s === "" ? undefined : s);

export function encodeBackup(data: Dataset, exportedFrom: string, now = new Date().toISOString()): Uint8Array {
  const msg = create(pb.BackupSchema, {
    formatVersion: FORMAT_VERSION,
    exportedAt: now,
    exportedFrom,
    companies: data.companies.map((c) => ({ id: c.id, name: c.name, website: c.website ?? "", careersUrl: c.careersUrl ?? "", notes: c.notes })),
    applications: data.applications.map((a) => ({
      id: a.id,
      companyId: a.companyId,
      role: a.role,
      url: a.url ?? "",
      jobId: a.jobId ?? "",
      source: a.source ?? "",
      location: a.location ?? "",
      workMode: a.workMode ?? "",
      salary: a.salary && {
        min: a.salary.min ?? 0,
        max: a.salary.max ?? 0,
        currency: a.salary.currency,
        period: enumOut(PERIODS, a.salary.period),
        estimated: a.salary.estimated,
      },
      stage: enumOut(STAGES, a.stage),
      closeReason: enumOut(CLOSE_REASONS, a.closeReason),
      priority: a.priority,
      tags: a.tags,
      notes: a.notes,
      appliedAt: a.appliedAt ?? "",
      repliedAt: a.repliedAt ?? "",
      deadline: a.deadline ?? "",
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      archivedAt: a.archivedAt ?? "",
      trashedAt: a.trashedAt ?? "",
    })),
    interviews: data.interviews.map((i) => ({
      id: i.id,
      applicationId: i.applicationId,
      startsAt: i.startsAt,
      durationMinutes: i.durationMinutes,
      round: enumOut(ROUNDS, i.round),
      prep: i.prep,
      outcome: enumOut(OUTCOMES, i.outcome),
      outcomeNote: i.outcomeNote,
    })),
    followUps: data.followUps.map((f) => ({
      id: f.id,
      applicationId: f.applicationId,
      dueAt: f.dueAt,
      kind: enumOut(FOLLOW_UP_KINDS, f.kind),
      attempt: f.attempt,
      doneAt: f.doneAt ?? "",
    })),
    activities: data.activities,
    settings: {
      defaultStage: enumOut(STAGES, data.settings.defaultStage),
      currency: data.settings.currency,
      followUpDays: data.settings.followUpDays,
      repeatDays: data.settings.repeatDays,
      maxTries: data.settings.maxTries,
      appearance: data.settings.appearance,
    },
  });
  return toBinary(pb.BackupSchema, msg);
}

export class BackupError extends Error {}

export function decodeBackup(bytes: Uint8Array): Dataset {
  let msg: pb.Backup;
  try {
    msg = fromBinary(pb.BackupSchema, bytes);
  } catch {
    throw new BackupError("This file isn't a JobTrack export, or it's damaged.");
  }
  if (msg.formatVersion === 0 || msg.formatVersion > FORMAT_VERSION) {
    throw new BackupError("This file was made by a newer version of JobTrack. Update the app, then import again.");
  }
  const s = msg.settings;
  const applications: Application[] = msg.applications
    .filter((a) => a.id)
    .map((a) => ({
      id: a.id,
      companyId: a.companyId,
      role: a.role || "Untitled role",
      url: opt(a.url),
      jobId: opt(a.jobId),
      source: opt(a.source),
      location: opt(a.location),
      workMode: opt(a.workMode),
      salary: a.salary && (a.salary.min || a.salary.max)
        ? {
            min: a.salary.min || undefined,
            max: a.salary.max || undefined,
            currency: a.salary.currency || "INR",
            period: enumIn(PERIODS, a.salary.period) ?? "year",
            estimated: a.salary.estimated,
          }
        : undefined,
      stage: enumIn<Stage>(STAGES, a.stage) ?? "applied",
      closeReason: enumIn<CloseReason>(CLOSE_REASONS, a.closeReason),
      priority: a.priority,
      tags: a.tags,
      notes: a.notes,
      appliedAt: opt(a.appliedAt),
      repliedAt: opt(a.repliedAt),
      deadline: opt(a.deadline),
      createdAt: a.createdAt || new Date().toISOString(),
      updatedAt: a.updatedAt || a.createdAt || new Date().toISOString(),
      archivedAt: opt(a.archivedAt),
      trashedAt: opt(a.trashedAt),
    }));
  return {
    companies: msg.companies.filter((c) => c.id).map((c) => ({ id: c.id, name: c.name || "Unknown company", website: opt(c.website), careersUrl: opt(c.careersUrl), notes: c.notes })),
    applications,
    interviews: msg.interviews.map((i) => ({
      id: i.id,
      applicationId: i.applicationId,
      startsAt: i.startsAt,
      durationMinutes: i.durationMinutes || 60,
      round: enumIn<Round>(ROUNDS, i.round) ?? "other",
      prep: i.prep,
      outcome: enumIn<Outcome>(OUTCOMES, i.outcome),
      outcomeNote: i.outcomeNote,
    })),
    followUps: msg.followUps.map((f) => ({
      id: f.id,
      applicationId: f.applicationId,
      dueAt: f.dueAt,
      kind: enumIn<FollowUpKind>(FOLLOW_UP_KINDS, f.kind) ?? "repeat",
      attempt: f.attempt || 1,
      doneAt: opt(f.doneAt),
    })),
    activities: msg.activities.map((a) => ({ id: a.id, applicationId: a.applicationId, at: a.at, kind: a.kind, text: a.text })),
    settings: s
      ? {
          defaultStage: enumIn(STAGES, s.defaultStage) === "saved" ? "saved" : "applied",
          currency: s.currency || defaultSettings.currency,
          followUpDays: s.followUpDays || defaultSettings.followUpDays,
          repeatDays: s.repeatDays || defaultSettings.repeatDays,
          maxTries: s.maxTries || defaultSettings.maxTries,
          appearance: s.appearance === "light" || s.appearance === "dark" ? s.appearance : "system",
        }
      : { ...defaultSettings },
  };
}

export interface MergeReport {
  added: { companies: number; applications: number; interviews: number; followUps: number; activities: number };
  skipped: number;
}

export function mergeImport(existing: Dataset, incoming: Dataset): { dataset: Dataset; report: MergeReport } {
  const report: MergeReport = { added: { companies: 0, applications: 0, interviews: 0, followUps: 0, activities: 0 }, skipped: 0 };
  const companyIdMap = new Map<string, string>();
  const companies = [...existing.companies];
  for (const c of incoming.companies) {
    const sameId = companies.find((e) => e.id === c.id);
    const sameName = companies.find((e) => e.name.trim().toLowerCase() === c.name.trim().toLowerCase());
    const match = sameId ?? sameName;
    if (match) companyIdMap.set(c.id, match.id);
    else {
      companies.push(c);
      report.added.companies++;
    }
  }
  const mergeById = <T extends { id: string }>(current: T[], next: T[], key: keyof MergeReport["added"], map = (x: T) => x) => {
    const ids = new Set(current.map((x) => x.id));
    const out = [...current];
    for (const item of next) {
      if (ids.has(item.id)) report.skipped++;
      else {
        out.push(map(item));
        report.added[key]++;
      }
    }
    return out;
  };
  const applications = mergeById(existing.applications, incoming.applications, "applications", (a) => ({
    ...a,
    companyId: companyIdMap.get(a.companyId) ?? a.companyId,
  }));
  return {
    dataset: {
      companies,
      applications,
      interviews: mergeById(existing.interviews, incoming.interviews, "interviews"),
      followUps: mergeById(existing.followUps, incoming.followUps, "followUps"),
      activities: mergeById(existing.activities, incoming.activities, "activities"),
      settings: existing.settings,
    },
    report,
  };
}
