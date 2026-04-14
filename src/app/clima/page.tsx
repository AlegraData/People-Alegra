"use client";
import { useState, useEffect, useCallback } from "react";
import { Settings2, UserCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { Role, Survey, SurveyFormData } from "@/types/clima";
import AdminList         from "@/components/clima/AdminList";
import ManagerList       from "@/components/clima/ManagerList";
import ViewerList        from "@/components/clima/ViewerList";
import SurveyBuilder     from "@/components/clima/SurveyBuilder";
import SurveyTaker       from "@/components/clima/SurveyTaker";
import SurveyResults     from "@/components/clima/SurveyResults";
import SurveyParticipants from "@/components/clima/SurveyParticipants";

type ViewState = "list" | "create" | "edit" | "take" | "results" | "participants";
type AdminMode = "manage" | "participate";

export default function ClimaPage() {
  const [role, setRole]               = useState<Role | "loading">("loading");
  const [surveys, setSurveys]         = useState<Survey[]>([]);
  const [loading, setLoading]         = useState(true);
  const [viewState, setViewState]     = useState<ViewState>("list");
  const [activeSurvey, setActiveSurvey] = useState<Survey | null>(null);
  const [adminMode, setAdminMode]     = useState<AdminMode>("manage");

  const supabase = createClient();

  const fetchSurveys = useCallback(async () => {
    try {
      const res = await fetch("/api/clima/surveys");
      if (res.ok) {
        const data = await res.json();
        setSurveys(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Error cargando encuestas.", e);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        try {
          const roleRes = await fetch("/api/auth/role");
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

  const goToList = useCallback(() => {
    setViewState("list");
    setActiveSurvey(null);
  }, []);

  const handleAdminModeChange = (mode: AdminMode) => {
    setAdminMode(mode);
    goToList();
  };

  // ── Crear encuesta ───────────────────────────────────────────────────────
  const handleCreateSurvey = async (formData: SurveyFormData) => {
    try {
      const res = await fetch("/api/clima/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const created: Survey = await res.json();
        setSurveys((prev) => [created, ...prev]);
        goToList();
      } else {
        alert("Error al crear la encuesta.");
      }
    } catch {
      alert("Error de red al crear la encuesta.");
    }
  };

  // ── Editar encuesta ──────────────────────────────────────────────────────
  const handleUpdateSurvey = async (formData: SurveyFormData) => {
    if (!activeSurvey) return;
    try {
      const res = await fetch(`/api/clima/surveys/${activeSurvey.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const updated = await res.json();
        setSurveys((prev) =>
          prev.map((s) =>
            s.id === activeSurvey.id
              ? { ...updated, responsesCount: s.responsesCount, assignmentsCount: s.assignmentsCount }
              : s
          )
        );
        goToList();
      } else {
        alert("Error al guardar los cambios.");
      }
    } catch {
      alert("Error de red al guardar los cambios.");
    }
  };

  // ── Eliminar encuesta ────────────────────────────────────────────────────
  const handleDeleteSurvey = async (id: string) => {
    try {
      const res = await fetch(`/api/clima/surveys/${id}`, { method: "DELETE" });
      if (res.ok) setSurveys((prev) => prev.filter((s) => s.id !== id));
      else alert("Error al eliminar la encuesta.");
    } catch {
      alert("Error de red al eliminar la encuesta.");
    }
  };

  // ── Redirige onSave al handler correcto según el viewState ───────────────
  const handleSave = (formData: SurveyFormData) => {
    if (viewState === "edit") handleUpdateSurvey(formData);
    else handleCreateSurvey(formData);
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
      {/* Header del módulo */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-[#1e293b]">Módulo de Clima</h2>
          <p className="text-[#64748b]">Gestiona y participa en la cultura organizacional.</p>
        </div>

        {/* Selector de modo — solo admin en la vista de lista */}
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

      {/* ── Vista lista ───────────────────────────────────────────────────── */}
      {viewState === "list" && (
        <div className="grid grid-cols-1 gap-6">
          {effectiveRole === "admin" && (
            <AdminList
              surveys={surveys}
              onCreate={() => setViewState("create")}
              onEdit={(s) => { setActiveSurvey(s); setViewState("edit"); }}
              onViewResults={(s) => { setActiveSurvey(s); setViewState("results"); }}
              onManageParticipants={(s) => { setActiveSurvey(s); setViewState("participants"); }}
              onDelete={handleDeleteSurvey}
            />
          )}
          {effectiveRole === "manager" && (
            <ManagerList
              surveys={surveys}
              onViewResults={(s) => { setActiveSurvey(s); setViewState("results"); }}
            />
          )}
          {effectiveRole === "viewer" && (
            <ViewerList
              surveys={surveys}
              onTake={(s) => { setActiveSurvey(s); setViewState("take"); }}
            />
          )}
        </div>
      )}

      {/* ── Crear encuesta ────────────────────────────────────────────────── */}
      {viewState === "create" && role === "admin" && (
        <SurveyBuilder onSave={handleSave} onCancel={goToList} />
      )}

      {/* ── Editar encuesta ───────────────────────────────────────────────── */}
      {viewState === "edit" && activeSurvey && role === "admin" && (
        <SurveyBuilder
          onSave={handleSave}
          onCancel={goToList}
          initialData={activeSurvey}
        />
      )}

      {/* ── Responder encuesta ────────────────────────────────────────────── */}
      {viewState === "take" && activeSurvey && effectiveRole === "viewer" && (
        <SurveyTaker survey={activeSurvey} onComplete={goToList} onCancel={goToList} />
      )}

      {/* ── Resultados ────────────────────────────────────────────────────── */}
      {viewState === "results" && activeSurvey && (role === "admin" || role === "manager") && (
        <SurveyResults survey={activeSurvey} onBack={goToList} />
      )}

      {/* ── Gestión de participantes ──────────────────────────────────────── */}
      {viewState === "participants" && activeSurvey && role === "admin" && (
        <SurveyParticipants
          survey={activeSurvey}
          onBack={goToList}
          onSurveyUpdated={fetchSurveys}
        />
      )}
    </div>
  );
}
