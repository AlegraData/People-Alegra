"use client";
import { useState, useEffect, useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
  AreaChart, Area,
} from "recharts";
import {
  Users, CheckCircle2, Clock, TrendingUp, Filter,
  ChevronLeft, ChevronRight, Send, Inbox, UserCheck,
} from "lucide-react";

interface ParticipationData {
  totalAssignments: number;
  submittedCount:   number;
  pendingCount:     number;
  completionRate:   number;
  timeline:   { date: string; daily: number; cumulative: number }[];
  byTeam:     { team: string; total: number; submitted: number; pending: number; rate: number }[];
  evaluatees: { email: string; name: string | null; team: string | null; total: number; received: number; pending: number }[];
  evaluators: { email: string; name: string | null; total: number; submitted: number; pending: number }[];
}

interface Props { evaluationId: string }

const PAGE_SIZE = 10;
const PRIMARY   = "#00D6BC";
const BLUE      = "#3b82f6";
const SLATE     = "#e2e8f0";
const AMBER     = "#f59e0b";
const CYAN      = "#06b6d4";
const ROSE      = "#f43f5e";

function rateColor(r: number) {
  return r >= 80 ? PRIMARY : r >= 50 ? AMBER : ROSE;
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string;
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

// ── Chart Tooltip ─────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: { color: string; name: string; value: number }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white shadow-xl rounded-xl p-3 border border-slate-100 text-sm min-w-[140px]">
      {label && <p className="font-semibold text-[#1e293b] mb-1.5 text-xs">{label}</p>}
      {payload.map((e, i) => (
        <p key={i} className="font-medium text-xs" style={{ color: e.color }}>
          {e.name}: <span className="text-[#1e293b]">{e.value}{e.name.includes("%") ? "%" : ""}</span>
        </p>
      ))}
    </div>
  );
}

// ── Chart Card ────────────────────────────────────────────────────────────────
function ChartCard({ title, subtitle, children, className = "" }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string;
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

// ── Pagination ────────────────────────────────────────────────────────────────
function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null;
  const pages = Array.from({ length: total }, (_, i) => i + 1)
    .filter((n) => n === 1 || n === total || Math.abs(n - page) <= 1)
    .reduce<(number | "…")[]>((acc, n, i, arr) => {
      if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push("…");
      acc.push(n);
      return acc;
    }, []);
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}
        className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <ChevronLeft className="w-4 h-4 text-[#64748b]" />
      </button>
      {pages.map((n, i) =>
        n === "…" ? (
          <span key={`d${i}`} className="px-1 text-[#94a3b8] text-sm">…</span>
        ) : (
          <button key={n} onClick={() => onChange(n as number)}
            className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
              page === n ? "bg-primary text-white" : "hover:bg-slate-100 text-[#64748b]"
            }`}>{n}</button>
        )
      )}
      <button onClick={() => onChange(Math.min(total, page + 1))} disabled={page === total}
        className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <ChevronRight className="w-4 h-4 text-[#64748b]" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function EvalParticipation({ evaluationId }: Props) {
  const [data, setData]         = useState<ParticipationData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [filterTeam, setFilterTeam] = useState("all");
  const [tableTab, setTableTab] = useState<"evaluatees" | "evaluators">("evaluatees");
  const [pageEvaluatee, setPageEvaluatee] = useState(1);
  const [pageEvaluator, setPageEvaluator] = useState(1);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/evaluaciones360/surveys/${evaluationId}/participation`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [evaluationId]);

  const teams = useMemo(
    () => [...new Set((data?.evaluatees ?? []).map((e) => e.team).filter(Boolean) as string[])].sort(),
    [data],
  );

  const filteredEvaluatees = useMemo(
    () =>
      filterTeam === "all"
        ? (data?.evaluatees ?? [])
        : (data?.evaluatees ?? []).filter((e) => e.team === filterTeam),
    [data, filterTeam],
  );

  useEffect(() => setPageEvaluatee(1), [filterTeam]);

  const timelineData = useMemo(
    () =>
      (data?.timeline ?? []).map(({ date, daily, cumulative }) => ({
        fecha:       new Date(date + "T12:00:00").toLocaleDateString("es-CO", { month: "short", day: "numeric" }),
        "Por día":   daily,
        "Acumuladas": cumulative,
      })),
    [data],
  );

  const teamData = useMemo(
    () =>
      (data?.byTeam ?? []).map(({ team, total, submitted, pending }) => ({
        name:        team.length > 26 ? team.slice(0, 24) + "…" : team,
        "Enviadas":  submitted,
        "Pendientes": pending,
        total,
      })),
    [data],
  );

  const teamRateData = useMemo(
    () =>
      (data?.byTeam ?? []).map(({ team, rate }) => ({
        name:           team.length > 26 ? team.slice(0, 24) + "…" : team,
        "% completado": rate,
      })),
    [data],
  );

  const donutData = [
    { name: "Enviadas",   value: data?.submittedCount ?? 0 },
    { name: "Pendientes", value: data?.pendingCount   ?? 0 },
  ];

  const evaluators        = data?.evaluators ?? [];
  const totalPagesEval    = Math.max(1, Math.ceil(filteredEvaluatees.length / PAGE_SIZE));
  const totalPagesEvtor   = Math.max(1, Math.ceil(evaluators.length       / PAGE_SIZE));
  const pagedEvaluatees   = filteredEvaluatees.slice((pageEvaluatee - 1) * PAGE_SIZE, pageEvaluatee * PAGE_SIZE);
  const pagedEvaluators   = evaluators.slice((pageEvaluator - 1) * PAGE_SIZE, pageEvaluator * PAGE_SIZE);
  const rate              = data?.completionRate ?? 0;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#64748b]">Cargando participación…</p>
      </div>
    );
  }

  if (!data || data.totalAssignments === 0) {
    return (
      <div className="py-20 text-center">
        <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
        <p className="font-bold text-[#1e293b]">Sin asignaciones</p>
        <p className="text-sm text-[#64748b] mt-1">Aún no hay evaluadores asignados en esta evaluación.</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Team filter */}
      {teams.length > 1 && (
        <div className="flex flex-wrap items-center gap-3 bg-slate-50 rounded-2xl p-4 border border-slate-100">
          <div className="flex items-center gap-2 text-[#64748b] shrink-0">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-semibold">Filtrar tablas</span>
          </div>
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
          >
            <option value="all">Todos los equipos</option>
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {filterTeam !== "all" && (
            <button
              onClick={() => setFilterTeam("all")}
              className="text-xs text-[#64748b] hover:text-[#1e293b] transition-colors font-medium"
            >
              Limpiar
            </button>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard
          icon={<UserCheck className="w-5 h-5" />}
          label="Participantes"
          value={evaluators.length}
          sub={`${(data.evaluatees ?? []).length} evaluado${(data.evaluatees ?? []).length !== 1 ? "s" : ""}`}
          color="#8b5cf6"
        />
        <KpiCard
          icon={<Users className="w-5 h-5" />}
          label="Total Asignaciones"
          value={data.totalAssignments}
          sub="pares evaluador-evaluado"
          color={BLUE}
        />
        <KpiCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Enviadas"
          value={data.submittedCount}
          sub={`de ${data.totalAssignments} asignaciones`}
          color={PRIMARY}
        />
        <KpiCard
          icon={<Clock className="w-5 h-5" />}
          label="Pendientes"
          value={data.pendingCount}
          sub={`${data.totalAssignments > 0 ? 100 - rate : 0}% sin enviar`}
          color={AMBER}
        />
        <KpiCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="% Completado"
          value={`${rate}%`}
          sub={rate >= 80 ? "Excelente" : rate >= 60 ? "Bueno" : rate >= 40 ? "Regular" : "Bajo"}
          color={rateColor(rate)}
        />
      </div>

      {/* Donut + Timeline */}
      <div className="grid md:grid-cols-2 gap-6">

        <ChartCard title="Estado de Evaluaciones">
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie
                data={donutData}
                cx="50%" cy="50%"
                innerRadius={65} outerRadius={95} paddingAngle={3}
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
                iconType="circle" iconSize={8}
                formatter={(v) => <span className="text-xs text-[#1e293b]">{v}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="text-center -mt-3">
            <p className="text-5xl font-black" style={{ color: rateColor(rate) }}>{rate}%</p>
            <p className="text-xs text-[#94a3b8] mt-1">tasa de completado</p>
          </div>
        </ChartCard>

        <ChartCard
          title="Evolución de Envíos"
          subtitle="Evaluaciones enviadas por día y acumuladas"
        >
          {timelineData.length < 2 ? (
            <Empty
              text={
                data.submittedCount === 0
                  ? "Aún no hay evaluaciones enviadas."
                  : "Solo hay envíos en un día."
              }
            />
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={timelineData} margin={{ top: 5, right: 10, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="gAcum360" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={PRIMARY} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={PRIMARY} stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="gDaily360" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={BLUE} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={BLUE} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="fecha"       tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8}
                  formatter={(v) => <span className="text-xs text-[#1e293b]">{v}</span>} />
                <Area type="monotone" dataKey="Acumuladas" stroke={PRIMARY} fill="url(#gAcum360)"  strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="Por día"    stroke={BLUE}   fill="url(#gDaily360)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

      </div>

      {/* Team charts */}
      {teamData.length > 1 && (
        <div className="grid md:grid-cols-2 gap-6">

          <ChartCard title="Evaluaciones por Equipo" subtitle="Enviadas vs. Pendientes por equipo de evaluado">
            <ResponsiveContainer width="100%" height={Math.max(180, teamData.length * 44)}>
              <BarChart data={teamData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: "#1e293b" }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8}
                  formatter={(v) => <span className="text-xs text-[#1e293b]">{v}</span>} />
                <Bar dataKey="Enviadas"   stackId="a" fill={PRIMARY} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Pendientes" stackId="a" fill={SLATE}   radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="% Completado por Equipo" subtitle="Ordenado de mayor a menor">
            <ResponsiveContainer width="100%" height={Math.max(180, teamRateData.length * 44)}>
              <BarChart data={teamRateData} layout="vertical" margin={{ top: 0, right: 52, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: "#1e293b" }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="% completado" fill={CYAN} radius={[0, 4, 4, 0]}>
                  <LabelList
                    dataKey="% completado" position="right"
                    style={{ fontSize: 10, fill: "#64748b" }}
                    formatter={(v) => `${v ?? 0}%`}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

        </div>
      )}

      {/* Tables section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Tab header */}
        <div className="px-6 pt-5 pb-0 border-b border-slate-100">
          <div className="flex items-center gap-6 flex-wrap mb-4">
            <button
              onClick={() => setTableTab("evaluatees")}
              className={`flex items-center gap-2 pb-3 text-sm font-bold border-b-2 transition-colors ${
                tableTab === "evaluatees"
                  ? "border-primary text-primary"
                  : "border-transparent text-[#64748b] hover:text-[#1e293b]"
              }`}
            >
              <Inbox className="w-4 h-4" />
              Falta por recibir
              {filteredEvaluatees.filter((e) => e.pending > 0).length > 0 && (
                <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
                  {filteredEvaluatees.filter((e) => e.pending > 0).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTableTab("evaluators")}
              className={`flex items-center gap-2 pb-3 text-sm font-bold border-b-2 transition-colors ${
                tableTab === "evaluators"
                  ? "border-primary text-primary"
                  : "border-transparent text-[#64748b] hover:text-[#1e293b]"
              }`}
            >
              <Send className="w-4 h-4" />
              Falta por hacer
              {evaluators.filter((e) => e.pending > 0).length > 0 && (
                <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
                  {evaluators.filter((e) => e.pending > 0).length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Evaluatees table ─────────────────────────────────────────────── */}
        {tableTab === "evaluatees" && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-5 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wide">Evaluado</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wide">Equipo</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wide text-center">Recibidas</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wide text-center">Pendientes</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wide text-center">Total</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wide text-center">% completado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pagedEvaluatees.map((e) => {
                    const pct = e.total > 0 ? Math.round((e.received / e.total) * 100) : 0;
                    return (
                      <tr key={e.email} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-[#1e293b]">{e.name || e.email}</p>
                          <p className="text-xs text-[#94a3b8]">{e.email}</p>
                        </td>
                        <td className="px-5 py-3 text-[#64748b]">
                          {e.team ?? <span className="text-[#cbd5e1]">—</span>}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className="font-bold text-emerald-600">{e.received}</span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          {e.pending > 0 ? (
                            <span className="font-bold text-amber-600">{e.pending}</span>
                          ) : (
                            <span className="text-[#94a3b8]">0</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center text-[#64748b]">{e.total}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, backgroundColor: rateColor(pct) }}
                              />
                            </div>
                            <span className="text-xs font-bold" style={{ color: rateColor(pct) }}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pagedEvaluatees.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-[#94a3b8]">
                        No hay evaluados con los filtros actuales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalPagesEval > 1 && (
              <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-4">
                <p className="text-xs text-[#94a3b8]">
                  {(pageEvaluatee - 1) * PAGE_SIZE + 1}–{Math.min(pageEvaluatee * PAGE_SIZE, filteredEvaluatees.length)} de {filteredEvaluatees.length}
                </p>
                <Pagination page={pageEvaluatee} total={totalPagesEval} onChange={setPageEvaluatee} />
              </div>
            )}
          </>
        )}

        {/* ── Evaluators table ─────────────────────────────────────────────── */}
        {tableTab === "evaluators" && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-5 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wide">Evaluador</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wide text-center">Enviadas</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wide text-center">Pendientes</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wide text-center">Total</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wide text-center">% completado</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wide text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pagedEvaluators.map((e) => {
                    const pct    = e.total > 0 ? Math.round((e.submitted / e.total) * 100) : 0;
                    const done   = e.pending === 0;
                    return (
                      <tr key={e.email} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-[#1e293b]">{e.name || e.email}</p>
                          <p className="text-xs text-[#94a3b8]">{e.email}</p>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className="font-bold text-emerald-600">{e.submitted}</span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          {e.pending > 0 ? (
                            <span className="font-bold text-amber-600">{e.pending}</span>
                          ) : (
                            <span className="text-[#94a3b8]">0</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center text-[#64748b]">{e.total}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, backgroundColor: rateColor(pct) }}
                              />
                            </div>
                            <span className="text-xs font-bold" style={{ color: rateColor(pct) }}>{pct}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-center">
                          {done ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                              <CheckCircle2 className="w-3 h-3" /> Completo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600">
                              <Clock className="w-3 h-3" /> Pendiente
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {pagedEvaluators.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-[#94a3b8]">
                        No hay evaluadores registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalPagesEvtor > 1 && (
              <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-4">
                <p className="text-xs text-[#94a3b8]">
                  {(pageEvaluator - 1) * PAGE_SIZE + 1}–{Math.min(pageEvaluator * PAGE_SIZE, evaluators.length)} de {evaluators.length}
                </p>
                <Pagination page={pageEvaluator} total={totalPagesEvtor} onChange={setPageEvaluator} />
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
