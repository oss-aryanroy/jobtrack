import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "signed out" }, { status: 401 });
  const [records, settings] = await Promise.all([
    sql`select kind, id, data from records where user_id = ${user.id}`,
    sql<{ data: unknown }[]>`select data from user_settings where user_id = ${user.id}`,
  ]);
  return Response.json({ records, settings: settings[0]?.data ?? null }, { headers: { "Cache-Control": "no-store" } });
}
