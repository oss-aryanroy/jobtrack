import { useState } from "react";
import { type FollowUp, bucketFollowUps, completeFollowUp, isVisible, markNoReply, snoozeFollowUp } from "@jobtrack/core";
import { useApp } from "../context";
import { companyMap, initials, plural, relativeDay } from "../helpers";

type Group = "now" | "overdue" | "upcoming";

export function FollowUpsScreen() {
  const { data, apply, go } = useApp();
  const [group, setGroup] = useState<Group>("now");
  const companies = companyMap(data);
  const apps = new Map(data.applications.map((a) => [a.id, a]));
  const hidden = new Set(data.applications.filter((a) => !isVisible(a)).map((a) => a.id));
  const b = bucketFollowUps(data.followUps, new Date().toISOString(), hidden);
  const done = data.followUps.filter((f) => f.doneAt).length;
  const sections: { title: string; tone: string; rows: FollowUp[]; hint: string }[] =
    group === "now"
      ? [
          { title: "Overdue", tone: "var(--bad-ink)", rows: b.overdue, hint: "" },
          { title: "Today", tone: "var(--warn-ink)", rows: b.today, hint: "" },
        ]
      : group === "overdue"
        ? [{ title: "Overdue", tone: "var(--bad-ink)", rows: b.overdue, hint: "" }]
        : [{ title: "Coming up", tone: "var(--ink)", rows: b.upcoming, hint: "nothing to do yet" }];
  const settings = data.settings;
  const set = (patch: Partial<typeof settings>) => apply((d) => ({ ...d, settings: { ...d.settings, ...patch } }));

  const why = (f: FollowUp) => {
    const app = apps.get(f.applicationId);
    const when = relativeDay(f.dueAt);
    if (f.kind === "after_interview") return `${when} · check in after the interview`;
    if (f.attempt > 1) return `${when} · try ${f.attempt} of ${settings.maxTries}, still no reply`;
    return `${when} · first check-in since applying${app?.role ? ` for ${app.role}` : ""}`;
  };

  return (
    <>
      <aside className="list" aria-label="Follow-up groups">
        <div className="list-head" data-tauri-drag-region><h1>Follow-ups</h1></div>
        {([
          ["now", "Due now", b.overdue.length + b.today.length],
          ["overdue", "Overdue", b.overdue.length],
          ["upcoming", "Coming up", b.upcoming.length],
        ] as const).map(([g, label, n]) => (
          <button key={g} className={`item${group === g ? " on" : ""}`} style={{ gridTemplateColumns: "1fr auto" }} onClick={() => setGroup(g)}>
            <span className="t">{label}</span>
            <span className="w" style={{ fontWeight: 600 }}>{n}</span>
          </button>
        ))}
        <p className="list-empty small">You never create these. JobTrack schedules them when you apply, after interviews, and when things go quiet. {plural(done, "follow-up")} done so far.</p>
      </aside>
      <main className="main">
        <header className="bar" data-tauri-drag-region>
          <span className="title">{group === "now" ? "Due now" : group === "overdue" ? "Overdue" : "Coming up"}</span>
          <span className="muted">· clear the list in a minute</span>
        </header>
        <div className="body">
          <div className="content" style={{ gap: 0, paddingTop: 8 }}>
            {sections.every((s) => s.rows.length === 0) && (
              <div className="empty">
                <h2>All clear</h2>
                <p>Nothing to chase right now. New follow-ups show up here on their own.</p>
              </div>
            )}
            {sections.map(
              (s) =>
                s.rows.length > 0 && (
                  <section key={s.title} aria-label={s.title}>
                    <div className="fu-group"><h2 style={{ color: s.tone }}>{s.title}</h2><span className="muted">{s.rows.length}{s.hint ? ` · ${s.hint}` : ""}</span></div>
                    {s.rows.map((f) => {
                      const app = apps.get(f.applicationId);
                      const name = companies.get(app?.companyId ?? "")?.name ?? "Unknown";
                      return (
                        <div key={f.id} className="fu-row">
                          <span className="tile">{initials(name)}</span>
                          <button className="link" style={{ minWidth: 0, textAlign: "left", color: "var(--ink)", fontWeight: 400 }} onClick={() => go({ screen: "applications", id: f.applicationId })}>
                            <span style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{name}</span>
                            <span className="muted" style={{ display: "block" }}>{why(f)}</span>
                          </button>
                          <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <button className="btn primary" onClick={() => apply((d) => completeFollowUp(d, f.id), "Follow-up done")}>Done</button>
                            <button className="btn" onClick={() => apply((d) => snoozeFollowUp(d, f.id, 3), "Moved 3 days later")}>In 3 days</button>
                            {app?.stage === "applied" && <button className="btn" onClick={() => apply((d) => markNoReply(d, f.id), "Marked as no reply")}>No reply</button>}
                          </span>
                        </div>
                      );
                    })}
                  </section>
                ),
            )}
          </div>
          <aside className="aside" aria-label="How follow-ups are scheduled">
            <h3 className="sec">How these get made</h3>
            <label className="rule">
              <span className="small muted">After you apply</span>
              <span>Follow up in{" "}
                <select value={settings.followUpDays} onChange={(e) => set({ followUpDays: Number(e.target.value) })}>
                  {[3, 4, 5, 7, 10, 14].map((n) => <option key={n} value={n}>{plural(n, "day")}</option>)}
                </select>
              </span>
            </label>
            <label className="rule">
              <span className="small muted">If it's still quiet</span>
              <span>Again every{" "}
                <select value={settings.repeatDays} onChange={(e) => set({ repeatDays: Number(e.target.value) })}>
                  {[3, 5, 7, 10, 14].map((n) => <option key={n} value={n}>{plural(n, "day")}</option>)}
                </select>
                , stop after{" "}
                <select value={settings.maxTries} onChange={(e) => set({ maxTries: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{plural(n, "try", "tries")}</option>)}
                </select>
              </span>
            </label>
            <p className="small muted" style={{ margin: "4px 0 0", lineHeight: 1.5 }}>New applications use these automatically, so there's nothing to fill in when you add a job.</p>
          </aside>
        </div>
      </main>
    </>
  );
}
