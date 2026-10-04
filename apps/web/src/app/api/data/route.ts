import { type Dataset, emptyDataset, TABLES } from "@jobtrack/core";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "signed out" }, { status: 401 });
  const [records, settings] = await Promise.all([
    sql<{ kind: string; data: { id: string } }[]>`select kind, data from records where user_id = ${user.id}`,
    sql<{ data: Dataset["settings"] }[]>`select data from user_settings where user_id = ${user.id}`,
  ]);
  const dataset = emptyDataset();
  const tables = new Set<string>(TABLES);
  for (const r of records) if (tables.has(r.kind)) (dataset[r.kind as (typeof TABLES)[number]] as { id: string }[]).push(r.data);
  dataset.settings = { ...dataset.settings, ...(settings[0]?.data ?? {}) };
  return Response.json(dataset, { headers: { "Cache-Control": "no-store" } });
}
