import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthShell
      title="Bienvenido de nuevo"
      subtitle="Iniciá sesión para continuar con tu asistente."
      footer={
        <>
          ¿No tenés cuenta todavía?{" "}
          <Link
            href="/register"
            className="font-medium text-accent hover:text-accent-hover"
          >
            Creá una
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
