import React from "react";
import { getInitials } from "../../../utils/getInitials";

interface ReviewerDecision {
  id: string;
  reviewerId: string;
  reviewerName: string;
  decision: "Include" | "Exclude";
  exclusionReason?: string;
}

interface ReviewerDecisionCardProps {
  decision: ReviewerDecision;
  onViewSubmission?: (reviewerId: string) => void;
}

const ReviewerDecisionCard: React.FC<ReviewerDecisionCardProps> = ({
  decision,
  onViewSubmission,
}) => {
  return (
    <div
      className={`bg-surface-white p-5 rounded-xl border transition-colors motion-reduce:transition-none ${
        decision.decision === "Include"
          ? "border-success/20"
          : "border-error/20"
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
              decision.decision === "Include"
                ? "bg-success/10 text-success"
                : "bg-error/10 text-error"
            }`}
          >
            {getInitials(decision.reviewerName)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-black text-text-primary uppercase tracking-tight">
                {decision.reviewerName}
              </p>
              {onViewSubmission && (
                <button
                  onClick={() => onViewSubmission(decision.reviewerId)}
                  className="min-h-11 rounded px-2 text-[10px] font-black text-accent uppercase tracking-widest hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none"
                >
                  [ View submission ]
                </button>
              )}
            </div>
            <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">
              Reviewer
            </p>
          </div>
        </div>
        <span
          className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
            decision.decision === "Include"
              ? "bg-success/10 text-success border-success/20"
              : "bg-error/10 text-error border-error/20"
          }`}
        >
          {decision.decision}
        </span>
      </div>

      {decision.exclusionReason && (
        <div className="mb-4 rounded-xl border border-error/15 bg-error/5 p-3">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-tight text-error">
            Exclusion Reason
          </span>
          <p className="text-xs font-bold uppercase tracking-tight text-error">
            {decision.exclusionReason}
          </p>
        </div>
      )}
    </div>
  );
};

export default ReviewerDecisionCard;
