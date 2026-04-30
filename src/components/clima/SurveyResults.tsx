"use client";
import { useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import type { Survey, SurveyParticipant } from "@/types/clima";
import * as XLSX from "xlsx";
import ParticipationCharts from "./ParticipationCharts";

interface SurveyResultsProps {
  survey: Survey;
  onBack: () => void;
}

interface ResponseRow {
  answers: Record<string, unknown>;
  submittedAt: string;
  employee?: { email: string };
}

export default function SurveyResults({ survey, onBack }: SurveyResultsProps) {
  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const [responsesRes, participantsRes] = await Promise.all([
        fetch(`/api/clima/responses?surveyId=${survey.id}`),
        fetch(`/api/clima/surveys/${survey.id}/participants`),
      ]);

      const data: ResponseRow[]          = await responsesRes.json();
      const participants: SurveyParticipant[] = await participantsRes.json();

      if (!data || data.length === 0) {
        alert("No hay datos para exportar.");
        return;
      }

      // Lookup: correo → participante
      const byEmail = new Map<string, SurveyParticipant>(
        (participants ?? []).map((p) => [p.correo.toLowerCase(), p]),
      );

      const fmtDate = (iso: string | null | undefined) =>
        iso ? new Date(iso).toLocaleDateString("es-CO") : "";

      const questions = survey.questions as { id: string; text: string }[];

      const headers = [
        "Correo",
        "Nombre",
        "Equipo",
        "Rol",
        "Fecha de ingreso",
        "Fecha de asignación",
        "Fecha de respuesta",
        ...questions.map((q) => q.text),
      ];

      const rows = data.map((row) => {
        const email = row.employee?.email ?? "";
        const part  = byEmail.get(email.toLowerCase());
        const answers = questions.map((q) => {
          const val = (row.answers as Record<string, unknown>)[q.id];
          return val !== undefined && val !== null ? String(val) : "";
        });
        return [
          email || "Anónimo",
          part?.nombre_completo  ?? "",
          part?.equipo           ?? "",
          part?.cargo            ?? "",
          fmtDate(part?.fecha_original),
          fmtDate(part?.assigned_at),
          fmtDate(row.submittedAt),
          ...answers,
        ];
      });

      const wsData = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Ancho automático por columna
      ws["!cols"] = headers.map((h, i) => ({
        wch: Math.max(
          h.length,
          ...rows.map((r) => String(r[i] ?? "").length)
        ) + 2,
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Resultados");

      XLSX.writeFile(
        wb,
        `resultados_${survey.title.replace(/\s+/g, "_")}.xlsx`
      );
    } catch {
      alert("Error al exportar. Intenta de nuevo.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-xl font-bold">{survey.title} — Resultados</h3>
            <p className="text-sm text-[#64748b]">{survey.responsesCount || 0} Respuestas Totales</p>
          </div>
        </div>
        <button
          onClick={handleExportExcel}
          disabled={exporting}
          className="flex items-center gap-2 bg-[#1e293b] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary transition-all disabled:opacity-60"
        >
          <Download className="w-4 h-4" />
          {exporting ? "Exportando..." : "Exportar Excel"}
        </button>
      </div>

      <ParticipationCharts surveyId={survey.id} />
    </div>
  );
}
