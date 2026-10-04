import { useEffect, useState } from "react";
import { type Interview, type Outcome, ROUNDS, ROUND_LABELS, isVisible, recordOutcome } from "@jobtrack/core";
import { useApp } from "../context";
import { Icon } from "../components/Icon";
import { AddInterview } from "../components/AddInterview";
import { companyMap, fmtLong, fmtTime, fmtWeekday, fromLocalInput, relativeDay, toLocalInput } from "../helpers";

const OUTCOME_UI: { value: Outcome; label: string; icon: "check" | "dash" | "x"; color: string }[] = [
  { value: "went_well", label: "Went well", icon: "check", color: "var(--good-ink)" },
  { value: "not_sure", label: "Not sure", icon: "dash", color: "var(--warn-ink)" },
  { value: "went_badly", label: "Went badly", icon: "x", color: "var(--bad-ink)" },
];

export function OutcomeButtons({ value, onPick }: { value?: Outcome; onPick(o: Outcome): void }) {
  return (
    <div className="outcome" role="radiogroup" aria-label="How it went">
      {OUTCOME_UI.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} className={value === o.value ? "on" : undefined} onClick={() => onPick(o.value)}>
          <span style={{ color: o.color, display: "flex" }}><Icon name={o.icon} size={18} stroke={1.8} /></span>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const patchInterview = (id: string, p: Partial<Interview>) => (d: Parameters<typeof recordOutcome>[0]) => ({
  ...d,
  interviews: d.interviews.map((i) => (i.id === id ? { ...i, ...p } : i)),
});

export function InterviewsScreen() {
  const { data, route, go } = useApp();
  const companies = companyMap(data);
  const apps = new Map(data.applications.map((a) => [a.id, a]));
  const now = new Date().toISOString();
  const all = data.interviews.filter((i) => {
    const a = apps.get(i.applicationId);
    return a && isVisible(a);
  });
  const upcoming = all.filter((i) => i.startsAt >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = all.filter((i) => i.startsAt < now).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const selected = all.find((i) => i.id === route.id) ?? upcoming[0] ?? past[0];
  const name = (i: Interview) => companies.get(apps.get(i.applicationId)?.companyId ?? "")?.name ?? "Unknown";

  const row = (i: Interview) => {
    const on = i.id === selected?.id;
    return (
      <button key={i.id} className={`item${on ? " on" : ""}`} style={{ gridTemplateColumns: "40px 1fr" }} onClick={() => go({ screen: "interviews", id: i.id })}>
        <span style={{ textAlign: "center", lineHeight: 1.1 }}>
          <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: on ? "var(--accent-sub)" : "var(--muted)" }}>{fmtWeekday(i.startsAt).toUpperCase()}</span>
          <b style={{ display: "block", fontSize: 18 }}>{new Date(i.startsAt).getDate()}</b>
        </span>
        <span style={{ minWidth: 0 }}>
          <span className="t">{name(i)}</span>
          <span className="s">{ROUND_LABELS[i.round]} · {i.startsAt >= now ? fmtTime(i.startsAt) : (OUTCOME_UI.find((o) => o.value === i.outcome)?.label.toLowerCase() ?? "no outcome yet")}</span>
        </span>
      </button>
    );
  };

  return (
    <>
      <aside className="list" aria-label="Interviews">
        <div className="list-head" data-tauri-drag-region><h1>Interviews</h1><span className="muted spacer">{all.length}</span></div>
        <div className="list-scroll">
          {all.length === 0 && <p className="list-empty">No interviews yet. Add one from an application when it's booked.</p>}
          {upcoming.length > 0 && <div className="group">Coming up</div>}
          {upcoming.map(row)}
          {past.length > 0 && <div className="group">Done</div>}
          {past.map(row)}
        </div>
      </aside>
      {selected ? <InterviewDetail key={selected.id} interview={selected} name={name(selected)} /> : <NoInterview />}
    </>
  );
}

function NoInterview() {
  const { data } = useApp();
  const [appId, setAppId] = useState("");
  const companies = companyMap(data);
  const active = data.applications.filter((a) => isVisible(a) && a.stage !== "closed");
  return (
    <main className="main">
      <div className="empty" style={{ maxWidth: 460 }}>
        <h2>Nothing booked</h2>
        <p>When a company schedules a round, pick the application and add the time. That's all it needs.</p>
        {active.length > 0 && (
          <select className="field" value={appId} onChange={(e) => setAppId(e.target.value)} aria-label="Application">
            <option value="">Choose an application…</option>
            {active.map((a) => <option key={a.id} value={a.id}>{companies.get(a.companyId)?.name} · {a.role}</option>)}
          </select>
        )}
        {appId && <AddInterview applicationId={appId} onDone={() => setAppId("")} />}
      </div>
    </main>
  );
}

function InterviewDetail({ interview, name }: { interview: Interview; name: string }) {
  const { data, apply, go } = useApp();
  const [prep, setPrep] = useState(interview.prep);
  const [note, setNote] = useState(interview.outcomeNote);
  const [when, setWhen] = useState(toLocalInput(interview.startsAt));
  const [adding, setAdding] = useState(false);
  useEffect(() => setWhen(toLocalInput(interview.startsAt)), [interview.startsAt]);
  const app = data.applications.find((a) => a.id === interview.applicationId);
  const earlier = data.interviews
    .filter((i) => i.id !== interview.id && data.applications.find((a) => a.id === i.applicationId)?.companyId === app?.companyId && i.startsAt < interview.startsAt)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const isPast = interview.startsAt < new Date().toISOString();

  return (
    <main className="main">
      <header className="bar" data-tauri-drag-region>
        <span className="crumb">Interviews</span>
        <span className="crumb" aria-hidden="true">/</span>
        <span className="title">{name} · {ROUND_LABELS[interview.round]}</span>
        <div className="spacer"><button className="btn" onClick={() => go({ screen: "applications", id: interview.applicationId })}>Open application</button></div>
      </header>
      <div className="body">
        <div className="content">
          <div>
            <h2 className="h2">{fmtLong(interview.startsAt)}, {fmtTime(interview.startsAt)}</h2>
            <div className="muted" style={{ fontSize: 14, marginTop: 2 }}>{relativeDay(interview.startsAt)} · {interview.durationMinutes} minutes · {app?.role}</div>
          </div>
          <label className="small muted" style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 260 }}>
            Move to
            <input
              className="field"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              onBlur={() => {
                const iso = fromLocalInput(when);
                if (iso && iso !== interview.startsAt) apply(patchInterview(interview.id, { startsAt: iso }), "Interview moved");
              }}
            />
          </label>
          <section aria-label="Round">
            <h3 className="sec" style={{ marginBottom: 8 }}>Round</h3>
            <div className="chips" role="radiogroup" aria-label="Round">
              {ROUNDS.map((r) => (
                <button key={r} role="radio" aria-checked={interview.round === r} className={`chip${interview.round === r ? " on" : ""}`} onClick={() => apply(patchInterview(interview.id, { round: r }))}>
                  {ROUND_LABELS[r]}
                </button>
              ))}
            </div>
          </section>
          <section aria-label="Prep">
            <h3 className="sec" style={{ marginBottom: 8 }}>Prep <span className="small muted" style={{ fontWeight: 400 }}>optional</span></h3>
            <textarea className="note" style={{ minHeight: 84 }} value={prep} placeholder="What to review before this round" onChange={(e) => setPrep(e.target.value)} onBlur={() => prep !== interview.prep && apply(patchInterview(interview.id, { prep }))} />
          </section>
          <section className="panel" aria-label="After the interview">
            <h3 className="sec">{isPast ? "How did it go?" : "After the call, one tap is enough"}</h3>
            <OutcomeButtons value={interview.outcome} onPick={(o) => apply((d) => recordOutcome(d, interview.id, o, note), "Saved")} />
            <input className="field" value={note} placeholder="Anything they asked worth remembering? One line is plenty." onChange={(e) => setNote(e.target.value)} onBlur={() => note !== interview.outcomeNote && apply(patchInterview(interview.id, { outcomeNote: note }))} />
          </section>
        </div>
        <aside className="aside" aria-label="Add interview and history">
          {adding ? (
            <AddInterview applicationId={interview.applicationId} onDone={() => setAdding(false)} />
          ) : (
            <button className="btn primary" style={{ alignSelf: "flex-start" }} onClick={() => setAdding(true)}>Add another round</button>
          )}
          <h3 className="sec" style={{ marginTop: 8 }}>Earlier with {name}</h3>
          {earlier.length === 0 && <p className="small muted" style={{ margin: 0 }}>This is the first round here.</p>}
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {earlier.map((i) => (
              <li key={i.id}>
                <b>{fmtLong(i.startsAt)} · {ROUND_LABELS[i.round]}</b>
                <div className="small muted">{OUTCOME_UI.find((o) => o.value === i.outcome)?.label ?? "No outcome recorded"}{i.outcomeNote ? ` · ${i.outcomeNote}` : ""}</div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </main>
  );
}
