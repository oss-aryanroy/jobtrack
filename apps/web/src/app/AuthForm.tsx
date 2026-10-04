"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AppMark } from "@jobtrack/ui";
import type { FormState } from "./actions";

type Mode = "login" | "signup" | "recover";

const COPY: Record<Mode, { title: string; sub: string; submit: string }> = {
  login: { title: "Sign in to JobTrack", sub: "Pick up where you left off.", submit: "Sign in" },
  signup: { title: "Create your account", sub: "Just a username and a password. No email needed.", submit: "Create account" },
  recover: { title: "Reset your password", sub: "Use the recovery code you saved when you signed up.", submit: "Set new password" },
};

export function AuthForm({ mode, action }: { mode: Mode; action: (s: FormState, f: FormData) => Promise<FormState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [copied, setCopied] = useState(false);
  const copy = COPY[mode];

  if (state.recoveryCode) {
    return (
      <main className="setup">
        <div className="setup-card" role="dialog" aria-labelledby="rc-title">
          <h1 id="rc-title" style={{ margin: 0, fontSize: 24, letterSpacing: "-0.015em" }}>Save your recovery code</h1>
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            JobTrack doesn't ask for your email, so this code is the only way back in if you forget your password. It's shown once.
          </p>
          <div className="grp" style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 12 }}>
            <code style={{ flex: 1, fontSize: 22, fontWeight: 700, letterSpacing: "0.06em" }}>{state.recoveryCode}</code>
            <button
              className="btn"
              type="button"
              onClick={() => navigator.clipboard.writeText(state.recoveryCode!).then(() => setCopied(true))}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <a className="btn primary" style={{ height: 38, padding: "0 20px", fontSize: 14 }} href="/">I've saved it, open JobTrack</a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="setup">
      <form className="setup-card" action={formAction} style={{ maxWidth: 420 }}>
        <span className="app-icon"><AppMark size={56} /></span>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, letterSpacing: "-0.015em" }}>{copy.title}</h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>{copy.sub}</p>
        </div>
        <label className="small muted" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          Username
          <input className="field" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required defaultValue={state.username} autoFocus />
        </label>
        {mode === "recover" && (
          <label className="small muted" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            Recovery code
            <input className="field" name="code" autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} required placeholder="XXXX-XXXX-XXXX-XXXX" />
          </label>
        )}
        <label className="small muted" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {mode === "recover" ? "New password" : "Password"}
          <input className="field" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? undefined : 8} />
        </label>
        {state.error && <div className="notice bad" role="alert">{state.error}</div>}
        <button className="btn primary" type="submit" disabled={pending} style={{ height: 38, justifyContent: "center", fontSize: 14 }}>
          {pending ? "One moment…" : copy.submit}
        </button>
        <p className="small muted" style={{ margin: 0, display: "flex", gap: 14, justifyContent: "center" }}>
          {mode !== "login" && <Link href="/login">Sign in</Link>}
          {mode !== "signup" && <Link href="/signup">Create an account</Link>}
          {mode !== "recover" && <Link href="/recover">Forgot password</Link>}
        </p>
        <p className="small muted" style={{ margin: "8px 0 0", textAlign: "center", lineHeight: 1.5 }}>
          Prefer to keep everything on your computer? The Mac and Windows apps need no account.
        </p>
      </form>
    </main>
  );
}
