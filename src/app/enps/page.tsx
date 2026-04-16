"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Settings2, UserCheck, ChevronLeft, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import type { Role } from "@/types/clima";
import type { EnpsSurvey, EnpsSurveyFormData } from "@/types/enps";
import EnpsAdminList     from "@/components/enps/EnpsAdminList";
import EnpsManagerList   from "@/components/enps/EnpsManagerList";
import EnpsViewerList    from "@/components/enps/EnpsViewerList";
import EnpsSurveyBuilder from "@/components/enps/EnpsSurveyBuilder";
import EnpsTaker         from "@/components/enps/EnpsTaker";
import EnpsResults       from "@/components/enps/EnpsResults";
import EnpsParticipants  from "@/components/enps/EnpsParticipants";

type ViewState = "list" | "create" | "edit" | "take" | "results" | "participants";
type AdminMode = "manage" | "participate";
type ToastType = "success" | "error";

interface Toast { message: string; type: ToastType }

export default function EnpsPage() {
  const [role, setRole]               = useState<Role | "loading">("loading");
  const [surveys, setSurveys]         = useState<EnpsSurvey[]>([]);
  const [loading, setLoading]         = useState(true);
  const [viewState, setViewState]     = useState<ViewState>("list");
  const [activeSurvey, setActiveSurvey] = useState<EnpsSurvey | null>(null);
  const [adminMode, setAdminMode]     = useState<AdminMode>("manage");
  const [toast, setToast]             = useState<Toast | null>(null);
  const toastTimer                    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supabase = createClient();

  const showToast = (message: string, type: ToastType = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const fetchSurveys = useCallback(async () => {
    try {
      const res = await fetch("/api/enps/surveys");
      if (res.ok) {
        const data = await res.json();
        setSurveys(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Error cargando campañas eNPS.", e);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        try {
          const roleRes = await fetch("/api/auth/role?module=enps");
          setRole(roleRes.ok ? (await roleRes.json()).role ?? "viewer" : "viewer");
        } catch {
          setRole("viewer");
        }
        await fetchSurveys();
      }
      setLoading(false);
    };
    init();
  }, []);

  const goToList = useCallback(async () => {
    setViewState("list");
    setActiveSurvey(null);
    await fetchSurveys();
  }, [fetchSurveys]);

  const handleAdminModeChange = (mode: AdminMode) => {
    setAdminMode(mode);
    setViewState("list");
    setActiveSurvey(null);
  };

  // ── Crear campaña ────────────────────────────────────────────────────────────
  const handleCreate = async (formData: EnpsSurveyFormData) => {
    try {
      const res = await fetch("/api/enps/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const created: EnpsSurvey = await res.json();
        setSurveys((prev) => [created, ...prev]);
        goToList();
        showToast("Campaña creada exitosamente");
      } else {
        showToast("Error al crear la campaña.", "error");
      }
    } catch {
      showToast("Error de red al crear la campaña.", "error");
    }
  };

  // ── Editar campaña ───────────────────────────────────────────────────────────
  const handleUpdate = async (formData: EnpsSurveyFormData) => {
    if (!activeSurvey) return;
    try {
      const res = await fetch(`/api/enps/surveys/${activeSurvey.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const updated = await res.json();
        setSurveys((prev) =>
          prev.map((s) =>
            s.id === activeSurvey.id
              ? {
                  ...s,
                  title:            updated.title,
                  description:      updated.description,
                  followUpQuestion: updated.followUpQuestion,
                  scoreMin:         updated.scoreMin,
                  scoreMax:         updated.scoreMax,
                  scoreLabels:      updated.scoreLabels,
                }
              : s
          )
        );
        goToList();
        showToast("Campaña actualizada exitosamente");
      } else {
        showToast("Error al guardar los cambios.", "error");
      }
    } catch {
      showToast("Error de red.", "error");
    }
  };

  // ── Eliminar campaña ─────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/enps/surveys/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSurveys((prev) => prev.filter((s) => s.id !== id));
        showToast("Campaña eliminada");
      } else {
        showToast("Error al eliminar la campaña.", "error");
      }
    } catch {
      showToast("Error de red.", "error");
    }
  };

  // ── Finalizar / Reabrir campaña ──────────────────────────────────────────────
  const handleToggleStatus = async (id: string, currentIsActive: boolean) => {
    const msg = currentIsActive
      ? "¿Finalizar esta campaña? Ya no estará disponible para los participantes."
      : "¿Reabrir esta campaña? Estará disponible para quienes aún no hayan respondido.";
    if (!confirm(msg)) return;
    try {
      const res = await fetch(`/api/enps/surveys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentIsActive }),
      });
      if (res.ok) {
        setSurveys((prev) =>
          prev.map((s) => s.id === id ? { ...s, isActive: !currentIsActive } : s)
        );
        showToast(currentIsActive ? "Campaña finalizada" : "Campaña reabierta para pendientes");
      } else {
        showToast("Error al cambiar el estado.", "error");
      }
    } catch {
      showToast("Error de red.", "error");
    }
  };

  const handleSave = (formData: EnpsSurveyFormData) => {
    if (viewState === "edit") handleUpdate(formData);
    else handleCreate(formData);
  };

  if (role === "loading" || loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const effectiveRole: Role =
    role === "admin" && adminMode === "participate" ? "viewer" : (role as Role);

  return (
    <div className="space-y-8">
      {/* Toast de notificación */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-sm font-bold transition-all animate-in slide-in-from-bottom-4 ${
            toast.type === "success"
              ? "bg-[#1e293b] text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success"
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <XCircle className="w-4 h-4 shrink-0" />
          }
          {toast.message}
        </div>
      )}

      {/* Volver */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#64748b] hover:text-primary transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Inicio
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-[#1e293b]">Módulo eNPS</h2>
          <p className="text-[#64748b]">Mide la disposición de los colaboradores a recomendar Alegra.</p>
        </div>

        {/* Selector de modo — solo admin en lista */}
        {role === "admin" && viewState === "list" && (
          <div className="flex items-center bg-slate-100 rounded-2xl p-1 gap-1 self-start md:self-auto">
            <button
              onClick={() => handleAdminModeChange("manage")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                adminMode === "manage"
                  ? "bg-[#1e293b] text-white shadow-sm"
                  : "text-[#64748b] hover:text-[#1e293b]"
              }`}
            >
              <Settings2 className="w-4 h-4" />
              Gestionar
            </button>
            <button
              onClick={() => handleAdminModeChange("participate")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                adminMode === "participate"
                  ? "bg-primary text-white shadow-sm"
                  : "text-[#64748b] hover:text-[#1e293b]"
              }`}
            >
              <UserCheck className="w-4 h-4" />
              Participar
            </button>
          </div>
        )}
      </div>

      {/* ── Lista ─────────────────────────────────────────────────────────────── */}
      {viewState === "list" && (
        <div className="grid grid-cols-1 gap-6">
          {effectiveRole === "admin" && (
            <EnpsAdminList
              surveys={surveys}
              onCreate={() => setViewState("create")}
              onEdit={(s) => { setActiveSurvey(s); setViewState("edit"); }}
              onViewResults={(s) => { setActiveSurvey(s); setViewState("results"); }}
              onManageParticipants={(s) => { setActiveSurvey(s); setViewState("participants"); }}
              onDelete={handleDelete}
              onToggleStatus={handleToggleStatus}
            />
          )}
          {effectiveRole === "manager" && (
            <EnpsManagerList
              surveys={surveys}
              onViewResults={(s) => { setActiveSurvey(s); setViewState("results"); }}
            />
          )}
          {effectiveRole === "viewer" && (
            <EnpsViewerList
              surveys={surveys}
              onAnswer={(s) => { setActiveSurvey(s); setViewState("take"); }}
            />
          )}
        </div>
      )}

      {/* ── Crear campaña ─────────────────────────────────────────────────────── */}
      {viewState === "create" && role === "admin" && (
        <EnpsSurveyBuilder onSave={handleSave} onCancel={goToList} />
      )}

      {/* ── Editar campaña ────────────────────────────────────────────────────── */}
      {viewState === "edit" && activeSurvey && role === "admin" && (
        <EnpsSurveyBuilder
          onSave={handleSave}
          onCancel={goToList}
          initialData={{
            title:            activeSurvey.title,
            description:      activeSurvey.description,
            followUpQuestion: activeSurvey.followUpQuestion,
            scoreMin:         activeSurvey.scoreMin ?? 0,
            scoreMax:         activeSurvey.scoreMax ?? 10,
            scoreLabels:      activeSurvey.scoreLabels ?? null,
          }}
        />
      )}

      {/* ── Responder ─────────────────────────────────────────────────────────── */}
      {viewState === "take" && activeSurvey && effectiveRole === "viewer" && (
        <EnpsTaker
          survey={activeSurvey}
          onComplete={() => { showToast("¡Respuesta enviada! Gracias por participar."); goToList(); }}
          onCancel={goToList}
        />
      )}

      {/* ── Resultados ────────────────────────────────────────────────────────── */}
      {viewState === "results" && activeSurvey && (role === "admin" || role === "manager") && (
        <EnpsResults survey={activeSurvey} onBack={goToList} />
      )}

      {/* ── Gestionar participantes ───────────────────────────────────────────── */}
      {viewState === "participants" && activeSurvey && role === "admin" && (
        <EnpsParticipants
          survey={activeSurvey}
          onBack={goToList}
          onSurveyUpdated={fetchSurveys}
        />
      )}
    </div>
  );
}
