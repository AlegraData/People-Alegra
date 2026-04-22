import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    // Collect cookies that Supabase wants to set so we can attach them
    // directly to the redirect response (instead of relying on next/headers).
    const cookieSetters: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach((c) => cookieSetters.push(c));
          },
        },
      }
    );

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      // Registrar / actualizar el usuario en user_roles
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: existing } = await supabaseAdmin
            .from("user_roles")
            .select("id")
            .eq("user_id", user.id)
            .single();

          if (!existing) {
            await supabaseAdmin.from("user_roles").insert({
              user_id:    user.id,
              email:      user.email!,
              full_name:  user.user_metadata?.full_name  ?? null,
              avatar_url: user.user_metadata?.avatar_url ?? null,
              role:       "viewer",
            });
          } else {
            await supabaseAdmin
              .from("user_roles")
              .update({
                full_name:  user.user_metadata?.full_name  ?? null,
                avatar_url: user.user_metadata?.avatar_url ?? null,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", user.id);
          }
        }
      } catch {
        // Si falla el registro en user_roles no bloqueamos el login
      }

      // Usar x-forwarded-host para obtener la URL pública correcta detrás de proxies
      const host =
        request.headers.get("x-forwarded-host") ??
        request.headers.get("host") ??
        request.nextUrl.host;
      const proto =
        request.headers.get("x-forwarded-proto")?.split(",")[0] ??
        request.nextUrl.protocol.replace(":", "");
      const publicOrigin = `${proto}://${host}`;

      const redirectUrl = new URL(next, publicOrigin);

      const response = NextResponse.redirect(redirectUrl);

      // Adjuntar las cookies de sesión a la respuesta de redirección
      cookieSetters.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
      });

      return response;
    }
  }

  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    request.nextUrl.host;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0] ??
    request.nextUrl.protocol.replace(":", "");

  // Redirigir al login con el mensaje de error y preservando next para reintento
  const errUrl = new URL("/login", `${proto}://${host}`);
  errUrl.searchParams.set("error", "auth_callback_error");
  if (next && next !== "/") errUrl.searchParams.set("next", next);
  return NextResponse.redirect(errUrl);
}
