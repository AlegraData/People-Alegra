"use client";
import { useCallback, useMemo } from "react";
import {
  ReactFlow, Controls, Background, MiniMap, BackgroundVariant,
  type Node, type Edge, type NodeTypes,
  MarkerType, useNodesState, useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import OrgNodeComponent, { type OrgNodeData } from "./OrgNode";
import type { OrgData } from "@/app/api/organigrama/route";

const NODE_W = 220;
const NODE_H = 120;
const LEVEL_GAP = 180;
const SIBLING_GAP = 40;

interface TreeNode {
  id: string;
  children: TreeNode[];
}

function buildTree(relations: OrgData["relations"]): TreeNode[] {
  const childMap = new Map<string, string[]>();
  const hasParent = new Set<string>();

  for (const r of relations) {
    if (!childMap.has(r.leader_id)) childMap.set(r.leader_id, []);
    childMap.get(r.leader_id)!.push(r.employee_id);
    hasParent.add(r.employee_id);
  }

  const allIds = new Set([
    ...relations.map((r) => r.leader_id),
    ...relations.map((r) => r.employee_id),
  ]);

  const roots = Array.from(allIds).filter((id) => !hasParent.has(id));

  function build(id: string): TreeNode {
    return { id, children: (childMap.get(id) ?? []).map(build) };
  }

  return roots.map(build);
}

function subtreeWidth(node: TreeNode): number {
  if (node.children.length === 0) return NODE_W + SIBLING_GAP;
  return node.children.reduce((s, c) => s + subtreeWidth(c), 0);
}

function layoutTree(
  node: TreeNode,
  x: number,
  y: number,
  positions: Map<string, { x: number; y: number }>
): void {
  positions.set(node.id, { x: x - NODE_W / 2, y });

  if (node.children.length === 0) return;

  const totalW = node.children.reduce((s, c) => s + subtreeWidth(c), 0);
  let childX = x - totalW / 2;

  for (const child of node.children) {
    const w = subtreeWidth(child);
    layoutTree(child, childX + w / 2, y + LEVEL_GAP + NODE_H, positions);
    childX += w;
  }
}

const nodeTypes: NodeTypes = { orgNode: OrgNodeComponent as any };

interface Props {
  data: OrgData;
  showInactive: boolean;
}

export default function OrgChartFlow({ data, showInactive }: Props) {
  const empMap = useMemo(
    () => new Map(data.employees.map((e) => [e.id, e])),
    [data.employees]
  );

  const filteredRelations = useMemo(
    () => showInactive ? data.relations : data.relations.filter((r) => {
      const emp = empMap.get(r.employee_id);
      const ldr = empMap.get(r.leader_id);
      return emp?.es_activo !== false && ldr?.es_activo !== false;
    }),
    [data.relations, empMap, showInactive]
  );

  const { rfNodes, rfEdges } = useMemo(() => {
    const trees = buildTree(filteredRelations);
    const positions = new Map<string, { x: number; y: number }>();

    let startX = 0;
    for (const root of trees) {
      const w = subtreeWidth(root);
      layoutTree(root, startX + w / 2, 0, positions);
      startX += w + SIBLING_GAP * 2;
    }

    const childCountMap = new Map<string, number>();
    for (const r of filteredRelations) {
      childCountMap.set(r.leader_id, (childCountMap.get(r.leader_id) ?? 0) + 1);
    }

    const hasParent = new Set(filteredRelations.map((r) => r.employee_id));

    const rfNodes: Node[] = [];
    for (const [id, pos] of positions.entries()) {
      const emp = empMap.get(id);
      if (!emp) continue;
      const isRoot = !hasParent.has(id);
      rfNodes.push({
        id,
        type: "orgNode",
        position: pos,
        data: {
          ...emp,
          isRoot,
          childCount: childCountMap.get(id) ?? 0,
        },
        draggable: true,
      });
    }

    const rfEdges: Edge[] = filteredRelations.map((r) => ({
      id: `${r.leader_id}-${r.employee_id}`,
      source: r.leader_id,
      target: r.employee_id,
      type: "smoothstep",
      animated: false,
      style: { stroke: "#00D6BC", strokeWidth: 2, opacity: 0.7 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "#00D6BC",
        width: 16,
        height: 16,
      },
    }));

    return { rfNodes, rfEdges };
  }, [filteredRelations, empMap]);

  const [nodes, , onNodesChange] = useNodesState(rfNodes);
  const [edges, , onEdgesChange] = useEdgesState(rfEdges);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      className="bg-[#f8fafc] rounded-2xl"
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
      <Controls
        className="!border-slate-200 !shadow-lg !rounded-xl overflow-hidden"
        showFitView
        showZoom
        showInteractive={false}
      />
      <MiniMap
        nodeColor={(n) => {
          const d = n.data as unknown as OrgNodeData;
          return d.isRoot ? "#00D6BC" : d.es_activo ? "#94a3b8" : "#e2e8f0";
        }}
        maskColor="rgba(241,245,249,0.7)"
        className="!border-slate-200 !shadow-lg !rounded-xl overflow-hidden"
        pannable
        zoomable
      />
    </ReactFlow>
  );
}
