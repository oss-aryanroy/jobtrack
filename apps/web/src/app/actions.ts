"use server";

import { redirect } from "next/navigation";
import { DEFAULT_KDF, type KdfParams, USERNAME_RULE, isAcceptableKdf, normalizeUsername } from "@jobtrack/core/vault";
import { sql } from "@/lib/db";
import { AUTH_KEY_RULE, WRAPPED_KEY_RULE, checkSecret, currentUser, endSession, hashSecret, startSession } from "@/lib/auth";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface NewKeys {
  authKey: string;
  recoveryAuth: string;
  wrappedKey: string;
  wrappedKeyRecovery: string;
  kdf: KdfParams;
}

const validKeys = (k: NewKeys) =>
  AUTH_KEY_RULE.test(k.authKey) &&
  AUTH_KEY_RULE.test(k.recoveryAuth) &&
  k.authKey !== k.recoveryAuth &&
  WRAPPED_KEY_RULE.test(k.wrappedKey) &&
  WRAPPED_KEY_RULE.test(k.wrappedKeyRecovery) &&
  isAcceptableKdf(k.kdf);

export async function kdfFor(usernameRaw: string): Promise<KdfParams> {
  const [row] = await sql<{ kdf: KdfParams }[]>`select kdf from users where username = ${normalizeUsername(usernameRaw)}`;
  return row?.kdf ?? DEFAULT_KDF;
}

export async function signUp(usernameRaw: string, keys: NewKeys): Promise<Result> {
  const username = normalizeUsername(usernameRaw);
  if (!USERNAME_RULE.test(username)) return { ok: false, error: "Usernames are 3–32 characters: letters, numbers, dots, dashes or underscores." };
  if (!validKeys(keys)) return { ok: false, error: "Something went wrong preparing your account. Try again." };
  const [authHash, recoveryHash] = await Promise.all([hashSecret(keys.authKey), hashSecret(keys.recoveryAuth)]);
  const inserted = await sql<{ id: string }[]>`
    insert into users (username, auth_hash, recovery_hash, wrapped_key, wrapped_key_recovery, kdf)
    values (${username}, ${authHash}, ${recoveryHash}, ${keys.wrappedKey}, ${keys.wrappedKeyRecovery}, ${sql.json(keys.kdf as never)})
    on conflict (username) do nothing returning id`;
  if (!inserted[0]) return { ok: false, error: "That username is taken. Try another." };
  await startSession(inserted[0].id);
  return { ok: true };
}

export async function logIn(usernameRaw: string, authKey: string): Promise<Result<{ wrappedKey: string }>> {
  const result = await checkSecret(normalizeUsername(usernameRaw), authKey, "auth");
  if (!result.ok) return result;
  await startSession(result.user.id);
  return { ok: true, wrappedKey: result.user.wrapped_key };
}

export async function beginRecovery(usernameRaw: string, recoveryAuth: string): Promise<Result<{ wrappedKeyRecovery: string }>> {
  const result = await checkSecret(normalizeUsername(usernameRaw), recoveryAuth, "recovery");
  if (!result.ok) return result;
  return { ok: true, wrappedKeyRecovery: result.user.wrapped_key_recovery };
}

export async function finishRecovery(usernameRaw: string, recoveryAuth: string, keys: NewKeys): Promise<Result> {
  if (!validKeys(keys)) return { ok: false, error: "Something went wrong resetting your password. Try again." };
  const result = await checkSecret(normalizeUsername(usernameRaw), recoveryAuth, "recovery");
  if (!result.ok) return result;
  const [authHash, recoveryHash] = await Promise.all([hashSecret(keys.authKey), hashSecret(keys.recoveryAuth)]);
  await sql.begin(async (tx) => {
    await tx`update users set auth_hash = ${authHash}, recovery_hash = ${recoveryHash}, wrapped_key = ${keys.wrappedKey},
      wrapped_key_recovery = ${keys.wrappedKeyRecovery}, kdf = ${tx.json(keys.kdf as never)} where id = ${result.user.id}`;
    await tx`delete from sessions where user_id = ${result.user.id}`;
  });
  await startSession(result.user.id);
  return { ok: true };
}

export async function deleteAccount(authKey: string): Promise<Result> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "You're signed out. Sign in again to delete your account." };
  const result = await checkSecret(user.username, authKey, "auth");
  if (!result.ok) return { ok: false, error: result.error.replace("That username and password don't match.", "That password isn't right.") };
  await sql`delete from users where id = ${user.id}`;
  await endSession();
  return { ok: true };
}

export async function logOut() {
  await endSession();
  redirect("/login");
}
