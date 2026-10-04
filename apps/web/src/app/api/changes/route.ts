import { TABLES, type Table } from "@jobtrack/core";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_ROW_BYTES = 64 * 1024;
const MAX_ROWS_PER_REQUEST = 80_000;
const MAX_RECORDS_PER_USER = 300_000;
const CHUNK = 1000;

type Row = { id: string };
const isTable = (t: string): t is Table => (TABLES as readonly string[]).includes(t);
const isRow = (r: unknown): r is Row =>
  typeof r === "object" && r !== null && !Array.isArray(r) && typeof (r as Row).id === "string" && (r as Row).id.length > 0 && (r as Row).id.length <= 100;

const bad = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return bad("cross-origin request refused", 403);
  const user = await currentUser();
  if (!user) return bad("signed out", 401);

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return bad("change too large", 413);
  let body: { upserts?: Record<string, unknown>; deletes?: Record<string, unknown>; settings?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return bad("invalid JSON");
  }

  const upserts: { kind: Table; id: string; data: Row }[] = [];
  const deletes: { kind: Table; ids: string[] }[] = [];
  for (const [kind, rows] of Object.entries(body.upserts ?? {})) {
    if (!isTable(kind) || !Array.isArray(rows)) return bad(`unknown table ${kind}`);
    for (const row of rows) {
      if (!isRow(row) || JSON.stringify(row).length > MAX_ROW_BYTES) return bad(`invalid row in ${kind}`);
      upserts.push({ kind, id: row.id, data: row });
    }
  }
  for (const [kind, ids] of Object.entries(body.deletes ?? {})) {
    if (!isTable(kind) || !Array.isArray(ids) || !ids.every((id) => typeof id === "string")) return bad(`invalid delete in ${kind}`);
    deletes.push({ kind, ids: ids as string[] });
  }
  if (upserts.length + deletes.reduce((n, d) => n + d.ids.length, 0) > MAX_ROWS_PER_REQUEST) return bad("too many changes at once", 413);
  const settings = body.settings;
  if (settings !== undefined && (typeof settings !== "object" || settings === null || JSON.stringify(settings).length > 4096)) return bad("invalid settings");

  if (upserts.length) {
    const [row] = await sql<{ count: number }[]>`select count(*)::int as count from records where user_id = ${user.id}`;
    const count = row?.count ?? 0;
    if (count + upserts.length > MAX_RECORDS_PER_USER) return bad("account storage limit reached", 507);
  }

  await sql.begin(async (tx) => {
    for (let i = 0; i < upserts.length; i += CHUNK) {
      const chunk = upserts.slice(i, i + CHUNK).map((u) => ({ user_id: user.id, kind: u.kind, id: u.id, data: tx.json(u.data as never) }));
      await tx`insert into records ${tx(chunk, "user_id", "kind", "id", "data")}
        on conflict (user_id, kind, id) do update set data = excluded.data`;
    }
    for (const d of deletes) {
      for (let i = 0; i < d.ids.length; i += CHUNK) {
        await tx`delete from records where user_id = ${user.id} and kind = ${d.kind} and id = any(${d.ids.slice(i, i + CHUNK)})`;
      }
    }
    if (settings !== undefined) {
      await tx`insert into user_settings (user_id, data) values (${user.id}, ${tx.json(settings as never)})
        on conflict (user_id) do update set data = excluded.data`;
    }
  });
  return Response.json({ ok: true });
}
