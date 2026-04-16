"use client";
import { useState, useEffect } from "react";
import { TrendingUp, MessageSquare, UserRound, ChevronRight, Clock, X } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

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

export default function Home() {
  const [comingSoonTitle, setComingSoonTitle] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string>("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const fullName = user.user_metadata?.full_name ?? user.email ?? "";
        setFirstName(fullName.split(" ")[0]);
      }
    });
  }, []);

  return (
    <>
      <div className="mb-12">
        <h2 className="text-4xl font-extrabold text-[#1e293b] mb-3 tracking-tight">
          ¡Hola, {firstName || "Colaborador"}! 👋
        </h2>
        <p className="text-[#64748b] text-lg max-w-2xl leading-relaxed">
          Bienvenido a tu portal de crecimiento. Aquí puedes gestionar tu feedback,
          participar en encuestas y ver el impacto de tu labor en la cultura de Alegra.
        </p>
      </div>

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
