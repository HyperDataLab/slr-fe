import { useState } from "react";
import Modal from "../../../../components/ui/Modal";
import Button from "../../../../components/ui/Button";
import { FiSearch, FiUserPlus, FiUsers } from "react-icons/fi";
import { cn } from "../../../../utils/cn";
import type { ProjectMember } from "../../../../types/project";
import { getInitials } from "../../../../utils/getInitials";

interface QAAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (userIds: string[]) => void;
  members: ProjectMember[];
  assignedUserIds?: string[];
  isAssigning: boolean;
  hasResolution?: boolean;
}

export function QAAssignModal({
  isOpen,
  onClose,
  onAssign,
  members,
  assignedUserIds = [],
  isAssigning,
  hasResolution = false,
}: QAAssignModalProps) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const handleCloseModal = () => {
    setSelectedUserIds([]);
    setSearchTerm("");
    onClose();
  };

  const filteredMembers = members.filter(
    (m) =>
      (m.fullName || m.userName || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      m.userId.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) => {
      if (prev.includes(userId) || hasResolution) {
        return prev.filter((id) => id !== userId);
      }

      if (assignedUserIds.length + prev.length >= 2) {
        return prev;
      }

      return [...prev, userId];
    });
  };

  const handleAssign = () => {
    onAssign(selectedUserIds);
    setSelectedUserIds([]); // reset on successful trigger
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCloseModal}
      title="Assign Quality Reviewers"
      description="Select team members to evaluate quality of the paper."
      size="lg"
      closeOnOutsideClick={true}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-secondary px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <FiUsers size={16} aria-hidden="true" />
            Members
          </h3>

          <div className="px-4 text-xs font-semibold text-text-secondary">
            <span
              className={
                assignedUserIds.length + selectedUserIds.length >= 2
                  ? "text-error"
                  : "text-text-primary"
              }
            >
              {assignedUserIds.length + selectedUserIds.length} / 2
            </span>{" "}
            Reviewers
          </div>
        </div>

        {hasResolution && (
          <div className="rounded-xl border border-warning/20 bg-warning/10 p-4">
            <p className="text-sm font-medium text-center text-warning">
              This paper has already been resolved. You cannot change reviewer
              assignments.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {/* Member Search */}
          <div className="relative group max-w-md">
            <FiSearch
              className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-accent transition-colors"
              size={16}
            />
            <input
              type="search"
              aria-label="Search team members"
              placeholder="Search team members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-border bg-surface-white py-2.5 pl-11 pr-4 text-sm text-text-primary outline-none transition-colors placeholder:text-text-secondary focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="dropdown-scroll-area max-h-[400px] space-y-2 overflow-y-auto pr-1">
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member) => {
                const isAlreadyAssigned = assignedUserIds.includes(
                  member.userId,
                );
                const isSelected = selectedUserIds.includes(member.userId);
                const isMaxReached =
                  assignedUserIds.length + selectedUserIds.length >= 2;
                const isDisabled =
                  isAlreadyAssigned ||
                  (isMaxReached && !isSelected) ||
                  hasResolution;
                const displayName =
                  member.fullName || member.userName || member.email || "Team member";
                const initials = getInitials(displayName);

                return (
                  <label
                    key={member.userId}
                    className={cn(
                      "group relative flex min-h-16 items-center gap-3 rounded-xl border px-3 py-3 transition-colors",
                      isDisabled
                        ? "cursor-not-allowed border-border bg-bg-secondary opacity-70"
                        : "cursor-pointer border-border bg-surface-white hover:border-accent/50 hover:bg-bg-selected",
                      isSelected && !isAlreadyAssigned
                        ? "border-accent bg-bg-selected"
                        : "",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold",
                        isSelected || isAlreadyAssigned
                          ? "bg-primary text-white"
                          : "bg-bg-secondary text-text-secondary",
                      )}
                    >
                      {initials}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="mb-0.5 flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-semibold text-text-primary">
                          {displayName}
                        </span>
                        {isAlreadyAssigned && (
                          <span className="shrink-0 rounded-md border border-border bg-bg-secondary px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                            Assigned
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-text-secondary">
                        {member.email}
                      </div>
                    </div>

                    <div className="ml-2 flex min-h-11 min-w-11 items-center justify-center border-l border-border pl-3">
                      <input
                        type="checkbox"
                        checked={isSelected || isAlreadyAssigned}
                        disabled={isDisabled}
                        onChange={() => toggleUserSelection(member.userId)}
                        aria-label={`Assign ${displayName}`}
                        className="h-5 w-5 cursor-pointer rounded border-border text-accent focus:ring-accent/30 disabled:cursor-not-allowed"
                      />
                    </div>
                  </label>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-4 py-10 text-center">
                <FiUserPlus size={28} aria-hidden="true" className="mb-3 text-text-secondary" />
                <p className="text-sm font-semibold text-text-primary">
                  {searchTerm ? "No matches found" : "No members available"}
                </p>
                {searchTerm && (
                  <p className="mt-1 text-sm text-text-secondary">
                    Try another name or user ID.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="flex items-center gap-3">
            {selectedUserIds.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-bg-secondary rounded-xl border border-accent/30">
                <p className="text-[10px] font-black text-accent uppercase tracking-wider">
                  {selectedUserIds.length} Selected
                </p>
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" size="md" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={
                selectedUserIds.length === 0 || isAssigning || hasResolution
              }
              aria-busy={isAssigning || undefined}
              variant="primary"
              size="md"
            >
              {isAssigning
                ? "Assigning..."
                : hasResolution
                  ? "Paper Resolved"
                  : "Assign Members"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
