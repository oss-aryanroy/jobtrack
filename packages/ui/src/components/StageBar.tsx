import { useState } from "react";
import { type Application, type CloseReason, CLOSE_REASONS, CLOSE_REASON_LABELS, STAGE_LABELS, changeStage } from "@jobtrack/core";
import { useApp } from "../context";

const FLOW = ["saved", "applied", "screen", "interviewing", "offer"] as const;

export function StageBar({ app }: { app: Application }) {
  const { apply } = useApp();
  const [closing, setClosing] = useState(false);
  const current = app.stage === "closed" ? -1 : FLOW.indexOf(app.stage as (typeof FLOW)[number]);
  const close = (reason: CloseReason) => {
    setClosing(false);
    apply((d) => changeStage(d, app.id, "closed", reason), `Closed: ${CLOSE_REASON_LABELS[reason]}`);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="stepper" role="group" aria-label="Stage, click to change">
        {FLOW.map((s, i) => (
          <button
            key={s}
            className={`step${i === current ? " now" : i < current ? " done" : ""}`}
            aria-current={i === current ? "step" : undefined}
            onClick={() => apply((d) => changeStage(d, app.id, s), `Moved to ${STAGE_LABELS[s]}`)}
          >
            {STAGE_LABELS[s]}
          </button>
        ))}
        <button className={`step close${app.stage === "closed" ? " closed-now" : ""}`} aria-expanded={closing} onClick={() => setClosing((v) => !v)}>
          {app.stage === "closed" && app.closeReason ? CLOSE_REASON_LABELS[app.closeReason] : "Closed…"}
        </button>
      </div>
      {closing && (
        <div className="chips" role="group" aria-label="Why it closed">
          {CLOSE_REASONS.map((r) => (
            <button key={r} className={`chip${app.closeReason === r ? " on" : ""}`} onClick={() => close(r)}>
              {CLOSE_REASON_LABELS[r]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
