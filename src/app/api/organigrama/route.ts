export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

export interface OrgEmployee {
  id: string;
  email: string;
  nombre_completo: string;
  cargo: string | null;
  equipo: string | null;
  avatar_url: string | null;
  es_activo: boolean;
}

export interface OrgRelation {
  employee_id: string;
  leader_id: string;
}

export interface OrgData {
  employees: OrgEmployee[];
  relations: OrgRelation[];
}

// GET /api/organigrama — nodos y relaciones para el organigrama
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({}, { status: 401 });

    // 1. Relaciones activas de liderazgo
    const { data: relations, error: relErr } = await supabaseAdmin
      .from("employee_leadership")
      .select("employee_id, leader_id")
      .eq("es_actual", true);

    if (relErr || !relations) return NextResponse.json({ employees: [], relations: [] });

    // 2. IDs únicos de todos los involucrados (empleados + líderes)
    const allIds = Array.from(new Set([
      ...relations.map((r) => r.employee_id),
      ...relations.map((r) => r.leader_id),
    ]));

    if (allIds.length === 0) return NextResponse.json({ employees: [], relations: [] });

    // 3. Info de cada empleado: nombre, cargo, equipo
    const { data: emps } = await supabaseAdmin
      .from("employees")
      .select(`
        id,
        email,
        employee_personal_info!inner(nombres, primer_apellido, segundo_apellido, es_actual),
        employee_events(role_name, technical_team, es_actual)
      `)
      .in("id", allIds);

    // 4. Avatares desde user_roles
    const emails = (emps ?? []).map((e: any) => e.email as string);
    const { data: userRoles } = emails.length
      ? await supabaseAdmin.from("user_roles").select("email, avatar_url").in("email", emails)
      : { data: [] };

    const avatarMap = new Map((userRoles ?? []).map((r: any) => [r.email as string, r.avatar_url as string | null]));

    // 5. Construir lista de empleados enriquecida
    const employees: OrgEmployee[] = (emps ?? []).map((e: any) => {
      const infoList = (e.employee_personal_info ?? []) as any[];
      const info = infoList.find((i) => i.es_actual) ?? infoList[0];
      const nombre_completo = info
        ? [info.nombres, info.primer_apellido, info.segundo_apellido].filter(Boolean).join(" ").trim()
        : e.email;

      const eventList = (e.employee_events ?? []) as any[];
      const event = eventList.find((ev: any) => ev.es_actual) ?? eventList[0];

      return {
        id:              e.id as string,
        email:           e.email as string,
        nombre_completo: nombre_completo || e.email,
        cargo:           (event?.role_name as string) ?? null,
        equipo:          (event?.technical_team as string) ?? null,
        avatar_url:      avatarMap.get(e.email) ?? null,
        es_activo:       !!event?.es_actual,
      };
    });

    return NextResponse.json({ employees, relations } as OrgData);
  } catch (error) {
    console.error("[GET /api/organigrama]", error);
    return NextResponse.json({ employees: [], relations: [] });
  }
}
