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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const { id, requestId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const role = await getEffectiveRole(user.id);
    if (role !== "admin" && role !== "manager") {
      return NextResponse.json({ error: "Solo administradores pueden aprobar o rechazar" }, { status: 403 });
    }

    const body = await request.json();
    const { status: newStatus, adminNote } = body as { status: "approved" | "rejected"; adminNote?: string | null };
    if (!["approved", "rejected"].includes(newStatus)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Re-read inside transaction to prevent race condition
      const cr = await tx.evaluationChangeRequest.findUnique({ where: { id: requestId } });
      if (!cr || cr.evaluationId !== id) {
        throw Object.assign(new Error("not_found"), { code: "not_found" });
      }
      if (cr.status !== "pending") {
        throw Object.assign(new Error("already_reviewed"), { code: "already_reviewed" });
      }

      if (newStatus === "approved") {
        if (cr.action === "add") {
          // Create new assignment (ignore if already exists)
          await tx.evaluation360Assignment.create({
            data: {
              evaluationId:   cr.evaluationId,
              evaluatorEmail: cr.requestorEmail,
              evaluatorName:  cr.requestorName,
              evaluateeEmail: cr.targetEmail,
              evaluateeName:  cr.targetName,
              evaluationType: cr.targetType,
              status:         "pending",
            },
          }).catch((err: { code?: string }) => {
            if (err.code !== "P2002") throw err;
          });
        } else if (cr.action === "remove") {
          const assignment = await tx.evaluation360Assignment.findFirst({
            where: {
              evaluationId:   cr.evaluationId,
              evaluatorEmail: cr.requestorEmail,
              evaluateeEmail: cr.targetEmail,
              evaluationType: cr.targetType,
            },
          });
          if (assignment) {
            if (assignment.status === "submitted") {
              throw Object.assign(new Error("already_submitted"), { code: "already_submitted" });
            }
            await tx.evaluation360Assignment.delete({ where: { id: assignment.id } });
          }
        }
      }

      return tx.evaluationChangeRequest.update({
        where: { id: requestId },
        data: {
          status:     newStatus,
          adminNote:  adminNote?.trim() || null,
          reviewedBy: user.email,
          reviewedAt: new Date(),
        },
      });
    });

    // Fire-and-forget notification
    const evalRecord = await prisma.evaluation360.findUnique({
      where: { id },
      select: { title: true },
    });
    notifyChangeRequest({
      evaluationTitle: evalRecord?.title ?? id,
      requestorName:   updated.requestorName || updated.requestorEmail,
      requestorEmail:  updated.requestorEmail,
      action:          updated.action as "add" | "remove",
      targetName:      updated.targetName || updated.targetEmail,
      targetEmail:     updated.targetEmail,
      targetType:      updated.targetType,
      status:          newStatus,
      adminNote:       updated.adminNote,
      adminEmail:      user.email ?? undefined,
      reason:          updated.reason,
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "not_found")         return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    if (e.code === "already_reviewed")  return NextResponse.json({ error: "Esta solicitud ya fue revisada" }, { status: 409 });
    if (e.code === "already_submitted") return NextResponse.json({ error: "La evaluación ya fue enviada, no se puede quitar al evaluado" }, { status: 409 });
    console.error("[PATCH change-requests/requestId]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
