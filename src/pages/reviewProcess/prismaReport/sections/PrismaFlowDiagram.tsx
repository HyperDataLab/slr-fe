// PRISMA 2020 flow diagram presentation. Report data and export behavior stay in the existing services.

import {
  useState,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from "react";
import { FiMaximize2, FiDownload } from "react-icons/fi";
import { toPng } from "html-to-image";
import { saveAs } from "file-saver";
import { toastError, toastLoading, toastSuccess } from "../../../../utils/toast";
import type { PrismaNodeResponse, PrismaBreakdownResponse } from "../../../../types/prismaReport";
import { PRISMA_STAGE_LABELS } from "../../../../types/prismaReport";
import Button from "../../../../components/ui/Button";
import Modal from "../../../../components/ui/Modal";

interface PrismaFlowDiagramProps {
  nodes: PrismaNodeResponse[];
  includedNode: PrismaNodeResponse | null;
  isLoading: boolean;
  isExpanded?: boolean;
}

export interface PrismaFlowDiagramRef {
  exportImage: () => Promise<void>;
}

const MAIN_STAGES = [
  "RecordsIdentified",
  "RecordsScreened",
  "ReportsSoughtForRetrieval",
  "ReportsAssessed",
] as const;

const _SIDE_STAGES = [
  "DuplicateRecordsRemoved",
  "RecordsExcluded",
  "ReportsNotRetrieved",
  "ReportsExcluded",
] as const;

function countLabel(value: number) {
  return value.toLocaleString();
}

function DiagramNode({
  label,
  count,
  muted = false,
  included = false,
  breakdown,
  reasons,
}: {
  label: string;
  count: number;
  muted?: boolean;
  included?: boolean;
  breakdown?: PrismaBreakdownResponse[];
  reasons?: PrismaBreakdownResponse[];
}) {
  return (
    <div
      className={`w-full rounded-xl border px-4 py-3 shadow-none ${
        included
          ? "border-success/30 border-l-[3px] bg-success/5"
          : muted
            ? "border-border/70 bg-bg-secondary/75 text-text-secondary shadow-none"
            : "border-border/80 bg-surface-white text-text-primary"
      }`}
      role="group"
    >
      <div className="flex items-center justify-between gap-4">
        <p className={`text-sm font-medium leading-snug ${muted ? "text-text-secondary" : "text-text-primary"}`}>
          {label.trim()}
        </p>
        <p className={`shrink-0 text-sm font-semibold tabular-nums ${included ? "text-success" : "text-text-primary"}`}>
          n = {countLabel(count)}
        </p>
      </div>
      {(breakdown?.length || reasons?.length) ? (
        <div className="mt-2 border-t border-border/80 pt-2 space-y-1">
          {(breakdown ?? reasons ?? []).map((item, index) => (
            <div key={`${item.label}-${index}`} className="flex justify-between gap-3 text-xs text-text-secondary">
              <span>{item.label}</span><span className="shrink-0 tabular-nums">n = {countLabel(item.count)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StageDivider({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3 py-3" aria-label={children}>
      <div className="h-px flex-1 bg-border/60" />
      <span className="rounded-md bg-primary-light/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">{children}</span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}

function FlowConnector({ direction }: { direction: "horizontal" | "vertical" }) {
  return direction === "horizontal" ? (
    <div className="relative flex w-full items-center" aria-hidden="true">
      <div className="h-px w-full bg-border" />
      <div className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rounded-full border-2 border-white bg-primary/50 shadow-none" />
    </div>
  ) : (
    <div className="relative flex h-full justify-center" aria-hidden="true">
      <div className="h-full w-px bg-border" />
      <div className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border-2 border-white bg-primary/50 shadow-none" />
    </div>
  );
}

function DiagramSkeleton() {
  return (
    <div className="mx-auto max-w-4xl motion-safe:animate-pulse motion-reduce:animate-none space-y-3 py-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_32px_1fr] gap-3">
          <div className="h-[54px] rounded-xl border border-border/70 bg-bg-secondary" />
          <div className="hidden md:block" />
          <div className="h-[54px] rounded-xl border border-border/70 bg-bg-secondary" />
        </div>
      ))}
    </div>
  );
}

const PrismaFlowDiagram = forwardRef<PrismaFlowDiagramRef, PrismaFlowDiagramProps>(
  ({ nodes, includedNode, isLoading, isExpanded: initialIsExpanded = false }, ref) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const mainDiagramRef = useRef<HTMLDivElement>(null);
    const modalDiagramRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!isModalOpen) return;
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") setIsModalOpen(false);
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isModalOpen]);

    const handleExportImage = useCallback(async () => {
      const target = isModalOpen ? modalDiagramRef.current || mainDiagramRef.current : mainDiagramRef.current;
      if (!target) {
        toastError("Diagram element not ready for export.");
        return;
      }
      const toastId = toastLoading("Generating high-resolution PNG...");
      try {
        let dataUrl: string;
        try {
          dataUrl = await toPng(target, {
            cacheBust: false,
            backgroundColor: "#ffffff",
            pixelRatio: 2,
            fontEmbedCSS: "",
            style: { padding: "24px", margin: "0", backgroundColor: "#ffffff" },
          });
        } catch {
          dataUrl = await toPng(target, { backgroundColor: "#ffffff", pixelRatio: 1.5 });
        }
        saveAs(dataUrl, `PRISMA_Flow_Diagram_${new Date().toISOString().split("T")[0]}.png`);
        toastSuccess("PRISMA flow diagram exported as PNG!", undefined, { id: toastId });
      } catch (error) {
        console.error("Failed to export PRISMA diagram:", error);
        toastError("Failed to export PRISMA diagram as PNG.", undefined, { id: toastId });
      }
    }, [isModalOpen]);

    useImperativeHandle(ref, () => ({ exportImage: handleExportImage }));

    if (isLoading) return <DiagramSkeleton />;

    const nodeByStage = new Map<PrismaNodeResponse["stage"], PrismaNodeResponse>();
    nodes.forEach((node) => nodeByStage.set(node.stage, node));
    const mainNodes = MAIN_STAGES.map((stage) => nodeByStage.get(stage)).filter(
      (node): node is PrismaNodeResponse => Boolean(node),
    );
    const sideFor = (node: PrismaNodeResponse) => {
      if (node.sideBox) return node.sideBox;
      const stageByParent: Record<string, (typeof _SIDE_STAGES)[number]> = {
        RecordsIdentified: "DuplicateRecordsRemoved",
        RecordsScreened: "RecordsExcluded",
        ReportsSoughtForRetrieval: "ReportsNotRetrieved",
        ReportsAssessed: "ReportsExcluded",
      };
      const stage = stageByParent[node.stage];
      if (!stage) return undefined;
      const sideNode = nodeByStage.get(stage);
      return sideNode ? {
        stage: sideNode.stage,
        total: sideNode.total,
        breakdown: sideNode.breakdown,
        reasons: sideNode.reasons,
      } : undefined;
    };

    const renderDiagram = (modal = false) => (
      <div
        ref={modal ? modalDiagramRef : mainDiagramRef}
        className={`prisma-flow-diagram mx-auto w-full rounded-xl ${modal ? "max-w-5xl bg-surface-white px-4 py-6 sm:px-8" : "max-w-5xl bg-surface-white px-3 py-4 sm:px-5 sm:py-5"}`}
        role="figure"
        aria-label="PRISMA 2020 flow diagram"
      >
        <StageDivider>Identification</StageDivider>
        <div className="space-y-1">
          {mainNodes.map((node, index) => {
            const branch = sideFor(node);
            const isLastIdentification = node.stage === "RecordsIdentified";
            const isIncludedParent = node.stage === "ReportsAssessed";
            return (
              <div key={node.stage}>
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
                  <div className="md:col-start-1 md:row-start-1">
                    <DiagramNode
                      label={PRISMA_STAGE_LABELS[node.stage] ?? node.stage}
                      count={node.total}
                      breakdown={node.breakdown}
                      reasons={node.reasons}
                    />
                  </div>
                  <div className="hidden md:flex md:col-start-2 md:row-start-1 justify-center self-stretch">
                    {branch && <FlowConnector direction="horizontal" />}
                  </div>
                  <div className="md:col-start-3 md:row-start-1">
                    {branch ? (
                      <DiagramNode
                        label={PRISMA_STAGE_LABELS[branch.stage] ?? branch.stage}
                        count={branch.total}
                        breakdown={branch.breakdown}
                        reasons={branch.reasons}
                        muted
                      />
                    ) : <div className="hidden md:block" />}
                  </div>
                </div>
                {!isIncludedParent && index < mainNodes.length - 1 && (
                  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] h-5">
                    <div className="hidden md:flex md:justify-center"><FlowConnector direction="vertical" /></div>
                    <div className="flex md:hidden justify-center"><FlowConnector direction="vertical" /></div>
                  </div>
                )}
                {isLastIdentification && <StageDivider>Screening &amp; Eligibility</StageDivider>}
              </div>
            );
          })}
        </div>
        {includedNode && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] h-5">
              <div className="hidden md:flex md:justify-center"><FlowConnector direction="vertical" /></div>
              <div className="flex md:hidden justify-center"><FlowConnector direction="vertical" /></div>
            </div>
            <StageDivider>Studies Included</StageDivider>
            <div className="w-full md:w-[calc(50%-16px)] md:ml-[calc(25%-8px)] md:mr-0">
              <DiagramNode
                label={PRISMA_STAGE_LABELS[includedNode.stage] ?? includedNode.stage}
                count={includedNode.total}
                breakdown={includedNode.breakdown}
                reasons={includedNode.reasons}
                included
              />
            </div>
          </>
        )}
      </div>
    );

    return (
      <>
        <div className="flex flex-wrap justify-end items-center gap-2 mb-3">
          <button
            onClick={handleExportImage}
            className="inline-flex min-h-11 items-center gap-2 px-3 py-2.5 bg-surface-white border border-border rounded-xl text-sm font-medium text-text-primary hover:bg-bg-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            title="Download diagram as high-quality PNG"
          >
            <FiDownload className="w-4 h-4" />Export PNG
          </button>
          {!initialIsExpanded && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex min-h-11 items-center gap-2 px-3 py-2.5 bg-surface-white border border-border rounded-xl text-sm font-medium text-text-primary hover:bg-bg-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              aria-label="View full diagram"
            >
              <FiMaximize2 className="w-4 h-4" />View Full Diagram
            </button>
          )}
        </div>
        {renderDiagram()}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="PRISMA 2020 Flow Diagram"
          size="xl"
          className="h-[calc(100dvh-2rem)]"
          bodyClassName="min-h-0 flex-1 overflow-auto bg-surface-white p-3 sm:p-5"
          footer={
            <Button onClick={handleExportImage} size="sm" className="min-h-11 gap-2">
              <FiDownload className="h-4 w-4" />
              Export PNG
            </Button>
          }
        >
          {renderDiagram(true)}
        </Modal>
      </>
    );
  },
);

export default PrismaFlowDiagram;
