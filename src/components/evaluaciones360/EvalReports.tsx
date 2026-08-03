"use client";
import { useState } from "react";
import { ArrowLeft, BarChart3, Settings2, Palette, Send } from "lucide-react";
import type { Evaluation360, CustomReportSection } from "@/types/evaluaciones360";
import EvalReportsSummary from "./EvalReportsSummary";
import EvalReportSectionsConfig from "./EvalReportSectionsConfig";
import EvalReportTemplateEditor from "./EvalReportTemplateEditor";
import EvalReportSends from "./EvalReportSends";

interface Props {
  evaluation: Evaluation360;
  onBack: () => void;
}

type Tab = "resumen" | "configuracion" | "plantilla" | "envios";

const TABS: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: "resumen", label: "Resumen", icon: BarChart3 },
  { id: "configuracion", label: "Configuración", icon: Settings2 },
  { id: "plantilla", label: "Plantilla", icon: Palette },
  { id: "envios", label: "Envíos", icon: Send },
];

export default function EvalReports({ evaluation: initialEvaluation, onBack }: Props) {
  const [tab, setTab] = useState<Tab>("resumen");
  const [evaluation, setEvaluation] = useState(initialEvaluation);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="text-xl font-bold text-[#1e293b]">Reportes</h3>
          <p className="text-sm text-[#64748b]">{evaluation.title}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tab === id ? "bg-white text-[#1e293b] shadow-sm" : "text-[#64748b] hover:text-[#1e293b]"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "resumen" && <EvalReportsSummary evaluation={evaluation} />}
      {tab === "configuracion" && (
        <EvalReportSectionsConfig
          evaluation={evaluation}
          onSaved={(reportSections: CustomReportSection[]) => setEvaluation((prev) => ({ ...prev, reportSections }))}
        />
      )}
      {tab === "plantilla" && <EvalReportTemplateEditor evaluation={evaluation} />}
      {tab === "envios" && <EvalReportSends evaluation={evaluation} />}
    </div>
  );
}
