import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/auth/callback"];

const MODULE_PATH_TO_ID: Record<string, string> = {
  "/enps": "enps",
  "/clima": "clima",
  "/evaluaciones360": "360",
};

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

// Elimina todas las cookies de sesión de Supabase de una respuesta
function clearSupabaseCookies(response: NextResponse, request: NextRequest) {
  request.cookies.getAll().forEach((cookie) => {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.delete(cookie.name);
    }
  });
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { pathname } = request.nextUrl;
  const origin = getPublicOrigin(request);
  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  // getUser() refresca la sesión si es necesario
  const { data: { user }, error } = await supabase.auth.getUser();

  // Token inválido o expirado: limpiar cookies y redirigir a login
  if (error && !isPublic) {
    const response = NextResponse.redirect(new URL("/login", origin));
    clearSupabaseCookies(response, request);
    return response;
  }

  if (!user && !isPublic) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    const next = request.nextUrl.searchParams.get("next");
    const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    return NextResponse.redirect(new URL(dest, origin));
  }

  // Block access to modules that are inactive in module_config
  if (user) {
    const moduleId = Object.entries(MODULE_PATH_TO_ID).find(
      ([path]) => pathname === path || pathname.startsWith(path + "/")
    )?.[1];

    if (moduleId) {
      // Use the service role key so this query bypasses RLS on module_config,
      // matching the same access level used by /api/home (supabaseAdmin).
      // Plain fetch works in both Edge and Node.js runtimes.
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/module_config?id=eq.${moduleId}&select=is_active`,
          {
            headers: {
              apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
              Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`,
              Accept: "application/json",
            },
            cache: "no-store",
          }
        );
        if (res.ok) {
          const rows: Array<{ is_active: boolean }> = await res.json();
          if (rows[0]?.is_active === false) {
            return NextResponse.redirect(new URL("/", origin));
          }
        }
      } catch {
        // Fail open: transient error should not lock users out
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
