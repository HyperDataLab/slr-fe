import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQualityAssessment } from "./hooks/useQualityAssessment";
import { QAHeader } from "./sections/QAHeader";
import { AssignMembersTabContent } from "./sections/AssignMembersTabContent";
import { QAPapersTabContent } from "./sections/QAPapersTabContent";
import { QAAssignModal } from "./components/QAAssignModal";
import { QAAutoResolveModal } from "./components/QAAutoResolveModal";
import { ReviewerProgressPanel } from "./components/ReviewerProgressPanel";
import { useProjectMembers } from "../../../hooks/useProjects";
import { useProjectMember } from "../../../hooks/useProjectMember";
import type {
  QAPaperResponse,
  LeaderQAPaperResponse,
  QualityAssessmentResolutionRequest,
} from "../../../types/qualityAssessment";
import { ProjectRole } from "../../../types/project";
import type { ReviewerDecisionPayload } from "./components/ReviewerQAPanel";
import { useSelector } from "react-redux";
import type { RootState } from "../../../redux/store";
import { ArrowLeft, CheckCircle2, CircleDashed, Clock3, Files } from "lucide-react";
import Button from "../../../components/ui/Button";
import ConfirmModal from "../../../components/ui/ConfirmModal";

export type WorkspaceQAPaper = QAPaperResponse | LeaderQAPaperResponse;

function WorkspaceBackButton({
  onClick,
  label = "Back to project",
  alignWithContent = false,
}: {
  onClick: () => void;
  label?: string;
  alignWithContent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 w-fit items-center gap-2 rounded-lg text-sm font-medium text-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 motion-reduce:transition-none ${alignWithContent ? "px-0 hover:text-primary" : "px-2 hover:bg-surface-white hover:text-text-primary"}`}
    >
      <ArrowLeft size={18} aria-hidden="true" />
      {label}
    </button>
  );
}

const defaultQAStats = {
  total: 0,
  completed: 0,
  inProgress: 0,
  notStarted: 0,
  pending: 0,
  completionPercentage: 0,
};

export default function QualityAssessmentWorkspace() {
  const { projectId, qualityAssessmentId, processId } = useParams<{
    projectId: string;
    qualityAssessmentId: string;
    processId: string;
  }>();
  const navigate = useNavigate();
  const currentUser = useSelector((state: RootState) => state.auth.user);

  const [viewMode, setViewMode] = useState<"list" | "edit">("list");
  const [assignPopupPaperId, setAssignPopupPaperId] = useState<string | null>(
    null,
  );
  const [isAutoResolveOpen, setIsAutoResolveOpen] = useState(false);
  const [paperToReopen, setPaperToReopen] = useState<WorkspaceQAPaper | null>(null);

  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [qaPage, setQaPage] = useState(1);

  const { member: projectMember } = useProjectMember(projectId);
  const isLeader = projectMember?.isLeader === true;

  const { members: projectMembers } = useProjectMembers(projectId);
  const members =
    projectMembers?.filter((m) => m.role === ProjectRole.Reviewer) || [];

  const {
    assignedPapers,
    allPapers,
    leaderStats,
    memberStats,
    memberProgresses,
    totalPagesList,
    totalItemsList,
    strategies,
    isAssigning,
    isSubmittingDecisions,
    isUpdatingDecisions,
    isSubmittingResolution,
    isUpdatingResolution,
    isAutoResolving,
    isReopeningPaper,
    phaseStatus,
    isError,
    error,
    refetch,
    assign,
    submitDecisions,
    updateDecisions,
    submitResolution,
    updateResolution,
    reopenPaper,
    autoResolve,
    exportCsv,
  } = useQualityAssessment(qualityAssessmentId, isLeader, {
    pageNumber: qaPage,
    pageSize: 10,
    search: searchQuery || undefined,
  });

  const canEdit = phaseStatus !== "Completed" && phaseStatus !== "Cancelled";

  const totalCriteria = useMemo(() => {
    return strategies.reduce((acc, strategy) => {
      return (
        acc +
        strategy.checklists.reduce((acc2, checklist) => {
          return acc2 + checklist.criteria.length;
        }, 0)
      );
    }, 0);
  }, [strategies]);

  const activePapers = useMemo(() => {
    const rawPapers = isLeader ? allPapers : assignedPapers;
    // Apply different ordering depending on role
    return [...rawPapers].sort((a, b) => {
      // Helper to compute group priority for a paper
      const getPriority = (paper: typeof a) => {
        const res = paper.resolution;
        const pct = paper.completionPercentage ?? 0;

        // Both leader and reviewer now return the same resolution object
        const finalDecision = res?.finalDecision == null ? null : Number(res.finalDecision);
        if (finalDecision === 1) return 4; // HighQuality
        if (finalDecision === 0) return 5; // LowQuality

        if (isLeader) {
          // Leader: completed on top, then ongoing, pending, highQuality, LowQuality
          if (pct === 100) return 0; // completed
          if (pct > 0 && pct < 100) return 1; // ongoing
          return 2; // pending (pct === 0)
        } else {
          // Reviewer: ongoing, pending, completed, highQuality, LowQuality
          if (pct > 0 && pct < 100) return 0; // ongoing
          if (pct === 0) return 1; // pending
          if (pct === 100) return 2; // completed
          return 3;
        }
      };

      const pa = getPriority(a);
      const pb = getPriority(b);

      if (pa !== pb) return pa - pb;

      // Tie-breaker within same group: prefer higher completion percentage, then title
      const pctDiff =
        (b.completionPercentage ?? 0) - (a.completionPercentage ?? 0);
      if (pctDiff !== 0) return pctDiff;
      return (a.title || "").localeCompare(b.title || "");
    });
  }, [isLeader, assignedPapers, allPapers]);

  const selectedPaper = useMemo(
    () => activePapers.find((p) => p.paperId === selectedPaperId) ?? null,
    [activePapers, selectedPaperId],
  );

  const stats = useMemo(() => {
    if (isLeader && leaderStats) {
      const completed = leaderStats.completedPapers ?? 0;
      const total = leaderStats.totalPapers ?? 0;
      return {
        ...defaultQAStats,
        total,
        completed,
        inProgress: leaderStats.inProgressPapers ?? 0,
        notStarted: leaderStats.notStartedPapers ?? 0,
        pending: total - completed,
        completionPercentage: leaderStats.completionPercentage ?? 0,
      };
    } else if (!isLeader && memberStats) {
      const completed = memberStats.completedPapers ?? 0;
      const total = memberStats.totalPapers ?? 0;
      return {
        ...defaultQAStats,
        total,
        completed,
        inProgress: memberStats.inProgressPapers ?? 0,
        notStarted: memberStats.notStartedPapers ?? 0,
        pending: total - completed,
        completionPercentage: memberStats.completionPercentage ?? 0,
      };
    }

    if (!activePapers.length) return defaultQAStats;
    const total = activePapers.length;
    const completed = activePapers.filter(
      (p) => p.completionPercentage === 100,
    ).length;
    const inProgress = activePapers.filter(
      (p) => p.completionPercentage > 0 && p.completionPercentage < 100,
    ).length;
    const notStarted = activePapers.filter(
      (p) => p.completionPercentage === 0,
    ).length;

    return {
      ...defaultQAStats,
      total,
      completed,
      inProgress,
      notStarted,
      pending: total - completed,
      completionPercentage: Math.round((completed / total) * 100) || 0,
    };
  }, [activePapers, leaderStats, memberStats, isLeader]);

  const openEditSpace = (paperId: string) => {
    setSelectedPaperId(paperId);
    setViewMode("edit");
  };

  const closeEditSpace = () => {
    setViewMode("list");
  };

  const handleAssignClick = (e: React.MouseEvent, paperId: string) => {
    e.stopPropagation();
    setAssignPopupPaperId(paperId);
  };

  const handleBack = () => {
    navigate(`/projects/${projectId}/processes/${processId}`);
  };

  const handleSaveAssignments = (selectedUserIds: string[]) => {
    if (assignPopupPaperId && qualityAssessmentId) {
      // Ensure we don't overwrite/remove previously assigned users if the backend fully replaces the array
      const allUserIdsToAssign = Array.from(
        new Set([...assignedUserIds, ...selectedUserIds]),
      );

      assign({
        qualityAssessmentProcessId: qualityAssessmentId,
        paperIds: [assignPopupPaperId],
        userIds: allUserIdsToAssign,
      });
      setAssignPopupPaperId(null);
    }
  };

  const currentAssignPaper = activePapers.find(
    (p) => p.paperId === assignPopupPaperId,
  ) as LeaderQAPaperResponse | undefined;
  const assignedUserIds = currentAssignPaper?.reviewers?.map((r) => r.id) || [];

  const handleReviewerSave = (
    notes: string | null,
    decisionitems: ReviewerDecisionPayload[],
  ) => {
    if (selectedPaperId && qualityAssessmentId) {
      const sp = selectedPaper as QAPaperResponse;
      const myDecision = sp?.decisions?.[0]; // Get current decision record

      if (myDecision?.id) {
        updateDecisions({
          id: myDecision.id,
          notes,
          decisionItems: decisionitems.map((item) => ({
            id: item.itemId || null,
            qualityCriterionId: item.criterionId,
            value: item.value,
            comment: item.comment,
            pdfHighlightCoordinates: item.pdfHighlightCoordinates,
          })),
        });
      } else {
        submitDecisions({
          paperId: selectedPaperId,
          qualityAssessmentProcessId: qualityAssessmentId,
          notes,
          decisionItems: decisionitems.map((item) => ({
            qualityCriterionId: item.criterionId,
            value: item.value,
            comment: item.comment,
            pdfHighlightCoordinates: item.pdfHighlightCoordinates,
          })),
        });
      }
    }
  };

  const handleLeaderResolve = (
    data: Omit<
      QualityAssessmentResolutionRequest,
      "qualityAssessmentProcessId" | "paperId"
    >,
    decisionData?: { notes: string | null; items: ReviewerDecisionPayload[] },
  ) => {
    if (selectedPaperId && qualityAssessmentId) {
      const sp = selectedPaper as LeaderQAPaperResponse;

      // Optionally submit or update leader's own decisions
      if (decisionData && currentUser) {
        const myDecision = sp?.decisions?.find(
          (d) => d.reviewerId === currentUser.id,
        );

        if (myDecision?.id) {
          updateDecisions({
            id: myDecision.id,
            notes: decisionData.notes,
            decisionItems: decisionData.items.map((item) => ({
              id: item.itemId || null,
              qualityCriterionId: item.criterionId,
              value: item.value,
              comment: item.comment,
              pdfHighlightCoordinates: item.pdfHighlightCoordinates,
            })),
          });
        } else {
          submitDecisions({
            paperId: selectedPaperId,
            qualityAssessmentProcessId: qualityAssessmentId,
            notes: decisionData.notes,
            decisionItems: decisionData.items.map((item) => ({
              qualityCriterionId: item.criterionId,
              value: item.value,
              comment: item.comment,
              pdfHighlightCoordinates: item.pdfHighlightCoordinates,
            })),
          });
        }
      }

      if (sp?.resolution?.id) {
        updateResolution({
          id: sp.resolution.id,
          finalDecision: data.finalDecision,
          finalScore: data.finalScore,
          resolutionNotes: data.resolutionNotes,
        });
      } else {
        submitResolution({
          qualityAssessmentProcessId: qualityAssessmentId,
          paperId: selectedPaperId,
          ...data,
        });
      }
    }
  };

  const handleAutoResolve = async (data: {
    score?: number | null;
    percentage?: number | null;
  }) => {
    if (!qualityAssessmentId) return;
    try {
      await autoResolve({
        qualityAssessmentProcessId: qualityAssessmentId,
        score: data.score,
        percentage: data.percentage,
      });
      setIsAutoResolveOpen(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleReopenPaper = (paperId: string) => {
    const paper = activePapers.find((item) => item.paperId === paperId);
    if (!paper?.resolution) return;
    setPaperToReopen(paper);
  };

  const handleConfirmReopen = async () => {
    if (!paperToReopen) return;
    try {
      await reopenPaper(paperToReopen.paperId);
      setPaperToReopen(null);
    } catch {
      // The mutation hook reports the error; keep the dialog open so the user can retry.
    }
  };

  return (
    <div className="flex h-screen flex-col bg-bg-primary relative">
      <QAHeader
        stats={stats}
        phaseStatus={isError ? "Unavailable" : phaseStatus ?? "NotStarted"}
        unavailable={isError}
        onExport={isLeader && !isError ? exportCsv : undefined}
        rightControls={
          isLeader &&
          !isError &&
          canEdit && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAutoResolveOpen(true)}
              className="h-11 min-h-11 border-accent/20 bg-primary-light px-3 text-xs font-medium text-accent hover:bg-primary-light"
            >
              Auto-Resolve
            </Button>
          )
        }
      />

      {viewMode === "list" && isError ? (
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-auto px-5 py-4 sm:px-6">
          <WorkspaceBackButton onClick={handleBack} />
          <div className="flex flex-1 items-center justify-center py-12">
            <div role="alert" className="w-full rounded-xl border border-error/25 bg-surface-white p-6 text-center">
              <h2 className="text-lg font-semibold text-text-primary">Assessment data unavailable</h2>
              <p className="mt-2 text-sm text-text-secondary">{error || "The assessment workspace could not be loaded."}</p>
              <Button type="button" variant="secondary" className="mt-5" onClick={() => void refetch()}>Try again</Button>
            </div>
          </div>
        </main>
      ) : viewMode === "list" ? (
        <main className="mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-4 overflow-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
          <WorkspaceBackButton onClick={handleBack} />
          <section className="rounded-xl border border-border bg-surface-white px-4 py-4 sm:px-5">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                {isLeader ? "Quality review · Leader workspace" : "Quality review · Reviewer workspace"}
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-text-primary sm:text-xl">
                Assessment workspace
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-5 text-text-secondary">
                {isLeader
                  ? "Assign studies, follow reviewer progress, and resolve each assessment."
                  : "Work through your assigned studies and submit each assessment."}
              </p>
            </div>
          </section>

          <section aria-label="Assessment progress" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-white px-4 py-4 sm:px-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">Total studies</p>
                <p className="mt-2 text-3xl font-semibold leading-none tracking-tight text-text-primary">{stats.total}</p>
                <p className="mt-2 text-xs text-text-secondary">In assessment scope</p>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bg-primary text-text-secondary"><Files size={18} /></span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-white px-4 py-4 sm:px-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">Completed</p>
                <p className="mt-2 text-3xl font-semibold leading-none tracking-tight text-text-primary">{stats.completed}</p>
                <p className="mt-2 text-xs text-success">{stats.total ? `${Math.round(stats.completionPercentage)}% of studies reviewed` : "No studies completed"}</p>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success"><CheckCircle2 size={18} /></span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-white px-4 py-4 sm:px-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">In progress</p>
                <p className="mt-2 text-3xl font-semibold leading-none tracking-tight text-text-primary">{stats.inProgress}</p>
                <p className="mt-2 text-xs text-text-secondary">Reviewer work underway</p>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-accent"><Clock3 size={18} /></span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-white px-4 py-4 sm:px-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">{isLeader ? "Not started" : "Pending"}</p>
                <p className="mt-2 text-3xl font-semibold leading-none tracking-tight text-text-primary">{isLeader ? stats.notStarted : stats.pending}</p>
                <p className="mt-2 text-xs text-text-secondary">{isLeader ? "Waiting for reviewer activity" : "Awaiting final submission"}</p>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning"><CircleDashed size={18} /></span>
            </div>
          </section>

          <div className={isLeader && memberProgresses.length > 0 ? "grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-6" : "block"}>
            <div className={isLeader && memberProgresses.length > 0 ? "min-w-0" : "w-full"}>
              <AssignMembersTabContent
                papers={activePapers}
                isLeader={isLeader}
                onPaperClick={openEditSpace}
                onAssignClick={handleAssignClick}
                onReopenPaper={handleReopenPaper}
                searchQuery={searchQuery}
                onSearchChange={(q) => {
                  setSearchQuery(q);
                  setQaPage(1);
                }}
                currentPage={qaPage}
                totalPages={totalPagesList ?? 1}
                totalItems={totalItemsList ?? 0}
                onPageChange={setQaPage}
              />
            </div>

            {isLeader && memberProgresses.length > 0 && (
              <div className="min-w-0 xl:sticky xl:top-5">
                <ReviewerProgressPanel reviewerProgresses={memberProgresses} />
              </div>
            )}
          </div>
        </main>
      ) : (
        <main className="flex-1 min-h-0 flex flex-col pt-0 w-full overflow-hidden bg-surface-white">
          <div className="shrink-0 px-4 py-2 sm:px-6">
            <WorkspaceBackButton onClick={closeEditSpace} label="Back to assessment" alignWithContent />
          </div>
          <QAPapersTabContent
            papers={activePapers}
            strategies={strategies}
            isLeader={isLeader}
            selectedPaper={selectedPaper}
            selectedPaperId={selectedPaperId}
            setSelectedPaperId={setSelectedPaperId}
            searchQuery={searchQuery}
            setSearchQuery={(q) => {
              setSearchQuery(q);
              setQaPage(1);
            }}
            currentPage={qaPage}
            totalPages={totalPagesList ?? 1}
            totalItems={totalItemsList ?? 0}
            onPageChange={setQaPage}
            onReviewerSave={handleReviewerSave}
            onLeaderResolve={handleLeaderResolve}
            isSaving={
              isSubmittingDecisions ||
              isUpdatingDecisions ||
              isSubmittingResolution ||
              isUpdatingResolution
            }
            canEdit={canEdit}
          />
        </main>
      )}

      {/* Assignment Popup Modal */}
      <QAAssignModal
        isOpen={!!assignPopupPaperId}
        onClose={() => setAssignPopupPaperId(null)}
        onAssign={(userIds) => handleSaveAssignments(userIds)}
        members={members}
        assignedUserIds={assignedUserIds}
        isAssigning={isAssigning}
        hasResolution={!!currentAssignPaper?.resolution}
      />
      {/* Auto Resolve Modal */}
      {isAutoResolveOpen && (
        <QAAutoResolveModal
          isOpen={isAutoResolveOpen}
          onClose={() => setIsAutoResolveOpen(false)}
          onConfirm={handleAutoResolve}
          isSubmitting={isAutoResolving}
          totalCriteria={totalCriteria}
        />
      )}
      <ConfirmModal
        isOpen={!!paperToReopen}
        onClose={() => setPaperToReopen(null)}
        onConfirm={() => void handleConfirmReopen()}
        title="Reopen assessment?"
        message={`Reopening “${paperToReopen?.title ?? "this study"}” removes its final resolution and lets reviewers edit their assessments again.`}
        confirmText="Reopen study"
        variant="warning"
        isLoading={isReopeningPaper}
      />
    </div>
  );
}
