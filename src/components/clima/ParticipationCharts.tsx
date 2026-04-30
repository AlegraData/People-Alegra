"use client";

import { useState, useEffect, useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
  AreaChart, Area,
} from "recharts";
import { Users, CheckCircle2, Clock, TrendingUp, Filter, X, ChevronLeft, ChevronRight } from "lucide-react";
import type { SurveyParticipant } from "@/types/clima";

interface Props {
  surveyId: string;
}

const PRIMARY = "#00D6BC";
const BLUE    = "#3b82f6";
const SLATE   = "#e2e8f0";
const PURPLE  = "#8b5cf6";
const AMBER   = "#f59e0b";
const ROSE    = "#f43f5e";
const CYAN    = "#06b6d4";

function rateColor(rate: number) {
  if (rate >= 80) return PRIMARY;
  if (rate >= 50) return AMBER;
  return ROSE;
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
      <div className="p-3 rounded-xl shrink-0" style={{ backgroundColor: `${color}1a` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-[#64748b] font-semibold uppercase tracking-wide truncate">{label}</p>
        <p className="text-2xl font-black text-[#1e293b] leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-[#94a3b8] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { color: string; name: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white shadow-xl rounded-xl p-3 border border-slate-100 text-sm min-w-[130px]">
      {label && <p className="font-semibold text-[#1e293b] mb-1.5 text-xs">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} className="font-medium text-xs" style={{ color: entry.color }}>
          {entry.name}:{" "}
          <span className="text-[#1e293b]">
            {entry.value}{entry.name.startsWith("%") ? "%" : ""}
          </span>
        </p>
      ))}
    </div>
  );
}

// ── Section Card ──────────────────────────────────────────────────────────────
function ChartCard({ title, subtitle, children, className = "" }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 p-6 shadow-sm ${className}`}>
      <div className="mb-4">
        <h4 className="font-bold text-[#1e293b] text-sm">{title}</h4>
        {subtitle && <p className="text-[11px] text-[#94a3b8] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-[200px]">
      <p className="text-sm text-[#94a3b8]">{text}</p>
    </div>
  );
}

const selectCls =
  "text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-[#1e293b] " +
  "focus:outline-none focus:ring-2 focus:ring-[#00D6BC]/30 focus:border-[#00D6BC]/50 cursor-pointer";

// ─────────────────────────────────────────────────────────────────────────────

export default function ParticipationCharts({ surveyId }: Props) {
  const [participants, setParticipants] = useState<SurveyParticipant[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filterTeam, setFilterTeam]     = useState("all");
  const [filterCargo, setFilterCargo]   = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage]                 = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/clima/surveys/${surveyId}/participants`)
      .then((r) => r.json())
      .then((d) => setParticipants(Array.isArray(d) ? d : []))
      .catch(() => setParticipants([]))
      .finally(() => setLoading(false));
  }, [surveyId]);

  const teams = useMemo(
    () => [...new Set(participants.map((p) => p.equipo).filter(Boolean) as string[])].sort(),
    [participants],
  );
  const cargos = useMemo(
    () => [...new Set(participants.map((p) => p.cargo).filter(Boolean) as string[])].sort(),
    [participants],
  );

  const filtered = useMemo(
    () =>
      participants.filter((p) => {
        if (filterTeam   !== "all" && p.equipo !== filterTeam)            return false;
        if (filterCargo  !== "all" && p.cargo  !== filterCargo)           return false;
        if (filterStatus === "responded" && !p.completed_at)              return false;
        if (filterStatus === "pending"   &&  p.completed_at)              return false;
        return true;
      }),
    [participants, filterTeam, filterCargo, filterStatus],
  );

  const total     = filtered.length;
  const responded = filtered.filter((p) => p.completed_at).length;
  const pending   = total - responded;
  const rate      = total > 0 ? Math.round((responded / total) * 100) : 0;

  const donutData = [
    { name: "Respondieron", value: responded },
    { name: "Pendientes",   value: pending   },
  ];

  // Aggregation helpers
  function aggregateBy(key: keyof SurveyParticipant, fallback: string) {
    const map = new Map<string, { r: number; p: number }>();
    filtered.forEach((p) => {
      const k = (p[key] as string | null) || fallback;
      if (!map.has(k)) map.set(k, { r: 0, p: 0 });
      const e = map.get(k)!;
      p.completed_at ? e.r++ : e.p++;
    });
    return [...map.entries()]
      .map(([name, { r, p }]) => ({
        name:         name.length > 26 ? name.slice(0, 24) + "…" : name,
        Respondieron: r,
        Pendientes:   p,
        "% part.":    r + p > 0 ? Math.round((r / (r + p)) * 100) : 0,
      }))
      .sort((a, b) => b["% part."] - a["% part."]);
  }

  const teamData = useMemo(() => aggregateBy("equipo", "Sin equipo"), [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  const teamRateData = useMemo(
    () => teamData.map(({ name, "% part.": rate }) => ({ name, "% participación": rate })),
    [teamData],
  );

  const timelineData = useMemo(() => {
    const byDay = new Map<string, number>();
    filtered
      .filter((p) => p.completed_at)
      .forEach((p) => {
        const day = p.completed_at!.slice(0, 10);
        byDay.set(day, (byDay.get(day) || 0) + 1);
      });
    const days = [...byDay.keys()].sort();
    let cum = 0;
    return days.map((day) => {
      cum += byDay.get(day)!;
      return {
        fecha:        new Date(day + "T12:00:00").toLocaleDateString("es-CO", { month: "short", day: "numeric" }),
        "Por día":    byDay.get(day)!,
        "Acumuladas": cum,
      };
    });
  }, [filtered]);

  const responseTimeData = useMemo(() => {
    const labels = ["< 1 día", "1 día", "2-3 días", "4-7 días", "> 7 días"];
    const counts = new Map(labels.map((l) => [l, 0]));
    filtered
      .filter((p) => p.completed_at)
      .forEach((p) => {
        const days =
          (new Date(p.completed_at!).getTime() - new Date(p.assigned_at).getTime()) / 86_400_000;
        let b: string;
        if      (days < 1 ) b = "< 1 día";
        else if (days < 2 ) b = "1 día";
        else if (days <= 3) b = "2-3 días";
        else if (days <= 7) b = "4-7 días";
        else                b = "> 7 días";
        counts.set(b, (counts.get(b) || 0) + 1);
      });
    return labels.map((l) => ({ tiempo: l, Personas: counts.get(l) || 0 }));
  }, [filtered]);

  const hasFilters = filterTeam !== "all" || filterCargo !== "all" || filterStatus !== "all";

  // Reset page when filters change
  useEffect(() => setPage(1), [filterTeam, filterCargo, filterStatus]);

  const totalPages    = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedRows     = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Loading / empty ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#00D6BC] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#64748b]">Cargando análisis de participación…</p>
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-[#64748b]">No hay participantes asignados a esta encuesta.</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-50 rounded-2xl p-4 border border-slate-100">
        <div className="flex items-center gap-2 text-[#64748b] shrink-0">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-semibold">Filtros</span>
        </div>

        <select value={filterTeam}   onChange={(e) => setFilterTeam(e.target.value)}   className={selectCls}>
          <option value="all">Todos los equipos</option>
          {teams.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={filterCargo}  onChange={(e) => setFilterCargo(e.target.value)}  className={selectCls}>
          <option value="all">Todos los cargos</option>
          {cargos.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectCls}>
          <option value="all">Todos los estados</option>
          <option value="responded">Solo respondieron</option>
          <option value="pending">Solo pendientes</option>
        </select>

        {hasFilters && (
          <button
            onClick={() => { setFilterTeam("all"); setFilterCargo("all"); setFilterStatus("all"); }}
            className="flex items-center gap-1.5 text-xs text-[#64748b] hover:text-[#1e293b] transition-colors ml-auto font-medium"
          >
            <X className="w-3 h-3" /> Limpiar
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Users className="w-5 h-5" />}
          label="Total Asignados"
          value={total}
          color={BLUE}
        />
        <KpiCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Respondieron"
          value={responded}
          sub={`de ${total} asignados`}
          color={PRIMARY}
        />
        <KpiCard
          icon={<Clock className="w-5 h-5" />}
          label="Pendientes"
          value={pending}
          sub={`${total > 0 ? 100 - rate : 0}% sin responder`}
          color={AMBER}
        />
        <KpiCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="% Participación"
          value={`${rate}%`}
          sub={rate >= 80 ? "Excelente" : rate >= 60 ? "Buena" : rate >= 40 ? "Regular" : "Baja"}
          color={rateColor(rate)}
        />
      </div>

      {/* Donut + Timeline */}
      <div className="grid md:grid-cols-2 gap-6">

        <ChartCard title="Estado de Participación">
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={95}
                paddingAngle={3}
                dataKey="value"
                label={({ percent }) =>
                  (percent as number) > 0.04 ? `${((percent as number) * 100).toFixed(0)}%` : ""
                }
                labelLine={false}
              >
                <Cell fill={PRIMARY} />
                <Cell fill={SLATE}   />
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span className="text-xs text-[#1e293b]">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="text-center -mt-3">
            <p className="text-5xl font-black" style={{ color: rateColor(rate) }}>{rate}%</p>
            <p className="text-xs text-[#94a3b8] mt-1">tasa de participación</p>
          </div>
        </ChartCard>

        <ChartCard
          title="Evolución de Respuestas"
          subtitle="Respuestas diarias y acumuladas a lo largo del tiempo"
        >
          {timelineData.length < 2 ? (
            <Empty text={responded === 0 ? "Sin respuestas registradas aún." : "Solo hay respuestas en un día."} />
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={timelineData} margin={{ top: 5, right: 10, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradAcum"   x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={PRIMARY} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={PRIMARY} stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="gradDiario" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={BLUE} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={BLUE} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="fecha"        tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis allowDecimals={false}  tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(v) => <span className="text-xs text-[#1e293b]">{v}</span>}
                />
                <Area type="monotone" dataKey="Acumuladas" stroke={PRIMARY} fill="url(#gradAcum)"   strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="Por día"    stroke={BLUE}   fill="url(#gradDiario)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

      </div>

      {/* Participación por Equipo */}
      {teamData.length > 1 && (
        <div className="grid md:grid-cols-2 gap-6">

          <ChartCard title="Participación por Equipo" subtitle="Respondieron vs. Pendientes">
            <ResponsiveContainer width="100%" height={Math.max(180, teamData.length * 42)}>
              <BarChart
                data={teamData}
                layout="vertical"
                margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: "#1e293b" }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(v) => <span className="text-xs text-[#1e293b]">{v}</span>}
                />
                <Bar dataKey="Respondieron" stackId="a" fill={PRIMARY} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Pendientes"   stackId="a" fill={SLATE}   radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="% de Participación por Equipo" subtitle="Ordenado de mayor a menor">
            <ResponsiveContainer width="100%" height={Math.max(180, teamRateData.length * 42)}>
              <BarChart
                data={teamRateData}
                layout="vertical"
                margin={{ top: 0, right: 52, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: "#1e293b" }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="% participación" fill={CYAN} radius={[0, 4, 4, 0]}>
                  <LabelList
                    dataKey="% participación"
                    position="right"
                    style={{ fontSize: 10, fill: "#64748b" }}
                    formatter={(v) => `${v ?? 0}%`}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

        </div>
      )}

      {/* Tiempo de respuesta — full width */}
      <ChartCard
        title="Tiempo de Respuesta"
        subtitle="Días entre la asignación y la respuesta del participante"
      >
        {responded === 0 ? (
          <Empty text="Sin respuestas registradas aún." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={responseTimeData} margin={{ top: 5, right: 10, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="tiempo"       tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis allowDecimals={false}  tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="Personas" fill={PURPLE} radius={[4, 4, 0, 0]}>
                <LabelList
                  dataKey="Personas"
                  position="top"
                  style={{ fontSize: 11, fill: "#64748b" }}
                  formatter={(v) => Number(v) > 0 ? String(v) : ""}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Participants table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-[#1e293b] text-sm">Lista de Participantes</h4>
            <p className="text-[11px] text-[#94a3b8] mt-0.5">
              {filtered.length} participante{filtered.length !== 1 ? "s" : ""} · página {page} de {totalPages}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wide whitespace-nowrap">Nombre</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wide whitespace-nowrap">Correo</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wide whitespace-nowrap">Equipo</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wide whitespace-nowrap">Cargo</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wide whitespace-nowrap">Asignado</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wide whitespace-nowrap">Respondió</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wide whitespace-nowrap">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pagedRows.map((p) => (
                <tr key={p.employee_id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 font-medium text-[#1e293b] whitespace-nowrap">{p.nombre_completo}</td>
                  <td className="px-4 py-3 text-[#64748b] whitespace-nowrap">{p.correo}</td>
                  <td className="px-4 py-3 text-[#64748b] whitespace-nowrap">{p.equipo ?? <span className="text-[#cbd5e1]">—</span>}</td>
                  <td className="px-4 py-3 text-[#64748b] whitespace-nowrap">{p.cargo ?? <span className="text-[#cbd5e1]">—</span>}</td>
                  <td className="px-4 py-3 text-[#64748b] whitespace-nowrap">
                    {new Date(p.assigned_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-[#64748b] whitespace-nowrap">
                    {p.completed_at
                      ? new Date(p.completed_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })
                      : <span className="text-[#cbd5e1]">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {p.completed_at ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#00D6BC]/10 text-[#009e8c]">
                        <CheckCircle2 className="w-3 h-3" /> Respondió
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600">
                        <Clock className="w-3 h-3" /> Pendiente
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {pagedRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#94a3b8]">
                    No hay participantes con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-4">
            <p className="text-xs text-[#94a3b8]">
              Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-[#64748b]" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                .reduce<(number | "…")[]>((acc, n, i, arr) => {
                  if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push("…");
                  acc.push(n);
                  return acc;
                }, [])
                .map((n, i) =>
                  n === "…" ? (
                    <span key={`dots-${i}`} className="px-1 text-[#94a3b8] text-sm">…</span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setPage(n as number)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                        page === n
                          ? "bg-[#00D6BC] text-white"
                          : "hover:bg-slate-100 text-[#64748b]"
                      }`}
                    >
                      {n}
                    </button>
                  ),
                )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-[#64748b]" />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
