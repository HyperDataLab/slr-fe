import type { QAReviewerProgressResponse } from "../../../../types/qualityAssessment";
import Card from "../../../../components/ui/Card";
import { CheckCircle2, Clock3, Users } from "lucide-react";

interface ReviewerProgressPanelProps {
  reviewerProgresses: QAReviewerProgressResponse[];
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function ReviewerProgressPanel({
  reviewerProgresses,
}: ReviewerProgressPanelProps) {
  if (!reviewerProgresses || reviewerProgresses.length === 0) return null;

  return (
    <Card className="overflow-hidden rounded-2xl border border-border bg-surface-white p-0 shadow-[0_2px_8px_rgba(18,35,49,0.035)]">
      <div>
        <div className="border-b border-border px-4 py-5 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-light text-accent">
                <Users size={17} />
              </span>
              <div>
                <h2 className="text-base font-semibold tracking-tight text-text-primary">
                  Reviewer progress
                </h2>
                <p className="mt-0.5 text-xs text-text-secondary">
                  Individual completion rates
                </p>
              </div>
            </div>
            <span className="rounded-full bg-bg-primary px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
              {reviewerProgresses.length}
            </span>
          </div>
        </div>

        <div className="divide-y divide-border">
          {reviewerProgresses.map((progress) => {
            const name = progress.reviewerName || "Unknown reviewer";
            const completion = Math.min(
              100,
              Math.max(0, progress.completionPercentage),
            );
            const remaining =
              progress.inProgressPapers + progress.notStartedPapers;

            return (
              <div key={progress.reviewerId} className="p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/10 bg-primary-light text-xs font-semibold text-accent">
                    {getInitials(name) || "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium text-text-primary"
                      title={name}
                    >
                      {name}
                    </p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      {progress.completedPapers} of {progress.completedPapers + remaining} studies complete
                    </p>
                  </div>
                  <span className="rounded-full border border-accent/15 bg-primary-light px-2.5 py-1 text-xs font-semibold tabular-nums text-accent">
                    {completion.toFixed(0)}%
                  </span>
                </div>

                <div
                  className="mt-4 h-2 overflow-hidden rounded-full bg-bg-secondary"
                  role="progressbar"
                  aria-label={`${name} completion`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={completion}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none"
                    style={{ width: `${completion}%` }}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-success">
                    <CheckCircle2 size={14} />
                    <span className="font-medium">{progress.completedPapers} done</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-text-secondary">
                    <Clock3 size={14} />
                    <span className="font-medium">{remaining} remaining</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
