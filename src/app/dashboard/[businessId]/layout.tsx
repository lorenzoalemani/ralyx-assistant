import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavLink } from "@/components/ui/NavLink";

export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", businessId)
    .single();
  if (!business) notFound();

  const navLinks = [
    { href: `/dashboard/${businessId}`,             label: "Productos"     },
    { href: `/dashboard/${businessId}/knowledge`,   label: "Conocimiento"  },
    { href: `/dashboard/${businessId}/whatsapp`,    label: "WhatsApp"      },
    { href: `/dashboard/${businessId}/assistant`,   label: "Asistente"     },
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-muted">
        <Link
          href="/dashboard"
          className="transition-colors hover:text-foreground"
        >
          Mis negocios
        </Link>
        <span>/</span>
        <span className="text-foreground">{business.name}</span>
      </nav>

      {/* Navegación interna */}
      <div className="mb-8 flex gap-1 border-b border-border">
        {navLinks.map(({ href, label }) => (
          <NavLink key={href} href={href} label={label} />
        ))}
      </div>

      {children}
    </div>
  );
} 