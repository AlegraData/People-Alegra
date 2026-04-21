"use client";
import { useState, useEffect } from "react";
import { TrendingUp, MessageSquare, UserRound, ChevronRight, Clock, AlertCircle } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import type { PendingItem } from "@/app/api/home/pending/route";

const modules = [
  {
    title: "Módulo eNPS",
    description: "Tu opinión nos importa. Califica tu experiencia general en Alegra con una sola pregunta.",
    icon: <TrendingUp className="w-6 h-6 text-primary" />,
    status: "Activo",
    statusColor: "bg-[#10B981]/10 text-[#10B981]",
    buttonText: "Ir al Módulo",
    href: "/enps",
    comingSoon: false,
  },
  {
    title: "Encuestas de Clima",
    description: "Participa en los estudios de cultura organizacional para seguir construyendo el mejor lugar para trabajar.",
    icon: <MessageSquare className="w-6 h-6 text-primary" />,
    status: "Activo",
    statusColor: "bg-[#10B981]/10 text-[#10B981]",
    buttonText: "Ir al Módulo",
    href: "/clima",
    comingSoon: false,
  },
  {
    title: "Evaluaciones 360°",
    description: "Envía y recibe retroalimentación constructiva de tus compañeros y líderes de equipo.",
    icon: <UserRound className="w-6 h-6 text-primary" />,
    status: "Próximamente",
    statusColor: "bg-slate-100 text-[#64748b]",
    buttonText: "Realizar Evaluación",
    href: "/360",
    comingSoon: true,
  },
];

const typeConfig = {
  clima: { label: "Clima", color: "bg-blue-50 text-blue-600 border-blue-100", dot: "bg-blue-400" },
  enps:  { label: "eNPS",  color: "bg-violet-50 text-violet-600 border-violet-100", dot: "bg-violet-400" },
};

export default function Home() {
  const [comingSoonTitle, setComingSoonTitle] = useState<string | null>(null);
  const [firstName, setFirstName]             = useState<string>("");
  const [pending, setPending]                 = useState<PendingItem[]>([]);
  const [loadingPending, setLoadingPending]   = useState(true);

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

      {/* Encuestas pendientes */}
      {!loadingPending && pending.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-[#1e293b] uppercase tracking-wider">
              Tienes {pending.length} encuesta{pending.length > 1 ? "s" : ""} pendiente{pending.length > 1 ? "s" : ""}
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pending.map((item) => {
              const cfg = typeConfig[item.type];
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className="bg-white border border-amber-100 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 shadow-sm hover:border-amber-200 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`relative flex h-2.5 w-2.5 shrink-0`}>
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-60`} />
                      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${cfg.dot}`} />
                    </span>
                    <div className="min-w-0">
                      <span className={`inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-md border mb-1 ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <p className="text-sm font-semibold text-[#1e293b] truncate leading-snug">
                        {item.title}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={item.href}
                    className="shrink-0 flex items-center gap-1 text-xs font-bold text-primary hover:underline whitespace-nowrap"
                  >
                    Responder
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Módulos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {modules.map((module, index) => (
          <div
            key={index}
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
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${module.statusColor}`}>
                  {module.status}
                </span>
              </div>

              {module.comingSoon ? (
                <button
                  onClick={() => setComingSoonTitle(module.title)}
                  className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-bold text-sm transition-all bg-slate-100 text-[#64748b] hover:bg-slate-200"
                >
                  {module.buttonText}
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <Link
                  href={module.href}
                  className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-bold text-sm transition-all bg-[#1e293b] text-white hover:bg-primary hover:shadow-lg hover:shadow-[#00D6BC]/20"
                >
                  {module.buttonText}
                  <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal próximamente */}
      {comingSoonTitle && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setComingSoonTitle(null)}
        >
          <div
            className="bg-white rounded-[2rem] p-10 max-w-sm w-full text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 bg-primary/10 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6">
              <Clock className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-black text-[#1e293b] mb-2">{comingSoonTitle}</h3>
            <p className="text-[#64748b] mb-8 leading-relaxed">
              Este módulo estará disponible en los próximos días. ¡Muy pronto podrás acceder!
            </p>
            <button
              onClick={() => setComingSoonTitle(null)}
              className="bg-[#1e293b] text-white px-8 py-3 rounded-xl font-bold hover:bg-primary transition-all"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
