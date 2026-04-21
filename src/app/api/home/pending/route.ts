export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import prisma from "@/lib/prisma";

export interface PendingItem {
  id: string;
  title: string;
  type: "clima" | "enps";
  href: string;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ pending: [] }, { status: 401 });
    }

    const employee = await prisma.employee.findUnique({
      where: { email: user.email! },
    });

    if (!employee) {
      return NextResponse.json({ pending: [] });
    }

    // Encuestas de clima pendientes (asignadas, sin completar, activas)
    const { data: climaRaw } = await supabaseAdmin
      .from("climate_survey_assignments")
      .select("survey_id, completed_at, climate_surveys(id, title, is_active)")
      .eq("employee_id", employee.id)
      .is("completed_at", null);

    const pendingClima: PendingItem[] = (climaRaw ?? [])
      .filter((a: any) => a.climate_surveys?.is_active)
      .map((a: any) => ({
        id: a.survey_id as string,
        title: a.climate_surveys.title as string,
        type: "clima",
        href: "/clima",
      }));

    // Encuestas eNPS pendientes (asignadas, sin completar, activas)
    const enpsRaw = await prisma.enpsSurveyAssignment.findMany({
      where: {
        employeeId: employee.id,
        completedAt: null,
        survey: { isActive: true },
      },
      include: { survey: { select: { id: true, title: true } } },
    });

    const pendingEnps: PendingItem[] = enpsRaw.map((a) => ({
      id: a.surveyId,
      title: a.survey.title,
      type: "enps",
      href: "/enps",
    }));

    return NextResponse.json({ pending: [...pendingClima, ...pendingEnps] });
  } catch (error) {
    console.error("[GET /api/home/pending]", error);
    return NextResponse.json({ pending: [] });
  }
}
