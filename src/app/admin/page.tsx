"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import React from "react";
import {
  Shield, Search, Trash2, Users, Crown, BarChart2, Eye,
  Layers, Check, X, ChevronDown, ChevronUp, ChevronLeft,
} from "lucide-react";
import Link from "next/link";

type Role = "admin" | "manager" | "viewer";

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

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers]             = useState<AdminUser[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [updating, setUpdating]       = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedUser, setExpandedUser]   = useState<string | null>(null);
  const [moduleEdits, setModuleEdits]     = useState<Record<string, string>>({});
  const [savingModules, setSavingModules] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const init = async () => {
      const roleRes = await fetch("/api/auth/role");
      if (!roleRes.ok) { router.replace("/login"); return; }
      const { role } = await roleRes.json();
      if (role !== "admin") { router.replace("/"); return; }
      await loadUsers();
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

  // ── Filtro ──────────────────────────────────────────────────────────────────
  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q) || (u.full_name ?? "").toLowerCase().includes(q);
  });

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
        <p className="text-[#64748b] mt-1">Gestiona los accesos y roles de los usuarios de la plataforma.</p>
      </div>

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
        {/* Buscador */}
        <div className="p-6 border-b border-slate-100">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o email..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary transition-colors"
            />
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
                {filtered.map((u) => {
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
      </div>
    </div>
  );
}
