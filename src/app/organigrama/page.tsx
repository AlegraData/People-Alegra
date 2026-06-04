"use client";
import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, Users, RefreshCw, Eye, EyeOff, GitBranch } from "lucide-react";
import Link from "next/link";
import type { OrgData } from "@/app/api/organigrama/route";

const OrgChartFlow = dynamic(
  () => import("@/components/organigrama/OrgChartFlow"),
  { ssr: false, loading: () => (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="w-10 h-10 border-4 border-[#00D6BC] border-t-transparent rounded-full animate-spin" />
    </div>
  )}
);

export default function OrganigramaPage() {
  const [data, setData]               = useState<OrgData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/organigrama");
      if (!res.ok) throw new Error("Error al cargar el organigrama");
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeCount   = data?.employees.filter((e) => e.es_activo).length ?? 0;
  const inactiveCount = data?.employees.filter((e) => !e.es_activo).length ?? 0;
  const totalLinks    = data?.relations.length ?? 0;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] gap-4">
      {/* Header */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#64748b] hover:text-primary transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Inicio
        </Link>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-3xl font-black text-[#1e293b] flex items-center gap-2">
              <GitBranch className="w-7 h-7 text-primary" />
              Organigrama
            </h2>
            <p className="text-[#64748b]">Estructura jerárquica del equipo</p>
          </div>

          {/* Stats + controles */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Estadísticas */}
            {data && (
              <div className="flex items-center gap-2 bg-white border border-slate-100 shadow-sm rounded-2xl px-4 py-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  {activeCount} activos
                </span>
                <span className="text-slate-300">|</span>
                <span className="flex items-center gap-1.5 text-xs font-bold text-[#94a3b8]">
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                  {inactiveCount} inactivos
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-xs font-bold text-[#64748b]">
                  <Users className="w-3 h-3 inline mr-1" />
                  {totalLinks} relaciones
                </span>
              </div>
            )}

            {/* Toggle inactivos */}
            <button
              onClick={() => setShowInactive((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                showInactive
                  ? "bg-slate-700 text-white border-slate-700"
                  : "bg-white text-[#64748b] border-slate-200 hover:border-slate-300"
              }`}
            >
              {showInactive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {showInactive ? "Ocultar inactivos" : "Ver inactivos"}
            </button>

            {/* Refresh */}
            <button
              onClick={load}
              disabled={loading}
              className="p-2 rounded-xl bg-white border border-slate-200 text-[#64748b] hover:text-primary hover:border-primary/40 transition-all disabled:opacity-50"
              title="Recargar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 rounded-2xl overflow-hidden border border-slate-100 shadow-sm min-h-0">
        {loading && !data ? (
          <div className="flex items-center justify-center h-full bg-[#f8fafc]">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 border-4 border-[#00D6BC] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-medium text-[#64748b]">Cargando organigrama…</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full bg-[#f8fafc]">
            <div className="text-center space-y-2">
              <p className="text-red-500 font-bold">{error}</p>
              <button onClick={load} className="text-sm text-primary underline">Reintentar</button>
            </div>
          </div>
        ) : data && data.relations.length === 0 ? (
          <div className="flex items-center justify-center h-full bg-[#f8fafc]">
            <div className="text-center space-y-2">
              <GitBranch className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-[#64748b] font-medium">No hay relaciones de liderazgo activas</p>
            </div>
          </div>
        ) : data ? (
          <OrgChartFlow data={data} showInactive={showInactive} />
        ) : null}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 text-[10px] font-bold text-[#64748b] uppercase tracking-wide px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-400" /> Activo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-slate-300" /> Inactivo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-6 h-0.5 bg-[#00D6BC]" /> Relación de liderazgo
        </span>
        <span className="text-slate-400 ml-auto normal-case font-normal">
          Arrastra nodos · Scroll para zoom · Minimap esquina inferior derecha
        </span>
      </div>
    </div>
  );
}
