export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { sendSurveyInvitation } from "@/lib/mailer";

type Ctx = { params: Promise<{ id: string }> };

async function get360EffectiveRole(userId: string): Promise<string> {
  const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).single();
  const { data: modRoleData } = await supabaseAdmin
    .from("user_module_roles").select("role").eq("user_id", userId).eq("module", "360").single();
  return modRoleData?.role ?? roleData?.role ?? "viewer";
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const effectiveRole = await get360EffectiveRole(user.id);
    if (!["admin", "manager"].includes(effectiveRole)) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const assignments = await prisma.evaluation360Assignment.findMany({
      where: { evaluationId: id },
      orderBy: [{ evaluateeEmail: "asc" }, { evaluationType: "asc" }],
    });

    // Enrich with avatar_url from user_roles
    const allEmails = [...new Set([
      ...assignments.map((a) => a.evaluateeEmail),
      ...assignments.map((a) => a.evaluatorEmail),
    ])];
    const { data: avatarRows } = allEmails.length > 0
      ? await supabaseAdmin.from("user_roles").select("email, avatar_url").in("email", allEmails)
      : { data: [] };
    const avatarMap = new Map(
      (avatarRows ?? []).map((r: { email: string; avatar_url: string | null }) => [r.email, r.avatar_url ?? null])
    );

    const enriched = assignments.map((a) => ({
      ...a,
      evaluateeAvatarUrl: avatarMap.get(a.evaluateeEmail) ?? null,
      evaluatorAvatarUrl: avatarMap.get(a.evaluatorEmail) ?? null,
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("[GET participants]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const effectiveRole = await get360EffectiveRole(user.id);
    if (effectiveRole !== "admin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const evaluation = await prisma.evaluation360.findUnique({ where: { id } });
    if (!evaluation) return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });

    const body = await request.json();
    const { participants, sendInvitation } = body as { participants: any[]; sendInvitation?: boolean };

    if (!Array.isArray(participants) || participants.length === 0) {
      return NextResponse.json({ error: "Sin participantes" }, { status: 400 });
    }

    // Collect emails that are missing name or team so we can enrich from the directory
    const needsLookup = new Set<string>();
    participants.forEach((p) => {
      if (!p.evaluatorName?.trim()) needsLookup.add(p.evaluatorEmail.trim().toLowerCase());
      if (!p.evaluateeName?.trim() || !p.team?.trim()) needsLookup.add(p.evaluateeEmail.trim().toLowerCase());
    });

    type EmpInfo = { name: string | null; team: string | null };
    const empMap = new Map<string, EmpInfo>();

    if (needsLookup.size > 0) {
      const emails = [...needsLookup];

      // Primary source: employee directory (has name + team)
      const { data: empRows } = await supabaseAdmin
        .from("v_empleados_activos_completa")
        .select("correo, nombre_completo, equipo")
        .in("correo", emails);
      (empRows ?? []).forEach((r: { correo: string; nombre_completo: string | null; equipo: string | null }) => {
        empMap.set(r.correo, { name: r.nombre_completo || null, team: r.equipo || null });
      });

      // Fallback: user_roles (has display name, no team)
      const stillMissing = emails.filter((e) => !empMap.has(e));
      if (stillMissing.length > 0) {
        const { data: roleRows } = await supabaseAdmin
          .from("user_roles")
          .select("email, full_name")
          .in("email", stillMissing);
        (roleRows ?? []).forEach((r: { email: string; full_name: string | null }) => {
          empMap.set(r.email, { name: r.full_name || null, team: null });
        });
      }
    }

    const resolve = (email: string, field: keyof EmpInfo, provided: string | null | undefined): string | null => {
      const trimmed = provided?.trim() || null;
      return trimmed || empMap.get(email)?.[field] || null;
    };

    const created = await prisma.evaluation360Assignment.createMany({
      data: participants.map((p) => {
        const evtorEmail = p.evaluatorEmail.trim().toLowerCase();
        const evalEmail  = p.evaluateeEmail.trim().toLowerCase();
        return {
          evaluationId:   id,
          evaluatorEmail: evtorEmail,
          evaluatorName:  resolve(evtorEmail, "name", p.evaluatorName),
          evaluateeEmail: evalEmail,
          evaluateeName:  resolve(evalEmail,  "name", p.evaluateeName),
          team:           resolve(evalEmail,  "team", p.team),
          evaluationType: p.evaluationType,
          status:         "pending",
        };
      }),
      skipDuplicates: true,
    });

    if (sendInvitation) {
      const uniqueEvaluators = new Map<string, string>();
      participants.forEach((p) => {
        uniqueEvaluators.set(p.evaluatorEmail.toLowerCase(), p.evaluatorName || p.evaluatorEmail);
      });

      const appUrl  = process.env.APP_URL ?? "http://localhost:3000";
      const evalUrl = `${appUrl}/evaluaciones360`;
      const template = {
        subject:    evaluation.emailSubject,
        body:       evaluation.emailBody,
        buttonText: evaluation.emailButtonText,
        footer:     evaluation.emailFooter,
      };

      Promise.allSettled(
        Array.from(uniqueEvaluators.entries()).map(([email, name]) =>
          sendSurveyInvitation({
            to: email, recipientName: name,
            surveyTitle: evaluation.title, surveyDescription: evaluation.description ?? "",
            surveyUrl: evalUrl, isReminder: true, template,
          })
        )
      ).catch((err) => console.error("[invite new 360]", err));
    }

    return NextResponse.json({ created: created.count });
  } catch (error) {
    console.error("[POST participants]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const effectiveRole = await get360EffectiveRole(user.id);
    if (effectiveRole !== "admin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const { assignmentId } = await request.json();
    await prisma.evaluation360Assignment.delete({ where: { id: assignmentId, evaluationId: id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE participant]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
