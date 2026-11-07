import { useState, useMemo, useEffect } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../redux/store";
import Modal from "../../ui/Modal";
import {
  FiUsers,
  FiUserPlus,
  FiSend,
  FiSearch,
  FiTrash2,
  FiMail,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiRepeat,
} from "react-icons/fi";
import { cn } from "../../../utils/cn";
import { formatDate } from "../../../utils/dateFormat";
import Tooltip from "../../ui/Tooltip";
import LoadingSpinner from "../../ui/LoadingSpinner";
import ConfirmModal from "../../ui/ConfirmModal";
import { toastSuccess, toastError, toastInfo } from "../../../utils/toast";

// Hooks & Services
import {
  useProjectMembers,
  useProjectInvitations,
  useSendInvitations,
  useUpdateProjectMemberRole,
  useRemoveProjectMember,
  useProject,
} from "../../../hooks/useProjects";
import { useUserSearch, useUsers } from "../../../hooks/useUsers";
import { useDebounce } from "../../../hooks/useDebounce";

// Types & Utils
import {
  ProjectRole,
  InvitationStatus,
  getProjectRoleLabel,
  type UserSearchResult,
} from "../../../types/project";
import { resolveProjectLeader } from "../../../utils/projectUtils";
import { getInitials } from "../../../utils/getInitials";

// Reusable Sub-components from add-people directory
import ProjectLeaderStatus from "./add-people/ProjectLeaderStatus";
import UserSearchSection from "./add-people/UserSearchSection";
import InvitationWaitlist from "./add-people/InvitationWaitlist";
import RoleAssignmentPanel from "./add-people/RoleAssignmentPanel";
import ReplaceLeaderConfirm from "./add-people/ReplaceLeaderConfirm";
import SentInvitations from "./add-people/SentInvitations";

interface ProjectMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  projectName?: string;
  hideLeaderRole?: boolean; // Prop to hide Leader role management (for project leaders)
}

interface User {
  id: string;
  fullName: string;
  userName: string;
  email: string;
  status: "available" | "added" | "invited";
}

const mapSearchResultToUser = (result: UserSearchResult): User => ({
  id: result.id,
  fullName: result.fullName,
  userName: result.username,
  email: result.email,
  status: result.isAlreadyMember ? "added" : "available",
});

export default function ProjectMembersModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  hideLeaderRole = false,
}: ProjectMembersModalProps) {
  const [activeTab, setActiveTab] = useState<
    "collaboration" | "add" | "invites"
  >("collaboration");
  const [memberSearchTerm, setMemberSearchTerm] = useState("");
  const debouncedMemberSearch = useDebounce(memberSearchTerm, 400);
  const [memberPageNumber, setMemberPageNumber] = useState(1);
  const [memberPageSize] = useState(10);

  const [inviteSearchTerm, setInviteSearchTerm] = useState("");
  const debouncedInviteSearch = useDebounce(inviteSearchTerm, 400);
  const [addMemberPageNumber, setAddMemberPageNumber] = useState(1);
  const [addMemberPageSize] = useState(10);

  const { user: currentUser } = useSelector((state: RootState) => state.auth);
  const { project } = useProject(isOpen ? projectId : undefined);

  // Check permission: Global Admin or Project Leader
  const isGlobalAdmin = currentUser?.role === "Admin";
  const isProjectLeader =
    project?.isLeader || project?.role === ProjectRole.Leader;
  const canManageMembers = isGlobalAdmin || isProjectLeader;

  // 1. Data Fetching
  const {
    members,
    data: membersPaginatedData,
    isLoading: isLoadingMembers,
    error: membersError,
    refetch: refetchMembers,
  } = useProjectMembers(isOpen ? projectId : undefined, {
    search: debouncedMemberSearch,
    pageNumber: memberPageNumber,
    pageSize: memberPageSize,
  });

  const {
    invitations,
    refetch: refetchInvitations,
  } = useProjectInvitations(projectId, undefined, { enabled: isOpen });

  // Search API Hook for Adding People (Old search function)
  const { users: searchResults, isLoading: isSearchingByKeyword } =
    useUserSearch(
      debouncedInviteSearch,
      projectId,
      activeTab === "add" && debouncedInviteSearch.length >= 2,
    );

  // Load a candidate pool while the invite tab is idle. Leaders see only eligible
  // suggestions; admins retain their browsable directory and pagination.
  const {
    users: adminListUsers,
    data: adminListData,
    isLoading: isLoadingAdminList,
  } = useUsers(
    activeTab === "add" && !debouncedInviteSearch
      ? {
          isActive: true,
          pageNumber: addMemberPageNumber,
          pageSize: isGlobalAdmin ? addMemberPageSize : 50,
        }
      : undefined,
    activeTab === "add" && !debouncedInviteSearch,
  );

  const isSearching = isSearchingByKeyword || isLoadingAdminList;

  // 2. Invitation Flow State
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [assignedRoles, setAssignedRoles] = useState<Record<string, "Reviewer">>({});
  const [userCache, setUserCache] = useState<Record<string, User>>({});
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [pendingLeader, setPendingLeader] = useState<{ userId: string; fullName: string } | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<{ userId: string; fullName: string } | null>(null);

  const { sendInvitations, isSending: isSendingInvitations } =
    useSendInvitations(projectId);
  const { updateMemberRole, isUpdating: isUpdatingMemberRole } =
    useUpdateProjectMemberRole(projectId);
  const { removeMember, isRemoving: isRemovingMember } =
    useRemoveProjectMember(projectId);

  // 3. Derived State
  const users = useMemo(() => {
    // Show a few active, eligible people by default for project leaders.
    if (!debouncedInviteSearch) {
      const candidates = adminListUsers
        .filter((u) => String(u.role).toUpperCase() !== "ADMIN" && u.isActive !== false)
        .map((u) => {
          const isMember = members.some((m) => m.userId === u.id);
          const hasPendingInvite = invitations?.some(
            (inv) =>
              inv.invitedUserId === u.id &&
              inv.status === InvitationStatus.Pending,
          );
          return {
            id: u.id,
            fullName: u.fullName,
            userName: u.username,
            email: u.email,
            status: isMember
              ? "added"
              : hasPendingInvite
                ? "invited"
                : "available",
          } as User;
        });

      return isGlobalAdmin
        ? candidates
        : candidates.filter((user) => user.status === "available").slice(0, 6);
    }

    // Otherwise use the search results
    return searchResults
      .filter((result) => String(result.role).toUpperCase() !== "ADMIN" && result.isActive !== false)
      .map((result) => {
        const user = mapSearchResultToUser(result);
        const isMember = members.some((member) => member.userId === result.id);
        const hasPendingInvite = invitations?.some(
          (inv) =>
            inv.invitedUserId === result.id &&
            inv.status === InvitationStatus.Pending,
        );
        if (isMember) user.status = "added";
        else if (hasPendingInvite) user.status = "invited";
        return user;
      });
  }, [
    isGlobalAdmin,
    debouncedInviteSearch,
    adminListUsers,
    searchResults,
    invitations,
    members,
  ]);

  // Update user cache for invitations whenever the list of display users changes
  useEffect(() => {
    if (users.length > 0) {
      const timer = setTimeout(() => {
        setUserCache((prev) => {
          const next = { ...prev };
          let changed = false;
          users.forEach((user) => {
            // Update cache if user is missing or status has changed (e.g. from available to added)
            if (!prev[user.id] || prev[user.id].status !== user.status) {
              next[user.id] = user;
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [users]);

  const currentLeader = useMemo(() => {
    return resolveProjectLeader(members, invitations);
  }, [members, invitations]);

  const effectivelyHideLeaderRole = hideLeaderRole;

  const selectedUser = useMemo(
    () => (selectedUserId ? userCache[selectedUserId] : null),
    [userCache, selectedUserId],
  );

  const waitlistUsers = useMemo(() => {
    return Object.keys(assignedRoles).map((id) => {
      const cachedUser = userCache[id];
      return {
        id,
        fullName: cachedUser?.fullName || "Loading...",
        userName: cachedUser?.userName || "...",
        role: assignedRoles[id],
      };
    });
  }, [assignedRoles, userCache]);

  // 4. Handlers
  const handleSelectUser = (user: User) => {
    if (user.status !== "available") return;
    setSelectedUserId(user.id);
    if (!assignedRoles[user.id]) {
      const role = "Reviewer";
      setAssignedRoles((prev) => ({ ...prev, [user.id]: role }));
    }
  };

  const handleRemoveFromWaitlist = (userId: string) => {
    setAssignedRoles((prev) => {
      const updated = { ...prev };
      delete updated[userId];
      return updated;
    });
    if (selectedUserId === userId) setSelectedUserId(null);
  };

  const handleSelectFromWaitlist = (userId: string) => {
    setSelectedUserId(userId);
  };

  const handleExistingMemberRoleChange = async (
    userId: string,
    role: "OWNER" | "REVIEWER",
  ) => {
    if (role === "OWNER") {
      const target = members.find((member) => member.userId === userId);
      setPendingLeader({ userId, fullName: target?.fullName || "this member" });
      setShowReplaceConfirm(true);
      return;
    }

    try {
      await updateMemberRole({ userId, role });
      toastSuccess("Role updated to Reviewer.");
    } catch (error) {
      toastError(
        error instanceof Error
          ? error.message
          : "Could not update this member's role.",
      );
    }
  };

  const handleSendInvitations = async () => {
    if (!projectId || waitlistUsers.length === 0) return;
    const reviewerIds = waitlistUsers.map((u) => u.id);
    const expiredAt = new Date();
    expiredAt.setDate(expiredAt.getDate() + 7);
    const expiredAtStr = expiredAt.toISOString();

    try {
      await sendInvitations({
        userIds: reviewerIds,
        role: ProjectRole.Reviewer,
        expiredAt: expiredAtStr,
      });
      toastSuccess(`Đã gửi thành công ${waitlistUsers.length} lời mời tham gia!`);
      setAssignedRoles({});
      setSelectedUserId(null);
      setInviteSearchTerm("");
      refetchInvitations();
      refetchMembers();
    } catch (error) {
      toastError(
        error instanceof Error ? error.message : "Không thể gửi một số lời mời.",
      );
    }
  };

  const confirmReplaceLeader = async () => {
    if (!pendingLeader || !projectId) return;
    try {
      await updateMemberRole({ userId: pendingLeader.userId, role: "OWNER" });
      setShowReplaceConfirm(false);
      setPendingLeader(null);
      await refetchMembers();
      toastSuccess("Đã chuyển quyền Trưởng nhóm dự án.");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Không thể chuyển quyền Trưởng nhóm dự án.");
    }
  };

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove || !projectId) return;
    try {
      await removeMember(memberToRemove.userId);
      toastSuccess(`Đã xóa ${memberToRemove.fullName} khỏi dự án.`);
      setMemberToRemove(null);
      refetchMembers();
    } catch (error) {
      toastError(
        error instanceof Error ? error.message : "Không thể xóa thành viên khỏi dự án.",
      );
    }
  };
  const totalSelections = Object.keys(assignedRoles).length;

  const totalMembersPages = membersPaginatedData?.totalPages || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quản lý Thành viên"
      description={
        projectName
          ? `Quản lý thành viên tham gia dự án: ${projectName}`
          : "Quản lý những thành viên tham gia và các thư mời."
      }
      size="xl"
      closeOnOutsideClick={false}
      mode="drawer"
      footer={
        <div className="flex w-full min-w-0 items-center justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {totalSelections > 0 && activeTab === "add" && (
              <div className="flex min-w-0 items-center gap-1 rounded-xl border border-accent/15 bg-primary-light px-2 py-1.5 sm:gap-2 sm:px-4 sm:py-2">
                <div className="hidden -space-x-2 overflow-hidden sm:flex">
                  {waitlistUsers.slice(0, 3).map((u) => (
                    <div
                      key={u.id}
                      className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-primary text-[8px] font-black text-white"
                    >
                      {getInitials(u.fullName)}
                    </div>
                  ))}
                </div>
                <p className="whitespace-nowrap text-[9px] font-bold uppercase tracking-wide text-accent sm:text-[10px] sm:font-black sm:tracking-wider">
                  {totalSelections} <span className="sm:hidden">đã chọn</span><span className="hidden sm:inline">Đã chọn gửi</span>
                </p>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 cursor-pointer px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98] motion-reduce:active:scale-100 motion-reduce:transition-none sm:px-8 sm:py-3.5 sm:text-[11px] sm:font-black sm:tracking-widest"
            >
              Đóng
            </button>
            {activeTab === "add" && (
              <button
                type="button"
                onClick={handleSendInvitations}
                disabled={totalSelections === 0 || isSendingInvitations}
                className={cn(
                  "flex min-h-11 min-w-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-3 text-[9px] font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98] motion-reduce:active:scale-100 motion-reduce:transition-none sm:min-w-[200px] sm:gap-2 sm:px-12 sm:py-4 sm:text-[11px] sm:font-black sm:tracking-widest",
                  totalSelections > 0 && !isSendingInvitations
                    ? "bg-primary text-white hover:bg-primary-hover"
                    : "bg-bg-secondary text-text-secondary cursor-not-allowed",
                )}
              >
                {isSendingInvitations ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full motion-safe:animate-spin motion-reduce:animate-none" />
                    Đang gửi...
                  </>
                ) : (
                  <>
                    Gửi lời mời
                    {totalSelections > 0 && (
                      <span className="ml-1 flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-surface-white/20 text-[10px]">
                        {totalSelections}
                      </span>
                    )}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Unified Tab Switcher */}
        <div className="grid w-full grid-cols-3 gap-1 rounded-xl border border-border bg-bg-secondary p-1 sm:flex sm:w-fit">
          <button
            type="button"
            aria-pressed={activeTab === "collaboration"}
            onClick={() => setActiveTab("collaboration")}
            className={cn(
              "flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border px-1.5 py-2 text-center text-[9px] font-bold leading-tight transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 motion-reduce:transition-none sm:flex-row sm:gap-2 sm:px-6 sm:py-2.5 sm:text-[11px] sm:font-black sm:uppercase sm:tracking-wider",
              activeTab === "collaboration"
                ? "border-border bg-surface-white text-accent"
                : "border-transparent text-text-secondary hover:bg-surface-white/60 hover:text-text-primary",
            )}
          >
            <FiUsers size={14} />
            Thành viên
          </button>
          {canManageMembers && (
            <button
              type="button"
              aria-pressed={activeTab === "add"}
              onClick={() => setActiveTab("add")}
              className={cn(
                "flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border px-1.5 py-2 text-center text-[9px] font-bold leading-tight transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 motion-reduce:transition-none sm:flex-row sm:gap-2 sm:px-6 sm:py-2.5 sm:text-[11px] sm:font-black sm:uppercase sm:tracking-wider",
                activeTab === "add"
                  ? "border-border bg-surface-white text-accent"
                  : "border-transparent text-text-secondary hover:bg-surface-white/60 hover:text-text-primary",
              )}
            >
              <FiUserPlus size={14} />
              Thêm thành viên
            </button>
          )}
          {canManageMembers && (
            <button
              type="button"
              aria-pressed={activeTab === "invites"}
              onClick={() => setActiveTab("invites")}
              className={cn(
                "flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border px-1.5 py-2 text-center text-[9px] font-bold leading-tight transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 motion-reduce:transition-none sm:flex-row sm:gap-2 sm:px-6 sm:py-2.5 sm:text-[11px] sm:font-black sm:uppercase sm:tracking-wider",
                activeTab === "invites"
                  ? "border-border bg-surface-white text-accent"
                  : "border-transparent text-text-secondary hover:bg-surface-white/60 hover:text-text-primary",
              )}
            >
              <FiSend size={14} />
            Lịch sử mời
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="min-h-[450px]">
          {activeTab === "collaboration" && (
            <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-reduce:animate-none flex flex-col h-full">
              {/* Collaboration Search */}
              <div className="relative group max-w-md">
                <FiSearch
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary transition-colors group-focus-within:text-primary motion-reduce:transition-none"
                  size={16}
                />
                <input
                  type="text"
                  aria-label="Search project members"
                  placeholder="Tìm kiếm thành viên trong dự án..."
                  value={memberSearchTerm}
                  onChange={(e) => {
                    setMemberSearchTerm(e.target.value);
                    setMemberPageNumber(1);
                  }}
                  className="h-11 w-full rounded-xl border border-border bg-bg-primary pl-11 pr-4 text-sm text-text-primary outline-none transition-colors placeholder:text-text-secondary focus:border-primary focus:ring-2 focus:ring-primary/15 focus:bg-surface-white"
                />
              </div>

              {isLoadingMembers ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <LoadingSpinner size="lg" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
                    Đang đồng bộ dữ liệu...
                  </p>
                </div>
              ) : membersError ? (
                <div className="space-y-2 rounded-xl border border-error/20 bg-surface-white p-6 text-center shadow-none">
                  <p className="text-sm font-black uppercase tracking-tight text-error">
                    Đồng bộ thất bại
                  </p>
                  <p className="text-xs font-medium text-text-secondary">
                    {membersError}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar flex-1">
                    {members.length > 0 ? (
                      members.map((member) => (
                        <div
                          key={member.userId}
                          className="group relative flex items-center gap-4 rounded-xl border border-border bg-surface-white p-4 transition-colors hover:border-primary/35"
                        >
                          <div
                            className={cn(
                              "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-base font-bold",
                              member.role === ProjectRole.Owner
                                ? "bg-primary text-white"
                                : "border border-border bg-bg-secondary text-text-secondary",
                            )}
                          >
                            {getInitials(member.fullName)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="mb-0.5 flex flex-wrap items-center gap-2">
                              <h4 className="w-full min-w-0 truncate font-semibold text-text-primary sm:w-auto">
                                {member.fullName}
                              </h4>
                              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                                <span
                                  className={cn(
                                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                    member.role === ProjectRole.Owner
                                      ? "border-primary/20 bg-primary-light text-primary-hover"
                                      : "border-border bg-bg-secondary text-text-secondary",
                                  )}
                                >
                                  {member.role === ProjectRole.Owner
                                    ? "Project Leader"
                                    : getProjectRoleLabel(member.role)}
                                </span>
                                {canManageMembers &&
                                  !hideLeaderRole &&
                                  member.role !== ProjectRole.Owner && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleExistingMemberRoleChange(member.userId, "OWNER")
                                      }
                                      disabled={isUpdatingMemberRole}
                                      className="inline-flex min-h-11 w-full min-w-0 max-w-full basis-full items-center gap-1.5 rounded-lg border border-primary/20 bg-primary-light px-2.5 text-left text-[10px] font-semibold leading-tight text-primary-hover transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:basis-auto"
                                      aria-label={`Transfer Project Leader role to ${member.fullName}`}
                                    >
                                      <FiRepeat size={12} />
                                      <span className="sm:hidden">Trưởng nhóm</span><span className="hidden sm:inline">Chuyển Project Leader</span>
                                    </button>
                                  )}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-text-secondary">
                              <span className="text-accent/80 lowercase italic font-medium">
                                @{member.userName}
                              </span>
                              <div className="h-1 w-1 rounded-full bg-border" />
                              <div className="flex items-center gap-1.5">
                                <FiMail size={12} className="text-text-secondary" />
                                {member.email}
                              </div>
                            </div>
                          </div>
                          <div className="hidden sm:flex flex-col items-end gap-1 text-right shrink-0">
                            <p className="text-[10px] font-black uppercase tracking-widest leading-none text-text-secondary">
                              Ngày tham gia
                            </p>
                            <div className="flex items-center gap-1.5 rounded-xl border border-border bg-bg-secondary px-3 py-1.5 text-[11px] font-bold text-text-secondary">
                              <FiCalendar
                                size={12}
                                className="text-text-secondary"
                              />
                              {formatDate(member.joinedAt)}
                            </div>
                          </div>
                          {canManageMembers && (
                            <div className="ml-2 border-l border-border pl-2">
                              <Tooltip content={member.role === ProjectRole.Owner ? "Không thể xóa Trưởng nhóm" : "Xóa khỏi dự án"}>
                                <button
                                  type="button"
                                  aria-label={`Remove ${member.fullName} from project`}
                                  onClick={() =>
                                    setMemberToRemove({
                                      userId: member.userId,
                                      fullName: member.fullName,
                                    })
                                  }
                                  disabled={isRemovingMember || member.role === ProjectRole.Owner}
                                  className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-surface-white hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-95 motion-reduce:active:scale-100 group/del disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <FiTrash2
                                    size={18}
                                    className="motion-safe:transition-transform group-hover/del:rotate-6 motion-reduce:transform-none motion-reduce:transition-none"
                                  />
                                </button>
                              </Tooltip>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="py-20 flex flex-col items-center justify-center text-center opacity-30 grayscale">
                        <FiUsers size={48} className="mb-4 text-text-secondary" />
                        <p className="text-sm font-black uppercase text-text-primary">
                          {debouncedMemberSearch
                            ? "Không tìm thấy kết quả"
                            : "Dự án chưa có thành viên"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Pagination Controls */}
                  {totalMembersPages > 1 && (
                    <div className="mt-auto flex items-center justify-center gap-4 border-t border-border py-4">
                      <button
                        type="button"
                        aria-label="Previous members page"
                        onClick={() =>
                          setMemberPageNumber((prev) => Math.max(1, prev - 1))
                        }
                        disabled={memberPageNumber === 1}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-surface-white text-text-secondary shadow-sm transition-colors hover:bg-bg-secondary hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:opacity-40 active:scale-95 motion-reduce:active:scale-100 motion-reduce:transition-none"
                      >
                        <FiChevronLeft size={18} />
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
                          Page
                        </span>
                        <span className="rounded-full border border-primary/20 bg-bg-secondary px-3 py-1 text-xs font-black text-primary">
                          {memberPageNumber}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
                          of
                        </span>
                        <span className="text-xs font-black text-text-primary">
                          {totalMembersPages}
                        </span>
                      </div>
                      <button
                        type="button"
                        aria-label="Next members page"
                        onClick={() =>
                          setMemberPageNumber((prev) =>
                            Math.min(totalMembersPages, prev + 1),
                          )
                        }
                        disabled={memberPageNumber === totalMembersPages}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-surface-white text-text-secondary shadow-sm transition-colors hover:bg-bg-secondary hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:opacity-40 active:scale-95 motion-reduce:active:scale-100 motion-reduce:transition-none"
                      >
                        <FiChevronRight size={18} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === "add" && (
            <div className="space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-300 motion-reduce:animate-none">
              {!effectivelyHideLeaderRole && (
                <ProjectLeaderStatus
                  currentLeader={currentLeader}
                  onReplaceClick={() => {
                    setActiveTab("collaboration");
                    toastInfo("Để đổi Trưởng nhóm, hãy chọn 'Project Leader' trong menu vai trò của thành viên.");
                  }}
                  getInitials={getInitials}
                />
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                <div className="lg:col-span-7">
                  <UserSearchSection
                    searchTerm={inviteSearchTerm}
                    onSearchChange={setInviteSearchTerm}
                    isSearching={isSearching}
                    displayUsers={users}
                    selectedUserId={selectedUserId}
                    onSelectUser={handleSelectUser}
                    assignedRoles={assignedRoles}
                    getInitials={getInitials}
                    showSuggestions={!isGlobalAdmin && !debouncedInviteSearch}
                    currentPage={
                      isGlobalAdmin && !debouncedInviteSearch
                        ? addMemberPageNumber
                        : undefined
                    }
                    totalPages={
                      isGlobalAdmin && !debouncedInviteSearch
                        ? adminListData?.totalPages
                        : undefined
                    }
                    onPageChange={setAddMemberPageNumber}
                  />
                </div>

                <div className="lg:col-span-5 space-y-6">
                  <RoleAssignmentPanel
                    selectedUser={selectedUser}
                    onRemoveFromWaitlist={handleRemoveFromWaitlist}
                    getInitials={getInitials}
                  />

                  <InvitationWaitlist
                    users={waitlistUsers}
                    onRemove={handleRemoveFromWaitlist}
                    onSelect={handleSelectFromWaitlist}
                    selectedUserId={selectedUserId}
                    getInitials={getInitials}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "invites" && (
            <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-reduce:animate-none">
              <SentInvitations projectId={projectId || ""} />
            </div>
          )}
        </div>

      </div>

      <ReplaceLeaderConfirm
        isOpen={showReplaceConfirm}
        onConfirm={confirmReplaceLeader}
        onCancel={() => { setShowReplaceConfirm(false); setPendingLeader(null); }}
        selectedUserName={pendingLeader?.fullName}
      />

      <ConfirmModal
        isOpen={Boolean(memberToRemove)}
        onClose={() => setMemberToRemove(null)}
        onConfirm={handleConfirmRemoveMember}
        isLoading={isRemovingMember}
        title="Xóa thành viên khỏi dự án"
        message={`Bạn có chắc chắn muốn xóa thành viên "${memberToRemove?.fullName}" khỏi dự án này không?`}
        confirmText="Xóa thành viên"
        cancelText="Hủy"
        variant="danger"
      />
    </Modal>
  );
}
