import type { ReactNode } from "react";
import { Download } from "lucide-react";
import Button from "../../../../components/ui/Button";

interface QAHeaderProps {
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
}

export function QAHeader({
  stats,
  phaseStatus,
  unavailable = false,
  rightControls,
  onExport,
}: QAHeaderProps) {
  const completedPercent = Math.min(100, Math.max(0, Math.round(stats.completionPercentage)));
  const normalizedStatus = phaseStatus.toLowerCase();
  const statusLabel = normalizedStatus === "inprogress" ? "Active" : phaseStatus;
  const statusStyle =
    normalizedStatus === "inprogress"
      ? "border-accent/20 bg-primary-light text-accent"
      : normalizedStatus === "completed"
        ? "border-success/20 bg-success/10 text-success"
        : "border-border bg-bg-primary text-text-secondary";

  return (
    <header className="relative z-10 shrink-0 border-b border-border bg-surface-white">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-4 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:px-8">
        <div className="flex min-w-0 items-center lg:flex-1">
          <div className="min-w-0">
            <h1 className="review-process-header-title line-clamp-2 text-lg font-semibold leading-6 tracking-tight text-text-primary sm:text-xl">
              Quality Assessment
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-text-secondary">Phase B · Conducting</span>
              <span className="hidden h-1 w-1 rounded-full bg-border sm:block" />
              <span className="text-xs text-text-secondary">
                Methodological quality and bias risk
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyle}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {statusLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-white px-3.5 py-2.5 sm:gap-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">Studies</div>
              <div className="mt-0.5 text-base font-semibold leading-5 text-text-primary">
                {unavailable ? "—" : stats.total}
              </div>
            </div>
            <div className="h-9 w-px bg-border" />
            <div className="w-28 sm:w-36">
              <div className="mb-1.5 flex items-center justify-between text-[10px] font-medium text-text-secondary">
                <span>Complete</span>
                <span className="font-semibold text-text-primary">
                  {unavailable ? "Unavailable" : `${completedPercent}%`}
                </span>
              </div>
              {!unavailable && (
                <div className="h-1.5 overflow-hidden rounded-full bg-bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none"
                    style={{ width: `${completedPercent}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {onExport && (
            <Button
              variant="outline"
              onClick={onExport}
              className="h-11 min-h-11 flex items-center gap-2 rounded-xl border-border bg-surface-white text-sm font-medium text-text-primary shadow-none transition-colors hover:bg-bg-primary hover:text-text-primary"
            >
              <Download size={16} className="text-text-secondary" />
              Export CSV
            </Button>
          )}
          {rightControls}
        </div>
      </div>
    </header>
  );
}
