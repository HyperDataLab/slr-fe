import { useMemo, useState } from "react";
import Button from "../../../../components/ui/Button";
import {
  LayoutFlow,
  type FlowEdge,
  type FlowNode,
} from "../../../../components/shared/paper/ResearchGraph";

type GraphData = {
  artifact_id?: string;
  nodes?: unknown[];
  edges?: unknown[];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const text = (value: unknown) => (typeof value === "string" ? value : "");

function reviewOf(edge: Record<string, unknown>) {
  const extensions = isObject(edge.extensions) ? edge.extensions : {};
  return isObject(extensions.human_review) ? extensions.human_review : {};
}

function EdgeReviewActions({
  edgeId,
  decision,
  disabled,
  onReview,
}: {
  edgeId: string;
  decision: string;
  disabled: boolean;
  onReview: (
    edgeId: string,
    decision: "VERIFIED" | "REJECTED",
    note?: string,
  ) => void;
}) {
  const [note, setNote] = useState("");

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-[11px] text-text-muted">
        Human review: {decision || "Not reviewed"}
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || decision === "VERIFIED"}
        onClick={() => onReview(edgeId, "VERIFIED")}
      >
        Verify edge
      </Button>
      <input
        aria-label={`Reason for rejecting edge ${edgeId}`}
        className="min-h-9 min-w-40 rounded-md border border-border bg-surface-white px-2 text-xs"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Reason to reject"
      />
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || !note.trim() || decision === "REJECTED"}
        onClick={() => onReview(edgeId, "REJECTED", note.trim())}
      >
        Reject edge
      </Button>
    </div>
  );
}

export default function ArgumentGraph({
  graph,
  title = "AIF Argument Graph",
  onReviewEdge,
  isReviewPending = false,
}: {
  graph: GraphData | null | undefined;
  title?: string;
  onReviewEdge?: (
    edgeId: string,
    decision: "VERIFIED" | "REJECTED",
    note?: string,
  ) => void;
  isReviewPending?: boolean;
}) {
  const [selectedNode, setSelectedNode] = useState<Record<string, unknown> | null>(null);
  const rawNodes = useMemo(
    () => (Array.isArray(graph?.nodes) ? graph.nodes.filter(isObject) : []),
    [graph?.nodes],
  );
  const rawEdges = useMemo(
    () => (Array.isArray(graph?.edges) ? graph.edges.filter(isObject) : []),
    [graph?.edges],
  );
  const reviewedEdges = rawEdges.filter((edge) =>
    ["VERIFIED", "REJECTED"].includes(text(reviewOf(edge).decision)),
  ).length;

  const nodes = useMemo<FlowNode[]>(
    () =>
      rawNodes.map((node, index) => {
        const id = text(node.node_id) || `argument-node-${index}`;
        const detail = text(node.content) || text(node.label) || id;
        const nodeType = text(node.type);
        const extensions = isObject(node.extensions) ? node.extensions : {};
        const schemeType =
          text(node.scheme_type).toUpperCase() ||
          (nodeType === "RA" || nodeType === "CA" ? nodeType : "");
        const normalizedLabel = text(node.label).toLowerCase();
        const aifShape =
          schemeType === "CA" || /rebuttal|conflict/.test(normalizedLabel)
            ? "CA"
            : schemeType === "RA" || nodeType === "S" || /inference|support/.test(normalizedLabel)
              ? "RA"
              : "I";
        const role =
          text(extensions.toulmin_role) ||
          text(node.content_kind) ||
          schemeType ||
          nodeType ||
          "AIF node";
        const normalizedRole = role.toLowerCase();
        const tone =
          aifShape === "CA"
            ? "warning"
            : /claim|conclusion/.test(normalizedRole)
              ? "success"
              : /rebuttal|attack/.test(normalizedRole)
                ? "danger"
                : aifShape === "RA"
                  ? "primary"
                  : "neutral";

        return {
          id,
          type: "argument",
          position: { x: 0, y: index * 24 },
          data: {
            label: detail.length > 150 ? `${detail.slice(0, 147)}…` : detail,
            detail,
            role,
            nodeType,
            aifShape,
            tone,
          },
        };
      }),
    [rawNodes],
  );
  const nodeIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);
  const edges = useMemo<FlowEdge[]>(
    () =>
      rawEdges.flatMap((edge, index) => {
        const source = text(edge.source);
        const target = text(edge.target);
        if (!nodeIds.has(source) || !nodeIds.has(target)) return [];

        const relationship = text(edge.role).toLowerCase();
        const decision = text(reviewOf(edge).decision);
        const stroke =
          decision === "VERIFIED"
            ? "#117035"
            : decision === "REJECTED" || relationship.includes("attack")
              ? "#b91c1c"
              : relationship.includes("conclusion")
                ? "#117035"
                : relationship.includes("premise") || relationship.includes("support")
                  ? "#0071bc"
                  : "#647381";

        return [
          {
            id: text(edge.edge_id) || `argument-edge-${index}`,
            source,
            target,
            label: relationship.replaceAll("_", " "),
            data: { relationship },
            style: {
              stroke,
              strokeWidth: 1.5,
              ...(decision === "REJECTED" || relationship.includes("attack")
                ? { strokeDasharray: "5 4" }
                : {}),
            },
          },
        ];
      }),
    [nodeIds, rawEdges],
  );

  if (!nodes.length) {
    return (
      <p className="rounded-lg border border-border bg-bg-secondary p-4 text-sm text-text-secondary">
        No AIF nodes were generated for this analysis.
      </p>
    );
  }

  const selectNode = (node: FlowNode | null) => {
    setSelectedNode(
      node ? rawNodes.find((raw) => text(raw.node_id) === node.id) ?? null : null,
    );
  };

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface-white" aria-label={title}>
      <div className="border-b border-border px-4 py-3">
        <h4 className="font-semibold text-text-primary">{title}</h4>
        <p className="text-xs text-text-muted">
          {nodes.length} nodes · {edges.length} edges. Drag to explore; use the mouse wheel to zoom.
          {onReviewEdge ? ` Human reviewed: ${reviewedEdges}/${edges.length} edges.` : ""}
        </p>
      </div>

      <div className="h-[360px] min-h-[280px] w-full sm:h-[420px]">
        <LayoutFlow
          nodes={nodes}
          edges={edges}
          onSelect={selectNode}
          ariaLabel={title}
        />
      </div>

      <details open className="border-t border-border px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium text-text-secondary">Inspect graph nodes</summary>
        <ul className="mt-2 flex flex-wrap gap-2">
          {rawNodes.map((node, index) => {
            const id = text(node.node_id);
            const label = text(node.content) || text(node.label) || id || `Node ${index + 1}`;
            return (
              <li key={id || index}>
                <button
                  type="button"
                  className="min-h-10 rounded-lg border border-border px-3 text-left text-text-primary hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => setSelectedNode(node)}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </details>

      {selectedNode && (
        <aside role="complementary" aria-label="Selected graph node" className="relative border-t border-border bg-bg-secondary p-4">
          <button
            type="button"
            className="absolute right-3 top-3 min-h-10 rounded-lg px-3 text-sm font-semibold text-text-secondary hover:bg-surface-white"
            onClick={() => setSelectedNode(null)}
          >
            Close
          </button>
          <h5 className="pr-20 font-semibold text-text-primary">
            {text(selectedNode.label) || text(selectedNode.node_id) || "Selected node"}
          </h5>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">
            {text(selectedNode.content) || text(selectedNode.label) || text(selectedNode.node_id)}
          </p>
          {text(selectedNode.type) && (
            <p className="mt-2 text-xs text-text-muted">Node type: {text(selectedNode.type)}</p>
          )}
        </aside>
      )}

      <details className="border-t border-border p-4 text-sm">
        <summary className="cursor-pointer font-medium text-text-secondary">
          {onReviewEdge ? `Review AIF edges (${reviewedEdges}/${edges.length} reviewed)` : "Accessible relationship list"}
        </summary>
        <ul className="mt-3 space-y-2">
          {rawEdges.map((edge, index) => {
            const edgeId = text(edge.edge_id) || `argument-edge-${index}`;
            const decision = text(reviewOf(edge).decision);
            return (
              <li key={edgeId} className="rounded-lg bg-bg-secondary p-2 text-text-secondary">
                <div>
                  <code>{text(edge.source)}</code> → <span className="font-medium">{text(edge.role).replaceAll("_", " ")}</span> → <code>{text(edge.target)}</code>
                </div>
                {onReviewEdge && (
                  <EdgeReviewActions
                    edgeId={edgeId}
                    decision={decision}
                    disabled={isReviewPending}
                    onReview={onReviewEdge}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </details>
    </section>
  );
}
