import React from "react";
import { FiArrowUpRight } from "react-icons/fi";
import { useProjectMembers } from "../../../hooks/useProjects";
import type { Project } from "../../../types/project";
import type { ReviewProcess } from "../../../types/reviewProcess";
import BusinessJustificationSection from "./BusinessJustificationSection";
import ProjectSetupSection from "./ProjectSetupSection";
import SLRWorkflowOverview from "./SLRWorkflowOverview";

interface OverviewTabContentProps {
  project: Project;
  projectId: string;
  isLeader: boolean;
  isProjectActive: boolean;
  isProjectSetupReady: boolean;
  isProjectSetupChecking: boolean;
  reviewNeeds: any[];
  documents: any[];
  processes: ReviewProcess[];
  isProcessesLoading: boolean;
  processesError: boolean;
  onRetryProcesses: () => void;
  isUpdatingDates: boolean;
  handleSaveProjectDates: (payload: {
    id: string;
    startDate: string | null;
    endDate: string | null;
  }) => Promise<void>;
  setIsNeedModalOpen: (open: boolean) => void;
  setIsDocModalOpen: (open: boolean) => void;
  setIsMemberModalOpen: (open: boolean) => void;
  onSetupSaved?: () => void;
  onOpenWorkspace: () => void;
}

const formatDate = (date?: string | null) => {
  if (!date) return "Not set";
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "Not set";
  return parsedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const OverviewTabContent: React.FC<OverviewTabContentProps> = (props) => {
  const { data: membersPage } = useProjectMembers(props.projectId, {
    pageNumber: 1,
    pageSize: 3,
  });
  const processes = props.processes ?? [];
  const completedProcesses = processes.filter((process) =>
    process.statusText.toLowerCase().includes("complete"),
  ).length;
  const measuredProgress = processes
    .map((process) =>
      process.progressPercent ??
      (process.statusText === "Completed" ? 100 : undefined),
    )
    .filter((value): value is number => value !== undefined);
  const processProgress = measuredProgress.length
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            measuredProgress.reduce((total, value) => total + value, 0) /
              measuredProgress.length,
          ),
        ),
      )
    : null;
  const currentStage = processes.find((process) => process.currentPhaseText)
    ?.currentPhaseText;

  return (
    <div className="pb-12">
      <SLRWorkflowOverview
        projectId={props.projectId}
        protocolReady={props.isProjectSetupReady}
        isProtocolLoading={props.isProjectSetupChecking}
        processes={processes}
        isProcessesLoading={props.isProcessesLoading}
        processesError={props.processesError}
        onRetryProcesses={props.onRetryProcesses}
      />
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-10">
      <div className="min-w-0 space-y-9">
        <section id="review-protocol" aria-label="Review protocol">
          <ProjectSetupSection
            projectId={props.projectId}
            projectTitle={props.project.title}
            projectDomain={props.project.domain}
            isProjectSetupReady={props.isProjectSetupReady}
            onSetupSaved={props.onSetupSaved}
            embedded
            hideEditButton={!props.isLeader}
          />
        </section>

        <section
          aria-labelledby="review-justification-title"
          className="border-t border-border pt-7"
        >
          <div className="mb-4">
            <h2
              id="review-justification-title"
              className="text-xl font-semibold text-text-primary"
            >
              Review justification
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Record the need for this review and its supporting materials.
            </p>
          </div>
          <BusinessJustificationSection
            project={props.project}
            projectId={props.projectId}
            isLeader={props.isLeader}
            reviewNeeds={props.reviewNeeds}
            documents={props.documents}
            isUpdatingDates={props.isUpdatingDates}
            handleSaveProjectDates={props.handleSaveProjectDates}
            setIsNeedModalOpen={props.setIsNeedModalOpen}
            setIsDocModalOpen={props.setIsDocModalOpen}
          />
        </section>
      </div>

      <aside className="xl:sticky xl:top-[92px] xl:self-start">
        <section className="rounded-xl border border-border bg-surface-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-text-primary">
              Project summary
            </h2>
            <span
              className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium ${
                props.project.statusText === "Active"
                  ? "bg-success/10 text-success"
                  : props.project.statusText === "Completed"
                    ? "bg-primary-light text-primary"
                    : "bg-bg-secondary text-text-secondary"
              }`}
            >
              {props.project.statusText}
            </span>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-medium text-text-primary">
                Review progress
              </h3>
              <span className="text-xs font-medium text-text-secondary">
                {!processes.length
                  ? "Not started"
                  : processProgress === null
                    ? "In progress"
                    : `${processProgress}%`}
              </span>
            </div>
            {processProgress !== null && (
              <div
                className="h-1.5 overflow-hidden rounded-full bg-bg-secondary"
                role="progressbar"
                aria-label="Review process completion"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={processProgress}
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${processProgress}%` }}
                />
              </div>
            )}
            <ul className="mt-3 space-y-2 text-xs">
              <li className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Review protocol</span>
                <span className="font-medium text-text-primary">
                  {props.isProjectSetupReady ? "Complete" : "In progress"}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Review processes</span>
                <span className="font-medium text-text-primary">
                  {processes.length
                    ? `${completedProcesses} of ${processes.length} complete`
                    : "Not started"}
                </span>
              </li>
            </ul>
            {currentStage && (
              <p className="mt-3 rounded-md bg-bg-primary px-3 py-2 text-xs text-text-secondary">
                Current stage: {currentStage}
              </p>
            )}
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-text-primary">Team</h3>
              <span className="text-xs text-text-secondary">
                {membersPage?.totalCount ?? 0}{" "}
                {membersPage?.totalCount === 1 ? "member" : "members"}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex -space-x-2">
                {(membersPage?.items ?? []).slice(0, 3).map((member) => (
                  <span
                    key={member.userId}
                    title={member.fullName}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-primary-light text-xs font-medium text-accent"
                  >
                    {member.fullName?.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                ))}
                {(membersPage?.totalCount ?? 0) > 3 && (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-bg-secondary text-[10px] font-medium text-text-secondary">
                    +{(membersPage?.totalCount ?? 0) - 3}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">
                  {props.project.leader?.fullName || "Team lead not assigned"}
                </p>
                {props.project.leader?.email && (
                  <p className="truncate text-xs text-text-secondary">
                    {props.project.leader.email}
                  </p>
                )}
              </div>
            </div>
            {props.isLeader && (
              <button
                type="button"
                onClick={() => props.setIsMemberModalOpen(true)}
                className="mt-3 inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-medium text-primary transition-colors hover:bg-primary-light hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 motion-reduce:transition-none"
              >
                Manage team
              </button>
            )}
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs">
            <div>
              <dt className="text-text-secondary">Created</dt>
              <dd className="mt-1 font-medium text-text-primary">
                {formatDate(props.project.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-text-secondary">Updated</dt>
              <dd className="mt-1 font-medium text-text-primary">
                {formatDate(props.project.modifiedAt)}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={props.onOpenWorkspace}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-between rounded-xl bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            Open review workspace <FiArrowUpRight size={16} />
          </button>
        </section>
      </aside>
      </div>
    </div>
  );
};

export default OverviewTabContent;
