"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { AppMark } from "@jobtrack/ui";
import { USERNAME_RULE, normalizeUsername } from "@jobtrack/core/vault";
import { createAccount, recoverAccount, signIn } from "@/lib/client-auth";

type Mode = "login" | "signup" | "recover";

const COPY: Record<Mode, { title: string; sub: string; submit: string; busy: string }> = {
  login: { title: "Sign in to JobTrack", sub: "Pick up where you left off.", submit: "Sign in", busy: "Unlocking your data…" },
  signup: { title: "Create your account", sub: "Just a username and a password. No email needed.", submit: "Create account", busy: "Securing your account…" },
  recover: { title: "Reset your password", sub: "Use the recovery code you saved when you signed up.", submit: "Set new password", busy: "Unlocking with your code…" },
};

export function AuthForm({ mode, notice }: { mode: Mode; notice?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copy = COPY[mode];

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const username = normalizeUsername(String(form.get("username") ?? ""));
    const password = String(form.get("password") ?? "");
    setError(null);
    if (mode !== "login" && !USERNAME_RULE.test(username)) {
      setError("Usernames are 3–32 characters: letters, numbers, dots, dashes or underscores.");
      return;
    }
    if (mode !== "login" && password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    setBusy(true);
    try {
      const result =
        mode === "login"
          ? await signIn(username, password)
          : mode === "signup"
            ? await createAccount(username, password)
            : await recoverAccount(username, String(form.get("code") ?? ""), password);
      if (!result.ok) setError(result.error);
      else if (result.recoveryCode) setRecoveryCode(result.recoveryCode);
      else location.href = "/";
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (recoveryCode) {
    return (
      <main className="setup">
        <div className="setup-card" role="dialog" aria-labelledby="rc-title">
          <h1 id="rc-title" style={{ margin: 0, fontSize: 24, letterSpacing: "-0.015em" }}>Save your recovery code</h1>
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            Your applications are encrypted with your password, so nobody else can read them, including whoever runs this site. If you forget your password, this code is the only way to unlock them. It's shown once.
          </p>
          <div className="grp" style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 12 }}>
            <code style={{ flex: 1, fontSize: 22, fontWeight: 700, letterSpacing: "0.06em" }}>{recoveryCode}</code>
            <button className="btn" type="button" onClick={() => navigator.clipboard.writeText(recoveryCode).then(() => setCopied(true))}>
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
      <form className="setup-card" onSubmit={submit} style={{ maxWidth: 420 }}>
        <span className="app-icon"><AppMark size={56} /></span>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, letterSpacing: "-0.015em" }}>{copy.title}</h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>{copy.sub}</p>
        </div>
        {notice && <div className="notice" role="status">{notice}</div>}
        <label className="small muted" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          Username
          <input className="field" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus />
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
        {error && <div className="notice bad" role="alert">{error}</div>}
        <button className="btn primary" type="submit" disabled={busy} style={{ height: 38, justifyContent: "center", fontSize: 14 }}>
          {busy ? copy.busy : copy.submit}
        </button>
        <p className="small muted" style={{ margin: 0, display: "flex", gap: 14, justifyContent: "center" }}>
          {mode !== "login" && <Link href="/login">Sign in</Link>}
          {mode !== "signup" && <Link href="/signup">Create an account</Link>}
          {mode !== "recover" && <Link href="/recover">Forgot password</Link>}
          <Link href="/privacy">Privacy</Link>
        </p>
        <p className="small muted" style={{ margin: "8px 0 0", textAlign: "center", lineHeight: 1.5 }}>
          Your data is encrypted in your browser before it's saved. Prefer it never leaves your computer? The Mac and Windows apps need no account.
        </p>
      </form>
    </main>
  );
}
