import { AuthForm } from "../AuthForm";
import { signUp } from "../actions";

export const dynamic = "force-dynamic";

export default function Page() {
  return <AuthForm mode="signup" action={signUp} />;
}
