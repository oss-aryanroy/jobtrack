import { normalizeName } from "./applications";
import type { Application, Company } from "./model";

export type DuplicateReason = "same link" | "same job ID" | "same company and role" | "similar role at this company";

export interface DuplicateMatch {
  application: Application;
  reason: DuplicateReason;
}

const KEEP_PARAMS = new Set(["currentjobid", "jk", "vjk", "jl", "gh_jid", "token", "for"]);

export function normalizeUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
    const params = [...url.searchParams.entries()]
      .filter(([k]) => KEEP_PARAMS.has(k.toLowerCase()))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k.toLowerCase()}=${v}`)
      .join("&");
    return `${url.hostname.replace(/^www\./, "").toLowerCase()}${url.pathname.replace(/\/+$/, "").toLowerCase()}${params ? `?${params}` : ""}`;
  } catch {
    return raw.trim().toLowerCase();
  }
}

const SENIORITY = /\b(senior|sr|junior|jr|lead|staff|principal|associate|i{1,3}|iv|1|2|3)\b/g;

const roleTokens = (role: string) => new Set(normalizeName(role).replace(SENIORITY, " ").split(/\s+/).filter(Boolean));

function similarity(a: string, b: string) {
  const ta = roleTokens(a);
  const tb = roleTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / new Set([...ta, ...tb]).size;
}

export function findDuplicates(
  candidate: { company?: string; role?: string; url?: string; jobId?: string },
  applications: Application[],
  companies: Company[],
): DuplicateMatch[] {
  const url = normalizeUrl(candidate.url);
  const companyKey = candidate.company ? normalizeName(candidate.company) : undefined;
  const companyIds = new Set(companies.filter((c) => companyKey && normalizeName(c.name) === companyKey).map((c) => c.id));
  const matches: DuplicateMatch[] = [];
  for (const app of applications) {
    if (app.trashedAt) continue;
    if (url && normalizeUrl(app.url) === url) matches.push({ application: app, reason: "same link" });
    else if (candidate.jobId && app.jobId === candidate.jobId) matches.push({ application: app, reason: "same job ID" });
    else if (companyIds.has(app.companyId) && candidate.role) {
      if (normalizeName(app.role) === normalizeName(candidate.role)) matches.push({ application: app, reason: "same company and role" });
      else if (similarity(app.role, candidate.role) >= 0.5) matches.push({ application: app, reason: "similar role at this company" });
    }
  }
  return matches;
}
