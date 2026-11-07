import React, { useState, useMemo } from "react";
import {
  FiSearch,
  FiUserPlus,
  FiMail,
  FiUser,
  FiShield,
  FiEdit3,
  FiCheckCircle,
  FiXCircle,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiActivity,
} from "react-icons/fi";
import { cn } from "../../utils/cn";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "../../components/ui/Table";
import Tooltip from "../../components/ui/Tooltip";
import Select from "../../components/ui/Select";
import DataTableToolbar from "../../components/ui/DataTableToolbar";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import ErrorBanner from "./components/ErrorBanner";
import ActionButton from "../../components/admin/slr-projects/ActionButton";
import {
  useUsers,
  useToggleUserStatusMutation,
  useExportUsersMutation,
} from "../../hooks/useUsers";
import AddUserModal from "../../components/admin/user-management/AddUserModal";
import UpdateUserModal from "../../components/admin/user-management/UpdateUserModal";
import ChangePreviewModal from "../../components/admin/user-management/ChangePreviewModal";
import StatusConfirmModal from "../../components/admin/user-management/StatusConfirmModal";
import type { User } from "../../types/user";
import { toastSuccess, toastError } from "../../utils/toast";
import { getInitials } from "../../utils/getInitials";

// Helper Components
const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
  // Standardize role to title case for style matching
  const displayRole =
    role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();

  const styles: Record<string, string> = {
    Admin: "bg-primary-light text-primary ring-primary/20",
    Teacher: "bg-bg-secondary text-text-secondary ring-border",
    Student: "bg-info/10 text-info ring-info/20",
  };

  const icons: Record<string, React.ReactNode> = {
    Admin: <FiShield size={10} />,
    Teacher: <FiUser size={10} />,
    Student: <FiActivity size={10} />,
  };

  const style =
    styles[displayRole] ||
    "bg-bg-secondary text-text-secondary ring-border";
  const icon = icons[displayRole] || <FiUser size={10} />;

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset",
        style,
      )}
    >
      {icon}
      {displayRole}
    </span>
  );
};

const StatusBadge: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset",
        isActive
          ? "bg-success/10 text-success ring-success/20"
          : "bg-bg-secondary text-text-muted ring-border",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isActive
            ? "bg-success"
            : "bg-text-muted",
        )}
      />
      {isActive ? "Active" : "Deactivated"}
    </span>
  );
};

const UserManagement: React.FC = () => {
  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Update user states
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [oldUser, setOldUser] = useState<User | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  const { toggleStatus, isLoading: isStatusLoading } =
    useToggleUserStatusMutation();
  const { exportUsers, isLoading: isExporting } = useExportUsersMutation();

  const handleExportClick = async () => {
    try {
      await exportUsers(undefined);
      toastSuccess(
        "Export Successful",
        "Your user account data has been downloaded.",
      );
    } catch {
      toastError("Export Failed", "Could not generate user account file.");
    }
  };

  const handleEditClick = (user: User) => {
    setOldUser(user);
    setSelectedUser(user);
    setIsUpdateModalOpen(true);
  };

  const handleUpdateSuccess = (updatedUser: User) => {
    setSelectedUser(updatedUser);
    setIsPreviewModalOpen(true);
  };

  const handleStatusToggleClick = (user: User) => {
    setSelectedUser(user);
    setIsStatusModalOpen(true);
  };

  const handleConfirmStatusToggle = async () => {
    if (!selectedUser) return;

    try {
      const result = await toggleStatus(selectedUser.id);
      if (result.isSuccess) {
        toastSuccess(
          selectedUser.isActive ? "Account Deactivated" : "Account Activated",
          `User ${selectedUser.fullName} status has been updated.`,
        );
        setIsStatusModalOpen(false);
      } else {
        toastError(
          "Action Failed",
          result.message || "Could not update user status.",
        );
      }
    } catch {
      toastError("System Error", "An unexpected error occurred.");
    }
  };

  // Params for hook
  const params = useMemo(
    () => ({
      search: searchTerm || undefined,
      isActive: statusFilter === "all" ? undefined : statusFilter === "active",
      pageNumber,
      pageSize,
    }),
    [searchTerm, statusFilter, pageNumber, pageSize],
  );

  // Data Hook
  const {
    users,
    data: paginatedData,
    isLoading,
    isError,
    error,
    refetch,
  } = useUsers(params);

  // Derived values
  const totalCount = paginatedData?.totalCount || 0;
  const totalPages = paginatedData?.totalPages || 0;
  const itemsStart = (pageNumber - 1) * pageSize + 1;
  const itemsEnd = Math.min(pageNumber * pageSize, totalCount);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 pb-2">
      {/* 💎 Page Header 💎 */}
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-tight text-text-primary sm:text-[28px]">
            System Users
          </h1>
          <p className="mt-1 text-sm leading-5 text-text-secondary">
            Manage user accounts, roles, and system access permissions.
          </p>
        </div>

        <Tooltip content="Create a new system user account" position="left">
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="h-10 shrink-0 gap-2 self-start sm:self-center"
          >
            <FiUserPlus size={16} />
            Add User
          </Button>
        </Tooltip>
      </header>

      {/* 📦 Master Table Container (Desktop) 📦 */}
      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <DataTableToolbar
          search={<div className="group relative w-full min-w-0 sm:max-w-[340px] sm:flex-1">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-accent" />
              <input
                type="text"
                aria-label="Search users by identity or email"
                placeholder="Search users..."
                className="h-10 w-full rounded-lg border border-border bg-surface-white py-2 pl-9 pr-3 text-[13px] text-text-primary outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 motion-reduce:transition-none"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setPageNumber(1);
                }}
              />
          </div>}
          filterPlacement="left"
          filters={<div className="w-full sm:w-[180px]">
            <Tooltip content="Filter by user status" position="bottom">
              <Select
                aria-label="Filter by user status"
                className="h-10 w-full rounded-lg px-3 sm:w-[180px]"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPageNumber(1);
                }}
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "active", label: "Active only" },
                  { value: "inactive", label: "Deactivated" },
                ]}
              />
            </Tooltip>
          </div>}
          actions={<Tooltip content="Download User File (XLSX)" position="bottom">
            <Button
              variant="secondary"
              size="sm"
              className="h-10 shrink-0 gap-2"
              onClick={handleExportClick}
              disabled={isExporting}
            >
              {isExporting ? <LoadingSpinner size="sm" /> : <FiDownload size={15} />}
              {isExporting ? "Exporting..." : "Export"}
            </Button>
          </Tooltip>}
        />

        <div className="hidden lg:block">
          <Table className="min-w-[960px] table-fixed">
            <colgroup>
              <col className="w-[32%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[18%]" />
              <col className="w-[22%]" />
            </colgroup>
            <TableHeader className="border-b border-border bg-bg-primary">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
                  Personal Information
                </TableHead>
                <TableHead className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
                  Username
                </TableHead>
                <TableHead className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
                  Access Role
                </TableHead>
                <TableHead className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
                  Account Status
                </TableHead>
                <TableHead className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
                  Administrative Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(pageSize)
                  .fill(0)
                  .map((_, i) => (
                    <TableRow key={i} className="motion-safe:animate-pulse motion-reduce:animate-none">
                      <TableCell colSpan={5} className="px-4 py-3">
                        <div className="h-10 w-full rounded-lg bg-bg-primary" />
                      </TableCell>
                    </TableRow>
                  ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={5} className="px-4 py-4">
                    <ErrorBanner message={error} fallback="User list unavailable." onRetry={() => void refetch()} />
                  </TableCell>
                </TableRow>
              ) : users.length > 0 ? (
                users.map((user: User) => (
                  <TableRow
                     key={user.id}
                     className="group transition-colors hover:bg-bg-primary motion-reduce:transition-none"
                  >
                    {/* User Profile Cell */}
                    <TableCell className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-primary-light text-[13px] font-semibold text-accent">
                            {getInitials(user.fullName)}
                          </div>
                          {user.isActive && (
                            <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-success" />
                          )}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="truncate text-[13px] font-semibold tracking-tight text-text-secondary transition-colors group-hover:text-accent motion-reduce:transition-none">
                            {user.fullName}
                          </div>
                          <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-text-muted">
                            <FiMail size={12} className="shrink-0 text-text-muted" />
                            <span className="truncate">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Username/Identity Cell */}
                    <TableCell className="px-4 py-3 text-center">
                      <div className="inline-flex max-w-full items-center rounded-md border border-border bg-bg-primary px-2.5 py-1.5">
                        <span className="truncate text-[11px] font-semibold text-text-secondary">
                          @{user.username}
                        </span>
                      </div>
                    </TableCell>

                    {/* Role Cell */}
                    <TableCell className="px-4 py-3 text-center">
                      <RoleBadge role={user.role} />
                    </TableCell>

                    {/* Status Cell */}
                    <TableCell className="px-4 py-3 text-center">
                      <StatusBadge isActive={user.isActive} />
                    </TableCell>

                    {/* Actions Cell */}
                    <TableCell className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ActionButton
                          icon={FiEdit3}
                          label="Modify Profile"
                          className="h-9 w-9 rounded-lg hover:bg-primary-light"
                          onClick={() => handleEditClick(user)}
                        />

                        <div className="mx-1 h-4 w-px bg-border" />

                        {user.isActive ? (
                          <ActionButton
                            icon={FiXCircle}
                            label="Deactivate Access"
                            variant="destructive"
                            className="h-9 w-9 rounded-lg hover:bg-error/5"
                            onClick={() => handleStatusToggleClick(user)}
                          />
                        ) : (
                          <ActionButton
                            icon={FiCheckCircle}
                            label="Reactivate Access"
                            className="h-9 w-9 rounded-lg text-success hover:bg-bg-secondary hover:text-accent"
                            onClick={() => handleStatusToggleClick(user)}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="px-4 py-8 text-center font-medium text-text-muted"
                  >
                    No users found matching your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* 📉 Table Footer (Desktop) 📉 */}
        <div className="hidden flex-col items-center justify-between gap-3 border-t border-border bg-bg-primary px-4 py-3 sm:flex-row lg:flex">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col">
              <p className="text-[11px] font-medium text-text-secondary">
                {isError ? "Account totals unavailable" : `Showing ${totalCount ? itemsStart : 0}–${itemsEnd} of ${totalCount} Accounts`}
              </p>
            </div>

            <div className="h-6 w-px bg-border" />

            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">
                Per page:
              </span>
              <Select
                className="w-[72px] [&>button]:h-9 [&>button]:rounded-lg [&>button]:px-2 [&>button]:text-xs"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPageNumber(1);
                }}
                options={[
                  { value: "10", label: "10" },
                  { value: "20", label: "20" },
                  { value: "50", label: "50" },
                ]}
              />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous page"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white text-text-secondary transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-40"
              disabled={pageNumber === 1 || isLoading}
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            >
              <FiChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageToShow = i + 1;
                if (totalPages > 5 && pageNumber > 3) {
                  pageToShow = Math.min(pageNumber - 2 + i, totalPages - 4 + i);
                }
                return (
                  <button
                    key={pageToShow}
                    type="button"
                    onClick={() => setPageNumber(pageToShow)}
                    aria-current={pageNumber === pageToShow ? "page" : undefined}
                    disabled={isLoading}
                    className={cn(
                      "h-9 min-w-9 rounded-lg border px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none disabled:opacity-50",
                      pageNumber === pageToShow
                        ? "border-accent bg-primary text-white"
                        : "border-border bg-white text-text-secondary hover:bg-primary-light",
                    )}
                  >
                    {pageToShow}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              aria-label="Next page"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white text-text-secondary transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-40"
              disabled={
                pageNumber === totalPages || totalPages === 0 || isLoading
              }
              onClick={() => setPageNumber((p) => Math.min(totalPages, p + 1))}
            >
              <FiChevronRight size={16} />
            </button>
          </div>
        </div>

      {/* 📱 Mobile User Cards (lg hidden) 📱 */}
      <div className="divide-y divide-border lg:hidden">
        {isLoading ? (
          Array(pageSize)
            .fill(0)
            .map((_, i) => (
              <div
                key={i}
                className="motion-safe:animate-pulse motion-reduce:animate-none px-4 py-4"
              >
                <div className="h-20 w-full rounded-lg bg-bg-primary" />
              </div>
            ))
        ) : isError ? (
          <ErrorBanner message={error} fallback="User list unavailable." onRetry={() => void refetch()} />
        ) : users.length > 0 ? (
          users.map((user: User) => (
            <div
              key={user.id}
              className="space-y-3 px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-primary-light text-[13px] font-semibold text-accent">
                    {getInitials(user.fullName)}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <h4 className="truncate text-[13px] font-semibold text-text-secondary">
                      {user.fullName}
                    </h4>
                    <p className="truncate text-[10px] font-medium text-text-muted">
                      @{user.username}
                    </p>
                  </div>
                </div>
                <RoleBadge role={user.role} />
              </div>

              <div className="space-y-3 border-t border-border pt-3">
                <div className="flex min-w-0 items-center gap-2 text-[12px] text-text-secondary">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-bg-primary text-text-muted">
                    <FiMail size={14} />
                  </div>
                  <span className="truncate">{user.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <StatusBadge isActive={user.isActive} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditClick(user)}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-white px-3 text-[11px] font-semibold text-accent transition-colors hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                  >
                    <FiEdit3 size={16} />
                    Edit
                  </button>
                  {user.isActive ? (
                    <button
                      type="button"
                      onClick={() => handleStatusToggleClick(user)}
                      className="inline-flex h-11 items-center gap-2 rounded-xl border border-error/20 bg-white px-3 text-[11px] font-semibold text-error transition-colors hover:bg-error/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40 motion-reduce:transition-none"
                    >
                      <FiXCircle size={16} />
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStatusToggleClick(user)}
                      className="inline-flex h-11 items-center gap-2 rounded-xl border border-success/20 bg-white px-3 text-[11px] font-semibold text-success transition-colors hover:bg-success/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success/40 motion-reduce:transition-none"
                    >
                      <FiCheckCircle size={16} />
                      Activate
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="px-4 py-10 text-center text-xs text-text-muted">
            No users found. Try changing your search or status filter.
          </div>
        )}

        {/* Mobile Pagination Placeholder */}
        <div className="flex flex-col gap-3 border-t border-border bg-bg-primary px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-xs font-medium text-text-secondary">
              {isError
                ? "Account totals unavailable"
                : `Showing ${totalCount ? itemsStart : 0}–${itemsEnd} of ${totalCount} users`}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Per page</span>
              <Select
                className="w-[68px] [&>button]:h-9 [&>button]:rounded-lg [&>button]:px-2 [&>button]:text-xs"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPageNumber(1);
                }}
                options={[
                  { value: "10", label: "10" },
                  { value: "20", label: "20" },
                  { value: "50", label: "50" },
                ]}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <span className="text-xs font-medium text-text-secondary sm:hidden">
              {isError ? "Page unavailable" : `Page ${pageNumber} of ${totalPages || 1}`}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Previous page"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white text-text-secondary transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none disabled:opacity-40"
                disabled={pageNumber === 1 || isLoading}
                onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              >
                <FiChevronLeft size={16} />
              </button>
              <span className="hidden text-xs font-medium text-text-secondary sm:inline">
                {`Page ${pageNumber} of ${totalPages || 1}`}
              </span>
              <button
                type="button"
                aria-label="Next page"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white text-text-secondary transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none disabled:opacity-40"
                disabled={pageNumber === totalPages || totalPages === 0 || isLoading}
                onClick={() => setPageNumber((p) => Math.min(totalPages, p + 1))}
              >
                <FiChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
      {/* 📝 Update Profile Modal 📝 */}
      <UpdateUserModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        user={selectedUser}
        onSuccess={handleUpdateSuccess}
      />

      {/* ✨ Success Preview Modal ✨ */}
      <ChangePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        oldData={oldUser}
        newData={selectedUser}
      />

      {/* 🛡️ Status Toggle Confirmation 🛡️ */}
      <StatusConfirmModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        user={selectedUser}
        onConfirm={handleConfirmStatusToggle}
        isLoading={isStatusLoading}
      />
    </div>
  );
};

export default UserManagement;
