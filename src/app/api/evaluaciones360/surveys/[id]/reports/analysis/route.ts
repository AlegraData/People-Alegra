export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { normalizeQuestions } from "@/types/evaluaciones360";
import type { EvalType } from "@/types/evaluaciones360";
import { computeSurveyBenchmarks } from "@/lib/eval360Benchmarks";
import { isJunkComment } from "@/lib/filterJunkComments";

type Ctx = { params: Promise<{ id: string }> };

async function get360EffectiveRole(userId: string): Promise<string> {
  const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).single();
  const { data: modRoleData } = await supabaseAdmin
    .from("user_module_roles").select("role").eq("user_id", userId).eq("module", "360").single();
  return modRoleData?.role ?? roleData?.role ?? "viewer";
}

const ALL_TYPES: EvalType[] = ["ascendente", "descendente", "paralela", "autoevaluacion"];

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const effectiveRole = await get360EffectiveRole(user.id);
    if (!["admin", "manager"].includes(effectiveRole))
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const evaluation = await prisma.evaluation360.findUnique({ where: { id } });
    if (!evaluation) return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });

    const submitted = await prisma.evaluation360Assignment.findMany({
      where: { evaluationId: id, status: "submitted" },
    });

    if (submitted.length === 0) {
      return NextResponse.json({
        totalSubmitted: 0, eligibleEvaluatees: 0, categories: [], teamCategoryTable: [],
        comments: { totalRaw: 0, totalKept: 0, totalFiltered: 0, byQuestion: [] },
        sentiment: { positivo: 0, neutral: 0, atencion: 0, positivoPct: 0, neutralPct: 0, atencionPct: 0 },
      });
    }

    const questionsMap = normalizeQuestions(evaluation.questions as unknown);

    // Equipo: mismo match contra el directorio que el resto del módulo.
    const allEmails = [...new Set(submitted.flatMap((a) => [a.evaluatorEmail, a.evaluateeEmail]))];
    const { data: teamRows } = await supabaseAdmin
      .from("v_empleados_activos_completa").select("correo, equipo").in("correo", allEmails);
    const teamMap = new Map(
      (teamRows ?? []).map((r: { correo: string; equipo: string | null }) => [r.correo, r.equipo ?? null])
    );
    const storedTeamMap = new Map<string, string>();
    submitted.forEach((a) => { if (a.team && !storedTeamMap.has(a.evaluateeEmail)) storedTeamMap.set(a.evaluateeEmail, a.team); });
    const teamByEmail = new Map<string, string | null>();
    allEmails.forEach((e) => teamByEmail.set(e, teamMap.get(e) ?? storedTeamMap.get(e) ?? null));

    // ── Tabla equipo × competencia ───────────────────────────────────────────
    const benchmarks = computeSurveyBenchmarks(submitted, questionsMap, teamByEmail);
    const categories = [...benchmarks.alegraCategoryAvg.keys()].sort();
    const teamCategoryTable = [...benchmarks.teamCategoryAvg.keys()].sort().map((team) => ({
      team,
      categories: Object.fromEntries(categories.map((cat) => [cat, benchmarks.teamCategoryAvg.get(team)?.get(cat) ?? null])),
    }));

    const eligibleEvaluatees = new Set(submitted.map((a) => a.evaluateeEmail)).size;

    // ── Conteo de comentarios (basura vs. válidos) por pregunta ──────────────
    let totalRaw = 0, totalKept = 0;
    const byQuestionAcc = new Map<string, { type: string; questionText: string; total: number; kept: number }>();

    // ── Clasificación por calificación asociada (Positivo/Neutral/Atención) ──
    let positivo = 0, neutral = 0, atencion = 0;

    ALL_TYPES.forEach((type) => {
      const typeQuestions = questionsMap[type] ?? [];
      const ratingQs = typeQuestions.filter((q) => q.type === "rating");
      const openQs = typeQuestions.filter((q) => q.type !== "rating");
      const typeAssignments = submitted.filter((a) => a.evaluationType === type);

      typeAssignments.forEach((a) => {
        const answers = (a.finalAnswers ?? {}) as Record<string, unknown>;

        // Score propio de esta asignación (ponderado, en % de la escala 0-1)
        let sum = 0, weight = 0;
        ratingQs.forEach((q) => {
          const val = answers[q.id];
          if (typeof val !== "number") return;
          const min = q.ratingMin ?? 1;
          const max = q.ratingMax ?? 10;
          const pct = max > min ? (val - min) / (max - min) : 0;
          sum += pct * q.weight; weight += q.weight;
        });
        const scorePct = weight > 0 ? sum / weight : null;

        // Comentarios de texto de esta asignación
        openQs.forEach((q) => {
          const key = `${type}::${q.id}`;
          if (!byQuestionAcc.has(key)) byQuestionAcc.set(key, { type, questionText: q.text, total: 0, kept: 0 });
          const acc = byQuestionAcc.get(key)!;
          const val = answers[q.id];
          if (typeof val !== "string" || !val.trim()) return;
          totalRaw++; acc.total++;
          if (!isJunkComment(val)) {
            totalKept++; acc.kept++;
            if (scorePct !== null) {
              if (scorePct >= 0.8) positivo++;
              else if (scorePct >= 0.5) neutral++;
              else atencion++;
            }
          }
        });
      });
    });

    const byQuestion = [...byQuestionAcc.values()].filter((q) => q.total > 0);
    const sentimentTotal = positivo + neutral + atencion;
    const pct = (n: number) => (sentimentTotal > 0 ? Math.round((n / sentimentTotal) * 100) : 0);

    return NextResponse.json({
      totalSubmitted: submitted.length,
      eligibleEvaluatees,
      categories,
      teamCategoryTable,
      comments: {
        totalRaw,
        totalKept,
        totalFiltered: totalRaw - totalKept,
        byQuestion,
      },
      sentiment: {
        positivo, neutral, atencion,
        positivoPct: pct(positivo), neutralPct: pct(neutral), atencionPct: pct(atencion),
      },
    });
  } catch (error) {
    console.error("[GET reports/analysis]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
