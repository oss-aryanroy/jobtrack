import { useState } from "react";
import {
  BackupError,
  CURRENCIES,
  FILE_EXTENSION,
  type ImportDraft,
  type PreviewRow,
  type Settings,
  addApplication,
  changeStage,
  decodeBackup,
  encodeBackup,
  mergeImport,
  updateApplication,
  previewCsvImport,
  toCsv,
} from "@jobtrack/core";
import { useApp } from "../context";
import { plural } from "../helpers";

const today = () => new Date().toISOString().slice(0, 10);

export function SettingsRows({ settings, onChange }: { settings: Settings; onChange(patch: Partial<Settings>): void }) {
  return (
    <div className="grp">
      <div className="grp-row">
        <span className="l">Status when you add a job<span className="h">Most people add a job right after applying</span></span>
        <select value={settings.defaultStage} onChange={(e) => onChange({ defaultStage: e.target.value as Settings["defaultStage"] })} aria-label="Status when you add a job">
          <option value="applied">Applied today</option>
          <option value="saved">Just saving it</option>
        </select>
      </div>
      <div className="grp-row">
        <span className="l">Salary currency</span>
        <select value={settings.currency} onChange={(e) => onChange({ currency: e.target.value })} aria-label="Salary currency">
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>{c === "INR" ? "₹ INR, lakhs" : c}</option>
          ))}
        </select>
      </div>
      <div className="grp-row">
        <span className="l">Follow up after<span className="h">Then every {plural(settings.repeatDays, "day")}; marked “no reply” after {plural(settings.maxTries, "try", "tries")}</span></span>
        <select value={settings.followUpDays} onChange={(e) => onChange({ followUpDays: Number(e.target.value) })} aria-label="Follow up after">
          {[3, 4, 5, 7, 10, 14].map((n) => <option key={n} value={n}>{plural(n, "day")}</option>)}
        </select>
      </div>
      <div className="grp-row">
        <span className="l">Appearance</span>
        <div className="seg" role="radiogroup" aria-label="Appearance">
          {(["system", "light", "dark"] as const).map((a) => (
            <button key={a} role="radio" aria-checked={settings.appearance === a} className={settings.appearance === a ? "on" : undefined} onClick={() => onChange({ appearance: a })}>
              {a[0]!.toUpperCase() + a.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function importDrafts(data: Parameters<typeof addApplication>[0], drafts: ImportDraft[]) {
  let next = data;
  for (const draft of drafts) {
    const at = draft.appliedAt ?? new Date().toISOString();
    const change = addApplication(next, { company: draft.company, role: draft.role, url: draft.url, source: draft.source, stage: draft.stage === "saved" ? "saved" : "applied" }, at);
    next = updateApplication(change.dataset, change.applicationId, { location: draft.location, salary: draft.salary, notes: draft.notes, tags: draft.tags }, at);
    if (draft.stage !== "saved" && draft.stage !== "applied") next = changeStage(next, change.applicationId, draft.stage, undefined, at);
  }
  return next;
}

export function SettingsSheet({ onClose }: { onClose(): void }) {
  const { data, apply, platform, showToast } = useApp();
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const update = (patch: Partial<Settings>) => apply((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  const exportedFrom = platform.kind === "web" ? "web" : `desktop-${platform.os}`;

  const exportBackup = async () => {
    await platform.saveFile(encodeBackup(data, exportedFrom), `jobtrack-${today()}${FILE_EXTENSION}`, "application/x-protobuf");
  };
  const importBackup = async () => {
    const file = await platform.openFile([FILE_EXTENSION]);
    if (!file) return;
    try {
      const incoming = decodeBackup(file.bytes);
      let report: ReturnType<typeof mergeImport>["report"] | undefined;
      apply((d) => {
        const merged = mergeImport(d, incoming);
        report = merged.report;
        return merged.dataset;
      });
      const added = report?.added.applications ?? 0;
      showToast({ text: `Imported ${plural(added, "application")}${report?.skipped ? `. ${report.skipped} already here, kept yours` : ""}`, undo: added > 0 });
    } catch (e) {
      showToast({ text: e instanceof BackupError ? e.message : "Couldn't read that file.", tone: "error" });
    }
  };
  const exportCsv = async () => {
    await platform.saveFile(new TextEncoder().encode(toCsv(data.applications.filter((a) => !a.trashedAt), data.companies)), `jobtrack-${today()}.csv`, "text/csv");
  };
  const pickCsv = async () => {
    const file = await platform.openFile([".csv", "text/csv"]);
    if (!file) return;
    setPreview(previewCsvImport(new TextDecoder().decode(file.bytes), data.settings.currency).rows);
  };

  if (preview) {
    const ok = preview.filter((r) => r.draft);
    return (
      <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setPreview(null)}>
        <div className="sheet wide" role="dialog" aria-modal="true" aria-label="Import from CSV" onKeyDown={(e) => e.key === "Escape" && setPreview(null)}>
          <h1>Import {plural(ok.length, "row")}?</h1>
          {preview.length === 0 && <p className="muted">That file has no rows under its header.</p>}
          {preview.length > ok.length && <div className="notice bad">{plural(preview.length - ok.length, "row")} will be skipped. Fix them in the file and import again if you need them.</div>}
          <table className="preview-table">
            <thead><tr><th>Line</th><th>Company</th><th>Role</th><th>Stage</th><th>Notes</th></tr></thead>
            <tbody>
              {preview.slice(0, 200).map((r) => (
                <tr key={r.line}>
                  <td>{r.line}</td>
                  <td>{r.draft?.company ?? "—"}</td>
                  <td>{r.draft?.role ?? "—"}</td>
                  <td>{r.draft?.stage ?? "—"}</td>
                  <td>
                    {r.errors.map((e) => <div key={e} className="bad">{e}</div>)}
                    {r.warnings.map((w) => <div key={w} className="warn">{w}</div>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="sheet-foot">
            <span className="small muted">Nothing already in JobTrack is changed.</span>
            <span className="spacer" />
            <button className="btn" onClick={() => setPreview(null)}>Cancel</button>
            <button
              className="btn primary"
              disabled={ok.length === 0}
              onClick={() => {
                apply((d) => importDrafts(d, ok.map((r) => r.draft!)), `Imported ${plural(ok.length, "application")}`);
                setPreview(null);
                onClose();
              }}
            >
              Import {plural(ok.length, "row")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Settings" onKeyDown={(e) => e.key === "Escape" && onClose()}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <h1>Settings</h1>
          <button className="btn ghost spacer" onClick={onClose} aria-label="Close settings">Done</button>
        </div>
        <SettingsRows settings={data.settings} onChange={update} />
        <h2 className="sec">Your data</h2>
        <div className="grp">
          <div className="grp-row">
            <span className="l">Back up or move to another device<span className="h">A {FILE_EXTENSION} file opens in the Mac app, the Windows app and on the website</span></span>
            <button className="btn" onClick={exportBackup}>Export</button>
            <button className="btn" onClick={importBackup}>Import</button>
          </div>
          <div className="grp-row">
            <span className="l">Spreadsheet<span className="h">Import shows a preview first and never changes what's already here</span></span>
            <button className="btn" onClick={exportCsv}>Export CSV</button>
            <button className="btn" onClick={pickCsv}>Import CSV</button>
          </div>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          {platform.kind === "desktop" ? (
            "Everything is stored on this computer. Nothing is uploaded."
          ) : (
            <>
              Your applications are encrypted in this browser before they're saved to your account.{" "}
              <a href="/privacy" target="_blank" rel="noopener">Privacy</a>
            </>
          )}
        </p>
        {platform.account && (
          <div className="grp">
            <div className="grp-row">
              <span className="l">Signed in as<span className="h">{platform.account.name}</span></span>
              <button className="btn" onClick={platform.account.signOut}>Sign out</button>
            </div>
            {platform.account.deleteAccount && <DeleteAccountRow onDelete={platform.account.deleteAccount} onExport={exportBackup} />}
          </div>
        )}
      </div>
    </div>
  );
}


function DeleteAccountRow({ onDelete, onExport }: { onDelete(password: string): Promise<string | null>; onExport(): void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <div className="grp-row">
        <span className="l">Delete account<span className="h">Removes your account and every application from the server</span></span>
        <button className="btn danger" onClick={() => setOpen(true)}>Delete account…</button>
      </div>
    );
  }
  return (
    <form
      className="grp-row"
      style={{ flexDirection: "column", alignItems: "stretch", gap: 10, padding: 14 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(await onDelete(password));
        setBusy(false);
      }}
    >
      <span style={{ fontWeight: 700, color: "var(--bad-ink)" }}>Delete your account for good?</span>
      <span className="small muted">
        This can't be undone. Your account and all of its applications are removed from the server right away.{" "}
        <button type="button" className="link" onClick={onExport}>Export a .jobtrack copy first</button> if you want to keep them.
      </span>
      <input className="field" type="password" placeholder="Your password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required aria-label="Your password" />
      {error && <div className="notice bad" role="alert">{error}</div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={() => { setOpen(false); setPassword(""); setError(null); }}>Cancel</button>
        <button type="submit" className="btn" disabled={busy || !password} style={{ background: "var(--bad-ink)", color: "#fff", borderColor: "transparent" }}>
          {busy ? "Deleting…" : "Delete forever"}
        </button>
      </div>
    </form>
  );
}
