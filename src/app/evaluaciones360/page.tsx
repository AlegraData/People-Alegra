"use client";
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, Settings2, UserCheck } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import AdminList        from "@/components/evaluaciones360/AdminList";
import EvalBuilder      from "@/components/evaluaciones360/EvalBuilder";
import EvalTaker        from "@/components/evaluaciones360/EvalTaker";
import EvalParticipants from "@/components/evaluaciones360/EvalParticipants";
import EvalResults      from "@/components/evaluaciones360/EvalResults";
import ViewerList       from "@/components/evaluaciones360/ViewerList";
import type { Evaluation360, EvalFormData } from "@/types/evaluaciones360";

type View      = "list" | "create" | "edit" | "participants" | "results" | "take";
type Role      = "admin" | "manager" | "viewer";
type AdminMode = "manage" | "participate";

export default function Evaluaciones360Page() {
  const [role, setRole]               = useState<Role>("viewer");
  const [userEmail, setUserEmail]     = useState("");
  const [evaluations, setEvaluations] = useState<Evaluation360[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [view, setView]               = useState<View>("list");
  const [selected, setSelected]       = useState<Evaluation360 | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [adminMode, setAdminMode]     = useState<AdminMode>("manage");

  // ── Load role + email ─────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email);
    });
    fetch("/api/auth/role")
      .then((r) => r.json())
      .then(({ role }) => setRole(role ?? "viewer"))
      .catch(() => {});
  }, []);

  // ── Load evaluations ──────────────────────────────────────────────────────
  const fetchEvaluations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/evaluaciones360/surveys");
      if (res.ok) setEvaluations(await res.json());
      else setError("Error al cargar evaluaciones.");
    } catch { setError("Error de red."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEvaluations(); }, [fetchEvaluations]);

  // ── Navigate helpers ──────────────────────────────────────────────────────
  const goToList = useCallback(() => { setView("list"); setSelected(null); }, []);

  const handleAdminModeChange = (mode: AdminMode) => {
    setAdminMode(mode);
    goToList();
  };

  // ── Create / Edit ─────────────────────────────────────────────────────────
  const handleSave = async (data: EvalFormData) => {
    setSaving(true);
    setError(null);
    try {
      const isEdit = !!selected;
      const url    = isEdit ? `/api/evaluaciones360/surveys/${selected!.id}` : "/api/evaluaciones360/surveys";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Error al guardar.");
        return;
      }
      await fetchEvaluations();
      goToList();
    } catch { setError("Error de red."); }
    finally { setSaving(false); }
  };

  // ── Effective role (admin in participate mode acts as viewer) ─────────────
  const effectiveRole: Role =
    (role === "admin" || role === "manager") && adminMode === "participate"
      ? "viewer"
      : role;

  // ── Viewer evaluations: filter to ones where admin has own assignments ─────
  const myEvaluations = evaluations.filter(
    (e) => ((e as any).myAssignments?.length ?? 0) > 0
  );

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading && view === "list") {
    return (
      <div className="space-y-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#64748b] hover:text-primary transition-colors">
          <ChevronLeft className="w-4 h-4" /> Inicio
        </Link>
        <div>
          <h2 className="text-3xl font-black text-[#1e293b]">Evaluaciones 360°</h2>
          <p className="text-[#64748b]">Retroalimentación entre compañeros, líderes y colaboradores.</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 animate-pulse">
              <div className="h-5 w-64 bg-slate-200 rounded mb-3" />
              <div className="h-3 w-40 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Botón volver */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#64748b] hover:text-primary transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Inicio
      </Link>

      {/* Header del módulo */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-[#1e293b]">Evaluaciones 360°</h2>
          <p className="text-[#64748b]">Retroalimentación entre compañeros, líderes y colaboradores.</p>
        </div>

        {/* Selector de modo — solo admin/manager en vista de lista */}
        {(role === "admin" || role === "manager") && view === "list" && (
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

      <div className="max-w-5xl mx-auto">

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {/* ── LIST ───────────────────────────────────────────────────────── */}
        {view === "list" && (
          <>
            {effectiveRole === "admin" || effectiveRole === "manager" ? (
              <AdminList
                evaluations={evaluations}
                onCreateNew={() => { setSelected(null); setView("create"); }}
                onEdit={(e)         => { setSelected(e); setView("edit"); }}
                onParticipants={(e) => { setSelected(e); setView("participants"); }}
                onResults={(e)      => { setSelected(e); setView("results"); }}
                onRefresh={fetchEvaluations}
              />
            ) : (
              <ViewerList
                evaluations={role === "viewer" ? evaluations : myEvaluations}
                onTake={(e) => { setSelected(e); setView("take"); }}
              />
            )}
          </>
        )}

        {/* ── CREATE ─────────────────────────────────────────────────────── */}
        {view === "create" && (
          <EvalBuilder onSave={handleSave} onCancel={goToList} />
        )}

        {/* ── EDIT ───────────────────────────────────────────────────────── */}
        {view === "edit" && selected && (
          <EvalBuilder initialData={selected} onSave={handleSave} onCancel={goToList} />
        )}

        {/* ── PARTICIPANTS ────────────────────────────────────────────────── */}
        {view === "participants" && selected && (
          <EvalParticipants evaluation={selected} onBack={goToList} />
        )}

        {/* ── RESULTS ────────────────────────────────────────────────────── */}
        {view === "results" && selected && (
          <EvalResults evaluation={selected} onBack={goToList} />
        )}

        {/* ── TAKE ───────────────────────────────────────────────────────── */}
        {view === "take" && selected && (
          <EvalTaker evaluation={selected} onBack={goToList} userEmail={userEmail} />
        )}

        {/* Saving overlay */}
        {saving && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl px-8 py-6 shadow-2xl flex items-center gap-4">
              <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="font-bold text-[#1e293b]">Guardando evaluación...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
