"use client";
import { useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import type { Survey } from "@/types/clima";

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

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const response = await fetch(`/api/clima/responses?surveyId=${survey.id}`);
      const data: ResponseRow[] = await response.json();

      if (!data || data.length === 0) {
        alert("No hay datos para exportar.");
        return;
      }

      const rows = data.map((row) => {
        const answersStr = JSON.stringify(row.answers).replace(/"/g, '""');
        const date = new Date(row.submittedAt).toLocaleDateString("es-CO");
        return `${row.employee?.email ?? "Anónimo"},${date},"${answersStr}"`;
      });

      const csvContent =
        "data:text/csv;charset=utf-8,Empleado,Fecha,Respuestas\n" + rows.join("\n");

      const link = document.createElement("a");
      link.setAttribute("href", encodeURI(csvContent));
      link.setAttribute(
        "download",
        `resultados_${survey.title.replace(/\s+/g, "_")}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
          onClick={handleExportCSV}
          disabled={exporting}
          className="flex items-center gap-2 bg-[#1e293b] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary transition-all disabled:opacity-60"
        >
          <Download className="w-4 h-4" />
          {exporting ? "Exportando..." : "Exportar CSV"}
        </button>
      </div>

      <div className="bg-slate-50 rounded-2xl p-8 text-center border border-slate-100">
        <p className="text-[#64748b] mb-4">Los gráficos se renderizarán aquí.</p>
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10">
          <span className="text-3xl font-black text-primary">85%</span>
        </div>
        <p className="font-bold text-[#1e293b] mt-4">Nivel de Satisfacción General</p>
      </div>
    </div>
  );
}
