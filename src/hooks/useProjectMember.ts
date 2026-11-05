import { useQuery } from "@tanstack/react-query";
import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import { projectService } from "../services/projectService";
import { QUERY_KEYS } from "../constants/queryKeys";
import { setProjectMember } from "../redux/slices/projectSlice";
import type { RootState } from "../redux/store";

/**
 * Hook to manage and sync the current project member state with Redux.
 * Ensures the membership information is fetched if missing and kept up to date.
 */
export const useProjectMember = (projectId: string | undefined) => {
  const dispatch = useDispatch();
  const { isAuthenticated, isInitialized, user } = useSelector((state: RootState) => state.auth);
  const currentProjectMember = useSelector((state: RootState) => state.project.currentProjectMember);

  const query = useQuery({
    queryKey: QUERY_KEYS.projects.myMembership(projectId || "", user?.id || "anonymous"),
    queryFn: () => (projectId ? projectService.getMyMembership(projectId) : Promise.reject("No project ID")),
    enabled: !!projectId && isAuthenticated && isInitialized,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const membership = query.data?.isSuccess ? query.data.data : undefined;
  const roleNames: Record<string, number> = {
    OWNER: 1,
    ADMIN: 1,
    LEADER: 1,
    LECTURER: 3,
    MEMBER: 3,
    REVIEWER: 3,
  };
  const rawRoleNumber = typeof membership?.roleNumber === "number"
    ? membership.roleNumber
    : typeof membership?.role === "number"
      ? membership.role
      : undefined;
  const namedRoleNumber = roleNames[String(membership?.roleText || membership?.role).toUpperCase()];
  const normalizedRole = membership
    ? membership.isLeader === true ? 1
      : namedRoleNumber ?? (rawRoleNumber === 1 ? 1 : rawRoleNumber === 2 || rawRoleNumber === 3 ? 3 : 3)
    : null;
  const member = membership && normalizedRole !== null
    ? {
        role: normalizedRole,
        roleText: normalizedRole === 1 ? "OWNER" : "REVIEWER",
        isLeader: normalizedRole === 1,
      }
    : null;

  useEffect(() => {
    if (member) {
      
      // Update Redux if the data is different or missing
      if (
        !currentProjectMember ||
        currentProjectMember.role !== member.role ||
        currentProjectMember.roleText !== member.roleText
      ) {
        dispatch(setProjectMember(member));
      }
    }
  }, [member, dispatch, currentProjectMember]);

  return {
    // Use membership for this query key to avoid showing another project's
    // cached Redux role while the current membership request is loading.
    member,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
};

/**
 * Hook to fetch all members of a project.
 */
export const useProjectMembers = (projectId: string | undefined) => {
  const query = useQuery({
    queryKey: QUERY_KEYS.projects.members(projectId || ""),
    queryFn: () => (projectId ? projectService.getProjectMembers(projectId) : Promise.reject("No project ID")),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    members: query.data?.isSuccess ? query.data.data?.items : [],
    totalCount: query.data?.isSuccess ? query.data.data?.totalCount : 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
};
