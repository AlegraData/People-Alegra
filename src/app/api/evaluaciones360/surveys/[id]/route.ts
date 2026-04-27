export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const evaluation = await prisma.evaluation360.findUnique({ where: { id } });
    if (!evaluation) return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });

    const [allCount, submittedCount] = await Promise.all([
      prisma.evaluation360Assignment.count({ where: { evaluationId: id } }),
      prisma.evaluation360Assignment.count({ where: { evaluationId: id, status: "submitted" } }),
    ]);

    return NextResponse.json({ ...evaluation, assignmentsCount: allCount, submittedCount });
  } catch (error) {
    console.error("[GET /api/evaluaciones360/surveys/[id]]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id).single();
    if (roleData?.role !== "admin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const body = await request.json();
    const {
      title, description, instructions, status,
      hasAscendente, hasDescendente, hasParalela, hasAutoevaluacion,
      weightAscendente, weightDescendente, weightParalela, weightAutoevaluacion,
      questions, emailSubject, emailBody, emailButtonText, emailFooter,
    } = body;

    const updated = await prisma.evaluation360.update({
      where: { id },
      data: {
        ...(title !== undefined       && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(instructions !== undefined && { instructions: instructions?.trim() || null }),
        ...(status !== undefined       && { status }),
        ...(hasAscendente !== undefined     && { hasAscendente }),
        ...(hasDescendente !== undefined    && { hasDescendente }),
        ...(hasParalela !== undefined       && { hasParalela }),
        ...(hasAutoevaluacion !== undefined && { hasAutoevaluacion }),
        ...(weightAscendente !== undefined     && { weightAscendente }),
        ...(weightDescendente !== undefined    && { weightDescendente }),
        ...(weightParalela !== undefined       && { weightParalela }),
        ...(weightAutoevaluacion !== undefined && { weightAutoevaluacion }),
        ...(questions !== undefined       && { questions }),
        ...(emailSubject !== undefined     && { emailSubject: emailSubject?.trim() || null }),
        ...(emailBody !== undefined        && { emailBody: emailBody?.trim() || null }),
        ...(emailButtonText !== undefined  && { emailButtonText: emailButtonText?.trim() || null }),
        ...(emailFooter !== undefined      && { emailFooter: emailFooter?.trim() || null }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/evaluaciones360/surveys/[id]]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id).single();
    if (roleData?.role !== "admin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    await prisma.evaluation360.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/evaluaciones360/surveys/[id]]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
