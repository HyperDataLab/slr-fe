import React from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Minus,
  Search,
} from "lucide-react";
import Modal from "../../../components/ui/Modal";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "../../../components/ui/Table";
import { cn } from "../../../utils/cn";
import { useReviewerAssignmentTable } from "../../../hooks/useStudySelection";
import type { ReviewerProgress } from "./types";
import LoadingSpinner from "../../../components/ui/LoadingSpinner";
import { getInitials } from "../../../utils/getInitials";

interface ReviewerAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  processId: string;
  reviewer: ReviewerProgress | null;
}

const PhaseBadge: React.FC<{ status: string }> = ({ status }) => {
  if (status === "Not Assigned" || !status) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-secondary px-3 py-1.5 text-text-secondary">
        <Minus size={12} strokeWidth={3} />
        <span className="text-[10px] font-semibold uppercase tracking-wide leading-none">
          Not Assigned
        </span>
      </div>
    );
  }

  const parts = status.split(" · ");
  const decision = parts[0];
  const checklist = parts[1];

  const getColors = (d: string) => {
    if (d === "Include")
      return "bg-success/10 text-success border-success/20 dot-success";
    if (d === "Exclude")
      return "bg-error/10 text-error border-error/20 dot-error";
    if (d === "Pending")
      return "bg-warning/10 text-warning border-warning/20 dot-warning";
    return "bg-bg-secondary text-text-primary border-border dot-text-secondary";
  };

  const colorClass = getColors(decision);
  const bgColor = colorClass.split(" ")[0];
  const textColor = colorClass.split(" ")[1];
  const borderColor = colorClass.split(" ")[2];
  const dotColor = colorClass.split(" ")[3].replace("dot-", "bg-");

  return (
    <div
      className={cn(
        "inline-flex flex-col items-start gap-1 rounded-lg border px-3 py-2",
        bgColor,
        borderColor,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide leading-none",
          textColor,
        )}
      >
        <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
        {decision}
      </div>
      {checklist && (
        <div className="flex items-center gap-1 text-[9px] text-text-secondary font-bold italic leading-none pl-3">
          <FileText size={10} className="shrink-0" />
          {checklist}
        </div>
      )}
    </div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getStyle = (s: string) => {
    switch (s) {
      case "Completed":
        return "border border-success/20 bg-success/10 text-success";
      case "In Progress":
        return "border border-primary/20 bg-primary-light text-primary-hover";
      default:
        return "border border-border bg-bg-secondary text-text-secondary";
    }
  };

  const getIcon = (s: string) => {
    switch (s) {
      case "Completed":
        return <CheckCircle2 size={12} />;
      case "In Progress":
        return <Clock size={12} />;
      default:
        return <AlertCircle size={12} />;
    }
  };

  return (
    <div
      className={cn(
        "inline-flex cursor-default items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide",
        getStyle(status),
      )}
    >
      {getIcon(status)}
      {status}
    </div>
  );
};

const ReviewerAssignmentModal: React.FC<ReviewerAssignmentModalProps> = ({
  isOpen,
  onClose,
  processId,
  reviewer,
}) => {
  const { data: assignments, isLoading } = useReviewerAssignmentTable(
    processId,
    reviewer?.id,
  );

  if (!reviewer) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-white">
            {getInitials(reviewer.reviewerName)}
          </div>
          <div>
            <h2 className="text-xl font-black text-text-primary tracking-tight leading-none mb-1">
              Assignment Details
            </h2>
            <p className="text-xs text-text-secondary font-bold uppercase tracking-widest">
              Reviewer:{" "}
              <span className="text-accent">{reviewer.reviewerName}</span>
            </p>
          </div>
        </div>
      }
      description={
        <div className="flex items-center gap-4 mt-2">
          Overall assignment: {reviewer.progress}%
        </div>
      }
      size="xl"
    >
      <div className="space-y-6 pt-4">
        <div className="relative overflow-hidden rounded-xl border border-border shadow-none bg-surface-white min-h-[400px]">
          {isLoading ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center px-6 text-center text-text-secondary">
              <LoadingSpinner size="lg" className="mb-4" />
              <p className="text-lg font-black tracking-tight italic">
                Loading assignments...
              </p>
            </div>
          ) : assignments && assignments.length > 0 ? (
            <>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader className="bg-bg-secondary/50">
                    <TableRow className="hover:bg-transparent border-b border-border">
                      <TableHead className="text-[10px] uppercase font-black tracking-[0.2em] text-text-secondary py-6 px-8">
                        Paper Title
                      </TableHead>
                      <TableHead className="text-[10px] uppercase font-black tracking-[0.2em] text-text-secondary py-6 text-center">
                        Title/Abstract
                      </TableHead>
                      <TableHead className="text-[10px] uppercase font-black tracking-[0.2em] text-text-secondary py-6 text-center">
                        Full-text
                      </TableHead>
                      <TableHead className="text-[10px] uppercase font-black tracking-[0.2em] text-text-secondary py-6 text-center">
                        Overall Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((assignment) => (
                      <TableRow
                        key={assignment.paperId}
                        className="group border-b border-border/70 transition-colors hover:bg-bg-secondary/50 motion-reduce:transition-none last:border-none"
                      >
                        <TableCell className="py-6 px-8 max-w-sm">
                          <div className="font-bold text-text-primary leading-tight transition-colors group-hover:text-accent motion-reduce:transition-none">
                            {assignment.paperTitle}
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-6">
                          <PhaseBadge status={assignment.titleAbstractDisplay} />
                        </TableCell>
                        <TableCell className="text-center py-6">
                          <PhaseBadge status={assignment.fullTextDisplay} />
                        </TableCell>
                        <TableCell className="text-center py-6 px-8">
                          <StatusBadge status={assignment.overallStatus} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3 p-3 sm:hidden">
                {assignments.map((assignment) => (
                  <article
                    key={assignment.paperId}
                    className="min-w-0 rounded-xl border border-border bg-surface-white p-3"
                  >
                    <h3 className="break-words text-sm font-semibold leading-snug text-text-primary">
                      {assignment.paperTitle}
                    </h3>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="min-w-0 space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                          Title/Abstract
                        </p>
                        <PhaseBadge status={assignment.titleAbstractDisplay} />
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                          Full-text
                        </p>
                        <PhaseBadge status={assignment.fullTextDisplay} />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                        Overall status
                      </span>
                      <StatusBadge status={assignment.overallStatus} />
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="flex min-h-[400px] flex-col items-center justify-center px-6 text-center text-text-secondary">
              <Search
                size={48}
                strokeWidth={1.5}
                className="mb-4 opacity-50"
                aria-hidden="true"
              />
              <p className="text-lg font-black tracking-tight italic">
                No Papers Assigned
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ReviewerAssignmentModal;
