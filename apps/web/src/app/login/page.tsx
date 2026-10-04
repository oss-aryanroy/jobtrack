import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AuthForm } from "../AuthForm";
import { logIn } from "../actions";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (await currentUser()) redirect("/");
  return <AuthForm mode="login" action={logIn} />;
}
