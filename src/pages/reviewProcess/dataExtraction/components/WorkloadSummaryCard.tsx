import Card from "../../../../components/ui/Card";
import { Clock3, TrendingUp } from "lucide-react";
import type { UseDataExtractionWorkspaceReturn } from "../types";

interface WorkloadSummaryCardProps {
  summary: UseDataExtractionWorkspaceReturn["workloadSummary"];
  isLoading: boolean;
  isLeader: boolean;
  currentUserId: string | null;
}

function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function getCompletionPercentage(completed: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return clampProgress((completed / total) * 100);
}

export default function WorkloadSummaryCard({
  summary,
  isLoading,
  isLeader,
  currentUserId,
}: WorkloadSummaryCardProps) {
  const reviewerWorkloads = summary?.reviewerWorkloads ?? [];
  const overallProgress = clampProgress(
    summary?.overallProgressPercentage ?? 0,
  );
  const personalWorkload =
    reviewerWorkloads.find(
      (workload) => workload.reviewerId === currentUserId,
    ) ??
    reviewerWorkloads[0] ??
    null;
  const personalProgress = getCompletionPercentage(
    personalWorkload?.completed ?? 0,
    personalWorkload?.totalAssigned ?? 0,
  );
  const progressValue = isLeader ? overallProgress : personalProgress;

  const title = isLeader
    ? "Team Workload & Progress"
    : "My Extraction Progress";
  const description = isLeader
    ? "Track global completion and review distribution across the extraction team."
    : "See how much of your assigned extraction workload is complete.";

  if (isLoading) {
    return (
      <Card className="rounded-xl border-border bg-white shadow-none">
        <div className="motion-safe:animate-pulse motion-reduce:animate-none space-y-5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="h-4 w-44 rounded-full bg-bg-secondary" />
              <div className="h-3 w-80 max-w-full rounded-full bg-bg-secondary" />
            </div>
            <div className="h-10 w-24 rounded-xl bg-bg-secondary" />
          </div>
          <div className="h-3 rounded-full bg-bg-secondary" />
          <div className="space-y-3">
            <div className="h-12 rounded-xl bg-bg-secondary" />
            <div className="h-12 rounded-xl bg-bg-secondary" />
          </div>
        </div>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card className="rounded-xl border-border bg-white shadow-none">
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
              {isLeader ? "Team Progress" : "Your Progress"}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-text-primary">
              {title}
            </h2>
            <p className="mt-2 text-sm text-text-secondary">{description}</p>
          </div>
          <div className="rounded-xl bg-bg-secondary px-4 py-2 text-sm font-medium text-text-secondary">
            No workload data available yet
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-xl border-border bg-white p-4 shadow-none sm:p-4">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text-primary">
              {title}
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-text-secondary">
              {description}
            </p>
          </div>

          <div className="shrink-0 sm:text-right">
            <p className="text-xs font-medium text-text-secondary">
              {isLeader ? "Overall Progress" : "My Progress"}
            </p>
            <p className="mt-0.5 text-xl font-semibold text-text-primary">
              {Math.round(progressValue)}%
            </p>
          </div>
        </div>

        <div className="py-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-150"
              style={{ width: `${progressValue}%` }}
            />
          </div>
        </div>

        {isLeader ? (
          <div className={reviewerWorkloads.length > 0 ? "max-h-[300px] overflow-y-auto border-y border-border" : ""}>
            <div className={reviewerWorkloads.length > 0 ? "divide-y divide-border" : ""}>
              {reviewerWorkloads.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  Reviewer workload details will appear here once assignments
                  are available.
                </p>
              ) : (
                reviewerWorkloads.map((workload) => {
                  const reviewerProgress = getCompletionPercentage(
                    workload.completed,
                    workload.totalAssigned,
                  );

                  return (
                    <div
                      key={workload.reviewerId}
                      className="flex flex-col gap-3 px-4 py-4 xl:flex-row xl:items-center xl:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-text-primary">
                            {workload.reviewerName}
                          </h3>
                          {currentUserId === workload.reviewerId ? (
                            <span className="rounded-full bg-primary-light px-2 py-0.5 text-[11px] font-semibold text-accent">
                              You
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-text-secondary">
                          {workload.completed} completed of{" "}
                          {workload.totalAssigned} assigned studies
                        </p>
                      </div>

                      <div className="flex min-w-0 flex-1 items-center gap-3 xl:justify-end">
                        <div className="w-full max-w-[180px] space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-text-secondary">
                            <span>Completion</span>
                            <span>{Math.round(reviewerProgress)}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-bg-secondary">
                            <div
                              className="h-full rounded-full bg-primary transition-[width] duration-150"
                              style={{ width: `${reviewerProgress}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-text-secondary">
                          <span className="text-success">
                            Completed {workload.completed}
                          </span>
                          <span className="text-warning">
                            In Progress {workload.inProgress}
                          </span>
                          <span>
                            Not Started {workload.notStarted}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
            <div className="border-y border-border py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <TrendingUp className="h-4 w-4 text-accent" />
                Your completion rate
              </div>
              <div className="mt-3 flex items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-bold text-text-primary">
                    {Math.round(
                      getCompletionPercentage(
                        personalWorkload?.completed ?? 0,
                        personalWorkload?.totalAssigned ?? 0,
                      ),
                    )}
                    %
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {personalWorkload
                      ? `You have completed ${personalWorkload.completed} out of ${personalWorkload.totalAssigned} assigned studies.`
                      : "No assigned studies are available in the workload summary yet."}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-y border-border py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <Clock3 className="h-4 w-4 text-warning" />
                Queue breakdown
              </div>
              <div className="mt-3 space-y-2 text-sm text-text-secondary">
                <p>In Progress: {personalWorkload?.inProgress ?? 0}</p>
                <p>Not Started: {personalWorkload?.notStarted ?? 0}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
