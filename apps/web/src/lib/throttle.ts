import "server-only";
import { headers } from "next/headers";
import { sql } from "./db";

const RULES = {
  ip: { max: 10, minutes: 15 },
  userIp: { max: 5, minutes: 15 },
  user: { max: 100, minutes: 60 },
  signup: { max: 5, minutes: 60 },
} as const;

type Scope = keyof typeof RULES;
export type Bucket = [Scope, string];

export async function clientIp(): Promise<string> {
  const h = await headers();
  if (!process.env.VERCEL && process.env.TRUST_PROXY_HEADERS !== "1") return "direct";
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export const loginBuckets = (username: string, ip: string): Bucket[] => [
  ["ip", ip],
  ["userIp", `${username}|${ip}`],
  ["user", username],
];

export async function minutesBlocked(buckets: Bucket[]): Promise<number> {
  let worst = 0;
  for (const [scope, key] of buckets) {
    const { max, minutes } = RULES[scope];
    const [row] = await sql<{ failures: number; window_start: Date }[]>`
      select failures, window_start from attempts where scope = ${scope} and key = ${key}`;
    if (!row || row.failures < max) continue;
    const left = Math.ceil((row.window_start.getTime() + minutes * 60_000 - Date.now()) / 60_000);
    worst = Math.max(worst, left);
  }
  return worst;
}

export async function count(buckets: Bucket[]) {
  for (const [scope, key] of buckets) {
    const interval = `${RULES[scope].minutes} minutes`;
    await sql`
      insert into attempts (scope, key, failures, window_start) values (${scope}, ${key}, 1, now())
      on conflict (scope, key) do update set
        failures = case when attempts.window_start < now() - ${interval}::interval then 1 else attempts.failures + 1 end,
        window_start = case when attempts.window_start < now() - ${interval}::interval then now() else attempts.window_start end`;
  }
  if (Math.random() < 0.02) await sql`delete from attempts where window_start < now() - interval '1 day'`;
}

export async function reset(buckets: Bucket[]) {
  for (const [scope, key] of buckets) await sql`delete from attempts where scope = ${scope} and key = ${key}`;
}

export const tooMany = (minutes: number) => `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
