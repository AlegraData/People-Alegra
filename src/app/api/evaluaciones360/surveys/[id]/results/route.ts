export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import type { Eval360Question, EvalType } from "@/types/evaluaciones360";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id).single();
    if (!["admin", "manager"].includes(roleData?.role)) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const evaluation = await prisma.evaluation360.findUnique({ where: { id } });
    if (!evaluation) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const submitted = await prisma.evaluation360Assignment.findMany({
      where: { evaluationId: id, status: "submitted" },
    });

    const questions = evaluation.questions as Eval360Question[];
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

    const evaluateeResults = Array.from(byEvaluatee.entries()).map(([evaluateeEmail, assignments]) => {
      const evaluateeName = assignments[0]?.evaluateeName ?? evaluateeEmail;

      // Por tipo: promedio ponderado de cada pregunta
      const byType = new Map<EvalType, Record<string, number[]>>();
      assignments.forEach((a) => {
        const type = a.evaluationType as EvalType;
        if (!byType.has(type)) byType.set(type, {});
        const typeMap = byType.get(type)!;
        const answers = (a.finalAnswers ?? {}) as Record<string, string | number>;
        Object.entries(answers).forEach(([qId, val]) => {
          if (typeof val === "number") {
            typeMap[qId] = [...(typeMap[qId] ?? []), val];
          }
        });
      });

      // Calcular score ponderado por pregunta
      const questionScores: Record<string, { avg: number; weight: number; category?: string; text: string }> = {};
      questions.forEach((q) => {
        if (q.type !== "rating") return;
        let weightedSum = 0;
        let totalWeight = 0;
        byType.forEach((typeMap, type) => {
          const scores = typeMap[q.id] ?? [];
          if (scores.length === 0) return;
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
          const typeW = typeWeights[type] ?? 0;
          weightedSum += avg * typeW;
          totalWeight += typeW;
        });
        if (totalWeight > 0) {
          questionScores[q.id] = {
            avg:      parseFloat((weightedSum / totalWeight).toFixed(2)),
            weight:   q.weight,
            category: q.category,
            text:     q.text,
          };
        }
      });

      // Score global ponderado por peso de pregunta
      const ratingQuestions = questions.filter((q) => q.type === "rating");
      const totalQWeight = ratingQuestions.reduce((s, q) => s + q.weight, 0) || 1;
      const overallScore = parseFloat(
        (Object.entries(questionScores).reduce((sum, [qId, s]) => {
          const q = questions.find((q) => q.id === qId);
          return sum + s.avg * (q?.weight ?? 0);
        }, 0) / totalQWeight).toFixed(2)
      );

      // Agrupado por categoría
      const categoryScores: Record<string, { avg: number; count: number }> = {};
      Object.values(questionScores).forEach(({ avg, weight, category }) => {
        const cat = category || "General";
        if (!categoryScores[cat]) categoryScores[cat] = { avg: 0, count: 0 };
        categoryScores[cat].avg += avg * weight;
        categoryScores[cat].count += weight;
      });
      Object.keys(categoryScores).forEach((cat) => {
        categoryScores[cat].avg = parseFloat((categoryScores[cat].avg / (categoryScores[cat].count || 1)).toFixed(2));
      });

      return {
        evaluateeEmail,
        evaluateeName,
        overallScore,
        totalSubmitted: assignments.length,
        questionScores,
        categoryScores,
        byType: Object.fromEntries(
          Array.from(byType.entries()).map(([type, typeMap]) => [
            type,
            Object.fromEntries(
              Object.entries(typeMap).map(([qId, scores]) => [
                qId,
                parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)),
              ])
            ),
          ])
        ),
      };
    });

    return NextResponse.json({
      evaluation: { id, title: evaluation.title, status: evaluation.status, typeWeights },
      questions,
      results: evaluateeResults,
    });
  } catch (error) {
    console.error("[GET results]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
