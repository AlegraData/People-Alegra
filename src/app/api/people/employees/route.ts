export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

export interface EmployeeOption {
  employee_id: string;
  email: string;
  nombre_completo: string;
  cargo: string | null;
  equipo: string | null;
  avatar_url: string | null;
}

// GET /api/people/employees — lista de empleados activos con nombre y avatar
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json([], { status: 401 });

    // 1. Empleados con su info personal y cargo/equipo actuales
    const { data: employees, error } = await supabaseAdmin
      .from("employees")
      .select(`
        id,
        email,
        employee_personal_info!inner(nombres, primer_apellido, segundo_apellido, es_actual),
        employee_events(role_name, technical_team, es_actual)
      `);

    if (error || !employees) return NextResponse.json([]);

    // 2. Avatares desde user_roles (vinculado por email)
    const emails = employees.map((e: any) => e.email as string);
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("email, avatar_url")
      .in("email", emails);

    const avatarMap = new Map<string, string | null>(
      (userRoles ?? []).map((r: any) => [r.email as string, r.avatar_url as string | null])
    );

    // 3. Construir respuesta
    const result: EmployeeOption[] = employees
      .map((e: any) => {
        const infoList = (e.employee_personal_info ?? []) as any[];
        const info = infoList.find((i) => i.es_actual) ?? infoList[0];
        if (!info) return null;

        const nombre_completo = [info.nombres, info.primer_apellido, info.segundo_apellido]
          .filter(Boolean).join(" ").trim();

        const eventList = (e.employee_events ?? []) as any[];
        const event = eventList.find((ev: any) => ev.es_actual) ?? eventList[0];

        return {
          employee_id:     e.id as string,
          email:           e.email as string,
          nombre_completo: nombre_completo || e.email,
          cargo:           (event?.role_name as string) ?? null,
          equipo:          (event?.technical_team as string) ?? null,
          avatar_url:      avatarMap.get(e.email) ?? null,
        };
      })
      .filter(Boolean) as EmployeeOption[];

    // Ordenar por nombre
    result.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/people/employees]", error);
    return NextResponse.json([]);
  }
}
