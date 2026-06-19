"use client";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  ReactFlow, Controls, Background, MiniMap, BackgroundVariant,
  useReactFlow, ReactFlowProvider,
  type Node, type Edge, type NodeTypes, MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Search, X, ChevronRight } from "lucide-react";
import OrgNodeComponent, { type OrgNodeData } from "./OrgNode";
import type { OrgData } from "@/app/api/organigrama/route";

// ── Constantes de layout ─────────────────────────────────────────────────────
const NODE_W   = 300;
const NODE_H   = 155;  // alto aproximado del nodo
const PAD_X    = 12;   // espacio horizontal entre hermanos
const PAD_Y    = 65;   // espacio vertical entre niveles
const MAX_COLS = 4;    // máximo de hijos por fila (evita que se expandan horizontalmente)

const nodeTypes: NodeTypes = { orgNode: OrgNodeComponent as any };

// ── Helpers ──────────────────────────────────────────────────────────────────
function buildMaps(relations: OrgData["relations"]) {
  const childrenMap = new Map<string, string[]>();
  const parentMap   = new Map<string, string>();
  const allIds      = new Set<string>();
  for (const r of relations) {
    if (!childrenMap.has(r.leader_id)) childrenMap.set(r.leader_id, []);
    childrenMap.get(r.leader_id)!.push(r.employee_id);
    parentMap.set(r.employee_id, r.leader_id);
    allIds.add(r.leader_id);
    allIds.add(r.employee_id);
  }
  const roots = Array.from(allIds).filter((id) => !parentMap.has(id));
  return { childrenMap, parentMap, roots };
}

function computeDepths(roots: string[], childrenMap: Map<string, string[]>) {
  const d = new Map<string, number>();
  function visit(id: string, depth: number) {
    d.set(id, depth);
    for (const c of childrenMap.get(id) ?? []) visit(c, depth + 1);
  }
  roots.forEach((r) => visit(r, 0));
  return d;
}

function computeVisible(roots: string[], expanded: Set<string>, childrenMap: Map<string, string[]>) {
  const vis = new Set<string>();
  function visit(id: string) {
    vis.add(id);
    if (expanded.has(id)) for (const c of childrenMap.get(id) ?? []) visit(c);
  }
  roots.forEach(visit);
  return vis;
}

// Ancho de un subtree: limitado por MAX_COLS para no expandirse infinitamente
function subtreeW(id: string, vis: Set<string>, cm: Map<string, string[]>): number {
  const ch = (cm.get(id) ?? []).filter((c) => vis.has(c));
  if (!ch.length) return NODE_W + PAD_X;
  const cols = Math.min(ch.length, MAX_COLS);
  return cols * (NODE_W + PAD_X);
}

// Layout en grid: hijos en filas de MAX_COLS, centrados bajo su padre
function fullLayout(id: string, x: number, y: number, vis: Set<string>, cm: Map<string, string[]>, pos: Map<string, {x:number;y:number}>) {
  pos.set(id, { x: x - NODE_W / 2, y });
  const ch = (cm.get(id) ?? []).filter((c) => vis.has(c));
  if (!ch.length) return;
  const cols  = Math.min(ch.length, MAX_COLS);
  const totalW = cols * (NODE_W + PAD_X) - PAD_X;
  const startX = x - totalW / 2;
  ch.forEach((childId, i) => {
    const col    = i % cols;
    const row    = Math.floor(i / cols);
    const childX = startX + col * (NODE_W + PAD_X) + NODE_W / 2;
    const childY = y + NODE_H + PAD_Y + row * (NODE_H + PAD_Y);
    fullLayout(childId, childX, childY, vis, cm, pos);
  });
}

// Posición in-place para hijos recién expandidos (también en grid)
function inPlaceChildPositions(
  parentId: string,
  parentPos: {x:number; y:number},
  childIds: string[],
): Map<string, {x:number;y:number}> {
  const result  = new Map<string, {x:number;y:number}>();
  const cols    = Math.min(childIds.length, MAX_COLS);
  const totalW  = cols * (NODE_W + PAD_X) - PAD_X;
  const startX  = parentPos.x + (NODE_W - totalW) / 2;
  childIds.forEach((childId, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    result.set(childId, {
      x: startX + col * (NODE_W + PAD_X),
      y: parentPos.y + NODE_H + PAD_Y + row * (NODE_H + PAD_Y),
    });
  });
  return result;
}

// ── Inner component ──────────────────────────────────────────────────────────
function ChartInner({ data, showInactive }: { data: OrgData; showInactive: boolean }) {
  const { setNodes, setEdges, fitView } = useReactFlow();
  const isFirstRender = useRef(true);

  // Persistent positions — no se borran cuando colapsás, para que al re-expandir
  // el nodo aparezca en el mismo lugar.
  const savedPos = useRef(new Map<string, {x:number;y:number}>());

  const empMap = useMemo(() => new Map(data.employees.map((e) => [e.id, e])), [data.employees]);

  const filteredRel = useMemo(() =>
    showInactive ? data.relations : data.relations.filter((r) =>
      empMap.get(r.employee_id)?.es_activo !== false && empMap.get(r.leader_id)?.es_activo !== false
    ), [data, showInactive, empMap]);

  const { childrenMap, parentMap, roots } = useMemo(() => buildMaps(filteredRel), [filteredRel]);
  const depthMap = useMemo(() => computeDepths(roots, childrenMap), [roots, childrenMap]);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(roots));

  // Re-init y limpiar posiciones guardadas cuando cambia la fuente
  useEffect(() => {
    savedPos.current.clear();
    isFirstRender.current = true;
    setExpanded(new Set(roots));
  }, [roots.join(",")]);

  const [search, setSearch] = useState("");

  // Auto-expand ancestors de resultados de búsqueda
  useEffect(() => {
    if (!search.trim()) return;
    const q = search.toLowerCase();
    const matches = data.employees.filter(
      (e) => e.nombre_completo.toLowerCase().includes(q) ||
             (e.cargo ?? "").toLowerCase().includes(q) ||
             (e.equipo ?? "").toLowerCase().includes(q)
    );
    const toOpen = new Set<string>();
    matches.forEach((m) => {
      let cur = m.id;
      while (parentMap.has(cur)) { const p = parentMap.get(cur)!; toOpen.add(p); cur = p; }
    });
    if (toOpen.size) setExpanded((prev) => new Set([...prev, ...toOpen]));
  }, [search]);

  const collapseSubtree = useCallback((nodeId: string, target: Set<string>) => {
    target.delete(nodeId);
    for (const childId of childrenMap.get(nodeId) ?? []) {
      collapseSubtree(childId, target);
    }
  }, [childrenMap]);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        // Colapsar este nodo y todos sus descendientes
        collapseSubtree(id, next);
      } else {
        // Colapsar hermanos y sus descendientes (acordeón)
        const parentId = parentMap.get(id);
        if (parentId) {
          for (const sibling of childrenMap.get(parentId) ?? []) {
            if (sibling !== id) collapseSubtree(sibling, next);
          }
        }
        next.add(id);
      }
      return next;
    });
  }, [childrenMap, parentMap, collapseSubtree]);

  const searchMatchIds = useMemo(() => {
    if (!search.trim()) return new Set<string>();
    const q = search.toLowerCase();
    return new Set(
      data.employees
        .filter((e) => e.nombre_completo.toLowerCase().includes(q) ||
                       (e.cargo ?? "").toLowerCase().includes(q) ||
                       (e.equipo ?? "").toLowerCase().includes(q))
        .map((e) => e.id)
    );
  }, [search, data.employees]);

  // ── Rebuild nodes + edges on every expansion change ─────────────────────
  useEffect(() => {
    const vis = computeVisible(roots, expanded, childrenMap);

    if (isFirstRender.current) {
      // Primera vez: layout full para los nodos iniciales visibles
      const pos = new Map<string, {x:number;y:number}>();
      let sx = 0;
      for (const root of roots) {
        if (!vis.has(root)) continue;
        const w = subtreeW(root, vis, childrenMap);
        fullLayout(root, sx + w / 2, 0, vis, childrenMap, pos);
        sx += w + PAD_X * 4;
      }
      pos.forEach((p, id) => savedPos.current.set(id, p));
      isFirstRender.current = false;
    } else {
      // Expansiones posteriores: in-place — solo calculamos posición
      // para nodos que aún no tienen posición guardada
      for (const id of vis) {
        if (savedPos.current.has(id)) continue;
        const parentId = parentMap.get(id);
        if (!parentId || !savedPos.current.has(parentId)) continue;

        // Calcula posiciones de TODOS los hijos del padre a la vez
        const siblings = (childrenMap.get(parentId) ?? []).filter((c) => vis.has(c));
        const parentPos = savedPos.current.get(parentId)!;
        const childPos  = inPlaceChildPositions(parentId, parentPos, siblings);
        childPos.forEach((p, cid) => {
          if (!savedPos.current.has(cid)) savedPos.current.set(cid, p);
        });
      }
    }

    // Construir nodes para React Flow
    const rfNodes: Node[] = [];
    for (const id of vis) {
      const emp = empMap.get(id);
      const pos = savedPos.current.get(id);
      if (!emp || !pos) continue;

      rfNodes.push({
        id,
        type: "orgNode",
        position: pos,
        data: {
          ...emp,
          isRoot:        !parentMap.has(id),
          depth:         depthMap.get(id) ?? 0,
          childCount:    (childrenMap.get(id) ?? []).length,
          isExpanded:    expanded.has(id),
          isSearchMatch: searchMatchIds.has(id),
          onToggle:      toggleExpand,
        } as OrgNodeData,
        draggable: false,
      });
    }

    const rfEdges: Edge[] = filteredRel
      .filter((r) => vis.has(r.employee_id) && vis.has(r.leader_id))
      .map((r) => ({
        id:     `${r.leader_id}-${r.employee_id}`,
        source: r.leader_id,
        target: r.employee_id,
        type:   "step",          // líneas ortogonales estáticas
        style:  { stroke: "#cbd5e1", strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8", width: 10, height: 10 },
      }));

    setNodes(rfNodes);
    setEdges(rfEdges);

    // fit solo en el primer render
    if (isFirstRender.current === false && rfNodes.length > 0 && !savedPos.current.size) {
      setTimeout(() => fitView({ padding: 0.1, maxZoom: 0.9 }), 300);
    }
  }, [roots, expanded, childrenMap, parentMap, depthMap, empMap, filteredRel, searchMatchIds, toggleExpand, setNodes, setEdges, fitView]);

  // fit al montar
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.1, maxZoom: 0.85 }), 450);
    return () => clearTimeout(t);
  }, [fitView]);

  // Breadcrumb del primer match
  const breadcrumb = useMemo(() => {
    const first = search.trim() ? Array.from(searchMatchIds)[0] : null;
    if (!first) return [];
    const path: string[] = [];
    let cur: string | undefined = first;
    while (cur) { path.unshift(cur); cur = parentMap.get(cur); }
    return path.map((id) => empMap.get(id)?.nombre_completo ?? id);
  }, [search, searchMatchIds, parentMap, empMap]);

  return (
    <>
      <Background variant={BackgroundVariant.Lines} gap={32} size={0.5} color="#f1f5f9" />
      <Controls className="!border-slate-200 !shadow-md !rounded-xl overflow-hidden" showInteractive={false} />
      <MiniMap
        nodeColor={(n: any) => {
          const d = n.data as OrgNodeData;
          if (d.isSearchMatch) return "#f59e0b";
          if (d.isRoot) return "#00D6BC";
          const c = ["#00D6BC","#10b981","#06b6d4","#0ea5e9","#34d399"];
          return c[Math.min((d.depth as number) ?? 0, c.length - 1)];
        }}
        maskColor="rgba(241,245,249,0.8)"
        className="!border-slate-200 !shadow-md !rounded-xl overflow-hidden"
        pannable zoomable
      />

      {/* Buscador flotante */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 w-80">
        <div className="flex items-center gap-2 bg-white rounded-2xl shadow-lg border border-slate-200 px-3 py-2.5">
          <Search className="w-4 h-4 text-[#94a3b8] shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar persona, cargo o equipo…"
            className="flex-1 text-sm outline-none text-[#1e293b] placeholder:text-[#94a3b8] bg-transparent"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-[#94a3b8] hover:text-[#64748b]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {search && (
          <div className="mt-1.5 bg-white rounded-xl shadow border border-slate-100 px-3 py-2 text-[10px] text-[#64748b] space-y-1">
            {searchMatchIds.size === 0 ? (
              <span>Sin resultados para "{search}"</span>
            ) : (
              <>
                <span><span className="font-bold text-amber-600">{searchMatchIds.size}</span> resultado{searchMatchIds.size !== 1 ? "s" : ""}</span>
                {breadcrumb.length > 1 && (
                  <div className="flex items-center gap-0.5 flex-wrap">
                    {breadcrumb.map((name, i) => (
                      <span key={i} className="flex items-center gap-0.5">
                        {i > 0 && <ChevronRight className="w-2.5 h-2.5 text-slate-300" />}
                        <span className={i === breadcrumb.length - 1 ? "font-bold text-amber-600" : ""}>{name}</span>
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Leyenda niveles */}
      <div className="absolute top-3 right-16 z-10 flex gap-1">
        {(["#00D6BC","#10b981","#06b6d4","#0ea5e9"] as const).map((color, i) => (
          <div key={i} className="flex items-center gap-1 bg-white/90 border border-slate-100 rounded-lg px-1.5 py-1 text-[9px] font-bold text-[#64748b] shadow-sm">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />N{i+1}
          </div>
        ))}
      </div>
    </>
  );
}

// ── Export público ───────────────────────────────────────────────────────────
export default function OrgChartFlow({ data, showInactive }: { data: OrgData; showInactive: boolean }) {
  return (
    <ReactFlowProvider>
      <ReactFlow
        defaultNodes={[]}
        defaultEdges={[]}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        minZoom={0.05}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-[#f8fafc]"
      >
        <ChartInner data={data} showInactive={showInactive} />
      </ReactFlow>
    </ReactFlowProvider>
  );
}
