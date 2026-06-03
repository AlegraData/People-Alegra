export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

async function requirePeopleAdmin(userId: string) {
  const { data: roleData } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).single();
  const globalRole = roleData?.role ?? "viewer";
  const { data: moduleRoleData } = await supabaseAdmin
    .from("user_module_roles").select("role").eq("user_id", userId).eq("module", "people").single();
  return (moduleRoleData?.role ?? globalRole) === "admin";
}

// PUT: Editar título, descripción y preguntas de una encuesta
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!(await requirePeopleAdmin(user.id)))
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const {
      title, description, questions,
      introEnabled, introMessage, termsEnabled, termsText,
      emailSubject, emailBody, emailButtonText, emailFooter,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "El título es requerido" }, { status: 400 });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "Se requiere al menos una pregunta" }, { status: 400 });
    }

    const survey = await prisma.peopleSurvey.update({
      where: { id },
      data: {
        title: title.trim(),
        description: description?.trim() ?? "",
        questions,
        introEnabled: introEnabled ?? true,
        introMessage: introMessage?.trim() || null,
        termsEnabled: termsEnabled ?? false,
        termsText: termsText?.trim() || null,
        emailSubject:    emailSubject?.trim()    || null,
        emailBody:       emailBody?.trim()       || null,
        emailButtonText: emailButtonText?.trim() || null,
        emailFooter:     emailFooter?.trim()     || null,
      },
    });

    return NextResponse.json(survey);
  } catch (error) {
    console.error("[PUT /api/people/surveys/[id]]", error);
    return NextResponse.json({ error: "Error interno al actualizar la encuesta" }, { status: 500 });
  }
}

// PATCH: Cambiar estado isActive (Finalizar / Reabrir)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!(await requirePeopleAdmin(user.id)))
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id } = await params;
    const { isActive } = await request.json();

    const survey = await prisma.peopleSurvey.update({
      where: { id },
      data: { isActive: Boolean(isActive) },
    });

    return NextResponse.json(survey);
  } catch (error) {
    console.error("[PATCH /api/people/surveys/[id]]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE: Eliminar encuesta (cascade)
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!(await requirePeopleAdmin(user.id)))
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id } = await params;

    await prisma.peopleSurveyResponse.deleteMany({ where: { surveyId: id } });
    await supabaseAdmin.from("people_survey_assignments").delete().eq("survey_id", id);
    await prisma.peopleSurvey.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/people/surveys/[id]]", error);
    return NextResponse.json({ error: "Error interno al eliminar la encuesta" }, { status: 500 });
  }
}
