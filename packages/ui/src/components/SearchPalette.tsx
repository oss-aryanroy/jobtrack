import { useEffect, useMemo, useRef, useState } from "react";
import { STAGE_LABELS, filterApplications } from "@jobtrack/core";
import { type Route, useApp } from "../context";
import { companyMap, initials } from "../helpers";
import { Icon, type IconName } from "./Icon";

interface Result {
  key: string;
  group: string;
  icon: IconName | string;
  title: string;
  sub?: string;
  run(): void;
}

export function SearchPalette({ onClose }: { onClose(): void }) {
  const { data, go, openQuickAdd, openSettings } = useApp();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const results = useMemo<Result[]>(() => {
    const companies = companyMap(data);
    const query = q.trim().toLowerCase();
    const nav = (route: Route) => () => go(route);
    const out: Result[] = [];
    if (query) {
      for (const a of filterApplications(data.applications, data.companies, { query }).slice(0, 6)) {
        const c = companies.get(a.companyId);
        out.push({
          key: a.id,
          group: "Applications",
          icon: initials(c?.name ?? "?"),
          title: `${c?.name ?? "Unknown"} · ${a.role}`,
          sub: STAGE_LABELS[a.stage],
          run: nav({ screen: "applications", id: a.id }),
        });
      }
      for (const c of data.companies.filter((c) => c.name.toLowerCase().includes(query)).slice(0, 4)) {
        out.push({ key: c.id, group: "Companies", icon: initials(c.name), title: c.name, run: nav({ screen: "companies", id: c.id }) });
      }
    }
    const commands: Result[] = [
      { key: "add", group: "Do it now", icon: "plus", title: query ? `Add “${q.trim()}” as a job` : "Add a job", run: () => openQuickAdd(q.trim()) },
      { key: "home", group: "Go to", icon: "home", title: "Home", run: nav({ screen: "home" }) },
      { key: "followups", group: "Go to", icon: "bell", title: "Follow-ups", run: nav({ screen: "followups" }) },
      { key: "board", group: "Go to", icon: "board", title: "Board", run: nav({ screen: "board" }) },
      { key: "calendar", group: "Go to", icon: "calendar", title: "Calendar", run: nav({ screen: "calendar" }) },
      { key: "interviews", group: "Go to", icon: "interview", title: "Interviews", run: nav({ screen: "interviews" }) },
      { key: "trash", group: "Go to", icon: "trash", title: "Trash", run: nav({ screen: "applications", id: "view:trash" }) },
      { key: "settings", group: "Do it now", icon: "settings", title: "Settings, import and export", run: openSettings },
    ];
    return [...out, ...commands.filter((c) => !query || c.key === "add" || c.title.toLowerCase().includes(query))];
  }, [q, data, go, openQuickAdd, openSettings]);

  useEffect(() => setSel(0), [q]);
  const run = (r: Result | undefined) => {
    if (!r) return;
    onClose();
    r.run();
  };

  let lastGroup = "";
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search and commands"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          else if (e.key === "ArrowDown") {
            e.preventDefault();
            setSel((s) => Math.min(s + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSel((s) => Math.max(s - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            run(results[sel]);
          }
        }}
      >
        <label className="palette-q">
          <Icon name="search" size={18} />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search applications and companies, or type a command" aria-label="Search" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={results[sel] ? `pr-${results[sel].key}` : undefined} />
          <span className="kbd">esc</span>
        </label>
        <div className="palette-list" id="palette-list" role="listbox">
          {results.length === 0 && <p className="muted" style={{ padding: "12px 18px" }}>Nothing matches.</p>}
          {results.map((r, i) => {
            const header = r.group !== lastGroup ? <div className="g">{r.group}</div> : null;
            lastGroup = r.group;
            return (
              <div key={r.key}>
                {header}
                <button id={`pr-${r.key}`} role="option" aria-selected={i === sel} className={`r${i === sel ? " on" : ""}`} onMouseEnter={() => setSel(i)} onClick={() => run(r)}>
                  <span className="ic">{r.icon.length <= 2 ? r.icon : <Icon name={r.icon as IconName} size={14} />}</span>
                  <span>
                    {r.title}
                    {r.sub && <span className="s"> · {r.sub}</span>}
                  </span>
                  <span className="kbd">{i === sel ? "↩" : ""}</span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="palette-foot">
          <span>↑↓ move</span>
          <span>↩ open</span>
          <span className="spacer">Searches notes and tags too</span>
        </div>
      </div>
    </div>
  );
}
