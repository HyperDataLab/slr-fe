import {
  FiArrowUpRight,
  FiCheckCircle,
  FiClock,
  FiFolder,
  FiLayers,
  FiPlus,
  FiPlay,
  FiXCircle,
} from "react-icons/fi";
import type { KeyboardEvent } from "react";
import type { ProcessSnapshot } from "./types";
import Button from "../ui/Button";

interface ReviewProcessPanelProps {
  processes: ProcessSnapshot[];
  selectedPaperIds: string[];
  onAddSelected: (processId: string) => void;
  onAddFromFilter: (processId: string) => void;
  onNavigate: (processId: string) => void;
  onCreateProcess?: () => void;
  isAdding?: boolean;
  isLeader?: boolean;
}

function statusPresentation(status: ProcessSnapshot["statusText"]) {
  switch (status) {
    case "Completed":
      return {
        label: "Completed",
        icon: <FiCheckCircle aria-hidden="true" />,
        badge: "bg-success/10 text-success ring-success/20",
      };
    case "InProgress":
      return {
        label: "In progress",
        icon: <FiPlay aria-hidden="true" />,
        badge: "bg-primary-light text-primary ring-primary/20",
      };
    case "Cancelled":
      return {
        label: "Cancelled",
        icon: <FiXCircle aria-hidden="true" />,
        badge: "bg-bg-secondary text-text-secondary ring-border",
      };
    default:
      return {
        label: "Draft",
        icon: <FiClock aria-hidden="true" />,
        badge: "bg-bg-secondary text-text-secondary ring-border",
      };
  }
}

function openProcessFromKeyboard(event: KeyboardEvent<HTMLElement>, onOpen: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onOpen();
  }
}

export default function ReviewProcessPanel({
  processes,
  selectedPaperIds,
  onNavigate,
  onCreateProcess,
  isLeader = false,
}: ReviewProcessPanelProps) {
  const hasSelected = selectedPaperIds.length > 0;

  return (
    <section aria-labelledby="review-process-heading" className="mb-8 mt-7">
      <header className="mb-5 flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 id="review-process-heading" className="text-lg font-semibold tracking-tight text-text-primary sm:text-xl">
            Review processes
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Manage screening workflows and open a process to continue reviewing papers.
          </p>
        </div>
        {processes.length > 0 && onCreateProcess && isLeader && (
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0 normal-case tracking-normal"
            onClick={onCreateProcess}
          >
            <FiPlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            New process
          </Button>
        )}
      </header>

      {hasSelected && isLeader && (
        <p className="mb-4 flex items-center gap-2 text-sm text-text-secondary">
          <FiLayers className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            <strong className="font-semibold tabular-nums text-text-primary">{selectedPaperIds.length}</strong>{" "}
            {selectedPaperIds.length === 1 ? "paper selected" : "papers selected"} in the repository.
          </span>
        </p>
      )}

      {processes.length === 0 ? (
        <div className="flex min-h-32 items-center gap-4 rounded-xl border border-dashed border-border bg-bg-secondary/40 px-5 py-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-primary ring-1 ring-border/70">
            <FiFolder className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">No review processes yet</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Create a process when you’re ready to start screening papers.
            </p>
            {onCreateProcess && isLeader && (
              <Button
                size="sm"
                className="mt-3 normal-case tracking-normal"
                onClick={onCreateProcess}
              >
                <FiPlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Create process
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {processes.map((process) => {
            const status = statusPresentation(process.statusText);
            const progress = Math.min(100, Math.max(0, process.progressPercent || 0));
            const open = () => onNavigate(process.processId);

            return (
              <article
                key={process.processId}
                role="link"
                tabIndex={0}
                aria-label={`Open review process: ${process.processName}`}
                onClick={open}
                onKeyDown={(event) => openProcessFromKeyboard(event, open)}
                className={`group flex cursor-pointer flex-col gap-4 rounded-xl border bg-surface-white p-5 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_8px_24px_-16px_rgba(15,23,42,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 ${
                  hasSelected && isLeader ? "border-primary/40" : "border-border"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                    <FiLayers className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
                    <h3 className="min-w-0 flex-1 basis-64 break-words text-sm font-semibold leading-5 text-text-primary">
                      {process.processName}
                    </h3>
                    <span className="text-xs text-text-secondary">Independent screening</span>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ring-1 ring-inset ${status.badge}`}>
                    {status.icon}
                    {status.label}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                  <div className="min-w-[180px] flex-1 basis-60">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-text-secondary">Progress</span>
                      <span className="font-semibold tabular-nums text-text-primary">{progress}%</span>
                    </div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-bg-secondary"
                      role="progressbar"
                      aria-label={`${process.processName} progress`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress}
                    >
                      <div className="h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <dl className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <div className="flex items-baseline gap-1.5">
                      <dt className="text-xs text-text-secondary">Papers</dt>
                      <dd className="text-sm font-semibold tabular-nums text-text-primary">{process.totalPapers ?? 0}</dd>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <dt className="text-xs text-text-secondary">Included</dt>
                      <dd className="text-sm font-semibold tabular-nums text-text-primary">{process.totalIncludedPapers ?? 0}</dd>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <dt className="text-xs text-text-secondary">Excluded</dt>
                      <dd className="text-sm font-semibold tabular-nums text-text-primary">{process.totalExcludedPapers ?? 0}</dd>
                    </div>
                  </dl>

                  <span className="ml-auto flex items-center justify-between gap-2 text-sm font-medium text-primary">
                    Open process
                    <FiArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
