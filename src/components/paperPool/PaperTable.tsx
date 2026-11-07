import { useState, type ReactNode } from "react";
import { FiSearch, FiUpload } from "react-icons/fi";
import LoadingSpinner from "../ui/LoadingSpinner";
import DeletePaperModal from "./DeletePaperModal";
import Button from "../ui/Button";
import Select from "../ui/Select";
import Checkbox from "../ui/Checkbox";
import { Table } from "../ui/Table";
import DataTableToolbar from "../ui/DataTableToolbar";
import PaperRow from "./PaperRow";
import type { PaperPoolItem } from "./types";
import type { UploadPdfOptions } from "../../pages/reviewProcess/studySelection/uploadTypes";
import type { PaperWithDecisionsResponse } from "../../types/studySelection";

type UploadPdfHandler = (
  paperId: string,
  file: File,
  options?: UploadPdfOptions,
) => Promise<PaperWithDecisionsResponse>;
type ApplyMetadataSuggestionHandler = (
  paperId: string,
  sourceMetadataId: string,
  fields: string[],
) => Promise<void>;

interface PaperTableProps {
  papers: PaperPoolItem[];
  isLoading: boolean;
  isFetching: boolean;
  totalCount: number;
  searchText?: string;
  onSearchTextChange?: (value: string) => void;
  filterControl?: ReactNode;
  onImport?: () => void;
  pageNumber: number;
  totalPages: number;
  pageSize: number;
  selectedPaperIds: string[];
  allPageSelected: boolean;
  onToggleAllPage: (checked: boolean) => void;
  onTogglePaper: (paperId: string, selected: boolean) => void;
  onViewDetails: (paper: PaperPoolItem) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;

  // PDF Actions
  onUploadPdf?: UploadPdfHandler;
  isUploadingPdf?: boolean;
  onApplyMetadataSuggestion?: ApplyMetadataSuggestionHandler;
  isApplyingMetadataSuggestion?: boolean;
  onRemovePdf?: (paperId: string) => Promise<void>;
  isRemovingPdf?: boolean;

  // Delete Action
  onDeletePaper?: (paperId: string, reason: string) => void;
  isDeletingPaper?: string | null; // PaperId being deleted
  isLeader?: boolean;
  canUploadPdf?: boolean;
}

export default function PaperTable({
  papers,
  isLoading,
  isFetching,
  totalCount,
  searchText = "",
  onSearchTextChange,
  filterControl,
  onImport,
  pageNumber,
  totalPages,
  pageSize,
  selectedPaperIds,
  allPageSelected,
  onToggleAllPage,
  onTogglePaper,
  onViewDetails,
  onPageChange,
  onPageSizeChange,
  onUploadPdf,
  isUploadingPdf,
  onApplyMetadataSuggestion,
  isApplyingMetadataSuggestion,
  onRemovePdf,
  isRemovingPdf,
  onDeletePaper,
  isDeletingPaper,
  isLeader = false,
  canUploadPdf = false,
}: PaperTableProps) {
  const [paperPendingDelete, setPaperPendingDelete] = useState<PaperPoolItem | null>(null);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-white">
      <DataTableToolbar
        search={
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <span className="shrink-0 text-sm font-semibold text-text-primary">
              {totalCount.toLocaleString()} <span className="font-normal text-text-secondary">Results</span>
            </span>
            {isFetching && (
              <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-full border border-accent/20 bg-primary-light px-2.5 py-1 text-[10px] font-medium text-accent">
                <div aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-ping motion-reduce:animate-none" />
                Refreshing
              </div>
            )}
            {onSearchTextChange && (
              <label className="group relative min-w-0 w-full sm:w-[240px] lg:w-[280px]">
                <span className="sr-only">Search papers by title, DOI, or authors</span>
                <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-accent motion-reduce:transition-none" />
                <input
                  type="search"
                  aria-label="Search papers by title, DOI, or authors"
                  value={searchText}
                  onChange={(event) => onSearchTextChange(event.target.value)}
                  placeholder="Search title, DOI, authors..."
                  className="h-10 w-full rounded-lg border border-border bg-surface-white pl-9 pr-3 text-sm text-text-primary outline-none transition-[border-color,box-shadow] placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 motion-reduce:transition-none"
                />
              </label>
            )}
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
            {isLeader && onImport && (
              <Button
                variant="outline"
                size="sm"
                className="min-h-10 rounded-lg border-border px-3 text-xs hover:border-accent hover:bg-accent hover:text-text-on-primary"
                onClick={onImport}
              >
                <FiUpload className="h-4 w-4" aria-hidden="true" />
                Import Papers
              </Button>
            )}
            {filterControl}
          </div>
        }
      />

      {/* Table Content */}
      <div
        className="flex-1 overflow-auto custom-scrollbar"
        style={{
          minHeight: papers.length === 0 ? "180px" : "0",
        }}
      >
        <Table containerClassName="!overflow-visible" className="w-full min-w-[1072px] table-fixed">
          <colgroup>
            {isLeader && <col className="w-10" />}
            <col className="w-24" />
            <col className="w-[320px]" />
            <col className="w-[72px]" />
            <col className="w-28" />
            <col className="w-28" />
            <col className="w-[200px] lg:w-40" />
            <col className="w-[136px]" />
            <col className="w-[72px] lg:w-16" />
          </colgroup>
          <thead className="sticky top-0 z-10 border-b border-border bg-white">
            <tr className="text-left">
              {isLeader && (
                <th className="w-10 px-2.5 py-2.5">
                  <div className="flex items-center">
                    <Checkbox
                      checked={allPageSelected}
                      onChange={(e) => onToggleAllPage(e.target.checked)}
                      aria-label="Select all papers in current page"
                      wrapperClassName="h-8 w-8 justify-center rounded-lg transition-colors hover:bg-primary-light motion-reduce:transition-none"
                    />
                  </div>
                </th>
              )}
              <th
                className={`whitespace-nowrap ${
                  isLeader ? "px-2.5" : "px-3"
                } py-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary`}
              >
                Paper ID
              </th>
              <th className="w-[320px] max-w-[320px] whitespace-nowrap px-2.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                Title & Authors
              </th>
              <th className="whitespace-nowrap px-2.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                Year
              </th>
              <th className="whitespace-nowrap px-2.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                DOI
              </th>
              <th className="whitespace-nowrap px-2.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                Source
              </th>
              <th className="whitespace-nowrap px-2.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                Full Text
              </th>
              <th className="whitespace-nowrap px-2.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                Status
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading && papers.length === 0 && (
              <tr>
                <td colSpan={isLeader ? 9 : 8} className="px-4 py-12">
                  <div className="flex items-center justify-center gap-3 text-sm text-text-secondary" role="status" aria-live="polite">
                    <LoadingSpinner size="sm" />
                    <span>Loading paper library...</span>
                  </div>
                </td>
              </tr>
            )}
            {papers.map((paper) => (
              <PaperRow
                key={paper.id}
                paper={paper}
                isSelected={selectedPaperIds.includes(paper.id)}
                onToggleSelect={onTogglePaper}
                onViewDetails={onViewDetails}
                onUploadPdf={onUploadPdf}
                isUploadingPdf={isUploadingPdf}
                onApplyMetadataSuggestion={onApplyMetadataSuggestion}
                isApplyingMetadataSuggestion={isApplyingMetadataSuggestion}
                onRemovePdf={onRemovePdf}
                isRemovingPdf={isRemovingPdf}
                onDeletePaper={onDeletePaper}
                onDeleteClick={setPaperPendingDelete}
                isDeletingPaper={isDeletingPaper === paper.id}
                isLeader={isLeader}
                canUploadPdf={canUploadPdf}
              />
            ))}
            {papers.length === 0 && !isLoading && (
              <tr>
                <td
                  colSpan={isLeader ? 9 : 8}
                  className="px-4 py-7 sm:py-8"
                >
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-bg-secondary text-text-secondary ring-1 ring-inset ring-border/70">
                      <svg
                        className="h-8 w-8"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-base font-semibold text-text-primary">
                      No papers found
                    </h3>
                    <p className="mt-1 max-w-sm text-sm leading-6 text-text-secondary">
                      We couldn't find any papers matching your current filter
                      criteria. Try adjusting your search or filters.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col gap-3 border-t border-border bg-bg-secondary/50 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="text-xs text-text-secondary">
            Showing page{" "}
            <span className="font-semibold text-text-primary">{pageNumber}</span> of{" "}
            <span className="font-semibold text-text-primary">{totalPages}</span>
          </div>
          <div className="flex min-h-10 items-center gap-2">
            <label htmlFor="paper-rows-per-page" className="whitespace-nowrap text-xs font-medium text-text-secondary">
              Rows per page
            </label>
            <Select
              id="paper-rows-per-page"
              aria-label="Rows per page"
              className="w-[76px] min-w-[76px] shrink-0"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              options={[
                { value: "20", label: "20" },
                { value: "25", label: "25" },
                { value: "50", label: "50" },
                { value: "100", label: "100" },
              ]}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="min-h-11 rounded-lg px-3 text-xs font-medium lg:min-h-10"
            onClick={() => onPageChange(pageNumber - 1)}
            disabled={pageNumber <= 1 || isFetching}
          >
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {/* Simple page numbers could go here if needed */}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="min-h-11 rounded-lg px-3 text-xs font-medium lg:min-h-10"
            onClick={() => onPageChange(pageNumber + 1)}
            disabled={pageNumber >= totalPages || isFetching}
          >
            Next
          </Button>
        </div>
      </div>

      <DeletePaperModal
        isOpen={Boolean(paperPendingDelete)}
        paper={paperPendingDelete}
        onClose={() => setPaperPendingDelete(null)}
        onConfirm={(paperId, reason) => {
          onDeletePaper?.(paperId, reason);
          setPaperPendingDelete(null);
        }}
        isLoading={Boolean(isDeletingPaper && paperPendingDelete && isDeletingPaper === paperPendingDelete.id)}
      />
    </div>
  );
}
