import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toastSuccess, toastError } from "../../../../utils/toast";
import { qualityAssessmentService } from "../../../../services/qualityAssessmentService";
import { QUERY_KEYS } from "../../../../constants/queryKeys";
import { getErrorMessage } from "../../../../utils/errorUtils";
import type { 
  QualityAssessmentAssignmentRequest, 
  QualityAssessmentResolutionRequest, 
  AutoResolveQualityAssessmentRequest,
  CreateQualityAssessmentDecisionRequest,
  UpdateQualityAssessmentDecisionRequest,
  UpdateQualityAssessmentResolutionRequest,
  QADashboardParams,
  QualityAssessmentStrategy,
  QualityAssessmentChecklist,
  QualityAssessmentCriterion
} from "../../../../types/qualityAssessment";

export function useQualityAssessment(id?: string, isLeader?: boolean, params?: QADashboardParams) {
  const queryClient = useQueryClient();

  // -- Data Fetching --
  const processQuery = useQuery({
    queryKey: QUERY_KEYS.qualityAssessment.process(id ?? ""),
    queryFn: () => qualityAssessmentService.getProcess(id!),
    enabled: !!id,
  });

  const assignedPapersQuery = useQuery({
    queryKey: [...QUERY_KEYS.qualityAssessment.myAssignedPapers(id ?? ""), params],
    queryFn: () => qualityAssessmentService.getMyAssignedPapers(id ?? "", params),
    enabled: !!id && isLeader === false, // Wait for the authoritative project role.
    refetchInterval: isLeader === false ? 10000 : false,
    refetchOnWindowFocus: true,
  });

  const allPapersQuery = useQuery({
    queryKey: [...QUERY_KEYS.qualityAssessment.papers(id ?? ""), params],
    queryFn: () => qualityAssessmentService.getPapers(id!, params),
    enabled: !!id && isLeader === true,
    // Agent/MCP submissions happen outside this browser tab. Keep the Leader queue in sync.
    refetchInterval: isLeader === true ? 10000 : false,
    refetchOnWindowFocus: true,
  });

  const allPapers = allPapersQuery.data?.data?.papers?.items ?? [];
  const assignedPapers = assignedPapersQuery.data?.data?.papers?.items ?? [];
  const reviewerProgresses = allPapersQuery.data?.data?.reviewerProgresses ?? [];
  
  const totalPagesList = isLeader ? allPapersQuery.data?.data?.papers?.totalPages : assignedPapersQuery.data?.data?.papers?.totalPages;
  const totalItemsList = isLeader ? allPapersQuery.data?.data?.papers?.totalCount : assignedPapersQuery.data?.data?.papers?.totalCount;

  const strategiesQuery = useQuery({
    queryKey: QUERY_KEYS.qualityAssessment.strategies(id ?? ""),
    queryFn: () => qualityAssessmentService.getProcessStrategies(id!),
    enabled: !!id,
  });

  const activePapersQuery = isLeader ? allPapersQuery : assignedPapersQuery;
  const queryError = processQuery.error && !processQuery.data
    ? processQuery.error
    : activePapersQuery.error && !activePapersQuery.data
      ? activePapersQuery.error
      : null;

  // -- Mutations --
  const assignMutation = useMutation({
    mutationFn: (data: QualityAssessmentAssignmentRequest) => qualityAssessmentService.assignReviewers(data),
    onSuccess: () => {
      toastSuccess("Members assigned successfully");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.qualityAssessment.myAssignedPapers(id ?? "") });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.qualityAssessment.papers(id ?? "") });
    },
    onError: (error) => {
      toastError(getErrorMessage(error, "Failed to assign members"));
    }
  });

  const autoResolveMutation = useMutation({
    mutationFn: (data: AutoResolveQualityAssessmentRequest) => qualityAssessmentService.autoResolve(data),
    onSuccess: () => {
      toastSuccess("Auto-resolution completed successfully");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.qualityAssessment.papers(id ?? "") });
    },
    onError: (error) => {
      toastError(getErrorMessage(error, "Failed to auto-resolve papers"));
    }
  });

  const submitDecisionsMutation = useMutation({
    mutationFn: (vars: CreateQualityAssessmentDecisionRequest) =>
      qualityAssessmentService.submitDecisions(vars),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.qualityAssessment.myAssignedPapers(id ?? "") });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.qualityAssessment.papers(id ?? "") });
      toastSuccess("Decisions saved successfully");
    },
    onError: (error) => {
      toastError(getErrorMessage(error, "Failed to save decisions"));
    }
  });

  const updateDecisionsMutation = useMutation({
    mutationFn: (vars: UpdateQualityAssessmentDecisionRequest) =>
      qualityAssessmentService.updateDecisions(vars),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.qualityAssessment.myAssignedPapers(id ?? "") });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.qualityAssessment.papers(id ?? "") });
      toastSuccess("Decisions updated successfully");
    },
    onError: (error) => {
      toastError(getErrorMessage(error, "Failed to update decisions"));
    }
  });

  const submitResolutionMutation = useMutation({
    mutationFn: (data: QualityAssessmentResolutionRequest) =>
      qualityAssessmentService.submitResolution(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.qualityAssessment.myAssignedPapers(id ?? "") });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.qualityAssessment.papers(id ?? "") });
      toastSuccess("Resolution submitted successfully");
    },
    onError: (error) => {
      toastError(getErrorMessage(error, "Failed to submit resolution"));
    }
  });

  const updateResolutionMutation = useMutation({
    mutationFn: (data: UpdateQualityAssessmentResolutionRequest) =>
      qualityAssessmentService.updateResolution(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.qualityAssessment.myAssignedPapers(id ?? "") });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.qualityAssessment.papers(id ?? "") });
      toastSuccess("Resolution updated successfully");
    },
    onError: (error) => {
      toastError(getErrorMessage(error, "Failed to update resolution"));
    }
  });

  const reopenPaperMutation = useMutation({
    mutationFn: (paperId: string) => qualityAssessmentService.reopenPaper(id!, paperId),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.qualityAssessment.process(id ?? "") });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.qualityAssessment.papers(id ?? "") });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.qualityAssessment.myAssignedPapers(id ?? "") });
      toastSuccess(
        response.data?.phaseReopened
          ? "Paper reopened and QA phase returned to In Progress"
          : "Paper reopened successfully",
      );
    },
    onError: (error) => {
      toastError(getErrorMessage(error, "Failed to reopen paper"));
    },
  });

  const startProcessMutation = useMutation({
    mutationFn: () => qualityAssessmentService.start(id!),
    onSuccess: () => toastSuccess("Quality Assessment started"),
    onError: (error) => toastError(getErrorMessage(error, "Failed to start Quality Assessment")),
  });

  const completeProcessMutation = useMutation({
    mutationFn: () => qualityAssessmentService.complete(id!),
    onSuccess: () => toastSuccess("Quality Assessment completed"),
    onError: (error) => toastError(getErrorMessage(error, "Failed to complete Quality Assessment")),
  });

  const upsertStrategyMutation = useMutation({
    mutationFn: (data: QualityAssessmentStrategy) => qualityAssessmentService.upsertStrategy(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.qualityAssessment.strategies(id ?? "") });
    },
    onError: (error) => {
      toastError(getErrorMessage(error, "Failed to save Quality Assessment strategy"));
    }
  });

  const bulkChecklistsMutation = useMutation({
    mutationFn: (data: QualityAssessmentChecklist[]) => qualityAssessmentService.bulkChecklists(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.qualityAssessment.strategies(id ?? "") });
    },
    onError: (error) => {
      toastError(getErrorMessage(error, "Failed to save Quality Assessment checklist"));
    }
  });

  // Strategies upsert end at criteria 
  const bulkCriteriaMutation = useMutation({
    mutationFn: (data: QualityAssessmentCriterion[]) => qualityAssessmentService.bulkCriteria(data),
    onSuccess: () => {
      toastSuccess("Quality Assessment Strategies saved successfully");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.qualityAssessment.strategies(id ?? "") });
    },
    onError: (error) => {
      toastError(getErrorMessage(error, "Failed to save Quality Assessment strategies"));
    }
  });

  const exportCsv = async () => {
    if (!id) return;
    try {
      const blob = await qualityAssessmentService.exportCsv(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qa_results_${id}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toastSuccess("Excel exported successfully");
    } catch (error) {
       toastError(getErrorMessage(error, "Failed to export Excel"));
    }
  };

  return {
    phaseStatus: processQuery.data?.data?.statusText,
    isLoading: processQuery.isLoading || activePapersQuery.isLoading,
    isError: Boolean(queryError),
    error: queryError ? getErrorMessage(queryError, "Failed to load assessment data") : null,
    refetch: async () => {
      await Promise.all([
        processQuery.refetch(),
        activePapersQuery.refetch(),
        strategiesQuery.refetch(),
      ]);
    },
    assignedPapers,
    allPapers,
    totalPagesList,
    totalItemsList,
    leaderStats: allPapersQuery.data?.data,
    memberStats: assignedPapersQuery.data?.data,
    memberProgresses: reviewerProgresses,
    strategies: strategiesQuery.data?.data ?? [],
    isAssigning: assignMutation.isPending,
    isSubmittingDecisions: submitDecisionsMutation.isPending,
    isUpdatingDecisions: updateDecisionsMutation.isPending,
    isSubmittingResolution: submitResolutionMutation.isPending,
    isUpdatingResolution: updateResolutionMutation.isPending,
    isReopeningPaper: reopenPaperMutation.isPending,
    isAutoResolving: autoResolveMutation.isPending,
    isStartingProcess: startProcessMutation.isPending,
    isCompletingProcess: completeProcessMutation.isPending,
    isUpsertingStrategy: upsertStrategyMutation.isPending,
    assign: assignMutation.mutateAsync,
    submitDecisions: submitDecisionsMutation.mutateAsync,
    updateDecisions: updateDecisionsMutation.mutateAsync,
    submitResolution: submitResolutionMutation.mutateAsync,
    updateResolution: updateResolutionMutation.mutateAsync,
    reopenPaper: reopenPaperMutation.mutateAsync,
    autoResolve: autoResolveMutation.mutateAsync,
    startProcess: startProcessMutation.mutateAsync,
    completeProcess: completeProcessMutation.mutateAsync,
    upsertStrategy: upsertStrategyMutation.mutateAsync,
    bulkChecklists: bulkChecklistsMutation.mutateAsync,
    bulkCriteria: bulkCriteriaMutation.mutateAsync,
    exportCsv,
  };
}
