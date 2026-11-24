import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useStudySelection } from "./titleAbstractScreening/hooks/useStudySelection";
import StudySelectionPaperList from "./components/StudySelectionPaperList";
import { PaperPhase } from "../../../types/studySelection";
import { useProject } from "../../../hooks/useProjects";
import { useStudySelectionDetails } from "../../../hooks/useStudySelection";
import { SelectionProcessStatus } from "../../../types/studySelection";
import { saveWorkspaceFilters, workspaceContextKey, workspaceFilterKey } from "./workspaceState";

export default function LeaderStudySelectionListPage() {
  const { projectId, processId, screeningProcessId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const ws = useStudySelection(PaperPhase.TitleAbstract);
  const { project } = useProject(projectId);
  const { data: processDetails } = useStudySelectionDetails(screeningProcessId);
  const isCompleted = processDetails?.status === SelectionProcessStatus.Completed;
  const listPath = `/projects/${projectId}/processes/${processId}/screening/${screeningProcessId}`;

  const openPaper = (paperId: string) => {
    saveWorkspaceFilters(workspaceFilterKey(screeningProcessId, "title-abstract"), ws.filters);
    try {
      sessionStorage.setItem(workspaceContextKey(screeningProcessId, "title-abstract"), JSON.stringify({ path: listPath, scrollY: window.scrollY }));
    } catch { /* state preservation is best effort */ }
    navigate(`${listPath}/papers/${paperId}`, { state: { listPath, from: `${location.pathname}${location.search}` } });
  };

  return <StudySelectionPaperList
    projectName={project?.title}
    activeStage="title-abstract"
    papers={ws.papers}
    stats={ws.stats}
    pagination={ws.pagination}
    filters={ws.filters}
    isLoading={ws.isLoading}
    papersError={ws.papersError}
    statsError={ws.statsError}
    onRetry={() => void ws.refetch()}
    contextKey={workspaceContextKey(screeningProcessId, "title-abstract")}
    onBack={ws.handleBack}
    onOpenPaper={openPaper}
    onStageChange={(stage) => {
      if (stage === "full-text" && projectId && processId && screeningProcessId) {
        navigate(`/projects/${projectId}/processes/${processId}/full-text-screening/${screeningProcessId}`);
      }
    }}
    headerActionLabel={isCompleted ? "View assignments" : "Manage assignments"}
    onHeaderAction={() => navigate(`${listPath}/assignment-management`)}
    onSearchChange={ws.setSearch}
    onStatusChange={ws.setStatusFilter}
    onSortChange={ws.setSort}
    onFullTextChange={ws.setHasFullTextFilter}
    onConflictChange={ws.setHasConflictFilter}
    onDecidedByMeChange={ws.setDecidedByMeFilter}
    onPageChange={ws.goToPage}
    onPageSizeChange={ws.setPageSize}
  />;
}
