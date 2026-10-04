export type AtsRef = { kind: "greenhouse" | "lever"; board: string; id: string };

export interface QuickParse {
  url?: string;
  company?: string;
  role?: string;
  source?: string;
  jobId?: string;
  ats?: AtsRef;
}

const titleCase = (slug: string) =>
  slug
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const GENERIC_HOST_PARTS = new Set(["www", "jobs", "careers", "career", "apply", "boards", "job-boards", "hire", "work", "en", "in"]);

function toUrl(text: string): URL | null {
  if (/\s/.test(text) || !/\.[a-z]{2,}/i.test(text)) return null;
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
}

function fromUrl(url: URL): QuickParse {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  const out: QuickParse = { url: url.toString() };

  if (host.endsWith("greenhouse.io")) {
    const jobsAt = parts.indexOf("jobs");
    const board = jobsAt > 0 ? parts[jobsAt - 1] : (url.searchParams.get("for") ?? undefined);
    const id = jobsAt >= 0 ? parts[jobsAt + 1] : (url.searchParams.get("token") ?? undefined);
    out.source = "Greenhouse";
    out.jobId = id;
    if (board) out.company = titleCase(board);
    if (board && id && /^\d+$/.test(id)) out.ats = { kind: "greenhouse", board, id };
    return out;
  }
  if (host.endsWith("lever.co")) {
    const [board, id] = parts;
    out.source = "Lever";
    out.jobId = id;
    if (board) out.company = titleCase(board);
    if (board && id) out.ats = { kind: "lever", board, id };
    return out;
  }
  if (host.endsWith("linkedin.com")) {
    out.source = "LinkedIn";
    out.jobId = url.searchParams.get("currentJobId") ?? url.pathname.match(/\/jobs\/view\/(?:[^/]*?-)?(\d+)/)?.[1];
    return out;
  }
  if (host.endsWith("naukri.com")) {
    out.source = "Naukri";
    out.jobId = url.pathname.match(/-(\d{6,})(?:\/|$)/)?.[1];
    return out;
  }
  if (host.includes("indeed.")) {
    out.source = "Indeed";
    out.jobId = url.searchParams.get("jk") ?? url.searchParams.get("vjk") ?? undefined;
    return out;
  }
  if (host.endsWith("glassdoor.com") || host.includes("glassdoor.")) {
    out.source = "Glassdoor";
    out.jobId = url.searchParams.get("jl") ?? undefined;
    return out;
  }
  if (host.endsWith("myworkdayjobs.com")) {
    out.source = "Workday";
    out.company = titleCase(host.split(".")[0] ?? "");
    out.jobId = url.pathname.match(/_([A-Z]*-?\d+)(?:\/|$)/i)?.[1];
    return out;
  }
  if (host.endsWith("ashbyhq.com")) {
    out.source = "Ashby";
    if (parts[0]) out.company = titleCase(parts[0]);
    out.jobId = parts[1];
    return out;
  }
  const name = host.split(".").find((p) => !GENERIC_HOST_PARTS.has(p));
  out.source = "Company site";
  if (name) out.company = titleCase(name);
  return out;
}

function fromText(text: string): QuickParse {
  const at = text.match(/^(.+?)\s+at\s+(.+)$/i);
  if (at) return { role: at[1]?.trim(), company: at[2]?.trim() };
  const split = text.split(/\s*(?:,|\s[-–—|]\s)\s*/);
  if (split.length >= 2) return { company: split[0]?.trim(), role: split.slice(1).join(", ").trim() };
  return { company: text.trim() };
}

export function parseQuickInput(input: string): QuickParse {
  const text = input.trim();
  if (!text) return {};
  const url = toUrl(text);
  const parsed = url ? fromUrl(url) : fromText(text);
  for (const key of Object.keys(parsed) as (keyof QuickParse)[]) {
    if (parsed[key] === "" || parsed[key] === undefined) delete parsed[key];
  }
  return parsed;
}

export interface AtsDetails {
  company?: string;
  role?: string;
  location?: string;
}

export async function fetchAtsDetails(ref: AtsRef, fetchImpl: typeof fetch = fetch): Promise<AtsDetails | null> {
  const endpoint =
    ref.kind === "greenhouse"
      ? `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(ref.board)}/jobs/${encodeURIComponent(ref.id)}`
      : `https://api.lever.co/v0/postings/${encodeURIComponent(ref.board)}/${encodeURIComponent(ref.id)}`;
  try {
    const res = await fetchImpl(endpoint, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, any>;
    if (ref.kind === "greenhouse") {
      return { company: json.company_name || undefined, role: json.title || undefined, location: json.location?.name || undefined };
    }
    return { role: json.text || undefined, location: json.categories?.location || undefined };
  } catch {
    return null;
  }
}
