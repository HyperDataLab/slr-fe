import { useEffect, useMemo, useRef, useState } from "react";
import { Background, BaseEdge, Controls, EdgeLabelRenderer, MiniMap, Position, ReactFlow, getSmoothStepPath, useReactFlow, type Edge, type EdgeProps, type Node, type NodeProps, Handle } from "@xyflow/react";
import ELK, { type ElkNode } from "elkjs/lib/elk-api.js";
import elkWorkerUrl from "elkjs/lib/elk-worker.min.js?url";
import type { LocatedAiEvidence } from "../../../services/paperAiAnalysisService";
import LoadingSpinner from "../../ui/LoadingSpinner";
import "@xyflow/react/dist/style.css";
export type FlowNodeData = { label: string; role: string; detail: string; evidence?: LocatedAiEvidence[]; nodeType?: string; aifShape?: "I" | "RA" | "CA"; tone?: "primary" | "success" | "warning" | "danger" | "neutral"; isCurrent?: boolean };
export type FlowNode = Node<FlowNodeData>;
export type FlowEdgeData = { points?: { x: number; y: number }[]; relationship?: string };
export type FlowEdge = Edge<FlowEdgeData>;

let elk: InstanceType<typeof ELK> | undefined;
function edgeLabelPoint(points: { x: number; y: number }[]): { x: number; y: number } {
  const segments = points.slice(1).map((point, index) => ({ from: points[index], to: point, length: Math.hypot(point.x - points[index].x, point.y - points[index].y) }));
  const halfway = segments.reduce((total, segment) => total + segment.length, 0) / 2;
  let traversed = 0;
  for (const segment of segments) {
    if (traversed + segment.length >= halfway) {
      const ratio = segment.length ? (halfway - traversed) / segment.length : 0;
      return { x: segment.from.x + (segment.to.x - segment.from.x) * ratio, y: segment.from.y + (segment.to.y - segment.from.y) * ratio };
    }
    traversed += segment.length;
  }
  return points[0] ?? { x: 0, y: 0 };
}

async function layoutWithElk(nodes: FlowNode[], edges: FlowEdge[]) {
  const graph: ElkNode = {
    id: "paper-argument-graph",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.layered.mergeEdges": "false",
      "elk.spacing.nodeNode": "54",
      "elk.layered.spacing.nodeNodeBetweenLayers": "132",
      "elk.layered.spacing.edgeNodeBetweenLayers": "34",
      "elk.layered.spacing.edgeEdgeBetweenLayers": "24",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.padding": "[top=30,left=36,bottom=30,right=36]",
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: node.data.aifShape === "RA" ? 136 : node.data.aifShape === "CA" ? 166 : 252,
      height: node.data.aifShape === "RA" ? 136 : node.data.aifShape === "CA" ? 166 : 110,
    })),
    edges: edges.map((edge) => ({ id: edge.id, sources: [String(edge.source)], targets: [String(edge.target)] })),
  };
  elk ??= new ELK({ workerUrl: elkWorkerUrl });
  const layout = await elk.layout(graph);
  const positions = new Map((layout.children ?? []).map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]));
  const routes = new Map((layout.edges ?? []).map((edge) => {
    const section = edge.sections?.[0];
    const points = section ? [section.startPoint, ...(section.bendPoints ?? []), section.endPoint] : [];
    return [edge.id, points];
  }));
  return {
    nodes: nodes.map((node) => ({ ...node, position: positions.get(node.id) ?? node.position })),
    edges: edges.map((edge) => {
      const points = routes.get(edge.id) ?? [];
      return { ...edge, type: "routed", data: { ...edge.data, points } };
    }),
  };
}

function AifNode({ data, selected }: NodeProps<FlowNode>) {
  const tone = data.tone ?? (data.nodeType === "S" ? "warning" : "primary");
  const styles = {
    primary: { border: "border-primary/40", badge: "bg-primary-light text-primary", handle: "!bg-primary" },
    success: { border: "border-success/40 bg-success/[0.035]", badge: "bg-success/10 text-success", handle: "!bg-success" },
    warning: { border: "border-warning/40 bg-warning/[0.035]", badge: "bg-warning/10 text-warning", handle: "!bg-warning" },
    danger: { border: "border-error/40 bg-error/[0.025]", badge: "bg-error/10 text-error", handle: "!bg-error" },
    neutral: { border: "border-border bg-bg-secondary/60", badge: "bg-bg-secondary text-text-secondary", handle: "!bg-text-secondary" },
  }[tone];
  if (data.aifShape === "RA") return <div className={`relative flex h-[136px] w-[136px] flex-col items-center justify-center rounded-full border-2 px-4 text-center shadow-sm transition-colors ${styles.border} ${selected ? "!border-primary ring-2 ring-primary/20" : ""} ${data.isCurrent ? "paper-node-current" : ""}`}>
    <Handle type="target" position={Position.Left} className={`!h-2.5 !w-2.5 !border-2 !border-white ${styles.handle}`} />
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${styles.badge}`}>RA</span><p className="mt-1 line-clamp-3 text-[11px] leading-4 text-text-primary">{data.label}</p>
    <Handle type="source" position={Position.Right} className={`!h-2.5 !w-2.5 !border-2 !border-white ${styles.handle}`} />
  </div>;
  if (data.aifShape === "CA") return <div className={`relative flex h-[166px] w-[166px] items-center justify-center ${data.isCurrent ? "paper-node-current" : ""}`}>
    <div className={`absolute h-[116px] w-[116px] rotate-45 rounded-xl border-2 shadow-sm transition-colors ${styles.border} ${selected ? "!border-primary ring-2 ring-primary/20" : ""}`} />
    <Handle type="target" position={Position.Left} className={`!h-2.5 !w-2.5 !border-2 !border-white ${styles.handle}`} />
    <div className="relative z-10 max-w-[116px] px-2 text-center"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${styles.badge}`}>CA</span><p className="mt-1 line-clamp-3 text-[10px] leading-4 text-text-primary">{data.label}</p></div>
    <Handle type="source" position={Position.Right} className={`!h-2.5 !w-2.5 !border-2 !border-white ${styles.handle}`} />
  </div>;
  const isAifInformation = data.aifShape === "I";
  return <div className={`relative h-[110px] w-[252px] rounded-xl border px-3.5 py-3 shadow-sm transition-colors ${styles.border} ${selected ? "!border-primary ring-2 ring-primary/20" : ""} ${data.isCurrent ? "paper-node-current" : ""}`}>
    <Handle type="target" position={Position.Left} className={`!h-2.5 !w-2.5 !border-2 !border-white ${styles.handle}`} />
    <div className="flex items-center gap-2"><span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles.badge}`}>{isAifInformation ? "Information" : data.role}</span>{isAifInformation && <span className="truncate text-[10px] text-text-muted">{data.role}</span>}</div>
    <p className="mt-2 line-clamp-3 text-xs leading-5 text-text-primary">{data.label}</p>
    <Handle type="source" position={Position.Right} className={`!h-2.5 !w-2.5 !border-2 !border-white ${styles.handle}`} />
  </div>;
}

const nodeTypes = { argument: AifNode };

export function LayoutFlow({ nodes, edges, focusNodeId, onSelect, ariaLabel }: { nodes: FlowNode[]; edges: FlowEdge[]; focusNodeId?: string; onSelect: (node: FlowNode | null) => void; ariaLabel: string }) {
  const [layout, setLayout] = useState<{ nodes: FlowNode[]; edges: FlowEdge[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLayout(null);
    void layoutWithElk(nodes, edges).then((nextLayout) => {
      if (!cancelled) setLayout(nextLayout);
    }).catch(() => {
      if (!cancelled) setLayout({ nodes, edges: edges.map((edge) => ({ ...edge, type: "smoothstep" })) });
    });
    return () => { cancelled = true; };
  }, [nodes, edges]);
  if (!layout) return <div className="flex h-full min-h-0 items-center justify-center bg-[#f8fafb]"><LoadingSpinner size="md" /><span className="ml-3 text-xs text-text-secondary">Arranging graph…</span></div>;
  return <FlowCanvas nodes={layout.nodes} edges={layout.edges} focusNodeId={focusNodeId} onSelect={onSelect} ariaLabel={ariaLabel} />;
}

function RoutedRelationshipEdge({ id, sourceX, sourceY, targetX, targetY, data, markerEnd, style, label }: EdgeProps<FlowEdge>) {
  const fallback = getSmoothStepPath({ sourceX, sourceY, targetX, targetY });
  const route = data?.points ?? [];
  const points = [{ x: sourceX, y: sourceY }];
  route.slice(1, -1).forEach((waypoint) => {
    const previous = points[points.length - 1];
    if (previous.x !== waypoint.x && previous.y !== waypoint.y) points.push({ x: waypoint.x, y: previous.y });
    points.push(waypoint);
  });
  const last = points[points.length - 1];
  if (last.x !== targetX && last.y !== targetY) points.push({ x: last.x, y: targetY });
  if (route.length <= 2 && sourceY !== targetY) {
    points.splice(1, points.length - 1, { x: (sourceX + targetX) / 2, y: sourceY }, { x: (sourceX + targetX) / 2, y: targetY });
  }
  points.push({ x: targetX, y: targetY });
  const path = route.length > 1 ? `M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")}` : fallback[0];
  const labelPosition = edgeLabelPoint(points);
  return <>
    <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
    {label && <EdgeLabelRenderer><div className="nodrag nopan pointer-events-none absolute rounded-md border border-border/80 bg-white/95 px-1.5 py-0.5 text-[10px] leading-4 text-text-secondary shadow-sm transition-opacity duration-200" style={{ opacity: typeof style?.opacity === "number" ? style.opacity : 1, transform: `translate(-50%, -50%) translate(${labelPosition.x}px,${labelPosition.y}px)` }}>{label}</div></EdgeLabelRenderer>}
  </>;
}

const edgeTypes = { routed: RoutedRelationshipEdge };

function FocusGraphNode({ nodeId, skipNodeId, onFocus }: { nodeId?: string; skipNodeId: string | null; onFocus: (nodeId: string) => void }) {
  const { fitView } = useReactFlow();
  const onFocusRef = useRef(onFocus);
  const handledNodeIdRef = useRef<string | null>(null);
  useEffect(() => {
    onFocusRef.current = onFocus;
  }, [onFocus]);
  useEffect(() => {
    if (!nodeId) {
      handledNodeIdRef.current = null;
      return;
    }
    if (handledNodeIdRef.current === nodeId) return;
    handledNodeIdRef.current = nodeId;
    if (skipNodeId === nodeId) return;
    onFocusRef.current(nodeId);
    void fitView({ nodes: [{ id: nodeId }], duration: 280, padding: 0.5, maxZoom: 1.2 });
  }, [fitView, nodeId, skipNodeId]);
  return null;
}

function FlowCanvas({ nodes, edges, focusNodeId, onSelect, ariaLabel }: { nodes: FlowNode[]; edges: FlowEdge[]; focusNodeId?: string; onSelect: (node: FlowNode | null) => void; ariaLabel: string }) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [clickedNodeId, setClickedNodeId] = useState<string | null>(null);
  const [traversalStep, setTraversalStep] = useState(0);
  const [lastClickedNodeId, setLastClickedNodeId] = useState<string | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  const connectedEdges = useMemo(() => {
    const nodeIds = new Set(nodes.map((node) => node.id));
    return edges.filter((edge) => nodeIds.has(String(edge.source)) && nodeIds.has(String(edge.target)));
  }, [edges, nodes]);
  const focusedNodeId = hoveredNodeId ?? clickedNodeId;
  const traversal = useMemo(() => {
    if (!focusedNodeId) return null;
    const adjacency = new Map(nodes.map((node) => [node.id, [] as { next: string; edgeId: string }[]]));
    connectedEdges.forEach((edge) => {
      const source = String(edge.source);
      const target = String(edge.target);
      adjacency.get(source)?.push({ next: target, edgeId: edge.id });
    });
    const visited = new Set([focusedNodeId]);
    const nodeOrder: string[] = [];
    const edgeOrder: string[] = [];
    const queue = [focusedNodeId];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      for (const link of adjacency.get(current) ?? []) {
        if (visited.has(link.next)) continue;
        visited.add(link.next);
        queue.push(link.next);
        nodeOrder.push(link.next);
        edgeOrder.push(link.edgeId);
      }
    }
    connectedEdges.forEach((edge) => {
      if (edgeOrder.includes(edge.id) || !visited.has(String(edge.source)) || !visited.has(String(edge.target))) return;
      edgeOrder.push(edge.id);
    });
    return { nodeOrder, edgeOrder };
  }, [connectedEdges, focusedNodeId, nodes]);

  useEffect(() => {
    if (!traversal?.edgeOrder.length) {
      setTraversalStep(0);
      return;
    }
    setTraversalStep(0);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTraversalStep(traversal.edgeOrder.length);
      return;
    }
    let timer = 0;
    timer = window.setInterval(() => {
      setTraversalStep((current) => {
        if (current >= traversal.edgeOrder.length) {
          window.clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, 520);
    return () => window.clearInterval(timer);
  }, [traversal]);

  const visibleStep = Math.min(traversalStep, traversal?.edgeOrder.length ?? 0);
  const visitedNodeIds = useMemo(() => new Set([focusedNodeId, ...(traversal?.nodeOrder.slice(0, visibleStep) ?? [])].filter((id): id is string => Boolean(id))), [focusedNodeId, traversal, visibleStep]);
  const visitedEdgeIds = useMemo(() => new Set(traversal?.edgeOrder.slice(0, visibleStep) ?? []), [traversal, visibleStep]);
  const currentNodeId = visibleStep === 0 ? focusedNodeId : traversal?.nodeOrder[visibleStep - 1] ?? focusedNodeId;
  const displayNodes = useMemo(() => nodes.map((node) => {
    if (!focusedNodeId) return node;
    const isVisited = visitedNodeIds.has(node.id);
    const isCurrent = node.id === currentNodeId;
    return {
      ...node,
      className: `${node.className ?? ""} ${isVisited ? "" : "paper-node-dim"}`.trim(),
      style: { ...node.style, opacity: isVisited ? 1 : 0.14 },
      data: { ...node.data, isCurrent },
    };
  }), [currentNodeId, focusedNodeId, nodes, visitedNodeIds]);
  const displayEdges = useMemo(() => connectedEdges.map((edge) => {
    if (!focusedNodeId) return edge;
    const isVisited = visitedEdgeIds.has(edge.id);
    return {
      ...edge,
      className: `${edge.className ?? ""} ${isVisited ? "paper-edge-travel-forward" : "paper-edge-muted"}`.trim(),
      style: { ...edge.style, opacity: isVisited ? 1 : 0.12, ...(isVisited ? { stroke: "#0071bc", strokeWidth: 1.8 } : {}) },
    };
  }), [connectedEdges, focusedNodeId, traversal, visitedEdgeIds]);

  const handleNodeClick = (_event: React.MouseEvent, node: FlowNode) => {
    setLastClickedNodeId(node.id);
    setClickedNodeId((current) => current === node.id ? null : node.id);
    onSelect(node);
  };
  const focusRequestedNode = (nodeId: string) => {
    if (lastClickedNodeId === nodeId) return;
    const matchingNode = nodes.find((node) => node.id === nodeId);
    if (!matchingNode) return;
    setClickedNodeId(nodeId);
    onSelectRef.current(matchingNode);
  };
  const clearFocus = () => {
    setHoveredNodeId(null);
    setClickedNodeId(null);
    setLastClickedNodeId(null);
    onSelect(null);
  };
  const minimapColor = (node: FlowNode) => ({ primary: "#0071bc", success: "#117035", warning: "#92400e", danger: "#dc2626", neutral: "#84919a" }[node.data?.tone ?? "neutral"]);
  return <div className="paper-flow-graph h-full min-h-0 w-full bg-[#f8fafb]" aria-label={ariaLabel} onMouseLeave={() => setHoveredNodeId(null)}>
    <ReactFlow nodes={displayNodes} edges={displayEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodeClick={handleNodeClick} onNodeMouseEnter={(_event, node) => setHoveredNodeId(node.id)} onPaneClick={clearFocus} fitView fitViewOptions={{ padding: 0.22 }} minZoom={0.2} maxZoom={1.8} proOptions={{ hideAttribution: true }}>
      <FocusGraphNode nodeId={focusNodeId} skipNodeId={lastClickedNodeId} onFocus={focusRequestedNode} />
      <Background color="#dce4e9" gap={22} size={1} />
      <MiniMap pannable zoomable nodeColor={minimapColor} className="!bg-white" />
      <Controls position="top-right" showInteractive={false} />
    </ReactFlow>
  </div>;
}

