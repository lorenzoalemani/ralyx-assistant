import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.pathname;

  // DETECTOR DE EMERGENCIA: Si entra CUALQUIER cosa a la ruta del webhook, lo forzamos a escupir un log
  if (url.includes("webhook")) {
    console.log(`!!! ALERTA DETECTOR: Entró petición a ${url} con método ${request.method}`);
    
    // Si es un POST de WhatsApp, dejamos pasar limpio rompiendo cualquier otra lógica
    if (request.method === "POST") {
      return NextResponse.next();
    }
  }
  
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};