import { useEffect, useId, useRef, useState } from "react";
import {
  FiCheckCircle,
  FiExternalLink,
  FiEye,
  FiMoreHorizontal,
  FiPlay,
  FiRotateCcw,
} from "react-icons/fi";
import ConfirmModal from "../../ui/ConfirmModal";
import type { PhaseStatusType } from "./types";

interface PhaseActionsProps {
  status: PhaseStatusType;
  phaseKey: string;
  phaseName?: string;
  onStart?: () => void;
  onComplete?: () => void;
  onOpen?: () => void;
  onReopen?: () => void;
  canManageActions?: boolean;
  startLoading?: boolean;
  completeLoading?: boolean;
  reopenLoading?: boolean;
  disabled?: boolean;
}

const actionButtonClass = "inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-primary transition-colors hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:text-text-muted motion-reduce:transition-none";

export default function PhaseActions({
  status,
  phaseKey,
  phaseName,
  onStart,
  onComplete,
  onOpen,
  onReopen,
  canManageActions = true,
  startLoading = false,
  completeLoading = false,
  reopenLoading = false,
  disabled = false,
}: PhaseActionsProps) {
  const [confirmAction, setConfirmAction] = useState<"complete" | "reopen" | null>(null);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreActionsRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!isMoreOpen) return;

    const closeOutside = (event: PointerEvent) => {
      if (moreActionsRef.current && !moreActionsRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMoreOpen(false);
        moreButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isMoreOpen]);

  if (status === "Locked") return null;

  const showMoreActions = canManageActions && !disabled && (
    (status === "InProgress" && Boolean(onComplete)) ||
    (status === "Completed" && Boolean(onReopen))
  );
  const label = phaseName ?? phaseKey;

  return (
    <div className="flex w-full items-center justify-start gap-1 sm:justify-end">
      {canManageActions && status === "NotStarted" && onStart ? (
        <button type="button" onClick={onStart} disabled={startLoading || disabled} className={actionButtonClass}>
          <FiPlay aria-hidden="true" className="h-3.5 w-3.5" />
          {startLoading ? "Starting…" : "Start module"}
        </button>
      ) : null}

      {status === "InProgress" && onOpen ? (
        <button type="button" onClick={onOpen} disabled={disabled} className={actionButtonClass}>
          <FiExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
          Continue
        </button>
      ) : null}

      {status === "Completed" && onOpen ? (
        <button type="button" onClick={onOpen} disabled={disabled} className={actionButtonClass}>
          <FiEye aria-hidden="true" className="h-3.5 w-3.5" />
          View results
        </button>
      ) : null}

      {showMoreActions ? (
        <div ref={moreActionsRef} className="relative">
          <button
            ref={moreButtonRef}
            type="button"
            aria-label={`More actions for ${label}`}
            aria-expanded={isMoreOpen}
            aria-controls={menuId}
            onClick={() => setIsMoreOpen((open) => !open)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 motion-reduce:transition-none"
          >
            <FiMoreHorizontal aria-hidden="true" className="h-4 w-4" />
          </button>
          {isMoreOpen ? (
            <div id={menuId} className="absolute right-0 top-full z-(--z-index-dropdown) mt-1 min-w-44 rounded-lg border border-border bg-surface-white py-1 shadow-[0_4px_8px_rgba(18,35,49,0.10)]">
              {status === "InProgress" && onComplete ? (
                <button
                  type="button"
                  disabled={completeLoading}
                  onClick={() => {
                    setIsMoreOpen(false);
                    setConfirmAction("complete");
                  }}
                  className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 disabled:opacity-50 motion-reduce:transition-none"
                >
                  <FiCheckCircle aria-hidden="true" className="h-4 w-4" />
                  Mark complete
                </button>
              ) : null}
              {status === "Completed" && onReopen ? (
                <button
                  type="button"
                  disabled={reopenLoading}
                  onClick={() => {
                    setIsMoreOpen(false);
                    setConfirmAction("reopen");
                  }}
                  className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 disabled:opacity-50 motion-reduce:transition-none"
                >
                  <FiRotateCcw aria-hidden="true" className="h-4 w-4" />
                  Reopen module
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <ConfirmModal
        isOpen={confirmAction === "complete"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          setConfirmAction(null);
          onComplete?.();
        }}
        title="Mark module complete?"
        message="Are you sure you want to mark this module as complete? You can reopen it later if needed."
        confirmText="Complete"
        cancelText="Cancel"
        isLoading={completeLoading}
        variant="info"
      />

      <ConfirmModal
        isOpen={confirmAction === "reopen"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          setConfirmAction(null);
          onReopen?.();
        }}
        title="Reopen module?"
        message="Are you sure you want to reopen this module? This will mark it as in progress again."
        confirmText="Reopen"
        cancelText="Cancel"
        isLoading={reopenLoading}
        variant="warning"
      />
    </div>
  );
}
