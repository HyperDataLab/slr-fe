import React, { useState, useMemo } from "react";
import {
  Search,
  ChevronDown,
  CheckCircle2,
  Clock,
  Timer,
  RefreshCw,
} from "lucide-react";
import { cn } from "../../../utils/cn";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "../../../components/ui/Table";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { motion, useReducedMotion } from "framer-motion";
import { useParams } from "react-router-dom";
import ReviewerAssignmentModal from "./ReviewerAssignmentModal";
import { useUserProgressOverview } from "../../../hooks/useUsers";
import Pagination from "../../../components/ui/Pagination";
import type { UserProgress } from "../../../types/user";
import LoadingSpinner from "../../../components/ui/LoadingSpinner";
import { getInitials } from "../../../utils/getInitials";

// --- Sub-components ---

const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => {
  const prefersReducedMotion = useReducedMotion();
  const getBarColor = (val: number) => {
    if (val === 100) return "bg-success";
    if (val >= 30) return "bg-warning";
    return "bg-error";
  };

  return (
    <div className="flex w-full max-w-44 items-center gap-3">
      <div className="h-2 w-full bg-bg-secondary rounded-full overflow-hidden">
        <motion.div
          initial={prefersReducedMotion ? false : { width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.25, ease: "easeOut" }}
          className={cn(
            "h-full rounded-full",
            getBarColor(progress),
          )}
        />
      </div>
      <span className="text-xs font-semibold text-text-secondary min-w-[32px]">
        {progress}%
      </span>
    </div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getVariant = (s: string) => {
    if (s === "Done" || s === "Completed")
      return "bg-success/10 text-success border-success/20";
    if (s === "In Progress" || s === "InProgress")
      return "bg-warning/10 text-warning border-warning/20";
    return "bg-bg-secondary text-text-primary border-border";
  };

  const getIcon = (s: string) => {
    if (s === "Done" || s === "Completed") return <CheckCircle2 size={14} />;
    if (s === "In Progress" || s === "InProgress") return <Timer size={14} />;
    return <Clock size={14} />;
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap",
        getVariant(status),
      )}
    >
      {getIcon(status)}
      {status}
    </span>
  );
};

// --- Main Component ---

const ReviewerProgressPage: React.FC = () => {
  const { projectId, screeningProcessId } = useParams<{
    projectId: string;
    screeningProcessId: string;
  }>();
  const [searchTerm, setSearchTerm] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReviewer, setSelectedReviewer] = useState<UserProgress | null>(
    null,
  );
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  const {
    items: reviewers,
    data: paginatedData,
    isLoading,
    refetch,
    isFetching,
  } = useUserProgressOverview({
    projectId: projectId || "",
    search: searchTerm,
    pageNumber,
    pageSize,
  });

  // Sorting logic (Note: This is now local for the current page, but could be server-side if needed)
  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    if (!reviewers) return [];
    const result = [...reviewers];

    if (sortConfig) {
      result.sort((a, b) => {
        const key = sortConfig.key as keyof UserProgress;
        const aValue = a[key];
        const bValue = b[key];
        const comparison =
          typeof aValue === "number" && typeof bValue === "number"
            ? aValue - bValue
            : String(aValue).localeCompare(String(bValue));
        return sortConfig.direction === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [reviewers, sortConfig]);

  const openAssignmentModal = (reviewer: UserProgress) => {
    setSelectedReviewer(reviewer);
    setIsModalOpen(true);
  };

  return (
    <div className="min-w-0 space-y-5 bg-bg-secondary/50 p-4 sm:space-y-8 sm:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-text-secondary mt-1 font-medium">
            Monitor active screening workloads and decision statistics.
          </p>
        </div>

        <div className="relative group w-full md:w-96">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-accent transition-colors"
            size={18}
          />
          <Input
            aria-label="Search reviewers"
            placeholder="Search reviewer..."
          className="w-full min-h-11 rounded-xl border-border bg-surface-white pl-10 focus:border-primary focus:ring-primary/20 motion-reduce:transition-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Synchronized Info & Reload */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 sm:justify-end sm:gap-3 sm:px-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2 py-2 text-[10px] font-semibold text-text-secondary sm:px-4 sm:font-black sm:uppercase sm:tracking-widest">
          <Clock size={12} className="text-text-secondary" />
          <span>
            Last Synchronized:{" "}
            {paginatedData?.items[0]?.lastSynchronizedAt
              ? new Date(
                  paginatedData.items[0].lastSynchronizedAt,
                ).toLocaleString()
              : new Date().toLocaleTimeString()}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 rounded-xl border border-border/60 bg-surface-white/50 shadow-none backdrop-blur-sm transition-colors hover:bg-surface-white hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none flex items-center justify-center group"
          aria-label="Refresh reviewer progress"
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
        >
          <RefreshCw
            aria-hidden="true"
            className={cn(
              "size-4 text-text-secondary group-hover:text-accent transition-colors",
              isFetching && "motion-safe:animate-spin motion-reduce:animate-none",
            )}
          />
        </Button>
      </div>

      {/* Main Table */}
      <Card className="overflow-hidden rounded-xl border border-border bg-surface-white shadow-none">
        <div className="space-y-3 p-3 md:hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-text-secondary">
              <LoadingSpinner size="md" />
              Loading reviewer data...
            </div>
          ) : sortedData.length > 0 ? (
            sortedData.map((reviewer) => (
              <article key={reviewer.userId} className="min-w-0 rounded-xl border border-border p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">
                    {getInitials(reviewer.fullName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-sm font-semibold text-text-primary">{reviewer.fullName}</h3>
                    <p className="truncate text-xs text-text-secondary" title={reviewer.email}>{reviewer.email}</p>
                    <div className="mt-2">
                      <StatusBadge status={reviewer.statusText} />
                    </div>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 text-xs">
                  <div>
                    <dt className="text-text-secondary">Workload</dt>
                    <dd className="mt-1 font-semibold text-text-primary">{reviewer.workload} papers</dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Completed</dt>
                    <dd className="mt-1 font-semibold text-text-primary">{reviewer.completed}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="mb-1 text-text-secondary">Progress · {reviewer.progress}%</dt>
                    <ProgressBar progress={reviewer.progress} />
                  </div>
                </dl>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 min-h-11 w-full"
                  onClick={() => openAssignmentModal(reviewer)}
                >
                  View Assignment
                </Button>
              </article>
            ))
          ) : (
            <div className="flex flex-col items-center py-10 text-center">
              <Search size={40} aria-hidden="true" className="mb-3 text-text-secondary/50" />
              <p className="font-semibold text-text-secondary">No Reviewers Found</p>
              <p className="mt-1 text-sm text-text-secondary">Try adjusting your filters or search terms.</p>
              <button
                type="button"
                onClick={() => { setSearchTerm(""); setPageNumber(1); }}
                className="mt-4 min-h-11 px-3 text-sm font-semibold text-accent"
              >
                Reset Dashboard
              </button>
            </div>
          )}
        </div>

        <div className="hidden md:block">
        <Table>
          <TableHeader className="bg-bg-secondary/30">
            <TableRow className="hover:bg-transparent cursor-default">
              <TableHead
                className="cursor-pointer px-8"
                onClick={() => handleSort("reviewerName")}
              >
                <div className="flex items-center gap-2">
                  Reviewer
                  {sortConfig?.key === "reviewerName" && (
                    <ChevronDown
                      className={cn(
                        "inline-block transform transition-transform",
                        sortConfig.direction === "desc" ? "rotate-180" : "",
                      )}
                      size={14}
                    />
                  )}
                </div>
              </TableHead>

              <TableHead className="text-center">Workload</TableHead>
              <TableHead
                className="text-center cursor-pointer"
                onClick={() => handleSort("completed")}
              >
                <div className="flex items-center justify-center gap-2">
                  Completed
                  {sortConfig?.key === "completed" && (
                    <ChevronDown
                      className={cn(
                        "inline-block transform transition-transform",
                        sortConfig.direction === "desc" ? "rotate-180" : "",
                      )}
                      size={14}
                    />
                  )}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("progress")}
              >
                <div className="flex items-center gap-2">
                  Progress
                  {sortConfig?.key === "progress" && (
                    <ChevronDown
                      className={cn(
                        "inline-block transform transition-transform",
                        sortConfig.direction === "desc" ? "rotate-180" : "",
                      )}
                      size={14}
                    />
                  )}
                </div>
              </TableHead>

              <TableHead>Status</TableHead>
              <TableHead className="text-center px-8">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-32">
                  <div className="flex flex-col items-center justify-center">
                    <LoadingSpinner size="lg" className="mb-4" />
                    <p className="text-text-secondary font-medium">
                      Loading reviewer data...
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : sortedData.length > 0 ? (
              sortedData.map((reviewer) => (
                <TableRow
                  key={reviewer.userId}
                  className="group cursor-default border-b border-border/50 transition-colors hover:bg-bg-secondary/50 motion-reduce:transition-none"
                >
                  <TableCell className="px-8">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-black text-white transition-transform group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none">
                        {getInitials(reviewer.fullName)}
                      </div>
                      <div>
                        <div className="font-bold text-text-primary">
                          {reviewer.fullName}
                        </div>
                        <div className="text-[10px] text-text-secondary font-medium">
                          {reviewer.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-center font-bold text-text-secondary">
                    {reviewer.workload} papers
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-xl border border-success/20 bg-success/10 px-3 text-sm font-black italic text-success">
                      {reviewer.completed}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ProgressBar progress={reviewer.progress} />
                  </TableCell>

                  <TableCell>
                    <StatusBadge status={reviewer.statusText} />
                  </TableCell>
                  <TableCell className="text-center px-8">
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 rounded-xl border border-border px-4 text-xs font-black uppercase tracking-widest transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-95 motion-reduce:active:scale-100 motion-reduce:transition-none"
                      onClick={() => openAssignmentModal(reviewer)}
                    >
                      View Assignment
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-32">
                <div className="flex flex-col items-center justify-center text-text-secondary/60">
                    <Search
                      size={64}
                      strokeWidth={1}
                      className="mb-6 opacity-40"
                    />
                    <p className="text-xl font-black tracking-tight text-text-secondary">
                      No Reviewers Found
                    </p>
                    <p className="text-sm font-medium mt-2">
                      Try adjusting your filters or search terms.
                    </p>
                    <button
                      onClick={() => {
                        setSearchTerm("");
                        setPageNumber(1);
                      }}
                      className="mt-6 min-h-11 rounded-lg px-3 text-accent hover:text-primary-hover text-sm font-black uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none"
                    >
                      Reset Dashboard
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
        {paginatedData && paginatedData.totalPages > 1 && (
          <div className="p-6 border-t border-border flex justify-center bg-bg-secondary/30">
            <Pagination
              currentPage={paginatedData.pageNumber}
              totalPages={paginatedData.totalPages}
              onPageChange={setPageNumber}
            />
          </div>
        )}
      </Card>

      {/* Reviewer Detail Modal */}
      <ReviewerAssignmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        processId={screeningProcessId || ""}
        reviewer={
          selectedReviewer
            ? {
                id: selectedReviewer.userId,
                reviewerName: selectedReviewer.fullName,
                assigned: selectedReviewer.workload,
                completed: selectedReviewer.completed,
                inProgress: 0,
                notStarted: 0,
                progress: selectedReviewer.progress,
                status:
                  selectedReviewer.progress >= 100
                    ? "Done"
                    : selectedReviewer.progress > 0
                      ? "In Progress"
                      : "Not Started",
                phase: "Title/Abstract",
                papers: [], // Now fetched from API
              }
            : null
        }
      />
    </div>
  );
};

export default ReviewerProgressPage;
