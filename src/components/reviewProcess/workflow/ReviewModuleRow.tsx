import { FiCheck, FiClock, FiLock } from "react-icons/fi";
import PhaseActions from "./PhaseActions";
import type { PhaseDisplayStatus, WorkflowPhase } from "./types";

interface ReviewModuleRowProps {
  phase: WorkflowPhase;
  disabled?: boolean;
  canManageActions?: boolean;
  onStart?: () => void;
  onComplete?: () => void;
  onOpen?: () => void;
  onReopen?: () => void;
  startLoading?: boolean;
  completeLoading?: boolean;
  reopenLoading?: boolean;
}

const SUMMARY_METRICS: Record<string, Record<string, string>> = {
  screening: {
    "Total Papers": "papers",
    Included: "included",
    Excluded: "excluded",
  },
  extraction: {
    "Total Included": "included studies",
    Completed: "extracted",
  },
  quality: {
    "Total Included": "included studies",
    Passed: "passed",
    Failed: "failed",
  },
  synthesis: {
    Studies: "studies",
    Themes: "themes",
    Findings: "findings",
  },
};

export default function ReviewModuleRow({
  phase,
  disabled = false,
  canManageActions = true,
  onStart,
  onComplete,
  onOpen,
  onReopen,
  startLoading,
  completeLoading,
  reopenLoading,
}: ReviewModuleRowProps) {
  const displayStatus = phase.displayStatus ?? phase.status;
  const summaryMetrics = SUMMARY_METRICS[phase.key] ?? {};
  const stats = phase.stats.filter((stat) => summaryMetrics[stat.label]);
  const indicatorTone = displayStatus === "Completed"
    ? "border-success/45 bg-success/10 text-success"
    : displayStatus === "InProgress" || displayStatus === "Reopened"
      ? "border-primary/50 bg-primary-light text-primary"
      : displayStatus === "Locked"
        ? "border-border bg-bg-secondary text-text-muted"
        : "border-border bg-surface-white text-text-secondary";
  const cardTone = displayStatus === "Completed"
    ? "border-border border-l-[3px] border-l-success/60 bg-surface-white hover:border-success/35 hover:bg-bg-secondary/20"
    : displayStatus === "InProgress" || displayStatus === "Reopened"
      ? "border-primary/35 border-l-[3px] border-l-primary bg-primary-light/40 hover:border-primary/50 hover:bg-primary-light/60"
      : "border-border bg-surface-white hover:border-primary/35 hover:bg-bg-secondary/20";
  const connectorTone = displayStatus === "Completed"
    ? "after:bg-success/35"
    : displayStatus === "InProgress" || displayStatus === "Reopened"
      ? "after:bg-primary/40"
      : "after:bg-border";

  return (
    <li className={`relative grid grid-cols-[36px_minmax(0,1fr)] gap-x-3 after:absolute after:left-[17.5px] after:top-[52px] after:bottom-[-28px] after:z-0 after:w-px last:after:hidden ${connectorTone}`}>
      <div className="relative z-10 flex justify-center pt-4">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums ${indicatorTone}`}
          aria-label={`Step ${String(phase.id).padStart(2, "0")}: ${phase.name}, ${displayStatus}`}
          title={`Step ${String(phase.id).padStart(2, "0")}: ${displayStatus}`}
        >
          {displayStatus === "Completed"
            ? <FiCheck aria-hidden="true" className="h-4 w-4" />
            : String(phase.id).padStart(2, "0")}
        </span>
      </div>

      <article className={`my-1 grid min-w-0 gap-3 rounded-xl border p-4 transition-colors motion-reduce:transition-none sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${cardTone}`}>
        <div className="min-w-0">
          <h4 className="text-[15px] font-semibold leading-5 text-text-primary">{phase.name}</h4>
          <p className="mt-0.5 max-w-2xl text-[13px] leading-5 text-text-secondary">
            {phase.status === "Locked" && phase.lockReason
              ? phase.lockReason
              : moduleDescription(phase.key)}
          </p>
          <dl className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
            {stats.length > 0 ? stats.map((stat, index) => (
              <div key={`${stat.label}-${index}`} className={`inline-flex items-baseline gap-1.5 rounded-md px-2 py-1 ${metricTone(stat.label)}`}>
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <span className={`text-xs font-semibold tabular-nums ${metricValueTone(stat.label)}`}>{stat.value}</span>{" "}
                  <span className={`text-xs ${metricLabelTone(stat.label)}`}>{summaryMetrics[stat.label]}</span>
                </dd>
              </div>
            )) : <span className="text-xs text-text-secondary">No summary data yet</span>}
          </dl>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 sm:justify-end">
          <StatusIndicator status={displayStatus} />
          {displayStatus === "Cancelled" ? null : (
            <PhaseActions
              status={phase.status}
              phaseKey={phase.key}
              phaseName={phase.name}
              onStart={onStart}
              onComplete={onComplete}
              onOpen={onOpen}
              onReopen={onReopen}
              canManageActions={canManageActions}
              startLoading={startLoading}
              completeLoading={completeLoading}
              reopenLoading={reopenLoading}
              disabled={disabled}
            />
          )}
        </div>
      </article>
    </li>
  );
}

function StatusIndicator({ status }: { status: PhaseDisplayStatus }) {
  if (status === "Completed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-success sm:col-start-2 sm:row-start-1 sm:justify-self-start xl:col-start-3 xl:row-start-1">
        <FiCheck aria-hidden="true" className="h-3.5 w-3.5" />
        Completed
      </span>
    );
  }

  if (status === "InProgress" || status === "Reopened") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-primary sm:col-start-2 sm:row-start-1 sm:justify-self-start xl:col-start-3 xl:row-start-1">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
        {status === "Reopened" ? "Reopened" : "In progress"}
      </span>
    );
  }

  if (status === "Locked") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary sm:col-start-2 sm:row-start-1 sm:justify-self-start xl:col-start-3 xl:row-start-1">
        <FiLock aria-hidden="true" className="h-3.5 w-3.5" />
        Locked
      </span>
    );
  }

  if (status === "Cancelled") {
    return <span className="text-xs text-text-secondary sm:col-start-2 sm:row-start-1 xl:col-start-3 xl:row-start-1">Cancelled</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary sm:col-start-2 sm:row-start-1 sm:justify-self-start xl:col-start-3 xl:row-start-1">
      <FiClock aria-hidden="true" className="h-3.5 w-3.5" />
      Not started
    </span>
  );
}

function moduleDescription(phaseKey: string) {
  const descriptions: Record<string, string> = {
    screening: "Screen studies against your eligibility criteria.",
    extraction: "Collect structured evidence from included studies.",
    quality: "Assess study quality and risk of bias.",
    synthesis: "Bring findings together across included studies.",
  };
  return descriptions[phaseKey] ?? "Continue work in this review module.";
}

function metricTone(label: string) {
  if (label === "Included" || label === "Passed" || label === "Completed") return "bg-success/10";
  if (label === "Excluded") return "bg-error/10";
  if (label === "Failed") return "bg-error/10";
  if (label === "Themes") return "bg-violet-100";
  if (label === "Findings") return "bg-amber-100";
  return "bg-primary-light/75";
}

function metricValueTone(label: string) {
  if (label === "Included" || label === "Passed" || label === "Completed") return "text-success";
  if (label === "Excluded") return "text-error";
  if (label === "Failed") return "text-error";
  if (label === "Themes") return "text-violet-800";
  if (label === "Findings") return "text-amber-900";
  return "text-primary";
}

function metricLabelTone(label: string) {
  if (label === "Themes") return "text-violet-800";
  if (label === "Findings") return "text-amber-900";
  return "text-text-secondary";
}
