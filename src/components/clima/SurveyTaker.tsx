"use client";
import { useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import type { Survey } from "@/types/clima";

interface SurveyTakerProps {
  survey: Survey;
  onComplete: () => void;
  onCancel: () => void;
}

export default function SurveyTaker({ survey, onComplete, onCancel }: SurveyTakerProps) {
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setAnswer = (questionId: string, value: string | number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    setError(null);
    try {
      const response = await fetch("/api/clima/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // El employeeId se resuelve en el servidor usando la sesión autenticada
        body: JSON.stringify({ surveyId: survey.id, answers }),
      });

      if (response.ok) {
        setSubmitted(true);
        setTimeout(() => onComplete(), 2000);
      } else {
        const data = await response.json();
        setError(data.error || "Error al enviar la respuesta.");
      }
    } catch {
      setError("Error de red. Intenta de nuevo.");
    }
  };

  if (submitted) {
    return (
      <div className="bg-white rounded-[2rem] p-12 border border-slate-100 shadow-sm text-center max-w-2xl mx-auto flex flex-col items-center">
        <CheckCircle2 className="w-16 h-16 text-success mb-6" />
        <h3 className="text-2xl font-bold text-[#1e293b] mb-2">¡Gracias por tu participación!</h3>
        <p className="text-[#64748b]">Tus respuestas nos ayudan a mejorar la cultura.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm max-w-2xl mx-auto">
      <button
        onClick={onCancel}
        className="text-xs font-bold text-[#64748b] hover:text-[#1e293b] mb-8 flex items-center gap-1"
      >
        <ArrowLeft className="w-3 h-3" /> Volver
      </button>

      <h3 className="text-2xl font-bold text-[#1e293b] mb-2">{survey.title}</h3>
      <p className="text-[#64748b] mb-8">{survey.description}</p>

      <div className="space-y-8">
        {survey.questions.map((q, i) => (
          <div key={q.id}>
            <p className="font-bold text-[#1e293b] mb-4">
              {i + 1}. {q.text}
            </p>

            {q.type === "rating" && (
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    onClick={() => setAnswer(q.id, num)}
                    className={`w-10 h-10 rounded-xl font-bold transition-all ${
                      answers[q.id] === num
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-[#64748b] hover:bg-slate-200"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            )}

            {q.type === "boolean" && (
              <div className="flex gap-2">
                {["Sí", "No"].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setAnswer(q.id, opt)}
                    className={`px-6 py-2 rounded-xl font-bold transition-all ${
                      answers[q.id] === opt
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-[#64748b] hover:bg-slate-200"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {q.type === "text" && (
              <textarea
                onChange={(e) => setAnswer(q.id, e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:border-primary transition-colors min-h-[100px]"
                placeholder="Respuesta..."
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-6 text-sm text-error font-semibold">{error}</p>
      )}

      <div className="mt-12 pt-6 border-t border-slate-100 flex justify-end">
        <button
          onClick={handleSubmit}
          className="bg-[#1e293b] text-white px-8 py-3 rounded-xl font-bold hover:bg-primary transition-all"
        >
          Enviar Respuestas
        </button>
      </div>
    </div>
  );
}
