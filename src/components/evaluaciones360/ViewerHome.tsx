"use client";
import { useState, useEffect } from "react";
import { ClipboardList, Sparkles, FileText, Eye, Download } from "lucide-react";
import type { Evaluation360 } from "@/types/evaluaciones360";
import ViewerList from "./ViewerList";

interface Props {
  evaluations: Evaluation360[];
  onTake: (e: Evaluation360) => void;
  /** Email del usuario logueado — el endpoint de reportes exige que coincida
   *  con el evaluado para poder verlo/descargarlo como "self". */
  userEmail: string;
}

interface MyReport {
  evaluationId: string;
  title: string;
  sentAt: string | null;
}

type Tab = "evaluaciones" | "resultados";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Pantalla de aterrizaje para quien NO administra el módulo: dos pestañas —
// "Mis Evaluaciones 360°" (evaluar a otros, ya existía) y "Mis resultados"
// (el/los reporte(s) ya enviados a esta persona, antes un aviso siempre
// visible arriba de la lista — ahora vive en su propio tab, con un punto
// pulsante en la pestaña para que no pase desapercibido sin invadir la
// pantalla principal).
export default function ViewerHome({ evaluations, onTake, userEmail }: Props) {
  const [tab, setTab] = useState<Tab>("evaluaciones");
  const [reports, setReports] = useState<MyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/evaluaciones360/my-reports")
      .then((r) => r.json())
      .then((d) => setReports((d.reports ?? []) as MyReport[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hasReports = reports.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("evaluaciones")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            tab === "evaluaciones" ? "bg-white text-[#1e293b] shadow-sm" : "text-[#64748b] hover:text-[#1e293b]"
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Mis Evaluaciones 360°
        </button>
        <button
          onClick={() => setTab("resultados")}
          className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            tab === "resultados" ? "bg-white text-[#1e293b] shadow-sm" : "text-[#64748b] hover:text-[#1e293b]"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Mis resultados
          {hasReports && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          )}
        </button>
      </div>

      {tab === "evaluaciones" && <ViewerList evaluations={evaluations} onTake={onTake} />}

      {tab === "resultados" && (
        loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !hasReports ? (
          <div className="bg-white rounded-[2rem] p-16 border border-slate-100 shadow-sm text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
              <FileText className="w-8 h-8 text-slate-300" />
            </div>
            <div>
              <p className="text-xl font-bold text-[#1e293b]">Aún no tienes reportes disponibles</p>
              <p className="text-sm text-[#64748b] mt-1">Cuando te envíen tu reporte de Feedback 360°, lo verás aquí.</p>
            </div>
          </div>
        ) : (
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
        )
      )}
    </div>
  );
}
