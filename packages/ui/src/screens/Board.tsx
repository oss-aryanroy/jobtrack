import { useMemo, useState } from "react";
import { type Stage, STAGE_LABELS, changeStage, filterApplications, formatSalary } from "@jobtrack/core";
import { useApp } from "../context";
import { STAGE_COLOR, companyMap, relativeDay } from "../helpers";

const COLUMNS: Stage[] = ["saved", "applied", "screen", "interviewing", "offer"];
const DRAG_TYPE = "application/x-jobtrack-id";

export function BoardScreen() {
  const { data, apply, go } = useApp();
  const [tag, setTag] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const companies = companyMap(data);
  const active = filterApplications(data.applications, data.companies, { view: "active", tags: tag ? [tag] : undefined });
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of filterApplications(data.applications, data.companies, { view: "active" })) for (const t of a.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);
  const nextDue = new Map<string, string>();
  for (const f of data.followUps) if (!f.doneAt && (!nextDue.has(f.applicationId) || f.dueAt < nextDue.get(f.applicationId)!)) nextDue.set(f.applicationId, f.dueAt);

  const drop = (stage: Stage, e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData(DRAG_TYPE);
    setOver(null);
    setDragging(null);
    if (id) apply((d) => changeStage(d, id, stage), `Moved to ${STAGE_LABELS[stage]}`);
  };
  const dropProps = (stage: Stage) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      setOver(stage);
    },
    onDragLeave: () => setOver((s) => (s === stage ? null : s)),
    onDrop: (e: React.DragEvent) => drop(stage, e),
  });

  return (
    <>
      <aside className="list" aria-label="Views">
        <div className="list-head" data-tauri-drag-region><h1>Views</h1></div>
        <div className="list-scroll">
          <button className={`item${tag === null ? " on" : ""}`} style={{ gridTemplateColumns: "1fr auto" }} onClick={() => setTag(null)}>
            <span className="t">All active</span>
            <span className="w">{filterApplications(data.applications, data.companies, { view: "active" }).length}</span>
          </button>
          {tags.map(([t, n]) => (
            <button key={t} className={`item${tag === t ? " on" : ""}`} style={{ gridTemplateColumns: "1fr auto" }} onClick={() => setTag(t)}>
              <span className="t">{t}</span>
              <span className="w">{n}</span>
            </button>
          ))}
          <p className="list-empty small">Add tags to an application and they show up here as views. Nothing to set up first.</p>
        </div>
      </aside>
      <main className="main">
        <header className="bar" data-tauri-drag-region>
          <span className="title">Board</span>
          <span className="muted">· drag a card to change its stage</span>
        </header>
        <div className="cols">
          {COLUMNS.map((stage) => {
            const cards = active.filter((a) => a.stage === stage);
            return (
              <section key={stage} className={`col${over === stage ? " over" : ""}`} aria-label={STAGE_LABELS[stage]} {...dropProps(stage)}>
                <div className="col-head">
                  <span className="swatch" style={{ background: STAGE_COLOR[stage], borderRadius: 3 }} />
                  {STAGE_LABELS[stage]}
                  <span className="muted" style={{ fontWeight: 400 }}>{cards.length}</span>
                </div>
                {cards.map((a) => {
                  const due = nextDue.get(a.id);
                  return (
                    <button
                      key={a.id}
                      className={`card${dragging === a.id ? " dragging" : ""}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_TYPE, a.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragging(a.id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      onClick={() => go({ screen: "applications", id: a.id })}
                    >
                      <span className="c">{companies.get(a.companyId)?.name ?? "Unknown company"}</span>
                      <span className="r">{a.role}</span>
                      <span className="m">
                        <span>{formatSalary(a.salary)}</span>
                        <span>{due ? `follow up ${relativeDay(due)}` : ""}</span>
                      </span>
                    </button>
                  );
                })}
              </section>
            );
          })}
        </div>
        <div className={`closezone${over === "closed" ? " over" : ""}`} {...dropProps("closed")}>
          Drop here to close <span style={{ fontWeight: 400 }}>counts as rejected; change the reason on the application</span>
        </div>
      </main>
    </>
  );
}
