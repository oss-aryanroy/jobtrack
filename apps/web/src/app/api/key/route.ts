import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "signed out" }, { status: 401 });
  const [row] = await sql<{ wrapped_key: string; kdf: object }[]>`select wrapped_key, kdf from users where id = ${user.id}`;
  return Response.json({ wrappedKey: row?.wrapped_key, kdf: row?.kdf }, { headers: { "Cache-Control": "no-store" } });
}
