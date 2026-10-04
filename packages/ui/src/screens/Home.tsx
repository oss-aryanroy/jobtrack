import { useState } from "react";
import {
  type Dataset,
  STAGES,
  STAGE_LABELS,
  ROUND_LABELS,
  bucketFollowUps,
  bySource,
  findDuplicates,
  formatRate,
  isVisible,
  localDayKey,
  parseQuickInput,
  stageCounts,
  weeklyCounts,
} from "@jobtrack/core";
import { useApp } from "../context";
import { Icon } from "../components/Icon";
import { addFromQuick } from "../components/QuickAdd";
import { STAGE_COLOR, companyMap, fmtDay, fmtTime, fmtWeekday, fmtLong, initials, plural, relativeDay } from "../helpers";

interface NeedItem {
  key: string;
  appId: string;
  mono: string;
  title: string;
  sub: string;
  tone: "late" | "today" | "soon";
}

function needsYou(data: Dataset, now: string) {
  const companies = companyMap(data);
  const apps = new Map(data.applications.map((a) => [a.id, a]));
  const hidden = new Set(data.applications.filter((a) => !isVisible(a)).map((a) => a.id));
  const fu = bucketFollowUps(data.followUps, now, hidden);
  const name = (appId: string) => companies.get(apps.get(appId)?.companyId ?? "")?.name ?? "Unknown";
  const today = localDayKey(now);
  const weekAhead = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const toItem = (tone: NeedItem["tone"]) => (f: (typeof fu.today)[number]): NeedItem => ({
    key: f.id,
    appId: f.applicationId,
    mono: initials(name(f.applicationId)),
    title: `Follow up · ${name(f.applicationId)}`,
    sub: tone === "late" ? `Due ${relativeDay(f.dueAt, now)}` : apps.get(f.applicationId)?.role ?? "",
    tone,
  });
  const interviewsToday = data.interviews.filter((i) => localDayKey(i.startsAt) === today && !hidden.has(i.applicationId));
  const soon = [
    ...data.interviews
      .filter((i) => localDayKey(i.startsAt) > today && i.startsAt < weekAhead && !hidden.has(i.applicationId))
      .map((i) => ({ at: i.startsAt, item: { key: i.id, appId: i.applicationId, mono: initials(name(i.applicationId)), title: `${name(i.applicationId)} interview`, sub: `${fmtWeekday(i.startsAt)} ${fmtTime(i.startsAt)}`, tone: "soon" as const } })),
    ...data.applications
      .filter((a) => isVisible(a) && a.deadline && localDayKey(a.deadline) >= today && a.deadline < weekAhead && a.stage === "saved")
      .map((a) => ({ at: a.deadline!, item: { key: `dl-${a.id}`, appId: a.id, mono: initials(name(a.id)), title: `Apply to ${name(a.id)}`, sub: `Closes ${relativeDay(a.deadline!, now)}`, tone: "soon" as const } })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((x) => x.item);
  return [
    { title: "Overdue", tone: "late" as const, items: fu.overdue.map(toItem("late")) },
    {
      title: "Today",
      tone: "today" as const,
      items: [
        ...interviewsToday.map((i) => ({ key: i.id, appId: i.applicationId, mono: initials(name(i.applicationId)), title: `${name(i.applicationId)} interview`, sub: `${fmtTime(i.startsAt)} · ${ROUND_LABELS[i.round]}`, tone: "today" as const })),
        ...fu.today.map(toItem("today")),
      ],
    },
    { title: "This week", tone: "soon" as const, items: soon },
  ].filter((g) => g.items.length);
}

const TONE = {
  late: { bg: "var(--bad-bg)", ink: "var(--bad-ink)" },
  today: { bg: "var(--warn-bg)", ink: "var(--warn-ink)" },
  soon: { bg: "var(--field)", ink: "var(--ink-2)" },
};

export function HomeScreen() {
  const { data, apply, go, openQuickAdd, platform, mod } = useApp();
  const [text, setText] = useState("");
  const now = new Date().toISOString();
  const visible = data.applications.filter((a) => !a.trashedAt);
  const groups = needsYou(data, now);
  const needCount = groups.reduce((n, g) => n + g.items.length, 0);
  const weeks = weeklyCounts(visible, now);
  const thisWeek = weeks.at(-1)?.count ?? 0;
  const weekStart = weeks.at(-1)?.weekStart ?? now;
  const repliesThisWeek = visible.filter((a) => a.repliedAt && a.repliedAt >= weekStart).length;
  const upcoming = data.interviews.filter((i) => i.startsAt >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const counts = stageCounts(visible);
  const total = visible.length;
  const sources = bySource(visible).slice(0, 5);
  const companies = companyMap(data);
  const recent = [...data.activities].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
  const appsById = new Map(data.applications.map((a) => [a.id, a]));

  const capture = () => {
    const parsed = parseQuickInput(text);
    if (!parsed.company && !parsed.role && !parsed.url) return;
    const dupes = findDuplicates(parsed, data.applications, data.companies);
    if (parsed.ats || dupes.length || !parsed.company || !parsed.role) {
      openQuickAdd(text);
    } else {
      apply((d) => addFromQuick(d, parsed).dataset, `Added ${parsed.company}`);
    }
    setText("");
  };

  return (
    <>
      <aside className="list" aria-label="Needs you">
        <div className="list-head" data-tauri-drag-region>
          <h1>Needs you</h1>
          <span className="muted spacer">{needCount}</span>
        </div>
        <div className="list-scroll">
          {groups.length === 0 && <p className="list-empty">Nothing due. Follow-ups appear here on their own when it's time.</p>}
          {groups.map((g) => (
            <div key={g.title}>
              <div className="group">
                <span style={{ color: TONE[g.tone].ink }}>{g.title}</span>
                <span>{g.items.length}</span>
              </div>
              {g.items.map((it) => (
                <button key={it.key} className="item" style={{ gridTemplateColumns: "32px 1fr" }} onClick={() => go({ screen: "applications", id: it.appId })}>
                  <span className="tile" style={{ background: TONE[it.tone].bg, color: TONE[it.tone].ink }}>{it.mono}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="t">{it.title}</span>
                    <span className="s">{it.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>
      <main className="main">
        <header className="bar" data-tauri-drag-region>
          <span className="title">Home</span>
          <span className="kbd spacer">{mod}K to search</span>
        </header>
        <div className="body">
          <div className="content">
            <div>
              <h2 className="h1">{fmtLong(now)}</h2>
              <p style={{ margin: "6px 0 0", fontSize: 16, color: "var(--ink-2)", maxWidth: "66ch" }}>
                {total === 0 ? (
                  "Add your first job below. A link or “Company, Role” is all it takes."
                ) : (
                  <>
                    This week you sent <b>{plural(thisWeek, "application")}</b>, heard back from <b>{repliesThisWeek}</b>, and have{" "}
                    <b>{plural(upcoming.length, "interview")}</b> coming up.
                    {needCount > 0 && ` ${plural(needCount, "thing needs", "things need")} you.`}
                  </>
                )}
              </p>
            </div>

            <form
              className="capture"
              aria-label="Add a job"
              onSubmit={(e) => {
                e.preventDefault();
                capture();
              }}
            >
              <span style={{ color: "var(--faint)", display: "flex" }}><Icon name="link" size={18} /></span>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a job link, or type “Company, Role”" aria-label="Job link or Company, Role" />
              <button className="btn primary" type="submit" disabled={!text.trim()}>
                Add <span style={{ fontWeight: 400, opacity: 0.8 }}>↩</span>
              </button>
            </form>

            {total > 0 && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 34 }}>
                  <section aria-label="Applications sent per week">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                      <h3 className="sec">Sent per week</h3>
                      <span className="small muted">last 12 weeks</span>
                    </div>
                    <div className="bars">
                      {weeks.map((w, i) => (
                        <span key={w.weekStart} className={i === weeks.length - 1 ? "now" : undefined} style={{ height: `${(w.count / max) * 100}%` }} title={`Week of ${fmtDay(w.weekStart)}: ${plural(w.count, "application")}`} />
                      ))}
                    </div>
                    <div className="small muted" style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                      <span>{fmtDay(weeks[0]?.weekStart)}</span>
                      <span>This week · {thisWeek} so far</span>
                    </div>
                  </section>
                  <section aria-label="Where applications stand">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                      <h3 className="sec">Where your {total} stand</h3>
                      <span className="small muted">all time</span>
                    </div>
                    <div className="stack" aria-hidden="true">
                      {STAGES.map((s) => counts[s] > 0 && <span key={s} style={{ flex: counts[s], background: STAGE_COLOR[s] }} />)}
                    </div>
                    <dl className="legend">
                      {STAGES.map((s) => (
                        <div key={s} style={{ display: "contents" }}>
                          <dt><span className="swatch" style={{ background: STAGE_COLOR[s] }} />{STAGE_LABELS[s]}</dt>
                          <dd>{counts[s]}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                </div>
                {sources.length > 0 && (
                  <section aria-label="Reply rate by source">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                      <h3 className="sec">Who replies</h3>
                      <span className="small muted">replies ÷ applications, per source</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 18 }}>
                      {sources.map((s) => (
                        <div key={s.source} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <span style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontWeight: 600 }}>{s.source}</span>
                            <span style={{ color: s.reply.small ? "var(--warn-ink)" : undefined }}>{formatRate(s.reply)}</span>
                          </span>
                          <span className="meter"><span className={s.reply.small ? "small-sample" : undefined} style={{ width: `${(s.reply.value ?? 0) * 100}%` }} /></span>
                          <span className="small muted">{s.reply.num} of {s.reply.den}{s.reply.small ? " · need 10+" : ""}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
          <aside className="aside" aria-label="Coming up and recent">
            <h3 className="sec">Coming up</h3>
            {upcoming.length === 0 && <p className="small muted" style={{ margin: 0 }}>No interviews booked.</p>}
            {upcoming.slice(0, 5).map((i) => {
              const app = appsById.get(i.applicationId);
              return (
                <button key={i.id} className="item" style={{ gridTemplateColumns: "40px 1fr", width: "100%", margin: 0 }} onClick={() => go({ screen: "interviews", id: i.id })}>
                  <span className="cal-day"><b>{fmtWeekday(i.startsAt).toUpperCase()}</b><span>{new Date(i.startsAt).getDate()}</span></span>
                  <span style={{ minWidth: 0 }}>
                    <span className="t">{app ? companies.get(app.companyId)?.name : "Interview"}</span>
                    <span className="s">{ROUND_LABELS[i.round]} · {fmtTime(i.startsAt)}</span>
                  </span>
                </button>
              );
            })}
            <h3 className="sec" style={{ marginTop: 16 }}>Recently</h3>
            {recent.length === 0 && <p className="small muted" style={{ margin: 0 }}>Everything you do is logged here for you.</p>}
            <ol className="small" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 9 }}>
              {recent.map((a) => {
                const app = appsById.get(a.applicationId);
                return (
                  <li key={a.id}>
                    <b>{app ? companies.get(app.companyId)?.name : "Deleted"}</b> {a.text.toLowerCase()} · {fmtDay(a.at)}
                  </li>
                );
              })}
            </ol>
            {platform.kind === "web" && <p className="small muted" style={{ margin: "auto 0 0" }}>Press N anywhere to add a job.</p>}
          </aside>
        </div>
      </main>
    </>
  );
}
