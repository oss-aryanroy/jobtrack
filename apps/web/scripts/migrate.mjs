import { readFile } from "node:fs/promises";
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) throw new Error("No database connected. Add Neon (or any Postgres) and set DATABASE_URL.");
const sql = postgres(url, { max: 1 });
await sql.unsafe(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
await sql.end();
console.log("schema up to date");
