import React, { useEffect, useRef, useState, useMemo } from "react";
import { useParams } from "react-router";
import gsap from "gsap";
import {
  Users,
  UserPlus,
  CheckCircle2,
  Search,
  X,
  ChevronDown,
  Loader2,
} from "lucide-react";
import Button from "../../ui/Button";
import { Dropdown } from "../../ui/Dropdown";
import { useProjectMembers } from "../../../hooks/useProjects";
import { useDebounce } from "../../../hooks/useDebounce";
import { ProjectRole, type ProjectMember } from "../../../types/project";
import { toastSuccess, toastError } from "../../../utils/toast";
import { getInitials } from "../../../utils/getInitials";
import type { UseDataExtractionWorkspaceReturn } from "../../../pages/reviewProcess/dataExtraction/types";

interface BulkAssignmentPanelDataExtractionProps {
  selectedPaperIds: string[];
  onAssignmentComplete: () => void;
  ws: UseDataExtractionWorkspaceReturn;
}

const BulkAssignmentPanelDataExtraction: React.FC<
  BulkAssignmentPanelDataExtractionProps
> = ({ selectedPaperIds, onAssignmentComplete, ws }) => {
  const selectedCount = selectedPaperIds.length;
  const panelRef = useRef<HTMLDivElement>(null);
  const { projectId } = useParams<{ projectId: string }>();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { members, isLoading } = useProjectMembers(projectId, {
    search: debouncedSearch,
    pageSize: 100,
  });

  const reviewers = useMemo(
    () =>
      members.filter((m) => {
        const role = String(m.roleText ?? m.role).trim().toUpperCase();
        return m.role === ProjectRole.Reviewer || ["REVIEWER", "3"].includes(role);
      }),
    [members],
  );

  const [selectedReviewers, setSelectedReviewers] = useState<
    Map<string, string>
  >(new Map());
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(panelRef.current, {
        y: selectedCount > 0 ? 0 : 100,
        opacity: selectedCount > 0 ? 1 : 0,
      });
      return;
    }

    if (selectedCount > 0) {
      gsap.to(panelRef.current, {
        y: 0,
        opacity: 1,
        duration: 0.2,
        ease: "power2.out",
      });
    } else {
      gsap.to(panelRef.current, {
        y: 100,
        opacity: 0,
        duration: 0.3,
        ease: "power3.in",
      });
      setSearchQuery("");
    }
  }, [selectedCount]);

  const toggleReviewer = (member: ProjectMember) => {
    const newSelected = new Map(selectedReviewers);
    if (newSelected.has(member.userId)) {
      newSelected.delete(member.userId);
    } else {
      if (newSelected.size >= 2) {
        toastError(
          "Selection Limit",
          "You can only assign exactly 2 reviewers.",
        );
        return;
      }
      newSelected.set(member.userId, member.fullName);
    }
    setSelectedReviewers(newSelected);
  };

  const removeReviewer = (id: string) => {
    const newSelected = new Map(selectedReviewers);
    newSelected.delete(id);
    setSelectedReviewers(newSelected);
  };

  const handleAssign = async () => {
    const reviewerIds = Array.from(selectedReviewers.keys());

    if (reviewerIds.length !== 2) {
      toastError(
        "Selection Error",
        "Please select exactly 2 reviewers for each paper.",
      );
      return;
    }

    if (selectedPaperIds.length === 0) return;

    setIsPending(true);

    try {
      // Call the single-paper backend endpoint repeatedly (in parallel using Promise.allSettled for per-paper tracking)
      const results = await Promise.allSettled(
        selectedPaperIds.map((paperId) =>
          ws.assignPaper(paperId, {
            reviewerIds: [reviewerIds[0], reviewerIds[1]],
            templateId: ws.selectedTemplateId,
          }),
        ),
      );

      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      if (failed === 0) {
        // All succeeded
        toastSuccess(
          "All Papers Assigned",
          `${selectedPaperIds.length} papers assigned successfully to reviewers.`,
        );
        setSelectedReviewers(new Map());
        onAssignmentComplete();
      } else if (successful === 0) {
        // All failed
        toastError(
          "Assignment Failed",
          `Failed to assign all ${selectedPaperIds.length} papers. Please try again.`,
        );
      } else {
        // Partial success
        toastSuccess(
          "Partial Assignment",
          `Assigned ${successful}/${selectedPaperIds.length} papers. ${failed} failed—you can retry those separately.`,
        );
        // Clear selection and complete the successful ones
        setSelectedReviewers(new Map());
        onAssignmentComplete();
      }
    } catch {
      toastError(
        "Assignment Error",
        "An unexpected error occurred during assignment.",
      );
    } finally {
      setIsPending(false);
    }
  };

  const selectedEntries = Array.from(selectedReviewers.entries());
  const visibleChips = selectedEntries.slice(0, 2);
  const remainingCount = selectedEntries.length - visibleChips.length;

  if (selectedCount === 0) return null;

  return (
    <div
      ref={panelRef}
      className="fixed bottom-5 left-1/2 z-(--z-index-dropdown) w-full max-w-5xl -translate-x-1/2 px-3 opacity-0 translate-y-[100px] sm:px-4"
    >
      <div className="relative overflow-visible rounded-2xl border border-border bg-surface-white/95 p-3 text-text-primary shadow-[0_12px_36px_rgba(15,23,42,0.14)] backdrop-blur-md sm:p-4">
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/5 blur-3xl"></div>

        <div className="relative flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-sm ring-4 ring-primary/10">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                Bulk Action
              </div>
              <div className="flex items-center gap-1.5 text-base font-semibold tabular-nums">
                <span>{selectedCount}</span>
                <span className="text-[11px] font-medium uppercase text-text-secondary">
                  Papers
                </span>
              </div>
            </div>
          </div>

          <div className="hidden h-12 w-px bg-border md:block"></div>

          <div className="flex-1 w-full min-w-0">
            <label className="mb-1 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-secondary">
              <span>Assign to Reviewers</span>
              <span
                className={`rounded-full px-2 py-1 text-[9px] tracking-normal ${selectedReviewers.size === 2 ? "bg-primary-light text-accent" : "bg-warning/10 text-warning"}`}
              >
                Require 2 Reviewers
              </span>
            </label>

            <div className="flex items-center gap-2">
              <Dropdown
                trigger={
                  <button type="button" className="flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-bg-secondary px-3 text-xs font-semibold text-text-primary transition-colors hover:border-primary hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                    <UserPlus className="w-4 h-4" />
                    Select Reviewers
                    <ChevronDown className="ml-1 h-3.5 w-3.5 text-text-secondary" />
                  </button>
                }
                className="w-auto"
                position="top"
                contentClassName="bg-transparent shadow-none ring-0 w-auto p-0"
              >
                <div className="w-72 overflow-hidden rounded-xl border border-border bg-surface-white shadow-2xl">
                  <div className="border-b border-border bg-bg-secondary p-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search reviewers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="min-h-11 w-full rounded-xl border border-border bg-surface-white py-2 pl-9 pr-4 text-xs text-text-primary outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-2 focus:ring-primary/20 motion-reduce:transition-none"
                      />
                    </div>
                  </div>

                  <div className="dropdown-scroll-area max-h-60 overflow-y-auto p-2 custom-scrollbar min-h-[100px] relative">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-10 text-text-secondary">
                        <Loader2 aria-hidden="true" className="w-5 h-5 motion-safe:animate-spin motion-reduce:animate-none mr-2" />
                        <span className="text-xs font-medium">
                          Fetching Team...
                        </span>
                      </div>
                    ) : reviewers.length > 0 ? (
                      reviewers.map((member) => (
                        <label
                          key={member.userId}
                          className="group flex cursor-pointer items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-bg-secondary"
                        >
                          <input
                            type="checkbox"
                            checked={selectedReviewers.has(member.userId)}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleReviewer(member);
                            }}
                            className="h-4 w-4 rounded border-border bg-surface-white text-accent focus:ring-accent"
                          />
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-light text-[10px] font-bold text-accent transition-colors group-hover:bg-primary group-hover:text-white">
                              {getInitials(member.fullName)}
                            </div>
                            <span className="text-xs font-medium text-text-primary transition-colors group-hover:text-accent">
                              {member.fullName}
                            </span>
                          </div>
                        </label>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-text-secondary italic">
                        No team members found
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-border bg-bg-secondary p-3">
                    <span className="text-[10px] font-bold uppercase tabular-nums text-text-secondary">
                      {selectedReviewers.size} Selected
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReviewers(new Map());
                      }}
                      className="inline-flex min-h-11 items-center rounded-lg px-2 text-[10px] font-bold uppercase text-accent transition-colors hover:bg-surface-white hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              </Dropdown>

              <div className="flex flex-1 items-center gap-2 overflow-hidden min-w-0">
                <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto no-scrollbar py-1">
                  {visibleChips.map(([id, name]) => (
                    <div
                      key={id}
                      className="flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-bg-secondary px-2 py-1 text-xs text-text-primary motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-200 motion-reduce:animate-none"
                    >
                      <Users className="h-3 w-3 text-accent" />
                      {name}
                      <button
                        type="button"
                        onClick={() => removeReviewer(id)}
                        aria-label={`Remove ${name}`}
                        title={`Remove ${name}`}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-border hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  {remainingCount > 0 && (
                    <div className="group relative cursor-help whitespace-nowrap rounded-xl border border-border border-dashed bg-bg-secondary px-2 py-1 text-[10px] font-bold text-accent">
                      +{remainingCount} more
                      <div className="absolute bottom-full left-1/2 z-(--z-index-popover) mb-2 hidden w-48 -translate-x-1/2 rounded-xl border border-border bg-surface-white p-3 shadow-xl motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-reduce:animate-none group-hover:block">
                        <div className="mb-2 border-b border-border pb-1 text-[10px] font-black uppercase tracking-widest text-text-secondary">
                          Also Assigned To
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {selectedEntries.slice(2).map(([id, name]) => (
                            <div
                              key={id}
                              className="flex items-center gap-2 text-xs text-text-primary"
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                              {name}
                            </div>
                          ))}
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-surface-white"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-stretch md:items-end">
            <Button
              onClick={handleAssign}
              disabled={selectedReviewers.size !== 2 || isPending}
              aria-busy={isPending}
              className="min-h-11 w-full rounded-xl px-4 py-2.5 text-xs font-semibold normal-case tracking-normal shadow-none transition-transform active:scale-[0.98] motion-reduce:transition-none disabled:border-border disabled:bg-bg-secondary disabled:text-text-secondary sm:w-auto"
            >
              {isPending ? (
                <Loader2 aria-hidden="true" className="w-4 h-4 motion-safe:animate-spin motion-reduce:animate-none" />
              ) : (
                <CheckCircle2
                  className={`w-4 h-4 transition-transform ${selectedReviewers.size > 0 ? "scale-100" : "scale-0"}`}
                />
              )}
              {isPending ? "Assigning..." : "Assign Selected"}
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default BulkAssignmentPanelDataExtraction;
