export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { notifyChangeRequest } from "@/lib/googleChat";

async function getEffectiveRole(userId: string): Promise<string> {
  const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).single();
  const globalRole = roleData?.role ?? "viewer";
  const { data: moduleRoleData } = await supabaseAdmin
    .from("user_module_roles").select("role").eq("user_id", userId).eq("module", "360").single();
  return (moduleRoleData?.role ?? globalRole) as string;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const role = await getEffectiveRole(user.id);
    const { searchParams } = new URL(request.url);
    const summaryOnly = searchParams.get("summary") === "true";

    if (role === "admin" || role === "manager") {
      if (summaryOnly) {
        const count = await prisma.evaluationChangeRequest.count({
          where: { evaluationId: id, status: "pending" },
        });
        return NextResponse.json({ pendingCount: count });
      }
      const requests = await prisma.evaluationChangeRequest.findMany({
        where: { evaluationId: id },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(requests);
    }

    // Viewer: only their own requests
    const requests = await prisma.evaluationChangeRequest.findMany({
      where: { evaluationId: id, requestorEmail: user.email! },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(requests);
  } catch (error) {
    console.error("[GET change-requests]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const evalRecord = await prisma.evaluation360.findUnique({ where: { id } });
    if (!evalRecord) return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });
    if (evalRecord.status !== "active") return NextResponse.json({ error: "La evaluación no está activa" }, { status: 400 });

    // Must be an evaluator in this evaluation
    const isEvaluator = await prisma.evaluation360Assignment.findFirst({
      where: { evaluationId: id, evaluatorEmail: user.email! },
    });
    if (!isEvaluator) return NextResponse.json({ error: "No eres evaluador en esta evaluación" }, { status: 403 });

    const body = await request.json();
    const { action, targetEmail, targetName, targetType, reason } = body;

    if (!["add", "remove"].includes(action)) return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
    if (!targetEmail?.trim()) return NextResponse.json({ error: "Email del evaluado requerido" }, { status: 400 });
    if (!targetType) return NextResponse.json({ error: "Tipo de evaluación requerido" }, { status: 400 });

    if (action === "add") {
      const existing = await prisma.evaluation360Assignment.findFirst({
        where: {
          evaluationId:   id,
          evaluatorEmail: user.email!,
          evaluateeEmail: targetEmail.trim().toLowerCase(),
          evaluationType: targetType,
        },
      });
      if (existing) {
        return NextResponse.json({ error: "Ya tienes a esa persona asignada con ese tipo de evaluación" }, { status: 409 });
      }
    }

    const { data: roleRow } = await supabaseAdmin.from("user_roles").select("full_name").eq("user_id", user.id).single();
    const requestorName = (roleRow?.full_name as string | null) ?? null;

    const cr = await prisma.evaluationChangeRequest.create({
      data: {
        evaluationId:   id,
        requestorEmail: user.email!,
        requestorName,
        action,
        targetEmail:    targetEmail.trim().toLowerCase(),
        targetName:     targetName?.trim() || null,
        targetType,
        reason:         reason?.trim() || null,
        status:         "pending",
      },
    });

    notifyChangeRequest({
      evaluationTitle: evalRecord.title,
      requestorName:   requestorName || user.email!,
      requestorEmail:  user.email!,
      action,
      targetName:      targetName?.trim() || targetEmail.trim(),
      targetEmail:     targetEmail.trim().toLowerCase(),
      targetType,
      status:          "pending",
      reason:          reason?.trim() || null,
    });

    return NextResponse.json(cr, { status: 201 });
  } catch (err: unknown) {
    const prismaErr = err as { code?: string };
    if (prismaErr.code === "P2002") {
      return NextResponse.json({ error: "Ya tienes una solicitud pendiente para esta persona y tipo" }, { status: 409 });
    }
    console.error("[POST change-requests]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
