import React, { useState } from "react";
import { Modal } from "../../ui/Modal";

import { Eye } from "lucide-react";
import Button from "../../ui/Button";
import PaperViewerModal from "./PaperViewerModal";
import type { PaperResponse } from "../../../types/paper";
import type { ScreeningDecision } from "../../../pages/reviewProcess/studySelection/titleAbstractScreening/types";
import type { UploadPdfOptions } from "../../../pages/reviewProcess/studySelection/uploadTypes";
import type {
  PaperWithDecisionsResponse,
  PaperPhase,
} from "../../../types/studySelection";
import PaperPdfActions from "./PaperPdfActions";
import { useReviewerDecisions } from "../../../hooks/useStudySelection";
import { Check, X } from "lucide-react";
import { useReviewerSubmission } from "../../../hooks/useStudySelectionChecklistSubmission";
import { PreviewDocument } from "../../ui/document-editor/PreviewDocument";
import LoadingSpinner from "../../../components/ui/LoadingSpinner";
import { getInitials } from "../../../utils/getInitials";

interface PaperRowProps {
  paper: PaperResponse;
  isSelected: boolean;
  onSelect: (id: string) => void;
  // Functionality props for Detail Modal
  onUploadPdf?: (
    paperId: string,
    file: File,
    options?: UploadPdfOptions,
  ) => Promise<PaperWithDecisionsResponse>;
  isUploadingPdf?: boolean;
  onApplyMetadataSuggestion?: (
    paperId: string,
    sourceMetadataId: string,
    fields: string[],
  ) => Promise<void>;
  isApplyingMetadataSuggestion?: boolean;
  onRemovePdf?: (paperId: string) => Promise<void>;
  isRemovingPdf?: boolean;
  onRetryExtraction?: (paperId: string) => Promise<void>;
  isRetryingExtraction?: boolean;
  onResolveConflict?: (
    paperId: string,
    decision: ScreeningDecision,
    notes?: string,
  ) => void;
  isResolving?: boolean;
  isSubmitting?: boolean;
  studySelectionProcessId?: string;
  showPdfActions?: boolean;
  pdfRequired?: boolean;
  selectionMode?: "quick" | "assignment";
  phase?: PaperPhase;
}

export const PaperRow: React.FC<PaperRowProps> = ({
  paper,
  isSelected,
  onSelect,
  onUploadPdf,
  isUploadingPdf,
  onApplyMetadataSuggestion,
  isApplyingMetadataSuggestion,
  onRemovePdf,
  isRemovingPdf,
  onRetryExtraction,
  isRetryingExtraction,
  onResolveConflict,
  isResolving,
  isSubmitting,
  studySelectionProcessId,
  showPdfActions = false,
  pdfRequired = false,
  selectionMode = "assignment",
  phase = 0,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
  const [submissionParams, setSubmissionParams] = useState<{
    processId: string;
    paperId: string;
    reviewerId: string;
    phase: number;
  } | null>(null);

  const { data: submissionResponse, isLoading: isLoadingSubmission } =
    useReviewerSubmission(submissionParams);

  const submission = submissionResponse?.data;

  const { data: reviewerDecisions, isLoading: isLoadingReviewers } =
    useReviewerDecisions(studySelectionProcessId, paper.id, phase);

  const reviewers = paper.assignedReviewers || [];

  return (
    <tr
      className={`hover:bg-bg-primary transition-colors group cursor-default ${paper.assignmentStatusText === "Assigned" ? "bg-bg-primary/50" : ""}`}
    >
      <td className="px-6 py-4 whitespace-nowrap">
        <input
          type="checkbox"
          checked={isSelected}
          disabled={
            !!(
              paper.assignmentStatusText === "Assigned" ||
              (paper.decidedStatus && paper.decidedStatus !== "None") ||
              (selectionMode === "assignment" && pdfRequired && !paper.pdfUrl)
            )
          }
          onChange={() => onSelect(paper.id)}
          title={
            paper.decidedStatus && paper.decidedStatus !== "None"
              ? "This paper already has a final decision"
              : paper.assignmentStatusText === "Assigned"
                ? "This paper is already assigned"
                : selectionMode === "assignment" && pdfRequired && !paper.pdfUrl
                  ? "PDF is required for assignment in Full-Text phase"
                  : "Select paper"
          }
          className={`w-4 h-4 text-accent border-border rounded focus:ring-accent ${
            paper.assignmentStatusText === "Assigned" ||
              (paper.decidedStatus && paper.decidedStatus !== "None") ||
              (selectionMode === "assignment" && pdfRequired && !paper.pdfUrl)
              ? "cursor-not-allowed opacity-50"
              : "cursor-pointer"
          }`}
        />
      </td>
      <td className="px-6 py-4">
        <div className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors line-clamp-2 max-w-md">
          {paper.title}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-text-secondary line-clamp-1 max-w-[200px]">
          {paper.authors}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-xs text-accent hover:underline cursor-pointer">
        {paper.doi}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
        {paper.publicationYear || paper.publicationYearInt || "N/A"}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">{paper.source}</td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`px-2 py-1 text-xs font-semibold rounded-full border ${
            paper.assignmentStatusText === "Assigned"
              ? "bg-primary-light text-accent border-primary/20"
              : "bg-bg-primary text-text-secondary border-border"
          }`}
        >
          {paper.assignmentStatusText || "Unassigned"}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {paper.decidedStatus && paper.decidedStatus !== "None" ? (
          <span
            className={`px-2 py-1 text-xs font-semibold rounded-full border ${
              paper.decidedStatus.toLowerCase() === "include"
                ? "bg-success/10 text-success border-success/20"
                : paper.decidedStatus.toLowerCase() === "exclude"
                  ? "bg-error/10 text-error border-error/20"
                  : "bg-bg-primary text-text-primary border-border"
            }`}
          >
            {paper.decidedStatus}
          </span>
        ) : (
          <span className="text-xs text-text-secondary italic">None</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-3">
          {showPdfActions && (
            <div className="flex items-center border-r border-border pr-3 mr-1">
              <PaperPdfActions
                paper={paper}
                onUploadPdf={onUploadPdf}
                isUploadingPdf={isUploadingPdf}
                onApplyMetadataSuggestion={onApplyMetadataSuggestion}
                isApplyingMetadataSuggestion={isApplyingMetadataSuggestion}
                onRemovePdf={onRemovePdf}
                isRemovingPdf={isRemovingPdf}
                pdfRequired={pdfRequired}
                studySelectionProcessId={studySelectionProcessId}
              />
            </div>
          )}

          <button
            onClick={() => setIsDetailDrawerOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-transparent text-text-secondary transition-colors hover:border-primary/30 hover:bg-primary-light hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>

          <div className="flex items-center">
            {reviewers.length > 0 ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsModalOpen(true);
                }}
                className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl border border-border bg-bg-secondary px-3 py-1.5 text-[11px] font-bold text-text-secondary shadow-none transition-colors hover:bg-primary-light hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none group"
              >
                <div className="flex -space-x-2 mr-1">
                  {reviewers.slice(0, 2).map((reviewer, i) => (
                    <div
                      key={i}
                      className="flex h-4 w-4 items-center justify-center rounded-full border border-white bg-bg-secondary text-[8px] font-bold text-text-secondary transition-colors group-hover:bg-primary-hover group-hover:text-white motion-reduce:transition-none"
                    >
                      {getInitials(reviewer.name)}
                    </div>
                  ))}
                </div>
                View ({reviewers.length})
              </button>
            ) : (
              <span className="text-xs text-text-secondary italic">—</span>
            )}
          </div>
        </div>

        {/* Modal for viewing all reviewers */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Assigned Reviewers"
          description={paper.title}
          size="sm"
        >
          <div className="grid grid-cols-1 gap-3">
            {isLoadingReviewers ? (
              <div className="flex items-center justify-center p-8">
                <LoadingSpinner size="md" />
              </div>
            ) : reviewerDecisions && reviewerDecisions.length > 0 ? (
              reviewerDecisions.map((rd, idx) => (
                <div
                  key={idx}
                  className="group flex flex-col gap-2 rounded-xl border border-border bg-bg-secondary p-3 transition-colors hover:border-primary/30 hover:bg-surface-white motion-reduce:transition-none"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-accent font-bold text-xs">
                        {getInitials(rd.reviewerName)}
                      </div>
                      <span className="text-sm font-semibold text-text-primary">
                        {rd.reviewerName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {rd.decision ? (
                        <span
                          className={`px-2 py-1 text-[10px] font-bold rounded-xl border ${
                            rd.decision.decisionText?.toLowerCase() ===
                            "include"
                              ? "bg-success/10 text-success border-success/20"
                              : rd.decision.decisionText?.toLowerCase() ===
                                  "exclude"
                                ? "bg-error/10 text-error border-error/20"
                                : "bg-bg-primary text-text-primary border-border"
                          }`}
                        >
                          {rd.decision.decisionText}
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-text-secondary italic bg-bg-secondary/50 px-2 py-1 rounded-xl">
                          Pending
                        </span>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="!px-3 !py-1 !text-[10px] !rounded-xl border border-border hover:border-primary/30 hover:bg-bg-secondary transition-colors h-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (studySelectionProcessId) {
                            setSubmissionParams({
                              processId: studySelectionProcessId,
                              paperId: paper.id,
                              reviewerId: rd.reviewerId || (rd as any).id,
                              phase: phase,
                            });
                            setIsSubmissionModalOpen(true);
                          }
                        }}
                      >
                        View Submission
                      </Button>
                    </div>
                  </div>

                  {(rd.decision?.exclusionReasonName || rd.decision?.comment || rd.decision?.reason) && (
                      <div className="pl-11 pr-2 pb-1 space-y-1.5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-1 motion-safe:duration-200 motion-reduce:animate-none">
                        {rd.decision.decisionText === "Exclude" && rd.decision.exclusionReasonName && (
                          <div className="w-fit rounded border border-error/20 bg-error/5 px-2 py-0.5 text-[11px] font-bold text-error">
                            {rd.decision.exclusionReasonName}
                          </div>
                        )}
                        {(rd.decision.comment ?? rd.decision.reason) && (
                          <div className="text-[11px] text-text-secondary italic line-clamp-2 leading-relaxed bg-bg-secondary/30 p-1.5 rounded-xl border border-border/50">
                            "{rd.decision.comment ?? rd.decision.reason}"
                          </div>
                        )}
                      </div>
                    )}
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-text-secondary text-sm italic">
                No reviewers assigned
              </div>
            )}
          </div>
        </Modal>

        {/* Submission Details Modal */}
        <Modal
          isOpen={isSubmissionModalOpen}
          onClose={() => {
            setIsSubmissionModalOpen(false);
            setSubmissionParams(null);
          }}
          title="Reviewer Submission"
          description={`Submission by ${reviewerDecisions?.find((rd) => rd.reviewerId === submissionParams?.reviewerId)?.reviewerName || "Reviewer"}`}
          size="xl"
        >
          {isLoadingSubmission ? (
            <div className="flex flex-col items-center justify-center p-20 gap-4" role="status" aria-live="polite" aria-busy="true">
              <LoadingSpinner size="lg" />
              <p className="text-text-secondary motion-safe:animate-pulse motion-reduce:animate-none font-medium">
                Loading submission data...
              </p>
            </div>
          ) : submission ? (
            <div className="bg-bg-secondary/50 p-6 rounded-xl border border-border max-h-[70vh] overflow-y-auto custom-scrollbar">
              <PreviewDocument
                template={submission as any}
                renderItem={(item) => (
                  <div className="flex items-center">
                    {item.isChecked ? (
                      <div className="flex h-5 w-5 items-center justify-center rounded-md border border-success/20 bg-success/10 text-success shadow-none">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-md bg-error/5 border border-error/20 flex items-center justify-center text-error shadow-none">
                        <X className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                )}
                renderSectionTitle={(section) => (
                  <div className="flex items-center">
                    {section.isChecked ? (
                      <div className="w-6 h-6 rounded-lg bg-primary-light border border-primary/20 flex items-center justify-center text-accent shadow-none">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-lg bg-bg-secondary border border-border flex items-center justify-center text-text-secondary shadow-none">
                        <X className="w-4 h-4 stroke-[3]" />
                      </div>
                    )}
                  </div>
                )}
              />
            </div>
          ) : (
            <div className="text-center py-20 text-text-secondary bg-bg-secondary rounded-xl border border-dashed border-border">
              <p className="italic">
                No submission data available for this reviewer.
              </p>
            </div>
          )}
        </Modal>

        {/* Paper Details Modal Wrapper */}
        <PaperViewerModal
          paper={paper}
          isOpen={isDetailDrawerOpen}
          onClose={() => setIsDetailDrawerOpen(false)}
          onUploadPdf={onUploadPdf}
          isUploadingPdf={isUploadingPdf}
          onApplyMetadataSuggestion={onApplyMetadataSuggestion}
          isApplyingMetadataSuggestion={isApplyingMetadataSuggestion}
          onRetryExtraction={onRetryExtraction}
          isRetryingExtraction={isRetryingExtraction}
          onResolveConflict={onResolveConflict}
          isResolving={isResolving}
          isSubmitting={isSubmitting}
          studySelectionProcessId={studySelectionProcessId}
        />
      </td>
    </tr>
  );
};

interface PapersTableProps {
  papers: PaperResponse[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string) => void;
  // Functionality props for Detail Modal
  onUploadPdf?: (
    paperId: string,
    file: File,
    options?: UploadPdfOptions,
  ) => Promise<PaperWithDecisionsResponse>;
  isUploadingPdf?: boolean;
  onApplyMetadataSuggestion?: (
    paperId: string,
    sourceMetadataId: string,
    fields: string[],
  ) => Promise<void>;
  isApplyingMetadataSuggestion?: boolean;
  onRemovePdf?: (paperId: string) => Promise<void>;
  isRemovingPdf?: boolean;
  onRetryExtraction?: (paperId: string) => Promise<void>;
  isRetryingExtraction?: boolean;
  onResolveConflict?: (
    paperId: string,
    decision: ScreeningDecision,
    notes?: string,
  ) => void;
  isResolving?: boolean;
  isSubmitting?: boolean;
  studySelectionProcessId?: string;
  showPdfActions?: boolean;
  pdfRequired?: boolean;
  selectionMode?: "quick" | "assignment";
  phase?: PaperPhase;
}
const PapersTable: React.FC<PapersTableProps> = ({
  papers,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onUploadPdf,
  isUploadingPdf,
  onApplyMetadataSuggestion,
  isApplyingMetadataSuggestion,
  onRemovePdf,
  isRemovingPdf,
  onRetryExtraction,
  isRetryingExtraction,
  onResolveConflict,
  isResolving,
  isSubmitting,
  studySelectionProcessId,
  showPdfActions = false,
  pdfRequired = false,
  selectionMode = "assignment",
  phase = 0,
}) => {
  const selectablePapers = papers.filter((p) => {
    const isUnresolved = p.decidedStatus === "None" || !p.decidedStatus;
    const isUnassigned = p.assignmentStatusText !== "Assigned";
    if (selectionMode === "quick") {
      return isUnresolved && isUnassigned;
    }
    const isPdfOk = !pdfRequired || !!p.pdfUrl;
    return isUnassigned && isUnresolved && isPdfOk;
  });
  const allSelected =
    selectablePapers.length > 0 &&
    selectablePapers.every((p) => selectedIds.has(p.id));

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-bg-primary">
          <tr>
            <th scope="col" className="px-6 py-3 text-left">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="w-4 h-4 text-accent border-border rounded focus:ring-accent cursor-pointer"
              />
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider"
            >
              Title
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider"
            >
              Authors
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider"
            >
              DOI
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider"
            >
              Year
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider"
            >
              Source
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider"
            >
              Assignment
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider"
            >
              Decision
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider"
            >
              Actions & Reviewers
            </th>
          </tr>
        </thead>
        <tbody className="bg-surface-white divide-y divide-gray-200">
          {papers.map((paper) => (
            <PaperRow
              key={paper.id}
              paper={paper as any}
              isSelected={selectedIds.has(paper.id)}
              onSelect={onSelectRow}
              onUploadPdf={onUploadPdf}
              isUploadingPdf={isUploadingPdf}
              onApplyMetadataSuggestion={onApplyMetadataSuggestion}
              isApplyingMetadataSuggestion={isApplyingMetadataSuggestion}
              onRemovePdf={onRemovePdf}
              isRemovingPdf={isRemovingPdf}
              onRetryExtraction={onRetryExtraction}
              isRetryingExtraction={isRetryingExtraction}
              onResolveConflict={onResolveConflict}
              isResolving={isResolving}
              isSubmitting={isSubmitting}
              studySelectionProcessId={studySelectionProcessId}
              showPdfActions={showPdfActions}
              pdfRequired={pdfRequired}
              selectionMode={selectionMode}
              phase={phase}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PapersTable;
