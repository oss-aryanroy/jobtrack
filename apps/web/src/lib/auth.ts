import "server-only";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { sql } from "./db";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SESSION_COOKIE = "jt_session";
const SESSION_DAYS = 30;
const MAX_FAILED = 5;

export const AUTH_KEY_RULE = /^[A-Za-z0-9+/]{43}=$/;
export const WRAPPED_KEY_RULE = /^[A-Za-z0-9+/]{16}\.[A-Za-z0-9+/=]{40,80}$/;

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(secret, salt, 32, SCRYPT);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [, saltB64, hashB64] = stored.split("$");
  if (!saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(secret, Buffer.from(saltB64, "base64"), expected.length, SCRYPT);
  return timingSafeEqual(actual, expected);
}

const DUMMY_HASH = `scrypt$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(32).toString("base64")}`;

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await sql`insert into sessions (token_hash, user_id, expires_at) values (${tokenHash(token)}, ${userId}, ${expires})`;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await sql`delete from sessions where token_hash = ${tokenHash(token)}`;
  jar.delete(SESSION_COOKIE);
}

export interface User {
  id: string;
  username: string;
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await sql<User[]>`
    select u.id, u.username from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${tokenHash(token)} and s.expires_at > now()`;
  return rows[0] ?? null;
}

interface UserRow {
  id: string;
  auth_hash: string;
  recovery_hash: string;
  wrapped_key: string;
  wrapped_key_recovery: string;
  failed_logins: number;
  locked_until: Date | null;
}

export type Check = { ok: true; user: UserRow } | { ok: false; error: string };

export async function checkSecret(username: string, secret: string, which: "auth" | "recovery"): Promise<Check> {
  const mismatch = which === "auth" ? "That username and password don't match." : "That username and recovery code don't match.";
  const [user] = await sql<UserRow[]>`
    select id, auth_hash, recovery_hash, wrapped_key, wrapped_key_recovery, failed_logins, locked_until
    from users where username = ${username}`;
  if (!user || !AUTH_KEY_RULE.test(secret)) {
    await verifySecret(secret, DUMMY_HASH);
    return { ok: false, error: mismatch };
  }
  if (user.locked_until && user.locked_until > new Date()) {
    const minutes = Math.ceil((user.locked_until.getTime() - Date.now()) / 60_000);
    return { ok: false, error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` };
  }
  if (!(await verifySecret(secret, which === "auth" ? user.auth_hash : user.recovery_hash))) {
    const failed = user.failed_logins + 1;
    const lockMinutes = failed >= MAX_FAILED ? Math.min(60, 2 ** (failed - MAX_FAILED)) : 0;
    await sql`update users set failed_logins = ${failed},
      locked_until = ${lockMinutes ? new Date(Date.now() + lockMinutes * 60_000) : null} where id = ${user.id}`;
    return { ok: false, error: mismatch };
  }
  await sql`update users set failed_logins = 0, locked_until = null where id = ${user.id}`;
  return { ok: true, user };
}
