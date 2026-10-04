import { useState } from "react";
import type { Settings } from "@jobtrack/core";
import { useApp } from "../context";
import { AppMark } from "./AppMark";
import { SettingsRows } from "./SettingsSheet";

export function Onboarding({ onDone }: { onDone(): void }) {
  const { data, apply } = useApp();
  const [step, setStep] = useState<"welcome" | "defaults">("welcome");
  const update = (patch: Partial<Settings>) => apply((d) => ({ ...d, settings: { ...d.settings, ...patch } }));

  if (step === "welcome") {
    return (
      <div className="welcome" role="dialog" aria-modal="true" aria-label="Welcome to JobTrack">
        <span className="app-icon"><AppMark size={84} /></span>
        <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.12, letterSpacing: "-0.02em" }}>Welcome to JobTrack</h1>
        <p>Paste a job link and get back to applying. JobTrack fills in the rest, tells you when to follow up, and keeps your history in one place.</p>
        <button className="big-btn" autoFocus onClick={() => setStep("defaults")}>Next</button>
        <div className="dots" aria-label="Step 1 of 2"><span className="on" /><span /></div>
      </div>
    );
  }
  return (
    <div className="setup" role="dialog" aria-modal="true" aria-label="A few defaults">
      <div className="setup-card">
        <div>
          <h1 style={{ margin: 0, fontSize: 24, letterSpacing: "-0.015em" }}>A few defaults</h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>Already set to what most people use. Change anything later in Settings.</p>
        </div>
        <SettingsRows settings={data.settings} onChange={update} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <button className="link" style={{ color: "var(--muted)", fontWeight: 400 }} onClick={() => setStep("welcome")}>Back</button>
          <div className="dots" aria-label="Step 2 of 2" style={{ margin: "0 auto" }}><span /><span className="on" /></div>
          <button className="btn primary" style={{ height: 38, padding: "0 20px", fontSize: 14 }} autoFocus onClick={onDone}>Open JobTrack</button>
        </div>
      </div>
    </div>
  );
}
