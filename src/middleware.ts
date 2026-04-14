import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas que NO requieren autenticación
const PUBLIC_ROUTES = ["/login", "/auth/callback"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Crear una respuesta inicial
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 2. Configurar el cliente de Supabase
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
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 3. Validar la sesión
  const { data: { user } } = await supabase.auth.getUser();

  // 4. Lógica de redirección
  if (user && pathname === "/login") {
    // Si ya está logueado y va a /login -> al home
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!user && !PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    // Si NO está logueado y va a una ruta protegida -> al login
    const loginUrl = new URL("/login", request.url);
    const redirectResponse = NextResponse.redirect(loginUrl);
    
    // Copiar cookies de la sesión (limpieza si hubo error) al redirect
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
