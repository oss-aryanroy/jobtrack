export const STAGES = ["saved", "applied", "screen", "interviewing", "offer", "closed"] as const;
export type Stage = (typeof STAGES)[number];

export const CLOSE_REASONS = ["rejected", "no_reply", "withdrew", "declined_offer", "accepted_offer"] as const;
export type CloseReason = (typeof CLOSE_REASONS)[number];

export const ROUNDS = ["recruiter", "technical", "coding", "system_design", "hiring_manager", "hr", "final", "other"] as const;
export type Round = (typeof ROUNDS)[number];

export const OUTCOMES = ["went_well", "not_sure", "went_badly"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const FOLLOW_UP_KINDS = ["after_apply", "repeat", "after_interview"] as const;
export type FollowUpKind = (typeof FOLLOW_UP_KINDS)[number];

export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "SGD", "NOK", "SEK", "CHF", "CAD", "AUD"] as const;

export type SalaryPeriod = "year" | "month" | "hour";

export interface Salary {
  min?: number;
  max?: number;
  currency: string;
  period: SalaryPeriod;
  estimated: boolean;
}

export interface Company {
  id: string;
  name: string;
  website?: string;
  careersUrl?: string;
  notes: string;
}

export interface Application {
  id: string;
  companyId: string;
  role: string;
  url?: string;
  jobId?: string;
  source?: string;
  location?: string;
  workMode?: string;
  salary?: Salary;
  stage: Stage;
  closeReason?: CloseReason;
  priority: number;
  tags: string[];
  notes: string;
  appliedAt?: string;
  repliedAt?: string;
  deadline?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  trashedAt?: string;
}

export interface Interview {
  id: string;
  applicationId: string;
  startsAt: string;
  durationMinutes: number;
  round: Round;
  prep: string;
  outcome?: Outcome;
  outcomeNote: string;
}

export interface FollowUp {
  id: string;
  applicationId: string;
  dueAt: string;
  kind: FollowUpKind;
  attempt: number;
  doneAt?: string;
}

export interface Activity {
  id: string;
  applicationId: string;
  at: string;
  kind: string;
  text: string;
}

export interface Settings {
  defaultStage: "applied" | "saved";
  currency: string;
  followUpDays: number;
  repeatDays: number;
  maxTries: number;
  appearance: "system" | "light" | "dark";
}

export const defaultSettings: Settings = {
  defaultStage: "applied",
  currency: "INR",
  followUpDays: 5,
  repeatDays: 7,
  maxTries: 3,
  appearance: "system",
};

export interface Dataset {
  companies: Company[];
  applications: Application[];
  interviews: Interview[];
  followUps: FollowUp[];
  activities: Activity[];
  settings: Settings;
}

export const emptyDataset = (): Dataset => ({
  companies: [],
  applications: [],
  interviews: [],
  followUps: [],
  activities: [],
  settings: { ...defaultSettings },
});

export const newId = () => crypto.randomUUID();

export const STAGE_LABELS: Record<Stage, string> = {
  saved: "Saved",
  applied: "Applied",
  screen: "Screen",
  interviewing: "Interviewing",
  offer: "Offer",
  closed: "Closed",
};

export const CLOSE_REASON_LABELS: Record<CloseReason, string> = {
  rejected: "Rejected",
  no_reply: "No reply",
  withdrew: "Withdrew",
  declined_offer: "Declined offer",
  accepted_offer: "Accepted offer",
};

export const ROUND_LABELS: Record<Round, string> = {
  recruiter: "Recruiter",
  technical: "Technical",
  coding: "Coding",
  system_design: "System design",
  hiring_manager: "Hiring manager",
  hr: "HR",
  final: "Final",
  other: "Other",
};
