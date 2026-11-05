import {
  FiSearch,
  FiFile,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
} from "react-icons/fi";
import { cn } from "../../../../utils/cn";
import Pagination from "../../../../components/ui/Pagination";

export interface PaperItem {
  paperId: string;
  title: string;
  authors: string | null;
  completionPercentage?: number;
  resolution?: any; // QualityAssessmentResolutionResponse or equivalent
}

interface AssessmentQueueProps {
  papers: PaperItem[];
  selectedPaperId: string | null;
  searchQuery: string;
  // allow null because parent may pass setSelectedPaperId
  onSelectPaper: (id: string | null) => void;
  onSearchChange: (query: string) => void;
  isLeader?: boolean;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export default function AssessmentQueue({
  papers,
  selectedPaperId,
  searchQuery,
  onSelectPaper,
  onSearchChange,
  isLeader = false,
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
}: AssessmentQueueProps) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-bg-primary">
      {/* Header */}
      <div className="border-b border-border bg-surface-white px-4 py-4 sm:px-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiFile className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">
              {isLeader ? "Resolution Queue" : "Assessment Queue"}
            </h2>
          </div>
          <span className="rounded-full border border-border bg-bg-primary px-2.5 py-1 text-xs font-semibold text-text-secondary">
            {totalItems}
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
              aria-label="Search papers by title or author"
            placeholder="Search title, author..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-border bg-bg-primary py-2.5 pl-9 pr-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-primary/50 focus:bg-surface-white focus:ring-4 focus:ring-primary/10 motion-reduce:transition-none"
          />
        </div>
      </div>

      {/* List */}
      <div className="custom-scrollbar min-h-0 min-w-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto p-3 sm:p-3.5">
        {papers.map((paper) => {
          const isSelected = selectedPaperId === paper.paperId;

          let resolutionLabel: string | undefined;
          const rawFinalDecision = paper.resolution?.finalDecision;
          const finalDecision = rawFinalDecision == null ? null : Number(rawFinalDecision);
          if (finalDecision === 0 || finalDecision === 1) {
            resolutionLabel =
              finalDecision === 1
                ? "HighQuality"
                : "LowQuality";
          }
          const percentage = paper.completionPercentage ?? 0;

          let StatusIcon = FiClock;
          let iconColor = "text-text-secondary";

          if (resolutionLabel === "HighQuality") {
            StatusIcon = FiCheckCircle;
            iconColor = "text-success";
          } else if (resolutionLabel === "LowQuality") {
            StatusIcon = FiAlertCircle;
            iconColor = "text-error";
          } else if (percentage === 100 && !isLeader) {
            // only show as completed if resolution is done for leaders, for non-leaders show as completed if assessment is done (100% completion)
            StatusIcon = FiCheckCircle;
            iconColor = "text-success";
          } else if (percentage > 0) {
            StatusIcon = FiClock;
            iconColor = "text-accent";
          }

          return (
            <div
              key={paper.paperId}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              onClick={() => onSelectPaper(paper.paperId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectPaper(paper.paperId);
                }
              }}
              className={cn(
                "w-full cursor-pointer select-none overflow-hidden rounded-xl border px-3.5 py-3 text-left outline-none transition-[background-color,border-color] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40",
                isSelected
                  ? "border-primary/35 bg-primary-light"
                  : "border-border/70 bg-surface-white hover:border-border hover:bg-bg-primary/60",
              )}
            >
              <div className="flex items-start gap-2">
                <StatusIcon
                  className={cn("w-4 h-4 mt-0.5 shrink-0", iconColor)}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold leading-snug text-text-primary line-clamp-2">
                    {paper.title}
                  </h3>
                  <p className="text-xs text-text-secondary mt-1 truncate">
                    {paper.authors ?? "Unknown authors"}
                  </p>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-secondary">
                      <div
                        className={cn(
                          "h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none",
                        )}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    {resolutionLabel === "HighQuality" ? (
                      <span className="rounded-md bg-success/5 px-2 py-1 text-[11px] font-medium text-success">
                        High Quality
                      </span>
                    ) : resolutionLabel === "LowQuality" ? (
                      <span className="rounded-md bg-error/5 px-2 py-1 text-[11px] font-medium text-error">
                        Low Quality
                      </span>
                    ) : (
                      <span className="text-[10px] text-text-secondary font-medium whitespace-nowrap min-w-[32px] text-right">
                        {`${percentage}%`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {papers.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 px-4 text-center">
            <div className="mx-auto max-w-[220px] py-8 text-center">
              <FiFile className="mx-auto mb-2 h-5 w-5 text-text-muted" />
              <p className="text-sm font-medium text-text-primary">No papers found</p>
              <p className="mt-1 text-xs leading-5 text-text-secondary">Try another title or author search.</p>
            </div>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col items-center gap-2 border-t border-border bg-surface-white px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Page {currentPage} of {totalPages || 1}
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages || 1}
          onPageChange={onPageChange}
          compact
        />
      </div>
    </div>
  );
}
