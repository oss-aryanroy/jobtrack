import { type Platform, browserFiles, localOnboarding } from "@jobtrack/ui";

const inTauri = "__TAURI_INTERNALS__" in window;
const os: Platform["os"] = /Mac/i.test(navigator.platform) ? "mac" : /Win/i.test(navigator.platform) ? "windows" : "other";

const extensionsOf = (accept: string[]) => accept.filter((a) => a.startsWith(".")).map((a) => a.slice(1));

export const desktopPlatform: Platform = {
  kind: "desktop",
  os,
  ...localOnboarding,
  async saveFile(bytes, suggestedName, mime) {
    if (!inTauri) return browserFiles.saveFile(bytes, suggestedName, mime);
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const ext = suggestedName.split(".").pop() ?? "";
    const path = await save({ defaultPath: suggestedName, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
    if (path) await writeFile(path, bytes);
  },
  async openFile(accept) {
    if (!inTauri) return browserFiles.openFile(accept);
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const extensions = extensionsOf(accept);
    const path = await open({ multiple: false, directory: false, filters: extensions.length ? [{ name: "JobTrack", extensions }] : undefined });
    if (!path || Array.isArray(path)) return null;
    return { name: path.split(/[\\/]/).pop() ?? path, bytes: await readFile(path) };
  },
  openUrl(url) {
    if (!inTauri) {
      window.open(url, "_blank", "noopener");
      return;
    }
    import("@tauri-apps/plugin-opener").then(({ openUrl }) => openUrl(url));
  },
};
