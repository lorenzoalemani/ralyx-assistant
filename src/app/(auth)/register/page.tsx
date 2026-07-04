import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Creá tu cuenta"
      subtitle="Empezá a usar RalyxAssistant en segundos."
      footer={
        <>
          ¿Ya tenés cuenta?{" "}
          <Link
            href="/login"
            className="font-medium text-accent hover:text-accent-hover"
          >
            Iniciá sesión
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
