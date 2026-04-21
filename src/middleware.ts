import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/auth/callback"];

// Cuando el app corre detrás de un proxy (Cloud Run, Vercel, etc.),
// request.nextUrl.origin puede ser la dirección interna (0.0.0.0:3000).
// Usamos x-forwarded-host / x-forwarded-proto para obtener la URL pública real.
function getPublicOrigin(request: NextRequest): string {
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    request.nextUrl.host;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0] ??
    request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: getUser() es vital para refrescar la sesión
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const origin = getPublicOrigin(request);

  // Lógica de Redirección
  if (!user && !PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", origin));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
