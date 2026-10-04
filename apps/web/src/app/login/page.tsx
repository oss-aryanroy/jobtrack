import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AuthForm } from "../AuthForm";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  if (await currentUser()) redirect("/");
  const { deleted } = await searchParams;
  return <AuthForm mode="login" notice={deleted ? "Your account and all of its data were deleted." : undefined} />;
}
