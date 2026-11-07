import {
  ArrowRight,
  CircleAlert,
  BarChart3,
  FileSearch,
  Link2,
  NotebookText,
  Tags,
} from "lucide-react";
import type { SynthesisWorkspaceDto } from "../../../types/synthesisExecution";
import StatCard from "../../../components/ui/StatCard";

interface SynthesisDashboardProps {
  workspace: SynthesisWorkspaceDto;
  finalizedFindingCount: number;
  evidenceCount: number;
  isReadOnly?: boolean;
  /** True once every RQ finding is finalized, so the project-wide A1–A10 package can be generated. */
  isSynthesisComplete?: boolean;
  onNavigateToThematic: () => void;
  onNavigateToDescriptiveCharts: () => void;
  onNavigateToRqReporting: () => void;
  onNavigateToArtifacts?: () => void;
}

function statusLabel(status: SynthesisWorkspaceDto["process"]["status"]): string {
  if (status === "InProgress") return "In progress";
  if (status === "Completed") return "Completed";
  return "Not started";
}

function statusDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function WorkspaceLink({
  title,
  description,
  metric,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  metric: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex h-full min-w-0 flex-col rounded-lg border border-border bg-surface-white p-4 text-left motion-safe:transition-[border-color,background-color,box-shadow] motion-safe:duration-150 hover:border-primary/35 hover:bg-primary-light/10 hover:shadow-sm focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 motion-reduce:transition-none sm:p-5"
    >
      <span className="flex w-full min-w-0 items-center gap-2.5">
        <span className="shrink-0 text-primary" aria-hidden="true">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-5 text-text-primary">{title}</span>
        </span>
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-text-muted motion-safe:transition-transform motion-safe:duration-150 group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none" aria-hidden="true" />
      </span>
      <span className="mt-3 block text-sm leading-5 text-text-secondary">{description}</span>
      <span className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-medium text-text-secondary">
        {metric}
      </span>
    </button>
  );
}

export default function SynthesisDashboard({
  workspace,
  finalizedFindingCount,
  evidenceCount,
  isReadOnly = false,
  isSynthesisComplete = false,
  onNavigateToThematic,
  onNavigateToDescriptiveCharts,
  onNavigateToRqReporting,
  onNavigateToArtifacts,
}: SynthesisDashboardProps) {
  const startedAt = statusDate(workspace.process.startedAt);
  const completedAt = statusDate(workspace.process.completedAt);
  const hasThemes = workspace.themes.length > 0;
  const hasFindings = workspace.findings.length > 0;
  const hasExtractedPapers = workspace.totalExtractedPapers > 0;
  const missingCompletedData = [
    !hasExtractedPapers ? "extracted papers" : null,
    hasThemes && evidenceCount === 0 ? "linked evidence" : null,
    !hasFindings ? "RQ findings" : null,
  ].filter((item): item is string => Boolean(item));
  const missingCompletedDataLabel = missingCompletedData.length < 2
    ? missingCompletedData[0] ?? ""
    : missingCompletedData.length === 2
      ? `${missingCompletedData[0]} and ${missingCompletedData[1]}`
      : `${missingCompletedData.slice(0, -1).join(", ")}, and ${missingCompletedData[missingCompletedData.length - 1]}`;

  const guidance = workspace.process.status === "Completed" && missingCompletedData.length > 0
    ? [`This synthesis is marked completed, but ${missingCompletedDataLabel} are not recorded. Verify the source data if this is unexpected.`]
    : [
        !hasThemes
          ? isReadOnly
            ? "No themes are recorded in this synthesis."
            : "No themes yet. Thematic Analysis is where evidence is organized into themes."
          : null,
        !hasFindings
          ? isReadOnly
            ? "No research question findings are recorded."
            : "No RQ findings yet. RQ Reporting becomes useful once findings are added."
          : null,
        hasThemes && hasExtractedPapers && evidenceCount === 0
          ? "Extracted papers are available, but no evidence is linked to themes yet."
          : null,
      ].filter((item): item is string => Boolean(item));

  return (
    <div className="space-y-5">
      <section aria-labelledby="synthesis-overview-heading" className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 id="synthesis-overview-heading" className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
              Synthesis overview
            </h2>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-medium ${
              workspace.process.status === "Completed"
                ? "border-success/25 bg-success/10 text-success"
                : workspace.process.status === "InProgress"
                  ? "border-primary/20 bg-primary-light/50 text-primary"
                  : "border-border bg-bg-secondary text-text-secondary"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${workspace.process.status === "Completed" ? "bg-success" : workspace.process.status === "InProgress" ? "bg-primary" : "bg-text-muted"}`} aria-hidden="true" />
              {statusLabel(workspace.process.status)}
            </span>
            {isReadOnly ? (
              <span className="text-sm font-medium text-text-secondary">Read-only</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-5 text-text-secondary">
            Review themes, evidence, and research question findings for this synthesis.
          </p>
          {startedAt || completedAt ? (
            <p className="mt-2 text-sm text-text-secondary">
              {startedAt ? `Started ${startedAt}` : null}
              {startedAt && completedAt ? <span className="mx-2" aria-hidden="true">·</span> : null}
              {completedAt ? `Completed ${completedAt}` : null}
            </p>
          ) : null}
        </div>
      </section>

      <section aria-label="Synthesis summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard compact label="Themes" value={workspace.themes.length} icon={<Tags className="h-5 w-5" />} />
        <StatCard compact label="RQ findings" value={`${finalizedFindingCount} / ${workspace.findings.length}`} icon={<NotebookText className="h-5 w-5" />} />
        <StatCard compact label="Linked evidence" value={evidenceCount} icon={<Link2 className="h-5 w-5" />} />
        <StatCard compact label="Extracted papers" value={workspace.totalExtractedPapers} icon={<BarChart3 className="h-5 w-5" />} />
      </section>

      <section aria-labelledby="synthesis-workspace-heading">
        <div className="mb-3">
          <h3 id="synthesis-workspace-heading" className="text-base font-semibold text-text-primary">Synthesis workspace</h3>
        </div>
        <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <WorkspaceLink
            title="Thematic Analysis"
            description="Organize extracted evidence into themes and review linked source data."
            metric={`${workspace.themes.length} ${workspace.themes.length === 1 ? "theme" : "themes"}`}
            icon={<Tags className="h-4 w-4" />}
            onClick={onNavigateToThematic}
          />
          <WorkspaceLink
            title="Descriptive Charts"
            description="Explore distributions and patterns across extracted study data."
            metric={`${workspace.totalExtractedPapers} ${workspace.totalExtractedPapers === 1 ? "paper" : "papers"}`}
            icon={<BarChart3 className="h-4 w-4" />}
            onClick={onNavigateToDescriptiveCharts}
          />
          <WorkspaceLink
            title="RQ Reporting"
            description="Review and report findings against the research questions."
            metric={`${finalizedFindingCount} of ${workspace.findings.length} finalized`}
            icon={<NotebookText className="h-4 w-4" />}
            onClick={onNavigateToRqReporting}
          />
          {onNavigateToArtifacts ? (
            <WorkspaceLink
              title="SLR Artifacts (A1–A10)"
              description="Generate and review the evidence package for the completed synthesis."
              metric={isSynthesisComplete ? "Ready to generate" : `${finalizedFindingCount} of ${workspace.findings.length} findings finalized`}
              icon={<FileSearch className="h-4 w-4" />}
              onClick={onNavigateToArtifacts}
            />
          ) : null}
        </div>
      </section>

      {guidance.length > 0 ? (
        <aside aria-label="Synthesis guidance" className="flex flex-col gap-2 rounded-lg border border-border bg-bg-primary p-4 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-1">
          {guidance.map((message) => (
            <p key={message} className="flex items-start gap-2 text-sm leading-5 text-text-secondary">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden="true" />
              <span>{message}</span>
            </p>
          ))}
        </aside>
      ) : null}
    </div>
  );
}
