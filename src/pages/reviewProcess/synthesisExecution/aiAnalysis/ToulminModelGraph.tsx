import { useMemo, useState } from "react";
import {
  LayoutFlow,
  type FlowEdge,
  type FlowNode,
} from "../../../../components/shared/paper/ResearchGraph";
import type {
  AiComponent,
  LocatedAiEvidence,
  PaperAiAnalysisResult,
} from "../../../../services/paperAiAnalysisService";

type ToulminArgument = PaperAiAnalysisResult["toulmin_arguments"][number];

function clip(text: string, maxLength = 140) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function addComponentNode(
  nodes: FlowNode[],
  id: string,
  role: string,
  text: string,
  evidence: LocatedAiEvidence[],
) {
  const content = text.trim();
  if (!content) return false;
  const tone: FlowNode["data"]["tone"] =
    role === "Claim"
      ? "success"
      : role === "Rebuttal"
        ? "warning"
        : role === "Ground"
          ? "primary"
          : "neutral";

  nodes.push({
    id,
    type: "argument",
    position: { x: 0, y: nodes.length * 24 },
    data: {
      label: clip(content),
      detail: content,
      role,
      evidence,
      nodeType: "I",
      aifShape: "I",
      tone,
    },
  });
  return true;
}

function componentText(component: AiComponent | null | undefined) {
  return component?.text?.trim() ?? "";
}

function EvidenceQuotes({ items }: { items: LocatedAiEvidence[] }) {
  if (!items.length) return <p className="text-xs text-text-muted">No linked source quotations.</p>;
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={`${index}-${item.quote}`} className="rounded-lg bg-surface-white p-3 text-sm text-text-secondary">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
            <span>{item.section || item.source_location.section || "Source section unavailable"}</span>
            {typeof item.source_location.paragraph === "number" && <span>Paragraph {item.source_location.paragraph + 1}</span>}
          </div>
          <blockquote className="border-l-2 border-primary/40 pl-3 leading-6">{item.quote}</blockquote>
        </li>
      ))}
    </ul>
  );
}

export default function ToulminModelGraph({
  argumentsList,
}: {
  argumentsList: ToulminArgument[];
}) {
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const { nodes, edges } = useMemo(() => {
    const nextNodes: FlowNode[] = [];
    const nextEdges: FlowEdge[] = [];

    argumentsList.forEach((argument, argumentIndex) => {
      const base = `toulmin-${argument.argument_id || argumentIndex}`;
      const claimId = `${base}-claim`;
      const claim = componentText(argument.claim);
      addComponentNode(nextNodes, claimId, "Claim", claim, argument.claim?.evidence ?? []);

      const warrantId = `${base}-warrant`;
      const warrant = componentText(argument.warrant);
      if (warrant) {
        addComponentNode(nextNodes, warrantId, "Warrant", warrant, argument.warrant?.evidence ?? []);
      }

      argument.grounds.forEach((ground, groundIndex) => {
        const groundId = `${base}-ground-${groundIndex}`;
        const text = componentText(ground);
        if (!addComponentNode(nextNodes, groundId, "Ground", text, ground.evidence)) return;
        nextEdges.push({
          id: `${groundId}-supports`,
          source: groundId,
          target: warrant ? warrantId : claimId,
          label: "supports",
          type: "smoothstep",
        });
      });

      if (warrant) {
        nextEdges.push({
          id: `${warrantId}-to-claim`,
          source: warrantId,
          target: claimId,
          label: "warrants",
          type: "smoothstep",
        });
      }

      const backingId = `${base}-backing`;
      const backing = componentText(argument.backing);
      if (backing) {
        addComponentNode(nextNodes, backingId, "Backing", backing, argument.backing?.evidence ?? []);
        nextEdges.push({
          id: `${backingId}-supports`,
          source: backingId,
          target: warrant ? warrantId : claimId,
          label: "backs",
          type: "smoothstep",
        });
      }

      const rebuttalId = `${base}-rebuttal`;
      const rebuttal = componentText(argument.rebuttal);
      if (rebuttal) {
        addComponentNode(nextNodes, rebuttalId, "Rebuttal", rebuttal, argument.rebuttal?.evidence ?? []);
        nextEdges.push({
          id: `${rebuttalId}-challenges`,
          source: rebuttalId,
          target: claimId,
          label: "challenges",
          type: "smoothstep",
          style: { stroke: "#92400e", strokeDasharray: "5 4" },
        });
      }

      const qualifier = argument.qualifier?.trim() ?? "";
      if (qualifier) {
        const qualifierId = `${base}-qualifier`;
        addComponentNode(nextNodes, qualifierId, "Qualifier", qualifier, []);
        nextEdges.push({
          id: `${qualifierId}-qualifies`,
          source: qualifierId,
          target: claimId,
          label: "qualifies",
          type: "smoothstep",
        });
      }
    });

    const nodeIds = new Set(nextNodes.map((node) => node.id));
    return {
      nodes: nextNodes,
      edges: nextEdges.filter((edge) => nodeIds.has(String(edge.source)) && nodeIds.has(String(edge.target))),
    };
  }, [argumentsList]);

  if (!nodes.length) {
    return (
      <p className="rounded-lg border border-border bg-bg-secondary p-4 text-sm text-text-secondary">
        No defensible Toulmin argument was identified in the available source.
      </p>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface-white" aria-label="Toulmin argument graph">
      <div className="border-b border-border px-4 py-3">
        <h4 className="font-semibold text-text-primary">Argument structure</h4>
        <p className="text-xs text-text-secondary">
          {nodes.length} components · {edges.length} relationships. Drag nodes to explore; scroll to zoom.
        </p>
      </div>
      <div className="h-[360px] min-h-[280px] w-full sm:h-[420px]">
        <LayoutFlow
          nodes={nodes}
          edges={edges}
          onSelect={setSelectedNode}
          ariaLabel="Toulmin model graph"
        />
      </div>
      {selectedNode && (
        <aside className="border-t border-border bg-bg-secondary p-4" aria-live="polite">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h5 className="font-semibold text-text-primary">{selectedNode.data.role}</h5>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{selectedNode.data.detail}</p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-md px-2 py-1 text-sm text-text-secondary hover:bg-surface-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => setSelectedNode(null)}
            >
              Close
            </button>
          </div>
          {selectedNode.data.evidence?.length ? (
            <div className="mt-3">
              <EvidenceQuotes items={selectedNode.data.evidence} />
            </div>
          ) : (
            <p className="mt-2 text-xs text-text-muted">No source quotation was linked to this component.</p>
          )}
        </aside>
      )}
    </section>
  );
}
