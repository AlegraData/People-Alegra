import { TrendingUp, MessageSquare, UserRound, ChevronRight } from "lucide-react";
import Link from "next/link";

const modules = [
  {
    title: "Módulo eNPS",
    description: "Tu opinión nos importa. Califica tu experiencia general en Alegra con una sola pregunta.",
    icon: <TrendingUp className="w-6 h-6 text-primary" />,
    status: "Pendiente",
    statusColor: "bg-[#00D6BC]/10 text-primary",
    buttonText: "Responder Encuesta",
    href: "/enps",
  },
  {
    title: "Encuestas de Clima",
    description: "Participa en los estudios de cultura organizacional para seguir construyendo el mejor lugar para trabajar.",
    icon: <MessageSquare className="w-6 h-6 text-primary" />,
    status: "Completada",
    statusColor: "bg-[#10B981]/10 text-[#10B981]",
    buttonText: "Ver Resultados",
    href: "/clima",
  },
  {
    title: "Evaluaciones 360°",
    description: "Envía y recibe retroalimentación constructiva de tus compañeros y líderes de equipo.",
    icon: <UserRound className="w-6 h-6 text-primary" />,
    status: "2 Asignadas",
    statusColor: "bg-[#00D6BC]/10 text-primary",
    buttonText: "Realizar Evaluación",
    href: "/360",
  },
];

export default function Home() {
  return (
    <>
      <div className="mb-12">
        <h2 className="text-4xl font-extrabold text-[#1e293b] mb-3 tracking-tight">
          ¡Hola, Colaborador! 👋
        </h2>
        <p className="text-[#64748b] text-lg max-w-2xl leading-relaxed">
          Bienvenido a tu portal de crecimiento. Aquí puedes gestionar tu feedback, 
          participar en encuestas y ver el impacto de tu labor en la cultura de Alegra.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {modules.map((module, index) => (
          <div key={index} className="group bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm card-shadow transition-all duration-500 flex flex-col border-b-4 hover:border-b-primary">
            <div className="bg-[#00D6BC]/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
              {module.icon}
            </div>
            <h3 className="text-2xl font-bold text-[#1e293b] mb-4">{module.title}</h3>
            <p className="text-[#64748b] text-sm leading-relaxed mb-8 flex-1">
              {module.description}
            </p>
            <div className="pt-6 mt-auto border-t border-slate-50">
              <div className="flex justify-between items-center mb-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#64748b]">Tu Estado</span>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${module.statusColor}`}>
                  {module.status}
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
    </>
  );
}
