import { AuthForm } from "../AuthForm";
import { recover } from "../actions";

export const dynamic = "force-dynamic";

export default function Page() {
  return <AuthForm mode="recover" action={recover} />;
}
