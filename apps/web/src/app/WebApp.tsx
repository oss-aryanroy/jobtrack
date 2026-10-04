"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { type Dataset, TABLES, emptyDataset } from "@jobtrack/core";
import { type Sealed, seal, unseal } from "@jobtrack/core/vault";
import { AppMark, JobTrackApp, type Platform, type Store, browserFiles } from "@jobtrack/ui";
import { forgetKeys, loadKey } from "@/lib/keystore";
import { unlock } from "@/lib/client-auth";
import { logOut } from "./actions";

async function call(input: string, init?: RequestInit) {
  const res = await fetch(input, { ...init, headers: { "content-type": "application/json" }, cache: "no-store" });
  if (res.status === 401) {
    location.href = "/login";
    throw new Error("Signed out");
  }
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Request failed");
  return res.json();
}

const signOut = async () => {
  await forgetKeys();
  await logOut();
};

export function WebApp({ username }: { username: string }) {
  const [key, setKey] = useState<CryptoKey | null | undefined>(undefined);
  useEffect(() => {
    loadKey(username).then((k) => setKey(k ?? null));
  }, [username]);
  if (key === undefined) return null;
  if (key === null) return <Unlock username={username} onUnlocked={setKey} />;
  return <Unlocked username={username} dataKey={key} />;
}

function Unlock({ username, onUnlocked }: { username: string; onUnlocked(k: CryptoKey): void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    setBusy(true);
    setError(null);
    try {
      const { wrappedKey, kdf } = await call("/api/key");
      const ok = await unlock(username, password, wrappedKey, kdf);
      const key = ok ? await loadKey(username) : undefined;
      if (key) onUnlocked(key);
      else setError("That password doesn't unlock this account.");
    } catch {
      setError("Couldn't reach JobTrack. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="setup">
      <form className="setup-card" onSubmit={submit} style={{ maxWidth: 420 }}>
        <span className="app-icon"><AppMark size={56} /></span>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, letterSpacing: "-0.015em" }}>Unlock your data</h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.5 }}>
            Signed in as <b>{username}</b>. Your applications are encrypted, so this browser needs your password once to read them.
          </p>
        </div>
        <label className="small muted" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          Password
          <input className="field" name="password" type="password" autoComplete="current-password" required autoFocus />
        </label>
        {error && <div className="notice bad" role="alert">{error}</div>}
        <button className="btn primary" type="submit" disabled={busy} style={{ height: 38, justifyContent: "center", fontSize: 14 }}>
          {busy ? "Unlocking…" : "Unlock"}
        </button>
        <p className="small muted" style={{ margin: 0, display: "flex", gap: 14, justifyContent: "center" }}>
          <a href="/recover">Forgot password</a>
          <button type="button" className="link" style={{ fontWeight: 400 }} onClick={signOut}>Sign out</button>
        </p>
      </form>
    </main>
  );
}

type Table = (typeof TABLES)[number];

function Unlocked({ username, dataKey }: { username: string; dataKey: CryptoKey }) {
  const store = useMemo<Store>(
    () => ({
      async load() {
        const { records, settings } = (await call("/api/data")) as { records: { kind: Table; id: string; data: Sealed }[]; settings: Sealed | null };
        const dataset = emptyDataset();
        let unreadable = 0;
        await Promise.all(
          records.map(async (r) => {
            try {
              (dataset[r.kind] as { id: string }[]).push(await unseal(dataKey, r.data, `${r.kind}:${r.id}`));
            } catch {
              unreadable++;
            }
          }),
        );
        if (settings) dataset.settings = { ...dataset.settings, ...(await unseal<Dataset["settings"]>(dataKey, settings, "settings").catch(() => ({}))) };
        if (unreadable) console.warn(`${unreadable} records couldn't be decrypted and were skipped.`);
        return dataset;
      },
      async save(diff) {
        const upserts: Record<string, { id: string; iv: string; ct: string }[]> = {};
        for (const [table, rows] of Object.entries(diff.upserts) as [Table, { id: string }[]][]) {
          upserts[table] = await Promise.all(rows.map(async (row) => ({ id: row.id, ...(await seal(dataKey, row, `${table}:${row.id}`)) })));
        }
        const settings = diff.settings ? await seal(dataKey, diff.settings, "settings") : undefined;
        await call("/api/changes", { method: "POST", body: JSON.stringify({ upserts, deletes: diff.deletes, settings }) });
      },
    }),
    [dataKey],
  );
  const platform = useMemo<Platform>(() => {
    const onboarded = `jobtrack.onboarded.${username}`;
    const ua = navigator.userAgent;
    return {
      kind: "web",
      os: /Mac|iPhone|iPad/.test(ua) ? "mac" : /Windows/.test(ua) ? "windows" : "other",
      ...browserFiles,
      openUrl: (url) => window.open(url, "_blank", "noopener"),
      account: { name: username, signOut },
      isFirstRun: () => {
        try {
          return localStorage.getItem(onboarded) !== "1";
        } catch {
          return false;
        }
      },
      markOnboarded: () => {
        try {
          localStorage.setItem(onboarded, "1");
        } catch {}
      },
    };
  }, [username]);
  return <JobTrackApp store={store} platform={platform} />;
}
