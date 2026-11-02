import { FiFileText, FiLock, FiPlus } from "react-icons/fi";
import ReviewModuleRow from "./ReviewModuleRow";
import type { WorkflowPhase, ProcessPaperStats } from "./types";

interface WorkflowTimelineProps {
  phases: WorkflowPhase[];
  paperStats?: ProcessPaperStats;
  onStartPhase?: (phaseKey: string) => void;
  onCompletePhase?: (phaseKey: string) => void;
  onOpenPhase?: (phaseKey: string) => void;
  onReopenPhase?: (phaseKey: string) => void;
  onAddPapers?: () => void;
  canManageActions?: boolean;
  startLoadingMap?: Record<string, boolean>;
  completeLoadingMap?: Record<string, boolean>;
  reopenLoadingMap?: Record<string, boolean>;
  disabled?: boolean;
  isStudySelectionCompleted?: boolean;
}

export default function WorkflowTimeline({
  phases,
  paperStats,
  onStartPhase,
  onCompletePhase,
  onOpenPhase,
  onReopenPhase,
  onAddPapers,
  canManageActions = true,
  startLoadingMap = {},
  completeLoadingMap = {},
  reopenLoadingMap = {},
  disabled = false,
}: WorkflowTimelineProps) {
  const activePhases = phases
    .filter((phase) => phase.key !== "identification")
    .sort((a, b) => a.id - b.id);
  const completedCount = activePhases.filter((phase) => (phase.displayStatus ?? phase.status) === "Completed").length;
  const totalPapers = paperStats?.total ?? 0;

  return (
    <section aria-label="Review modules" className="min-w-0">
      {disabled ? (
        <div className="mb-3 flex items-center gap-2 text-sm text-text-secondary">
          <FiLock aria-hidden="true" className="h-4 w-4 shrink-0" />
          <p>This review has not started yet. Module actions will be available when it starts.</p>
        </div>
      ) : null}

      {totalPapers === 0 ? (
        <section aria-label="Review overview">
          <div className="flex flex-wrap items-center gap-3 py-2">
            <span className="inline-flex items-center gap-2 text-sm text-text-secondary">
              <FiFileText aria-hidden="true" className="h-4 w-4 text-primary" />
              <span>Papers in review</span>
              <strong className="font-semibold tabular-nums text-text-primary">0</strong>
            </span>
            <p className="min-w-[180px] flex-1 text-sm text-text-secondary">Add papers from your project pool to begin screening.</p>
            {onAddPapers && canManageActions && !disabled ? (
              <button
                type="button"
                onClick={onAddPapers}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-primary transition-colors hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 motion-reduce:transition-none"
              >
                <FiPlus aria-hidden="true" className="h-4 w-4" />
                Add papers
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="mt-3 flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-text-primary">Review modules</h3>
        <p className="shrink-0 text-sm text-text-secondary">
          <span className="font-medium tabular-nums text-text-primary">{completedCount} of {activePhases.length}</span> completed
        </p>
      </div>

      <ol className="mt-2 space-y-3" aria-label="Review modules">
        {activePhases.map((phase) => (
          <ReviewModuleRow
            key={phase.key}
            phase={phase}
            disabled={disabled}
            canManageActions={canManageActions}
            onStart={phase.status === "NotStarted" ? () => onStartPhase?.(phase.key) : undefined}
            onComplete={phase.status === "InProgress" ? () => onCompletePhase?.(phase.key) : undefined}
            onOpen={phase.status === "InProgress" || phase.status === "Completed" ? () => onOpenPhase?.(phase.key) : undefined}
            onReopen={phase.status === "Completed" ? () => onReopenPhase?.(phase.key) : undefined}
            startLoading={startLoadingMap[phase.key]}
            completeLoading={completeLoadingMap[phase.key]}
            reopenLoading={reopenLoadingMap[phase.key]}
          />
        ))}
      </ol>
    </section>
  );
}
