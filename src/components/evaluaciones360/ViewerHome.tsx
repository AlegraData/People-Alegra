"use client";
import { useState, useEffect, useMemo } from "react";
import { ClipboardList, Sparkles, FileText, Eye, Download, Users, Search, X } from "lucide-react";
import type { Evaluation360 } from "@/types/evaluaciones360";
import ViewerList from "./ViewerList";

interface Props {
  evaluations: Evaluation360[];
  onTake: (e: Evaluation360) => void;
  /** Email del usuario logueado — el endpoint de reportes exige que coincida
   *  con el evaluado (o con un líder suyo) para poder verlo/descargarlo. */
  userEmail: string;
}

interface MyReport {
  evaluationId: string;
  title: string;
  sentAt: string | null;
}

interface TeamMemberReport {
  evaluationId: string;
  title: string;
  sentAt: string | null;
}

interface TeamMember {
  correo: string;
  nombre: string | null;
  cargo: string | null;
  technicalTeam: string | null;
  reports: TeamMemberReport[];
}

type Tab = "evaluaciones" | "resultados" | "equipo";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Pantalla de aterrizaje para quien NO administra el módulo: "Mis
// Evaluaciones 360°" (evaluar a otros), "Mis resultados" (el/los reporte(s)
// ya enviados a esta persona) y, solo si la jerarquía real de HC dice que
// esta persona lidera a alguien, "Mi equipo" (los reportes ya enviados de
// TODO su equipo descendente, todos los niveles — ver
// /api/evaluaciones360/my-team-reports).
export default function ViewerHome({ evaluations, onTake, userEmail }: Props) {
  const [tab, setTab] = useState<Tab>("evaluaciones");
  const [reports, setReports] = useState<MyReport[]>([]);
  const [loading, setLoading] = useState(true);

  const [isLeader, setIsLeader] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamSearch, setTeamSearch] = useState("");

  useEffect(() => {
    fetch("/api/evaluaciones360/my-reports")
      .then((r) => r.json())
      .then((d) => setReports((d.reports ?? []) as MyReport[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/evaluaciones360/my-team-reports")
      .then((r) => r.json())
      .then((d) => { setIsLeader(!!d.isLeader); setTeam((d.members ?? []) as TeamMember[]); })
      .catch(() => {})
      .finally(() => setTeamLoading(false));
  }, []);

  const hasReports = reports.length > 0;

  const filteredTeam = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    if (!q) return team;
    return team.filter((m) =>
      (m.nombre ?? "").toLowerCase().includes(q) ||
      m.correo.toLowerCase().includes(q) ||
      (m.cargo ?? "").toLowerCase().includes(q) ||
      (m.technicalTeam ?? "").toLowerCase().includes(q)
    );
  }, [team, teamSearch]);

  return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit flex-wrap">
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
        {isLeader && (
          <button
            onClick={() => setTab("equipo")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              tab === "equipo" ? "bg-white text-[#1e293b] shadow-sm" : "text-[#64748b] hover:text-[#1e293b]"
            }`}
          >
            <Users className="w-4 h-4" />
            Mi equipo
          </button>
        )}
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

      {tab === "equipo" && (
        teamLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : team.length === 0 ? (
          <div className="bg-white rounded-[2rem] p-16 border border-slate-100 shadow-sm text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
              <Users className="w-8 h-8 text-slate-300" />
            </div>
            <div>
              <p className="text-xl font-bold text-[#1e293b]">Aún no hay reportes enviados a tu equipo</p>
              <p className="text-sm text-[#64748b] mt-1">Cuando le envíen su reporte de Feedback 360° a alguien de tu equipo, lo verás aquí.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
              <input
                type="text"
                placeholder="Buscar por nombre, correo, cargo o equipo…"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="w-full pl-11 pr-10 py-3 rounded-2xl border border-slate-200 bg-white text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
              />
              {teamSearch && (
                <button onClick={() => setTeamSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b]">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <p className="text-xs text-[#94a3b8] px-1">
              {filteredTeam.length} persona{filteredTeam.length !== 1 ? "s" : ""} con reporte disponible
            </p>

            <div className="space-y-2">
              {filteredTeam.map((m) => (
                <div key={m.correo} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#1e293b] truncate">{m.nombre ?? m.correo}</p>
                      <p className="text-xs text-[#94a3b8] truncate">
                        {[m.cargo, m.technicalTeam].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {m.reports.map((r) => (
                      <div key={r.evaluationId} className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl px-3 py-2">
                        <p className="text-xs text-[#64748b] truncate">{r.title} · enviado el {formatDate(r.sentAt)}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={`/api/evaluaciones360/surveys/${r.evaluationId}/reports/${encodeURIComponent(m.correo)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-[11px] font-bold bg-white border border-slate-200 text-[#1e293b] px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            <Eye className="w-3 h-3" /> Ver PDF
                          </a>
                          <a
                            href={`/api/evaluaciones360/surveys/${r.evaluationId}/reports/${encodeURIComponent(m.correo)}?download=1`}
                            className="flex items-center gap-1.5 text-[11px] font-bold bg-[#1e293b] text-white px-3 py-1.5 rounded-lg hover:bg-primary transition-colors"
                          >
                            <Download className="w-3 h-3" /> Descargar
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      )}
    </div>
  );
}
