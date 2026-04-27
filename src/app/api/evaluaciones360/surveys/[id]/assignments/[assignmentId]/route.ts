export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";

type Ctx = { params: Promise<{ id: string; assignmentId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { assignmentId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const assignment = await prisma.evaluation360Assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    // Sólo el evaluador o un admin puede ver la asignación
    if (assignment.evaluatorEmail !== user.email) {
      const { supabaseAdmin } = await import("@/utils/supabase/admin");
      const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id).single();
      if (roleData?.role !== "admin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    return NextResponse.json(assignment);
  } catch (error) {
    console.error("[GET assignment]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH: auto-guardar borrador o completar (antes de enviar)
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { assignmentId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const assignment = await prisma.evaluation360Assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    if (assignment.evaluatorEmail !== user.email) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    if (assignment.status === "submitted") return NextResponse.json({ error: "Ya fue enviada" }, { status: 400 });

    const body = await request.json();
    const { draftAnswers, finalAnswers, status } = body;

    const now = new Date();
    const updated = await prisma.evaluation360Assignment.update({
      where: { id: assignmentId },
      data: {
        ...(draftAnswers !== undefined && { draftAnswers, savedAt: now }),
        ...(finalAnswers !== undefined && { finalAnswers }),
        ...(status !== undefined       && { status }),
        ...(status === "in_progress"   && { savedAt: now }),
        ...(status === "completed"     && { completedAt: now }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH assignment]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST: enviar definitivamente (status → submitted)
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { assignmentId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const assignment = await prisma.evaluation360Assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    if (assignment.evaluatorEmail !== user.email) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    if (assignment.status === "submitted") return NextResponse.json({ error: "Ya fue enviada" }, { status: 400 });

    const body = await request.json();
    const { finalAnswers } = body;
    if (!finalAnswers || Object.keys(finalAnswers).length === 0) {
      return NextResponse.json({ error: "No hay respuestas para enviar" }, { status: 400 });
    }

    const now = new Date();
    const updated = await prisma.evaluation360Assignment.update({
      where: { id: assignmentId },
      data: { finalAnswers, status: "submitted", completedAt: now, submittedAt: now },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[POST assignment submit]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
