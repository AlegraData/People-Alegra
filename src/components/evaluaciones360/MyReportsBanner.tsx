"use client";
import { useState, useEffect } from "react";
import { FileText, Eye, Download } from "lucide-react";

interface MyReport {
  evaluationId: string;
  title: string;
  sentAt: string | null;
}

interface Props {
  /** Email del usuario logueado — el endpoint de reportes exige que coincida
   *  con el evaluado para poder verlo/descargarlo como "self". */
  userEmail: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Aviso de "tu reporte ya está disponible" al tope de "Mis Evaluaciones 360°"
// — solo aparece si el admin ya envió (tab "Envíos") el reporte de esta
// persona para al menos una encuesta; no ensucia la pantalla para nadie más.
export default function MyReportsBanner({ userEmail }: Props) {
  const [reports, setReports] = useState<MyReport[]>([]);

  useEffect(() => {
    fetch("/api/evaluaciones360/my-reports")
      .then((r) => r.json())
      .then((d) => setReports((d.reports ?? []) as MyReport[]))
      .catch(() => {});
  }, []);

  if (reports.length === 0 || !userEmail) return null;

  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <div
          key={r.evaluationId}
          className="bg-white rounded-2xl border border-emerald-100 shadow-sm px-5 py-4 flex items-center gap-4"
        >
          <div className="w-11 h-11 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[#1e293b] truncate">Tu reporte de Feedback 360° ya está disponible</p>
            <p className="text-xs text-[#94a3b8] truncate">{r.title} · enviado el {formatDate(r.sentAt)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`/api/evaluaciones360/surveys/${r.evaluationId}/reports/${encodeURIComponent(userEmail)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-bold bg-slate-100 text-[#1e293b] px-4 py-2.5 rounded-xl hover:bg-slate-200 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" /> Ver PDF
            </a>
            <a
              href={`/api/evaluaciones360/surveys/${r.evaluationId}/reports/${encodeURIComponent(userEmail)}?download=1`}
              className="flex items-center gap-1.5 text-xs font-bold bg-[#1e293b] text-white px-4 py-2.5 rounded-xl hover:bg-primary transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Descargar
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
