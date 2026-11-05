import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "../constants/queryKeys";
import { auditLogService } from "../services/auditLogService";
import { getErrorMessage } from "../utils/errorUtils";
import type { AuditLogQueryParams } from "../types/auditLog";

export const useAdminAuditLogs = (params?: AuditLogQueryParams) => {
  const query = useQuery({
    queryKey: QUERY_KEYS.auditLogs.admin(params),
    queryFn: () => auditLogService.getAdminAuditLogs(params),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  return {
    data: query.data ?? undefined,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ? getErrorMessage(query.error, "Failed to get admin audit logs") : null,
    refetch: query.refetch,
  };
};

export const useProjectLeaderAuditLogs = (projectId: string | undefined, params?: AuditLogQueryParams) => {
  const query = useQuery({
    queryKey: QUERY_KEYS.auditLogs.projectLeader(projectId || "", params),
    queryFn: () =>
      projectId
        ? auditLogService.getProjectLeaderAuditLogs(projectId, params)
        : Promise.reject("No project ID"),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  return {
    data: query.data ?? undefined,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ? getErrorMessage(query.error, "Failed to get project audit logs") : null,
    refetch: query.refetch,
  };
};
