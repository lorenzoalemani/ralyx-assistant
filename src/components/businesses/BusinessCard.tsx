import Link from "next/link";
import { type Business } from "@/types/business";

export function BusinessCard({ business }: { business: Business }) {
  const initials = business.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const formattedDate = new Date(business.created_at).toLocaleDateString(
    "es-AR",
    { day: "numeric", month: "short", year: "numeric" }
  );

  return (
    <Link href={`/dashboard/${business.id}`}>
      <div className="group flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent/40 hover:bg-surface-hover cursor-pointer">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 font-display text-sm font-semibold text-accent">
          {initials}
        </div>

        <div className="flex flex-col gap-0.5">
          <p className="font-display font-semibold text-foreground leading-tight">
            {business.name}
          </p>
          <p className="text-xs text-muted">Creado el {formattedDate}</p>
        </div>
      </div>
    </Link>
  );
}