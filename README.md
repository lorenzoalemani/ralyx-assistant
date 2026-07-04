# RalyxAssistant

## Etapa 1 — Setup, autenticación y estructura base

### Cómo correrlo

```bash
npm install
cp .env.local.example .env.local
# completá .env.local con tu URL y anon key de Supabase (Project Settings > API)
npm run dev
```

Abrí http://localhost:3000 — te va a redirigir a `/login` si no estás autenticado, o a `/dashboard` si ya tenés sesión.

### Configuración necesaria en Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. En **Authentication > Providers**, confirmá que **Email** esté habilitado.
3. En **Authentication > URL Configuration**, agregá `http://localhost:3000/auth/callback` como Redirect URL (y la URL de producción cuando la tengas).
4. Copiá `Project URL` y `anon public key` a tu `.env.local`.

### Estructura de carpetas

```
src/
  app/
    (auth)/
      login/page.tsx        # Pantalla de login
      register/page.tsx     # Pantalla de registro
    auth/
      callback/route.ts     # Confirma el email y crea la sesión
      sign-out/route.ts     # Cierra sesión
    dashboard/page.tsx       # Ruta protegida (ejemplo mínimo)
    layout.tsx
    page.tsx                 # Redirige según estado de sesión
  components/
    auth/                    # AuthShell, LoginForm, RegisterForm
    ui/                      # Input, Button, FormError (genéricos)
  lib/
    supabase/
      client.ts              # Cliente para Client Components
      server.ts               # Cliente para Server Components / Route Handlers
      middleware.ts           # Refresca sesión + protege rutas
  middleware.ts
  types/
```

### Qué hace el middleware

En cada request, refresca el token de sesión de Supabase y:
- Si entrás a `/dashboard` sin sesión, te redirige a `/login`.
- Si entrás a `/login` o `/register` con sesión activa, te redirige a `/dashboard`.

Esto es lo que mantiene al usuario autenticado entre navegaciones sin lógica manual.
