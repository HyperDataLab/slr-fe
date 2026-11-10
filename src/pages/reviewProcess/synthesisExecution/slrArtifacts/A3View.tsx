import { useMemo, useState } from "react";
import { MarkerType } from "@xyflow/react";
import { asArray, asText, isObject, StatusPill, Empty, type Data } from "../SlrArtifactsShared";
import { type GraphEdge, type GraphNode } from "./ArtifactGraph";
import { LayoutFlow, type FlowEdge, type FlowNode } from "../../../../components/shared/paper/ResearchGraph";

const PREMISE_ROLES = new Set(["premise", "attacking_information", "preferred"]);
const CONCLUSION_ROLES = new Set(["conclusion", "attacked_information", "dispreferred"]);

/** Preserves the compact layered projection used by the artifact graph layout tests. */
export function toA3Graph(nodes: Data[], edges: Data[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const asPremise = new Set<string>();
  const asConclusion = new Set<string>();
  for (const edge of edges) {
    const role = asText(edge.role, "");
    if (PREMISE_ROLES.has(role)) asPremise.add(asText(edge.source, ""));
    if (CONCLUSION_ROLES.has(role)) asConclusion.add(asText(edge.target, ""));
  }
  return {
    nodes: nodes.map((node) => {
      const id = asText(node.node_id, "");
      if (node.type === "S") {
        const scheme = asText(node.scheme_type, "");
        return { id, label: `${scheme} · ${asText(node.label, id)}`, column: 1, tone: scheme === "CA" ? "warning" : "neutral" } as GraphNode;
      }
      const column = asConclusion.has(id) ? 2 : 0;
      return { id, label: asText(node.content, asText(node.label, id)), column, tone: column === 2 || node.content_kind === "claim" ? "primary" : "neutral" } as GraphNode;
    }),
    edges: edges.map((edge) => ({ id: asText(edge.edge_id, ""), source: asText(edge.source, ""), target: asText(edge.target, ""), label: asText(edge.role, "") })),
  };
}

function toFlowGraph(nodes: Data[], edges: Data[]): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const flowNodes: FlowNode[] = nodes.flatMap((node, index) => {
    const id = asText(node.node_id, "");
    if (!id) return [];
    const scheme = asText(node.scheme_type, "").toUpperCase();
    const isScheme = node.type === "S";
    const detail = isScheme ? asText(node.label, id) : asText(node.content, asText(node.label, id));
    const role = isScheme ? `${scheme || "Argument"} scheme` : asText(node.content_kind, "Proposition").replaceAll("_", " ");
    const aifShape = scheme === "RA" ? "RA" : scheme === "CA" ? "CA" : "I";
    const tone = scheme === "CA" ? "warning"
      : scheme === "RA" ? "primary"
        : scheme === "PA" ? "neutral"
          : node.content_kind === "claim" || node.content_kind === "conclusion" ? "success"
            : node.content_kind === "finding" ? "primary" : "neutral";
    return [{
      id,
      type: "argument",
      position: { x: 0, y: index * 24 },
      data: {
        label: detail.length > 150 ? `${detail.slice(0, 147).trimEnd()}…` : detail,
        detail,
        role,
        nodeType: isScheme ? "S" : "I",
        aifShape,
        tone,
      },
    }];
  });
  const nodeIds = new Set(flowNodes.map((node) => node.id));
  const flowEdges: FlowEdge[] = edges.flatMap((edge, index) => {
    const source = asText(edge.source, "");
    const target = asText(edge.target, "");
    if (!nodeIds.has(source) || !nodeIds.has(target)) return [];
    const relationship = asText(edge.role, "related").toLowerCase().replaceAll("_", " ");
    const isAttack = relationship.includes("attack") || relationship.includes("dispreferred");
    const stroke = isAttack ? "#b42318"
      : relationship.includes("conclusion") ? "#117035"
        : relationship.includes("preferred") ? "#92400e"
          : relationship.includes("premise") || relationship.includes("support") ? "#0071bc" : "#647381";
    return [{
      id: asText(edge.edge_id, `a3-edge-${index}`),
      source,
      target,
      type: "smoothstep",
      label: relationship,
      data: { relationship },
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
      style: { stroke, strokeWidth: 1.65, ...(isAttack ? { strokeDasharray: "5 4" } : {}) },
    }];
  });
  return { nodes: flowNodes, edges: flowEdges };
}

export function A3View({ data }: { data: Data }) {
  const nodes = useMemo(() => asArray(data.nodes).filter(isObject), [data.nodes]);
  const edges = useMemo(() => asArray(data.edges).filter(isObject), [data.edges]);
  const graph = useMemo(() => toFlowGraph(nodes, edges), [nodes, edges]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const metadata = isObject(data.metadata) ? data.metadata : {};
  const validation = isObject(metadata.validation) ? metadata.validation : {};
  const issues = [...asArray(isObject(validation.layer_a) ? validation.layer_a.issues : null), ...asArray(isObject(validation.layer_b) ? validation.layer_b.issues : null)].filter(isObject);
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const selectedNode = selectedNodeId ? nodes.find((node) => asText(node.node_id) === selectedNodeId) : null;

  return <section className="space-y-4" aria-label="Scientific argument graph">
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-white p-4">
      <div className="min-w-48 flex-1"><p className="text-sm font-semibold text-text-primary">Graph validation</p><p className="mt-1 text-sm text-text-secondary">{errorCount ? `${errorCount} errors` : "No validation errors"}{warningCount ? ` · ${warningCount} review notes` : ""}</p></div>
      <StatusPill>{asText(validation.status, "not validated")}</StatusPill>
      <StatusPill>{graph.nodes.length} nodes · {graph.edges.length} relationships</StatusPill>
    </div>

    {issues.length > 0 && <details open={errorCount > 0} className={`rounded-xl border p-4 ${errorCount ? "border-error/40 bg-error/5" : "border-warning/40 bg-warning/5"}`}>
      <summary className="cursor-pointer text-sm font-semibold text-text-primary">Review validation messages ({issues.length})</summary>
      <ul className="mt-3 space-y-2 text-sm text-text-secondary">{issues.map((issue, index) => <li key={`${asText(issue.code)}-${index}`} className="flex items-start gap-2"><span className={`mt-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ${issue.severity === "error" ? "bg-error/10 text-error" : "bg-warning/10 text-warning"}`}>{asText(issue.severity, "note")}</span><span>{asText(issue.message, asText(issue.code))}{typeof issue.path === "string" ? ` (${issue.path})` : ""}</span></li>)}</ul>
    </details>}

    <section className="overflow-hidden rounded-xl border border-border bg-surface-white" aria-label="Argument graph canvas">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div><h3 className="font-semibold text-text-primary">Argument graph</h3><p className="mt-1 text-xs text-text-secondary">Select a node to inspect its full text and evidence. Drag to arrange; use the controls to zoom and fit.</p></div>
        <div className="flex flex-wrap gap-2 text-[11px]" aria-label="Graph legend"><StatusPill>I · Evidence / claim</StatusPill><StatusPill>RA · Inference</StatusPill><StatusPill>CA · Conflict</StatusPill><StatusPill>PA · Preference</StatusPill></div>
      </header>
      {graph.nodes.length ? <div className="h-[420px] min-h-[360px] w-full sm:h-[520px]">
        <LayoutFlow nodes={graph.nodes} edges={graph.edges} onSelect={(node) => setSelectedNodeId(node?.id ?? null)} ariaLabel="A3 argument graph. Drag to pan, scroll to zoom, and select a node to inspect it." />
      </div> : <div className="p-5"><Empty title="No graph nodes" detail="This generated graph has no nodes to display." /></div>}
      {selectedNode && <aside aria-label="Selected argument node" className="border-t border-border bg-bg-secondary/60 p-4" aria-live="polite">
        <div className="flex flex-wrap items-start justify-between gap-2"><div className="flex items-center gap-2"><StatusPill>{selectedNode.type === "S" ? `${asText(selectedNode.scheme_type)} scheme` : asText(selectedNode.content_kind, "Proposition")}</StatusPill><code className="text-xs text-text-muted">{asText(selectedNode.node_id)}</code></div><button type="button" className="min-h-9 rounded-lg border border-border bg-surface-white px-3 text-xs font-medium text-text-secondary hover:bg-bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" onClick={() => setSelectedNodeId(null)}>Clear selection</button></div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-primary">{asText(selectedNode.content, asText(selectedNode.label, "No node text"))}</p>
        {selectedNode.type === "I" && <ProvenanceList items={asArray(selectedNode.provenance)} />}
      </aside>}
    </section>

    <details className="rounded-xl border border-border bg-surface-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-text-primary">Browse all nodes and relationships</summary>
      <div className="mt-4 grid gap-5 xl:grid-cols-2">
        <div><h4 className="text-sm font-semibold text-text-primary">Nodes ({nodes.length})</h4><div className="mt-3 space-y-2">{nodes.map((node) => <article key={asText(node.node_id)} className="rounded-lg border border-border/70 p-3"><div className="flex items-center justify-between gap-2"><StatusPill>{node.type === "S" ? `${asText(node.scheme_type)} scheme` : `I · ${asText(node.content_kind)}`}</StatusPill><code className="text-xs text-text-muted">{asText(node.node_id)}</code></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-primary">{asText(node.content, asText(node.label))}</p>{node.type === "I" && <ProvenanceList items={asArray(node.provenance)} />}</article>)}</div>{nodes.length === 0 && <Empty title="No graph nodes" detail="This generated graph has no nodes." />}</div>
        <div><h4 className="text-sm font-semibold text-text-primary">Relationships ({edges.length})</h4><div className="mt-3 space-y-2">{edges.map((edge, index) => <div key={asText(edge.edge_id, `edge-${index}`)} className="rounded-lg border border-border/70 p-3"><div className="flex flex-wrap items-center gap-2 text-sm"><code>{asText(edge.source)}</code><span aria-hidden="true" className="text-text-muted">→</span><StatusPill>{asText(edge.role)}</StatusPill><span aria-hidden="true" className="text-text-muted">→</span><code>{asText(edge.target)}</code></div><p className="mt-1 text-xs text-text-muted">{asText(edge.edge_id)}</p></div>)}</div>{edges.length === 0 && <Empty title="No graph relationships" detail="The graph contains no argument edges." />}</div>
      </div>
    </details>
  </section>;
}

function ProvenanceList({ items }: { items: unknown[] }) {
  if (!items.length) return null;
  return <details className="mt-3 text-xs"><summary className="cursor-pointer font-medium text-text-secondary">Evidence provenance ({items.length})</summary><ul className="mt-2 space-y-2">{items.filter(isObject).map((item, index) => { const location = isObject(item.source_location) ? item.source_location : {}; return <li key={index} className="rounded-lg border border-border/70 bg-surface-white p-3 text-text-secondary">{asText(item.source_type)} · study {asText(item.study_id)} · finding {asText(item.finding_id)}{location.page !== undefined && <span> · page {location.page == null ? "unknown" : String(location.page)}{typeof location.paragraph === "number" ? ` · paragraph ${location.paragraph + 1}` : ""}</span>}{typeof item.source_quote === "string" && <blockquote className="mt-2 border-l-2 border-primary/50 pl-3 text-text-primary">{item.source_quote}</blockquote>}</li>; })}</ul></details>;
}
