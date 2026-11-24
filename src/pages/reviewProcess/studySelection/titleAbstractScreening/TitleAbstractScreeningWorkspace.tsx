import { useLocation, useNavigate, useParams } from "react-router-dom";
import { PaperPhase } from "../../../../types/studySelection";
import { useStudySelection } from "./hooks/useStudySelection";
import PaperViewer from "../../../../components/shared/paper/PaperViewer";
import AiAnalysisPanel from "./components/AiAnalysisPanel";
import LoadingSpinner from "../../../../components/ui/LoadingSpinner";
import SelectionChecklist from "./components/SelectionChecklist";
import Tabs from "../../../../components/ui/Tabs";
import Drawer from "../../../../components/ui/Drawer";
import { FiArrowLeft, FiChevronLeft, FiChevronRight, FiCpu, FiClipboard, FiList } from "react-icons/fi";
import { useEffect, useState } from "react";
import { CriteriaTab } from "../../../manage-study-selection/components/CriteriaTab";
import { useStudySelectionDetails } from "../../../../hooks/useStudySelection";
import { useProject } from "../../../../hooks/useProjects";
import { SelectionProcessStatus } from "../../../../types/studySelection";
import StudySelectionPaperList from "../components/StudySelectionPaperList";
import { getAdjacentPaperId, getPaperQueueNeighbors } from "../navigatePaperQueue";
import { saveWorkspaceFilters, workspaceContextKey, workspaceFilterKey } from "../workspaceState";

export default function TitleAbstractScreeningWorkspace() {
  const ws = useStudySelection();
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId, processId, screeningProcessId, paperId } = useParams();
  const [activeTab, setActiveTab] = useState("ai");
  const [contextOpen, setContextOpen] = useState(() => {
    try { return localStorage.getItem("study-selection:context-open") !== "false"; } catch { return true; }
  });
  const [mobileContextOpen, setMobileContextOpen] = useState(false);
  const [directNeighbors, setDirectNeighbors] = useState<{ paperId: string; previous: boolean; next: boolean } | null>(null);

  const { data: processDetails } = useStudySelectionDetails(screeningProcessId);
  const { project } = useProject(projectId);
  const isCompleted =
    processDetails?.status === SelectionProcessStatus.Completed;
  const hasQueueContext = Boolean((location.state as { listPath?: string } | null)?.listPath);
  const currentPaperIndex = ws.papers.findIndex((paper) => paper.id === paperId);

  useEffect(() => {
    if (!paperId || hasQueueContext || currentPaperIndex >= 0 || ws.isLoading || !screeningProcessId) return;
    let active = true;
    void getPaperQueueNeighbors({ processId: screeningProcessId, phase: PaperPhase.TitleAbstract, currentId: paperId, papers: ws.papers, pagination: ws.pagination, filters: ws.filters })
      .then((neighbors) => { if (active) setDirectNeighbors({ paperId, previous: !!neighbors.previous, next: !!neighbors.next }); })
      .catch(() => { if (active) setDirectNeighbors({ paperId, previous: false, next: false }); });
    return () => { active = false; };
  }, [paperId, hasQueueContext, currentPaperIndex, ws.isLoading, screeningProcessId, ws.papers, ws.pagination, ws.filters]);

  const listPath = `/projects/${projectId}/processes/${processId}/screening/${screeningProcessId}`;
  const detailPath = (id: string) => `${listPath}/papers/${id}`;
  const stagePath = (stage: "title-abstract" | "full-text") => stage === "title-abstract"
    ? listPath
    : `/projects/${projectId}/processes/${processId}/full-text-screening/${screeningProcessId}`;
  const openPaper = (id: string) => {
    saveWorkspaceFilters(workspaceFilterKey(screeningProcessId, "title-abstract"), ws.filters);
    try {
      sessionStorage.setItem(workspaceContextKey(screeningProcessId, "title-abstract"), JSON.stringify({ path: listPath, page: ws.filters.pageNumber, scrollY: window.scrollY }));
    } catch { /* list navigation remains available without storage */ }
    navigate(detailPath(id), { state: { listPath, from: `${location.pathname}${location.search}` } });
  };
  const navigateAdjacent = async (direction: -1 | 1) => {
    if (!paperId || !screeningProcessId) return;
    try {
      const adjacent = await getAdjacentPaperId({
        processId: screeningProcessId,
        phase: PaperPhase.TitleAbstract,
        currentId: paperId,
        papers: ws.papers,
        pagination: ws.pagination,
        filters: ws.filters,
        direction,
      });
      if (!adjacent) return;
      saveWorkspaceFilters(workspaceFilterKey(screeningProcessId, "title-abstract"), { ...ws.filters, pageNumber: adjacent.pageNumber });
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

  if (ws.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (ws.error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-error text-sm">{ws.error}</p>
        <button
          onClick={ws.handleBack}
          className="text-sm text-accent hover:underline"
        >
          Back to Review Process
        </button>
      </div>
    );
  }

  return (
    !paperId ? (
      <StudySelectionPaperList
        projectName={project?.title}
        activeStage="title-abstract"
        papers={ws.papers}
        stats={ws.stats}
        pagination={ws.pagination}
        filters={ws.filters}
        isLoading={ws.isLoading}
        contextKey={workspaceContextKey(screeningProcessId, "title-abstract")}
        onBack={ws.handleBack}
        onOpenPaper={openPaper}
        onStageChange={(stage) => navigate(stagePath(stage))}
        onSearchChange={ws.setSearch}
        onStatusChange={ws.setStatusFilter}
        onSortChange={ws.setSort}
        onFullTextChange={ws.setHasFullTextFilter}
        onConflictChange={ws.setHasConflictFilter}
        onDecidedByMeChange={ws.setDecidedByMeFilter}
        onPageChange={ws.goToPage}
        onPageSizeChange={ws.setPageSize}
      />
    ) : (
      <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-bg-primary">
        <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-3 border-b border-border bg-surface-white px-3 sm:px-5">
          <button type="button" aria-label="Back to papers" onClick={() => navigate((location.state as { listPath?: string } | null)?.listPath || listPath)} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary sm:justify-start"><FiArrowLeft/> <span className="hidden sm:inline">Back to papers</span></button>
          <div className="min-w-0 text-center"><div className="text-xs text-text-secondary">Title &amp; Abstract Screening</div><div className="truncate text-xs font-semibold sm:text-sm">Paper {currentPaperIndex >= 0 ? (ws.filters.pageNumber - 1) * ws.pagination.pageSize + currentPaperIndex + 1 : "—"} of {ws.pagination.totalCount || "—"}</div></div>
          <div className="flex shrink-0 items-center gap-1"><button type="button" onClick={() => void navigateAdjacent(-1)} disabled={currentPaperIndex >= 0 ? currentPaperIndex === 0 && !ws.pagination.hasPreviousPage : !directNeighbors || directNeighbors.paperId !== paperId || !directNeighbors.previous} aria-label="Previous paper" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-bg-secondary disabled:opacity-40"><FiChevronLeft/></button><button type="button" onClick={() => void navigateAdjacent(1)} disabled={currentPaperIndex >= 0 ? currentPaperIndex === ws.papers.length - 1 && !ws.pagination.hasNextPage : !directNeighbors || directNeighbors.paperId !== paperId || !directNeighbors.next} aria-label="Next paper" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-bg-secondary disabled:opacity-40"><FiChevronRight/></button><button type="button" aria-label="Toggle review context" aria-expanded={contextOpen} onClick={toggleContextPanel} className="ml-1 inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-border px-2.5 text-xs text-text-secondary hover:bg-bg-secondary lg:w-auto"><FiList/><span className="hidden lg:inline">Review context</span></button></div>
        </header>
        <div className="min-h-0 flex-1">
          <div className="flex h-full min-h-0">
            <main className="min-w-0 flex-1"><PaperViewer
              paper={ws.selectedPaper}
              onInclude={ws.includePaper}
              onExclude={ws.excludePaper}
              onUploadPdf={ws.uploadPaperPdf}
              onApplyMetadataSuggestion={ws.applyMetadataSuggestion}
              isSubmitting={ws.isSubmitting}
              isUploadingPdf={ws.isUploadingPdf}
              isApplyingMetadataSuggestion={ws.isApplyingMetadataSuggestion}
              onRetryExtraction={ws.retryMetadataExtraction}
              isRetryingExtraction={ws.isRetryingExtraction}
              phase={PaperPhase.TitleAbstract}
              isDisabled={isCompleted}
            /></main>
            {contextOpen && <aside className="hidden w-[340px] shrink-0 border-l border-border bg-surface-white xl:block">
              <Tabs
            className="h-full flex flex-col gap-0"
            contentClassName="flex-1 overflow-hidden"
            listClassName="w-[calc(100%-1rem)] mx-2 mt-2 gap-0.5 p-1 bg-bg-secondary/80"
            itemClassName="flex-1 px-2 py-2 gap-1.5 text-[11px] justify-center"
            activeTabId={activeTab}
            onTabChange={setActiveTab}
            items={[
              { id: "criteria", label: "Criteria", icon: FiList },
              { id: "ai", label: "AI Agents", icon: FiCpu },
              { id: "checklist", label: "Checklist", icon: FiClipboard },
            ]}
          >
            {activeTab === "criteria" && (
              <div className="h-full overflow-y-auto p-4 custom-scrollbar">
                <CriteriaTab
                  projectId={projectId}
                  screeningProcessId={screeningProcessId}
                />
              </div>
            )}
            {activeTab === "ai" && (
                <AiAnalysisPanel
                paper={ws.selectedPaper}
                aiAnalysis={ws.aiAnalysis}
                isAnalyzing={ws.isAnalyzing}
                onRunAnalysis={ws.runAiAnalysis}
                isDisabled={isCompleted}
              />
            )}
            {activeTab === "checklist" && (
              <SelectionChecklist
                paper={ws.selectedPaper}
                processId={screeningProcessId!}
                onClose={() => setActiveTab("ai")}
              />
            )}
              </Tabs>
            </aside>}
          </div>
          <Drawer
            isOpen={mobileContextOpen}
            onClose={() => persistContextPanel(false)}
            title="Review context"
            description="Criteria, AI agents, and checklist"
            maxWidth="max-w-[min(92vw,380px)]"
            contentClassName="min-h-0 overflow-hidden p-0"
            className="xl:hidden"
          >
            <Tabs
              className="flex min-h-0 flex-1 flex-col gap-0"
              contentClassName="flex-1 overflow-hidden"
              listClassName="mx-2 mt-2 grid grid-cols-3 gap-1 bg-bg-secondary p-1"
              itemClassName="justify-center px-2 py-2 text-[11px]"
              activeTabId={activeTab}
              onTabChange={setActiveTab}
              items={[
                { id: "criteria", label: "Criteria", icon: FiList },
                { id: "ai", label: "AI Agents", icon: FiCpu },
                { id: "checklist", label: "Checklist", icon: FiClipboard },
              ]}
            >
              {activeTab === "criteria" && (
                <div className="h-full overflow-y-auto p-4">
                  <CriteriaTab
                    projectId={projectId}
                    screeningProcessId={screeningProcessId}
                  />
                </div>
              )}
              {activeTab === "ai" && (
                <AiAnalysisPanel
                  paper={ws.selectedPaper}
                  aiAnalysis={ws.aiAnalysis}
                  isAnalyzing={ws.isAnalyzing}
                  onRunAnalysis={ws.runAiAnalysis}
                  isDisabled={isCompleted}
                />
              )}
              {activeTab === "checklist" && (
                <SelectionChecklist
                  paper={ws.selectedPaper}
                  processId={screeningProcessId!}
                  onClose={() => setActiveTab("ai")}
                />
              )}
            </Tabs>
          </Drawer>
        </div>
      </div>
    )
  );
}
