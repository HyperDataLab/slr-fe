import { useParams } from "react-router";
import { useReviewProcessWorkspace } from "../../hooks/useReviewProcessWorkspace";
import ProcessHeader from "../../components/reviewProcess/ProcessHeader";
import WorkflowTimeline from "../../components/reviewProcess/workflow/WorkflowTimeline";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { useState } from "react";
import PaperPoolSelectorModal from "../../components/reviewProcess/modals/PaperPoolSelectorModal";
import StudySelectionCriteriaModal from "../../components/reviewProcess/leader/StudySelectionCriteriaModal";
import QualityAssessmentCriteriaModal from "../../components/reviewProcess/leader/QualityAssessmentCriteriaModal";
import SynthesisStrategyModal from "./synthesisExecution/components/SynthesisStrategyModal";
import { SelectionProcessStatus } from "../../types/studySelection";
import SLRPhaseWorkspace from "../../components/reviewProcess/workflow/SLRPhaseWorkspace";
import ConfirmModal from "../../components/ui/ConfirmModal";
import QueryErrorState from "../../components/ui/QueryErrorState";
import { FiArrowLeft } from "react-icons/fi";

export default function ReviewProcessWorkspace() {
  const { projectId, processId } = useParams<{
    projectId: string;
    processId: string;
  }>();

  const {
    member,
    process,
    isLoading: processLoading,
    isMemberLoading,
    error,
    workflowPhases,
    handleBack,
    handleStartProcess,
    handleCompleteProcess,
    handleOpenPhase,
    handleStartPhase,
    handleCompletePhase,
    handleReopenPhase,
    pendingConfirmation,
    closePendingConfirmation,
    confirmPendingAction,
    isConfirmingPendingAction,
    startLoading,
    completeLoading,
    phaseStartLoadingMap,
    phaseCompleteLoadingMap,
    phaseReopenLoadingMap,
    paperStats,
    isCriteriaModalOpen,
    setIsCriteriaModalOpen,
    isQualityCriteriaModalOpen,
    setIsQualityCriteriaModalOpen,
    isSynthesisStrategyModalOpen,
    setIsSynthesisStrategyModalOpen,
    completedPhases,
  } = useReviewProcessWorkspace({ projectId, processId });

  const [isAddPapersModalOpen, setIsAddPapersModalOpen] = useState(false);

  const canManagePhaseActions = member?.isLeader === true;

  const isLoading = processLoading || isMemberLoading;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  // Error state
  if (error || !process) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-5xl items-center px-4 py-8 sm:px-6">
        <QueryErrorState
          title="Review process unavailable"
          message={error || "This review process may have been removed or you may no longer have access to it."}
          onBack={handleBack}
          backLabel="Back to project"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary print:bg-surface-white">
      {/* Top Header */}
      <ProcessHeader
        process={process}
        onStartProcess={handleStartProcess}
        onCompleteProcess={handleCompleteProcess}
        startLoading={startLoading}
        completeLoading={completeLoading}
        canManageActions={canManagePhaseActions}
        isReadyToComplete={
          process.identificationProcess?.statusText === "Completed" &&
          completedPhases.length === workflowPhases.length &&
          workflowPhases.length > 0
        }
      />

      {/* Main Content */}
      <div className="w-full px-4 py-5 sm:px-5 sm:py-6 lg:px-6 print:px-4">
        <button
          type="button"
          onClick={handleBack}
          className="mb-2 inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm text-text-secondary transition-colors hover:bg-bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 motion-reduce:transition-none"
        >
          <FiArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to project
        </button>
        <SLRPhaseWorkspace projectId={projectId || ""} processId={processId || ""} process={process}>
          <WorkflowTimeline
            phases={workflowPhases}
            paperStats={paperStats}
            onStartPhase={handleStartPhase}
            onCompletePhase={handleCompletePhase}
            onOpenPhase={handleOpenPhase}
            onReopenPhase={handleReopenPhase}
            onAddPapers={() => setIsAddPapersModalOpen(true)}
            canManageActions={canManagePhaseActions}
            startLoadingMap={phaseStartLoadingMap}
            completeLoadingMap={phaseCompleteLoadingMap}
            reopenLoadingMap={phaseReopenLoadingMap}
            disabled={process.statusText === "NotStarted"}
            isStudySelectionCompleted={
              process.studySelectionProcess?.status ===
              SelectionProcessStatus.Completed
            }
          />
        </SLRPhaseWorkspace>

        {/* Paper Pool Selector Modal */}
        {projectId && processId && (
          <PaperPoolSelectorModal
            isOpen={isAddPapersModalOpen}
            onClose={() => setIsAddPapersModalOpen(false)}
            projectId={projectId}
            processId={processId}
            processName={
              process.name || process.processName || "Review Process"
            }
          />
        )}

        {/* Bottom Grid: Activity Timeline + Context Panel */}
        {/* Modals */}
        <StudySelectionCriteriaModal
          isOpen={isCriteriaModalOpen}
          onClose={() => setIsCriteriaModalOpen(false)}
          studySelectionProcessId={process.studySelectionProcess?.id || ""}
        />

        {/* Leader-only: it loads the leader's QA dashboard, which other members may not read. */}
        {canManagePhaseActions && (
          <QualityAssessmentCriteriaModal
            isOpen={isQualityCriteriaModalOpen}
            onClose={() => setIsQualityCriteriaModalOpen(false)}
            qualityAssessmentProcessId={
              process.qualityAssessmentProcess?.id || ""
            }
          />
        )}

        {projectId && process.synthesisProcess?.id ? (
          <SynthesisStrategyModal
            isOpen={isSynthesisStrategyModalOpen}
            projectId={projectId}
            synthesisProcessId={process.synthesisProcess.id}
            onClose={() => setIsSynthesisStrategyModalOpen(false)}
            startAfterSave={false}
          />
        ) : null}
        <ConfirmModal
          isOpen={Boolean(pendingConfirmation)}
          onClose={closePendingConfirmation}
          onConfirm={() => void confirmPendingAction()}
          title={pendingConfirmation?.type === "force-quality" ? "Complete Quality Assessment with unresolved papers?" : "Complete this review process?"}
          message={pendingConfirmation?.type === "force-quality"
            ? "Some included papers have no final quality verdict yet. Completing now will leave those papers unresolved."
            : "This finalizes the review process. You will not be able to continue editing its workflow afterward."}
          confirmText={pendingConfirmation?.type === "force-quality" ? "Complete anyway" : "Complete process"}
          cancelText="Cancel"
          isLoading={isConfirmingPendingAction}
          variant="warning"
        />
      </div>
    </div>
  );
}
