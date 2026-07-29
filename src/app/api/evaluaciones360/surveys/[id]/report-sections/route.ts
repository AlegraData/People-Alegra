export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import type { CustomReportSection } from "@/types/evaluaciones360";

type Ctx = { params: Promise<{ id: string }> };

async function get360EffectiveRole(userId: string): Promise<string> {
  const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).single();
  const { data: modRoleData } = await supabaseAdmin
    .from("user_module_roles").select("role").eq("user_id", userId).eq("module", "360").single();
  return modRoleData?.role ?? roleData?.role ?? "viewer";
}

function isValidSections(value: unknown): value is CustomReportSection[] {
  if (!Array.isArray(value)) return false;
  return value.every((s) =>
    s && typeof s === "object" &&
    typeof (s as CustomReportSection).id === "string" &&
    typeof (s as CustomReportSection).name === "string" &&
    Array.isArray((s as CustomReportSection).entries) &&
    (s as CustomReportSection).entries.every((e) => typeof e.questionId === "string" && typeof e.weight === "number")
  );
}

// Guarda el arreglo completo de secciones personalizadas de análisis (ej.
// "Alineación Cultural") de una encuesta, gestionado desde Reportes → Configuración.
export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const effectiveRole = await get360EffectiveRole(user.id);
    if (!["admin", "manager"].includes(effectiveRole))
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const body = await request.json();
    const { reportSections } = body;
    if (!isValidSections(reportSections)) {
      return NextResponse.json({ error: "Formato de secciones inválido" }, { status: 400 });
    }

    const evaluation = await prisma.evaluation360.findUnique({ where: { id } });
    if (!evaluation) return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });

    const updated = await prisma.evaluation360.update({
      where: { id },
      data: { reportSections: reportSections as object },
    });

    return NextResponse.json({ reportSections: updated.reportSections });
  } catch (error) {
    console.error("[PUT surveys/:id/report-sections]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
