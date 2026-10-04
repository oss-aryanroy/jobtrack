import { useMemo, useState } from "react";
import { type Application, type Company, ROUND_LABELS, STAGE_LABELS, formatSalary, medianDaysToReply, reachedInterview } from "@jobtrack/core";
import { useApp } from "../context";
import { Icon } from "../components/Icon";
import { StageBar } from "../components/StageBar";
import { STAGE_COLOR, fmtDay, fmtLong, initials, plural } from "../helpers";

export function CompaniesScreen() {
  const { data, route, go } = useApp();
  const [query, setQuery] = useState("");
  const byCompany = useMemo(() => {
    const m = new Map<string, Application[]>();
    for (const a of data.applications) if (!a.trashedAt) m.set(a.companyId, [...(m.get(a.companyId) ?? []), a]);
    return m;
  }, [data.applications]);
  const companies = data.companies.filter((c) => byCompany.has(c.id) && c.name.toLowerCase().includes(query.toLowerCase()));
  const isActive = (c: Company) => (byCompany.get(c.id) ?? []).some((a) => a.stage !== "closed" && !a.archivedAt);
  const active = companies.filter(isActive).sort((a, b) => a.name.localeCompare(b.name));
  const past = companies.filter((c) => !isActive(c)).sort((a, b) => a.name.localeCompare(b.name));
  const selected = data.companies.find((c) => c.id === route.id) ?? active[0] ?? past[0];

  const row = (c: Company) => {
    const apps = (byCompany.get(c.id) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const latest = apps.at(-1);
    const on = c.id === selected?.id;
    return (
      <button key={c.id} className={`item${on ? " on" : ""}`} onClick={() => go({ screen: "companies", id: c.id })}>
        <span className="tile">{initials(c.name)}</span>
        <span style={{ minWidth: 0 }}>
          <span className="t">{c.name}</span>
          <span className="s">{latest ? `${apps.length > 1 ? `${apps.length} roles · ` : ""}${STAGE_LABELS[latest.stage].toLowerCase()}` : ""}</span>
        </span>
        <span className="pips" aria-hidden="true">
          {apps.slice(-4).map((a) => <span key={a.id} className="pip" style={{ background: STAGE_COLOR[a.stage] }} />)}
        </span>
      </button>
    );
  };

  return (
    <>
      <aside className="list" aria-label="Companies">
        <div className="list-head" data-tauri-drag-region><h1>Companies</h1><span className="muted spacer">{companies.length}</span></div>
        <label className="search"><Icon name="search" size={13} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a company" aria-label="Find a company" /></label>
        <div className="list-scroll">
          {companies.length === 0 && <p className="list-empty">Companies appear here as you add jobs.</p>}
          {active.length > 0 && <div className="group"><span>Active</span><span>{active.length}</span></div>}
          {active.map(row)}
          {past.length > 0 && <div className="group"><span>Past</span><span>{past.length}</span></div>}
          {past.map(row)}
        </div>
      </aside>
      {selected ? <CompanyDetail key={selected.id} company={selected} apps={byCompany.get(selected.id) ?? []} /> : <main className="main"><div className="empty"><h2>No companies yet</h2><p>Add a job and its company shows up here with its full history.</p></div></main>}
    </>
  );
}

function CompanyDetail({ company, apps }: { company: Company; apps: Application[] }) {
  const { data, apply, go, openQuickAdd, platform } = useApp();
  const [notes, setNotes] = useState(company.notes);
  const sorted = [...apps].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const open = sorted.filter((a) => a.stage !== "closed" && !a.archivedAt);
  const ids = new Set(apps.map((a) => a.id));
  const interviews = data.interviews.filter((i) => ids.has(i.applicationId)).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const interviewIds = new Set(interviews.map((i) => i.applicationId));
  const furthest = sorted.some((a) => a.stage === "offer" || a.closeReason === "accepted_offer" || a.closeReason === "declined_offer")
    ? "Offer"
    : sorted.some((a) => reachedInterview(a, interviewIds))
      ? "Interviews"
      : sorted.some((a) => a.repliedAt)
        ? "Screen"
        : "Applied";
  const median = medianDaysToReply(apps);
  const now = Date.now();
  const start = Math.min(now - 300 * 86_400_000, ...sorted.map((a) => new Date(a.appliedAt ?? a.createdAt).getTime()));
  const span = now - start || 1;
  const pct = (t: number) => `${((t - start) / span) * 100}%`;

  return (
    <main className="main">
      <header className="bar" data-tauri-drag-region>
        <span className="crumb">Companies</span>
        <span className="crumb" aria-hidden="true">/</span>
        <span className="title">{company.name}</span>
        <div className="spacer" style={{ display: "flex", gap: 6 }}>
          {company.careersUrl && <button className="btn" onClick={() => platform.openUrl(company.careersUrl!)}>Careers page <Icon name="external" size={13} /></button>}
          <button className="btn primary" onClick={() => openQuickAdd(`${company.name}, `)}>New role here</button>
        </div>
      </header>
      <div className="body">
        <div className="content">
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ width: 60, height: 60, borderRadius: 14, background: "var(--rail)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, fontWeight: 700 }}>{initials(company.name)}</div>
            <h2 className="h1" style={{ flex: 1, minWidth: 0 }}>{company.name}</h2>
            <dl style={{ margin: 0, display: "flex", gap: 30 }}>
              <div><dt className="small muted">Applied</dt><dd style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 600 }}>{plural(apps.length, "time")}</dd></div>
              <div><dt className="small muted">Got as far as</dt><dd style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 600 }}>{furthest}</dd></div>
              <div><dt className="small muted">Usually replies in</dt><dd style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 600 }}>{median === null ? "—" : plural(Math.round(median), "day")}</dd></div>
            </dl>
          </div>

          {open.map((a) => (
            <section key={a.id} className="panel" aria-label={`Open: ${a.role}`}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: 17 }}>{a.role}</h3>
                <span className="muted">{[formatSalary(a.salary), a.location, a.source, a.appliedAt && `applied ${fmtDay(a.appliedAt)}`].filter(Boolean).join(" · ")}</span>
                <button className="btn small spacer" onClick={() => go({ screen: "applications", id: a.id })}>Open application</button>
              </div>
              <StageBar app={a} />
            </section>
          ))}

          <section aria-label={`History with ${company.name}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <h3 className="sec">Every time you applied</h3>
              <span className="small muted">One bar per application, from applying to its last change</span>
            </div>
            <div className="timeline-head"><span /><span style={{ display: "flex", justifyContent: "space-between" }}><span>{fmtDay(new Date(start).toISOString())}</span><span>Today</span></span></div>
            {sorted.map((a) => {
              const from = new Date(a.appliedAt ?? a.createdAt).getTime();
              const to = a.stage === "closed" ? new Date(a.updatedAt).getTime() : now;
              return (
                <div key={a.id} className="timeline-row">
                  <button className="link" style={{ textAlign: "left", color: "var(--ink)", fontWeight: 400 }} onClick={() => go({ screen: "applications", id: a.id })}>
                    <span style={{ display: "block", fontWeight: 600 }}>{a.role}</span>
                    <span className="small muted">{fmtDay(a.appliedAt ?? a.createdAt)} · {a.stage === "closed" && a.closeReason ? a.closeReason.replace("_", " ") : STAGE_LABELS[a.stage].toLowerCase()}</span>
                  </button>
                  <span className="timeline-track">
                    <span className="timeline-bar" style={{ left: pct(from), width: `calc(${pct(to)} - ${pct(from)})`, background: STAGE_COLOR[a.stage] }} title={STAGE_LABELS[a.stage]} />
                  </span>
                </div>
              );
            })}
          </section>
        </div>
        <aside className="aside" aria-label="Interviews and notes">
          <h3 className="sec">Interviews here</h3>
          {interviews.length === 0 && <p className="small muted" style={{ margin: 0 }}>None yet.</p>}
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
            {interviews.map((i) => (
              <li key={i.id}>
                <button className="link" style={{ color: "var(--ink)", fontWeight: 400, textAlign: "left" }} onClick={() => go({ screen: "interviews", id: i.id })}>
                  <b>{fmtLong(i.startsAt)}</b> · {ROUND_LABELS[i.round]}{i.outcome ? ` · ${i.outcome.replace("_", " ")}` : ""}
                </button>
              </li>
            ))}
          </ol>
          <h3 className="sec" style={{ marginTop: 18 }}>What you learned</h3>
          <textarea
            className="note"
            value={notes}
            placeholder="Anything to remember next time you apply here. Optional."
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== company.notes && apply((d) => ({ ...d, companies: d.companies.map((c) => (c.id === company.id ? { ...c, notes } : c)) }))}
            aria-label={`Notes about ${company.name}`}
          />
        </aside>
      </div>
    </main>
  );
}
