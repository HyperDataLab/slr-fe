import { useState, useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { useProjectMember } from "../../../../../hooks/useProjectMember";
import { toastSuccess, toastError, toastInfo } from "../../../../../utils/toast";
import type { RootState } from "../../../../../redux/store";
import { studySelectionService } from "../../../../../services/studySelectionService";
import { QUERY_KEYS } from "../../../../../constants/queryKeys";
import { getErrorMessage } from "../../../../../utils/errorUtils";
import { useDebounce } from "../../../../../hooks/useDebounce";
import {
  PaperSortBy,
  PaperSelectionStatus,
  PaperPhase,
} from "../../../../../types/studySelection";
import type { AssignedPapersParams } from "../../../../../types/studySelection";
import type {
  ScreeningPaper,
  ScreeningStats,
  PaperFilters,
  PaginationInfo,
  StatusFilter,
  UseStudySelectionReturn,
  ScreeningDecision,
} from "../types";
import { adaptAssignedPaper, adaptStatistics, adaptPaperWithDecisions } from "../types";
import { SCREENING_SHORTCUTS } from "../constants";
import type { UploadPdfOptions } from "../../uploadTypes";
import { readWorkspaceFilters, saveWorkspaceFilters, workspaceFilterKey } from "../../workspaceState";

// ============================================
// Helpers
// ============================================

const DEFAULT_PAGE_SIZE = 20;

const DEFAULT_STATS: ScreeningStats = {
  total: 0,
  pending: 0,
  included: 0,
  excluded: 0,
  conflicted: 0,
  completionPercentage: 0,
};

function mapStatusFilter(status: StatusFilter): PaperSelectionStatus | undefined {
  switch (status) {
    case "pending":
      return PaperSelectionStatus.Pending;
    case "included":
      return PaperSelectionStatus.Included;
    case "excluded":
      return PaperSelectionStatus.Excluded;
    case "conflicted":
      return PaperSelectionStatus.Conflict;
    default:
      return undefined;
  }
}

// ============================================
// Hook: useStudySelection
// ============================================

export function useStudySelection(
  phase: PaperPhase = PaperPhase.TitleAbstract,
  selectedPaperIdOverride?: string | null,
): UseStudySelectionReturn {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { projectId, processId, screeningProcessId, paperId: routePaperId } = useParams<{
    projectId: string;
    processId: string;
    screeningProcessId: string;
    paperId: string;
  }>();
  const filterKey = workspaceFilterKey(screeningProcessId, "title-abstract");
  const hasListContext = Boolean((location.state as { listPath?: string } | null)?.listPath);

  const currentUser = useSelector((state: RootState) => state.auth.user);
  const { member } = useProjectMember(projectId);
  const isLeader = member?.role === 1;

  // ---- Local UI State ----
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);

  const [filters, setFilters] = useState<PaperFilters>(() => {
    const defaults: PaperFilters = {
    search: "",
    status: "all",
    sortBy: PaperSortBy.TitleAsc,
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    hasFullText: false,
    hasConflict: false,
    decidedByMe: false,
    hasReferences: false,
    hasCitations: false,
    };
    return routePaperId && !hasListContext ? defaults : readWorkspaceFilters(filterKey, defaults);
  });

  useEffect(() => saveWorkspaceFilters(filterKey, filters), [filterKey, filters]);

  const [graphDepth, setGraphDepth] = useState(2);
  const [minConfidence, setMinConfidence] = useState(0.1);

  // Debounce search input for server-side API calls
  const debouncedSearch = useDebounce(filters.search, 400);

  // ---- Build API params from filters ----
  const apiParams: AssignedPapersParams = useMemo(
    () => ({
      phase,
      search: debouncedSearch || undefined,
      status: mapStatusFilter(filters.status),
      sortBy: filters.sortBy,
      pageNumber: filters.pageNumber,
      pageSize: filters.pageSize,
      hasFullText: filters.hasFullText || undefined,
      hasConflict: filters.hasConflict || undefined,
      // Note: the backend AssignedPaperParams might not have these yet,
      // but we include them here for completeness since we're extending the UI.
      hasReferences: filters.hasReferences || undefined,
      hasCitations: filters.hasCitations || undefined,
    }),
    [
      debouncedSearch,
      filters.status,
      filters.sortBy,
      filters.pageNumber,
      filters.pageSize,
      filters.hasFullText,
      filters.hasConflict,
      filters.hasReferences,
      filters.hasCitations,
      phase,
    ],
  );

  // ---- React Query: Fetch Papers with Decisions (paginated) ----
  const papersQuery = useQuery({
    queryKey: QUERY_KEYS.studySelection.papers(
      screeningProcessId ?? "",
      apiParams as unknown as Record<string, unknown>,
    ),
    queryFn: () => studySelectionService.getAssignedPapers(screeningProcessId!, apiParams),
    enabled: !!screeningProcessId,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  // ---- React Query: Fetch Statistics ----
  const taStatsQuery = useQuery({
    queryKey: QUERY_KEYS.studySelection.statistics(screeningProcessId ?? "", "TitleAbstract"),
    queryFn: () => studySelectionService.getStatistics(screeningProcessId!, "TitleAbstract"),
    enabled: !!screeningProcessId,
    staleTime: 60_000,
  });

  const ftStatsQuery = useQuery({
    queryKey: QUERY_KEYS.studySelection.statistics(screeningProcessId ?? "", "FullText"),
    queryFn: () => studySelectionService.getStatistics(screeningProcessId!, "FullText"),
    enabled: !!screeningProcessId,
    staleTime: 60_000,
  });

  // Adapt API response → UI ScreeningPaper[]
  const papers: ScreeningPaper[] = useMemo(
    () => (papersQuery.data?.data?.items ?? []).map(adaptAssignedPaper),
    [papersQuery.data],
  );

  // Pagination info from API response
  const pagination: PaginationInfo = useMemo(() => {
    const data = papersQuery.data?.data;
    return {
      pageNumber: data?.pageNumber ?? filters.pageNumber,
      pageSize: data?.pageSize ?? filters.pageSize,
      totalCount: data?.totalCount ?? 0,
      totalPages: data?.totalPages ?? 0,
      hasNextPage: data?.hasNextPage ?? false,
      hasPreviousPage: data?.hasPreviousPage ?? false,
    };
  }, [papersQuery.data, filters.pageNumber, filters.pageSize]);

  // Statistics from API
  const stats: ScreeningStats = useMemo(
    () => (taStatsQuery.data?.data ? adaptStatistics(taStatsQuery.data.data) : DEFAULT_STATS),
    [taStatsQuery.data],
  );

  const fullTextStats: ScreeningStats = useMemo(
    () => (ftStatsQuery.data?.data ? adaptStatistics(ftStatsQuery.data.data) : DEFAULT_STATS),
    [ftStatsQuery.data],
  );

  // Resolve selected paper from current page without mutating state in effects.
  const resolvedSelectedId = useMemo(() => {
    if (routePaperId) return routePaperId;
    // Allow callers (e.g., modal viewer) to force discovery/detail queries for a specific paper.
    if (selectedPaperIdOverride) {
      return selectedPaperIdOverride;
    }
    if (papers.length === 0) {
      return null;
    }
    if (selectedPaperId && papers.some((p) => p.id === selectedPaperId)) {
      return selectedPaperId;
    }
    return papers[0].id;
  }, [selectedPaperIdOverride, routePaperId, papers, selectedPaperId]);

  // ---- React Query: Fetch Paper Details ----
  const paperDetailsQuery = useQuery({
    queryKey: QUERY_KEYS.studySelection.paperDetails(
      screeningProcessId ?? "",
      resolvedSelectedId ?? "",
      phase,
    ),
    queryFn: () => studySelectionService.getPaperDetails(screeningProcessId!, resolvedSelectedId!, phase),
    enabled: !!screeningProcessId && !!resolvedSelectedId && (isLeader || !!routePaperId),
    staleTime: 30_000,
  });

  // ---- Selected Paper ----
  const detailedPaper = useMemo(
    () =>
      paperDetailsQuery.data?.data ? adaptPaperWithDecisions(paperDetailsQuery.data.data) : null,
    [paperDetailsQuery.data],
  );

  const selectedPaper = useMemo(() => {
    const fromList = papers.find((p) => p.id === resolvedSelectedId) ?? null;
    return detailedPaper || fromList;
  }, [papers, resolvedSelectedId, detailedPaper]);

  // ---- Paper Selection ----
  const selectPaper = useCallback((paperId: string) => {
    setSelectedPaperId(paperId);
  }, []);

  const selectNextPaper = useCallback(() => {
    const idx = papers.findIndex((p) => p.id === resolvedSelectedId);
    if (idx < papers.length - 1) {
      setSelectedPaperId(papers[idx + 1].id);
    }
  }, [papers, resolvedSelectedId]);

  const selectPreviousPaper = useCallback(() => {
    const idx = papers.findIndex((p) => p.id === resolvedSelectedId);
    if (idx > 0) {
      setSelectedPaperId(papers[idx - 1].id);
    }
  }, [papers, resolvedSelectedId]);

  // ---- Mutation: Submit Screening Decision ----
  const decisionMutation = useMutation({
    mutationFn: async (vars: {
      paperId: string;
      decision: number;
      comment?: string | null;
      exclusionReasonId?: string;
    }) => {
      if (!currentUser?.id) {
        throw new Error("Cannot submit screening decision: user is not authenticated.");
      }

      return studySelectionService.submitDecision(screeningProcessId!, vars.paperId, {
        reviewerId: currentUser.id,
        decision: vars.decision as 0 | 1,
        phase,
        comment: vars.comment ?? null,
        exclusionReasonId: vars.exclusionReasonId ?? null,
      });
    },
    onSuccess: (_, variables) => {
      // Invalidate papers (all pages) and statistics
      queryClient.invalidateQueries({
        queryKey: ["study-selection", screeningProcessId!, "papers"],
      });
      queryClient.invalidateQueries({
        queryKey: ["study-selection", screeningProcessId!, "statistics"],
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.studySelection.paperDetails(screeningProcessId!, variables.paperId),
      });
      queryClient.invalidateQueries({
        queryKey: ["reviewer-decisions", screeningProcessId, variables.paperId],
      });
      queryClient.invalidateQueries({
        queryKey: ["infinite-title-abstract-assignment-papers", screeningProcessId],
      });
      queryClient.invalidateQueries({
        queryKey: ["infinite-full-text-assignment-papers", screeningProcessId],
      });
      queryClient.invalidateQueries({
        queryKey: ["study-selection", screeningProcessId!, "conflict-status"],
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.reviewProcesses.all,
      });
      queryClient.invalidateQueries({
        queryKey: ["data-extraction-conducting", "dashboard"],
      });
    },
    onError: (error) => {
      toastError(getErrorMessage(error, "Failed to submit screening decision"));
    },
  });

  // ---- Screening Actions ----
  const includePaper = useCallback(
    (paperId: string, comment?: string | null) => {
      decisionMutation.mutate(
        { paperId, decision: 0, comment }, // Include
        {
          onSuccess: () => {
            // Auto-advance to next pending paper on current page
            const idx = papers.findIndex((p) => p.id === paperId);
            const nextPending = papers.slice(idx + 1).find((p) => p.screeningStatus === "pending");
            if (nextPending) {
              if (routePaperId && projectId && processId && screeningProcessId) {
                navigate(`/projects/${projectId}/processes/${processId}/screening/${screeningProcessId}/papers/${nextPending.id}`, { state: location.state });
              } else {
                setSelectedPaperId(nextPending.id);
              }
            }
            toastSuccess("Paper included");
          },
        },
      );
    },
    [decisionMutation, papers, navigate, projectId, processId, screeningProcessId, location.state, routePaperId],
  );

  const excludePaper = useCallback(
    (paperId: string, exclusionReasonId: string | null, comment: string | null) => {
      decisionMutation.mutate(
        {
          paperId,
          decision: 1,
          exclusionReasonId: exclusionReasonId ?? undefined,
          comment: comment ?? undefined,
        }, // Exclude
        {
          onSuccess: () => {
            const idx = papers.findIndex((p) => p.id === paperId);
            const nextPending = papers.slice(idx + 1).find((p) => p.screeningStatus === "pending");
            if (nextPending) {
              if (routePaperId && projectId && processId && screeningProcessId) {
                navigate(`/projects/${projectId}/processes/${processId}/screening/${screeningProcessId}/papers/${nextPending.id}`, { state: location.state });
              } else {
                setSelectedPaperId(nextPending.id);
              }
            }
            toastSuccess("Paper excluded");
          },
        },
      );
    },
    [decisionMutation, papers, navigate, projectId, processId, screeningProcessId, location.state, routePaperId],
  );

  // ---- Filter Actions (reset to page 1 on filter/sort change) ----
  const setSearch = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search, pageNumber: 1 }));
  }, []);

  const setStatusFilter = useCallback((status: StatusFilter) => {
    setFilters((prev) => ({ ...prev, status, pageNumber: 1 }));
  }, []);

  const setSort = useCallback((sortBy: PaperSortBy) => {
    setFilters((prev) => ({ ...prev, sortBy, pageNumber: 1 }));
  }, []);

  const setHasFullTextFilter = useCallback((enabled: boolean) => {
    setFilters((prev) => ({ ...prev, hasFullText: enabled, pageNumber: 1 }));
  }, []);

  const setHasConflictFilter = useCallback((enabled: boolean) => {
    setFilters((prev) => ({ ...prev, hasConflict: enabled, pageNumber: 1 }));
  }, []);

  const setDecidedByMeFilter = useCallback((enabled: boolean) => {
    setFilters((prev) => ({ ...prev, decidedByMe: enabled, pageNumber: 1 }));
  }, []);

  const setHasReferencesFilter = useCallback((enabled: boolean) => {
    setFilters((prev) => ({ ...prev, hasReferences: enabled, pageNumber: 1 }));
  }, []);

  const setHasCitationsFilter = useCallback((enabled: boolean) => {
    setFilters((prev) => ({ ...prev, hasCitations: enabled, pageNumber: 1 }));
  }, []);

  const goToPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, pageNumber: page }));
    queryClient.invalidateQueries({
      queryKey: ["study-selection", screeningProcessId!, "conflict-status"],
    });
  }, [queryClient, screeningProcessId]);

  const setPageSize = useCallback((pageSize: number) => {
    setFilters((prev) => ({ ...prev, pageSize, pageNumber: 1 }));
  }, []);

  // ---- Mutation: Upload Full-Text PDF ----
  const uploadPaperPdfMutation = useMutation({
    mutationFn: async (vars: { paperId: string; file: File; options?: UploadPdfOptions }) => {
      if (!projectId) {
        throw new Error("Cannot upload PDF: missing project context.");
      }

      return studySelectionService.uploadPaperFullText({
        file: vars.file,
        projectId,
        paperId: vars.paperId,
        extractWithGrobid: vars.options?.extractWithGrobid,
      });
    },
    onSuccess: (response, variables) => {
      if (screeningProcessId) {
        queryClient.invalidateQueries({
          queryKey: ["study-selection", screeningProcessId, "papers"],
        });
      }
      if (screeningProcessId) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.studySelection.fullTextAssignmentPapers(screeningProcessId),
        });
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.studySelection.titleAbstractAssignmentPapers(screeningProcessId),
        });
      }

      if (variables.options?.extractWithGrobid) {
        if (response.data.extractionSuggestion) {
          toastSuccess("PDF uploaded. Review AI metadata suggestions.");
          return;
        }
        toastSuccess("PDF uploaded. Full-text extraction is running in the background.");
        return;
      }

      toastSuccess("PDF uploaded successfully.");
    },
    onError: (error) => {
      toastError(getErrorMessage(error, "Failed to upload PDF"));
    },
  });

  const uploadPaperPdf = useCallback(
    async (paperId: string, file: File, options?: UploadPdfOptions) => {
      const response = await uploadPaperPdfMutation.mutateAsync({ paperId, file, options });
      return response.data;
    },
    [uploadPaperPdfMutation],
  );

  const applyMetadataSuggestionMutation = useMutation({
    mutationFn: async (vars: { paperId: string; sourceMetadataId: string; fields: string[] }) => {
      return studySelectionService.applyMetadata(vars.paperId, {
        sourceMetadataId: vars.sourceMetadataId,
        fields: vars.fields,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["study-selection", screeningProcessId!, "papers"],
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.papers.all,
      });
      toastSuccess("Selected metadata applied successfully.");
    },
    onError: () => {
      toastError("Failed to apply metadata. Please try again.");
    },
  });

  const applyMetadataSuggestion = useCallback(
    async (paperId: string, sourceMetadataId: string, fields: string[]) => {
      await applyMetadataSuggestionMutation.mutateAsync({ paperId, sourceMetadataId, fields });
    },
    [applyMetadataSuggestionMutation],
  );

  const retryMetadataExtractionMutation = useMutation({
    mutationFn: async (paperId: string) => {
      if (!projectId) throw new Error("Cannot retry extraction: missing project.");
      return studySelectionService.retryExtraction(paperId, { provider: "GROBID", projectId });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({
        queryKey: ["study-selection", screeningProcessId!, "papers"],
      });

      const extraction = response.data.extraction;
      if (extraction?.status === "failed") {
        toastError(extraction.message ?? "Metadata extraction failed.");
        return;
      }

      if (extraction?.status === "partial") {
        toastInfo("Metadata extraction partially completed.");
        return;
      }

      toastSuccess("Metadata extraction completed successfully.");
    },
    onError: (error) => {
      toastError(getErrorMessage(error, "Failed to retry metadata extraction"));
    },
  });

  const retryMetadataExtraction = useCallback(
    async (paperId: string) => {
      await retryMetadataExtractionMutation.mutateAsync(paperId);
    },
    [retryMetadataExtractionMutation],
  );

  // ---- AI Analysis ----
  const aiAnalysisQuery = useQuery({
    queryKey: QUERY_KEYS.studySelection.aiAnalysis(
      screeningProcessId ?? "",
      resolvedSelectedId ?? "",
      phase,
    ),
    queryFn: () =>
      studySelectionService.getAiAnalysisResult(screeningProcessId!, resolvedSelectedId!, phase),
    enabled: !!screeningProcessId && !!resolvedSelectedId,
    staleTime: 60_000,
    retry: false,
  });

  // ---- Discovery Queries ----
  const referencesQuery = useQuery({
    queryKey: QUERY_KEYS.papers.references(resolvedSelectedId ?? ""),
    queryFn: () => studySelectionService.getReferences(resolvedSelectedId!),
    enabled: !!resolvedSelectedId,
    staleTime: 5 * 60 * 1000,
  });

  const citationsQuery = useQuery({
    queryKey: QUERY_KEYS.papers.citations(resolvedSelectedId ?? ""),
    queryFn: () => studySelectionService.getCitations(resolvedSelectedId!),
    enabled: !!resolvedSelectedId,
    staleTime: 5 * 60 * 1000,
  });

  const suggestionsQuery = useQuery({
    queryKey: QUERY_KEYS.papers.suggestions(resolvedSelectedId ?? "", { limit: 5 }),
    queryFn: () => studySelectionService.getSuggestions(resolvedSelectedId!, { limit: 5 }),
    enabled: !!resolvedSelectedId,
    staleTime: 5 * 60 * 1000,
  });

  const graphQuery = useQuery({
    queryKey: QUERY_KEYS.papers.graph(resolvedSelectedId ?? "", graphDepth, minConfidence),
    queryFn: () =>
      studySelectionService.getCitationGraph(resolvedSelectedId!, {
        depth: graphDepth,
        minConfidence,
      }),
    enabled: !!resolvedSelectedId,
    staleTime: 5 * 60 * 1000,
  });

  const aiAnalysisMutation = useMutation({
    mutationFn: async (paperId: string) => {
      if (!screeningProcessId) {
        throw new Error("Missing screening process ID");
      }
      if (phase === PaperPhase.FullText) {
        return studySelectionService.evaluateFullTextAi(screeningProcessId, paperId);
      }
      return studySelectionService.evaluateAi(screeningProcessId, paperId);
    },
    onSuccess: (data, paperId) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.studySelection.aiAnalysis(screeningProcessId!, paperId, phase),
      });
      if (data.message) {
        toastSuccess(data.message);
      }
    },
    onError: (error) => {
      toastError(getErrorMessage(error, "Failed to run AI analysis"));
    },
  });

  const runAiAnalysis = useCallback(
    (paperId: string) => {
      aiAnalysisMutation.mutate(paperId);
    },
    [aiAnalysisMutation],
  );

  // ---- Conflict Resolution (leader only) ----
  const conflictMutation = useMutation({
    mutationFn: async (vars: { paperId: string; decision: ScreeningDecision; notes?: string }) => {
      if (!currentUser?.id) {
        throw new Error("Cannot resolve conflict: user is not authenticated.");
      }
      return studySelectionService.resolveConflict(screeningProcessId!, vars.paperId, {
        finalDecision: vars.decision === "included" ? 0 : 1,
        phase,
        resolvedBy: currentUser.id,
        resolutionNotes: vars.notes ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["study-selection", screeningProcessId!, "papers"],
      });
      queryClient.invalidateQueries({
        queryKey: ["study-selection", screeningProcessId!, "statistics"],
      });
      queryClient.invalidateQueries({
        queryKey: ["study-selection", screeningProcessId!, "conflict-status"],
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.reviewProcesses.all,
      });
      toastSuccess("Conflict resolved");
    },
    onError: (error) => {
      toastError(getErrorMessage(error, "Failed to resolve conflict"));
    },
  });

  const resolveConflict = useCallback(
    (paperId: string, decision: ScreeningDecision, notes?: string) => {
      conflictMutation.mutate({ paperId, decision, notes });
    },
    [conflictMutation],
  );

  const hasMyDecision = useMemo(() => {
    if (!currentUser || !selectedPaper) return false;
    return selectedPaper.decisions.some((d) => d.reviewerId === currentUser.id);
  }, [selectedPaper, currentUser]);

  const canReview = useMemo(() => {
    if (!selectedPaper || hasMyDecision) return false;
    return (
      selectedPaper.screeningStatus === "pending" || selectedPaper.screeningStatus === "conflicted"
    );
  }, [selectedPaper, hasMyDecision]);

  // ---- Navigation ----
  const handleBack = useCallback(() => {
    navigate(`/projects/${projectId}/processes/${processId}`);
  }, [navigate, projectId, processId]);

  // ---- Keyboard Shortcuts ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === SCREENING_SHORTCUTS.INCLUDE && canReview) {
        e.preventDefault();
        includePaper(selectedPaper!.id);
      } else if (e.key === SCREENING_SHORTCUTS.EXCLUDE && canReview) {
        e.preventDefault();
        // excludePaper(selectedPaper.id); // Disabled shortcut because it requires interactive input (reason/code)
      } else if (e.key === SCREENING_SHORTCUTS.NEXT_PAPER) {
        e.preventDefault();
        selectNextPaper();
      } else if (e.key === SCREENING_SHORTCUTS.PREV_PAPER) {
        e.preventDefault();
        selectPreviousPaper();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedPaper, includePaper, excludePaper, selectNextPaper, selectPreviousPaper, canReview]);

  const papersError = papersQuery.error
    ? getErrorMessage(papersQuery.error, "Failed to load screening papers")
    : null;
  const statsError = taStatsQuery.error
    ? getErrorMessage(taStatsQuery.error, "Failed to load title/abstract statistics")
    : ftStatsQuery.error
      ? getErrorMessage(ftStatsQuery.error, "Failed to load full-text statistics")
      : null;

  return {
    papers,
    selectedPaper,
    stats,
    fullTextStats,
    filters,
    pagination,
    isLoading:
      papersQuery.isLoading ||
      taStatsQuery.isLoading ||
      ftStatsQuery.isLoading ||
      ((isLeader || !!routePaperId) && paperDetailsQuery.isLoading),
    error: papersError || statsError || ((isLeader || !!routePaperId) && paperDetailsQuery.error
      ? getErrorMessage(paperDetailsQuery.error, "Failed to load paper details")
      : null),
    papersError,
    statsError,
    refetch: async () => {
      await Promise.all([
        papersQuery.refetch(),
        taStatsQuery.refetch(),
        ftStatsQuery.refetch(),
        ...((isLeader || !!routePaperId) ? [paperDetailsQuery.refetch()] : []),
      ]);
    },
    selectPaper,
    selectNextPaper,
    selectPreviousPaper,
    includePaper,
    excludePaper,
    uploadPaperPdf,
    applyMetadataSuggestion,
    retryMetadataExtraction,
    isSubmitting: decisionMutation.isPending,
    isUploadingPdf: uploadPaperPdfMutation.isPending,
    isApplyingMetadataSuggestion: applyMetadataSuggestionMutation.isPending,
    isRetryingExtraction: retryMetadataExtractionMutation.isPending,
    aiAnalysis: aiAnalysisQuery.data?.data ?? null,
    isAnalyzing: aiAnalysisQuery.isFetching || aiAnalysisMutation.isPending,
    runAiAnalysis,

    // Discovery
    references: referencesQuery.data?.data ?? [],
    citations: citationsQuery.data?.data ?? [],
    suggestions: suggestionsQuery.data?.data ?? [],
    citationGraph: graphQuery.data?.data ?? null,
    isDiscoveryLoading:
      referencesQuery.isLoading ||
      citationsQuery.isLoading ||
      suggestionsQuery.isLoading ||
      graphQuery.isLoading,
    graphDepth,
    setGraphDepth,
    minConfidence,
    setMinConfidence,

    resolveConflict,
    isResolving: conflictMutation.isPending,
    setSearch,
    setStatusFilter,
    setSort,
    setHasFullTextFilter,
    setHasConflictFilter,
    setDecidedByMeFilter,
    setHasReferencesFilter,
    setHasCitationsFilter,
    goToPage,
    setPageSize,
    handleBack,
  };
}
