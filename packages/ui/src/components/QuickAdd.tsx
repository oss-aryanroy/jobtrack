import { useEffect, useMemo, useRef, useState } from "react";
import {
  type AtsDetails,
  type Dataset,
  type QuickParse,
  addApplication,
  fetchAtsDetails,
  findDuplicates,
  findOrCreateCompany,
  parseQuickInput,
  updateApplication,
} from "@jobtrack/core";
import { useApp } from "../context";
import { companyMap, companyName, plural } from "../helpers";
import { Icon } from "./Icon";

export function addFromQuick(data: Dataset, input: QuickParse & { stage?: "applied" | "saved"; location?: string }) {
  const change = addApplication(data, input);
  const next = input.location ? updateApplication(change.dataset, change.applicationId, { location: input.location }) : change.dataset;
  return { dataset: next, id: change.applicationId };
}

export function QuickAdd({ initialText, onClose }: { initialText: string; onClose(): void }) {
  const { data, apply, go, platform, mod } = useApp();
  const [text, setText] = useState(initialText);
  const [company, setCompany] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [stage, setStage] = useState<"applied" | "saved">(data.settings.defaultStage);
  const [ats, setAts] = useState<{ key: string; details: AtsDetails | null; loading: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseQuickInput(text), [text]);
  const atsKey = parsed.ats ? `${parsed.ats.kind}:${parsed.ats.board}:${parsed.ats.id}` : null;

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    if (!parsed.ats || !atsKey) return;
    let cancelled = false;
    setAts({ key: atsKey, details: null, loading: true });
    fetchAtsDetails(parsed.ats).then((details) => {
      if (!cancelled) setAts({ key: atsKey, details, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [atsKey]);

  const fetched = ats && ats.key === atsKey ? ats.details : null;
  const finalCompany = (company ?? fetched?.company ?? parsed.company ?? "").trim();
  const finalRole = (role ?? fetched?.role ?? parsed.role ?? "").trim();
  const canAdd = !!(finalCompany || finalRole || parsed.url);

  const companies = companyMap(data);
  const duplicates = useMemo(
    () => findDuplicates({ company: finalCompany, role: finalRole, url: parsed.url, jobId: parsed.jobId }, data.applications, data.companies),
    [finalCompany, finalRole, parsed.url, parsed.jobId, data.applications, data.companies],
  );
  const existingCompany = finalCompany ? findOrCreateCompany(data.companies, finalCompany) : null;

  const submit = () => {
    if (!canAdd) return;
    const label = finalCompany || finalRole || "job";
    apply(
      (d) => addFromQuick(d, { ...parsed, company: finalCompany, role: finalRole, stage, location: fetched?.location }).dataset,
      `Added ${label}`,
    );
    onClose();
  };

  const source = parsed.ats ? (ats?.loading ? "reading…" : fetched ? "from the job board" : "from link") : parsed.url ? "from link" : "typed";

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Add a job"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <h1>Add a job</h1>
          <span className="kbd spacer">{platform.kind === "desktop" ? `${mod}N from anywhere in the app` : "Press N from anywhere"}</span>
        </div>
        <label className="big-input">
          <Icon name="link" size={18} />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setCompany(null);
              setRole(null);
            }}
            placeholder="Paste a job link, or type “Company, Role”"
            aria-label="Job link or Company, Role"
          />
        </label>
        <p className="small muted" style={{ margin: "-6px 0 0" }}>A link or just “Company, Role”. That's the only thing you have to give.</p>

        {(text.trim() || company !== null || role !== null) && (
          <dl className="got">
            <dt>Company</dt>
            <dd>
              <input value={company ?? fetched?.company ?? parsed.company ?? ""} placeholder="Company" onChange={(e) => setCompany(e.target.value)} aria-label="Company" />
            </dd>
            <dt>Role</dt>
            <dd>
              <input value={role ?? fetched?.role ?? parsed.role ?? ""} placeholder="Role" onChange={(e) => setRole(e.target.value)} aria-label="Role" />
            </dd>
            {parsed.source && (
              <>
                <dt>Source</dt>
                <dd className="small">{parsed.source} <span className="muted">· {source}</span></dd>
              </>
            )}
            {fetched?.location && (
              <>
                <dt>Location</dt>
                <dd className="small">{fetched.location}</dd>
              </>
            )}
            <dt>Status</dt>
            <dd>
              <div className="seg" role="radiogroup" aria-label="Status">
                <button type="button" role="radio" aria-checked={stage === "applied"} className={stage === "applied" ? "on" : undefined} onClick={() => setStage("applied")}>
                  Applied today
                </button>
                <button type="button" role="radio" aria-checked={stage === "saved"} className={stage === "saved" ? "on" : undefined} onClick={() => setStage("saved")}>
                  Just saving it
                </button>
              </div>
            </dd>
            {stage === "applied" && (
              <>
                <dt>Follow-up</dt>
                <dd className="small muted">In {plural(data.settings.followUpDays, "day")}, set automatically</dd>
              </>
            )}
          </dl>
        )}

        {duplicates[0] && (
          <div className="notice">
            <Icon name="info" />
            <span style={{ flex: 1 }}>
              {duplicates[0].reason === "same link" ? "You already added this link" : "Looks like one you already have"}:{" "}
              <b>{companyName(companies, duplicates[0].application)} · {duplicates[0].application.role}</b>
            </span>
            <button
              type="button"
              className="link"
              onClick={() => {
                go({ screen: "applications", id: duplicates[0]!.application.id });
                onClose();
              }}
            >
              Open that instead
            </button>
          </div>
        )}
        {!duplicates[0] && existingCompany && !existingCompany.created && (
          <p className="small muted" style={{ margin: 0 }}>Goes with your other applications at {existingCompany.company.name}.</p>
        )}

        <div className="sheet-foot">
          <span className="small muted">Salary, notes and tags can be added later</span>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!canAdd}>
            {duplicates[0] ? "Add anyway" : "Add"} <span style={{ fontWeight: 400, opacity: 0.8 }}>↩</span>
          </button>
        </div>
      </form>
    </div>
  );
}
