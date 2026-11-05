import React, { useMemo, useState } from "react";
import {
  FiDownload,
  FiRefreshCw,
} from "react-icons/fi";
import { toastSuccess } from "../../utils/toast";
import type {
  AuditLogEntry,
  AuditLogExportFormat,
  AuditLogFiltersState,
  AuditLogSortField,
} from "../../types/auditLog";
import { AUDIT_LOG_PAGE_SIZE } from "./auditLogs/constants";
import {
  buildAuditLogExportContent,
  buildAuditLogFileName,
  downloadFile,
  filterAuditLogs,
  sortAuditLogs,
} from "./auditLogs/utils";
import AuditLogFilters from "./auditLogs/components/AuditLogFilters";
import AuditLogTable from "./auditLogs/components/AuditLogTable";
import AuditLogDetailModal from "./auditLogs/components/AuditLogDetailModal";
import AuditLogExportDialog from "./auditLogs/components/AuditLogExportDialog";

import { useAdminAuditLogs } from "../../hooks/useAuditLogs";
import { useUsers } from "../../hooks/useUsers";
import { auditLogService } from "../../services/auditLogService";

const initialFilters: AuditLogFiltersState = {
  searchTerm: "",
  user: "all",
  actionType: "all",
  status: "all",
  startDate: "",
  endDate: "",
};

const AuditLogPage: React.FC = () => {
  const [filters, setFilters] = useState<AuditLogFiltersState>(initialFilters);
  const [sortField, setSortField] = useState<AuditLogSortField>("timestamp");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(
    null,
  );
  const [isExportOpen, setIsExportOpen] = useState(false);

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = {
      pageNumber: currentPage,
      pageSize: AUDIT_LOG_PAGE_SIZE,
    };
    if (filters.searchTerm) params.search = filters.searchTerm;
    if (filters.user && filters.user !== "all") params.search = filters.user;
    if (filters.actionType !== "all") params.actionType = filters.actionType;
    if (filters.status !== "all") params.status = filters.status;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    return params;
  }, [currentPage, filters]);

  const { data: auditLogsResponse, isLoading: isLoadingLogs } =
    useAdminAuditLogs(queryParams);
  const { users: systemUsers } = useUsers({ pageNumber: 1, pageSize: 100 });

  const isPageLoading = isLoadingLogs;

  const logs = useMemo(
    () => auditLogsResponse?.data?.items || [],
    [auditLogsResponse],
  );

  const users = useMemo(() => {
    const fromLogs = logs.map((entry) => entry.user);
    const fromUsers = (systemUsers || []).map((u) => u.fullName || u.username);
    return Array.from(new Set([...fromLogs, ...fromUsers]))
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
  }, [logs, systemUsers]);

  const filteredLogs = useMemo(() => {
    return filterAuditLogs(logs, filters);
  }, [filters, logs]);

  const sortedLogs = useMemo(() => {
    const items = auditLogsResponse?.data?.items ? [...auditLogsResponse.data.items] : filteredLogs;
    return sortAuditLogs(items, sortField, sortDirection);
  }, [auditLogsResponse, filteredLogs, sortDirection, sortField]);

  const totalCount = auditLogsResponse?.data?.totalCount ?? sortedLogs.length;
  const totalPages =
    auditLogsResponse?.data?.totalPages ??
    Math.max(1, Math.ceil(totalCount / AUDIT_LOG_PAGE_SIZE));

  const activePage = Math.min(currentPage, totalPages);
  const pageStart =
    totalCount === 0 ? 0 : (activePage - 1) * AUDIT_LOG_PAGE_SIZE + 1;
  const pageEnd = Math.min(activePage * AUDIT_LOG_PAGE_SIZE, totalCount);

  const pageLogs = sortedLogs;

  const handleFilterUpdate = (
    key: keyof AuditLogFiltersState,
    value: string,
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setCurrentPage(1);
  };

  const handleSortChange = (field: AuditLogSortField) => {
    setCurrentPage(1);
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection(field === "timestamp" ? "desc" : "asc");
  };

  const handleResetFilters = () => {
    setFilters(initialFilters);
    setCurrentPage(1);
  };

  const handleExport = async (request: {
    format: AuditLogExportFormat;
    startDate: string;
    endDate: string;
  }) => {
    let itemsToExport = logs;
    try {
      const allLogsRes = await auditLogService.getAdminAuditLogs({
        pageNumber: 1,
        pageSize: 1000,
        startDate: request.startDate || undefined,
        endDate: request.endDate || undefined,
        actionType: filters.actionType !== "all" ? filters.actionType : undefined,
        status: filters.status !== "all" ? filters.status : undefined,
        search: filters.searchTerm || undefined,
      });
      if (allLogsRes?.data?.items?.length) {
        itemsToExport = allLogsRes.data.items;
      }
    } catch (err) {
      console.warn("Failed to fetch full logs for export, falling back to cached logs", err);
    }

    const exportLogs = filterAuditLogs(itemsToExport, {
      ...filters,
      startDate: request.startDate,
      endDate: request.endDate,
    });

    if (exportLogs.length === 0) {
      throw new Error("No audit logs match the selected export range.");
    }

    const { content, mimeType } = buildAuditLogExportContent(
      exportLogs,
      request.format,
    );
    const fileName = buildAuditLogFileName(
      request.format,
      request.startDate,
      request.endDate,
    );

    downloadFile(content, fileName, mimeType);

    toastSuccess(
      "Export completed",
      `${exportLogs.length} audit log records were downloaded as ${request.format.toUpperCase()}.`,
    );
  };

  if (isPageLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <FiRefreshCw className="h-7 w-7 motion-safe:animate-spin motion-reduce:animate-none text-accent" />
          <p className="text-sm font-medium text-text-muted">
            Loading audit history...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 pb-2">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-text-primary">
            Audit Logs
          </h1>
          <p className="mt-1 text-[13px] text-text-secondary">
            Review recorded actions across the system.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsExportOpen(true)}
          className="inline-flex h-10 min-h-10 items-center gap-2 self-start rounded-lg bg-primary px-4 text-[13px] font-semibold text-text-on-primary transition-colors motion-reduce:transition-none hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 sm:self-auto"
        >
          <FiDownload className="w-4 h-4" />
          Export
        </button>
      </div>

      <AuditLogTable
        toolbar={
          <AuditLogFilters
            searchTerm={filters.searchTerm}
            users={users}
            selectedUser={filters.user}
            selectedActionType={filters.actionType}
            selectedStatus={filters.status}
            startDate={filters.startDate}
            endDate={filters.endDate}
            onSearchTermChange={(value) => handleFilterUpdate("searchTerm", value)}
            onSelectedUserChange={(value) => handleFilterUpdate("user", value)}
            onSelectedActionTypeChange={(value) => handleFilterUpdate("actionType", value)}
            onSelectedStatusChange={(value) => handleFilterUpdate("status", value)}
            onStartDateChange={(value) => handleFilterUpdate("startDate", value)}
            onEndDateChange={(value) => handleFilterUpdate("endDate", value)}
            onReset={handleResetFilters}
          />
        }
        logs={pageLogs}
        isLoading={isLoadingLogs}
        totalCount={totalCount}
        currentPage={activePage}
        totalPages={totalPages}
        pageStart={pageStart}
        pageEnd={pageEnd}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        onPageChange={setCurrentPage}
        onRowClick={setSelectedEntry}
      />

      <AuditLogDetailModal
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />

      <AuditLogExportDialog
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        defaultStartDate={filters.startDate}
        defaultEndDate={filters.endDate}
        onExport={handleExport}
      />
    </div>
  );
};

export default AuditLogPage;
