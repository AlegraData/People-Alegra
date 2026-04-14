"use client";
import { useEffect, useState, useRef } from "react";
import { Bell, LogOut, Shield, ClipboardList, ChevronRight, CheckCircle2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PendingSurvey {
  id: string;
  title: string;
  description: string;
}

export default function Header() {
  const [user, setUser]                   = useState<any>(null);
  const [role, setRole]                   = useState<string>("");
  const [cargo, setCargo]                 = useState<string>("");
  const [pendingSurveys, setPendingSurveys] = useState<PendingSurvey[]>([]);
  const [showNotif, setShowNotif]         = useState(false);
  const notifRef                          = useRef<HTMLDivElement>(null);
  const supabase                          = createClient();
  const router                            = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);

      const [roleRes, profileRes, surveysRes] = await Promise.allSettled([
        fetch("/api/auth/role"),
        fetch("/api/auth/profile"),
        fetch("/api/clima/surveys"),
      ]);

      if (roleRes.status === "fulfilled" && roleRes.value.ok) {
        const { role } = await roleRes.value.json();
        setRole(role ?? "viewer");
      } else {
        setRole("viewer");
      }

      if (profileRes.status === "fulfilled" && profileRes.value.ok) {
        const { cargo } = await profileRes.value.json();
        setCargo(cargo ?? "");
      }

      if (surveysRes.status === "fulfilled" && surveysRes.value.ok) {
        const surveys = await surveysRes.value.json();
        if (Array.isArray(surveys)) {
          setPendingSurveys(
            surveys
              .filter((s: any) => s.isActive && !s.hasResponded)
              .map((s: any) => ({ id: s.id, title: s.title, description: s.description ?? "" }))
          );
        }
      }
    };
    init();
  }, []);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (!user) return null;

  const subtitle      = cargo || role;
  const hasUnread     = pendingSurveys.length > 0;
  const badgeCount    = pendingSurveys.length > 9 ? "9+" : String(pendingSurveys.length);

  return (
    <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="p-1 rounded-lg">
          <img src="https://www.alegra.com/favicon.ico" alt="Alegra" className="w-8 h-8 object-contain" />
        </div>
        <h1 className="text-xl font-black tracking-tight text-[#1e293b] leading-none">
          People <span className="text-primary">Alegra</span>
        </h1>
      </div>

      <div className="flex items-center gap-2 md:gap-6">
        {/* Link al panel admin */}
        {role === "admin" && (
          <Link
            href="/admin"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider text-[#64748b] hover:bg-primary/10 hover:text-primary transition-all"
          >
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        )}

        {/* ── Campana de notificaciones ─────────────────────────────────── */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotif((v) => !v)}
            className={`relative p-2 rounded-xl transition-all ${
              showNotif ? "bg-primary/10 text-primary" : "text-[#64748b] hover:text-primary hover:bg-slate-50"
            }`}
          >
            <Bell className="w-5 h-5" />
            {/* Badge — solo aparece si hay encuestas pendientes */}
            {hasUnread && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-[#EF4444] text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white leading-none">
                {badgeCount}
              </span>
            )}
          </button>

          {/* Dropdown de notificaciones */}
          {showNotif && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden">
              {/* Cabecera */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-black text-[#1e293b]">Notificaciones</h3>
                {hasUnread && (
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-[#EF4444]/10 text-[#EF4444] rounded-full">
                    {pendingSurveys.length} pendiente{pendingSurveys.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Cuerpo */}
              {pendingSurveys.length === 0 ? (
                <div className="px-5 py-10 flex flex-col items-center gap-3 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#10B981]/10 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-[#10B981]" />
                  </div>
                  <p className="text-sm font-bold text-[#1e293b]">¡Todo al día!</p>
                  <p className="text-xs text-[#64748b]">No tienes encuestas pendientes por responder.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                  {pendingSurveys.map((s) => (
                    <li key={s.id}>
                      <Link
                        href="/clima"
                        onClick={() => setShowNotif(false)}
                        className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50 transition-colors"
                      >
                        <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                          <ClipboardList className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#1e293b] truncate">{s.title}</p>
                          <p className="text-xs text-[#64748b] mt-0.5 line-clamp-1">
                            {s.description || "Encuesta de clima pendiente"}
                          </p>
                          <p className="text-[10px] font-black text-primary uppercase tracking-wider mt-1">
                            Pendiente · Clic para responder
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {/* Pie */}
              {pendingSurveys.length > 0 && (
                <div className="px-5 py-3 border-t border-slate-100">
                  <Link
                    href="/clima"
                    onClick={() => setShowNotif(false)}
                    className="block w-full text-center text-xs font-black text-primary hover:underline"
                  >
                    Ver todas las encuestas →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Perfil ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pl-4 md:pl-6 border-l border-slate-200 group">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-[#1e293b] group-hover:text-primary transition-colors">
              {user.user_metadata?.full_name || user.email}
            </p>
            {subtitle && (
              <p className="text-[10px] font-black uppercase tracking-tighter text-primary">
                {subtitle}
              </p>
            )}
          </div>
          <div className="relative group/profile cursor-pointer">
            <img
              src={user.user_metadata?.avatar_url || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150&h=150"}
              alt="Perfil"
              className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-50 transition-all group-hover:ring-[#00D6BC]/20"
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#10B981] rounded-full border-2 border-white" />

            {/* Menú desplegable */}
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 opacity-0 invisible group-hover/profile:opacity-100 group-hover/profile:visible transition-all duration-300 z-50 p-2">
              {role === "admin" && (
                <Link
                  href="/admin"
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-[#1e293b] hover:bg-slate-50 rounded-xl transition-colors"
                >
                  <Shield className="w-4 h-4 text-primary" />
                  Panel Admin
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-error hover:bg-error/5 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
