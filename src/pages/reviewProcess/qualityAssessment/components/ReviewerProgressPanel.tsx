import type { QAReviewerProgressResponse } from "../../../../types/qualityAssessment";

interface ReviewerProgressPanelProps {
  reviewerProgresses: QAReviewerProgressResponse[];
}

export function ReviewerProgressPanel({
  reviewerProgresses: memberProgresses,
}: ReviewerProgressPanelProps) {
  if (!memberProgresses || memberProgresses.length === 0) return null;

  return (
    <section
      aria-labelledby="reviewer-progress-title"
      className="shrink-0 overflow-hidden rounded-xl border border-border bg-surface-white"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-3 sm:px-5">
        <h2 id="reviewer-progress-title" className="text-sm font-semibold text-text-primary">
          Reviewer progress
        </h2>
        <p className="text-xs text-text-secondary">Assessment completion by reviewer</p>
      </header>

      <div className="divide-y divide-border">
        {memberProgresses.map((progress) => (
          <div
            key={progress.reviewerId}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 px-4 py-3 sm:px-5 md:grid-cols-[minmax(0,1fr)_minmax(150px,1.2fr)_minmax(0,1fr)_48px] md:gap-5"
          >
            <span
              className="min-w-0 truncate text-sm font-medium text-text-primary"
              title={progress.reviewerName || "Unknown Reviewer"}
            >
              {progress.reviewerName || "Unknown Reviewer"}
            </span>

            <div
              role="progressbar"
              aria-label={`${progress.reviewerName || "Reviewer"} assessment progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress.completionPercentage)}
              className="col-span-2 h-1.5 w-full overflow-hidden rounded-full bg-bg-secondary md:col-span-1 md:col-start-2 md:row-start-1"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none"
                style={{ width: `${Math.min(100, Math.max(0, progress.completionPercentage))}%` }}
              />
            </div>

            <div className="col-span-2 text-xs text-text-secondary md:col-span-1 md:col-start-3 md:row-start-1">
              <span className="font-medium tabular-nums text-success">{progress.completedPapers}</span> completed
              <span aria-hidden="true" className="mx-2 text-border">·</span>
              <span className="font-medium tabular-nums text-text-primary">
                {progress.inProgressPapers + progress.notStartedPapers}
              </span>{" "}
              remaining
            </div>

            <span className="col-start-2 row-start-1 text-sm font-semibold tabular-nums text-text-primary md:col-start-4 md:text-right">
              {progress.completionPercentage.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
