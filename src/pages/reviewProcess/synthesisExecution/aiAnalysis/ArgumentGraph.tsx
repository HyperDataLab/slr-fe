import { useState } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import type { ElementDefinition, LayoutOptions, StylesheetJson } from "cytoscape";
import Button from "../../../../components/ui/Button";

type GraphData = {
  artifact_id?: string;
  nodes?: unknown[];
  edges?: unknown[];
};

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const text = (value: unknown) => typeof value === "string" ? value : "";

function reviewOf(edge: Record<string, unknown>) {
  const extensions = isObject(edge.extensions) ? edge.extensions : {};
  return isObject(extensions.human_review) ? extensions.human_review : {};
}

const stylesheet: StylesheetJson = [
  { selector: "node", style: { label: "data(label)", "font-size": 11, color: "#102338", "text-wrap": "wrap", "text-max-width": "170px", "text-valign": "center", "text-halign": "center", "background-color": "#dbeafe", "border-width": 1, "border-color": "#60a5fa", width: 180, height: 68, shape: "round-rectangle", padding: "8px" } },
  { selector: "node[type = 'S']", style: { "background-color": "#fef3c7", "border-color": "#f59e0b", shape: "diamond", width: 96, height: 76, "font-size": 10 } },
  { selector: "edge", style: { width: 2, "line-color": "#718096", "target-arrow-color": "#718096", "target-arrow-shape": "triangle", "curve-style": "bezier", label: "data(label)", "font-size": 9, color: "#4b5563", "text-background-color": "#ffffff", "text-background-opacity": 0.9, "text-background-padding": "2px" } },
  { selector: "edge[reviewStatus = 'VERIFIED']", style: { "line-color": "#15803d", "target-arrow-color": "#15803d" } },
  { selector: "edge[reviewStatus = 'REJECTED']", style: { "line-color": "#b91c1c", "target-arrow-color": "#b91c1c", "line-style": "dashed" } },
];

const layout: LayoutOptions = { name: "breadthfirst", directed: true, padding: 24, spacingFactor: 1.25, direction: "rightward" };

function EdgeReviewActions({ edgeId, decision, disabled, onReview }: { edgeId: string; decision: string; disabled: boolean; onReview: (edgeId: string, decision: "VERIFIED" | "REJECTED", note?: string) => void }) {
  const [note, setNote] = useState("");
  return <div className="mt-2 flex flex-wrap items-center gap-2">
    <span className="text-[11px] text-text-muted">Human review: {decision || "Not reviewed"}</span>
    <Button size="sm" variant="outline" disabled={disabled || decision === "VERIFIED"} onClick={() => onReview(edgeId, "VERIFIED")}>Verify edge</Button>
    <input aria-label={`Reason for rejecting edge ${edgeId}`} className="min-h-9 min-w-40 rounded-md border border-border bg-surface-white px-2 text-xs" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reason to reject" />
    <Button size="sm" variant="outline" disabled={disabled || !note.trim() || decision === "REJECTED"} onClick={() => onReview(edgeId, "REJECTED", note.trim())}>Reject edge</Button>
  </div>;
}

export default function ArgumentGraph({ graph, title = "AIF Argument Graph", onReviewEdge, isReviewPending = false }: { graph: GraphData | null | undefined; title?: string; onReviewEdge?: (edgeId: string, decision: "VERIFIED" | "REJECTED", note?: string) => void; isReviewPending?: boolean }) {
  const [selectedNode, setSelectedNode] = useState<Record<string, unknown> | null>(null);
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes.filter(isObject) : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges.filter(isObject) : [];
  const reviewedEdges = edges.filter((edge) => ["VERIFIED", "REJECTED"].includes(text(reviewOf(edge).decision))).length;
  if (!nodes.length) return <p className="rounded-lg border border-border bg-bg-secondary p-4 text-sm text-text-secondary">No AIF nodes were generated for this analysis.</p>;

  const elements: ElementDefinition[] = [
    ...nodes.map((node) => {
      const label = text(node.content) || text(node.label) || text(node.node_id);
      return { data: { id: text(node.node_id), label: label.length > 92 ? `${label.slice(0, 89)}…` : label, type: node.type === "S" ? "S" : "I" } };
    }),
    ...edges.map((edge) => ({ data: { id: text(edge.edge_id), source: text(edge.source), target: text(edge.target), label: text(edge.role).replaceAll("_", " "), reviewStatus: text(reviewOf(edge).decision) } })),
  ];

  return <section className="overflow-hidden rounded-xl border border-border bg-surface-white" aria-label={title}>
    <div className="border-b border-border px-4 py-3"><h4 className="font-semibold text-text-primary">{title}</h4><p className="text-xs text-text-muted">{nodes.length} nodes · {edges.length} edges. Drag to explore; use the mouse wheel to zoom.{onReviewEdge ? ` Human reviewed: ${reviewedEdges}/${edges.length} edges.` : ""}</p></div>
    <CytoscapeComponent key={text(graph?.artifact_id) || `${nodes.length}-${edges.length}-${text(nodes[0]?.node_id)}`} elements={elements} stylesheet={stylesheet} layout={layout} style={{ width: "100%", height: Math.min(480, Math.max(280, nodes.length * 50)) }} minZoom={0.35} maxZoom={2.5} />
    <details open className="border-t border-border px-4 py-3 text-sm"><summary className="cursor-pointer font-medium text-text-secondary">Inspect graph nodes</summary><ul className="mt-2 flex flex-wrap gap-2">{nodes.map((node, index) => { const label = text(node.content) || text(node.label) || text(node.node_id) || `Node ${index + 1}`; return <li key={text(node.node_id) || index}><button type="button" className="min-h-10 rounded-lg border border-border px-3 text-left text-text-primary hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => setSelectedNode(node)}>{label}</button></li>; })}</ul></details>
    {selectedNode && <aside role="complementary" aria-label="Selected graph node" className="relative border-t border-border bg-bg-secondary p-4"><button type="button" className="absolute right-3 top-3 min-h-10 rounded-lg px-3 text-sm font-semibold text-text-secondary hover:bg-surface-white" onClick={() => setSelectedNode(null)}>Close</button><h5 className="pr-20 font-semibold text-text-primary">{text(selectedNode.label) || text(selectedNode.node_id) || "Selected node"}</h5><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{text(selectedNode.content) || text(selectedNode.label) || text(selectedNode.node_id)}</p>{text(selectedNode.type) && <p className="mt-2 text-xs text-text-muted">Node type: {text(selectedNode.type)}</p>}</aside>}
    <details className="border-t border-border p-4 text-sm">
      <summary className="cursor-pointer font-medium text-text-secondary">{onReviewEdge ? `Review AIF edges (${reviewedEdges}/${edges.length} reviewed)` : "Accessible relationship list"}</summary>
      <ul className="mt-3 space-y-2">
        {edges.map((edge) => <li key={text(edge.edge_id)} className="rounded-lg bg-bg-secondary p-2 text-text-secondary"><div><code>{text(edge.source)}</code> → <span className="font-medium">{text(edge.role).replaceAll("_", " ")}</span> → <code>{text(edge.target)}</code></div>{onReviewEdge && <EdgeReviewActions edgeId={text(edge.edge_id)} decision={text(reviewOf(edge).decision)} disabled={isReviewPending} onReview={onReviewEdge} />}</li>)}
      </ul>
    </details>
  </section>;
}
