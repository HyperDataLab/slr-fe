import { useEffect, useState } from "react";
import { ChevronDown, CircleAlert } from "lucide-react";
import QAPaperDetails from "./QAPaperDetails";
import ConfirmModal from "../../../../components/ui/ConfirmModal";
import type { WorkspaceQAPaper } from "../QualityAssessmentWorkspace";
import { Worker, Viewer } from "@react-pdf-viewer/core";
import { PDF_WORKER_URL } from "../../../../config/pdfWorker";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { highlightPlugin, Trigger } from "@react-pdf-viewer/highlight";
import type {
  HighlightArea,
  RenderHighlightTargetProps,
  RenderHighlightsProps,
} from "@react-pdf-viewer/highlight";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import "@react-pdf-viewer/highlight/lib/styles/index.css";
import type { HighlightData } from "../sections/QAPapersTabContent";

interface AssessmentPaperViewerProps {
  paper?: WorkspaceQAPaper;
  highlights?: any[];
  onAddHighlight?: (highlight: HighlightArea[]) => void;
  onRemoveHighlight?: (index: number) => void;
  isLeader?: boolean;
}

export default function AssessmentPaperViewer({
  paper,
  highlights = [],
  onAddHighlight,
  onRemoveHighlight,
  isLeader,
}: AssessmentPaperViewerProps) {
  const [highlightToRemove, setHighlightToRemove] = useState<number | null>(
    null,
  );
  const [isPdfExpanded, setIsPdfExpanded] = useState(true);
  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  useEffect(() => {
    setIsPdfExpanded(true);
  }, [paper?.paperId]);

  const renderHighlights = (props: RenderHighlightsProps) => (
    <div>
      {highlights.map((highlightGroup: HighlightData, groupIndex: number) => {
        const areas = highlightGroup.areas || highlightGroup;
        const bgColor = highlightGroup.bgColor || "rgba(245, 158, 11, 0.4)";
        const reviewerInitials = highlightGroup.reviewerInitials || null;

        return areas
          .filter((area: HighlightArea) => area.pageIndex === props.pageIndex)
          .map((area: HighlightArea, areaIndex: number) => (
            <div
              key={`${groupIndex}-${areaIndex}`}
              className="group"
              style={{
                ...props.getCssProperties(area, props.rotation),
                background: bgColor,
                position: "absolute",
                cursor: isLeader ? "default" : "pointer",
                zIndex: 1,
                display: "flex",
                alignItems: "center",
              }}
              onClick={() => {
                if (!isLeader) {
                  setHighlightToRemove(groupIndex);
                }
              }}
              title={
                reviewerInitials === "YOU"
                  ? "Click to remove highlight"
                  : `Highlighted by ${reviewerInitials}`
              }
            >
              {reviewerInitials && (
                <div
                  className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none"
                  style={{
                    position: "absolute",
                    right: "-10px",
                    top: "-10px",
                    background: bgColor.replace("0.4", "1"),
                    color: "white",
                    fontSize: "9px",
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    fontWeight: "bold",
                    zIndex: 2,
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  }}
                >
                  {reviewerInitials.substring(0, 3)}
                </div>
              )}
            </div>
          ));
      })}
    </div>
  );

  const renderHighlightTarget = (props: RenderHighlightTargetProps) => {
    if (isLeader) return <></>;
    return (
      <div
        style={{
          background: "rgba(18, 35, 49, 0.96)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          borderRadius: "8px",
          color: "#fff",
          cursor: "pointer",
          padding: "4px 8px",
          position: "absolute",
          left: `${props.selectionRegion.left}%`,
          top: `${props.selectionRegion.top + props.selectionRegion.height}%`,
          transform: "translate(0, 8px)",
          zIndex: 10,
        }}
        onClick={() => {
          onAddHighlight?.(props.highlightAreas);
          props.cancel();
        }}
      >
        <span className="text-xs font-semibold">
          Highlight for selected criterion
        </span>
      </div>
    );
  };

  const highlightPluginInstance = highlightPlugin({
    renderHighlights,
    renderHighlightTarget,
    trigger: isLeader ? Trigger.None : Trigger.TextSelection,
  });

  return (
    <div className="custom-scrollbar flex h-full min-w-0 flex-1 flex-col overflow-y-auto bg-white">
      <ConfirmModal
        isOpen={highlightToRemove !== null}
        onClose={() => setHighlightToRemove(null)}
        onConfirm={() => {
          if (highlightToRemove !== null) {
            onRemoveHighlight?.(highlightToRemove);
          }
          setHighlightToRemove(null);
        }}
        title="Remove Highlight"
        message="Are you sure you want to remove this highlight?"
      />
      {paper ? (
        <div className="flex w-full flex-col p-4 sm:px-5 sm:py-5 xl:px-7 xl:py-6">
          <div className="min-w-0">
            <QAPaperDetails paper={paper} />
          </div>

          {paper.pdfUrl && (
            <section aria-labelledby="full-text-heading" className="mt-3 border-t border-border pt-2">
              <button type="button" aria-label={isPdfExpanded ? "Collapse full text PDF" : "Expand full text PDF"} aria-expanded={isPdfExpanded} aria-controls={isPdfExpanded ? "full-text-reader" : undefined} onClick={() => setIsPdfExpanded((expanded) => !expanded)} className="flex min-h-10 w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                <span className="flex items-center gap-2">
                  <span id="full-text-heading" className="text-sm font-semibold text-text-primary">Full text</span>
                  <span className="text-xs text-text-secondary">PDF reader</span>
                </span>
                <ChevronDown size={17} aria-hidden="true" className={`shrink-0 text-text-muted transition-transform duration-150 motion-reduce:transition-none ${isPdfExpanded ? "rotate-180" : ""}`} />
              </button>
              {isPdfExpanded && <div id="full-text-reader" className="relative mt-2 flex h-[min(72vh,860px)] min-h-[460px] w-full flex-col overflow-hidden bg-white">
                <Worker
                  workerUrl={PDF_WORKER_URL}
                >
                  <div className="absolute inset-0 font-sans">
                    <Viewer
                      fileUrl={paper.pdfUrl}
                      renderError={(error) => (
                        <div
                          role="alert"
                          title={error.message}
                          className="flex min-h-full items-center justify-center p-4"
                        >
                          <div className="flex max-w-sm flex-col items-center gap-2 text-center">
                            <CircleAlert size={20} className="shrink-0 text-error/70" aria-hidden="true" />
                            <span className="text-sm text-error/80">Unable to load this PDF. Check your connection and try again.</span>
                          </div>
                        </div>
                      )}
                      plugins={[
                        defaultLayoutPluginInstance,
                        highlightPluginInstance,
                      ]}
                    />
                  </div>
                </Worker>
              </div>}
            </section>
          )}
        </div>
      ) : (
        <div className="flex h-full flex-1 items-center justify-center p-6 text-center text-text-secondary">
          <div className="max-w-sm rounded-2xl border border-border bg-surface-white p-8 shadow-sm">
            <p className="text-sm font-semibold text-text-primary">Study details</p>
            <p className="mt-1 text-sm leading-6">Choose a study from the queue to inspect its abstract, metadata, and full text.</p>
          </div>
        </div>
      )}
    </div>
  );
}
