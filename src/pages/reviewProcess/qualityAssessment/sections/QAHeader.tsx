import type { ReactNode } from "react";
import { Download, Menu } from "lucide-react";
import Button from "../../../../components/ui/Button";

interface QAHeaderProps {
  onMenuClick?: () => void;
  stats: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    pending: number;
    completionPercentage: number;
  };
  phaseStatus: string;
  unavailable?: boolean;
  rightControls?: ReactNode;
  onExport?: () => void;
  compact?: boolean;
}

export function QAHeader({
  onMenuClick,
  stats,
  phaseStatus,
  unavailable = false,
  rightControls,
  onExport,
  compact = false,
}: QAHeaderProps) {
  const completedPercent = Math.round(stats.completionPercentage);
  const normalizedStatus = phaseStatus.toLowerCase();
  const statusLabel = normalizedStatus === "inprogress"
    ? "In progress"
    : normalizedStatus === "notstarted"
      ? "Not started"
      : phaseStatus;
  const statusStyle =
    normalizedStatus === "inprogress"
      ? "bg-primary-light text-primary"
      : normalizedStatus === "completed"
        ? "bg-success/10 text-success"
        : "bg-bg-secondary text-text-secondary";

  return (
    <header className="border-b border-border bg-surface-white">
      <div className={`mx-auto flex max-w-[1520px] ${compact ? "min-h-16 items-center" : "flex-col gap-3 py-3 lg:flex-row lg:justify-between lg:gap-6"} px-4 sm:px-6 lg:px-8`}>
        <div className="flex min-w-0 items-center gap-3 lg:flex-1">
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="review-process-header-title line-clamp-2 text-base font-semibold leading-5 text-text-primary sm:text-lg">
              Quality Assessment
            </h1>
            <div className={`flex flex-wrap items-center gap-2 ${compact ? "mt-0.5" : "mt-1.5"}`}>
              <span className="text-xs text-text-secondary">Phase B · Conducting the Review</span>
              <span className="h-1 w-1 rounded-full bg-text-muted" aria-hidden="true" />
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle}`}>
                {statusLabel}
              </span>
            </div>
          </div>
        </div>

        {!compact && <div className="flex flex-wrap items-center gap-3 pl-12 sm:pl-14 lg:gap-5 lg:pl-0">
          <div className="text-xs text-text-secondary">
            <div className="text-[10px] font-medium text-text-muted">Studies</div>
            <div className="mt-0.5 font-medium text-text-primary">{unavailable ? "Unavailable" : stats.total}</div>
          </div>
          <div className="hidden h-8 w-px bg-border sm:block" aria-hidden="true" />
          <div className="w-28 sm:w-36">
            <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-text-secondary">
              <span>Assessment progress</span>
              <span className="text-text-primary">{unavailable ? "—" : `${completedPercent}%`}</span>
            </div>
            {!unavailable ? (
              <div
                role="progressbar"
                aria-label="Assessment progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={completedPercent}
                className="h-1.5 overflow-hidden rounded-full bg-bg-secondary"
              >
                <div className="h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${completedPercent}%` }} />
              </div>
            ) : null}
          </div>

          {onExport && (
            <Button
              variant="outline"
              onClick={onExport}
              className="min-h-11 flex items-center gap-2 rounded-xl border-border bg-surface-white text-sm font-medium normal-case tracking-normal text-text-primary shadow-none transition-colors hover:bg-bg-secondary hover:text-text-primary"
            >
              <Download size={16} className="text-text-secondary" aria-hidden="true" />
              Export CSV
            </Button>
          )}
          {rightControls}
        </div>}
      </div>
    </header>
  );
}
