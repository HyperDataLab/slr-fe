import React, { useState, useMemo } from "react";
import { UserPlus, Search, X, Loader2, ChevronDown, Info } from "lucide-react";
import { useParams } from "react-router-dom";
import Button from "../../ui/Button";
import { Dropdown } from "../../ui/Dropdown";
import { useProjectMembers } from "../../../hooks/useProjects";
import { ProjectRole } from "../../../types/project";
import { toastSuccess, toastError } from "../../../utils/toast";
import { useAssignPapers } from "../../../hooks/useProjectPapers";
import LoadingSpinner from "../../../components/ui/LoadingSpinner";
import { getInitials } from "../../../utils/getInitials";

interface ThirdReviewerAssignmentProps {
  paperId: string;
  studySelectionProcessId: string;
  phase: number;
  existingReviewersId: string[];
  onCancel: () => void;
  onAssignmentComplete: () => void;
}

const ThirdReviewerAssignment: React.FC<ThirdReviewerAssignmentProps> = ({
  paperId,
  studySelectionProcessId,
  phase,
  existingReviewersId,
  onCancel,
  onAssignmentComplete,
}) => {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReviewers, setSelectedReviewers] = useState<
    { id: string; name: string }[]
  >([]);
  const { mutate: assignPapers, isPending: isAssigning } = useAssignPapers();

  // Fetch project members
  const { members, isLoading } = useProjectMembers(projectId || "", {
    search: searchQuery,
    pageSize: 100,
  });
  // Filter out leaders and existing reviewers
  const availableReviewers = useMemo(() => {
    return members.filter((m) => {
      const role = String(m.roleText ?? m.role).trim().toUpperCase();
      const isAdmin = ["ADMIN", "OWNER", "1"].includes(role);
      const isReviewer =
        (m.role === ProjectRole.Reviewer || role === "REVIEWER") && !isAdmin;
      const alreadyReviewed = existingReviewersId.some((id) => {
        if (!id) return false;
        const normalizedId = String(id).trim().toLowerCase();
        return (
          normalizedId === m.userId?.toLowerCase() ||
          normalizedId === m.userName?.toLowerCase() ||
          normalizedId === m.fullName?.toLowerCase()
        );
      });
      return isReviewer && !alreadyReviewed;
    });
  }, [members, existingReviewersId]);

  const toggleReviewer = (member: { userId: string; fullName: string }) => {
    setSelectedReviewers((prev) => {
      const exists = prev.find((r) => r.id === member.userId);
      if (exists) {
        return prev.filter((r) => r.id !== member.userId);
      } else {
        return [...prev, { id: member.userId, name: member.fullName }];
      }
    });
  };

  const handleAssign = () => {
    if (selectedReviewers.length === 0) return;

    assignPapers(
      {
        paperIds: [paperId],
        memberIds: selectedReviewers.map((r) => r.id),
        studySelectionProcessId,
        // PaperPhase uses 0/1 in the FE; the assignment API uses 1/2.
        phase: phase + 1,
      },
      {
        onSuccess: (response) => {
          if (response.isSuccess) {
            toastSuccess(
              "Reviewers Assigned",
              `${selectedReviewers.length} reviewer(s) have been assigned to this paper.`,
            );
            onAssignmentComplete();
          } else {
            toastError(
              "Assignment Failed",
              response.message || "Could not assign reviewers.",
            );
          }
        },
        onError: (err: any) => {
          toastError(
            "Error",
            err?.response?.data?.message ||
              "An unexpected error occurred during assignment.",
          );
        },
      },
    );
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-surface-white p-4 motion-safe:animate-in motion-safe:slide-in-from-right-full motion-safe:duration-200 motion-reduce:animate-none sm:p-6">
      <div className="mb-4 flex items-center justify-between sm:mb-6">
        <div>
          <h3 className="text-sm font-black uppercase tracking-tight text-text-primary flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-accent" />
            Assign Reviewers
          </h3>
          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mt-1">
            To resolve consensus conflict
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel reviewer assignment"
          className="rounded-xl p-2 text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="no-scrollbar flex-1 space-y-5 overflow-y-auto pb-4 sm:space-y-6 sm:pb-6">
        {/* Warning/Info Box */}
        <div className="bg-primary-light/50 border border-primary/20 rounded-xl p-4 flex gap-3">
          <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <p className="text-[11px] font-medium leading-relaxed text-accent">
            Selected reviewers will provide independent decisions to break the
            deadlock for this paper.
          </p>
        </div>

        {/* Reviewer Selection */}
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase text-text-secondary tracking-[0.15em] block ml-1">
            Select Reviewers ({selectedReviewers.length})
          </label>
          <Dropdown
            trigger={
              <button type="button" className="group flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border bg-bg-secondary px-3 py-2.5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98] motion-reduce:active:scale-100 motion-reduce:transition-none sm:px-4">
                <div className="flex items-center gap-3 overflow-hidden">
                  {selectedReviewers.length > 0 ? (
                    <div className="flex -space-x-2">
                      {selectedReviewers.slice(0, 3).map((r) => (
                        <div
                          key={r.id}
                          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface-white bg-primary text-[11px] font-bold text-white"
                        >
                          {getInitials(r.name)}
                        </div>
                      ))}
                      {selectedReviewers.length > 3 && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface-white bg-bg-secondary text-[9px] font-bold text-text-secondary">
                          +{selectedReviewers.length - 3}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-secondary text-text-secondary transition-colors group-hover:bg-border">
                      <Search className="w-4 h-4" />
                    </div>
                  )}
                  <div className="text-left truncate">
                    <div
                      className={`text-xs font-bold ${selectedReviewers.length > 0 ? "text-text-primary" : "text-text-secondary"}`}
                    >
                      {selectedReviewers.length > 0
                        ? selectedReviewers.map((r) => r.name).join(", ")
                        : "Choose reviewers..."}
                    </div>
                    {selectedReviewers.length > 0 && (
                      <div className="text-[9px] text-accent font-bold uppercase tracking-widest">
                        {selectedReviewers.length} reviewer(s) selected
                      </div>
                    )}
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-text-secondary transition-colors group-hover:text-accent" />
              </button>
            }
            className="w-full"
            contentClassName="bg-surface-white shadow-2xl ring-0 w-full mt-2 rounded-xl border border-border overflow-hidden"
          >
            <div className="w-full">
              <div className="border-b border-border bg-bg-secondary/50 p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="min-h-11 w-full rounded-xl border border-border bg-surface-white py-2 pl-9 pr-4 text-xs font-medium text-text-primary transition-[border-color,box-shadow] placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 motion-reduce:transition-none"
                  />
                </div>
              </div>

              <div className="dropdown-scroll-area max-h-52 overflow-y-auto p-1 custom-scrollbar">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : availableReviewers.length > 0 ? (
                  availableReviewers.map((member) => {
                    const isSelected = selectedReviewers.some(
                      (r) => r.id === member.userId,
                    );
                    return (
                      <button
                        key={member.userId}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => toggleReviewer(member)}
                        className={`group flex min-h-11 w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 motion-reduce:transition-none ${
                          isSelected ? "bg-primary-light" : "hover:bg-bg-secondary"
                        }`}
                      >
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold transition-colors motion-reduce:transition-none ${
                            isSelected
                              ? "bg-primary text-white"
                              : "bg-bg-secondary text-text-secondary group-hover:bg-primary-hover group-hover:text-white"
                          }`}
                        >
                          {getInitials(member.fullName)}
                        </div>
                        <div className="flex-1">
                          <div
                            className={`text-xs font-bold ${isSelected ? "text-accent" : "text-text-primary group-hover:text-text-primary"}`}
                          >
                            {member.fullName}
                          </div>
                          <div className="text-[9px] text-text-secondary font-bold uppercase tracking-widest">
                            {member.email?.split("@")[0]}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="bg-primary rounded-full p-0.5">
                            <X className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="p-6 text-center text-[10px] font-bold text-text-secondary uppercase tracking-widest leading-loose">
                    No eligible reviewers found
                  </div>
                )}
              </div>
            </div>
          </Dropdown>
        </div>
      </div>

      <div className="mt-auto space-y-3 border-t border-border bg-surface-white pt-4 sm:pt-6">
        <Button
          onClick={handleAssign}
          disabled={selectedReviewers.length === 0 || isAssigning}
          aria-busy={isAssigning}
          className="min-h-11 w-full rounded-xl px-4 py-2.5 text-xs font-semibold normal-case tracking-normal shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98] motion-reduce:active:scale-100 motion-reduce:transition-none disabled:border-border disabled:bg-bg-secondary disabled:text-text-secondary"
        >
          {isAssigning ? (
            <Loader2 aria-hidden="true" className="w-4 h-4 motion-safe:animate-spin motion-reduce:animate-none" />
          ) : (
            <UserPlus className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          )}
          {isAssigning
            ? "Processing..."
            : `Assign ${selectedReviewers.length} Reviewer${selectedReviewers.length !== 1 ? "s" : ""}`}
        </Button>
        <p className="text-[9px] text-center font-bold text-text-secondary uppercase tracking-[0.15em]">
          Automated notifications will be sent
        </p>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default ThirdReviewerAssignment;
