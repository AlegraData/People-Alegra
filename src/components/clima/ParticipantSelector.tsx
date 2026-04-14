"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, Users, ArrowLeft } from "lucide-react";
import type { Empleado } from "@/types/clima";

type SortField = "nombre_completo" | "equipo" | "cargo" | "fecha_original";
type SortDir = "asc" | "desc";
type PageSize = 25 | 50 | 100 | "all";

interface ParticipantSelectorProps {
  selected: Map<string, Empleado>;
  onSelectionChange: (selected: Map<string, Empleado>) => void;
  onBack: () => void;
  onConfirm: () => void;
}

const PAGE_SIZES: PageSize[] = [25, 50, 100, "all"];

export default function ParticipantSelector({
  selected,
  onSelectionChange,
  onBack,
  onConfirm,
}: ParticipantSelectorProps) {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("nombre_completo");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [loading, setLoading] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Debounce búsqueda 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Volver a página 1 cuando cambian los filtros
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sortBy, sortDir, pageSize]);

  // Fetch empleados
  const fetchEmpleados = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy,
        sortDir,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/empleados?${params}`);
      if (res.ok) {
        const json = await res.json();
        setEmpleados(json.data ?? []);
        setTotal(json.total ?? 0);
      }
    } catch {
      // error silencioso — UI muestra tabla vacía
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortBy, sortDir, debouncedSearch]);

  useEffect(() => {
    fetchEmpleados();
  }, [fetchEmpleados]);

  // Estado del checkbox "seleccionar página"
  const isAllPageSelected =
    empleados.length > 0 && empleados.every((e) => selected.has(e.employee_id));
  const isPartialPageSelected =
    empleados.some((e) => selected.has(e.employee_id)) && !isAllPageSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isPartialPageSelected;
    }
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
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  };

  const totalPages = pageSize === "all" ? 1 : Math.ceil(total / (pageSize as number));

  const visiblePages = (() => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  })();

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 text-primary" />
      : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  const columns: { label: string; field: SortField }[] = [
    { label: "Nombre completo", field: "nombre_completo" },
    { label: "Cargo",          field: "cargo" },
    { label: "Equipo",         field: "equipo" },
    { label: "Ingreso",        field: "fecha_original" },
  ];

  return (
    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="text-xl font-bold">Seleccionar Participantes</h3>
          <p className="text-sm text-[#64748b]">
            Elige quiénes responderán esta encuesta — {total} empleados activos
          </p>
        </div>
      </div>

      {/* Controles: búsqueda + page size */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, cargo, equipo o correo..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 shrink-0">
          {PAGE_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => setPageSize(size)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                pageSize === size
                  ? "bg-white shadow-sm text-[#1e293b]"
                  : "text-[#64748b] hover:text-[#1e293b]"
              }`}
            >
              {size === "all" ? "Todos" : size}
            </button>
          ))}
        </div>
      </div>

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
              <th className="pl-4 py-3 w-10">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={isAllPageSelected}
                  onChange={togglePage}
                  className="rounded accent-primary w-4 h-4 cursor-pointer"
                />
              </th>
              {columns.map((col) => (
                <th
                  key={col.field}
                  onClick={() => handleSort(col.field)}
                  className="py-3 pr-4 text-[10px] uppercase tracking-widest text-[#64748b] font-black cursor-pointer hover:text-[#1e293b] transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    {col.label}
                    <SortIcon field={col.field} />
                  </div>
                </th>
              ))}
              <th className="py-3 pr-4 text-[10px] uppercase tracking-widest text-[#64748b] font-black">
                Correo
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
                  No se encontraron empleados.
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
                    <td className="pl-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleEmployee(emp)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded accent-primary w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="py-3.5 pr-4 font-semibold text-sm text-[#1e293b]">
                      {emp.nombre_completo || "—"}
                    </td>
                    <td className="py-3.5 pr-4 text-sm text-[#64748b]">
                      {emp.cargo || "—"}
                    </td>
                    <td className="py-3.5 pr-4 text-sm text-[#64748b]">
                      {emp.equipo || "—"}
                    </td>
                    <td className="py-3.5 pr-4 text-xs text-[#64748b]">
                      {emp.fecha_original
                        ? new Date(emp.fecha_original).toLocaleDateString("es-CO", {
                            year: "numeric",
                            month: "short",
                          })
                        : "—"}
                    </td>
                    <td className="py-3.5 pr-4 text-xs text-[#64748b]">
                      {emp.correo}
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
                  page === p
                    ? "bg-primary text-white"
                    : "text-[#64748b] hover:bg-slate-100"
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
