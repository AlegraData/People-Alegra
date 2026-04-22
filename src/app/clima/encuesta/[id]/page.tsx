"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Lock, XCircle, ChevronLeft } from "lucide-react";
import Link from "next/link";
import SurveyTaker from "@/components/clima/SurveyTaker";
import type { Survey } from "@/types/clima";

type PageState = "loading" | "ready" | "completed" | "denied" | "inactive" | "error";

export default function TakeSurveyPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [survey, setSurvey]       = useState<Survey | null>(null);
  const [errorMsg, setErrorMsg]   = useState("");

  useEffect(() => {
    if (!id) return;

    fetch(`/api/clima/surveys/${id}/take`)
      .then(async (res) => {
        const data = await res.json();

        if (res.status === 401) { router.push("/login"); return; }
        if (res.status === 404) { setPageState("error"); setErrorMsg("Encuesta no encontrada."); return; }
        if (res.status === 403) {
          if (data.code === "INACTIVE") { setPageState("inactive"); return; }
          setPageState("denied"); setErrorMsg(data.error ?? "Sin acceso."); return;
        }
        if (!res.ok) { setPageState("error"); setErrorMsg("Error al cargar la encuesta."); return; }

        setSurvey(data as Survey);
        setPageState(data.hasResponded ? "completed" : "ready");
      })
      .catch(() => { setPageState("error"); setErrorMsg("Error de conexión."); });
  }, [id]);

  if (pageState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (pageState === "ready" && survey) {
    return (
      <div className="space-y-6">
        <Link
          href="/clima"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#64748b] hover:text-primary transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Volver
        </Link>
        <SurveyTaker
          survey={survey}
          onComplete={() => setPageState("completed")}
          onCancel={() => router.push("/clima")}
        />
      </div>
    );
  }

  // Estados de resultado / error
  const states: Record<Exclude<PageState, "loading" | "ready">, {
    icon: React.ReactNode;
    title: string;
    body: string;
    bg: string;
    iconBg: string;
  }> = {
    completed: {
      icon:   <CheckCircle2 className="w-10 h-10 text-primary" />,
      title:  "¡Gracias por tu respuesta!",
      body:   "Ya completaste esta encuesta. Tu participación es muy valiosa para nosotros.",
      bg:     "bg-primary/5 border-primary/20",
      iconBg: "bg-primary/10",
    },
    denied: {
      icon:   <Lock className="w-10 h-10 text-[#64748b]" />,
      title:  "Acceso restringido",
      body:   errorMsg || "No tienes acceso a esta encuesta.",
      bg:     "bg-slate-50 border-slate-200",
      iconBg: "bg-slate-100",
    },
    inactive: {
      icon:   <XCircle className="w-10 h-10 text-amber-500" />,
      title:  "Encuesta cerrada",
      body:   "Esta encuesta ya no está disponible para respuestas.",
      bg:     "bg-amber-50 border-amber-200",
      iconBg: "bg-amber-100",
    },
    error: {
      icon:   <XCircle className="w-10 h-10 text-red-400" />,
      title:  "Algo salió mal",
      body:   errorMsg || "No pudimos cargar la encuesta. Intenta de nuevo más tarde.",
      bg:     "bg-red-50 border-red-200",
      iconBg: "bg-red-100",
    },
  };

  const s = states[pageState as Exclude<PageState, "loading" | "ready">];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className={`w-full max-w-md rounded-3xl border p-10 text-center space-y-5 ${s.bg}`}>
        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto ${s.iconBg}`}>
          {s.icon}
        </div>
        <h2 className="text-2xl font-black text-[#1e293b]">{s.title}</h2>
        <p className="text-[#64748b] font-medium leading-relaxed">{s.body}</p>
        <Link
          href="/clima"
          className="inline-flex items-center gap-2 mt-2 px-6 py-3 rounded-2xl bg-[#1e293b] text-white font-bold hover:bg-primary transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
