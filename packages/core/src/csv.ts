import { formatSalary, parseSalary } from "./salary";
import type { Application, Company, Stage } from "./model";

const COLUMNS = ["company", "role", "stage", "url", "source", "location", "salary", "applied", "notes", "tags"] as const;
type Column = (typeof COLUMNS)[number];

const ALIASES: Record<string, Column> = {
  company: "company",
  "company name": "company",
  employer: "company",
  role: "role",
  position: "role",
  title: "role",
  "job title": "role",
  stage: "stage",
  status: "stage",
  url: "url",
  link: "url",
  "job url": "url",
  "job link": "url",
  source: "source",
  location: "location",
  salary: "salary",
  ctc: "salary",
  applied: "applied",
  "date applied": "applied",
  "applied on": "applied",
  notes: "notes",
  tags: "tags",
};

const STAGE_WORDS: Record<string, Stage> = {
  saved: "saved",
  wishlist: "saved",
  interested: "saved",
  applied: "applied",
  submitted: "applied",
  screen: "screen",
  screening: "screen",
  "recruiter screen": "screen",
  assessment: "screen",
  "online assessment": "screen",
  interview: "interviewing",
  interviewing: "interviewing",
  offer: "offer",
  rejected: "closed",
  closed: "closed",
  ghosted: "closed",
  withdrawn: "closed",
};

const escape = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export function toCsv(apps: Application[], companies: Company[]): string {
  const names = new Map(companies.map((c) => [c.id, c.name]));
  const rows = apps.map((a) =>
    [
      names.get(a.companyId) ?? "",
      a.role,
      a.stage,
      a.url ?? "",
      a.source ?? "",
      a.location ?? "",
      formatSalary(a.salary),
      a.appliedAt?.slice(0, 10) ?? "",
      a.notes,
      a.tags.join("; "),
    ].map(escape).join(","),
  );
  return [COLUMNS.join(","), ...rows].join("\n");
}

export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export interface ImportDraft {
  company: string;
  role: string;
  stage: Stage;
  url?: string;
  source?: string;
  location?: string;
  salary?: Application["salary"];
  appliedAt?: string;
  notes: string;
  tags: string[];
}

export interface PreviewRow {
  line: number;
  draft?: ImportDraft;
  errors: string[];
  warnings: string[];
}

function parseDate(value: string): string | undefined {
  const v = value.trim();
  if (!v) return undefined;
  const dmy = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  const date = dmy ? new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 12) : new Date(v);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function previewCsvImport(text: string, defaultCurrency = "INR"): { columns: (Column | null)[]; rows: PreviewRow[] } {
  const [header, ...body] = parseCsvRows(text.replace(/^﻿/, ""));
  if (!header) return { columns: [], rows: [] };
  const columns = header.map((h) => ALIASES[h.trim().toLowerCase()] ?? null);
  const rows = body.map((cells, idx): PreviewRow => {
    const get = (col: Column) => (cells[columns.indexOf(col)] ?? "").trim();
    const errors: string[] = [];
    const warnings: string[] = [];
    const company = get("company");
    const role = get("role");
    if (!company && !role) errors.push("Needs a company or a role");
    const stageWord = get("stage").toLowerCase();
    const stage = stageWord ? STAGE_WORDS[stageWord] : "applied";
    if (stageWord && !stage) warnings.push(`Unknown stage “${get("stage")}”, using Applied`);
    const salaryText = get("salary");
    const salary = salaryText ? (parseSalary(salaryText, defaultCurrency) ?? undefined) : undefined;
    if (salaryText && !salary) warnings.push(`Couldn't read salary “${salaryText}”`);
    const appliedText = get("applied");
    const appliedAt = parseDate(appliedText);
    if (appliedText && !appliedAt) warnings.push(`Couldn't read date “${appliedText}”`);
    if (errors.length) return { line: idx + 2, errors, warnings };
    return {
      line: idx + 2,
      errors,
      warnings,
      draft: {
        company: company || "Unknown company",
        role: role || "Untitled role",
        stage: stage ?? "applied",
        url: get("url") || undefined,
        source: get("source") || undefined,
        location: get("location") || undefined,
        salary,
        appliedAt,
        notes: get("notes"),
        tags: get("tags").split(/[;|]/).map((t) => t.trim()).filter(Boolean),
      },
    };
  });
  return { columns, rows };
}

