import { redirect } from "next/navigation";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";
import { getCurrentLocale, getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (sessionUser !== null) {
    redirect("/");
  }

  const locale = await getCurrentLocale();
  const params = await searchParams;
  const messages = {
    en: enMessages.Login,
    es: esMessages.Login
  };

  return (
    <main id="main-content" className="mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center">
      <LoginForm initialLocale={locale} nextPath={params.next ?? "/"} errorCode={params.error} messages={messages} />
    </main>
  );
}
