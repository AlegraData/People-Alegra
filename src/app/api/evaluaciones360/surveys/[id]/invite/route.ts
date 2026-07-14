export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { sendSurveyInvitation } from "@/lib/mailer";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id).single();
    const { data: modRoleData } = await supabaseAdmin
      .from("user_module_roles").select("role").eq("user_id", user.id).eq("module", "360").single();
    const role = modRoleData?.role ?? roleData?.role ?? "viewer";
    if (role !== "admin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const evaluation = await prisma.evaluation360.findUnique({ where: { id } });
    if (!evaluation) return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });

    const { email, name } = await request.json() as { email: string; name?: string };
    if (!email?.trim()) return NextResponse.json({ error: "Email requerido" }, { status: 400 });

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    await sendSurveyInvitation({
      to:               email.toLowerCase().trim(),
      recipientName:    name || email,
      surveyTitle:      evaluation.title,
      surveyDescription: evaluation.description ?? "",
      surveyUrl:        `${appUrl}/evaluaciones360`,
      isReminder:       false,
      showFallbackLink: false,
      template: {
        subject:    evaluation.emailSubject,
        body:       evaluation.emailBody,
        buttonText: evaluation.emailButtonText,
        footer:     evaluation.emailFooter,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /invite]", error);
    return NextResponse.json({ error: "Error al enviar correo" }, { status: 500 });
  }
}
