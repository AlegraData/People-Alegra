export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { getDescendantEmployees } from "@/lib/orgHierarchy";

// Autoservicio de LÍDER: sin chequeo de rol de módulo — el liderazgo se
// prueba con la jerarquía real (v_hc_activo_compartida), no con un rol de
// la app. Devuelve, agrupados por persona, los reportes YA ENVIADOS de todo
// el equipo descendente (todos los niveles) de quien hace la consulta.
//
// Filtro estricto server-side: solo se devuelve gente que SÍ está en el
// árbol real de subordinados Y que SÍ tiene al menos un reporte con
// status:"sent" — nunca la lista completa del equipo con un flag
// "tiene reporte o no". Selección explícita de columnas: nunca se expone
// `status` (podría no ser "sent" en otro registro de la misma persona) ni
// `error` (puede traer texto crudo de un fallo de envío, sin uso aquí).
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const team = await getDescendantEmployees(user.email);
    if (team.length === 0) {
      return NextResponse.json({ isLeader: false, members: [] });
    }

    const teamEmails = team.map((m) => m.correo);
    const sentReports = await prisma.evaluation360Report.findMany({
      where: { evaluateeEmail: { in: teamEmails }, status: "sent" },
      select: {
        evaluateeEmail: true,
        sentAt: true,
        evaluation: { select: { id: true, title: true } },
      },
      orderBy: { sentAt: "desc" },
    });

    const teamByEmail = new Map(team.map((m) => [m.correo, m]));
    const membersByEmail = new Map<string, {
      correo: string; nombre: string | null; cargo: string | null; technicalTeam: string | null;
      reports: { evaluationId: string; title: string; sentAt: string | null }[];
    }>();

    sentReports.forEach((r) => {
      const info = teamByEmail.get(r.evaluateeEmail);
      if (!info) return; // defensivo: nunca listar a alguien fuera del árbol real, aunque el email coincidiera por otra vía
      if (!membersByEmail.has(r.evaluateeEmail)) {
        membersByEmail.set(r.evaluateeEmail, {
          correo: info.correo, nombre: info.nombre, cargo: info.cargo, technicalTeam: info.technicalTeam,
          reports: [],
        });
      }
      membersByEmail.get(r.evaluateeEmail)!.reports.push({
        evaluationId: r.evaluation.id,
        title: r.evaluation.title,
        sentAt: r.sentAt ? r.sentAt.toISOString() : null,
      });
    });

    return NextResponse.json({
      isLeader: true,
      members: [...membersByEmail.values()].sort((a, b) => (a.nombre ?? a.correo).localeCompare(b.nombre ?? b.correo)),
    });
  } catch (error) {
    console.error("[GET my-team-reports]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
