"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, ChevronUp, ChevronDown, ChevronsUpDown,
  Users, ArrowLeft, SlidersHorizontal, X,
} from "lucide-react";
import type { Empleado } from "@/types/clima";

type SortField = "nombre_completo" | "equipo" | "cargo" | "fecha_original";
type SortDir   = "asc" | "desc";
type PageSize  = 25 | 50 | 100 | "all";

interface ParticipantSelectorProps {
  selected: Map<string, Empleado>;
  onSelectionChange: (selected: Map<string, Empleado>) => void;
  onBack: () => void;
  onConfirm: () => void;
}

const PAGE_SIZES: PageSize[] = [25, 50, 100, "all"];

export default function ParticipantSelector({
  selected, onSelectionChange, onBack, onConfirm,
}: ParticipantSelectorProps) {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState<PageSize>(25);
  const [search, setSearch]       = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy]       = useState<SortField>("nombre_completo");
  const [sortDir, setSortDir]     = useState<SortDir>("asc");
  const [loading, setLoading]     = useState(false);

  // ── Filtros ─────────────────────────────────────────────────────────────
  const [showFilters, setShowFilters] = useState(false);
  const [teams, setTeams]             = useState<string[]>([]);
  const [filterEquipo, setFilterEquipo]       = useState("");
  const [filterFechaDesde, setFilterFechaDesde] = useState("");
  const [filterFechaHasta, setFilterFechaHasta] = useState("");

  const selectAllRef = useRef<HTMLInputElement>(null);

  const hasActiveFilters = !!(filterEquipo || filterFechaDesde || filterFechaHasta);

  const clearFilters = () => {
    setFilterEquipo("");
    setFilterFechaDesde("");
    setFilterFechaHasta("");
  };

  // Cargar equipos una sola vez
  useEffect(() => {
    fetch("/api/empleados/teams")
      .then((r) => r.ok ? r.json() : [])
      .then((data: string[]) => setTeams(data))
      .catch(() => {});
  }, []);

  // Debounce búsqueda
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Volver a pág 1 al cambiar filtros
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sortBy, sortDir, pageSize, filterEquipo, filterFechaDesde, filterFechaHasta]);

  const fetchEmpleados = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page:     String(page),
        pageSize: String(pageSize),
        sortBy,
        sortDir,
      });
      if (debouncedSearch)  params.set("search",     debouncedSearch);
      if (filterEquipo)     params.set("equipo",     filterEquipo);
      if (filterFechaDesde) params.set("fechaDesde", filterFechaDesde);
      if (filterFechaHasta) params.set("fechaHasta", filterFechaHasta);

      const res = await fetch(`/api/empleados?${params}`);
      if (res.ok) {
        const json = await res.json();
        setEmpleados(json.data ?? []);
        setTotal(json.total ?? 0);
      }
    } catch {
      // error silencioso
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortBy, sortDir, debouncedSearch, filterEquipo, filterFechaDesde, filterFechaHasta]);

  useEffect(() => { fetchEmpleados(); }, [fetchEmpleados]);

  const isAllPageSelected =
    empleados.length > 0 && empleados.every((e) => selected.has(e.employee_id));
  const isPartialPageSelected =
    empleados.some((e) => selected.has(e.employee_id)) && !isAllPageSelected;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = isPartialPageSelected;
  }, [isPartialPageSelected]);

  const toggleEmployee = (emp: Empleado) => {
    const next = new Map(selected);
    next.has(emp.employee_id) ? next.delete(emp.employee_id) : next.set(emp.employee_id, emp);
    onSelectionChange(next);
  };

  const togglePage = () => {
    const next = new Map(selected);
    isAllPageSelected
      ? empleados.forEach((e) => next.delete(e.employee_id))
      : empleados.forEach((e) => next.set(e.employee_id, e));
    onSelectionChange(next);
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setSortDir("asc"); }
  };

  const totalPages  = pageSize === "all" ? 1 : Math.ceil(total / (pageSize as number));
  const visiblePages = (() => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end   = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  })();

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 text-primary" />
      : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  return (
    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="text-xl font-bold">Seleccionar Participantes</h3>
          <p className="text-sm text-[#64748b]">
            Elige quiénes responderán esta encuesta — {total} empleado{total !== 1 ? "s" : ""} activo{total !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Fila 1: búsqueda + page size + botón filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, cargo, equipo o correo..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Botón filtros */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all shrink-0 ${
            hasActiveFilters
              ? "bg-primary/10 text-primary border-primary/30"
              : showFilters
                ? "bg-slate-100 text-[#1e293b] border-slate-200"
                : "bg-slate-50 text-[#64748b] border-slate-200 hover:border-slate-300"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filtros
          {hasActiveFilters && (
            <span className="bg-primary text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center">
              {[filterEquipo, filterFechaDesde, filterFechaHasta].filter(Boolean).length}
            </span>
          )}
        </button>

        {/* Page size */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 shrink-0">
          {PAGE_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => setPageSize(size)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                pageSize === size ? "bg-white shadow-sm text-[#1e293b]" : "text-[#64748b] hover:text-[#1e293b]"
              }`}
            >
              {size === "all" ? "Todos" : size}
            </button>
          ))}
        </div>
      </div>

      {/* Fila 2: panel de filtros (colapsable) */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 mb-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">

          {/* Equipo */}
          <div className="flex flex-col gap-1 min-w-[180px] flex-1">
            <label className="text-[10px] font-black uppercase text-[#64748b] tracking-widest">Equipo</label>
            <select
              value={filterEquipo}
              onChange={(e) => setFilterEquipo(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="">Todos los equipos</option>
              {teams.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Fecha desde */}
          <div className="flex flex-col gap-1 min-w-[150px]">
            <label className="text-[10px] font-black uppercase text-[#64748b] tracking-widest">
              Ingreso desde
            </label>
            <input
              type="date"
              value={filterFechaDesde}
              onChange={(e) => setFilterFechaDesde(e.target.value)}
              max={filterFechaHasta || undefined}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary transition-colors cursor-pointer"
            />
          </div>

          {/* Fecha hasta */}
          <div className="flex flex-col gap-1 min-w-[150px]">
            <label className="text-[10px] font-black uppercase text-[#64748b] tracking-widest">
              Ingreso hasta
            </label>
            <input
              type="date"
              value={filterFechaHasta}
              onChange={(e) => setFilterFechaHasta(e.target.value)}
              min={filterFechaDesde || undefined}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary transition-colors cursor-pointer"
            />
          </div>

          {/* Limpiar filtros */}
          {hasActiveFilters && (
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-error bg-error/5 hover:bg-error/10 rounded-xl transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tags de filtros activos (resumen compacto cuando el panel está cerrado) */}
      {!showFilters && hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mb-3">
          {filterEquipo && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">
              Equipo: {filterEquipo}
              <button onClick={() => setFilterEquipo("")} className="hover:opacity-70">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {(filterFechaDesde || filterFechaHasta) && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">
              Ingreso:{filterFechaDesde ? ` desde ${filterFechaDesde}` : ""}{filterFechaHasta ? ` hasta ${filterFechaHasta}` : ""}
              <button onClick={() => { setFilterFechaDesde(""); setFilterFechaHasta(""); }} className="hover:opacity-70">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Banner de seleccionados */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-primary">
              {selected.size} participante{selected.size !== 1 ? "s" : ""} seleccionado{selected.size !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            onClick={() => onSelectionChange(new Map())}
            className="text-xs font-bold text-[#64748b] hover:text-error transition-colors"
          >
            Limpiar selección
          </button>
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {/* Checkbox header */}
              <th className="pl-4 pr-3 py-3 w-12">
                <div className="flex items-center justify-center">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={isAllPageSelected}
                    onChange={togglePage}
                    className="rounded accent-primary w-4 h-4 cursor-pointer"
                  />
                </div>
              </th>
              <th onClick={() => handleSort("nombre_completo")} className="py-3 pr-4 text-[10px] uppercase tracking-widest text-[#64748b] font-black cursor-pointer hover:text-[#1e293b] transition-colors select-none">
                <div className="flex items-center gap-1.5">Nombre completo <SortIcon field="nombre_completo" /></div>
              </th>
              <th className="py-3 pr-4 text-[10px] uppercase tracking-widest text-[#64748b] font-black">Correo</th>
              <th onClick={() => handleSort("equipo")} className="py-3 pr-4 text-[10px] uppercase tracking-widest text-[#64748b] font-black cursor-pointer hover:text-[#1e293b] transition-colors select-none">
                <div className="flex items-center gap-1.5">Equipo <SortIcon field="equipo" /></div>
              </th>
              <th onClick={() => handleSort("cargo")} className="py-3 pr-4 text-[10px] uppercase tracking-widest text-[#64748b] font-black cursor-pointer hover:text-[#1e293b] transition-colors select-none">
                <div className="flex items-center gap-1.5">Cargo <SortIcon field="cargo" /></div>
              </th>
              <th onClick={() => handleSort("fecha_original")} className="py-3 pr-4 text-[10px] uppercase tracking-widest text-[#64748b] font-black cursor-pointer hover:text-[#1e293b] transition-colors select-none">
                <div className="flex items-center gap-1.5">Ingreso <SortIcon field="fecha_original" /></div>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </td>
              </tr>
            ) : empleados.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-sm text-[#64748b]">
                  No se encontraron empleados con los filtros aplicados.
                </td>
              </tr>
            ) : (
              empleados.map((emp) => {
                const isSelected = selected.has(emp.employee_id);
                return (
                  <tr
                    key={emp.employee_id}
                    onClick={() => toggleEmployee(emp)}
                    className={`border-b border-slate-50 cursor-pointer transition-colors ${
                      isSelected ? "bg-primary/5" : "hover:bg-slate-50/60"
                    }`}
                  >
                    {/* Checkbox — centrado y con gap respecto al nombre */}
                    <td className="pl-4 pr-3 py-3.5 w-12 align-middle">
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleEmployee(emp)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded accent-primary w-4 h-4 cursor-pointer"
                        />
                      </div>
                    </td>
                    <td className="py-3.5 pr-4 font-semibold text-sm text-[#1e293b] whitespace-nowrap align-middle">
                      {emp.nombre_completo || "—"}
                    </td>
                    <td className="py-3.5 pr-4 text-xs text-[#64748b] whitespace-nowrap align-middle">
                      {emp.correo}
                    </td>
                    <td className="py-3.5 pr-4 text-sm text-[#64748b] whitespace-nowrap align-middle">
                      {emp.equipo
                        ? <span className="px-2 py-0.5 bg-slate-100 rounded-md text-xs font-semibold">{emp.equipo}</span>
                        : "—"}
                    </td>
                    <td className="py-3.5 pr-4 text-sm text-[#64748b] whitespace-nowrap align-middle">
                      {emp.cargo || "—"}
                    </td>
                    <td className="py-3.5 pr-4 text-xs text-[#64748b] whitespace-nowrap align-middle">
                      {emp.fecha_original
                        ? emp.fecha_original.slice(0, 10)
                        : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {pageSize !== "all" && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
          <p className="text-xs text-[#64748b]">
            {total} empleados · página {page} de {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              ← Anterior
            </button>
            {visiblePages.map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 text-xs font-bold rounded-lg transition-colors ${
                  page === p ? "bg-primary text-white" : "text-[#64748b] hover:bg-slate-100"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
      {pageSize === "all" && !loading && (
        <p className="text-xs text-[#64748b] mt-4">{total} empleados en total</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
        <p className="text-sm text-[#64748b]">
          {selected.size === 0
            ? "Selecciona al menos un participante para continuar"
            : `${selected.size} participante${selected.size !== 1 ? "s" : ""} seleccionado${selected.size !== 1 ? "s" : ""}`}
        </p>
        <button
          onClick={onConfirm}
          disabled={selected.size === 0}
          className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Crear Encuesta
        </button>
      </div>
    </div>
  );
}
