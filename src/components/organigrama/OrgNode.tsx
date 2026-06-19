"use client";
import { memo, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { OrgEmployee } from "@/app/api/organigrama/route";

const COLORS = [
  "bg-teal-500","bg-violet-500","bg-blue-500","bg-rose-500",
  "bg-amber-500","bg-emerald-500","bg-indigo-500","bg-pink-500",
  "bg-cyan-500","bg-orange-500",
];
function getColor(email: string) {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = email.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

function Avatar({ emp, size = 40 }: { emp: OrgEmployee; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = emp.nombre_completo.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  const px = `${size}px`;
  if (emp.avatar_url && !err) {
    return <img src={emp.avatar_url} alt={emp.nombre_completo} onError={() => setErr(true)}
      style={{ width: px, height: px }} className="rounded-full object-cover ring-2 ring-white shrink-0" />;
  }
  return (
    <div style={{ width: px, height: px }}
      className={`rounded-full flex items-center justify-center font-bold text-white text-xs ring-2 ring-white shrink-0 ${getColor(emp.email)}`}>
      {initials || "?"}
    </div>
  );
}

export interface OrgNodeData extends OrgEmployee {
  isRoot?: boolean;
  depth?: number;
  childCount: number;
  isExpanded: boolean;
  isSearchMatch?: boolean;
  onToggle: (id: string) => void;
  [key: string]: unknown;
}

function OrgNodeInner({ data }: { data: OrgNodeData }) {
  const { nombre_completo, cargo, equipo, es_activo, isRoot, depth,
          childCount, isExpanded, isSearchMatch, onToggle, id } = data;

  const hasChildren = childCount > 0;
  const borderColor = isSearchMatch
    ? "border-amber-400 shadow-amber-200/60 shadow-lg"
    : isRoot
    ? "border-[#00D6BC]"
    : es_activo
    ? "border-slate-200"
    : "border-slate-100 opacity-70";

  const depthColors = [
    "bg-[#00D6BC]/15",
    "bg-emerald-50",
    "bg-teal-50",
    "bg-cyan-50",
    "bg-sky-50",
  ];
  const headerBg = depthColors[Math.min(depth ?? 0, depthColors.length - 1)];

  return (
    <div className={`relative bg-white rounded-2xl shadow-md border-2 transition-all w-[300px] ${borderColor} ${isSearchMatch ? "scale-105" : ""}`}>
      <Handle type="target"  position={Position.Top}    className="!bg-[#00D6BC] !w-2 !h-2 !border-0 !top-0" />
      <Handle type="source"  position={Position.Bottom} className="!bg-[#00D6BC] !w-2 !h-2 !border-0 !bottom-0" />

      {/* Header con fondo de nivel */}
      <div className={`${headerBg} rounded-t-2xl px-5 pt-5 pb-4`}>
        <div className="flex items-center gap-3">
          <Avatar emp={data} size={isRoot ? 64 : 56} />
          <div className="flex-1 min-w-0">
            <p className={`font-extrabold text-[#1e293b] leading-snug truncate ${isRoot ? "text-base" : "text-[14px]"}`}>
              {nombre_completo}
            </p>
            {cargo && <p className="text-[12px] font-semibold text-[#64748b] truncate mt-1">{cargo}</p>}
          </div>
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${es_activo ? "bg-emerald-400" : "bg-slate-300"}`} />
        </div>
        {equipo && (
          <span className="mt-2 inline-block text-[10px] font-black uppercase tracking-wider text-[#94a3b8] bg-white/70 px-2 py-1 rounded-full truncate max-w-full">
            {equipo}
          </span>
        )}
      </div>

      {/* Footer: botón expandir/colapsar */}
      {hasChildren && (
        <button
          onClick={() => onToggle(id as string)}
          className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-b-2xl text-[12px] font-bold transition-all ${
            isExpanded
              ? "bg-[#00D6BC]/10 text-[#00D6BC] hover:bg-[#00D6BC]/20"
              : "bg-slate-50 text-[#64748b] hover:bg-slate-100"
          }`}
        >
          {isExpanded
            ? <><ChevronDown className="w-3.5 h-3.5" /> Colapsar ({childCount})</>
            : <><ChevronRight className="w-3.5 h-3.5" /> {childCount} reporte{childCount !== 1 ? "s" : ""}</>
          }
        </button>
      )}

      {/* Sin hijos */}
      {!hasChildren && (
        <div className="py-2.5 text-center rounded-b-2xl bg-slate-50">
          <span className="text-[11px] text-slate-400 font-medium">Sin reportes</span>
        </div>
      )}
    </div>
  );
}

export default memo(OrgNodeInner);
