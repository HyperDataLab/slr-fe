import React from "react";
import { Users } from "lucide-react";
import Modal from "../../../components/ui/Modal";
import { cn } from "../../../utils/cn";
import type { AssignedReviewer } from "../../../types/studySelection";
import { getInitials } from "../../../utils/getInitials";

interface AssignedReviewersModalProps {
  isOpen: boolean;
  onClose: () => void;
  paperTitle: string;
  reviewers: AssignedReviewer[];
}

const AssignedReviewersModal: React.FC<AssignedReviewersModalProps> = ({
  isOpen,
  onClose,
  paperTitle,
  reviewers,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assigned Reviewers"
      description={paperTitle}
      size="sm"
    >
      <div className="grid grid-cols-1 gap-3">
        {reviewers && reviewers.length > 0 ? (
          reviewers.map((reviewer) => (
            <div
              key={reviewer.reviewerId}
              className="flex flex-col gap-2 rounded-xl border border-border bg-bg-secondary p-3 transition-colors hover:border-primary/20 hover:bg-surface-white motion-reduce:transition-none"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-accent font-bold text-xs uppercase">
                    {getInitials(reviewer.reviewerName)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-text-primary">
                      {reviewer.reviewerName}
                    </span>
                    <span className="text-[10px] text-text-secondary font-medium leading-none">
                      {reviewer.reviewerEmail}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {reviewer.decision ? (
                    <span
                      className={cn(
                        "px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-xl border",
                        reviewer.decision.toLowerCase().includes("include")
                          ? "border-success/20 bg-success/10 text-success"
                          : reviewer.decision.toLowerCase().includes("exclude")
                            ? "border-error/20 bg-error/10 text-error"
                            : "border-border bg-bg-secondary text-text-secondary",
                      )}
                    >
                      {reviewer.decision}
                    </span>
                  ) : (
                    <span className="text-[9px] font-black uppercase tracking-wider text-text-secondary bg-bg-secondary/50 px-2.5 py-1 rounded-xl border border-border">
                      Pending
                    </span>
                  )}
                </div>
              </div>

              {reviewer.decision?.toLowerCase().includes("exclude") &&
                (reviewer.exclusionReasonName || reviewer.exclusionNote) && (
                  <div className="mt-1 pt-2 border-t border-border/50 space-y-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-150 motion-reduce:animate-none">
                    {reviewer.exclusionReasonName && (
                      <div className="flex items-center gap-2">
                        <span className="rounded border border-error/20 bg-error/10 px-2 py-0.5 text-[10px] font-bold text-error">
                          {reviewer.exclusionReasonName}
                        </span>
                      </div>
                    )}
                    {reviewer.exclusionNote && (
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black text-text-secondary uppercase tracking-tighter">
                          Reviewer Note
                        </span>
                        <textarea
                          readOnly
                          value={reviewer.exclusionNote}
                          className="w-full text-xs text-text-secondary bg-surface-white/50 border border-border rounded-xl p-2.5 focus:outline-none resize-none min-h-[60px] italic shadow-inner"
                        />
                      </div>
                    )}
                  </div>
                )}
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-text-secondary">
            <Users className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-xs font-medium">No reviewers assigned yet</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default AssignedReviewersModal;
