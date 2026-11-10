// Custom hook for Review Process Workspace logic
// Uses React Query hooks — data fetching is declarative

import { useMemo, useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProjectMember, useProjectMembers } from "./useProjectMember";
import { useReviewProcess, useReviewProcessMutations } from "./useReviewProcesses";
import {
  useIdentificationProcessMutations,
  useStudySelectionProcessMutations,
  useQualityAssessmentProcessMutations,
  useDataExtractionProcessMutations,
  useSynthesisProcessMutations,
} from "./usePhaseProcessMutations";
import { dataExtractionConductingService } from "../services/dataExtractionConductingService";
import synthesisExecutionService from "../services/synthesisExecutionService";
import { QUERY_KEYS } from "../constants/queryKeys";
import type { ReviewProcess } from "../types/reviewProcess";
import type {
  Alert,
  Activity,
  PhaseStats,
  ProgressStats,
  TeamMember,
} from "../types/reviewProcessWorkspace";
import type {
  WorkflowPhase,
  PhaseStatusType,
  PhaseDisplayStatus,
  PhaseStatItem,
  ProcessPaperStats,
} from "../components/reviewProcess/workflow/types";
import { WORKFLOW_PHASES } from "../components/reviewProcess/workflow/constants";
import { toastWarning, toastSuccess } from "../utils/toast";
import { getErrorCode } from "../utils/errorUtils";
import { getInitials } from "../utils/getInitials";


interface UseReviewProcessWorkspaceParams {
  projectId: string | undefined;
  processId: string | undefined;
}

const EMPTY_PHASE_STATS: PhaseStats = {
  identification: {
    recordsImported: 0,
    duplicatesRemoved: 0,
    databasesSearched: 0,
    uniqueRecords: 0,
  },
  screening: {
    totalPapers: 0,
    included: 0,
    excluded: 0,
    inScreeningCount: 0,
    conflictCount: 0,
    pendingCount: 0,
  },
  extraction: {
    studiesExtracted: 0,
    fieldsExtracted: 0,
    pending: 0,
    completed: 0,
    awaitingConsensus: 0,
  },
  quality: {
    totalPapers: 0,
    highQualityPapers: 0,
    lowQualityPapers: 0,
    inProgressPapers: 0,
    notStartedPapers: 0,
  },
  synthesis: {
    studiesSynthesized: 0,
    themes: 0,
    findings: 0,
    linkedEvidence: 0,
    status: "NotStarted",
  },
  prisma: {
    lastGenerated: "",
    version: "",
    completeness: "0%",
    status: "NotStarted",
  },
};

const EMPTY_PROGRESS_STATS: ProgressStats = {
  completionPercentage: 0,
  recordsProcessed: 0,
  totalRecords: 0,
  estimatedCompletion: "",
};

interface UseReviewProcessWorkspaceReturn {
  // Membership management
  member: ReturnType<typeof useProjectMember>["member"];
  isMemberLoading: boolean;

  // Team members
  teamMembers: TeamMember[];
  isTeamLoading: boolean;

  // Process data
  process: ReviewProcess | undefined;
  isLoading: boolean;
  error: string | null;

  // Workflow phases (derived from API response)
  workflowPhases: WorkflowPhase[];
  paperStats: ProcessPaperStats;

  // Legacy data kept for backward-compatible panels
  phaseStats: PhaseStats;
  activities: Activity[];
  alerts: Alert[];
  progressStats: ProgressStats;

  // Actions
  handleBack: () => void;
  handleStartProcess: () => Promise<void>;
  handleCompleteProcess: () => Promise<void>;
  handleOpenPhase: (phaseName: string) => void;
  handleStartPhase: (phaseKey: string) => void;
  handleCompletePhase: (phaseKey: string) => void;
  handleReopenPhase: (phaseKey: string) => void;
  pendingConfirmation: { type: "force-quality"; qualityId: string } | { type: "complete-process" } | null;
  closePendingConfirmation: () => void;
  confirmPendingAction: () => Promise<void>;
  isConfirmingPendingAction: boolean;

  // Loading states
  startLoading: boolean;
  completeLoading: boolean;
  phaseStartLoadingMap: Record<string, boolean>;
  phaseCompleteLoadingMap: Record<string, boolean>;
  phaseReopenLoadingMap: Record<string, boolean>;

  // Modal states
  isCriteriaModalOpen: boolean;
  setIsCriteriaModalOpen: (open: boolean) => void;
  isQualityCriteriaModalOpen: boolean;
  setIsQualityCriteriaModalOpen: (open: boolean) => void;
  isSynthesisStrategyModalOpen: boolean;
  setIsSynthesisStrategyModalOpen: (open: boolean) => void;

  // Computed
  completedPhases: number[];
}

// ---------------------------------------------------------------------------
// Helpers: derive phase status from the API response
// ---------------------------------------------------------------------------

function getSubprocessStatus(process: ReviewProcess, phaseKey: string): PhaseStatusType | null {
  // Map phase keys to the subprocess fields on ReviewProcess
  // if (phaseKey === "identification") {
  //   return mapApiStatus(process.identificationProcess?.statusText);
  // }
  if (phaseKey === "screening") {
    return mapApiStatus(process.studySelectionProcess?.statusText);
  }
  if (phaseKey === "quality") {
    return mapApiStatus(process.qualityAssessmentProcess?.statusText);
  }
  if (phaseKey === "extraction") {
    return mapApiStatus(process.dataExtractionProcess?.statusText);
  }
  if (phaseKey === "synthesis") {
    return mapApiStatus(process.synthesisProcess?.statusText);
  }
  // Other phases don't have dedicated subprocess objects in the API yet
  return null;
}

function getRawSubprocessStatus(process: ReviewProcess, phaseKey: string): string | number | undefined {
  if (phaseKey === "screening") return process.studySelectionProcess?.statusText;
  if (phaseKey === "quality") return process.qualityAssessmentProcess?.statusText;
  if (phaseKey === "extraction") return process.dataExtractionProcess?.statusText;
  if (phaseKey === "synthesis") return process.synthesisProcess?.statusText;
  return undefined;
}

function getDisplayStatus(rawStatus: string | number | undefined, derivedStatus: PhaseStatusType): PhaseDisplayStatus {
  if (rawStatus === "Reopened") return "Reopened";
  if (rawStatus === "Cancelled") return "Cancelled";
  return derivedStatus;
}

function isSubprocessClosed(
  statusText:
    | "Pending"
    | "NotStarted"
    | "InProgress"
    | "Reopened"
    | "Completed"
    | "Cancelled"
    | undefined,
): boolean {
  return statusText === "Completed" || statusText === "Cancelled";
}

function canStartExtractionOrQuality(process: ReviewProcess): boolean {
  // const identificationClosed =
  //   !process.identificationProcess || isSubprocessClosed(process.identificationProcess?.statusText);
  const screeningClosed = isSubprocessClosed(process.studySelectionProcess?.statusText);
  return screeningClosed;
}

function canStartSynthesis(process: ReviewProcess): boolean {
  const isExtractionClosed =
    !process.dataExtractionProcess || process.dataExtractionProcess?.statusText === "Completed";
  const isQualityClosed =
    !process.qualityAssessmentProcess ||
    process.qualityAssessmentProcess?.statusText === "Completed";
  return isExtractionClosed && isQualityClosed;
}

function mapApiStatus(
  status:
    | number
    | "Pending"
    | "NotStarted"
    | "InProgress"
    | "Reopened"
    | "Completed"
    | "Cancelled"
    | string
    | undefined,
): PhaseStatusType | null {
  if (status === undefined || status === null) return null;

  // Synthesis backend returns numeric enum values.
  if (typeof status === "number") {
    switch (status) {
      case 1:
        return "InProgress";
      case 2:
      case 3:
        return "Completed";
      case 0:
      default:
        return "NotStarted";
    }
  }

  switch (status) {
    case "InProgress":
    case "Reopened":
      return "InProgress";
    case "Completed":
      return "Completed";
    case "Pending":
    case "NotStarted":
      return "NotStarted";
    case "Cancelled":
      return "Completed"; // treat cancelled as "done" for sequential logic
    default:
      return null;
  }
}

function derivePhaseStatus(
  process: ReviewProcess,
  phaseIndex: number,
  phaseKey: string,
  previousCompleted: boolean,
): PhaseStatusType {
  // PRISMA (phase 5) is always accessible as a read-only aggregate view
  if (phaseKey === "prisma") return "NotStarted";

  // If the subprocess exists in the API, use its real status
  const subStatus = getSubprocessStatus(process, phaseKey);

  // Data Extraction and Quality Assessment are locked until both Identification and Study Selection are closed.
  if (phaseKey === "extraction" || phaseKey === "quality") {
    const isAllowed = canStartExtractionOrQuality(process);
    if (!isAllowed) {
      if (subStatus === "InProgress" || subStatus === "Completed") return subStatus;
      return "Locked";
    }
    // If allowed, use real status if available
    if (subStatus) return subStatus;

    // Fallback: derive from currentPhase
    const currentPhase = process.currentPhase ?? -1;
    if (phaseIndex < currentPhase) return "Completed";
    if (phaseIndex === currentPhase) return "InProgress";

    // Otherwise it's ready to start
    return "NotStarted";
  }

  // Synthesis is locked until Data Extraction is completed.
  // Keep InProgress/Completed synthesis visible if it already started previously.
  if (phaseKey === "synthesis" && !canStartSynthesis(process)) {
    if (subStatus === "InProgress" || subStatus === "Completed") return subStatus;
    return "Locked";
  }

  if (subStatus) return subStatus;

  // Fallback: derive from currentPhase
  const currentPhase = process.currentPhase ?? -1;
  if (phaseIndex < currentPhase) return "Completed";
  if (phaseIndex === currentPhase) return "InProgress";

  // Future phase: locked unless previous is completed
  return previousCompleted ? "NotStarted" : "Locked";
}

function buildPhaseStats(phaseKey: string, phaseStats: PhaseStats): PhaseStatItem[] {
  switch (phaseKey) {
    case "identification":
      return [
        { label: "Total Imported", value: phaseStats.identification.recordsImported },
        {
          label: "Duplicates",
          value: phaseStats.identification.duplicatesRemoved,
          variant: "warning",
        },
        { label: "Import Batches", value: phaseStats.identification.databasesSearched },
        {
          label: "Unique Records",
          value: phaseStats.identification.uniqueRecords,
          variant: "success",
        },
      ];
    case "screening":
      return [
        { label: "Total Papers", value: phaseStats.screening.totalPapers },
        { label: "Included", value: phaseStats.screening.included, variant: "success" },
        { label: "Excluded", value: phaseStats.screening.excluded },
        { label: "Awaiting decision", value: phaseStats.screening.pendingCount, variant: "warning" },
      ];
    case "quality":
      return [
        // { label: "Total Papers", value: phaseStats.quality.totalPapers },
        { label: "Total Included", value: phaseStats.quality.totalPapers },
        { label: "Passed", value: phaseStats.quality.highQualityPapers, variant: "success" },
        { label: "Failed", value: phaseStats.quality.lowQualityPapers, variant: "danger" },
        {
          label: "Not Started",
          value: phaseStats.quality.notStartedPapers + phaseStats.quality.inProgressPapers,
          variant: "warning",
        },
      ];
    case "extraction":
      return [
        { label: "Total Included", value: phaseStats.extraction.studiesExtracted },
        { label: "In Progress", value: phaseStats.extraction.pending, variant: "warning" },
        { label: "Consensus", value: phaseStats.extraction.awaitingConsensus, variant: "danger" },
        { label: "Completed", value: phaseStats.extraction.completed, variant: "success" },
      ];
    case "synthesis":
      return [
        { label: "Studies", value: phaseStats.synthesis.studiesSynthesized },
        { label: "Themes", value: phaseStats.synthesis.themes },
        { label: "Findings", value: phaseStats.synthesis.findings },
        { label: "Linked Evidence", value: phaseStats.synthesis.linkedEvidence },
      ];
    case "prisma":
      return [
        { label: "Last Generated", value: phaseStats.prisma.lastGenerated },
        { label: "Version", value: phaseStats.prisma.version },
        { label: "Completeness", value: phaseStats.prisma.completeness },
        { label: "Status", value: phaseStats.prisma.status, variant: "warning" },
      ];
    default:
      return [];
  }
}

function formatSynthesisStatus(
  status:
    | "Pending"
    | "NotStarted"
    | "InProgress"
    | "Reopened"
    | "Completed"
    | "Cancelled"
    | string
    | undefined,
): string {
  if (!status) {
    return "Not Started";
  }

  if (status === "InProgress" || status === "Reopened") {
    return "In Progress";
  }

  if (status === "Completed") {
    return "Completed";
  }

  if (status === "Cancelled") {
    return "Cancelled";
  }

  if (status === "NotStarted" || status === "Pending") {
    return "Not Started";
  }

  return status;
}

function getLockReason(phaseIndex: number, phaseKey: string): string {
  if (phaseKey === "extraction" || phaseKey === "quality") {
    return "Complete Identification and Study Selection first";
  }
  if (phaseKey === "synthesis") {
    return "Complete all other phases first";
  }
  if (phaseIndex <= 0) return "";
  const prev = WORKFLOW_PHASES[phaseIndex - 1];
  return prev ? `Complete ${prev.name} first` : "";
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useReviewProcessWorkspace = ({
  projectId,
  processId,
}: UseReviewProcessWorkspaceParams): UseReviewProcessWorkspaceReturn => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Use the new membership hook which will sync and refresh on reload/reconnect
  const { member: currentProjectMember, isLoading: isMemberLoading } = useProjectMember(projectId);

  // Fetch real project members
  const { members: projectMembers, isLoading: isTeamLoading } = useProjectMembers(projectId);

  const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState(false);
  const [isQualityCriteriaModalOpen, setIsQualityCriteriaModalOpen] = useState(false);
  const [isSynthesisStrategyModalOpen, setIsSynthesisStrategyModalOpen] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<UseReviewProcessWorkspaceReturn["pendingConfirmation"]>(null);

  // React Query: declarative data fetch — no useEffect needed
  const { process, isLoading, error } = useReviewProcess(processId);

  const {
    startReviewProcess,
    isStarting: startLoading,
    completeReviewProcess,
    isCompleting: completeLoading,
    reopenPhase,
    isReopening: reopenLoading,
  } = useReviewProcessMutations();

  // Phase-level mutations
  const {
    startIdentification,
    isStartingIdentification,
    completeIdentification,
    isCompletingIdentification,
  } = useIdentificationProcessMutations(processId);

  const {
    startStudySelection,
    isStartingStudySelection,
    completeStudySelection,
    isCompletingStudySelection,
  } = useStudySelectionProcessMutations(processId);

  const {
    startQualityAssessment,
    isStartingQualityAssessment,
    completeQualityAssessment,
    isCompletingQualityAssessment,
  } = useQualityAssessmentProcessMutations(processId);

  const {
    startDataExtraction,
    isStartingDataExtraction,
    completeDataExtraction,
    isCompletingDataExtraction,
  } = useDataExtractionProcessMutations(projectId);

  const { startSynthesis, isStartingSynthesis, completeSynthesis, isCompletingSynthesis } =
    useSynthesisProcessMutations(processId);

  const synthesisProcessId = process?.synthesisProcess?.id;

  const synthesisStrategiesQuery = useQuery({
    queryKey: QUERY_KEYS.synthesisExecution.strategies(synthesisProcessId ?? ""),
    queryFn: async () => {
      if (!synthesisProcessId) {
        throw new Error("Synthesis process ID is required");
      }

      return synthesisExecutionService.getSynthesisStrategiesByProcessId(synthesisProcessId);
    },
    enabled: !!synthesisProcessId,
    staleTime: 60_000,
  });

  const synthesisWorkspaceQuery = useQuery({
    queryKey: QUERY_KEYS.synthesisExecution.workspace(processId ?? ""),
    queryFn: async () => {
      if (!processId) {
        throw new Error("Review process ID is required");
      }

      return synthesisExecutionService.getWorkspace(processId);
    },
    enabled: !!processId && !!process?.synthesisProcess?.id,
    staleTime: 30_000,
    retry: false,
  });

  const hasSynthesisStrategy = (synthesisStrategiesQuery.data?.length ?? 0) > 0;

  // Navigation handlers
  const handleBack = useCallback(() => {
    navigate(`/projects/${projectId}/workspace/4`);
  }, [navigate, projectId]);

  const handleOpenPhase = useCallback(
    async (phaseName: string) => {
      if (!projectId || !processId || processId === "undefined" || processId === "null") return;
      if (!process || process.statusText === "NotStarted") return;

      if (phaseName === "identification" && process.identificationProcess?.id) {
        navigate(
          `/projects/${projectId}/processes/${processId}/identification/${process.identificationProcess.id}`,
        );
      } else if (phaseName === "screening") {
        const screeningId = process.studySelectionProcess?.id;
        if (!screeningId) return;
        if (currentProjectMember?.isLeader) {
          navigate(
            `/projects/${projectId}/processes/${processId}/screening/${screeningId}/dashboard`,
          );
        } else {
          navigate(`/projects/${projectId}/processes/${processId}/screening/${screeningId}`);
        }
      } else if (phaseName === "quality") {
        const qualityId = process.qualityAssessmentProcess?.id;
        if (!qualityId) return;
        navigate(`/projects/${projectId}/processes/${processId}/quality-assessment/${qualityId}`);
      } else if (phaseName === "synthesis") {
        if (processId) {
          await Promise.allSettled([
            queryClient.fetchQuery({
              queryKey: QUERY_KEYS.synthesisExecution.workspace(processId),
              queryFn: () => synthesisExecutionService.getWorkspace(processId),
              staleTime: 0,
            }),
            queryClient.fetchQuery({
              queryKey: QUERY_KEYS.synthesisExecution.sourceDataGroups(processId),
              queryFn: () => synthesisExecutionService.getSourceDataGroups(processId),
              staleTime: 0,
            }),
          ]);
        }

        navigate(`/projects/${projectId}/processes/${processId}/synthesis`);
      } else if (phaseName === "prisma") {
        navigate(`/projects/${projectId}/processes/${processId}/prisma-report`);
      } else if (phaseName === "extraction") {
        navigate(`/projects/${projectId}/extraction`, {
          state: { returnTo: `/projects/${projectId}/processes/${processId}` },
        });
      }
    },
    [currentProjectMember, navigate, process, processId, projectId, queryClient],
  );

  // Process-level action handlers
  const handleStartProcess = useCallback(async () => {
    if (!processId) return;
    try {
      await startReviewProcess(processId);
    } catch {
      // Error already handled by mutation
    }
  }, [processId, startReviewProcess]);

  // Phase-level action handlers
  const handleStartPhase = useCallback(
    async (phaseKey: string) => {
      if (!process || process.statusText === "NotStarted") return;
      try {
        if (phaseKey === "identification") {
          const identId = process.identificationProcess?.id;
          if (identId) {
            await startIdentification(identId);
          }
          return;
        }
        if (phaseKey === "screening") {
          const selectionId = process.studySelectionProcess?.id;
          if (selectionId) {
            const result = await startStudySelection(selectionId);
            if (result.data && !result.data.isHaveCriteria) {
              toastWarning(
                "Criteria Required",
                "Failed, Setup Study Selection Criteria first to start phase",
              );
              setIsCriteriaModalOpen(true);
            }
          }
          return;
        }
        if (phaseKey === "quality") {
          const qualityId = process.qualityAssessmentProcess?.id;
          if (qualityId) {
            const result = await startQualityAssessment(qualityId);
            if (result.data && !result.data.isHaveCriteria) {
              setIsQualityCriteriaModalOpen(true);
            }
          }
          return;
        }
        if (phaseKey === "extraction") {
          if (projectId) {
            await startDataExtraction();
          }
          return;
        }
        if (phaseKey === "synthesis") {
          if (processId) {
            if (!hasSynthesisStrategy) {
              setIsSynthesisStrategyModalOpen(true);
              return;
            }
            await startSynthesis(processId);
          }
          return;
        }
      } catch {
        // Errors handled by mutation hook
      }
    },
    [
      process,
      processId,
      hasSynthesisStrategy,
      projectId,
      startIdentification,
      startStudySelection,
      startQualityAssessment,
      startDataExtraction,
      startSynthesis,
    ],
  );

  const handleCompletePhase = useCallback(
    async (phaseKey: string) => {
      if (!process || process.statusText === "NotStarted") return;
      try {
        if (phaseKey === "identification") {
          const identId = process.identificationProcess?.id;
          if (identId) {
            await completeIdentification(identId);
          }
          return;
        }
        if (phaseKey === "screening") {
          const selectionId = process.studySelectionProcess?.id;
          if (selectionId) {
            await completeStudySelection(selectionId);
          }
          return;
        }
        if (phaseKey === "quality") {
          const qualityId = process.qualityAssessmentProcess?.id;
          if (qualityId) {
            try {
              await completeQualityAssessment({ id: qualityId });
            } catch (error) {
              if (getErrorCode(error) !== "QA_UNRESOLVED_PAPERS") throw error;
              setPendingConfirmation({ type: "force-quality", qualityId });
            }
          }
          return;
        }
        if (phaseKey === "extraction") {
          if (projectId) {
            await completeDataExtraction();
          }
          return;
        }
        if (phaseKey === "synthesis") {
          if (processId) {
            await completeSynthesis(processId);
          }
          return;
        }
      } catch {
        // Errors handled by mutation hook
      }
    },
    [
      process,
      processId,
      projectId,
      completeIdentification,
      completeStudySelection,
      completeQualityAssessment,
      completeDataExtraction,
      completeSynthesis,
    ],
  );
  const handleReopenPhase = useCallback(
    async (phaseKey: string) => {
      if (!processId || !process) return;

      // Find the phase definition to get the numeric ID
      const def = WORKFLOW_PHASES.find((p) => p.key === phaseKey);
      if (!def) return;

      try {
        await reopenPhase({ id: processId, phase: def.id });
      } catch {
        // Error handled by mutation
      }
    },
    [processId, process, reopenPhase],
  );

  // Build phaseStats from API data. Unknown values remain empty instead of using demo data.
  const prismaStats = process?.identificationProcess?.prismaStatistics;
  const selectionStats = process?.studySelectionProcess?.selectionStatistics;
  const qualityStats = process?.qualityAssessmentProcess?.qualityStatistics;
  // Fetch extraction dashboard data by canonical project ID for real-time statistics.
  const extractionDashboardQuery = useQuery({
    queryKey: ["data-extraction-conducting", "dashboard", projectId],
    queryFn: () => {
      if (!projectId) {
        throw new Error("Project ID is required");
      }

      return dataExtractionConductingService.getDashboard(projectId, {
        pageNumber: 1,
        pageSize: 1,
      });
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });

  const phaseStats: PhaseStats = useMemo(
    () => ({
      identification: prismaStats
        ? {
            recordsImported: prismaStats.totalRecordsImported,
            duplicatesRemoved: prismaStats.duplicateRecords,
            databasesSearched: prismaStats.importBatchCount,
            uniqueRecords: prismaStats.uniqueRecords,
          }
        : EMPTY_PHASE_STATS.identification,
      screening: selectionStats
        ? {
            totalPapers: selectionStats.totalPapers,
            included: selectionStats.includedCount,
            excluded: selectionStats.excludedCount,
            inScreeningCount: selectionStats.inScreeningCount ?? 0,
            conflictCount: selectionStats.conflictCount,
            pendingCount:
              (selectionStats.pendingCount ?? 0) +
              (selectionStats.inScreeningCount ?? 0) +
              (selectionStats.conflictCount ?? 0),
          }
        : EMPTY_PHASE_STATS.screening,
      quality: qualityStats
        ? {
            totalPapers: qualityStats.totalPapers,
            highQualityPapers: qualityStats.highQualityPapers,
            lowQualityPapers: qualityStats.lowQualityPapers,
            inProgressPapers: qualityStats.inProgressPapers,
            notStartedPapers: qualityStats.notStartedPapers,
          }
        : EMPTY_PHASE_STATS.quality,
      extraction: extractionDashboardQuery.data
        ? {
            studiesExtracted: extractionDashboardQuery.data.summary.totalIncluded,
            fieldsExtracted: 0,
            pending: extractionDashboardQuery.data.summary.inProgress,
            completed: extractionDashboardQuery.data.summary.completed,
            awaitingConsensus: extractionDashboardQuery.data.summary.awaitingConsensus,
          }
        : EMPTY_PHASE_STATS.extraction,
      synthesis: synthesisWorkspaceQuery.data
        ? {
            studiesSynthesized: synthesisWorkspaceQuery.data.totalExtractedPapers,
            themes: synthesisWorkspaceQuery.data.themes.length,
            findings: synthesisWorkspaceQuery.data.findings.length,
            linkedEvidence: synthesisWorkspaceQuery.data.themes.reduce(
              (total, theme) => total + theme.evidences.length,
              0,
            ),
            status: formatSynthesisStatus(synthesisWorkspaceQuery.data.process.status),
          }
        : {
            studiesSynthesized: process?.totalIncludedPapers ?? 0,
            themes: 0,
            findings: 0,
            linkedEvidence: 0,
            status: process?.synthesisProcess?.statusText
              ? formatSynthesisStatus(process.synthesisProcess.statusText)
              : EMPTY_PHASE_STATS.synthesis.status,
          },
      prisma: EMPTY_PHASE_STATS.prisma,
    }),
    [
      prismaStats,
      selectionStats,
      qualityStats,
      extractionDashboardQuery.data,
      synthesisWorkspaceQuery.data,
      process?.totalIncludedPapers,
      process?.synthesisProcess?.statusText,
    ],
  );

  // Derive workflow phases from process + stats
  const workflowPhases: WorkflowPhase[] = useMemo(() => {
    if (!process) return [];

    let previousCompleted = true; // first phase has no prerequisite
    return WORKFLOW_PHASES.map((def) => {
      // Skip identification if it's still in the list for some reason
      if (def.key === "identification") return null;

      // Workflow status comes from subprocess state/currentPhase; summary metrics never mark a phase complete.
      const status = derivePhaseStatus(process, def.id, def.key, previousCompleted);
      const displayStatus = getDisplayStatus(getRawSubprocessStatus(process, def.key), status);
      const stats = buildPhaseStats(def.key, phaseStats);

      // Determine subprocess id
      let subprocessId: string | undefined;
      if (def.key === "screening") subprocessId = process.studySelectionProcess?.id;
      // Extraction phases are keyed by project and do not have a subprocess identifier.
      if (def.key === "synthesis") subprocessId = process.synthesisProcess?.id;

      const phase: WorkflowPhase = {
        id: def.id,
        name: def.name,
        key: def.key,
        status,
        displayStatus,
        stats,
        subprocessId,
        lockReason: status === "Locked" ? getLockReason(def.id, def.key) : undefined,
      };

      // Update previousCompleted for the next iteration
      previousCompleted = status === "Completed";

      return phase;
    }).filter((p): p is WorkflowPhase => p !== null);
  }, [process, phaseStats]);

  const handleCompleteProcess = useCallback(async () => {
    if (!processId || !process) return;

    if (!currentProjectMember?.isLeader) {
      toastWarning(
        "Permission Denied",
        "Only the Lead Reviewer can complete the review process.",
      );
      return;
    }

    const uncompletedPhases = workflowPhases.filter((p) => p.status !== "Completed");
    const incompleteNames = [
      ...(process.identificationProcess?.statusText === "Completed" ? [] : ["Identification"]),
      ...uncompletedPhases.map((phase) => phase.name),
    ];
    if (incompleteNames.length > 0) {
      const names = incompleteNames.join(", ");
      toastWarning(
        "Review modules incomplete",
        `Cannot complete the review process yet. Complete the remaining modules first: ${names}.`,
      );
      return;
    }

    setPendingConfirmation({ type: "complete-process" });
  }, [processId, process, currentProjectMember, workflowPhases]);

  const closePendingConfirmation = useCallback(() => setPendingConfirmation(null), []);
  const confirmPendingAction = useCallback(async () => {
    if (!pendingConfirmation) return;
    try {
      if (pendingConfirmation.type === "force-quality") {
        await completeQualityAssessment({ id: pendingConfirmation.qualityId, force: true });
      } else {
        if (!processId) return;
        await completeReviewProcess(processId);
        toastSuccess("Process Completed", "The review process has been completed successfully.");
      }
      setPendingConfirmation(null);
    } catch {
      // Errors are handled by the mutation hooks; keep the confirmation open for retry.
    }
  }, [pendingConfirmation, completeQualityAssessment, processId, completeReviewProcess]);

  // Derive paper pool stats for the whole process
  const paperStats: ProcessPaperStats = useMemo(() => {
    const stats = process?.studySelectionProcess?.selectionStatistics;

    const total = stats?.totalPapers ?? process?.totalPapersImported ?? 0;
    const included = stats?.includedCount ?? process?.totalIncludedPapers ?? 0;
    const excluded = stats?.excludedCount ?? process?.totalExcludedPapers ?? 0;
    const pending = stats?.pendingCount ?? 0;

    const inScreening = (stats?.inScreeningCount ?? 0) + (stats?.conflictCount ?? 0);
    const notScreened = pending;

    return {
      total,
      notScreened,
      screening: inScreening,
      included,
      excluded,
    };
  }, [process]);

  // Map real project members to TeamMember type
  const teamMembers = useMemo(() => {
    if (!projectMembers) return [];

    return projectMembers.map((m) => {
      const colors = ["blue", "purple", "green", "orange", "red", "indigo", "pink"];
      // Use userId to pick a stable color
      const colorIndex = m.userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const avatarColor = colors[colorIndex % colors.length];

      return {
        id: m.userId,
        name: m.fullName,
        role: m.role === 1 ? "Lead Reviewer" : "Reviewer",
        initials: getInitials(m.fullName || m.userName),
        avatarColor,
      } as TeamMember;
    });
  }, [projectMembers]);

  const activities: Activity[] = [];
  const alerts: Alert[] = [];
  const progressStats: ProgressStats = EMPTY_PROGRESS_STATS;


  // Computed values
  const completedPhases = useMemo(
    () => workflowPhases.filter((p) => p.status === "Completed").map((p) => p.id),
    [workflowPhases],
  );

  // Loading maps for per-phase loading indicators
  const phaseStartLoadingMap: Record<string, boolean> = useMemo(
    () => ({
      identification: isStartingIdentification,
      screening: isStartingStudySelection,
      quality: isStartingQualityAssessment,
      extraction: isStartingDataExtraction,
      synthesis: isStartingSynthesis,
    }),
    [
      isStartingIdentification,
      isStartingStudySelection,
      isStartingQualityAssessment,
      isStartingDataExtraction,
      isStartingSynthesis,
    ],
  );
  const phaseCompleteLoadingMap: Record<string, boolean> = useMemo(
    () => ({
      identification: isCompletingIdentification,
      screening: isCompletingStudySelection,
      quality: isCompletingQualityAssessment,
      extraction: isCompletingDataExtraction,
      synthesis: isCompletingSynthesis,
    }),
    [
      isCompletingIdentification,
      isCompletingStudySelection,
      isCompletingQualityAssessment,
      isCompletingDataExtraction,
      isCompletingSynthesis,
    ],
  );

  const phaseReopenLoadingMap: Record<string, boolean> = useMemo(
    () => ({
      identification: reopenLoading,
      screening: reopenLoading,
      quality: reopenLoading,
      extraction: reopenLoading,
    }),
    [reopenLoading],
  );

  return {
    member: currentProjectMember,
    isMemberLoading,

    process,
    isLoading,
    error,

    workflowPhases,
    paperStats,

    phaseStats,
    activities,
    teamMembers,
    isTeamLoading,
    alerts,
    progressStats,

    handleBack,
    handleStartProcess,
    handleCompleteProcess,
    handleOpenPhase,
    handleStartPhase,
    handleCompletePhase,
    handleReopenPhase,
    pendingConfirmation,
    closePendingConfirmation,
    confirmPendingAction,
    isConfirmingPendingAction: pendingConfirmation?.type === "force-quality"
      ? isCompletingQualityAssessment
      : pendingConfirmation?.type === "complete-process" && completeLoading,

    startLoading,
    completeLoading,
    phaseStartLoadingMap,
    phaseCompleteLoadingMap,
    phaseReopenLoadingMap,

    isCriteriaModalOpen,
    setIsCriteriaModalOpen,
    isQualityCriteriaModalOpen,
    setIsQualityCriteriaModalOpen,
    isSynthesisStrategyModalOpen,
    setIsSynthesisStrategyModalOpen,

    completedPhases,
  };
};
