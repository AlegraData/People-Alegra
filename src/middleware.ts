import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas que NO requieren autenticación
const PUBLIC_ROUTES = ["/login", "/auth/callback"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Dejar pasar rutas públicas sin verificar sesión
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() refresca el token si hace falta y valida la sesión
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Sin sesión → redirigir al login
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    const redirectResponse = NextResponse.redirect(loginUrl);
    
    // IMPORTANTE: Copiar las cookies (ej. limpieza de sesión) al nuevo response
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });

    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Aplica el middleware a todas las rutas excepto:
     * - _next/static  (archivos estáticos de Next.js)
     * - _next/image   (optimización de imágenes)
     * - favicon.ico
     * - archivos de imagen públicos
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
