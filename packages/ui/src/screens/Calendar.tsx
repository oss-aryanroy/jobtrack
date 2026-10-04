import { useMemo, useState } from "react";
import { ROUND_LABELS, isVisible, localDayKey, recordOutcome, startOfWeek } from "@jobtrack/core";
import { useApp } from "../context";
import { Icon } from "../components/Icon";
import { OutcomeButtons } from "./Interviews";
import { companyMap, fmtDay, fmtLong, fmtTime, fmtWeekday } from "../helpers";

interface CalEvent {
  key: string;
  at: string;
  kind: "interview" | "follow" | "deadline";
  title: string;
  sub: string;
  appId: string;
  interviewId?: string;
}

const DAY = 86_400_000;

export function CalendarScreen() {
  const { data, go, apply } = useApp();
  const todayStart = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  };
  const [weekStart, setWeekStart] = useState(todayStart);
  const [selected, setSelected] = useState<string | null>(null);
  const companies = companyMap(data);
  const apps = new Map(data.applications.map((a) => [a.id, a]));
  const name = (appId: string) => companies.get(apps.get(appId)?.companyId ?? "")?.name ?? "Unknown";
  const today = localDayKey(new Date());

  const events = useMemo(() => {
    const out: CalEvent[] = [];
    const visible = (id: string) => {
      const a = apps.get(id);
      return !!a && isVisible(a);
    };
    for (const i of data.interviews) if (visible(i.applicationId)) out.push({ key: i.id, at: i.startsAt, kind: "interview", title: `${fmtTime(i.startsAt)} ${ROUND_LABELS[i.round]}`, sub: name(i.applicationId), appId: i.applicationId, interviewId: i.id });
    for (const f of data.followUps) if (!f.doneAt && visible(f.applicationId)) out.push({ key: f.id, at: f.dueAt, kind: "follow", title: "Follow up", sub: name(f.applicationId), appId: f.applicationId });
    for (const a of data.applications) if (a.deadline && isVisible(a) && a.stage === "saved") out.push({ key: `dl-${a.id}`, at: a.deadline, kind: "deadline", title: "Apply by", sub: name(a.id), appId: a.id });
    return out.sort((a, b) => a.at.localeCompare(b.at));
  }, [data]);

  const days = Array.from({ length: 7 }, (_, i) => new Date(new Date(weekStart).getTime() + i * DAY).toISOString());
  const byDay = new Map<string, CalEvent[]>();
  for (const e of events) {
    const k = localDayKey(e.at);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const sel = events.find((e) => e.key === selected) ?? null;
  const selInterview = sel?.interviewId ? data.interviews.find((i) => i.id === sel.interviewId) : undefined;

  const monthAnchor = new Date(weekStart);
  monthAnchor.setDate(monthAnchor.getDate() + 3);
  const first = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const monthDays = Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i - lead + 1));
  const weekKeys = new Set(days.map((d) => localDayKey(d)));
  const shift = (weeks: number) => setWeekStart(new Date(new Date(weekStart).getTime() + weeks * 7 * DAY).toISOString());
  const upcoming = events.filter((e) => localDayKey(e.at) >= today).slice(0, 6);

  return (
    <>
      <aside className="list" aria-label="Month and next up">
        <div className="list-head" data-tauri-drag-region>
          <h1>{monthAnchor.toLocaleString(undefined, { month: "long" })}</h1>
          <span className="muted spacer">{monthAnchor.getFullYear()}</span>
        </div>
        <div className="month">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="h">{d}</span>)}
          {monthDays.map((d) => {
            const k = localDayKey(d);
            const inMonth = d.getMonth() === first.getMonth();
            const mark = byDay.get(k)?.[0];
            return (
              <button key={k} className={`${k === today ? "today" : ""}${weekKeys.has(k) ? " in-week" : ""}`} style={{ opacity: inMonth ? 1 : 0.4 }} onClick={() => setWeekStart(startOfWeek(d.toISOString()))} aria-label={fmtLong(d.toISOString())}>
                {d.getDate()}
                <span className="mark" style={{ background: mark ? (mark.kind === "interview" ? "var(--accent)" : mark.kind === "follow" ? "var(--warn)" : "var(--st-closed)") : "transparent" }} />
              </button>
            );
          })}
        </div>
        <div className="group">Next up</div>
        <div className="list-scroll">
          {upcoming.length === 0 && <p className="list-empty">Nothing scheduled.</p>}
          {upcoming.map((e) => (
            <button key={e.key} className="item" style={{ gridTemplateColumns: "10px 1fr" }} onClick={() => { if (!days.some((d) => localDayKey(d) === localDayKey(e.at))) setWeekStart(startOfWeek(e.at)); setSelected(e.key); }}>
              <span className="swatch" style={{ background: e.kind === "interview" ? "var(--accent)" : e.kind === "follow" ? "var(--warn)" : "var(--st-closed)" }} />
              <span style={{ minWidth: 0 }}>
                <span className="t">{e.kind === "interview" ? `${e.sub} interview` : `${e.title} · ${e.sub}`}</span>
                <span className="s">{fmtWeekday(e.at)} {fmtDay(e.at)}{e.kind === "interview" ? `, ${fmtTime(e.at)}` : ""}</span>
              </span>
            </button>
          ))}
        </div>
      </aside>
      <main className="main">
        <header className="bar" data-tauri-drag-region>
          <span className="title">{fmtDay(days[0])} – {fmtDay(days[6])}</span>
          <div className="spacer" style={{ display: "flex", gap: 6 }}>
            <button className="btn" aria-label="Previous week" onClick={() => shift(-1)}><Icon name="chevronLeft" size={14} /></button>
            <button className="btn" onClick={() => setWeekStart(todayStart())}>Today</button>
            <button className="btn" aria-label="Next week" onClick={() => shift(1)}><Icon name="chevronRight" size={14} /></button>
          </div>
        </header>
        <div className="body">
          <div className="week">
            {days.map((d) => {
              const k = localDayKey(d);
              return (
                <div key={k} className={`day${k === today ? " today" : ""}`}>
                  <div className="day-head"><span className="small muted">{fmtWeekday(d)}</span><span className="day-num">{new Date(d).getDate()}</span></div>
                  {(byDay.get(k) ?? []).map((e) => (
                    <button key={e.key} className={`ev ev-${e.kind}${selected === e.key ? " sel" : ""}`} onClick={() => setSelected(e.key)}>
                      <span className="t">{e.title}</span>
                      <span className="s">{e.sub}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
          <aside className="aside" aria-label="Selected event">
            {!sel && <p className="small muted" style={{ margin: 0 }}>Pick an event to see it here. Interviews, follow-ups and deadlines all appear on their own.</p>}
            {sel && (
              <>
                <span className="small" style={{ fontWeight: 700, color: "var(--accent-ink)" }}>{sel.kind === "interview" ? "Interview" : sel.kind === "follow" ? "Follow-up" : "Deadline"} · {fmtWeekday(sel.at)} {fmtDay(sel.at)}</span>
                <h2 style={{ margin: 0, fontSize: 20 }}>{sel.sub}</h2>
                <div className="muted">{apps.get(sel.appId)?.role}{selInterview ? ` · ${ROUND_LABELS[selInterview.round]} · ${fmtTime(selInterview.startsAt)}` : ""}</div>
                <div><button className="btn" onClick={() => go({ screen: "applications", id: sel.appId })}>Open application</button></div>
                {selInterview?.prep && <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--field)", lineHeight: 1.5 }}>{selInterview.prep}</div>}
                {selInterview && (
                  <>
                    <h3 className="sec" style={{ marginTop: 10 }}>After it, one tap</h3>
                    <OutcomeButtons value={selInterview.outcome} onPick={(o) => apply((d) => recordOutcome(d, selInterview.id, o, selInterview.outcomeNote), "Saved")} />
                  </>
                )}
              </>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}
