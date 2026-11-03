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
import { cn } from "../../../utils/cn";
import Button from "../../../components/ui/Button";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import { useContext } from "react";
import { ClientWorkspaceSidebarContext } from "../../../contexts/ClientWorkspaceSidebarContext";
import { ArrowLeft } from "lucide-react";

export type WorkspaceQAPaper = QAPaperResponse | LeaderQAPaperResponse;

const defaultQAStats = {
  total: 0,
  completed: 0,
  inProgress: 0,
  notStarted: 0,
  pending: 0,
  completionPercentage: 0,
};

function QAMetricCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: "neutral" | "blue" | "success" | "warning";
}) {
  const styles = {
    neutral: { dot: "bg-text-secondary", value: "text-text-primary" },
    blue: { dot: "bg-primary", value: "text-primary" },
    success: { dot: "bg-success", value: "text-success" },
    warning: { dot: "bg-warning", value: "text-warning" },
  }[tone];

  return (
    <div className="rounded-xl border border-border bg-surface-white px-4 py-3.5">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
        <p className="text-[13px] font-medium text-text-secondary">{title}</p>
      </div>
      <p className={cn("mt-3 text-[26px] font-semibold leading-none tracking-tight tabular-nums", styles.value)}>{value}</p>
    </div>
  );
}

export default function QualityAssessmentWorkspace() {
  const onOpenWorkspaceSidebar = useContext(ClientWorkspaceSidebarContext);
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

  const handleLeaderSaveDraft = (
    notes: string | null,
    decisionitems: ReviewerDecisionPayload[],
  ) => {
    if (!selectedPaperId || !qualityAssessmentId || !isLeader) return;
    const paper = selectedPaper as LeaderQAPaperResponse | null;
    const myDecision = paper?.decisions?.find((decision) => decision.reviewerId === currentUser?.id);
    const decisionItems = decisionitems.map((item) => ({
      id: item.itemId || null,
      qualityCriterionId: item.criterionId,
      value: item.value,
      comment: item.comment,
      pdfHighlightCoordinates: item.pdfHighlightCoordinates,
    }));

    if (myDecision?.id) {
      updateDecisions({ id: myDecision.id, notes, decisionItems });
    } else {
      submitDecisions({
        paperId: selectedPaperId,
        qualityAssessmentProcessId: qualityAssessmentId,
        notes,
        decisionItems: decisionItems.map(({ qualityCriterionId, value, comment, pdfHighlightCoordinates }) => ({
          qualityCriterionId,
          value,
          comment,
          pdfHighlightCoordinates,
        })),
      });
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
    <div className="relative flex h-dvh min-h-0 flex-col overflow-hidden bg-bg-primary">
      {viewMode === "list" && (
        <QAHeader
          onMenuClick={onOpenWorkspaceSidebar}
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
                className="min-h-11 normal-case tracking-normal"
              >
                Auto-Resolve
              </Button>
            )
          }
        />
      )}

      {viewMode === "list" && <nav className="mx-auto w-full max-w-[1520px] px-4 pt-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex min-h-9 items-center gap-2 text-sm text-text-secondary transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          Back to project
        </button>
      </nav>}

      {viewMode === "list" && isError ? (
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-5 py-12 sm:px-6">
          <div role="alert" className="w-full rounded-xl border border-error/25 bg-surface-white p-6 text-center">
            <h2 className="text-lg font-semibold text-text-primary">Assessment data unavailable</h2>
            <p className="mt-2 text-sm text-text-secondary">{error || "The assessment workspace could not be loaded."}</p>
            <Button type="button" variant="secondary" className="mt-5" onClick={() => void refetch()}>Try again</Button>
          </div>
        </main>
      ) : viewMode === "list" ? (
        <main className="mx-auto flex w-full max-w-[1520px] flex-1 flex-col gap-4 overflow-auto px-4 py-5 sm:px-6 lg:gap-5 lg:px-8">
          <section aria-label="Assessment progress" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <QAMetricCard title="Total studies" value={stats.total} tone="neutral" />
            <QAMetricCard title="Completed" value={stats.completed} tone="success" />
            <QAMetricCard title="In progress" value={stats.inProgress} tone="blue" />
            <QAMetricCard title={isLeader ? "Not started" : "Pending"} value={isLeader ? stats.notStarted : stats.pending} tone="warning" />
          </section>

          {isLeader && memberProgresses.length > 0 && (
            <ReviewerProgressPanel reviewerProgresses={memberProgresses} />
          )}

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
        </main>
      ) : (
        <main className="flex-1 min-h-0 flex flex-col pt-0 w-full overflow-hidden bg-surface-white">
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
            onLeaderSaveDraft={handleLeaderSaveDraft}
            onBack={closeEditSpace}
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
