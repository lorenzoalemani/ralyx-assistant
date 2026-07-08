import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Si la petición va al webhook de WhatsApp, la dejamos pasar directo sin tocar Supabase Auth
  if (request.nextUrl.pathname.startsWith("/api/webhook/whatsapp")) {
    return;
  }
  
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Corre en todas las rutas excepto archivos estáticos, assets y el webhook de WhatsApp
     */
    "/((?!_next/static|_next/image|favicon.ico|api/webhook/whatsapp|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};