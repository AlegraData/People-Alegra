"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import React from "react";
import {
  Shield, Search, Trash2, Users, Crown, BarChart2, Eye,
  Layers, Check, X, ChevronDown, ChevronUp, ChevronLeft,
  TrendingUp, MessageSquare, UserRound, Power, LayoutGrid,
} from "lucide-react";
import Link from "next/link";

type Role = "admin" | "manager" | "viewer";
type PageSize = 10 | 25 | 50 | 100 | "all";
type AdminTab = "usuarios" | "modulos";

interface ModuleConfig {
  id: string;
  label: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  min_role: "viewer" | "manager" | "admin";
}

const MIN_ROLE_OPTIONS: { value: "viewer" | "manager" | "admin"; label: string }[] = [
  { value: "viewer",  label: "Todos"       },
  { value: "manager", label: "Managers+"   },
  { value: "admin",   label: "Solo Admin"  },
];
const PAGE_SIZES: PageSize[] = [10, 25, 50, 100, "all"];

interface ModuleRole { module: string; role: Role; }

interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: Role;
  created_at: string;
  moduleRoles: ModuleRole[];
}

const MODULES = [
  { id: "clima", label: "Clima" },
  { id: "enps",  label: "eNPS"  },
  { id: "360",   label: "360°"  },
];

const ROLE_CONFIG: Record<Role, { label: string; color: string; icon: React.ReactNode }> = {
  admin:   { label: "Admin",   color: "bg-[#1e293b] text-white",   icon: <Crown    className="w-3 h-3" /> },
  manager: { label: "Manager", color: "bg-primary/10 text-primary", icon: <BarChart2 className="w-3 h-3" /> },
  viewer:  { label: "Viewer",  color: "bg-slate-100 text-[#64748b]",icon: <Eye      className="w-3 h-3" /> },
};

const MODULE_ROLE_COLORS: Record<Role, string> = {
  admin:   "bg-[#1e293b]/8 text-[#1e293b]",
  manager: "bg-primary/10 text-primary",
  viewer:  "bg-slate-100 text-[#64748b]",
};

const MODULE_ICONS: Record<string, React.ReactNode> = {
  enps:  <TrendingUp    className="w-6 h-6" />,
  clima: <MessageSquare className="w-6 h-6" />,
  "360": <UserRound     className="w-6 h-6" />,
};

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers]             = useState<AdminUser[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [updating, setUpdating]       = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedUser, setExpandedUser]   = useState<string | null>(null);
  const [moduleEdits, setModuleEdits]     = useState<Record<string, string>>({});
  const [page, setPage]                   = useState(1);
  const [pageSize, setPageSize]           = useState<PageSize>(10);
  const [savingModules, setSavingModules]   = useState(false);
  const [activeTab, setActiveTab]           = useState<AdminTab>("usuarios");
  const [moduleList, setModuleList]         = useState<ModuleConfig[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [togglingModule, setTogglingModule] = useState<string | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const init = async () => {
      const roleRes = await fetch("/api/auth/role");
      if (!roleRes.ok) { router.replace("/login"); return; }
      const { role } = await roleRes.json();
      if (role !== "admin") { router.replace("/"); return; }
      await Promise.all([loadUsers(), loadModules()]);
    };
    init();
  }, []);

  useEffect(() => () => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/usuarios");
      if (res.ok) setUsers(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const loadModules = async () => {
    setModulesLoading(true);
    try {
      const res = await fetch("/api/admin/modules");
      if (res.ok) setModuleList(await res.json());
    } finally {
      setModulesLoading(false);
    }
  };

  const patchModule = async (id: string, body: Record<string, unknown>) => {
    setTogglingModule(id);
    try {
      const res = await fetch(`/api/admin/modules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        setModuleList((prev) => prev.map((m) => m.id === id ? { ...m, ...updated } : m));
      } else {
        alert("Error al actualizar el módulo.");
      }
    } finally {
      setTogglingModule(null);
    }
  };

  const handleToggleModule = (id: string, isActive: boolean) =>
    patchModule(id, { isActive });

  const handleSetMinRole = (id: string, minRole: string) =>
    patchModule(id, { minRole });

  // ── Rol global ──────────────────────────────────────────────────────────────
  const handleRoleChange = async (userId: string, newRole: Role) => {
    setUpdating(userId);
    try {
      const res = await fetch(`/api/admin/usuarios/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => u.user_id === userId ? { ...u, role: newRole } : u));
      } else {
        const { error } = await res.json();
        alert(error ?? "Error al cambiar el rol.");
      }
    } finally {
      setUpdating(null);
    }
  };

  // ── Eliminar usuario ────────────────────────────────────────────────────────
  const handleDeleteClick = (userId: string) => {
    if (confirmDelete === userId) {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      setConfirmDelete(null);
      deleteUser(userId);
    } else {
      setConfirmDelete(userId);
      deleteTimerRef.current = setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/usuarios/${userId}`, { method: "DELETE" });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.user_id !== userId));
        if (expandedUser === userId) setExpandedUser(null);
      } else {
        const { error } = await res.json();
        alert(error ?? "Error al eliminar el usuario.");
      }
    } catch {
      alert("Error de red al eliminar el usuario.");
    }
  };

  // ── Editor de módulos ───────────────────────────────────────────────────────
  const handleExpandModules = (u: AdminUser) => {
    if (expandedUser === u.user_id) {
      setExpandedUser(null);
      setModuleEdits({});
      return;
    }
    setExpandedUser(u.user_id);
    // Pre-cargar los valores actuales
    const edits: Record<string, string> = {};
    u.moduleRoles.forEach((mr) => { edits[mr.module] = mr.role; });
    setModuleEdits(edits);
  };

  const handleSaveModules = async (userId: string) => {
    setSavingModules(true);
    try {
      const res = await fetch(`/api/admin/usuarios/${userId}/modules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(moduleEdits),
      });
      if (res.ok) {
        const { assigned } = await res.json();
        setUsers((prev) =>
          prev.map((u) =>
            u.user_id === userId ? { ...u, moduleRoles: assigned } : u
          )
        );
        setExpandedUser(null);
        setModuleEdits({});
      } else {
        const { error } = await res.json();
        alert(error ?? "Error al guardar los módulos.");
      }
    } finally {
      setSavingModules(false);
    }
  };

  // ── Filtro + paginación ─────────────────────────────────────────────────────
  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q) || (u.full_name ?? "").toLowerCase().includes(q);
  });

  // Resetear a página 1 cuando cambia la búsqueda
  useEffect(() => { setPage(1); }, [search]);

  const totalPages  = pageSize === "all" ? 1 : Math.ceil(filtered.length / (pageSize as number));
  const paginated   = pageSize === "all"
    ? filtered
    : filtered.slice((page - 1) * (pageSize as number), page * (pageSize as number));

  const visiblePages = (() => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end   = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  })();

  const counts = users.reduce(
    (acc, u) => { acc[u.role] = (acc[u.role] ?? 0) + 1; return acc; },
    {} as Record<Role, number>
  );

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-20 gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-primary font-bold">Cargando panel...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Botón volver */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#64748b] hover:text-primary transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Inicio
      </Link>

      {/* Encabezado */}
      <div>
        <h2 className="text-3xl font-black text-[#1e293b] flex items-center gap-3">
          <Shield className="text-primary w-8 h-8" />
          Panel de Administración
        </h2>
        <p className="text-[#64748b] mt-1">
          {activeTab === "usuarios"
            ? "Gestiona los accesos y roles de los usuarios de la plataforma."
            : "Activa o desactiva los módulos disponibles en la plataforma."}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("usuarios")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === "usuarios"
              ? "bg-white shadow-sm text-[#1e293b]"
              : "text-[#64748b] hover:text-[#1e293b]"
          }`}
        >
          <Users className="w-4 h-4" />
          Usuarios
        </button>
        <button
          onClick={() => setActiveTab("modulos")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === "modulos"
              ? "bg-white shadow-sm text-[#1e293b]"
              : "text-[#64748b] hover:text-[#1e293b]"
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          Módulos
        </button>
      </div>

      {/* ── Tab: Módulos ────────────────────────────────────────────────────────── */}
      {activeTab === "modulos" && (
        modulesLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {moduleList.map((mod) => {
              const isBusy = togglingModule === mod.id;
              return (
                <div
                  key={mod.id}
                  className={`bg-white rounded-[2rem] p-7 border shadow-sm flex flex-col gap-5 transition-all ${
                    mod.is_active ? "border-slate-100" : "border-slate-100 opacity-60"
                  }`}
                >
                  {/* Icono + toggle activo/inactivo */}
                  <div className="flex items-start justify-between gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                      mod.is_active ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-400"
                    }`}>
                      {MODULE_ICONS[mod.id] ?? <Power className="w-6 h-6" />}
                    </div>

                    <button
                      onClick={() => handleToggleModule(mod.id, !mod.is_active)}
                      disabled={isBusy}
                      title={mod.is_active ? "Desactivar módulo" : "Activar módulo"}
                      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-60 ${
                        mod.is_active ? "bg-primary" : "bg-slate-200"
                      }`}
                    >
                      {isBusy ? (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </span>
                      ) : (
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                          mod.is_active ? "translate-x-6" : "translate-x-1"
                        }`} />
                      )}
                    </button>
                  </div>

                  {/* Nombre + descripción */}
                  <div className="flex-1">
                    <h3 className="text-lg font-black text-[#1e293b]">{mod.label}</h3>
                    {mod.description && (
                      <p className="text-sm text-[#64748b] mt-1.5 leading-relaxed">{mod.description}</p>
                    )}
                  </div>

                  {/* Visibilidad por rol */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">
                      Visible para
                    </p>
                    <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
                      {MIN_ROLE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleSetMinRole(mod.id, opt.value)}
                          disabled={isBusy || !mod.is_active}
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all disabled:opacity-40 ${
                            mod.min_role === opt.value
                              ? "bg-white shadow-sm text-[#1e293b]"
                              : "text-[#64748b] hover:text-[#1e293b]"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Estado */}
                  <div className="pt-4 border-t border-slate-50">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      mod.is_active
                        ? "bg-[#10B981]/10 text-[#10B981]"
                        : "bg-slate-100 text-[#64748b]"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${mod.is_active ? "bg-[#10B981]" : "bg-slate-400"}`} />
                      {mod.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── Tab: Usuarios ───────────────────────────────────────────────────────── */}
      {activeTab === "usuarios" && <>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total",    value: users.length,        icon: <Users    className="w-5 h-5" />, color: "text-[#1e293b]", bg: "bg-slate-100"    },
          { label: "Admins",   value: counts.admin   ?? 0, icon: <Crown    className="w-5 h-5" />, color: "text-[#1e293b]", bg: "bg-[#1e293b]/5"  },
          { label: "Managers", value: counts.manager ?? 0, icon: <BarChart2 className="w-5 h-5" />,color: "text-primary",   bg: "bg-primary/5"    },
          { label: "Viewers",  value: counts.viewer  ?? 0, icon: <Eye      className="w-5 h-5" />, color: "text-[#64748b]", bg: "bg-slate-100"    },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3 ${stat.bg} ${stat.color}`}>
              {stat.icon}
            </div>
            <p className="text-2xl font-black text-[#1e293b]">{stat.value}</p>
            <p className="text-xs font-bold uppercase tracking-widest text-[#64748b] mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        {/* Buscador + selector de página */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o email..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 shrink-0">
              {PAGE_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => { setPageSize(size); setPage(1); }}
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
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-[#64748b]">
            {search ? "Sin resultados para esa búsqueda." : "No hay usuarios registrados aún."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[10px] font-black uppercase tracking-widest text-[#64748b] px-6 py-4">Usuario</th>
                  <th className="text-left text-[10px] font-black uppercase tracking-widest text-[#64748b] px-6 py-4 hidden md:table-cell">Email</th>
                  <th className="text-left text-[10px] font-black uppercase tracking-widest text-[#64748b] px-6 py-4">Rol Global</th>
                  <th className="text-left text-[10px] font-black uppercase tracking-widest text-[#64748b] px-6 py-4 hidden lg:table-cell">Módulos</th>
                  <th className="px-6 py-4" />
                </tr>
              </thead>
              <tbody>
                {paginated.map((u) => {
                  const cfg          = ROLE_CONFIG[u.role];
                  const isUpdating   = updating === u.user_id;
                  const isConfirming = confirmDelete === u.user_id;
                  const isExpanded   = expandedUser === u.user_id;

                  return (
                    <React.Fragment key={u.id}>
                      {/* ── Fila principal ───────────────────────────────── */}
                      <tr
                        className={`border-t border-slate-50 transition-colors ${isExpanded ? "bg-slate-50/60" : "hover:bg-slate-50/40"}`}
                      >
                        {/* Avatar + nombre */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {u.avatar_url ? (
                              <img
                                src={u.avatar_url}
                                alt={u.full_name ?? u.email}
                                className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-100 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-sm font-black text-primary">
                                  {(u.full_name ?? u.email)[0].toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[#1e293b] truncate">{u.full_name ?? "—"}</p>
                              <p className="text-xs text-[#64748b] truncate md:hidden">{u.email}</p>
                              {/* Chips de módulos en mobile */}
                              {u.moduleRoles.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1 lg:hidden">
                                  {u.moduleRoles.map((mr) => (
                                    <span key={mr.module} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black ${MODULE_ROLE_COLORS[mr.role as Role]}`}>
                                      {MODULES.find((m) => m.id === mr.module)?.label}: {ROLE_CONFIG[mr.role as Role].label}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="px-6 py-4 hidden md:table-cell">
                          <span className="text-sm text-[#64748b]">{u.email}</span>
                        </td>

                        {/* Rol global */}
                        <td className="px-6 py-4">
                          <div className="relative inline-flex">
                            <select
                              value={u.role}
                              disabled={isUpdating}
                              onChange={(e) => handleRoleChange(u.user_id, e.target.value as Role)}
                              className={`appearance-none text-xs font-black uppercase tracking-wider pl-7 pr-4 py-1.5 rounded-full border-0 outline-none cursor-pointer transition-all disabled:opacity-50 ${cfg.color}`}
                            >
                              <option value="admin">Admin</option>
                              <option value="manager">Manager</option>
                              <option value="viewer">Viewer</option>
                            </select>
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                              {isUpdating
                                ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin block" />
                                : cfg.icon}
                            </span>
                          </div>
                        </td>

                        {/* Chips de módulos (desktop) */}
                        <td className="px-6 py-4 hidden lg:table-cell">
                          {u.moduleRoles.length === 0 ? (
                            <span className="text-xs text-slate-300 italic">Sin asignaciones</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {u.moduleRoles.map((mr) => (
                                <span
                                  key={mr.module}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black ${MODULE_ROLE_COLORS[mr.role as Role]}`}
                                >
                                  {MODULES.find((m) => m.id === mr.module)?.label}
                                  <span className="opacity-60">·</span>
                                  {ROLE_CONFIG[mr.role as Role].label}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {/* Botón módulos */}
                            <button
                              onClick={() => handleExpandModules(u)}
                              title="Gestionar permisos por módulo"
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                isExpanded
                                  ? "bg-primary text-white"
                                  : "text-[#64748b] hover:bg-primary/10 hover:text-primary"
                              }`}
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Módulos</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>

                            {/* Botón eliminar */}
                            <button
                              onClick={() => handleDeleteClick(u.user_id)}
                              title={isConfirming ? "Clic de nuevo para confirmar" : "Eliminar acceso"}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                isConfirming
                                  ? "bg-error text-white"
                                  : "text-[#64748b] hover:bg-error/10 hover:text-error"
                              }`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">
                                {isConfirming ? "¿Confirmar?" : "Eliminar"}
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* ── Fila expandida: editor de módulos ────────────── */}
                      {isExpanded && (
                        <tr className="bg-slate-50 border-t border-slate-100">
                          <td colSpan={5} className="px-6 py-5">
                            <div className="max-w-2xl">
                              <p className="text-xs font-black uppercase tracking-widest text-[#64748b] mb-4 flex items-center gap-2">
                                <Layers className="w-3.5 h-3.5 text-primary" />
                                Permisos por módulo — {u.full_name ?? u.email}
                              </p>
                              <div className="flex flex-wrap gap-4 mb-5">
                                {MODULES.map((mod) => {
                                  const currentVal = moduleEdits[mod.id] ?? "";
                                  return (
                                    <div key={mod.id} className="flex flex-col gap-1.5 min-w-[120px]">
                                      <label className="text-[10px] font-black uppercase tracking-wider text-[#64748b]">
                                        {mod.label}
                                      </label>
                                      <select
                                        value={currentVal}
                                        onChange={(e) =>
                                          setModuleEdits((prev) => ({ ...prev, [mod.id]: e.target.value }))
                                        }
                                        className={`
                                          text-xs font-bold px-3 py-2 rounded-xl border outline-none
                                          focus:border-primary transition-colors cursor-pointer
                                          ${currentVal
                                            ? "bg-white border-primary/30 text-[#1e293b]"
                                            : "bg-slate-100 border-slate-200 text-[#64748b]"}
                                        `}
                                      >
                                        <option value="">— Rol global ({u.role})</option>
                                        <option value="viewer">Viewer</option>
                                        <option value="manager">Manager</option>
                                        <option value="admin">Admin</option>
                                      </select>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => handleSaveModules(u.user_id)}
                                  disabled={savingModules}
                                  className="flex items-center gap-2 bg-primary text-white px-5 py-2 rounded-xl text-xs font-bold hover:shadow-md hover:shadow-primary/20 transition-all disabled:opacity-60"
                                >
                                  {savingModules
                                    ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    : <Check className="w-3.5 h-3.5" />}
                                  Guardar permisos
                                </button>
                                <button
                                  onClick={() => { setExpandedUser(null); setModuleEdits({}); }}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-[#64748b] hover:bg-slate-200 transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {filtered.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-100">
            {pageSize !== "all" && totalPages > 1 ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs text-[#64748b]">
                  {filtered.length} usuario{filtered.length !== 1 ? "s" : ""} · página {page} de {totalPages}
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
            ) : (
              <p className="text-xs text-[#64748b]">
                {filtered.length} usuario{filtered.length !== 1 ? "s" : ""} en total
              </p>
            )}
          </div>
        )}
      </div>

      </>}
    </div>
  );
}
