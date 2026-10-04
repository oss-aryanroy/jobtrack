import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { JobTrackApp } from "@jobtrack/ui";
import "@jobtrack/ui/styles.css";
import { createLocalStore } from "./store";
import { desktopPlatform } from "./platform";

const store = createLocalStore();
if ("__TAURI_INTERNALS__" in window && desktopPlatform.os === "mac") document.documentElement.dataset.shell = "mac";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <JobTrackApp store={store} platform={desktopPlatform} />
  </StrictMode>,
);
