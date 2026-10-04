import { useCallback, useEffect, useMemo, useState } from "react";
import { bucketFollowUps } from "@jobtrack/core";
import { AppContext, type AppContextValue, type Route, type Screen } from "./context";
import { type Platform, type Store, useJobTrack } from "./state";
import { Icon, type IconName } from "./components/Icon";
import { QuickAdd } from "./components/QuickAdd";
import { SearchPalette } from "./components/SearchPalette";
import { SettingsSheet } from "./components/SettingsSheet";
import { Onboarding } from "./components/Onboarding";
import { HomeScreen } from "./screens/Home";
import { ApplicationsScreen } from "./screens/Applications";
import { BoardScreen } from "./screens/Board";
import { CalendarScreen } from "./screens/Calendar";
import { FollowUpsScreen } from "./screens/FollowUps";
import { InterviewsScreen } from "./screens/Interviews";
import { CompaniesScreen } from "./screens/Companies";

const NAV: { screen: Screen; icon: IconName; label: string }[] = [
  { screen: "home", icon: "home", label: "Home" },
  { screen: "applications", icon: "apps", label: "Applications" },
  { screen: "board", icon: "board", label: "Board" },
  { screen: "calendar", icon: "calendar", label: "Calendar" },
  { screen: "followups", icon: "bell", label: "Follow-ups" },
  { screen: "interviews", icon: "interview", label: "Interviews" },
  { screen: "companies", icon: "company", label: "Companies" },
];

const isTyping = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
};

function useTheme(appearance: "system" | "light" | "dark" | undefined) {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const dark = appearance === "dark" || (appearance !== "light" && media.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [appearance]);
}

export function JobTrackApp({ store, platform }: { store: Store; platform: Platform }) {
  const jt = useJobTrack(store);
  const [route, setRoute] = useState<Route>({ screen: "home" });
  const [quickAdd, setQuickAdd] = useState<{ text: string } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [onboarding, setOnboarding] = useState(() => platform.isFirstRun());
  const mod = platform.os === "mac" ? "⌘" : "Ctrl";
  useTheme(jt.data?.settings.appearance);

  const openQuickAdd = useCallback((text = "") => setQuickAdd({ text }), []);
  const anyOverlay = !!quickAdd || searchOpen || settingsOpen || onboarding;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const modDown = platform.os === "mac" ? e.metaKey : e.ctrlKey;
      const key = e.key.toLowerCase();
      if (modDown && key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      } else if (modDown && key === "n" && platform.kind === "desktop") {
        e.preventDefault();
        openQuickAdd();
      } else if (!modDown && !e.altKey && key === "n" && !isTyping(e) && !anyOverlay) {
        e.preventDefault();
        openQuickAdd();
      } else if (modDown && key === "z" && !e.shiftKey && !isTyping(e)) {
        e.preventDefault();
        jt.undo();
      } else if (modDown && key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [platform, openQuickAdd, jt, anyOverlay]);

  const value = useMemo<AppContextValue | null>(
    () =>
      jt.data && {
        data: jt.data,
        apply: jt.apply,
        undo: jt.undo,
        platform,
        mod,
        route,
        go: setRoute,
        openQuickAdd,
        openSettings: () => setSettingsOpen(true),
        showToast: jt.showToast,
      },
    [jt.data, jt.apply, jt.undo, jt.showToast, platform, mod, route, openQuickAdd],
  );

  if (jt.loadError) {
    return (
      <div className="empty" role="alert">
        <h2>JobTrack couldn't open your data</h2>
        <p>{jt.loadError}</p>
        <button className="btn primary" onClick={() => location.reload()}>Try again</button>
      </div>
    );
  }
  if (!value) return <div className="empty" aria-busy="true"><p>Opening JobTrack…</p></div>;

  const due = bucketFollowUps(value.data.followUps);
  const dueCount = due.overdue.length + due.today.length;
  const quickAddHint = platform.kind === "desktop" ? `${mod}N` : "N";

  return (
    <AppContext.Provider value={value}>
      <div className="jt">
        <nav className="rail" aria-label="Sections">
          <div className="rail-spacer" data-tauri-drag-region />
          <button className="add" aria-label={`Add a job (${quickAddHint})`} title={`Add a job (${quickAddHint})`} onClick={() => openQuickAdd()}>
            <Icon name="plus" size={20} />
          </button>
          {NAV.map((n) => (
            <button
              key={n.screen}
              className={route.screen === n.screen ? "on" : undefined}
              aria-label={n.screen === "followups" && dueCount ? `${n.label}, ${dueCount} due` : n.label}
              aria-current={route.screen === n.screen ? "page" : undefined}
              title={n.label}
              onClick={() => setRoute({ screen: n.screen })}
            >
              <Icon name={n.icon} size={20} stroke={1.6} />
              {n.screen === "followups" && dueCount > 0 && <span className="badge">{dueCount}</span>}
            </button>
          ))}
          <span className="grow" />
          <button aria-label="Search" title={`Search (${mod}K)`} onClick={() => setSearchOpen(true)}>
            <Icon name="search" size={20} stroke={1.6} />
          </button>
          <button aria-label="Settings" title={`Settings (${mod},)`} onClick={() => setSettingsOpen(true)}>
            <Icon name="settings" size={20} stroke={1.6} />
          </button>
        </nav>
        <div className="jt-inner">
          {route.screen === "home" && <HomeScreen />}
          {route.screen === "applications" && <ApplicationsScreen />}
          {route.screen === "board" && <BoardScreen />}
          {route.screen === "calendar" && <CalendarScreen />}
          {route.screen === "followups" && <FollowUpsScreen />}
          {route.screen === "interviews" && <InterviewsScreen />}
          {route.screen === "companies" && <CompaniesScreen />}
        </div>
      </div>
      {quickAdd && <QuickAdd initialText={quickAdd.text} onClose={() => setQuickAdd(null)} />}
      {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
      {onboarding && (
        <Onboarding
          onDone={() => {
            platform.markOnboarded();
            setOnboarding(false);
          }}
        />
      )}
      {jt.toast && (
        <div className="toast" role="status">
          <span>{jt.toast.text}</span>
          {jt.toast.undo && (
            <button className="btn" onClick={jt.undo}>
              Undo {mod}Z
            </button>
          )}
        </div>
      )}
    </AppContext.Provider>
  );
}
