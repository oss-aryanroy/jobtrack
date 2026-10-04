import { useEffect, useMemo, useState } from "react";
import {
  type Application,
  type Dataset,
  type Filter,
  ROUND_LABELS,
  STAGE_LABELS,
  archiveApplication,
  completeFollowUp,
  deletePermanently,
  filterApplications,
  findOrCreateCompany,
  formatSalary,
  markNoReply,
  parseSalary,
  restoreApplication,
  snoozeFollowUp,
  trashApplication,
  updateApplication,
} from "@jobtrack/core";
import { useApp } from "../context";
import { Icon } from "../components/Icon";
import { Fact } from "../components/Fact";
import { StageBar } from "../components/StageBar";
import { AddInterview } from "../components/AddInterview";
import { STAGE_COLOR, companyMap, fmtDay, fmtLong, fmtTime, initials, plural, relativeDay } from "../helpers";

type View = NonNullable<Filter["view"]>;
const VIEWS: { view: View; label: string }[] = [
  { view: "active", label: "Active" },
  { view: "waiting", label: "Waiting" },
  { view: "closed", label: "Closed" },
];

function nextFor(data: Dataset, appId: string) {
  const fu = data.followUps.filter((f) => f.applicationId === appId && !f.doneAt).sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  const now = new Date().toISOString();
  const iv = data.interviews.filter((i) => i.applicationId === appId && i.startsAt >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  return { fu, iv };
}

const PRIORITY = ["Normal", "High", "Low"];

export function ApplicationsScreen() {
  const { data, route, go } = useApp();
  const [query, setQuery] = useState("");
  const initialView: View = route.id === "view:trash" ? "trash" : route.id === "view:archived" ? "archived" : "active";
  const [view, setView] = useState<View>(initialView);
  useEffect(() => setView(initialView), [initialView]);
  const companies = companyMap(data);
  const now = new Date().toISOString();

  const list = useMemo(() => {
    const items = filterApplications(data.applications, data.companies, { query, view });
    const due = new Map<string, string>();
    for (const f of data.followUps) if (!f.doneAt && (!due.has(f.applicationId) || f.dueAt < due.get(f.applicationId)!)) due.set(f.applicationId, f.dueAt);
    return items
      .map((a) => ({ a, due: due.get(a.id) }))
      .sort((x, y) => (x.due && y.due ? x.due.localeCompare(y.due) : x.due ? -1 : y.due ? 1 : y.a.updatedAt.localeCompare(x.a.updatedAt)));
  }, [data, query, view]);

  const selectedId = route.id && !route.id.startsWith("view:") ? route.id : list[0]?.a.id;
  const selected = data.applications.find((a) => a.id === selectedId);
  const counts = {
    archived: data.applications.filter((a) => a.archivedAt && !a.trashedAt).length,
    trash: data.applications.filter((a) => a.trashedAt).length,
  };

  return (
    <>
      <aside className="list" aria-label="Applications">
        <div className="list-head" data-tauri-drag-region>
          <h1>{view === "trash" ? "Trash" : view === "archived" ? "Archived" : "Applications"}</h1>
          <span className="muted spacer">{list.length}</span>
        </div>
        <label className="search">
          <Icon name="search" size={13} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by company, role, tag" aria-label="Filter applications" />
        </label>
        {view !== "trash" && view !== "archived" ? (
          <div className="seg" role="tablist" aria-label="Show">
            {VIEWS.map((v) => (
              <button key={v.view} role="tab" aria-selected={view === v.view} className={view === v.view ? "on" : undefined} onClick={() => setView(v.view)}>
                {v.label}
              </button>
            ))}
          </div>
        ) : (
          <button className="link" style={{ margin: "0 16px 8px", textAlign: "left" }} onClick={() => setView("active")}>← Back to applications</button>
        )}
        <div className="list-scroll">
          {list.length === 0 && <p className="list-empty">{query ? "Nothing matches that filter." : view === "trash" ? "Trash is empty." : "Nothing here yet."}</p>}
          {list.map(({ a, due }) => {
            const on = a.id === selected?.id;
            const late = due && due.slice(0, 10) < now.slice(0, 10);
            return (
              <button key={a.id} className={`item dot-row${on ? " on" : ""}`} aria-current={on ? "true" : undefined} onClick={() => go({ screen: "applications", id: a.id })}>
                <span className="dot" style={{ background: on ? "#fff" : STAGE_COLOR[a.stage] }} aria-label={STAGE_LABELS[a.stage]} />
                <span style={{ minWidth: 0 }}>
                  <span className="t">{companies.get(a.companyId)?.name ?? "Unknown company"}</span>
                  <span className="s">{a.role}</span>
                </span>
                {due && <span className="w" style={!on && late ? { color: "var(--bad-ink)", fontWeight: 700 } : undefined}>{late ? "late" : relativeDay(due, now)}</span>}
              </button>
            );
          })}
        </div>
        {view !== "trash" && view !== "archived" && (counts.archived > 0 || counts.trash > 0) && (
          <div style={{ display: "flex", gap: 12, padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
            {counts.archived > 0 && <button className="link small" style={{ fontWeight: 400 }} onClick={() => setView("archived")}>Archived {counts.archived}</button>}
            {counts.trash > 0 && <button className="link small" style={{ fontWeight: 400 }} onClick={() => setView("trash")}>Trash {counts.trash}</button>}
          </div>
        )}
      </aside>
      {selected ? <ApplicationDetail key={selected.id} app={selected} /> : <EmptyApplications />}
    </>
  );
}

function EmptyApplications() {
  const { openQuickAdd, platform, mod } = useApp();
  return (
    <main className="main">
      <div className="empty">
        <h2>No application selected</h2>
        <p>Add a job with a link or just “Company, Role”. Follow-ups and history take care of themselves.</p>
        <button className="btn primary" onClick={() => openQuickAdd()}>Add a job · {platform.kind === "desktop" ? `${mod}N` : "N"}</button>
      </div>
    </main>
  );
}

function ApplicationDetail({ app }: { app: Application }) {
  const { data, apply, go, platform } = useApp();
  const [addingInterview, setAddingInterview] = useState(false);
  const [notes, setNotes] = useState(app.notes);
  const company = data.companies.find((c) => c.id === app.companyId);
  const { fu, iv } = nextFor(data, app.id);
  const interviews = data.interviews.filter((i) => i.applicationId === app.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const history = data.activities.filter((a) => a.applicationId === app.id).sort((a, b) => a.at.localeCompare(b.at));
  const patch = (p: Partial<Application>) => apply((d) => updateApplication(d, app.id, p));
  const now = new Date().toISOString();

  return (
    <main className="main">
      <header className="bar" data-tauri-drag-region>
        <span className="crumb">Applications</span>
        <span className="crumb" aria-hidden="true">/</span>
        <button className="link" style={{ color: "var(--ink)" }} onClick={() => go({ screen: "companies", id: app.companyId })}>{company?.name}</button>
        <div className="spacer" style={{ display: "flex", gap: 6 }}>
          {app.url && (
            <button className="btn" onClick={() => platform.openUrl(app.url!)}>
              Job posting <Icon name="external" size={13} />
            </button>
          )}
          {app.trashedAt ? (
            <>
              <button className="btn" onClick={() => apply((d) => restoreApplication(d, app.id), "Restored")}>Restore</button>
              <button
                className="btn danger"
                onClick={() => {
                  if (confirm(`Delete ${company?.name} · ${app.role} forever? This can't be undone.`)) apply((d) => deletePermanently(d, app.id));
                }}
              >
                Delete forever
              </button>
            </>
          ) : (
            <>
              {app.archivedAt ? (
                <button className="btn" onClick={() => apply((d) => restoreApplication(d, app.id), "Unarchived")}>Unarchive</button>
              ) : (
                <button className="btn" onClick={() => apply((d) => archiveApplication(d, app.id), "Archived")}>Archive</button>
              )}
              <button className="btn" aria-label="Move to trash" title="Move to trash" onClick={() => apply((d) => trashApplication(d, app.id), "Moved to trash")}>
                <Icon name="trash" size={14} />
              </button>
            </>
          )}
        </div>
      </header>
      <div className="body">
        <div className="content">
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ width: 56, height: 56, flexShrink: 0, borderRadius: 14, background: "var(--rail)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700 }}>
              {initials(company?.name ?? "")}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <EditableTitle value={app.role} onSave={(role) => patch({ role: role || app.role })} />
              <div className="muted" style={{ fontSize: 14 }}>
                <EditableCompany app={app} name={company?.name ?? ""} /> · added {fmtDay(app.createdAt)}
                {app.source ? ` from ${app.source}` : ""}
              </div>
            </div>
          </div>

          {!app.trashedAt && <StageBar app={app} />}

          {!app.trashedAt && (
            <div className="next">
              <span className="next-icon"><Icon name={fu ? "bell" : "interview"} /></span>
              <div style={{ flex: 1, minWidth: 200 }}>
                {fu ? (
                  <>
                    <div style={{ fontWeight: 700 }}>Follow up {relativeDay(fu.dueAt, now)}</div>
                    <div className="small muted">
                      Set automatically{fu.attempt > 1 ? `, try ${fu.attempt} of ${data.settings.maxTries}` : ""}.
                      {iv ? ` Then: ${ROUND_LABELS[iv.round].toLowerCase()} interview, ${fmtLong(iv.startsAt)} at ${fmtTime(iv.startsAt)}.` : ""}
                    </div>
                  </>
                ) : iv ? (
                  <>
                    <div style={{ fontWeight: 700 }}>{ROUND_LABELS[iv.round]} interview {relativeDay(iv.startsAt, now)}</div>
                    <div className="small muted">{fmtLong(iv.startsAt)} at {fmtTime(iv.startsAt)}</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 700 }}>Nothing scheduled</div>
                    <div className="small muted">{app.stage === "closed" ? "This one is closed." : "Add an interview when one is booked."}</div>
                  </>
                )}
              </div>
              {fu && (
                <>
                  <button className="btn primary" onClick={() => apply((d) => completeFollowUp(d, fu.id), "Follow-up done")}>Done</button>
                  <button className="btn" onClick={() => apply((d) => snoozeFollowUp(d, fu.id, 3), "Moved 3 days later")}>In 3 days</button>
                  {app.stage === "applied" && <button className="btn" onClick={() => apply((d) => markNoReply(d, fu.id), "Marked as no reply")}>No reply</button>}
                </>
              )}
              {app.stage !== "closed" && !addingInterview && <button className="btn" onClick={() => setAddingInterview(true)}>Add interview</button>}
            </div>
          )}
          {addingInterview && <AddInterview applicationId={app.id} onDone={() => setAddingInterview(false)} />}

          <dl className="facts">
            <Fact label="Salary" value={formatSalary(app.salary)} placeholder="e.g. 6-8 LPA" onSave={(raw) => patch({ salary: raw ? (parseSalary(raw, data.settings.currency) ?? app.salary) : undefined })} />
            <Fact label="Where" value={app.location ?? ""} placeholder="City or Remote" onSave={(raw) => patch({ location: raw || undefined })} />
            <Fact label="Source" value={app.source ?? ""} placeholder="LinkedIn, Referral…" onSave={(raw) => patch({ source: raw || undefined })} />
            <Fact label="Applied" value={fmtDay(app.appliedAt)} edit={app.appliedAt?.slice(0, 10) ?? ""} type="date" onSave={(raw) => patch({ appliedAt: raw ? new Date(`${raw}T12:00:00`).toISOString() : undefined })} />
            <Fact label="Tags" value={app.tags.join(", ")} placeholder="backend, remote" onSave={(raw) => patch({ tags: raw.split(",").map((t) => t.trim()).filter(Boolean) })} />
            <div>
              <dt>Priority</dt>
              <dd>
                <button className="fact-value" onClick={() => patch({ priority: (app.priority + 1) % 3 })} aria-label={`Priority ${PRIORITY[app.priority]}. Change`}>
                  {PRIORITY[app.priority] ?? "Normal"}
                </button>
              </dd>
            </div>
            <Fact label="Deadline" value={fmtDay(app.deadline)} edit={app.deadline?.slice(0, 10) ?? ""} type="date" onSave={(raw) => patch({ deadline: raw ? new Date(`${raw}T23:59:00`).toISOString() : undefined })} />
            <Fact label="Job link" value={app.url ? new URL(app.url, "https://x").hostname.replace(/^www\./, "") : ""} edit={app.url ?? ""} type="url" onSave={(raw) => patch({ url: raw || undefined })} />
          </dl>

          <section aria-label="Notes">
            <h3 className="sec" style={{ marginBottom: 8 }}>Notes</h3>
            <textarea className="note" value={notes} placeholder="Anything worth remembering. Optional." onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== app.notes && patch({ notes })} aria-label="Notes" />
          </section>

          <section aria-label="History">
            <h3 className="sec" style={{ marginBottom: 10 }}>
              History <span className="small muted" style={{ fontWeight: 400 }}>· recorded automatically</span>
            </h3>
            <ol className="history">
              {history.map((h) => (
                <li key={h.id}>
                  <b>{fmtDay(h.at)}</b>
                  <div className="small muted">{h.text}</div>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <aside className="aside" aria-label="Interviews">
          <h3 className="sec">Interviews</h3>
          {interviews.length === 0 && <p className="small muted" style={{ margin: 0 }}>None yet.</p>}
          {interviews.map((i) => (
            <button key={i.id} className="item" style={{ gridTemplateColumns: "1fr", width: "100%", margin: 0 }} onClick={() => go({ screen: "interviews", id: i.id })}>
              <span>
                <span className="t">{ROUND_LABELS[i.round]}</span>
                <span className="s">{fmtLong(i.startsAt)} · {fmtTime(i.startsAt)}{i.outcome ? ` · ${i.outcome.replace("_", " ")}` : ""}</span>
              </span>
            </button>
          ))}
          <p className="small muted" style={{ margin: "auto 0 0" }}>{plural(history.length, "event")} logged for this application.</p>
        </aside>
      </div>
    </main>
  );
}

function EditableTitle({ value, onSave }: { value: string; onSave(v: string): void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (editing)
    return (
      <input
        className="fact-input"
        style={{ fontSize: 22, height: 36, fontWeight: 700 }}
        autoFocus
        value={draft}
        aria-label="Role"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          onSave(draft.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  return (
    <h2 className="h2" style={{ cursor: "text" }} title="Click to rename" onClick={() => { setDraft(value); setEditing(true); }}>
      {value}
    </h2>
  );
}

function EditableCompany({ app, name }: { app: Application; name: string }) {
  const { apply } = useApp();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  if (!editing)
    return (
      <button className="link" style={{ color: "inherit", fontWeight: 400 }} title="Change company" onClick={() => { setDraft(name); setEditing(true); }}>
        {name}
      </button>
    );
  const save = () => {
    setEditing(false);
    if (!draft.trim() || draft.trim() === name) return;
    apply((d) => {
      const { company, created } = findOrCreateCompany(d.companies, draft);
      const next = created ? { ...d, companies: [...d.companies, company] } : d;
      return updateApplication(next, app.id, { companyId: company.id });
    });
  };
  return (
    <input
      className="fact-input"
      style={{ width: 220, display: "inline-block" }}
      autoFocus
      value={draft}
      aria-label="Company"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}
