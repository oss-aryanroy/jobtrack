"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dataset } from "@jobtrack/core";
import { JobTrackApp, type Platform, type Store, browserFiles } from "@jobtrack/ui";
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

export function WebApp({ username }: { username: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const store = useMemo<Store>(
    () => ({
      load: () => call("/api/data") as Promise<Dataset>,
      save: async (diff) => {
        await call("/api/changes", { method: "POST", body: JSON.stringify(diff) });
      },
    }),
    [],
  );
  const platform = useMemo<Platform>(() => {
    const key = `jobtrack.onboarded.${username}`;
    const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
    return {
      kind: "web",
      os: /Mac|iPhone|iPad/.test(ua) ? "mac" : /Windows/.test(ua) ? "windows" : "other",
      ...browserFiles,
      openUrl: (url) => window.open(url, "_blank", "noopener"),
      account: { name: username, signOut: () => logOut() },
      isFirstRun: () => {
        try {
          return localStorage.getItem(key) !== "1";
        } catch {
          return false;
        }
      },
      markOnboarded: () => {
        try {
          localStorage.setItem(key, "1");
        } catch {}
      },
    };
  }, [username]);
  if (!mounted) return null;
  return <JobTrackApp store={store} platform={platform} />;
}
