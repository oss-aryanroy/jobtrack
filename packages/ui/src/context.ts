import { createContext, useContext } from "react";
import type { Dataset } from "@jobtrack/core";
import type { Platform, Toast } from "./state";

export const SCREENS = ["home", "applications", "board", "calendar", "followups", "interviews", "companies"] as const;
export type Screen = (typeof SCREENS)[number];
export interface Route {
  screen: Screen;
  id?: string;
}

export interface AppContextValue {
  data: Dataset;
  apply(fn: (d: Dataset) => Dataset, message?: string): void;
  undo(): void;
  platform: Platform;
  mod: string;
  route: Route;
  go(route: Route): void;
  openQuickAdd(text?: string): void;
  openSettings(): void;
  showToast(t: Toast | null): void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside JobTrackApp");
  return ctx;
}
