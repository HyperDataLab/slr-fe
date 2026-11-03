import type { WorkspaceQAPaper } from "../QualityAssessmentWorkspace";
import AssessmentQueue from "../components/AssessmentQueue";
import AssessmentPaperViewer from "../components/AssessmentPaperViewer";
import ReviewerQAPanel from "../components/ReviewerQAPanel";
import LeaderQAPanel from "../components/LeaderQAPanel";
import { useState, useEffect, useRef } from "react";
import type { ReviewerDecisionPayload } from "../components/ReviewerQAPanel";
import type {
  QualityAssessmentStrategy,
  QualityAssessmentResolutionRequest,
  LeaderQAPaperResponse,
  QAPaperResponse,
} from "../../../../types/qualityAssessment";
import type { HighlightArea } from "@react-pdf-viewer/highlight";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../redux/store";
import { ArrowLeft, BookOpenText, ChevronLeft, ChevronRight, ListFilter, PanelsTopLeft } from "lucide-react";
import Drawer from "../../../../components/ui/Drawer";
import Button from "../../../../components/ui/Button";

export interface HighlightData {
  areas: HighlightArea[];
  reviewerInitials: string;
  bgColor: string;
}

interface QAPapersTabContentProps {
  papers: WorkspaceQAPaper[];
  strategies: QualityAssessmentStrategy[];
  isLeader: boolean;
  selectedPaper: WorkspaceQAPaper | null | undefined;
  selectedPaperId: string | null;
  setSelectedPaperId: (id: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onReviewerSave?: (
    notes: string | null,
    decisions: ReviewerDecisionPayload[],
  ) => void;
  onLeaderResolve?: (
    data: Omit<
      QualityAssessmentResolutionRequest,
      "qualityAssessmentProcessId" | "paperId"
    >,
    decisionData?: { notes: string | null; items: ReviewerDecisionPayload[] },
  ) => void;
  onLeaderSaveDraft?: (notes: string | null, decisions: ReviewerDecisionPayload[]) => void;
  onBack?: () => void;
  highlightsByCriterion?: Record<string, HighlightData[]>;
  isSaving?: boolean;
  canEdit?: boolean;
}

export function QAPapersTabContent({
  papers,
  strategies,
  isLeader,
  selectedPaper,
  selectedPaperId,
  setSelectedPaperId,
  searchQuery,
  setSearchQuery,
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  onReviewerSave,
  onLeaderResolve,
  onLeaderSaveDraft,
  onBack,
  isSaving,
  canEdit,
}: QAPapersTabContentProps) {
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"paper" | "review">("review");
  const currentPaperIndex = papers.findIndex((paper) => paper.paperId === selectedPaperId);
  const previousPageRef = useRef(currentPage);
  const pageDirectionRef = useRef<"previous" | "next" | null>(null);
  const [activeCriterionId, setActiveCriterionId] = useState<string | null>(
    null,
  );
  const [highlightsByCriterion, setHighlightsByCriterion] = useState<
    Record<string, HighlightData[]>
  >({});

  useEffect(() => {
    if (currentPage === previousPageRef.current || papers.length === 0) return;
    previousPageRef.current = currentPage;
    const direction = pageDirectionRef.current;
    pageDirectionRef.current = null;
    setSelectedPaperId(direction === "previous" ? papers[papers.length - 1].paperId : papers[0].paperId);
  }, [currentPage, papers, setSelectedPaperId]);

  useEffect(() => {
    setMobilePanel(isLeader ? "review" : "paper");
  }, [selectedPaperId, isLeader]);

  useEffect(() => {
    const firstCriterionId =
      strategies?.[0]?.checklists?.[0]?.criteria?.[0]?.criterionId || null;
    setActiveCriterionId(firstCriterionId);
    setHighlightsByCriterion({});
    if (selectedPaper) {
      if (!isLeader) {
        const qPaper = selectedPaper as QAPaperResponse;
        const initialHighlights: Record<string, HighlightData[]> = {};
        const myDecision = qPaper.decisions?.[0];
        myDecision?.decisionItems?.forEach((item) => {
          if (item.qualityCriterionId && item.pdfHighlightCoordinates) {
            try {
              const pageStrs = item.pdfHighlightCoordinates.split(";");
              const parsedAreas: HighlightArea[][] = pageStrs
                .filter(Boolean)
                .map((hStr) => {
                  const [page, x, y, height, width] = hStr
                    .split(",")
                    .map(Number);
                  return [{ pageIndex: page, top: y, left: x, height, width }];
                });
              initialHighlights[item.qualityCriterionId] = parsedAreas.map(
                (areas: HighlightArea[]) => ({
                  areas,
                  reviewerInitials: "YOU",
                  bgColor: "rgba(245, 158, 11, 0.4)",
                }),
              );
            } catch {
              // Skip malformed stored highlight coordinates.
            }
          }
        });
        setHighlightsByCriterion(initialHighlights);
      } else {
        // Leader loads highlights from all reviewers
        const lPaper = selectedPaper as LeaderQAPaperResponse;
        const initialHighlights: Record<string, HighlightData[]> = {};

        lPaper.decisions?.forEach((decision) => {
          const reviewer = lPaper.reviewers?.find(
            (r) => r.id === decision.reviewerId,
          );
          const isCurrentUser = decision?.reviewerId === currentUser?.id;
          const initials = isCurrentUser
            ? "YOU"
            : reviewer
              ? (reviewer.fullname || reviewer.username)
                  .substring(0, 2)
                  .toUpperCase()
              : "NA";

          let bgColor = "rgba(245, 158, 11, 0.4)";
          if (!isCurrentUser) {
            const colorIndex = decision.reviewerId.charCodeAt(0) % 5;
            const colors = [
              "rgba(239, 68, 68, 0.4)",
              "rgba(59, 130, 246, 0.4)",
              "rgba(16, 185, 129, 0.4)",
              "rgba(245, 158, 11, 0.4)",
              "rgba(139, 92, 246, 0.4)",
            ];
            bgColor = colors[colorIndex];
          }

          decision.decisionItems?.forEach((item) => {
            if (item.qualityCriterionId && item.pdfHighlightCoordinates) {
              try {
                const pageStrs = item.pdfHighlightCoordinates.split(";");
                const areas: HighlightArea[] = pageStrs
                  .filter(Boolean)
                  .map((hStr) => {
                    const [page, x, y, height, width] = hStr
                      .split(",")
                      .map(Number);
                    return { pageIndex: page, top: y, left: x, height, width };
                  });

                if (!initialHighlights[item.qualityCriterionId]) {
                  initialHighlights[item.qualityCriterionId] = [];
                }
                // Add each highlight group with reviewer styling
                initialHighlights[item.qualityCriterionId].push({
                  areas,
                  reviewerInitials: initials,
                  bgColor,
                });
              } catch {
                // Skip malformed stored highlight coordinates.
              }
            }
          });
        });
        setHighlightsByCriterion(initialHighlights);
      }
    }
  }, [
    selectedPaperId,
    selectedPaper,
    isLeader,
    strategies,
  ]);

  const handleAddHighlight = (areas: HighlightArea[]) => {
    if (!activeCriterionId) {
      return;
    }
    const newHighlightData: HighlightData = {
      areas,
      reviewerInitials: "YOU",
      bgColor: "rgba(255, 255, 0, 0.4)",
    };
    setHighlightsByCriterion((prev) => ({
      ...prev,
      [activeCriterionId]: [
        ...(prev[activeCriterionId] || []),
        newHighlightData,
      ],
    }));
  };

  const handleRemoveHighlight = (index: number) => {
    if (!activeCriterionId) return;
    setHighlightsByCriterion((prev) => {
      const arr = prev[activeCriterionId] || [];
      return {
        ...prev,
        [activeCriterionId]: arr.filter((_, i) => i !== index),
      };
    });
  };

  const currentHighlights = activeCriterionId
    ? highlightsByCriterion[activeCriterionId] || []
    : [];

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg-primary">
      <div className="sticky top-0 z-20 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-surface-white px-4 py-3 sm:px-6">
        <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:min-h-9">
          <ArrowLeft size={17} aria-hidden="true" /> Back to assessment
        </button>
        <div className="hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text-primary">{currentPaperIndex >= 0 ? `Paper ${(currentPage - 1) * 10 + currentPaperIndex + 1} of ${totalItems}` : `${totalItems} papers`} <span className="font-normal text-text-secondary">· {isLeader ? "Conflict resolution" : "Quality assessment"}</span></p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" aria-label="Previous paper" disabled={currentPaperIndex < 0 || (currentPaperIndex === 0 && currentPage <= 1)} onClick={() => currentPaperIndex > 0 ? setSelectedPaperId(papers[currentPaperIndex - 1]?.paperId ?? null) : (pageDirectionRef.current = "previous", onPageChange(currentPage - 1))} className="h-11 w-11 shrink-0 p-0 sm:h-9 sm:w-9"><ChevronLeft size={18} aria-hidden="true" /></Button>
          <Button variant="secondary" size="sm" aria-label="Next paper" disabled={currentPaperIndex < 0 || (currentPaperIndex >= papers.length - 1 && currentPage >= totalPages)} onClick={() => currentPaperIndex < papers.length - 1 ? setSelectedPaperId(papers[currentPaperIndex + 1]?.paperId ?? null) : (pageDirectionRef.current = "next", onPageChange(currentPage + 1))} className="h-11 w-11 shrink-0 p-0 sm:h-9 sm:w-9"><ChevronRight size={18} aria-hidden="true" /></Button>
          <Button variant="secondary" size="sm" onClick={() => setIsQueueOpen(true)} className="ml-1 min-h-11 gap-2 px-3 text-sm sm:min-h-9"><ListFilter size={16} className="text-primary" aria-hidden="true" /><span>Paper queue</span></Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col xl:overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface-white px-4 py-2 xl:hidden" role="tablist" aria-label="Workspace panel">
        <button type="button" role="tab" aria-selected={mobilePanel === "paper"} onClick={() => setMobilePanel("paper")} className={`inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${mobilePanel === "paper" ? "bg-primary-light text-primary" : "text-text-secondary hover:bg-bg-primary"}`}><BookOpenText size={16} aria-hidden="true" /> Paper</button>
        <button type="button" role="tab" aria-selected={mobilePanel === "review"} onClick={() => setMobilePanel("review")} className={`inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${mobilePanel === "review" ? "bg-primary-light text-primary" : "text-text-secondary hover:bg-bg-primary"}`}><PanelsTopLeft size={16} aria-hidden="true" /> {isLeader ? "Resolution" : "Assessment"}</button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1 overflow-hidden xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {/* Paper context */}
      <div role="tabpanel" className={`${mobilePanel === "paper" ? "flex" : "hidden"} relative h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white xl:flex xl:border-r xl:border-border`}>
        {selectedPaper ? (
          <div className="h-full min-h-0 overflow-hidden">
            <AssessmentPaperViewer
              paper={selectedPaper}
              highlights={currentHighlights}
              onAddHighlight={handleAddHighlight}
              onRemoveHighlight={handleRemoveHighlight}
              isLeader={isLeader}
            />
          </div>
        ) : (
          <div className="flex min-h-[520px] flex-1 items-center justify-center bg-bg-primary/60 px-6 text-center text-text-secondary xl:min-h-0">
            <div className="max-w-sm">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-accent">
                <span className="text-lg font-semibold" aria-hidden="true">1</span>
              </div>
              <p className="text-sm font-semibold text-text-primary">Choose a study to review</p>
              <p className="mt-1 text-sm leading-6 text-text-secondary">Paper details and assessment activity will appear here.</p>
            </div>
          </div>
        )}
      </div>

      {/* Unified review and resolution */}
      <div role="tabpanel" className={`${mobilePanel === "review" ? "flex" : "hidden"} relative z-10 h-full min-h-0 min-w-0 flex-col overflow-hidden bg-surface-white xl:flex`}>
        {selectedPaper ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex-1 overflow-hidden">
              {isLeader ? (
                <LeaderQAPanel
                  paper={selectedPaper as LeaderQAPaperResponse}
                  strategies={strategies}
                  onResolve={onLeaderResolve!}
                  onSaveDraft={onLeaderSaveDraft}
                  isResolving={isSaving}
                  activeCriterionId={activeCriterionId}
                  onSelectCriterion={setActiveCriterionId}
                  highlightsByCriterion={highlightsByCriterion}
                  canEdit={canEdit}
                />
              ) : (
                <ReviewerQAPanel
                  paper={selectedPaper as QAPaperResponse}
                  strategies={strategies}
                  onSave={onReviewerSave!}
                  isSaving={isSaving}
                  activeCriterionId={activeCriterionId}
                  onSelectCriterion={setActiveCriterionId}
                  highlightsByCriterion={highlightsByCriterion}
                  canEdit={canEdit}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[360px] flex-1 items-center justify-center bg-bg-primary/50 p-6 text-center text-text-secondary xl:min-h-0">
            <div className="max-w-xs">
              <p className="text-sm font-semibold text-text-primary">Assessment panel</p>
              <p className="mt-1 text-sm leading-6">Select a paper to view reviewer decisions and submit a resolution.</p>
            </div>
          </div>
        )}
      </div>
      </div>
      </div>
      <Drawer isOpen={isQueueOpen} onClose={() => setIsQueueOpen(false)} title="Paper queue" description="Choose a paper to assess." side="left" maxWidth="max-w-sm" contentClassName="min-h-0 flex-1 p-0">
        <AssessmentQueue
          papers={papers}
          selectedPaperId={selectedPaperId}
          onSelectPaper={(paperId) => { setSelectedPaperId(paperId); setIsQueueOpen(false); }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isLeader={isLeader}
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageChange={onPageChange}
        />
      </Drawer>
    </div>
  );
}
