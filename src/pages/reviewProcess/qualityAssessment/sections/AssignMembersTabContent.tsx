import { useState } from "react";
import type { WorkspaceQAPaper } from "../QualityAssessmentWorkspace";
import {
  Search,
  User,
  FileText,
  CheckCircle2,
  Clock,
  RotateCcw,
} from "lucide-react";
import Card from "../../../../components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/Table";
import Pagination from "../../../../components/ui/Pagination";

interface AssignMembersTabContentProps {
  papers: WorkspaceQAPaper[];
  isLeader?: boolean;
  onPaperClick: (paperId: string) => void;
  onAssignClick: (e: React.MouseEvent, paperId: string) => void;
  onReopenPaper?: (paperId: string) => void;
  onSearchChange?: (query: string) => void;
  searchQuery?: string;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

function getPaperStatus(paper: WorkspaceQAPaper, isLeader: boolean = false) {
  const rawFinalDecision = paper.resolution?.finalDecision;
  const finalDecision = rawFinalDecision == null ? null : Number(rawFinalDecision);
  if (finalDecision === 0 || finalDecision === 1) {
    return finalDecision === 1
      ? "high-quality"
      : "low-quality";
  }
  if (paper.completionPercentage === 100 && !isLeader) return "completed";
  if (paper.completionPercentage > 0) return "in-progress";
  return "pending";
}

function getPaperReviewers(paper: WorkspaceQAPaper) {
  if ("reviewers" in paper && Array.isArray(paper.reviewers)) {
    return paper.reviewers;
  }
  return [];
}

export function AssignMembersTabContent({
  papers,
  isLeader,
  onPaperClick,
  onAssignClick,
  onReopenPaper,
  onSearchChange,
  searchQuery = "",
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
}: AssignMembersTabContentProps) {
  const pageSize = 10;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedOnPage = papers.filter((p) => selectedIds.has(p.paperId)).length;
  const allSelected = papers.length > 0 && selectedOnPage === papers.length;
  const someSelected = selectedOnPage > 0 && !allSelected;

  const togglePaper = (paperId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(paperId)) next.add(paperId);
      return next;
    });
  };

  // "Select all" acts on the papers currently listed; selections from other pages are kept.
  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      papers.forEach((p) => (allSelected ? next.delete(p.paperId) : next.add(p.paperId)));
      return next;
    });
  };

  return (
    <Card className="overflow-hidden rounded-2xl border border-border bg-surface-white p-0 shadow-[0_2px_8px_rgba(18,35,49,0.035)]">
      <div className="flex flex-col justify-between gap-4 border-b border-border bg-surface-white px-4 py-5 sm:flex-row sm:items-center sm:px-5 sm:py-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-base font-semibold tracking-tight text-text-primary sm:text-lg">
              {isLeader
                ? "Assign Papers to Team Members"
                : "My Assessment Papers"}
            </h2>
            <span className="rounded-full bg-bg-primary px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
              {totalItems} {totalItems === 1 ? "study" : "studies"}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-text-secondary">
            {isLeader
              ? "Distribute quality assessment tasks among the review team."
              : "Review and evaluate your assigned papers."}
          </p>
        </div>

        <div className="flex w-full gap-2 sm:w-auto sm:gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary group-focus-within:text-accent transition-colors" />
            <input
              type="search"
              aria-label="Search papers by title"
              value={searchQuery}
              onChange={(e) => {
                if (onSearchChange) onSearchChange(e.target.value);
              }}
              placeholder="Search papers by title..."
              className="min-h-11 w-full rounded-xl border border-border bg-bg-primary/50 py-2.5 pl-10 pr-4 text-sm text-text-primary transition-[border-color,box-shadow,background-color] placeholder:text-text-secondary/80 focus:border-primary focus:bg-surface-white focus:outline-none focus:ring-2 focus:ring-primary/15 motion-reduce:transition-none sm:w-72"
            />
          </div>
        </div>
      </div>

      <div className="divide-y divide-border md:hidden">
        {papers.map((paper) => {
          const status = getPaperStatus(paper, isLeader);
          const statusStyles: Record<string, string> = {
            "high-quality": "border-success/20 bg-success/10 text-success",
            "low-quality": "border-error/20 bg-error/10 text-error",
            completed: "border-success/20 bg-success/10 text-success",
            "in-progress": "border-accent/30 bg-primary-light text-accent",
            pending: "border-border bg-bg-secondary text-text-primary",
          };
          const statusLabels: Record<string, string> = {
            "high-quality": "High Quality",
            "low-quality": "Low Quality",
            completed: "Completed",
            "in-progress": "In Progress",
            pending: "Pending",
          };
          const reviewers = getPaperReviewers(paper);

          return (
            <article key={paper.paperId} className="space-y-3 p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  aria-label={`Select ${paper.title}`}
                  checked={selectedIds.has(paper.paperId)}
                  onChange={() => togglePaper(paper.paperId)}
                  className="mt-1 rounded-md border-border text-accent focus:ring-primary/40"
                />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onPaperClick(paper.paperId)}
                    className="line-clamp-3 text-left text-sm font-semibold leading-5 text-text-primary hover:text-accent focus-visible:outline-none focus-visible:underline"
                  >
                    {paper.title}
                  </button>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">
                    {paper.authors || "Unknown authors"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pl-7">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[status] || statusStyles.pending}`}>
                  {statusLabels[status] || "Pending"}
                </span>
                {isLeader && paper.resolution && (
                  <button
                    type="button"
                    onClick={() => onReopenPaper?.(paper.paperId)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-warning/20 bg-warning/10 px-2.5 py-1.5 text-xs font-semibold text-warning transition-colors hover:border-warning/40 hover:bg-warning/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none"
                    aria-label={`Reopen ${paper.title}`}
                  >
                    <RotateCcw size={13} aria-hidden="true" />
                    Reopen
                  </button>
                )}
              </div>

              {isLeader && (
                <div className="flex items-center justify-between gap-3 pl-7">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-text-secondary">
                    <span className="shrink-0">Reviewers</span>
                    {reviewers.length > 0 ? (
                      reviewers.map((reviewer) => (
                        <span key={reviewer.id} className="max-w-full truncate rounded-full bg-bg-primary px-2 py-1 text-text-primary">
                          {reviewer.fullname || reviewer.username}
                        </span>
                      ))
                    ) : (
                      <span>Unassigned</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(event) => onAssignClick(event, paper.paperId)}
                    className="min-h-11 shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-primary/40 hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 motion-reduce:transition-none"
                    aria-label={`${reviewers.length ? "Edit" : "Assign"} reviewers for ${paper.title}`}
                  >
                    {reviewers.length ? "Edit" : "Assign"}
                  </button>
                </div>
              )}
            </article>
          );
        })}
        {papers.length === 0 && (
          <div className="flex flex-col items-center px-4 py-10 text-center text-text-secondary">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-bg-primary text-text-secondary/60">
              <FileText size={22} />
            </div>
            <p className="text-sm font-semibold text-text-primary">No papers found</p>
            <p className="mt-1 text-sm">Try adjusting your search.</p>
          </div>
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <Table containerClassName="min-w-[760px]">
          <TableHeader className="bg-bg-primary/70">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12 text-center">
                <input
                  type="checkbox"
                  aria-label="Select all papers"
                  checked={allSelected}
                  disabled={papers.length === 0}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  className="rounded-md border-border text-accent transition-colors focus:ring-primary/40 motion-reduce:transition-none"
                />
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                Paper Details
              </TableHead>
              {isLeader && (
                <TableHead className="w-48 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Assigned Reviewers
                </TableHead>
              )}
              <TableHead className="w-40 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                Status
              </TableHead>
              {isLeader && (
                <TableHead className="w-28 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  Action
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {papers.map((paper) => (
              <TableRow
                key={paper.paperId}
                className="group cursor-pointer transition-colors hover:bg-primary-light/30"
                onClick={() => onPaperClick(paper.paperId)}
              >
                <TableCell
                  className="text-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    aria-label={`Select ${paper.title}`}
                    checked={selectedIds.has(paper.paperId)}
                    onChange={() => togglePaper(paper.paperId)}
                  className="rounded-md border-border text-accent transition-colors focus:ring-primary/40 motion-reduce:transition-none"
                  />
                </TableCell>
                <TableCell className="py-4">
                  <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-primary-light text-accent">
                      <FileText size={16} />
                    </div>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onPaperClick(paper.paperId);
                        }}
                        className="line-clamp-2 text-left text-sm font-medium text-text-primary transition-colors hover:text-accent focus-visible:outline-none focus-visible:underline"
                      >
                        {paper.title}
                      </button>
                      <span className="text-xs text-text-secondary mt-1 line-clamp-1">
                        {paper.authors || "Unknown authors"}
                      </span>
                    </div>
                  </div>
                </TableCell>
                {isLeader && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2 overflow-hidden">
                        {getPaperReviewers(paper).length === 0 ? (
                          <button
                            type="button"
                            onClick={(e) => onAssignClick(e, paper.paperId)}
                            className="text-left text-xs italic text-text-secondary transition-colors hover:text-accent focus-visible:outline-none focus-visible:underline"
                            aria-label={`Assign reviewers to ${paper.title}`}
                          >
                            Unassigned
                          </button>
                        ) : (
                          getPaperReviewers(paper).map((member, idx) => (
                            <button
                              key={idx}
                              type="button"
                              className="relative group/member shrink-0 cursor-pointer"
                              onClick={(e) => onAssignClick(e, paper.paperId)}
                              aria-label={`Edit reviewers for ${paper.title}`}
                              title={member.fullname || member.username}
                            >
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-light ring-2 ring-white transition-colors hover:bg-accent/30">
                                <span className="text-xs font-bold text-accent">
                                  {(member.fullname || member.username)
                                    .substring(0, 2)
                                    .toUpperCase()}
                                </span>
                              </span>
                              <span className="absolute bottom-full left-1/2 z-10 mb-2 hidden w-max -translate-x-1/2 rounded bg-text-primary px-2 py-1 text-xs text-surface-white group-hover/member:block group-focus-visible/member:block">
                                {member.fullname || member.username}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                      {getPaperReviewers(paper).length < 2 && (
                        <button
                          type="button"
                  className="group/btn relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-dashed border-border bg-surface-white text-text-secondary ring-2 ring-white transition-colors hover:border-primary hover:bg-primary-light hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none"
                          onClick={(e) => onAssignClick(e, paper.paperId)}
                          aria-label={`Assign reviewer to ${paper.title}`}
                        >
                          <User size={14} aria-hidden="true" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/btn:block z-10 w-max bg-text-primary text-surface-white text-xs px-2 py-1 rounded shadow-none">
                            Assign Reviewer
                          </div>
                        </button>
                      )}
                    </div>
                  </TableCell>
                )}
                <TableCell>
                  {(() => {
                    const status = getPaperStatus(paper, isLeader);

                    const statusStyles: Record<
                      string,
                      {
                        bg: string;
                        text: string;
                        icon: React.ReactNode;
                        label: string;
                      }
                    > = {
                      "high-quality": {
                        bg: "bg-success/10 border-success/20",
                        text: "text-success",
                        icon: (
                          <CheckCircle2
                            size={12}
                            className="text-success"
                          />
                        ),
                        label: "High Quality",
                      },
                      "low-quality": {
                        bg: "bg-error/10 border-error/20",
                        text: "text-error",
                        icon: (
                          <CheckCircle2 size={12} className="text-error" />
                        ),
                        label: "Low Quality",
                      },
                      completed: {
                        bg: "bg-success/10 border-success/20",
                        text: "text-success",
                        icon: (
                          <CheckCircle2
                            size={12}
                            className="text-success"
                          />
                        ),
                        label: "Completed",
                      },
                      "in-progress": {
                        bg: "bg-primary-light border-accent/30",
                        text: "text-accent",
                        icon: <Clock size={12} className="text-accent" />,
                        label: "In Progress",
                      },
                      pending: {
                        bg: "bg-bg-secondary border-border",
                        text: "text-text-primary",
                        icon: (
                          <Clock size={12} className="text-text-secondary" />
                        ),
                        label: "Pending",
                      },
                    };

                    const style =
                      statusStyles[status] || statusStyles["pending"];

                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${style.bg} ${style.text}`}
                      >
                        {style.icon}
                        {style.label}
                      </span>
                    );
                  })()}
                </TableCell>
                {isLeader && (
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {paper.resolution && (
                      <button
                        type="button"
                        onClick={() => onReopenPaper?.(paper.paperId)}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-warning/20 bg-warning/10 px-2.5 py-1.5 text-xs font-semibold text-warning transition-colors hover:border-warning/40 hover:bg-warning/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none"
                        aria-label={`Reopen ${paper.title}`}
                        title="Reopen this paper for reviewer corrections"
                      >
                        <RotateCcw size={13} aria-hidden="true" />
                        Reopen
                      </button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {papers.length === 0 && (
          <div className="flex flex-col items-center px-4 py-9 text-center text-text-secondary sm:py-10">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-bg-primary text-text-secondary/60">
              <FileText size={22} />
            </div>
            <p className="text-sm font-semibold text-text-primary">
              No papers found
            </p>
            <p className="mt-1 text-sm">Try adjusting your search filters</p>
          </div>
        )}
      </div>

      <div className="flex flex-col items-start justify-between gap-3 border-t border-border bg-bg-primary/30 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
        <div className="text-xs text-text-secondary sm:text-sm">
          Showing {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
          {Math.min(currentPage * pageSize, totalItems)} of {totalItems} results
          {selectedIds.size > 0 && (
            <span className="ml-2 font-medium text-accent">
              · {selectedIds.size} selected
            </span>
          )}
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      </div>
    </Card>
  );
}
