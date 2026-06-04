"use client";
import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import type { OrgEmployee } from "@/app/api/organigrama/route";

const COLORS = [
  "bg-teal-500", "bg-violet-500", "bg-blue-500", "bg-rose-500",
  "bg-amber-500", "bg-emerald-500", "bg-indigo-500", "bg-pink-500",
  "bg-cyan-500", "bg-orange-500",
];

function getColor(email: string) {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = email.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

function Avatar({ emp, size = 56 }: { emp: OrgEmployee; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = emp.nombre_completo.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  const px = `${size}px`;

  if (emp.avatar_url && !err) {
    return (
      <img
        src={emp.avatar_url}
        alt={emp.nombre_completo}
        onError={() => setErr(true)}
        style={{ width: px, height: px }}
        className="rounded-full object-cover ring-2 ring-white shadow-md shrink-0"
      />
    );
  }
  return (
    <div
      style={{ width: px, height: px }}
      className={`rounded-full flex items-center justify-center font-bold text-white text-sm ring-2 ring-white shadow-md shrink-0 ${getColor(emp.email)}`}
    >
      {initials || "?"}
    </div>
  );
}

export interface OrgNodeData extends OrgEmployee {
  isRoot?: boolean;
  childCount?: number;
  [key: string]: unknown;
}

export default function OrgNodeComponent({ data }: { data: OrgNodeData }) {
  const { nombre_completo, cargo, equipo, es_activo, isRoot, childCount } = data;

  return (
    <div
      className={`relative group bg-white rounded-2xl shadow-lg border-2 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 w-[220px] ${
        isRoot
          ? "border-[#00D6BC] shadow-[#00D6BC]/20"
          : es_activo
          ? "border-slate-200 hover:border-[#00D6BC]/50"
          : "border-slate-100 opacity-60"
      }`}
    >
      {/* Connector handles */}
      <Handle type="target" position={Position.Top}    className="!bg-[#00D6BC] !w-2 !h-2 !border-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-[#00D6BC] !w-2 !h-2 !border-0" />

      <div className="p-4">
        {/* Header: avatar + status */}
        <div className="flex items-start gap-3 mb-2">
          <Avatar emp={data} size={isRoot ? 52 : 44} />
          <div className="flex-1 min-w-0 pt-0.5">
            <p className={`font-bold text-[#1e293b] leading-tight truncate ${isRoot ? "text-sm" : "text-xs"}`}>
              {nombre_completo}
            </p>
            {cargo && (
              <p className="text-[10px] text-[#64748b] truncate mt-0.5">{cargo}</p>
            )}
          </div>

          {/* Estado activo/inactivo */}
          <span className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${es_activo ? "bg-emerald-400" : "bg-slate-300"}`} title={es_activo ? "Activo" : "Inactivo"} />
        </div>

        {/* Equipo */}
        {equipo && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-[#94a3b8] bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full truncate max-w-full">
              {equipo}
            </span>
          </div>
        )}

        {/* Badge especial para root */}
        {isRoot && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-[#00D6BC] bg-[#00D6BC]/10 px-2 py-0.5 rounded-full">
              Liderazgo
            </span>
          </div>
        )}

        {/* Cantidad de reportes directos */}
        {typeof childCount === "number" && childCount > 0 && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#1e293b] text-white text-[9px] font-black px-2 py-0.5 rounded-full whitespace-nowrap shadow">
            {childCount} reporte{childCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
