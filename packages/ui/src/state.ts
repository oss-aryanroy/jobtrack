import { useCallback, useEffect, useRef, useState } from "react";
import { type Dataset, type DatasetDiff, diffDatasets, isEmptyDiff } from "@jobtrack/core";

export interface Store {
  load(): Promise<Dataset>;
  save(diff: DatasetDiff): Promise<void>;
}

export interface Platform {
  kind: "desktop" | "web";
  os: "mac" | "windows" | "other";
  saveFile(bytes: Uint8Array, suggestedName: string, mime: string): Promise<void>;
  openFile(accept: string[]): Promise<{ name: string; bytes: Uint8Array } | null>;
  openUrl(url: string): void;
  notify?(title: string, body: string): void;
  account?: { name: string; signOut(): void };
  isFirstRun(): boolean;
  markOnboarded(): void;
}

export const browserFiles = {
  async saveFile(bytes: Uint8Array, suggestedName: string, mime: string) {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  openFile(accept: string[]) {
    return new Promise<{ name: string; bytes: Uint8Array } | null>((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept.join(",");
      input.onchange = async () => {
        const file = input.files?.[0];
        resolve(file ? { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) } : null);
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  },
};

const ONBOARDED = "jobtrack.onboarded";
export const localOnboarding = {
  isFirstRun: () => {
    try {
      return localStorage.getItem(ONBOARDED) !== "1";
    } catch {
      return false;
    }
  },
  markOnboarded: () => {
    try {
      localStorage.setItem(ONBOARDED, "1");
    } catch {}
  },
};

export interface Toast {
  text: string;
  undo?: boolean;
  tone?: "error";
}

const UNDO_LIMIT = 50;

export function useJobTrack(store: Store) {
  const [data, setData] = useState<Dataset | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const current = useRef<Dataset | null>(null);
  const history = useRef<Dataset[]>([]);
  const saving = useRef<Promise<void>>(Promise.resolve());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    store.load().then(
      (loaded) => {
        current.current = loaded;
        setData(loaded);
      },
      (err: unknown) => setLoadError(err instanceof Error ? err.message : "Couldn't open your data."),
    );
  }, [store]);

  const showToast = useCallback((t: Toast | null) => {
    clearTimeout(toastTimer.current);
    setToast(t);
    if (t) toastTimer.current = setTimeout(() => setToast(null), t.tone === "error" ? 8000 : 5000);
  }, []);

  const persist = useCallback(
    (prev: Dataset, next: Dataset) => {
      const diff = diffDatasets(prev, next);
      if (isEmptyDiff(diff)) return;
      saving.current = saving.current
        .then(() => store.save(diff))
        .catch(() => showToast({ text: "Couldn't save that change. Check your connection and try again.", tone: "error" }));
    },
    [store, showToast],
  );

  const apply = useCallback(
    (fn: (d: Dataset) => Dataset, message?: string) => {
      const prev = current.current;
      if (!prev) return;
      const next = fn(prev);
      if (next === prev) return;
      history.current = [...history.current.slice(-(UNDO_LIMIT - 1)), prev];
      current.current = next;
      setData(next);
      persist(prev, next);
      if (message) showToast({ text: message, undo: true });
    },
    [persist, showToast],
  );

  const undo = useCallback(() => {
    const prev = history.current.pop();
    const now = current.current;
    if (!prev || !now) return;
    current.current = prev;
    setData(prev);
    persist(now, prev);
    showToast({ text: "Undone" });
  }, [persist, showToast]);

  return { data, loadError, apply, undo, toast, showToast, canUndo: history.current.length > 0 };
}

export type JobTrack = ReturnType<typeof useJobTrack>;
