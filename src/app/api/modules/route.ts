export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

const ROLE_RANK: Record<string, number> = { viewer: 0, manager: 1, admin: 2 };

// GET /api/modules — módulos activos y visibles para el rol del usuario
// Un módulo es visible si el rol efectivo del usuario (módulo > global) >= min_role del módulo
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json([], { status: 401 });

  const [{ data: roleData }, { data: moduleRolesData }, { data, error }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id).single(),
    supabaseAdmin.from("user_module_roles").select("module, role").eq("user_id", user.id),
    supabaseAdmin
      .from("module_config")
      .select("id, label, description, is_active, sort_order, min_role")
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  if (error) return NextResponse.json([], { status: 500 });

  const globalRank = ROLE_RANK[roleData?.role ?? "viewer"] ?? 0;
  const moduleRankMap: Record<string, number> = {};
  (moduleRolesData ?? []).forEach((mr) => {
    moduleRankMap[mr.module] = ROLE_RANK[mr.role] ?? 0;
  });

  const visible = (data ?? []).filter((m) => {
    const effectiveRank = moduleRankMap[m.id] ?? globalRank;
    return effectiveRank >= (ROLE_RANK[m.min_role ?? "viewer"] ?? 0);
  });

  return NextResponse.json(visible);
}
