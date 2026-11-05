import { useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "../../../../constants/queryKeys";
import { getErrorMessage } from "../../../../utils/errorUtils";
import { toastError, toastSuccess } from "../../../../utils/toast";
import synthesisExecutionService from "../../../../services/synthesisExecutionService";
import type {
  AddEvidenceRequest,
  CreateThemeRequest,
  ResearchQuestionFindingDto,
  SaveFindingRequest,
  SourceDataGroupDto,
  SynthesisProcessStatus,
  SynthesisThemeDto,
  SynthesisWorkspaceDto,
  UpdateThemeRequest,
} from "../../../../types/synthesisExecution";

export interface UseSynthesisWorkspaceReturn {
  reviewProcessId: string | undefined;
  workspace: SynthesisWorkspaceDto | undefined;
  sourceDataGroups: SourceDataGroupDto[];
  themes: SynthesisThemeDto[];
  findings: ResearchQuestionFindingDto[];
  processStatus: SynthesisProcessStatus | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  refetchWorkspace: () => Promise<unknown>;
  startSynthesis: () => Promise<void>;
  completeSynthesis: () => Promise<void>;
  createTheme: (request: CreateThemeRequest) => Promise<void>;
  updateTheme: (themeId: string, request: UpdateThemeRequest) => Promise<void>;
  deleteTheme: (themeId: string) => Promise<void>;
  linkEvidence: (themeId: string, request: AddEvidenceRequest) => Promise<void>;
  unlinkEvidence: (evidenceId: string) => Promise<void>;
  saveFinding: (findingId: string, request: SaveFindingRequest) => Promise<void>;
  isStarting: boolean;
  isCompleting: boolean;
  isCreatingTheme: boolean;
  isUpdatingTheme: boolean;
  isDeletingTheme: boolean;
  isLinkingEvidence: boolean;
  isUnlinkingEvidence: boolean;
  isSavingFinding: boolean;
  allFindingsFinalized: boolean;
  finalizedFindingCount: number;
  evidenceCount: number;
}

export function useSynthesisWorkspace(): UseSynthesisWorkspaceReturn {
  const queryClient = useQueryClient();
  const { processId } = useParams<{ processId: string }>();
  const reviewProcessId = processId;

  const workspaceQuery = useQuery({
    queryKey: QUERY_KEYS.synthesisExecution.workspace(reviewProcessId || ""),
    queryFn: () => {
      if (!reviewProcessId) {
        return Promise.reject(new Error("Missing review process id"));
      }

      return synthesisExecutionService.getWorkspace(reviewProcessId);
    },
    enabled: Boolean(reviewProcessId),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const sourceDataGroupsQuery = useQuery({
    queryKey: QUERY_KEYS.synthesisExecution.sourceDataGroups(reviewProcessId || ""),
    queryFn: () => {
      if (!reviewProcessId) {
        return Promise.reject(new Error("Missing review process id"));
      }

      return synthesisExecutionService.getSourceDataGroups(reviewProcessId);
    },
    enabled: Boolean(reviewProcessId && workspaceQuery.data?.process.status !== "NotStarted"),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const synthesisProcessId = workspaceQuery.data?.process.id;

  const invalidateWorkspace = useCallback(() => {
    if (!reviewProcessId) {
      return;
    }

    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.synthesisExecution.workspace(reviewProcessId),
    });
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.synthesisExecution.sourceDataGroups(reviewProcessId),
    });
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.reviewProcesses.detail(reviewProcessId),
    });
  }, [queryClient, reviewProcessId]);

  const startMutation = useMutation({
    mutationFn: (id: string) => synthesisExecutionService.start(id),
    onSuccess: () => {
      invalidateWorkspace();
      toastSuccess("Synthesis started", "The synthesis workspace is now available.");
    },
    onError: (error) => {
      toastError("Start Failed", getErrorMessage(error, "Failed to start synthesis"));
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => synthesisExecutionService.complete(id),
    onSuccess: () => {
      invalidateWorkspace();
      toastSuccess("Synthesis completed", "The synthesis module has been finalized.");
    },
    onError: (error) => {
      toastError("Complete Failed", getErrorMessage(error, "Failed to complete synthesis"));
    },
  });

  const createThemeMutation = useMutation({
    mutationFn: ({ processId, request }: { processId: string; request: CreateThemeRequest }) =>
      synthesisExecutionService.createTheme(processId, request),
    onSuccess: () => {
      invalidateWorkspace();
      toastSuccess("Theme created", "A new synthesis theme has been added.");
    },
    onError: (error) => {
      toastError("Create Theme Failed", getErrorMessage(error, "Failed to create theme"));
    },
  });

  const updateThemeMutation = useMutation({
    mutationFn: ({ themeId, request }: { themeId: string; request: UpdateThemeRequest }) =>
      synthesisExecutionService.updateTheme(themeId, request),
    onSuccess: () => {
      invalidateWorkspace();
      toastSuccess("Theme updated", "Theme details were saved successfully.");
    },
    onError: (error) => {
      toastError("Update Theme Failed", getErrorMessage(error, "Failed to update theme"));
    },
  });

  const deleteThemeMutation = useMutation({
    mutationFn: (themeId: string) => synthesisExecutionService.deleteTheme(themeId),
    onSuccess: () => {
      invalidateWorkspace();
      toastSuccess("Theme deleted", "The selected theme has been removed.");
    },
    onError: (error) => {
      toastError("Delete Theme Failed", getErrorMessage(error, "Failed to delete theme"));
    },
  });

  const linkEvidenceMutation = useMutation({
    mutationFn: ({ themeId, request }: { themeId: string; request: AddEvidenceRequest }) =>
      synthesisExecutionService.addEvidence(themeId, request),
    onSuccess: () => {
      invalidateWorkspace();
      toastSuccess("Evidence linked", "Raw extracted data has been attached to the theme.");
    },
    onError: (error) => {
      toastError("Link Evidence Failed", getErrorMessage(error, "Failed to link evidence"));
    },
  });

  const unlinkEvidenceMutation = useMutation({
    mutationFn: (evidenceId: string) => synthesisExecutionService.removeEvidence(evidenceId),
    onSuccess: () => {
      invalidateWorkspace();
      toastSuccess("Evidence unlinked", "The evidence was removed from the theme.");
    },
    onError: (error) => {
      toastError("Unlink Evidence Failed", getErrorMessage(error, "Failed to unlink evidence"));
    },
  });

  const saveFindingMutation = useMutation({
    mutationFn: ({ findingId, request }: { findingId: string; request: SaveFindingRequest }) =>
      synthesisExecutionService.saveFinding(findingId, request),
    onSuccess: () => {
      invalidateWorkspace();
      toastSuccess("Finding saved", "Research question findings have been updated.");
    },
    onError: (error) => {
      toastError("Save Failed", getErrorMessage(error, "Failed to save finding"));
    },
  });

  const allFindingsFinalized = useMemo(() => {
    return (workspaceQuery.data?.findings ?? []).length > 0
      && (workspaceQuery.data?.findings ?? []).every((finding) => finding.status === "Finalized");
  }, [workspaceQuery.data?.findings]);

  const finalizedFindingCount = useMemo(() => {
    return (workspaceQuery.data?.findings ?? []).filter((finding) => finding.status === "Finalized").length;
  }, [workspaceQuery.data?.findings]);

  const evidenceCount = useMemo(() => {
    return (workspaceQuery.data?.themes ?? []).reduce(
      (total, theme) => total + theme.evidences.length,
      0,
    );
  }, [workspaceQuery.data?.themes]);

  const workspaceError = workspaceQuery.error
    ? getErrorMessage(workspaceQuery.error, "Failed to load synthesis workspace")
    : sourceDataGroupsQuery.error
      ? getErrorMessage(sourceDataGroupsQuery.error, "Failed to load extracted data")
      : null;

  return {
    reviewProcessId,
    workspace: workspaceQuery.data,
    sourceDataGroups: sourceDataGroupsQuery.data ?? [],
    themes: workspaceQuery.data?.themes ?? [],
    findings: workspaceQuery.data?.findings ?? [],
    processStatus: workspaceQuery.data?.process.status,
    isLoading: workspaceQuery.isLoading || sourceDataGroupsQuery.isLoading,
    isFetching: workspaceQuery.isFetching || sourceDataGroupsQuery.isFetching,
    error: workspaceError,
    refetchWorkspace: async () => {
      await Promise.all([
        workspaceQuery.refetch(),
        sourceDataGroupsQuery.refetch(),
      ]);
    },
    startSynthesis: async () => {
      if (!reviewProcessId) {
        return;
      }

      await startMutation.mutateAsync(reviewProcessId);
    },
    completeSynthesis: async () => {
      if (!reviewProcessId) {
        return;
      }

      await completeMutation.mutateAsync(reviewProcessId);
    },
    createTheme: async (request) => {
      if (!synthesisProcessId) {
        return;
      }

      await createThemeMutation.mutateAsync({ processId: synthesisProcessId, request });
    },
    updateTheme: async (themeId, request) => {
      await updateThemeMutation.mutateAsync({ themeId, request });
    },
    deleteTheme: async (themeId) => {
      await deleteThemeMutation.mutateAsync(themeId);
    },
    linkEvidence: async (themeId, request) => {
      await linkEvidenceMutation.mutateAsync({ themeId, request });
    },
    unlinkEvidence: async (evidenceId) => {
      await unlinkEvidenceMutation.mutateAsync(evidenceId);
    },
    saveFinding: async (findingId, request) => {
      await saveFindingMutation.mutateAsync({ findingId, request });
    },
    isStarting: startMutation.isPending,
    isCompleting: completeMutation.isPending,
    isCreatingTheme: createThemeMutation.isPending,
    isUpdatingTheme: updateThemeMutation.isPending,
    isDeletingTheme: deleteThemeMutation.isPending,
    isLinkingEvidence: linkEvidenceMutation.isPending,
    isUnlinkingEvidence: unlinkEvidenceMutation.isPending,
    isSavingFinding: saveFindingMutation.isPending,
    allFindingsFinalized,
    finalizedFindingCount,
    evidenceCount,
  };
}
