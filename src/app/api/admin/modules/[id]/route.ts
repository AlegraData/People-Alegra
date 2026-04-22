export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

const VALID_MIN_ROLES = ["viewer", "manager", "admin"];

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id).single();
  return data?.role === "admin" ? user : null;
}

// PATCH /api/admin/modules/[id] — actualizar is_active y/o min_role
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.isActive !== undefined) update.is_active = Boolean(body.isActive);
  if (body.minRole !== undefined) {
    if (!VALID_MIN_ROLES.includes(body.minRole))
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    update.min_role = body.minRole;
  }

  const { data, error } = await supabaseAdmin
    .from("module_config")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Error al actualizar el módulo" }, { status: 500 });
  return NextResponse.json(data);
}
