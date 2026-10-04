"use server";

import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import {
  USERNAME_RULE,
  checkLogin,
  checkPassword,
  endSession,
  hashSecret,
  newRecoveryCode,
  normalizeUsername,
  startSession,
  verifySecret,
} from "@/lib/auth";

export interface FormState {
  error?: string;
  recoveryCode?: string;
  username?: string;
}

const field = (form: FormData, name: string) => String(form.get(name) ?? "");
const recoveryKey = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const username = normalizeUsername(field(form, "username"));
  const password = field(form, "password");
  if (!USERNAME_RULE.test(username)) {
    return { error: "Usernames are 3–32 characters: letters, numbers, dots, dashes or underscores.", username };
  }
  const pwError = checkPassword(password);
  if (pwError) return { error: pwError, username };
  const recoveryCode = newRecoveryCode();
  const [passwordHash, recoveryHash] = await Promise.all([hashSecret(password), hashSecret(recoveryKey(recoveryCode))]);
  const inserted = await sql<{ id: string }[]>`
    insert into users (username, password_hash, recovery_hash) values (${username}, ${passwordHash}, ${recoveryHash})
    on conflict (username) do nothing returning id`;
  if (!inserted[0]) return { error: "That username is taken. Try another.", username };
  await startSession(inserted[0].id);
  return { recoveryCode, username };
}

export async function logIn(_: FormState, form: FormData): Promise<FormState> {
  const username = field(form, "username");
  const result = await checkLogin(username, field(form, "password"));
  if (!result.ok) return { error: result.error, username };
  await startSession(result.userId);
  redirect("/");
}

export async function recover(_: FormState, form: FormData): Promise<FormState> {
  const username = normalizeUsername(field(form, "username"));
  const code = recoveryKey(field(form, "code"));
  const password = field(form, "password");
  const pwError = checkPassword(password);
  if (pwError) return { error: pwError, username };
  const [user] = await sql<{ id: string; recovery_hash: string }[]>`select id, recovery_hash from users where username = ${username}`;
  if (!user || !(await verifySecret(code, user.recovery_hash))) {
    return { error: "That username and recovery code don't match.", username };
  }
  const recoveryCode = newRecoveryCode();
  const [passwordHash, recoveryHash] = await Promise.all([hashSecret(password), hashSecret(recoveryKey(recoveryCode))]);
  await sql.begin(async (tx) => {
    await tx`update users set password_hash = ${passwordHash}, recovery_hash = ${recoveryHash}, failed_logins = 0, locked_until = null where id = ${user.id}`;
    await tx`delete from sessions where user_id = ${user.id}`;
  });
  await startSession(user.id);
  return { recoveryCode, username };
}

export async function logOut() {
  await endSession();
  redirect("/login");
}
