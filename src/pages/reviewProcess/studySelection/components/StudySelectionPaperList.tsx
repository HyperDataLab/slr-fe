import { useEffect } from "react";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiChevronLeft,
  FiChevronRight,
  FiExternalLink,
  FiFileText,
  FiSearch,
} from "react-icons/fi";
import type { PaperSortBy } from "../../../../types/studySelection";
import type { ScreeningStats, StatusFilter } from "../titleAbstractScreening/types";
import { SORT_OPTIONS, STATUS_FILTER_OPTIONS, STATUS_CONFIG } from "../titleAbstractScreening/constants";
import { cn } from "../../../../utils/cn";
import Select from "../../../../components/ui/Select";
import Button from "../../../../components/ui/Button";

export interface StudySelectionListPaper {
  id: string;
  title: string;
  abstract?: string | null;
  authors: string | null;
  publicationYear: number | null;
  journal?: string | null;
  source?: string | null;
  doi: string | null;
  screeningStatus: string;
  decisions: Array<{ reviewerId: string; reviewerName: string; decision: string; phase?: number }>;
  assignedReviewers?: Array<{ reviewerId?: string; reviewerName?: string }>;
  aiReviewSubmitted?: boolean;
  pdfUrl?: string | null;
  hasConflict?: boolean;
}

interface Props {
  projectName?: string;
  activeStage: "title-abstract" | "full-text";
  papers: StudySelectionListPaper[];
  stats: ScreeningStats;
  pagination: {
    pageNumber: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  filters: { search: string; status: StatusFilter; sortBy: PaperSortBy; hasFullText?: boolean; hasConflict?: boolean; decidedByMe?: boolean };
  isLoading?: boolean;
  papersError?: string | null;
  statsError?: string | null;
  onRetry?: () => void;
  contextKey?: string;
  onBack: () => void;
  onOpenPaper: (paperId: string) => void;
  onStageChange: (stage: "title-abstract" | "full-text") => void;
  headerActionLabel?: string;
  onHeaderAction?: () => void;
  onSearchChange: (search: string) => void;
  onStatusChange: (status: StatusFilter) => void;
  onSortChange: (sort: PaperSortBy) => void;
  onFullTextChange?: (value: boolean) => void;
  onConflictChange?: (value: boolean) => void;
  onDecidedByMeChange?: (value: boolean) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-bg-secondary text-text-secondary",
  "in-progress": "bg-primary-light text-primary-hover",
  included: "bg-success/10 text-success",
  excluded: "bg-error/10 text-error",
  conflicted: "bg-warning/10 text-warning",
};

export default function StudySelectionPaperList(props: Props) {
  const {
    projectName, activeStage, papers, stats, pagination, filters,
    isLoading, papersError, statsError, onRetry, contextKey, onBack, onOpenPaper, onStageChange, onSearchChange, onStatusChange,
    onSortChange, onFullTextChange, onConflictChange, onDecidedByMeChange, onPageChange, onPageSizeChange,
  } = props;
  useEffect(() => {
    if (!contextKey) return;
    try {
      const saved = sessionStorage.getItem(contextKey);
      const scrollY = saved ? JSON.parse(saved).scrollY : undefined;
      if (typeof scrollY === "number") requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: "instant" }));
    } catch { /* browser restoration is best effort */ }
  }, [contextKey]);
  const clearFilters = () => {
    onSearchChange("");
    onStatusChange("all");
    onFullTextChange?.(false);
    onConflictChange?.(false);
    onDecidedByMeChange?.(false);
  };

  const includedLabel = activeStage === "title-abstract" ? "Passed to Full Text" : "Included";
  const metrics = [
    { label: "Total papers", value: statsError ? "—" : stats.total, tone: "text-text-primary", dot: "bg-text-secondary" },
    { label: "Pending", value: statsError ? "—" : stats.pending, tone: "text-text-secondary", dot: "bg-text-secondary" },
    { label: includedLabel, value: statsError ? "—" : stats.included, tone: "text-success", dot: "bg-success" },
    { label: "Excluded", value: statsError ? "—" : stats.excluded, tone: "text-error", dot: "bg-error" },
    { label: "Conflicts", value: statsError ? "—" : stats.conflicted, tone: "text-warning", dot: "bg-warning" },
    { label: "Complete", value: statsError ? "—" : `${Math.round(stats.completionPercentage)}%`, tone: "text-primary-hover", dot: "bg-primary" },
  ];

  return (
    <main className="h-full min-h-0 overflow-y-auto bg-bg-primary text-text-primary">
      <header className="sticky top-0 z-20 bg-surface-white">
        <div className="mx-auto max-w-[1600px] px-6 pt-3 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="flex w-full min-w-0 items-center gap-3 sm:flex-1">
              <button type="button" onClick={onBack} aria-label="Back to project workspace" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:bg-bg-primary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"><FiArrowLeft aria-hidden="true" /></button>
              <div className="min-w-0 flex-1">
                <nav className="mb-1 flex min-w-0 items-center gap-1 text-[13px] leading-5" aria-label="Breadcrumb">
                  <button type="button" onClick={onBack} className="shrink-0 text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:underline">Project workspace</button>
                  {projectName?.trim() && <><FiChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-text-secondary" /><span title={projectName} className="max-w-[min(65vw,48rem)] truncate text-text-secondary">{projectName}</span></>}
                </nav>
                <h1 className="text-2xl font-semibold leading-8 tracking-tight text-text-primary">Study Selection</h1>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center justify-end gap-x-4 gap-y-2 pb-0.5 sm:w-auto">
              <button aria-pressed={filters.status === "included"} onClick={() => onStatusChange(filters.status === "included" ? "all" : "included")} className={cn("min-h-9 whitespace-nowrap rounded-md px-1 text-[13px] font-medium text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2", filters.status === "included" && "text-success hover:text-success")}>{activeStage === "title-abstract" ? "Review passed papers" : "Review included"}</button>
              {props.headerActionLabel && props.onHeaderAction && <button onClick={props.onHeaderAction} className="min-h-9 whitespace-nowrap rounded-md bg-primary px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2">{props.headerActionLabel}</button>}
            </div>
          </div>
          <nav className="mt-3 flex items-center gap-6 border-b border-border" aria-label="Screening phase">
            <button type="button" onClick={() => onStageChange("title-abstract")} aria-current={activeStage === "title-abstract" ? "step" : undefined} className={cn("min-h-10 border-b-2 px-0.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30", activeStage === "title-abstract" ? "border-primary text-primary-hover" : "border-transparent text-text-secondary hover:text-text-primary")}>Title &amp; Abstract</button>
            <button type="button" onClick={() => onStageChange("full-text")} aria-current={activeStage === "full-text" ? "step" : undefined} className={cn("min-h-10 border-b-2 px-0.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30", activeStage === "full-text" ? "border-primary text-primary-hover" : "border-transparent text-text-secondary hover:text-text-primary")}>Full Text</button>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-6 pb-8 pt-5 lg:px-10">

        <section className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6" aria-label="Screening statistics">
          {metrics.map((metric) => <div key={metric.label} className="rounded-xl border border-border bg-surface-white px-4 py-3.5"><div className="flex items-center gap-2"><span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", metric.dot)} /><span className="text-[13px] font-medium text-text-secondary">{metric.label}</span></div><div className={cn("mt-3 text-[26px] font-semibold leading-none tracking-tight tabular-nums", metric.tone)}>{metric.value}</div></div>)}
        </section>

        {(papersError || statsError) && (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error/25 bg-error/5 px-4 py-3 text-sm text-error">
            <span>{papersError && statsError ? "Screening data could not be loaded." : papersError ? "Screening papers could not be loaded." : "Screening statistics could not be loaded."}</span>
            {onRetry ? <Button type="button" variant="secondary" size="sm" onClick={onRetry}>Try again</Button> : null}
          </div>
        )}

        <section className="overflow-hidden rounded-xl border border-border bg-surface-white">
          <div className="flex flex-wrap items-center justify-start gap-x-2.5 gap-y-3 border-b border-border bg-surface-white p-4">
            <label className="relative min-w-[220px] max-w-[560px] flex-[1_1_420px]">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input value={filters.search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search title, author, or keyword" className="h-12 w-full rounded-xl border border-border bg-surface-white pl-10 pr-4 text-sm outline-none motion-safe:transition-[color,border-color,box-shadow] focus:border-accent focus:ring-2 focus:ring-accent/15 focus-visible:ring-2 focus-visible:ring-primary/25 motion-reduce:transition-none" />
            </label>
            <div className="min-w-[178px] flex-1">
              <Select aria-label="Filter by review status" value={filters.status} onChange={(event) => onStatusChange(event.target.value as StatusFilter)} options={STATUS_FILTER_OPTIONS} containerClassName="block w-full" className="h-12 w-full rounded-xl px-4" />
            </div>
            <div className="min-w-[202px] flex-1">
              <Select aria-label="Sort papers" value={String(filters.sortBy)} onChange={(event) => onSortChange(Number(event.target.value) as PaperSortBy)} options={SORT_OPTIONS.map((option) => ({ label: option.label, value: String(option.value) }))} containerClassName="block w-full" className="h-12 w-full rounded-xl px-4" />
            </div>
            {onFullTextChange && <button aria-pressed={Boolean(filters.hasFullText)} onClick={() => onFullTextChange(!filters.hasFullText)} className={cn("min-h-11 whitespace-nowrap rounded-xl border px-4 text-sm font-medium motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 motion-reduce:transition-none", filters.hasFullText ? "border-primary/40 bg-primary-light text-primary-hover" : "border-border bg-surface-white text-text-secondary hover:border-primary/30 hover:bg-bg-primary")}>Has full text</button>}
            {onConflictChange && <button aria-pressed={Boolean(filters.hasConflict)} onClick={() => onConflictChange(!filters.hasConflict)} className={cn("min-h-11 whitespace-nowrap rounded-xl border px-4 text-sm font-medium motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 motion-reduce:transition-none", filters.hasConflict ? "border-warning/30 bg-warning/10 text-warning" : "border-border bg-surface-white text-text-secondary hover:border-warning/30 hover:bg-bg-primary")}>Conflicts</button>}
            {onDecidedByMeChange && <button aria-pressed={Boolean(filters.decidedByMe)} onClick={() => onDecidedByMeChange(!filters.decidedByMe)} className={cn("min-h-11 whitespace-nowrap rounded-xl border px-4 text-sm font-medium motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 motion-reduce:transition-none", filters.decidedByMe ? "border-success/30 bg-success/10 text-success" : "border-border bg-surface-white text-text-secondary hover:border-success/30 hover:bg-bg-primary")}>Decided by me</button>}
            {(filters.search || filters.status !== "all" || filters.hasFullText || filters.hasConflict || filters.decidedByMe) && <button onClick={clearFilters} className="min-h-11 whitespace-nowrap rounded-xl px-3 text-sm font-medium text-primary motion-safe:transition-colors hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 motion-reduce:transition-none">Clear filters</button>}
          </div>

          <div className="space-y-3 p-3 lg:hidden">
            {isLoading && papers.length === 0 ? (
              <div className="py-10 text-center text-sm text-text-secondary">Loading papers…</div>
            ) : papersError ? (
              <div role="alert" className="py-10 text-center text-sm text-text-secondary">Paper results unavailable.</div>
            ) : papers.length === 0 ? (
              <div className="py-10 text-center">
                <FiFileText className="mx-auto mb-3 h-7 w-7 text-text-secondary/50" />
                <p className="text-sm font-medium">No papers found</p>
                <p className="mt-1 text-xs text-text-secondary">Try changing the search or filters.</p>
              </div>
            ) : papers.map((paper) => {
              const assignedReviewers = (paper.assignedReviewers ?? []).slice(0, 2);
              const assignedReviewerIds = new Set(assignedReviewers.map((reviewer) => String(reviewer.reviewerId ?? "")));
              const phase = activeStage === "full-text" ? 1 : 0;
              const phaseDecisions = paper.decisions?.filter((decision) =>
                decision.phase === phase &&
                (!assignedReviewerIds.size || assignedReviewerIds.has(String(decision.reviewerId))),
              ) ?? [];
              const humanDecisionCount = Math.min(2, new Set(phaseDecisions.map((decision) => decision.reviewerId)).size);
              const hasHumanReviewActivity = assignedReviewers.length > 0 || humanDecisionCount > 0;
              const displayState = paper.screeningStatus === "pending" && hasHumanReviewActivity ? "in-progress" : paper.screeningStatus;
              const statusLabel = displayState === "in-progress"
                ? "In progress"
                : paper.screeningStatus === "included" && activeStage === "title-abstract"
                  ? "Passed to Full Text"
                  : STATUS_CONFIG[paper.screeningStatus as keyof typeof STATUS_CONFIG]?.label ?? paper.screeningStatus;
              const reviewerNames = assignedReviewers.map((reviewer) => reviewer.reviewerName).filter(Boolean);

              return (
                <article key={paper.id} className="rounded-xl border border-border bg-surface-white p-3">
                  <button type="button" onClick={() => onOpenPaper(paper.id)} className="block w-full min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    <span className="line-clamp-2 block text-sm font-semibold text-text-primary">{paper.title || "Untitled paper"}</span>
                    <span className="mt-1 block truncate text-xs text-text-secondary">{paper.authors || "Authors unavailable"}{paper.journal || paper.source ? ` · ${paper.journal || paper.source}` : ""}</span>
                  </button>
                  {!paper.abstract?.trim() && <span className="mt-2 inline-flex rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">Missing abstract</span>}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                    <span>{paper.publicationYear ?? "Year unavailable"}</span>
                    <span className={cn("inline-flex max-w-full items-center whitespace-nowrap rounded-full px-2 py-1 font-medium", STATUS_STYLES[displayState] ?? STATUS_STYLES[paper.screeningStatus] ?? "border border-border bg-bg-secondary text-text-secondary")}>{statusLabel}</span>
                    <span className="truncate">{reviewerNames.length ? reviewerNames.join(", ") : "Unassigned"}</span>
                    <span className="ml-auto whitespace-nowrap tabular-nums">{humanDecisionCount}/2 reviews</span>
                  </div>
                  <div className="mt-3 flex justify-end border-t border-border pt-3">
                    <Button type="button" size="sm" className="min-h-11" onClick={() => onOpenPaper(paper.id)}>Open review</Button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden w-full min-w-0 max-w-full overflow-x-auto lg:block">
            <table className="w-full min-w-0 max-w-full table-fixed border-collapse text-left">
              <colgroup><col className="w-[28%]"/><col className="w-[6%]"/><col className="w-[9%]"/><col className="w-[12%]"/><col className="w-[12%]"/><col className="w-[11%]"/><col className="w-[13%]"/><col className="w-[9%]"/></colgroup>
              <thead className="bg-bg-primary text-[11px] uppercase tracking-wide text-text-secondary"><tr><th className="px-2 py-3 font-semibold lg:px-3">Paper</th><th className="px-1 py-3 font-semibold lg:px-2">Year</th><th className="px-1 py-3 font-semibold lg:px-2">Source</th><th className="px-1 py-3 font-semibold lg:px-2">DOI</th><th className="px-1 py-3 font-semibold lg:px-2">Review status</th><th className="px-1 py-3 font-semibold lg:px-2">Assignment</th><th className="whitespace-nowrap px-1 py-3 font-semibold lg:px-2">Review progress</th><th className="whitespace-nowrap px-1 py-3 font-semibold lg:px-2">Action</th></tr></thead>
              <tbody className="divide-y divide-border">
                {isLoading && papers.length === 0 ? <tr><td colSpan={8} className="px-4 py-16 text-center text-sm text-text-secondary">Loading papers…</td></tr> : papersError ? <tr><td colSpan={8} className="px-4 py-16 text-center text-sm text-text-secondary">Paper results unavailable.</td></tr> : papers.length === 0 ? <tr><td colSpan={8} className="px-4 py-16 text-center"><FiFileText className="mx-auto mb-3 h-7 w-7 text-text-secondary/50"/><p className="text-sm font-medium">No papers found</p><p className="mt-1 text-xs text-text-secondary">Try changing the search or filters.</p></td></tr> : papers.map((paper) => {
                  const state = paper.screeningStatus;
                  const assignedReviewers = (paper.assignedReviewers ?? []).slice(0, 2);
                  const assignedCount = assignedReviewers.length;
                  const assignedNames = assignedReviewers.map((reviewer) => reviewer.reviewerName).filter(Boolean);
                  const assignmentLabel = [...new Set(assignedNames)].join(", ");
                  const phase = activeStage === "full-text" ? 1 : 0;
                  const assignedReviewerIds = new Set(assignedReviewers.map((reviewer) => String(reviewer.reviewerId ?? "")));
                  const phaseDecisions = paper.decisions?.filter((decision) =>
                    decision.phase === phase &&
                    (!assignedReviewerIds.size || assignedReviewerIds.has(String(decision.reviewerId))),
                  ) ?? [];
                  const humanDecisionCount = Math.min(2, new Set(phaseDecisions.map((decision) => decision.reviewerId)).size);
                  const hasHumanReviewActivity = assignedCount > 0 || humanDecisionCount > 0;
                  const displayState = state === "pending" && hasHumanReviewActivity ? "in-progress" : state;
                  const statusLabel = displayState === "in-progress"
                    ? "In progress"
                    : state === "included" && activeStage === "title-abstract"
                      ? "Passed to Full Text"
                      : STATUS_CONFIG[state as keyof typeof STATUS_CONFIG]?.label ?? state;
                  return <tr key={paper.id} tabIndex={0} role="link" onClick={() => onOpenPaper(paper.id)} onKeyDown={(event) => { if (event.key === "Enter") onOpenPaper(paper.id); }} className="cursor-pointer motion-safe:transition-colors hover:bg-bg-primary/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none">
                    <td className="min-w-0 overflow-hidden px-2 py-4 lg:px-3"><div className="line-clamp-2 text-sm font-semibold text-text-primary">{paper.title || "Untitled paper"}</div>{!paper.abstract?.trim() && <span className="mt-1 inline-flex rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">Missing abstract</span>}<div className="mt-1 truncate text-xs text-text-secondary">{paper.authors || "Authors unavailable"}{paper.journal || paper.source ? ` · ${paper.journal || paper.source}` : ""}</div></td>
                    <td className="px-2 py-4 text-sm tabular-nums">{paper.publicationYear ?? "—"}</td>
                    <td className="max-w-0 truncate px-2 py-4 text-sm text-text-secondary">{paper.journal || paper.source || "—"}</td>
                    <td className="min-w-0 max-w-0 overflow-hidden px-1 py-4 lg:px-2">{paper.doi ? <a href={`https://doi.org/${paper.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, "")}`} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="flex min-w-0 max-w-full items-center gap-1 text-xs text-accent hover:underline"><span className="min-w-0 truncate">{paper.doi}</span><FiExternalLink className="shrink-0"/></a> : <span className="text-sm text-text-secondary">—</span>}</td>
                    <td className="overflow-hidden px-2 py-4"><span className={cn("inline-flex max-w-full items-center whitespace-nowrap gap-1.5 rounded-full px-2 py-1 text-xs font-medium", STATUS_STYLES[displayState] ?? STATUS_STYLES[state] ?? "border border-border bg-bg-secondary text-text-secondary")}>{state === "conflicted" && <FiAlertTriangle/>}{statusLabel}</span></td>
                    <td className="max-w-0 truncate px-2 py-4 text-xs text-text-secondary" title={assignmentLabel || undefined}>{assignmentLabel || "Unassigned"}</td>
                    <td className="whitespace-nowrap px-2 py-4 text-xs text-text-secondary">{humanDecisionCount}/2 human reviews</td>
                    <td className="whitespace-nowrap px-2 py-4"><button type="button" onClick={(event) => { event.stopPropagation(); onOpenPaper(paper.id); }} className="min-h-11 min-w-[96px] whitespace-nowrap rounded-lg bg-accent px-2 text-xs font-semibold text-white motion-safe:transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 motion-reduce:transition-none">Open review</button></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-4">
            <div className="flex items-center gap-3 text-xs text-text-secondary"><span>{papersError ? "Papers unavailable" : pagination.totalCount ? `${(pagination.pageNumber - 1) * pagination.pageSize + 1}–${Math.min(pagination.pageNumber * pagination.pageSize, pagination.totalCount)} of ${pagination.totalCount}` : "0 papers"}</span>{onPageSizeChange && <label className="flex items-center gap-2">Rows<Select value={pagination.pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="rounded-md border border-border bg-surface-white px-2 py-1"><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></Select></label>}</div>
            <div className="flex items-center gap-2"><button type="button" aria-label="Previous page" disabled={!pagination.hasPreviousPage || Boolean(papersError)} onClick={() => onPageChange(pagination.pageNumber - 1)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"><FiChevronLeft/></button><span className="min-w-20 text-center text-xs text-text-secondary">{papersError ? "Page unavailable" : `Page ${pagination.pageNumber} of ${Math.max(1, pagination.totalPages)}`}</span><button type="button" aria-label="Next page" disabled={!pagination.hasNextPage || Boolean(papersError)} onClick={() => onPageChange(pagination.pageNumber + 1)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"><FiChevronRight/></button></div>
          </footer>
        </section>
      </div>
    </main>
  );
}
