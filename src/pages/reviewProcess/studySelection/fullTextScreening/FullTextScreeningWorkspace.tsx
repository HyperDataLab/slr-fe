import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiChevronLeft, FiChevronRight, FiFileText, FiList } from "react-icons/fi";
import { useFullTextScreening } from "./hooks/useFullTextScreening";
import FullTextReader from "./components/FullTextReader";
import FullTextRightPanel from "./components/FullTextRightPanel";
import DecisionBar from "./components/DecisionBar";
import Button from "../../../../components/ui/Button";
import LoadingSpinner from "../../../../components/ui/LoadingSpinner";
import Modal from "../../../../components/ui/Modal";
import QueryErrorState from "../../../../components/ui/QueryErrorState";
import { useStudySelectionDetails } from "../../../../hooks/useStudySelection";
import { useProject } from "../../../../hooks/useProjects";
import { PaperPhase, SelectionProcessStatus } from "../../../../types/studySelection";
import StudySelectionPaperList from "../components/StudySelectionPaperList";
import { getAdjacentPaperId, getPaperQueueNeighbors } from "../navigatePaperQueue";
import { saveWorkspaceFilters, workspaceContextKey, workspaceFilterKey } from "../workspaceState";

export default function FullTextScreeningWorkspace() {
  const ws = useFullTextScreening();
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId, processId, screeningProcessId, paperId } = useParams();
  const [contextOpen, setContextOpen] = useState(() => {
    try { return localStorage.getItem("study-selection:context-open") !== "false"; } catch { return true; }
  });
  const [mobileContextOpen, setMobileContextOpen] = useState(false);
  const [directNeighbors, setDirectNeighbors] = useState<{ paperId: string; previous: boolean; next: boolean } | null>(null);
  const { data: processDetails } = useStudySelectionDetails(screeningProcessId);
  const { project } = useProject(projectId);
  const isCompleted = processDetails?.status === SelectionProcessStatus.Completed;
  const hasQueueContext = Boolean((location.state as { listPath?: string } | null)?.listPath);
  const currentIndex = ws.papers.findIndex((paper) => paper.id === paperId);

  useEffect(() => {
    if (!paperId || hasQueueContext || currentIndex >= 0 || ws.isLoading || !screeningProcessId) return;
    let active = true;
    void getPaperQueueNeighbors({ processId: screeningProcessId, phase: PaperPhase.FullText, currentId: paperId, papers: ws.papers, pagination: ws.pagination, filters: ws.filters })
      .then((neighbors) => { if (active) setDirectNeighbors({ paperId, previous: !!neighbors.previous, next: !!neighbors.next }); })
      .catch(() => { if (active) setDirectNeighbors({ paperId, previous: false, next: false }); });
    return () => { active = false; };
  }, [paperId, hasQueueContext, currentIndex, ws.isLoading, screeningProcessId, ws.papers, ws.pagination, ws.filters]);

  const listPath = `/projects/${projectId}/processes/${processId}/full-text-screening/${screeningProcessId}`;
  const detailPath = (id: string) => `${listPath}/papers/${id}`;
  const openPaper = (id: string) => {
    saveWorkspaceFilters(workspaceFilterKey(screeningProcessId, "full-text"), ws.filters);
    try {
      sessionStorage.setItem(workspaceContextKey(screeningProcessId, "full-text"), JSON.stringify({ path: listPath, page: ws.filters.pageNumber, scrollY: window.scrollY }));
    } catch { /* list navigation remains available without storage */ }
    navigate(detailPath(id), { state: { listPath, from: `${location.pathname}${location.search}` } });
  };
  const navigateAdjacent = async (direction: -1 | 1) => {
    if (!paperId || !screeningProcessId) return;
    try {
      const adjacent = await getAdjacentPaperId({
        processId: screeningProcessId,
        phase: PaperPhase.FullText,
        currentId: paperId,
        papers: ws.papers,
        pagination: ws.pagination,
        filters: ws.filters,
        direction,
      });
      if (!adjacent) return;
      saveWorkspaceFilters(workspaceFilterKey(screeningProcessId, "full-text"), { ...ws.filters, pageNumber: adjacent.pageNumber });
      ws.goToPage(adjacent.pageNumber);
      navigate(detailPath(adjacent.paperId), { state: location.state });
    } catch {
      // Keep the current paper in place if the adjacent page cannot be loaded.
    }
  };
  const persistContextPanel = (open: boolean) => {
    setContextOpen(open);
    setMobileContextOpen(open);
    try { localStorage.setItem("study-selection:context-open", String(open)); } catch { /* optional preference */ }
  };
  const toggleContextPanel = () => {
    if (window.matchMedia("(max-width: 1279px)").matches) {
      setMobileContextOpen(true);
      return;
    }
    persistContextPanel(!contextOpen);
  };
  const navigateToTitleAbstract = () => {
    if (projectId && processId && screeningProcessId) {
      navigate(`/projects/${projectId}/processes/${processId}/screening/${screeningProcessId}`);
    }
  };
  const paperPositionLabel =
    currentIndex >= 0 && ws.pagination.totalCount > 0
      ? `Paper ${(ws.filters.pageNumber - 1) * ws.pagination.pageSize + currentIndex + 1} of ${ws.pagination.totalCount}`
      : ws.selectedPaper?.title || (ws.papers.length === 0 ? "No papers" : "Paper details");

  if (ws.isLoading) return <div className="flex min-h-screen items-center justify-center"><LoadingSpinner /></div>;
  if (ws.error) return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-5xl items-center px-4 py-8 sm:px-6">
      <QueryErrorState
        title="Full-text screening unavailable"
        message={ws.error}
        onRetry={() => void ws.refetch()}
        onBack={ws.handleBack}
        backLabel="Back to review process"
      />
    </div>
  );

  if (!paperId) {
    return <StudySelectionPaperList
      projectName={project?.title}
      activeStage="full-text"
      papers={ws.papers}
      stats={ws.stats}
      pagination={ws.pagination}
      filters={ws.filters}
      isLoading={ws.isLoading}
      contextKey={workspaceContextKey(screeningProcessId, "full-text")}
      onBack={ws.handleBack}
      onOpenPaper={openPaper}
      onStageChange={(stage) => { if (stage === "title-abstract") navigateToTitleAbstract(); }}
      onSearchChange={ws.setSearch}
      onStatusChange={ws.setStatusFilter}
      onSortChange={ws.setSort}
      onFullTextChange={ws.setHasFullTextFilter}
      onConflictChange={ws.setHasConflictFilter}
      onDecidedByMeChange={ws.setDecidedByMeFilter}
      onPageChange={ws.goToPage}
    />;
  }

  const backToList = () => navigate((location.state as { listPath?: string } | null)?.listPath || listPath);

  return <div className="flex h-full min-h-0 flex-col overflow-hidden bg-bg-primary">
    <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-3 border-b border-border bg-surface-white px-3 sm:px-5">
      <button type="button" aria-label="Back to papers" onClick={backToList} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:justify-start"><FiArrowLeft /><span className="hidden sm:inline">Back to papers</span></button>
      <div className="min-w-0 text-center"><div className="text-xs text-text-secondary">Full-Text Screening</div><div className="truncate text-xs font-semibold sm:text-sm">{paperPositionLabel}</div></div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={() => void navigateAdjacent(-1)} disabled={currentIndex >= 0 ? currentIndex === 0 && !ws.pagination.hasPreviousPage : !directNeighbors || directNeighbors.paperId !== paperId || !directNeighbors.previous} aria-label="Previous paper" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40"><FiChevronLeft /></button>
        <button type="button" onClick={() => void navigateAdjacent(1)} disabled={currentIndex >= 0 ? currentIndex === ws.papers.length - 1 && !ws.pagination.hasNextPage : !directNeighbors || directNeighbors.paperId !== paperId || !directNeighbors.next} aria-label="Next paper" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40"><FiChevronRight /></button>
        <button type="button" onClick={toggleContextPanel} aria-label="Toggle review context" className="ml-1 inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-border px-2.5 text-xs text-text-secondary transition-colors hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 lg:w-auto"><FiList /><span className="hidden lg:inline">Review context</span></button>
      </div>
    </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {!ws.selectedPaper && ws.papers.length === 0 ? <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-surface-white p-8 text-center"><FiFileText className="mb-4 h-9 w-9 text-text-secondary/50"/><h2 className="text-lg font-semibold">No papers available</h2><p className="mt-2 max-w-md text-sm text-text-secondary">Included papers from Title &amp; Abstract screening will appear here.</p><Button onClick={navigateToTitleAbstract} className="mt-5">Go to Title &amp; Abstract Screening</Button></div> : <div className="flex min-h-0 flex-1">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <FullTextReader
            paper={ws.selectedPaper}
            decisionBar={ws.selectedPaper ? <DecisionBar paper={ws.selectedPaper} onInclude={ws.includePaper} onExclude={ws.excludePaper} isSubmitting={ws.isSubmitting} canReview={ws.canReview && !isCompleted} /> : undefined}
            onUploadPdf={ws.uploadFullText}
            onApplyMetadataSuggestion={ws.applyMetadataSuggestion}
            isUploading={ws.isUploadingFullText}
            isApplyingMetadataSuggestion={ws.isApplyingMetadataSuggestion}
            onRetryExtraction={ws.retryMetadataExtraction}
            isRetryingExtraction={ws.isRetryingMetadataExtraction}
          />
        </main>
        {contextOpen && <aside className="hidden w-[340px] shrink-0 border-l border-border xl:block"><FullTextRightPanel paper={ws.selectedPaper} aiAnalysis={ws.aiAnalysis} isAnalyzing={ws.isAnalyzing} runAiAnalysis={ws.runAiAnalysis} onInclude={ws.includePaper} onExclude={ws.excludePaper} isSubmitting={ws.isSubmitting} onResolveConflict={ws.resolveConflict} isResolving={ws.isResolving} isDisabled={isCompleted} showDecisionBar={false} /></aside>}
      </div>}
      {paperId && mobileContextOpen && (
        <Modal
          isOpen={mobileContextOpen}
          onClose={() => persistContextPanel(false)}
          title="Review context"
          description="Screening criteria, AI analysis, and decision context for this paper."
          mode="drawer"
          size="sm"
          className="!w-[min(92vw,380px)] !max-w-[min(92vw,380px)]"
          bodyClassName="min-h-0 flex-1 overflow-hidden p-0"
        >
          <FullTextRightPanel
            paper={ws.selectedPaper}
            aiAnalysis={ws.aiAnalysis}
            isAnalyzing={ws.isAnalyzing}
            runAiAnalysis={ws.runAiAnalysis}
            onInclude={ws.includePaper}
            onExclude={ws.excludePaper}
            isSubmitting={ws.isSubmitting}
            onResolveConflict={ws.resolveConflict}
            isResolving={ws.isResolving}
            isDisabled={isCompleted}
            showDecisionBar={false}
          />
        </Modal>
      )}
    </div>
  </div>;
}
