"use client";
import { useState, useEffect } from "react";
import { TrendingUp, MessageSquare, UserRound, ChevronRight, AlertCircle, X, ArrowRight } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import type { PendingItem } from "@/app/api/home/pending/route";

type ModuleKey = "clima" | "enps";

const pendingModuleConfig: Record<ModuleKey, {
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  cardBg: string;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
  btnBg: string;
}> = {
  clima: {
    label:     "Clima Organizacional",
    sublabel:  "Encuestas de cultura y bienestar",
    icon:      <MessageSquare className="w-6 h-6" />,
    cardBg:    "bg-blue-50 border-blue-100",
    badgeBg:   "bg-blue-100",
    badgeText: "text-blue-700",
    dotColor:  "bg-blue-400",
    btnBg:     "bg-blue-600 hover:bg-blue-700",
  },
  enps: {
    label:     "eNPS",
    sublabel:  "Net Promoter Score interno",
    icon:      <TrendingUp className="w-6 h-6" />,
    cardBg:    "bg-violet-50 border-violet-100",
    badgeBg:   "bg-violet-100",
    badgeText: "text-violet-700",
    dotColor:  "bg-violet-400",
    btnBg:     "bg-violet-600 hover:bg-violet-700",
  },
};

interface ModuleConfig { id: string; label: string; }

const ALL_MODULES = [
  {
    id: "enps",
    title: "Módulo eNPS",
    description: "Tu opinión nos importa. Califica tu experiencia general en Alegra con una sola pregunta.",
    icon: <TrendingUp className="w-6 h-6 text-primary" />,
    buttonText: "Ir al Módulo",
    href: "/enps",
  },
  {
    id: "clima",
    title: "Encuestas de Clima",
    description: "Participa en los estudios de cultura organizacional para seguir construyendo el mejor lugar para trabajar.",
    icon: <MessageSquare className="w-6 h-6 text-primary" />,
    buttonText: "Ir al Módulo",
    href: "/clima",
  },
  {
    id: "360",
    title: "Evaluaciones 360°",
    description: "Envía y recibe retroalimentación constructiva de tus compañeros y líderes de equipo.",
    icon: <UserRound className="w-6 h-6 text-primary" />,
    buttonText: "Realizar Evaluación",
    href: "/evaluaciones360",
  },
];

export default function Home() {
  const [firstName, setFirstName]               = useState<string>("");
  const [pending, setPending]                   = useState<PendingItem[]>([]);
  const [loadingPending, setLoadingPending]     = useState(true);
  const [activeModule, setActiveModule]         = useState<ModuleKey | null>(null);
  const [moduleConfigs, setModuleConfigs]       = useState<ModuleConfig[] | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const fullName = user.user_metadata?.full_name ?? user.email ?? "";
        setFirstName(fullName.split(" ")[0]);
      }
    });
  }, []);

  useEffect(() => {
    fetch("/api/home/pending")
      .then((r) => r.json())
      .then((data) => setPending(data.pending ?? []))
      .catch(() => setPending([]))
      .finally(() => setLoadingPending(false));
    fetch("/api/modules")
      .then((r) => r.ok ? r.json() : [])
      .then((data: ModuleConfig[]) => setModuleConfigs(data))
      .catch(() => setModuleConfigs([]));
  }, []);

  return (
    <>
      {/* Saludo */}
      <div className="mb-10">
        <h2 className="text-4xl font-extrabold text-[#1e293b] mb-3 tracking-tight">
          ¡Hola, {firstName || "Colaborador"}! 👋
        </h2>
        <p className="text-[#64748b] text-lg max-w-2xl leading-relaxed">
          Bienvenido a tu portal de crecimiento. Aquí puedes gestionar tu feedback,
          participar en encuestas y ver el impacto de tu labor en la cultura de Alegra.
        </p>
      </div>

      {/* Encuestas pendientes — agrupadas por módulo */}
      {!loadingPending && pending.length > 0 && (() => {
        const grouped = pending.reduce<Record<ModuleKey, PendingItem[]>>(
          (acc, item) => { acc[item.type].push(item); return acc; },
          { clima: [], enps: [] }
        );
        const activeGroups = (Object.entries(grouped) as [ModuleKey, PendingItem[]][]).filter(([, items]) => items.length > 0);

        return (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-[#1e293b] uppercase tracking-wider">
                Tienes {pending.length} encuesta{pending.length > 1 ? "s" : ""} pendiente{pending.length > 1 ? "s" : ""}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeGroups.map(([type, items]) => {
                const cfg = pendingModuleConfig[type];
                return (
                  <div
                    key={type}
                    className={`border rounded-2xl p-5 flex items-center justify-between gap-4 shadow-sm ${cfg.cardBg}`}
                  >
                    {/* Icono + info */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${cfg.badgeBg} ${cfg.badgeText}`}>
                        {cfg.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-[#1e293b] leading-snug">{cfg.label}</p>
                        <p className="text-xs text-[#64748b] mt-0.5">{cfg.sublabel}</p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="relative flex h-2 w-2">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dotColor} opacity-60`} />
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dotColor}`} />
                          </span>
                          <span className={`text-[11px] font-bold ${cfg.badgeText}`}>
                            {items.length} pendiente{items.length > 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botón */}
                    <button
                      onClick={() => setActiveModule(type)}
                      className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm ${cfg.btnBg}`}
                    >
                      Responder
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Módulos */}
      {moduleConfigs === null ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {ALL_MODULES.filter((m) => moduleConfigs.some((c) => c.id === m.id)).map((module) => (
            <div
              key={module.id}
              className="group bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm card-shadow transition-all duration-500 flex flex-col border-b-4 hover:border-b-primary"
            >
              <div className="bg-[#00D6BC]/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                {module.icon}
              </div>
              <h3 className="text-2xl font-bold text-[#1e293b] mb-4">{module.title}</h3>
              <p className="text-[#64748b] text-sm leading-relaxed mb-8 flex-1">{module.description}</p>
              <div className="pt-6 mt-auto border-t border-slate-50">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#64748b]">Estado</span>
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-[#10B981]/10 text-[#10B981]">
                    Activo
                  </span>
                </div>
                <Link
                  href={module.href}
                  className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-bold text-sm transition-all bg-[#1e293b] text-white hover:bg-primary hover:shadow-lg hover:shadow-[#00D6BC]/20"
                >
                  {module.buttonText}
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal encuestas pendientes del módulo */}
      {activeModule && (() => {
        const cfg   = pendingModuleConfig[activeModule];
        const items = pending.filter((p) => p.type === activeModule);
        return (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setActiveModule(null)}
          >
            <div
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header del modal */}
              <div className={`px-7 py-5 flex items-center justify-between border-b ${cfg.cardBg}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.badgeBg} ${cfg.badgeText}`}>
                    {cfg.icon}
                  </div>
                  <div>
                    <h4 className="font-black text-[#1e293b] leading-tight">{cfg.label}</h4>
                    <p className={`text-xs font-semibold ${cfg.badgeText}`}>
                      {items.length} encuesta{items.length > 1 ? "s" : ""} pendiente{items.length > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModule(null)}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-[#64748b]" />
                </button>
              </div>

              {/* Lista de encuestas */}
              <div className="px-7 py-5 space-y-3 max-h-[60vh] overflow-y-auto">
                {items.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setActiveModule(null)}
                    className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm bg-white transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dotColor} opacity-60`} />
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${cfg.dotColor}`} />
                      </span>
                      <p className="text-sm font-semibold text-[#1e293b] truncate">{item.title}</p>
                    </div>
                    <span className="shrink-0 flex items-center gap-1 text-xs font-bold text-primary group-hover:gap-2 transition-all whitespace-nowrap">
                      Ir a la encuesta
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </Link>
                ))}
              </div>

              {/* Footer */}
              <div className="px-7 py-4 border-t border-slate-100">
                <button
                  onClick={() => setActiveModule(null)}
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-[#64748b] hover:bg-slate-50 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </>
  );
}
