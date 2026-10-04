import { useState } from "react";
import { type Round, ROUNDS, ROUND_LABELS, addInterview } from "@jobtrack/core";
import { useApp } from "../context";
import { fromLocalInput, toLocalInput } from "../helpers";

const tomorrowAt11 = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(11, 0, 0, 0);
  return toLocalInput(d.toISOString());
};

export function AddInterview({ applicationId, onDone }: { applicationId: string; onDone(): void }) {
  const { apply } = useApp();
  const [when, setWhen] = useState(tomorrowAt11);
  const [round, setRound] = useState<Round>("technical");
  const startsAt = fromLocalInput(when);
  return (
    <form
      className="panel"
      style={{ padding: 14, gap: 10 }}
      aria-label="Add an interview"
      onSubmit={(e) => {
        e.preventDefault();
        if (!startsAt) return;
        apply((d) => addInterview(d, applicationId, startsAt, round), "Interview added");
        onDone();
      }}
      onKeyDown={(e) => e.key === "Escape" && onDone()}
    >
      <label className="small muted" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        When
        <input className="field" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} autoFocus />
      </label>
      <div className="chips" role="radiogroup" aria-label="Round">
        {ROUNDS.map((r) => (
          <button key={r} type="button" role="radio" aria-checked={round === r} className={`chip${round === r ? " on" : ""}`} style={{ height: 24, fontSize: 12 }} onClick={() => setRound(r)}>
            {ROUND_LABELS[r]}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn primary" type="submit" disabled={!startsAt}>Add interview</button>
        <button className="btn" type="button" onClick={onDone}>Cancel</button>
      </div>
      <span className="small muted">Only the time is needed. The round can be changed later.</span>
    </form>
  );
}
