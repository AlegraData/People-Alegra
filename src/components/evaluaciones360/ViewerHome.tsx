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
  /** Solo para el panel de admin (vista previa): renderiza "Mis resultados"
   *  y "Mi equipo" tal como los vería este correo, en vez de los del usuario
   *  logueado. El acceso a los PDFs sigue siendo el de la sesión real (admin
   *  del módulo) — esto solo cambia de quién se pide la jerarquía/reportes. */
  previewAs?: string;
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
  avatarUrl: string | null;
  reports: TeamMemberReport[];
}

type Tab = "evaluaciones" | "resultados" | "equipo";

const TEAM_PAGE_SIZE = 10;

function Avatar({ name, email, url }: { name: string | null; email: string; url: string | null }) {
  // Las fotos vienen del CDN de Google (lh3.googleusercontent.com) — a veces
  // una carga puntual falla ahí (bloqueadores, límite de conexiones al mismo
  // host, etc.) aunque la URL guardada sea válida. Sin este fallback, esa
  // falla deja el ícono roto del navegador en vez de caer a las iniciales.
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return (
      <img
        src={url}
        alt={name ?? email}
        onError={() => setBroken(true)}
        className="w-11 h-11 rounded-2xl object-cover shrink-0"
      />
    );
  }
  return (
    <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
      <span className="text-sm font-black text-primary">{(name ?? email)[0].toUpperCase()}</span>
    </div>
  );
}

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
export default function ViewerHome({ evaluations, onTake, userEmail, previewAs }: Props) {
  const [tab, setTab] = useState<Tab>(previewAs ? "resultados" : "evaluaciones");
  const [reports, setReports] = useState<MyReport[]>([]);
  const [loading, setLoading] = useState(true);

  const [isLeader, setIsLeader] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamSearch, setTeamSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [teamPage, setTeamPage] = useState(1);

  const query = previewAs ? `?previewAs=${encodeURIComponent(previewAs)}` : "";
  const reportsOwnerEmail = previewAs ?? userEmail;

  useEffect(() => {
    fetch(`/api/evaluaciones360/my-reports${query}`)
      .then((r) => r.json())
      .then((d) => setReports((d.reports ?? []) as MyReport[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(() => {
    fetch(`/api/evaluaciones360/my-team-reports${query}`)
      .then((r) => r.json())
      .then((d) => { setIsLeader(!!d.isLeader); setTeam((d.members ?? []) as TeamMember[]); })
      .catch(() => {})
      .finally(() => setTeamLoading(false));
  }, [query]);

  const hasReports = reports.length > 0;

  // Solo tiene sentido mostrar un filtro de equipo cuando el árbol descendente
  // de este líder de verdad abarca más de un equipo (lo normal es que un
  // líder solo tenga gente de su propio equipo) — con 0 o 1 equipos el select
  // no aporta nada, así que ni se renderiza.
  const distinctTeams = useMemo(() => {
    const set = new Set(team.map((m) => m.technicalTeam).filter((t): t is string => !!t));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [team]);

  const filteredTeam = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    return team.filter((m) => {
      if (teamFilter && m.technicalTeam !== teamFilter) return false;
      if (!q) return true;
      return (
        (m.nombre ?? "").toLowerCase().includes(q) ||
        m.correo.toLowerCase().includes(q) ||
        (m.cargo ?? "").toLowerCase().includes(q) ||
        (m.technicalTeam ?? "").toLowerCase().includes(q)
      );
    });
  }, [team, teamSearch, teamFilter]);

  useEffect(() => { setTeamPage(1); }, [teamSearch, teamFilter, team]);

  const totalTeamPages = Math.max(1, Math.ceil(filteredTeam.length / TEAM_PAGE_SIZE));
  const pagedTeam = filteredTeam.slice((teamPage - 1) * TEAM_PAGE_SIZE, teamPage * TEAM_PAGE_SIZE);

  return (
    <div className="space-y-5">
      {previewAs && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm font-bold text-amber-800">
          <Eye className="w-4 h-4 shrink-0" />
          Vista previa — viendo esta pantalla como la vería <span className="underline">{previewAs}</span>
        </div>
      )}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit flex-wrap">
        {!previewAs && (
        <button
          onClick={() => setTab("evaluaciones")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            tab === "evaluaciones" ? "bg-white text-[#1e293b] shadow-sm" : "text-[#64748b] hover:text-[#1e293b]"
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Mis Evaluaciones 360°
        </button>
        )}
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
                    href={`/api/evaluaciones360/surveys/${r.evaluationId}/reports/${encodeURIComponent(reportsOwnerEmail)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-bold bg-slate-100 text-[#1e293b] px-4 py-2.5 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" /> Ver PDF
                  </a>
                  <a
                    href={`/api/evaluaciones360/surveys/${r.evaluationId}/reports/${encodeURIComponent(reportsOwnerEmail)}?download=1`}
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
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-md">
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

              {distinctTeams.length > 1 && (
                <select
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  className="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-[#1e293b] outline-none focus:ring-2 focus:ring-primary/30 transition-shadow cursor-pointer"
                >
                  <option value="">Todos los equipos</option>
                  {distinctTeams.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>

            <p className="text-xs text-[#94a3b8] px-1">
              {filteredTeam.length} persona{filteredTeam.length !== 1 ? "s" : ""} con reporte disponible
            </p>

            <div className="space-y-2">
              {pagedTeam.map((m) => (
                <div key={m.correo} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
                  <div className="flex items-center gap-4">
                    <Avatar name={m.nombre} email={m.correo} url={m.avatarUrl} />
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

            {totalTeamPages > 1 && (
              <div className="flex items-center justify-between gap-3 px-1">
                <p className="text-xs text-[#94a3b8]">Página {teamPage} de {totalTeamPages}</p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setTeamPage((p) => Math.max(1, p - 1))}
                    disabled={teamPage === 1}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                  >
                    ← Anterior
                  </button>
                  {Array.from({ length: totalTeamPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalTeamPages || Math.abs(p - teamPage) <= 2)
                    .map((p, idx, arr) => (
                      <span key={p} className="flex items-center">
                        {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-xs text-[#94a3b8]">…</span>}
                        <button
                          onClick={() => setTeamPage(p)}
                          className={`w-8 h-8 text-xs font-bold rounded-lg transition-colors ${
                            teamPage === p ? "bg-primary text-white" : "text-[#64748b] hover:bg-slate-100"
                          }`}
                        >
                          {p}
                        </button>
                      </span>
                    ))}
                  <button
                    onClick={() => setTeamPage((p) => Math.min(totalTeamPages, p + 1))}
                    disabled={teamPage === totalTeamPages}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
