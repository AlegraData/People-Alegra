import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

const VALID_SORT_FIELDS = ["nombre_completo", "equipo", "cargo", "fecha_original"] as const;
type SortField = (typeof VALID_SORT_FIELDS)[number];

// GET: Lista paginada, filtrada y ordenada de empleados activos
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page       = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSizeRaw = searchParams.get("pageSize") ?? "25";
    const search     = searchParams.get("search")?.trim() ?? "";
    const sortByRaw  = searchParams.get("sortBy") ?? "nombre_completo";
    const sortDir    = searchParams.get("sortDir") === "desc" ? "desc" : "asc";

    const isAll    = pageSizeRaw === "all";
    const pageSize = isAll ? 0 : Math.min(100, parseInt(pageSizeRaw) || 25);
    const sortBy: SortField = VALID_SORT_FIELDS.includes(sortByRaw as SortField)
      ? (sortByRaw as SortField)
      : "nombre_completo";

    // 1. Consultar la vista con filtros, orden y paginación
    let query = supabaseAdmin
      .from("v_empleados_activos_completa")
      .select("*", { count: "exact" });

    if (search) {
      query = query.or(
        `nombre_completo.ilike.%${search}%,correo.ilike.%${search}%,equipo.ilike.%${search}%,cargo.ilike.%${search}%`
      );
    }

    query = query.order(sortBy, { ascending: sortDir === "asc", nullsFirst: false });

    if (!isAll) {
      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);
    }

    const { data: viewData, count, error: viewError } = await query;

    if (viewError) {
      console.error("[GET /api/empleados] vista:", viewError);
      return NextResponse.json({ error: "Error al consultar empleados" }, { status: 500 });
    }

    // 2. Enriquecer con el UUID interno de cada empleado (requerido para las asignaciones)
    const emails = (viewData ?? []).map((e) => e.correo as string);
    const { data: employeeRows } = emails.length
      ? await supabaseAdmin.from("employees").select("id, email").in("email", emails)
      : { data: [] };

    const emailToId = new Map((employeeRows ?? []).map((e) => [e.email as string, e.id as string]));

    const enriched = (viewData ?? [])
      .map((emp) => ({ ...emp, employee_id: emailToId.get(emp.correo as string) ?? null }))
      .filter((emp) => emp.employee_id !== null);

    return NextResponse.json({
      data: enriched,
      total: count ?? 0,
      page,
      pageSize: isAll ? "all" : pageSize,
    });
  } catch (error) {
    console.error("[GET /api/empleados]", error);
    return NextResponse.json({ error: "Error interno al obtener empleados" }, { status: 500 });
  }
}
