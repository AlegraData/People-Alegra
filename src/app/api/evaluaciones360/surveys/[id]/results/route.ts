export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { normalizeQuestions } from "@/types/evaluaciones360";
import type { EvalType } from "@/types/evaluaciones360";

type Ctx = { params: Promise<{ id: string }> };

async function get360EffectiveRole(userId: string): Promise<string> {
  const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).single();
  const { data: modRoleData } = await supabaseAdmin
    .from("user_module_roles").select("role").eq("user_id", userId).eq("module", "360").single();
  return modRoleData?.role ?? roleData?.role ?? "viewer";
}

interface TypeResult {
  score: number;
  submittedCount: number;
  questionScores: Record<string, { avg: number; weight: number; category?: string; text: string }>;
  categoryScores: Record<string, { avg: number; count: number }>;
  // Preguntas abiertas (texto/booleano/opción): sin identificar al evaluador,
  // igual que el resto de la vista, que es 100% agregada/anónima.
  openQuestions: { id: string; text: string; type: string; category?: string; answers: (string | number)[] }[];
}

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
    if (!evaluation) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const submitted = await prisma.evaluation360Assignment.findMany({
      where: { evaluationId: id, status: "submitted" },
    });

    const questionsMap = normalizeQuestions(evaluation.questions as unknown);
    const typeWeights: Record<EvalType, number> = {
      ascendente:     evaluation.weightAscendente,
      descendente:    evaluation.weightDescendente,
      paralela:       evaluation.weightParalela,
      autoevaluacion: evaluation.weightAutoevaluacion,
    };

    // Agrupar por evaluado
    const byEvaluatee = new Map<string, typeof submitted>();
    submitted.forEach((a) => {
      byEvaluatee.set(a.evaluateeEmail, [...(byEvaluatee.get(a.evaluateeEmail) ?? []), a]);
    });

    const ALL_TYPES: EvalType[] = ["ascendente", "descendente", "paralela", "autoevaluacion"];

    const evaluateeResults = Array.from(byEvaluatee.entries()).map(([evaluateeEmail, assignments]) => {
      const evaluateeName = assignments[0]?.evaluateeName ?? evaluateeEmail;

      const byType: Partial<Record<EvalType, TypeResult>> = {};
      let globalWeightedSum = 0;
      let globalWeightTotal = 0;

      for (const type of ALL_TYPES) {
        const typeAssignments = assignments.filter((a) => a.evaluationType === type);
        if (typeAssignments.length === 0) continue;

        const typeQuestions = (questionsMap[type] ?? []).filter((q) => q.type === "rating");

        // Per question: average of all answers from evaluators of this type
        const questionScores: TypeResult["questionScores"] = {};
        typeQuestions.forEach((q) => {
          const scores: number[] = [];
          typeAssignments.forEach((a) => {
            const ans = (a.finalAnswers ?? {}) as Record<string, string | number>;
            const val = ans[q.id];
            if (typeof val === "number") scores.push(val);
          });
          if (scores.length > 0) {
            questionScores[q.id] = {
              avg:      parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)),
              weight:   q.weight,
              category: q.category,
              text:     q.text,
            };
          }
        });

        // Type score: weighted average of question scores
        const scoredQWeight = Object.values(questionScores).reduce((s, qs) => s + qs.weight, 0);
        const typeScore = scoredQWeight > 0
          ? parseFloat(
              (Object.values(questionScores).reduce((s, qs) => s + qs.avg * qs.weight, 0) / scoredQWeight).toFixed(2)
            )
          : 0;

        // Category scores for this type
        const categoryScores: TypeResult["categoryScores"] = {};
        Object.values(questionScores).forEach(({ avg, weight, category }) => {
          const cat = category || "General";
          if (!categoryScores[cat]) categoryScores[cat] = { avg: 0, count: 0 };
          categoryScores[cat].avg   += avg * weight;
          categoryScores[cat].count += weight;
        });
        Object.keys(categoryScores).forEach((cat) => {
          categoryScores[cat].avg = parseFloat(
            (categoryScores[cat].avg / (categoryScores[cat].count || 1)).toFixed(2)
          );
        });

        // Preguntas abiertas: se listan las respuestas tal cual, sin decir quién
        // las escribió (mismo criterio de confidencialidad que las calificaciones).
        const openQs = (questionsMap[type] ?? []).filter((q) => q.type !== "rating");
        const openQuestions: TypeResult["openQuestions"] = openQs
          .map((q) => {
            const answers: (string | number)[] = [];
            typeAssignments.forEach((a) => {
              const ans = (a.finalAnswers ?? {}) as Record<string, string | number>;
              const val = ans[q.id];
              if (val !== undefined && val !== null && String(val).trim() !== "") answers.push(val);
            });
            return { id: q.id, text: q.text, type: q.type, category: q.category, answers };
          })
          .filter((oq) => oq.answers.length > 0);

        byType[type] = { score: typeScore, submittedCount: typeAssignments.length, questionScores, categoryScores, openQuestions };

        // Contribute to global score weighted by typeWeight
        const tw = typeWeights[type] ?? 0;
        if (tw > 0 && typeScore > 0) {
          globalWeightedSum += typeScore * tw;
          globalWeightTotal += tw;
        }
      }

      const overallScore = globalWeightTotal > 0
        ? parseFloat((globalWeightedSum / globalWeightTotal).toFixed(2))
        : 0;

      return {
        evaluateeEmail,
        evaluateeName,
        overallScore,
        totalSubmitted: assignments.length,
        byType,
      };
    });

    // Fetch avatars for all evaluatees from user_roles
    const evaluateeEmails = evaluateeResults.map((r) => r.evaluateeEmail);
    const { data: avatarRows } = evaluateeEmails.length > 0
      ? await supabaseAdmin.from("user_roles").select("email, avatar_url").in("email", evaluateeEmails)
      : { data: [] };
    const avatarMap = new Map(
      (avatarRows ?? []).map((r: { email: string; avatar_url: string | null }) => [r.email, r.avatar_url ?? null])
    );

    // Equipo: match contra el directorio de empleados (fuente de verdad, más
    // fresca que el `team` guardado en la asignación al momento de crearla).
    // Si la persona ya no está activa en el directorio, se cae al team guardado.
    const { data: teamRows } = evaluateeEmails.length > 0
      ? await supabaseAdmin.from("v_empleados_activos_completa").select("correo, equipo").in("correo", evaluateeEmails)
      : { data: [] };
    const teamMap = new Map(
      (teamRows ?? []).map((r: { correo: string; equipo: string | null }) => [r.correo, r.equipo ?? null])
    );
    const storedTeamMap = new Map<string, string | null>();
    submitted.forEach((a) => {
      if (a.team && !storedTeamMap.has(a.evaluateeEmail)) storedTeamMap.set(a.evaluateeEmail, a.team);
    });

    return NextResponse.json({
      evaluation: { id, title: evaluation.title, status: evaluation.status, typeWeights },
      questionsMap,
      results: evaluateeResults.map((r) => ({
        ...r,
        avatarUrl: avatarMap.get(r.evaluateeEmail) ?? null,
        team: teamMap.get(r.evaluateeEmail) ?? storedTeamMap.get(r.evaluateeEmail) ?? null,
      })),
    });
  } catch (error) {
    console.error("[GET results]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
