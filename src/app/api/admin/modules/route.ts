export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id).single();
  return data?.role === "admin" ? user : null;
}

// GET /api/admin/modules — todos los módulos (admin only)
export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("module_config")
    .select("*")
    .order("sort_order");

  if (error) return NextResponse.json({ error: "Error al obtener módulos" }, { status: 500 });
  return NextResponse.json(data);
}
