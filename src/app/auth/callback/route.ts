import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Registrar / actualizar el usuario en user_roles
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: existing } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (!existing) {
          // Primer login: crear registro con rol viewer por defecto
          await supabaseAdmin.from("user_roles").insert({
            user_id:    user.id,
            email:      user.email!,
            full_name:  user.user_metadata?.full_name  ?? null,
            avatar_url: user.user_metadata?.avatar_url ?? null,
            role:       "viewer",
          });
        } else {
          // Logins posteriores: refrescar nombre y avatar sin tocar el rol
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

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Si hay error, volver al login
  return NextResponse.redirect(`${origin}/login`);
}
