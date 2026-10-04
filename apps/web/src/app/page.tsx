import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { WebApp } from "./WebApp";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <WebApp username={user.username} />;
}
