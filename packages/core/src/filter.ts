import type { Application, Company, Stage } from "./model";

export interface Filter {
  query?: string;
  stages?: Stage[];
  tags?: string[];
  view?: "active" | "waiting" | "closed" | "all" | "archived" | "trash";
}

export function filterApplications(apps: Application[], companies: Company[], filter: Filter): Application[] {
  const names = new Map(companies.map((c) => [c.id, c.name.toLowerCase()]));
  const terms = (filter.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const view = filter.view ?? "all";
  return apps.filter((a) => {
    if (view === "trash") {
      if (!a.trashedAt) return false;
    } else if (a.trashedAt) return false;
    else if (view === "archived") {
      if (!a.archivedAt) return false;
    } else if (a.archivedAt) return false;
    if (view === "active" && a.stage === "closed") return false;
    if (view === "waiting" && a.stage !== "applied") return false;
    if (view === "closed" && a.stage !== "closed") return false;
    if (filter.stages?.length && !filter.stages.includes(a.stage)) return false;
    if (filter.tags?.length && !filter.tags.every((t) => a.tags.includes(t))) return false;
    if (terms.length) {
      const haystack = [names.get(a.companyId), a.role, a.notes, a.location, a.source, ...a.tags].join(" ").toLowerCase();
      if (!terms.every((t) => haystack.includes(t))) return false;
    }
    return true;
  });
}
