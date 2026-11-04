import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../redux/store";
import { projectService } from "../../../../services/projectService";
import { dataExtractionConductingService } from "../../../../services/dataExtractionConductingService";
import { dataExtractionTemplateService } from "../../../../services/dataExtractionService";
import { getErrorMessage } from "../../../../utils/errorUtils";
import { toastError, toastSuccess } from "../../../../utils/toast";
import { ProjectRole } from "../../../../types/project";
import {
  type AddCommentRequestDto,
  type ExtractionAssignmentRequestDto,
  type ExtractionDashboardFilterDto,
  type ExtractionDashboardTaskDto,
  type ExtractionEditableGridDto,
  type ExtractionFieldDto,
  type ExtractionFindingDto,
  type ExtractedValueDto,
  type ExtractionPreviewDto,
  type ReopenExtractionRequestDto,
  type ExtractionTemplateDto,
  type ExtractionWorkflowMutationDto,
  type ExtractionConsensusDraftDto,
  type ExtractionAuditEntryDto,
  type ConsensusWorkspaceDto,
  type ReviewerWorkspaceDto,
  type SubmitExtractionRequestDto,
  type SubmitConsensusRequestDto,
  type ExtractionCommentDto,
} from "../../../../types/dataExtraction";
import type { PaperWithDecisionsResponse } from "../../../../types/studySelection";
import { FullTextRetrievalStatus, PaperSelectionStatus } from "../../../../types/studySelection";
import type {
  ExtractionPaperRecord,
  ExtractionStudyItem,
  ExtractionValue,
  FlattenedExtractionField,
  ReviewerOption,
  UseDataExtractionWorkspaceReturn,
} from "../types";
import { applyAiProposalToDraft, canFinalizeConsensus, findMissingRequiredFields, getEffectiveReviewerValues, getReviewerWorkspaceState, hasTwoIndependentSubmissions } from "../workflowRules";
import { mapExtractedValueToFormValue } from "../components/reviewerWorkspace/reviewerFormUtils";
import { normalizeExtractionStatus } from "../status";

const ROOT = ["project-extraction"] as const;
interface ConsensusWorkflowSnapshot extends ConsensusWorkspaceDto {
  reviewerSubmissions?: Array<{ reviewerId: string; values: Record<string, unknown>; version: number }>;
  findings?: ExtractionFindingDto[];
}

function readVersion(value: unknown): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value) || !("version" in value)) return null;
  return typeof value.version === "number" ? value.version : null;
}
const DEFAULT_PAGE_SIZE = 10;
const EMPTY_TEMPLATES: ExtractionTemplateDto[] = [];
const EMPTY_SUMMARY = { totalIncluded: 0, inProgress: 0, awaitingConsensus: 0, completed: 0, notStarted: 0 };

function flattenFields(fields: ExtractionFieldDto[], depth = 0): FlattenedExtractionField[] {
  return [...fields].sort((a, b) => a.orderIndex - b.orderIndex).flatMap((field) => [
    { field, depth },
    ...flattenFields(field.subFields ?? [], depth + 1),
  ]);
}

function templateFields(template: ExtractionTemplateDto | null): ExtractionFieldDto[] {
  if (!template) return [];
  const fields = (template.sections ?? []).flatMap((section) => section.fields ?? []);
  return fields.length ? fields : template.fields ?? [];
}

function citationAuthors(task: ExtractionDashboardTaskDto): string | null {
  const authors = task.citation?.authors ?? [];
  const formatted = authors
    .map((author) => typeof author === "string" ? author : author.name)
    .map((author) => author.trim())
    .filter(Boolean)
    .join(", ");

  return formatted || null;
}

function toStudy(task: ExtractionDashboardTaskDto): ExtractionStudyItem {
  const authors = task.authors?.trim() || citationAuthors(task);
  const publicationYear = task.publicationYear ?? task.citation?.year ?? null;
  const raw = {
    paperId: task.paperId,
    title: task.title || task.citation?.title || "Untitled paper",
    doi: task.citation?.doi ?? null,
    authors,
    publicationYear,
    publicationDate: null,
    abstract: task.citation?.abstract ?? null,
    journal: task.citation?.journal ?? null,
    source: null,
    keywords: null,
    publicationType: null,
    volume: null,
    issue: null,
    pages: null,
    publisher: null,
    language: null,
    url: null,
    pdfUrl: task.pdfUrl ?? null,
    pdfFileName: null,
    conferenceName: null,
    conferenceLocation: null,
    journalIssn: null,
    journalEIssn: null,
    md5: null,
    status: PaperSelectionStatus.Included,
    statusText: "Included",
    finalDecision: null,
    finalDecisionText: null,
    citationCount: 0,
    referenceCount: 0,
    decisions: [],
    resolution: null,
    extraction: null,
    metadataSources: null,
    extractionResult: null,
    fullTextRetrievalStatus: FullTextRetrievalStatus.Unknown,
    fullTextRetrievalStatusText: "Unknown",
  } as unknown as PaperWithDecisionsResponse;
  return {
    paperId: task.paperId,
    title: task.title || task.citation?.title || "Untitled paper",
    authors,
    publicationYear,
    pdfUrl: task.pdfUrl ?? null,
    source: null,
    raw,
  };
}

function extractValues(values: Record<string, unknown>): Record<string, ExtractionValue> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value as ExtractionValue]));
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isExplicitNotReported(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return "isNotReported" in value && value.isNotReported === true;
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : null;
}

function toExtractionValue(value: unknown): ExtractionValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const values = stringArray(value);
  if (values) return values;
  const record = toRecord(value);
  if (isExplicitNotReported(record)) return null;
  if (typeof record.stringValue === "string") return record.stringValue;
  if (typeof record.numericValue === "number" && Number.isFinite(record.numericValue)) return record.numericValue;
  if (typeof record.booleanValue === "boolean") return record.booleanValue;
  if (typeof record.optionId === "string") return record.optionId;
  const optionIds = stringArray(record.optionIds);
  return optionIds ?? null;
}

function toExtractedValue(fieldId: string, value: unknown): ExtractedValueDto {
  const record = toRecord(value);
  const evidenceCoordinates = typeof record.evidenceCoordinates === "string"
    ? record.evidenceCoordinates
    : null;
  const base: ExtractedValueDto = {
    fieldId,
    optionId: typeof record.optionId === "string" ? record.optionId : null,
    stringValue: null,
    numericValue: null,
    booleanValue: null,
    matrixColumnId: typeof record.matrixColumnId === "string" ? record.matrixColumnId : null,
    matrixRowIndex: typeof record.matrixRowIndex === "number" ? record.matrixRowIndex : null,
    evidenceCoordinates,
  };

  if (isExplicitNotReported(value)) return { ...base, isNotReported: true };
  if (typeof value === "string") return { ...base, stringValue: value };
  if (typeof value === "number" && Number.isFinite(value)) return { ...base, numericValue: value };
  if (typeof value === "boolean") return { ...base, booleanValue: value };
  const values = stringArray(value);
  if (values) return { ...base, stringValue: JSON.stringify(values) };
  if (typeof record.stringValue === "string") return { ...base, stringValue: record.stringValue };
  if (typeof record.numericValue === "number" && Number.isFinite(record.numericValue)) {
    return { ...base, numericValue: record.numericValue };
  }
  if (typeof record.booleanValue === "boolean") return { ...base, booleanValue: record.booleanValue };
  const optionIds = stringArray(record.optionIds);
  if (optionIds) return { ...base, stringValue: JSON.stringify(optionIds) };
  if (Array.isArray(record.values)) return { ...base, stringValue: JSON.stringify(record.values) };
  return base;
}

function invalidateProjectQueries(queryClient: QueryClient, projectId?: string) {
  if (!projectId) return Promise.resolve();
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [...ROOT, projectId, "dashboard"] }),
    queryClient.invalidateQueries({ queryKey: [...ROOT, projectId, "workload"] }),
    queryClient.invalidateQueries({ queryKey: [...ROOT, projectId, "phase-state"] }),
    queryClient.invalidateQueries({ queryKey: ["data-extraction-conducting", "dashboard", projectId] }),
  ]);
}
export function useDataExtractionWorkspace(): UseDataExtractionWorkspaceReturn {
  const { projectId, studyId } = useParams<{ projectId: string; studyId?: string }>();

  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const currentUserId = useSelector((state: RootState) => state.auth.user?.id ?? null);
  const currentUserName = useSelector((state: RootState) => state.auth.user?.username ?? state.auth.user?.name ?? "You");
  const [activeTab, setActiveTab] = useState<UseDataExtractionWorkspaceReturn["activeTab"]>("dashboard");
  const [selectedTemplateIdState, setSelectedTemplateIdState] = useState("");
  const [selectedPaperIdState, setSelectedPaperIdState] = useState("");
  const [activeReviewerId, setActiveReviewerId] = useState("");
  const [extractionMode, setExtractionMode] = useState<UseDataExtractionWorkspaceReturn["extractionMode"]>("double");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [draftValuesByPaper, setDraftValuesByPaper] = useState<Record<string, Record<string, ExtractionValue>>>({});
  const [activeHighlights, setActiveHighlights] = useState<UseDataExtractionWorkspaceReturn["activeHighlights"]>([]);

  useEffect(() => {
    setDraftValuesByPaper({});
  }, [currentUserId, projectId]);

  const projectMembersQuery = useQuery({
    queryKey: [...ROOT, projectId, "members"],
    enabled: !!projectId,
    queryFn: async () => {
      if (!projectId) throw new Error("Project ID is required to load members");
      const response = await projectService.getProjectMembers(projectId, { pageNumber: 1, pageSize: 100 });
      if (!response.isSuccess) throw new Error(response.message || "Failed to load project members");
      return response.data.items;
    },
    staleTime: 60_000,
  });
  const projectPhaseQuery = useQuery({
    queryKey: [...ROOT, projectId, "phase-state"],
    enabled: !!projectId,
    queryFn: async () => {
      if (!projectId) throw new Error("Project ID is required to load extraction phase");
      const response = await projectService.getProjectById(projectId);
      if (!response.isSuccess) throw new Error(response.message || "Failed to load project phase");
      return (response.data as typeof response.data & {
        dataExtraction?: { status?: number | string; statusText?: string; version?: number; startedAt?: string | null; updatedAt?: string | null };
      }).dataExtraction ?? null;
    },
  });
  const projectMembers = projectMembersQuery.data ?? [];
  const isCurrentUserLeader = useMemo(() => {
    const member = projectMembers.find((item) => item.userId === currentUserId);
    const role = String(member?.roleText ?? member?.role ?? "").trim().toUpperCase();
    return Number(member?.role) === ProjectRole.Owner || ["OWNER", "LECTURER", "LEADER", "ADMIN", "1"].includes(role);
  }, [currentUserId, projectMembers]);
  const reviewerOptions = useMemo<ReviewerOption[]>(() => projectMembers
    .filter((member) => {
      const role = String(member.roleText ?? member.role).trim().toUpperCase();
      return member.role === ProjectRole.Reviewer || ["REVIEWER", "3"].includes(role);
    })
    .map((member) => ({
      id: member.userId,
      name: member.userName || member.fullName?.trim() || member.email || "Unknown",
    })), [projectMembers]);
  const reviewerNameById = useMemo(() => Object.fromEntries(projectMembers.map((member) => [
    member.userId, member.userName || member.fullName?.trim() || member.email || "Unknown",
  ])), [projectMembers]);
  const effectiveReviewerId = reviewerOptions.some((item) => item.id === activeReviewerId)
    ? activeReviewerId
    : reviewerOptions[0]?.id ?? "";

  const phaseStatus = projectPhaseQuery.data?.statusText
    ?? (projectPhaseQuery.data?.status === 2 ? "Completed" : projectPhaseQuery.data?.status === 1 ? "InProgress" : "NotStarted");
  const dashboardQuery = useQuery({
    queryKey: [...ROOT, projectId, "dashboard", searchQuery, statusFilter, pageNumber, pageSize],
    enabled: !!projectId,
    queryFn: async () => {
      if (!projectId) throw new Error("Project ID is required to load extraction dashboard");
      const filters: ExtractionDashboardFilterDto = { pageNumber, pageSize };
      if (searchQuery.trim()) filters.searchQuery = searchQuery.trim();
      if (statusFilter !== "all") filters.statusFilter = statusFilter;
      return dataExtractionConductingService.getDashboard(projectId, filters);
    },
    placeholderData: (previous) => previous,
  });
  const workloadQuery = useQuery({
    queryKey: [...ROOT, projectId, "workload"],
    enabled: !!projectId,
    queryFn: () => projectId ? dataExtractionConductingService.getWorkloadSummary(projectId) : Promise.reject(new Error("Project ID required")),
    staleTime: 30_000,
  });
  const templatesQuery = useQuery({
    queryKey: [...ROOT, projectId, "templates"],
    enabled: !!projectId,
    queryFn: () => projectId ? dataExtractionTemplateService.list(projectId) : Promise.reject(new Error("Project ID required")),
    staleTime: 60_000,
  });
  const templates = templatesQuery.data ?? EMPTY_TEMPLATES;
  const effectiveTemplateId = templates.some((template) => template.templateId === selectedTemplateIdState)
    ? selectedTemplateIdState
    : templates.at(-1)?.templateId ?? "";
  const selectedTemplate = templates.find((template) => template.templateId === effectiveTemplateId) ?? null;
  const allFields = useMemo(() => flattenFields(templateFields(selectedTemplate)), [selectedTemplate]);
  const answerFields = useMemo(() => allFields.filter(({ field }) => !(field.subFields?.length) && !!field.fieldId), [allFields]);
  const dashboardTasks = dashboardQuery.data?.tasks.items ?? [];
  const studies = useMemo(() => dashboardTasks.map(toStudy), [dashboardTasks]);
  const selectedPaperId = studyId && studies.some((item) => item.paperId === studyId)
    ? studyId
    : studies.some((item) => item.paperId === selectedPaperIdState) ? selectedPaperIdState : studies[0]?.paperId ?? "";
  const selectedStudy = studies.find((item) => item.paperId === selectedPaperId) ?? null;
  const taskByPaperId = useMemo(() => Object.fromEntries(dashboardTasks.map((task) => [task.paperId, task])), [dashboardTasks]);
  const selectedTask = taskByPaperId[selectedPaperId];
  const selectedStatus = normalizeExtractionStatus(selectedTask?.status);

  const reviewerWorkspaceQuery = useQuery({
    queryKey: [...ROOT, projectId, "reviewer", currentUserId ?? "anonymous", selectedPaperId],
    enabled: !!projectId && !!studyId && !!currentUserId && !!selectedPaperId && !isCurrentUserLeader,
    queryFn: () => projectId && selectedPaperId
      ? dataExtractionConductingService.getReviewerWorkspace(projectId, selectedPaperId)
      : Promise.reject(new Error("Project and paper IDs are required")),
    staleTime: 10_000,
    refetchInterval: !!studyId && !isCurrentUserLeader ? 15_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const consensusWorkspaceQuery = useQuery({
    queryKey: [...ROOT, projectId, "consensus", selectedPaperId],
    enabled: !!projectId && !!studyId && !!selectedPaperId && isCurrentUserLeader && selectedStatus !== "todo",
    queryFn: () => projectId && selectedPaperId
      ? dataExtractionConductingService.getConsensusWorkspace(projectId, selectedPaperId)
      : Promise.reject(new Error("Project and paper IDs are required")),
    staleTime: 10_000,
    refetchInterval: !!studyId && isCurrentUserLeader && selectedStatus !== "todo" ? 15_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const reviewerWorkspace = reviewerWorkspaceQuery.data ?? null;
  const consensusWorkspace = consensusWorkspaceQuery.data ?? null;
  const reviewerState = useMemo(() => {
    const workspace = reviewerWorkspace as (ReviewerWorkspaceDto & {
      ownDraft?: { values?: unknown; version?: number } | null;
      ownSubmission?: { values?: unknown; version?: number } | null;
    }) | null;
    return getReviewerWorkspaceState(
      workspace?.ownDraft && currentUserId
        ? {
          reviewerId: currentUserId,
          values: toRecord(workspace.ownDraft.values),
          version: workspace.ownDraft.version ?? 0,
        }
        : null,
      workspace?.ownSubmission && currentUserId
        ? {
          reviewerId: currentUserId,
          values: toRecord(workspace.ownSubmission.values),
          version: workspace.ownSubmission.version ?? 0,
        }
        : null,
      currentUserId ?? "",
    );
  }, [currentUserId, reviewerWorkspace]);
  const effectiveReviewerValues = useMemo(
    () => getEffectiveReviewerValues(reviewerState),
    [reviewerState],
  );
  useEffect(() => {
    if (!selectedPaperId || !effectiveReviewerValues) return;
    setDraftValuesByPaper((current) => ({ ...current, [selectedPaperId]: extractValues(effectiveReviewerValues) }));
  }, [effectiveReviewerValues, selectedPaperId]);
  const currentDraft = draftValuesByPaper[selectedPaperId] ?? (effectiveReviewerValues ? extractValues(effectiveReviewerValues) : {});
  const reviewerVersion = (reviewerWorkspace as (ReviewerWorkspaceDto & { version?: number; ownDraft?: { version: number } | null }) | null)?.version
    ?? reviewerState.ownDraft?.version ?? 0;
  const templateVersion = Number((selectedTemplate as (ExtractionTemplateDto & { version?: number }) | null)?.version ?? 1);
  const isSubmitted = !!reviewerState.ownSubmission;

  const refreshRecords = useCallback(async () => {
    await invalidateProjectQueries(queryClient, projectId);
  }, [projectId, queryClient]);
  const startPhaseMutation = useMutation({
    mutationFn: () => projectId
      ? dataExtractionConductingService.startPhase(projectId, projectPhaseQuery.data?.version)
      : Promise.reject(new Error("Project ID required")),
    onSuccess: refreshRecords,
    onError: (error) => toastError("Start module failed", getErrorMessage(error, "Unable to start the extraction module.")),
  });
  const completePhaseMutation = useMutation({
    mutationFn: () => projectId
      ? dataExtractionConductingService.completePhase(projectId, projectPhaseQuery.data?.version)
      : Promise.reject(new Error("Project ID required")),
    onSuccess: async () => { await refreshRecords(); toastSuccess("Data extraction module completed"); },
    onError: (error) => toastError("Complete module failed", getErrorMessage(error, "Unable to complete the extraction module.")),
  });
  const assignMutation = useMutation({
    mutationFn: ({ paperId, payload }: { paperId: string; payload: ExtractionAssignmentRequestDto }) => projectId
      ? dataExtractionConductingService.assignReviewers(projectId, paperId, payload)
      : Promise.reject(new Error("Project ID required")),
    onSuccess: refreshRecords,
    onError: (error) => toastError("Assignment failed", getErrorMessage(error, "Unable to assign reviewers.")),
  });
  const saveDraftMutation = useMutation({
    mutationFn: ({ paperId, payload }: { paperId: string; payload: ExtractionWorkflowMutationDto }) => projectId
      ? dataExtractionConductingService.saveExtractionDraft(projectId, paperId, payload)
      : Promise.reject(new Error("Project ID required")),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...ROOT, projectId, "reviewer", currentUserId ?? "anonymous", variables.paperId] }),
        queryClient.invalidateQueries({ queryKey: [...ROOT, projectId, "consensus", variables.paperId] }),
      ]);
      toastSuccess("Draft saved");
    },
    onError: (error) => toastError("Save draft failed", getErrorMessage(error, "Unable to save extraction draft.")),
  });
  const submitMutation = useMutation({
    mutationFn: ({ paperId, payload }: { paperId: string; payload: ExtractionWorkflowMutationDto }) => projectId
      ? dataExtractionConductingService.submitExtraction(projectId, paperId, payload)
      : Promise.reject(new Error("Project ID required")),
    onSuccess: async (_data, variables) => {
      await refreshRecords();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...ROOT, projectId, "reviewer", currentUserId ?? "anonymous", variables.paperId] }),
        queryClient.invalidateQueries({ queryKey: [...ROOT, projectId, "consensus", variables.paperId] }),
      ]);
      toastSuccess("Extraction submitted");
    },
    onError: (error) => toastError("Submit extraction failed", getErrorMessage(error, "Unable to submit extraction.")),
  });
  const reopenMutation = useMutation({
    mutationFn: ({ paperId, payload }: { paperId: string; payload: ReopenExtractionRequestDto }) => projectId
      ? dataExtractionConductingService.reopenExtraction(projectId, paperId, payload)
      : Promise.reject(new Error("Project ID required")),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        refreshRecords(),
        queryClient.invalidateQueries({ queryKey: [...ROOT, projectId, "reviewer", currentUserId ?? "anonymous", variables.paperId] }),
        queryClient.invalidateQueries({ queryKey: [...ROOT, projectId, "consensus", variables.paperId] }),
      ]);
    },
    onError: (error) => toastError("Reopen failed", getErrorMessage(error, "Unable to reopen extraction.")),
  });
  const commentMutation = useMutation({
    mutationFn: ({ paperId, fieldId, payload }: { paperId: string; fieldId: string; payload: AddCommentRequestDto }) => projectId
      ? dataExtractionConductingService.addFieldComment(projectId, paperId, fieldId, {
        text: payload.content,
        expectedVersion: reviewerVersion,
      })
      : Promise.reject(new Error("Project ID required")),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: [...ROOT, projectId, "reviewer", currentUserId ?? "anonymous", variables.paperId] });
      await queryClient.invalidateQueries({ queryKey: [...ROOT, projectId, "consensus", variables.paperId] });
    },
    onError: (error) => toastError("Add comment failed", getErrorMessage(error, "Unable to send comment.")),
  });
  const aiMutation = useMutation({
    mutationFn: ({ paperId, fieldId }: { paperId: string; fieldId: string }) => projectId
      ? dataExtractionConductingService.askAiSingleField(projectId, paperId, fieldId)
      : Promise.reject(new Error("Project ID required")),
    onError: (error) => toastError("Ask AI failed", getErrorMessage(error, "Unable to get AI proposal.")),
  });
  const autoAiMutation = useMutation({
    mutationFn: ({ paperId, fieldIds }: { paperId: string; fieldIds: string[] }) => projectId
      ? dataExtractionConductingService.autoExtractWithAI(projectId, paperId, fieldIds)
      : Promise.reject(new Error("Project ID required")),
    onError: (error) => toastError("AI proposals failed", getErrorMessage(error, "Unable to get AI proposals.")),
  });
  const consensusCheckMutation = useMutation({
    mutationFn: ({ paperId, submissionVersions }: { paperId: string; submissionVersions: Record<string, number> }) => projectId
      ? dataExtractionConductingService.checkConsensus(projectId, paperId, submissionVersions)
      : Promise.reject(new Error("Project ID required")),
    onError: (error) => toastError("Consensus check failed", getErrorMessage(error, "Unable to check reviewer submissions.")),
  });
  const consensusDraftMutation = useMutation({
    mutationFn: ({ paperId, payload }: { paperId: string; payload: ExtractionConsensusDraftDto }) => projectId
      ? dataExtractionConductingService.saveConsensusDraft(projectId, paperId, payload)
      : Promise.reject(new Error("Project ID required")),
    onSuccess: async (_data, variables) => { await queryClient.invalidateQueries({ queryKey: [...ROOT, projectId, "consensus", variables.paperId] }); },
    onError: (error) => toastError("Consensus draft failed", getErrorMessage(error, "Unable to save consensus draft.")),
  });
  const finalizeMutation = useMutation({
    mutationFn: ({ paperId, expectedVersion }: { paperId: string; expectedVersion: number }) => projectId
      ? dataExtractionConductingService.finalizeConsensus(projectId, paperId, expectedVersion)
      : Promise.reject(new Error("Project ID required")),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        refreshRecords(),
        queryClient.invalidateQueries({ queryKey: [...ROOT, projectId, "consensus", variables.paperId] }),
      ]);
      toastSuccess("Consensus finalized");
    },
    onError: (error) => toastError("Finalize consensus failed", getErrorMessage(error, "Unable to finalize consensus.")),
  });

  const gridQuery = useQuery({
    queryKey: [...ROOT, projectId, "grid"],
    enabled: !!projectId,
    queryFn: () => projectId ? dataExtractionConductingService.getEditableGrid(projectId) : Promise.reject(new Error("Project ID required")),
  });
  const auditQuery = useQuery({
    queryKey: [...ROOT, projectId, "audit", selectedPaperId],
    enabled: !!projectId && !!selectedPaperId,
    queryFn: () => projectId ? dataExtractionConductingService.getCellAuditLogs(projectId, selectedPaperId || undefined) : Promise.reject(new Error("Project ID required")),
  });
  const gridMutation = useMutation({
    mutationFn: (payload: { paperId: string; fieldId: string; columnId?: string; row?: number; value: unknown; expectedVersion: number }) => projectId
      ? dataExtractionConductingService.updateGridCell(projectId, payload)
      : Promise.reject(new Error("Project ID required")),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...ROOT, projectId, "grid"] });
      await queryClient.invalidateQueries({ queryKey: [...ROOT, projectId, "audit"] });
    },
    onError: (error) => toastError("Grid update failed", getErrorMessage(error, "Unable to update extraction cell.")),
  });
  const previewQuery = useQuery({
    queryKey: [...ROOT, projectId, "preview", searchQuery],
    enabled: false,
    queryFn: () => projectId ? dataExtractionConductingService.getExtractionPreview(projectId, searchQuery.trim() || undefined) : Promise.reject(new Error("Project ID required")),
  });
  const exportMutation = useMutation({
    mutationFn: () => projectId ? dataExtractionConductingService.exportExtractedData(projectId, "markdown", searchQuery.trim() || undefined) : Promise.reject(new Error("Project ID required")),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "extraction-data.md";
      anchor.click();
      URL.revokeObjectURL(url);
    },
    onError: (error) => toastError("Export failed", getErrorMessage(error, "Unable to export extraction data.")),
  });

  const assignPaper = useCallback(async (
    paperId: string,
    payload: ExtractionAssignmentRequestDto,
  ) => {
    const [reviewer1Id, reviewer2Id] = payload.reviewerIds;
    if (!projectId || !isCurrentUserLeader || !reviewer1Id || !reviewer2Id || reviewer1Id === reviewer2Id || !effectiveTemplateId) {
      throw new Error("Choose two distinct reviewers and an extraction template before assigning");
    }
    return assignMutation.mutateAsync({ paperId, payload: { reviewerIds: [reviewer1Id, reviewer2Id], templateId: effectiveTemplateId } });
  }, [assignMutation, effectiveTemplateId, isCurrentUserLeader, projectId]);
  const setDraftValue = useCallback((paperId: string, reviewerId: string, fieldId: string, value: ExtractionValue) => {
    if (reviewerId !== currentUserId) return;
    setDraftValuesByPaper((current) => ({ ...current, [paperId]: { ...(current[paperId] ?? {}), [fieldId]: value } }));
  }, [currentUserId]);
  const saveDraft = useCallback(async (paperId: string, reviewerId: string, payload?: ExtractionWorkflowMutationDto) => {
    if (!projectId || reviewerId !== currentUserId) throw new Error("Only the assigned reviewer can save this draft");
    await saveDraftMutation.mutateAsync({ paperId, payload: payload ?? { templateVersion, values: (draftValuesByPaper[paperId] ?? currentDraft) as Record<string, unknown>, expectedVersion: reviewerVersion } });
  }, [currentDraft, currentUserId, draftValuesByPaper, projectId, reviewerVersion, saveDraftMutation, templateVersion]);
  const submitExtraction = useCallback(async (
    paperId: string,
    payload: ExtractionWorkflowMutationDto | SubmitExtractionRequestDto,
  ) => {
    if (!projectId || !currentUserId || !selectedTask) throw new Error("Reviewer workspace is unavailable");
    const values = "templateVersion" in payload
      ? payload.values
      : payload.values.reduce<Record<string, unknown>>((result, item) => {
        const value = {
          stringValue: item.stringValue ?? null,
          numericValue: item.numericValue ?? null,
          booleanValue: item.booleanValue ?? null,
          optionId: item.optionId ?? null,
          ...(item.isNotReported ? { isNotReported: true } : {}),
          ...(item.evidenceCoordinates ? { evidenceCoordinates: item.evidenceCoordinates } : {}),
          ...(item.matrixColumnId ? { matrixColumnId: item.matrixColumnId } : {}),
          ...(item.matrixRowIndex !== null && item.matrixRowIndex !== undefined
            ? { matrixRowIndex: item.matrixRowIndex }
            : {}),
        };
        if (item.matrixColumnId !== null && item.matrixColumnId !== undefined) {
          const prior = Array.isArray(result[item.fieldId]) ? result[item.fieldId] as unknown[] : [];
          result[item.fieldId] = [...prior, value];
        } else if (item.optionId !== null && item.optionId !== undefined && item.stringValue === null
          && item.numericValue === null && item.booleanValue === null) {
          const prior = toRecord(result[item.fieldId]);
          const optionIds = Array.isArray(prior.optionIds) ? prior.optionIds.filter((id): id is string => typeof id === "string") : [];
          result[item.fieldId] = { ...prior, optionIds: [...new Set([...optionIds, item.optionId])] };
        } else {
          result[item.fieldId] = value;
        }
        return result;
      }, {});
    const notReported = Object.fromEntries(
      Object.entries(values)
        .filter(([, value]) => isExplicitNotReported(value))
        .map(([fieldId]) => [fieldId, true]),
    );
    const missing = findMissingRequiredFields(
      allFields.map(({ field }) => ({ fieldId: field.fieldId, name: field.name, isRequired: field.isRequired })),
      values,
      notReported,
    );
    if (missing.length) throw new Error(`Complete required fields before submitting: ${missing.join(", ")}`);
    await submitMutation.mutateAsync({
      paperId,
      payload: "templateVersion" in payload
        ? payload
        : { templateVersion, values, expectedVersion: reviewerVersion },
    });
  }, [allFields, currentUserId, projectId, reviewerVersion, selectedTask, submitMutation, templateVersion]);
  const checkConsensus = useCallback(async (paperId: string, submissionVersions: Record<string, number>) => {
    if (!projectId) throw new Error("Project ID required");
    const workspace = await dataExtractionConductingService.getConsensusWorkspace(projectId, paperId) as ConsensusWorkflowSnapshot;
    if (!hasTwoIndependentSubmissions(workspace.reviewerSubmissions ?? [])) {
      throw new Error("Both distinct reviewer submissions are required before consensus checking");
    }
    const checked = await consensusCheckMutation.mutateAsync({ paperId, submissionVersions });
    return checked as { findings: ExtractionFindingDto[]; proposedValues: Record<string, unknown> };
  }, [consensusCheckMutation, projectId]);
  const saveConsensusDraft = useCallback(async (paperId: string, payload: ExtractionConsensusDraftDto) => {
    const current = consensusWorkspace as ConsensusWorkflowSnapshot | null;
    if (!hasTwoIndependentSubmissions(current?.reviewerSubmissions ?? [])) {
      throw new Error("Both independent reviewer submissions are required before saving consensus");
    }
    await consensusDraftMutation.mutateAsync({ paperId, payload });
  }, [consensusDraftMutation, consensusWorkspace]);
  const finalizeConsensus = useCallback(async (paperId: string, expectedVersion: number) => {
    const current = consensusWorkspace as ConsensusWorkflowSnapshot | null;
    const ids = current?.reviewerSubmissions?.map(({ reviewerId }) => reviewerId) ?? [];
    if (!canFinalizeConsensus(ids)) throw new Error("Two independent reviewer submissions are required before finalization");
    await finalizeMutation.mutateAsync({ paperId, expectedVersion });
  }, [consensusWorkspace, finalizeMutation]);
  const submitConsensus = useCallback(async (paperId: string, payload: SubmitConsensusRequestDto) => {
    if (!projectId) throw new Error("Project ID required");
    const current = await dataExtractionConductingService.getConsensusWorkspace(projectId, paperId) as ConsensusWorkflowSnapshot;
    if (!hasTwoIndependentSubmissions(current.reviewerSubmissions ?? [])) {
      throw new Error("Both independent reviewer submissions are required before finalization");
    }
    const values = payload.values.reduce<Record<string, unknown>>((result, item) => {
      const value = {
        stringValue: item.stringValue,
        numericValue: item.numericValue,
        booleanValue: item.booleanValue,
        optionId: item.optionId,
        ...(item.isNotReported ? { isNotReported: true } : {}),
        ...(item.evidenceCoordinates ? { evidenceCoordinates: item.evidenceCoordinates } : {}),
        ...(item.matrixColumnId ? { matrixColumnId: item.matrixColumnId } : {}),
        ...(item.matrixRowIndex !== null && item.matrixRowIndex !== undefined ? { matrixRowIndex: item.matrixRowIndex } : {}),
      };
      if (item.matrixColumnId) {
        const prior = Array.isArray(result[item.fieldId]) ? result[item.fieldId] as unknown[] : [];
        result[item.fieldId] = [...prior, value];
      } else if (item.optionId && item.stringValue === null && item.numericValue === null && item.booleanValue === null) {
        const prior = toRecord(result[item.fieldId]);
        const optionIds = Array.isArray(prior.optionIds)
          ? prior.optionIds.filter((optionId): optionId is string => typeof optionId === "string")
          : [];
        result[item.fieldId] = { ...prior, optionIds: [...new Set([...optionIds, item.optionId])] };
      } else {
        result[item.fieldId] = value;
      }
      return result;
    }, {});
    const findings = (current.findings ?? current.leaderDraft?.findings ?? []).map((finding) => ({
      ...finding,
      status: "RESOLVED" as const,
      resolution: values[finding.fieldId],
      reason: finding.reason ?? "Leader approved the consensus value",
    }));
    const currentVersion = current.leaderDraft?.version ?? 0;
    await consensusDraftMutation.mutateAsync({
      paperId,
      payload: { expectedVersion: currentVersion, values, findings },
    });
    const saved = await dataExtractionConductingService.getConsensusWorkspace(projectId, paperId) as ConsensusWorkflowSnapshot;
    await finalizeMutation.mutateAsync({
      paperId,
      expectedVersion: saved.leaderDraft?.version ?? currentVersion + 1,
    });
  }, [consensusDraftMutation, finalizeMutation, projectId]);
  const reopenExtraction = useCallback(async (paperId: string, payload: ReopenExtractionRequestDto) => {
    if (!payload.reason.trim() || !Number.isInteger(payload.expectedVersion)) {
      throw new Error("A reopen reason and current consensus version are required");
    }
    await reopenMutation.mutateAsync({ paperId, payload });
  }, [reopenMutation]);
  const addFieldComment = useCallback(async (paperId: string, fieldId: string, payload: AddCommentRequestDto) => {
    await commentMutation.mutateAsync({ paperId, fieldId, payload });
  }, [commentMutation]);
  const handleAskAiForField = useCallback(async (field: ExtractionFieldDto, matrixColumnId: string | null, matrixRowIndex: number | null) => {
    if (!selectedPaperId || !field.fieldId) return null;
    const response = await aiMutation.mutateAsync({ paperId: selectedPaperId, fieldId: field.fieldId });
    const proposal = toExtractedValue(field.fieldId, response.values[field.fieldId]);
    const mapped = mapExtractedValueToFormValue(field, proposal) as ExtractionValue;
    const current = draftValuesByPaper[selectedPaperId] ?? currentDraft;
    const updated = applyAiProposalToDraft(current as Record<string, unknown>, { [field.fieldId]: mapped });
    setDraftValuesByPaper((currentByPaper) => ({ ...currentByPaper, [selectedPaperId]: updated as Record<string, ExtractionValue> }));
    const rawCoordinates = proposal.evidenceCoordinates ?? proposal.EvidenceCoordinates;
    if (typeof rawCoordinates === "string") {
      try { const parsed: unknown = JSON.parse(rawCoordinates); setActiveHighlights(Array.isArray(parsed) ? parsed as UseDataExtractionWorkspaceReturn["activeHighlights"] : []); }
      catch { setActiveHighlights([]); }
    }
    return { fieldId: field.fieldId, value: mapped, matrixColumnId, matrixRowIndex, evidenceCoordinates: typeof rawCoordinates === "string" ? rawCoordinates : null };
  }, [aiMutation, currentDraft, draftValuesByPaper, selectedPaperId]);
  const autoExtractWithAI = useCallback(async (paperId: string, _templateId: string) => {
    const response = await autoAiMutation.mutateAsync({ paperId, fieldIds: answerFields.map(({ field }) => field.fieldId).filter((id): id is string => !!id) });
    const proposed = response.values;
    const extractedValues = Object.entries(proposed).map(([fieldId, value]) => toExtractedValue(fieldId, value));
    const normalizedProposal = Object.fromEntries(
      extractedValues.map((value) => [value.fieldId, toExtractionValue(proposed[value.fieldId])]),
    );
    setDraftValuesByPaper((current) => ({
      ...current,
      [paperId]: { ...(current[paperId] ?? {}), ...normalizedProposal },
    }));
    return extractedValues;
  }, [answerFields, autoAiMutation]);
  const getPaperStatus = useCallback((paperId: string) => normalizeExtractionStatus(taskByPaperId[paperId]?.status), [taskByPaperId]);
  const getRecord = useCallback((paperId: string): ExtractionPaperRecord | null => {
    if (paperId !== selectedPaperId) return null;
    if (!reviewerWorkspace && !consensusWorkspace) return null;
    const values = reviewerState.ownSubmission?.values ?? reviewerState.ownDraft?.values ?? {};
    const task = taskByPaperId[paperId];
    const assigneeId = task?.reviewer1Id ?? null;
    return {
      paperId,
      assigneeId,
      assigneeName: assigneeId ? reviewerNameById[assigneeId] ?? null : null,
      status: getPaperStatus(paperId),
      draftsByReviewer: reviewerState.ownDraft && currentUserId ? { [currentUserId]: extractValues(reviewerState.ownDraft.values) } : {},
      submissions: reviewerState.ownSubmission && currentUserId ? [{ reviewerId: currentUserId, reviewerName: currentUserName, submittedAt: "", values: extractValues(reviewerState.ownSubmission.values) }] : [],
      finalValues: extractValues(values),
      conflictFieldIds: [],
      updatedAt: "",
    };
  }, [consensusWorkspace, currentUserId, currentUserName, getPaperStatus, reviewerNameById, reviewerState, reviewerWorkspace, selectedPaperId, taskByPaperId]);
  const canCurrentUserExtractPaper = useCallback((paperId: string) => {
    if (isCurrentUserLeader) return false;

    const task = taskByPaperId[paperId];
    if (!task) return false;

      const status = normalizeExtractionStatus(task.status);
    return status === "todo" || status === "in-progress";
  }, [isCurrentUserLeader, taskByPaperId]);
  const hasCurrentUserSubmitted = useCallback((paperId: string) => {
    const task = taskByPaperId[paperId];
    const taskOwnStatus = String(task?.ownStatus ?? "").trim().toUpperCase();
    return taskOwnStatus === "SUBMITTED" || (paperId === selectedPaperId && isSubmitted);
  }, [isSubmitted, selectedPaperId, taskByPaperId]);
  const fetchReviewerWorkspace = useCallback(async (paperId: string) => {
    if (!projectId || !currentUserId) return null;
    return queryClient.fetchQuery({ queryKey: [...ROOT, projectId, "reviewer", currentUserId, paperId], queryFn: () => dataExtractionConductingService.getReviewerWorkspace(projectId, paperId), staleTime: 10_000 });
  }, [currentUserId, projectId, queryClient]);
  const fetchConsensusWorkspace = useCallback(async (paperId: string) => {
    if (!projectId) return null;
    return queryClient.fetchQuery({ queryKey: [...ROOT, projectId, "consensus", paperId], queryFn: () => dataExtractionConductingService.getConsensusWorkspace(projectId, paperId), staleTime: 0 });
  }, [projectId, queryClient]);
  const getEditableGrid = useCallback(async (): Promise<ExtractionEditableGridDto | null> => {
    const result = await gridQuery.refetch();
    return result.data ?? null;
  }, [gridQuery]);
  const fetchPaperVersion = useCallback(async (paperId: string): Promise<number | null> => {
    if (!projectId) return null;
    const response = await dataExtractionConductingService.getConsensusWorkspace(projectId, paperId);
    if (!response || typeof response !== "object" || !("leaderDraft" in response)) return null;
    return readVersion(response.leaderDraft);
  }, [projectId]);
  const fetchFieldComments = useCallback(async (paperId: string, fieldId: string): Promise<ExtractionCommentDto[]> => {
    if (!projectId) return [];
    return dataExtractionConductingService.getFieldComments(projectId, paperId, fieldId);
  }, [projectId]);
  const fetchExtractionPreview = useCallback(async (): Promise<ExtractionPreviewDto | null> => {
    const result = await previewQuery.refetch();
    if (result.error) throw result.error;
    return result.data ?? null;
  }, [previewQuery]);
  const fetchAuditLogs = useCallback(async (filters?: { paperId?: string; fieldId?: string; pageSize?: number }): Promise<ExtractionAuditEntryDto[]> => {
    if (!projectId) return [];
    const response = await dataExtractionConductingService.getCellAuditLogs(projectId, filters?.paperId, filters?.fieldId, filters?.pageSize);
    return response.items;
  }, [projectId]);
  const updateGridCell = useCallback(async (payload: { paperId: string; fieldId: string; columnId?: string; row?: number; value: unknown; expectedVersion: number }) => { await gridMutation.mutateAsync(payload); }, [gridMutation]);
  const handleBack = useCallback(() => {
    const returnTo = (location.state as { returnTo?: unknown } | null)?.returnTo;
    const processPathPrefix = projectId ? `/projects/${projectId}/processes/` : "";
    if (typeof returnTo === "string" && processPathPrefix && returnTo.startsWith(processPathPrefix)) {
      navigate(returnTo);
      return;
    }

    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === "number" && historyIndex > 0) {
      navigate(-1);
      return;
    }

    navigate("/projects");
  }, [location.state, navigate, projectId]);
  useEffect(() => {
    for (const [query, label] of [[dashboardQuery, "extraction dashboard"], [templatesQuery, "extraction templates"], [workloadQuery, "workload"], [projectMembersQuery, "project members"]] as const) {
      if (query.error) toastError(`Failed to load ${label}`, getErrorMessage(query.error, `Unable to load ${label}.`));
    }
  }, [dashboardQuery.error, projectMembersQuery.error, templatesQuery.error, workloadQuery.error]);

  const summary = dashboardQuery.data?.summary ?? EMPTY_SUMMARY;
  const awaitingConsensus = studies.filter((study) => getPaperStatus(study.paperId) === "awaiting-consensus");
  const completedStudies = studies.filter((study) => getPaperStatus(study.paperId) === "completed");
  const dataExtractionStatus: "NotStarted" | "InProgress" | "Completed" =
    phaseStatus === "Completed" ? "Completed" : phaseStatus === "InProgress" ? "InProgress" : "NotStarted";
  const extractionMetadata = dashboardQuery.data?.metadata;
  const isLoading = dashboardQuery.isLoading || projectMembersQuery.isLoading || templatesQuery.isLoading || workloadQuery.isLoading;
  const error = dashboardQuery.error ? getErrorMessage(dashboardQuery.error, "Failed to load extraction dashboard") : null;

  return {
    projectId,
    currentUserId,
    isCurrentUserLeader,
    extractionProcessStatus: dataExtractionStatus,
    extractionProcessStartedAt: extractionMetadata?.startedAt ?? projectPhaseQuery.data?.startedAt ?? null,
    extractionProcessLastUpdatedAt: extractionMetadata?.lastUpdatedAt ?? projectPhaseQuery.data?.updatedAt ?? null,
    isLoading,
    error,
    refetch: async () => {
      await Promise.all([
        dashboardQuery.refetch(),
        projectMembersQuery.refetch(),
        templatesQuery.refetch(),
        workloadQuery.refetch(),
      ]);
    },
    isMockMode: false,
    activeTab,
    setActiveTab,
    extractionMode,
    setExtractionMode,
    reviewerOptions,
    activeReviewerId: effectiveReviewerId,
    setActiveReviewerId,
    templates,
    selectedTemplateId: effectiveTemplateId,
    setSelectedTemplateId: setSelectedTemplateIdState,
    selectedTemplate,
    refreshTemplates: async () => { await templatesQuery.refetch(); },
    studies,
    selectedPaperId,
    setSelectedPaperId: setSelectedPaperIdState,
    selectedStudy,
    selectedRecord: getRecord(selectedPaperId),
    allFields,
    answerFields,
    summary,
    dashboardTasks,
    dashboardTotalCount: dashboardQuery.data?.tasks.totalCount ?? 0,
    dashboardTotalPages: dashboardQuery.data?.tasks.totalPages ?? 1,
    isDashboardLoading: dashboardQuery.isFetching,
    workloadSummary: workloadQuery.data ?? null,
    isWorkloadLoading: workloadQuery.isLoading,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    pageNumber,
    setPageNumber,
    pageSize,
    setPageSize,
    getPaperStatus,
    getRecord,
    canCurrentUserExtractPaper,
    assignPaper,
    isAssigningReviewers: assignMutation.isPending,
    startPhase: async () => { await startPhaseMutation.mutateAsync(); },
    isStarting: startPhaseMutation.isPending,
    completePhase: async () => { await completePhaseMutation.mutateAsync(); },
    isCompleting: completePhaseMutation.isPending,
    reopenExtraction,
    isReopeningExtraction: reopenMutation.isPending,
    hasCurrentUserSubmitted,
    setDraftValue,
    saveDraft,
    submitExtraction,
    isSubmittingExtraction: submitMutation.isPending,
    autoExtractWithAI,
    isAutoExtracting: autoAiMutation.isPending,
    activeHighlights,
    setActiveHighlights,
    handleAskAiForField,
    isAskingAi: aiMutation.isPending,
    consensusWorkspace,
    isConsensusLoading: consensusWorkspaceQuery.isLoading,
    fetchConsensusWorkspace,
    fetchPaperVersion,
    checkConsensus,
    isCheckingConsensus: consensusCheckMutation.isPending,
    saveConsensusDraft,
    isSavingConsensusDraft: consensusDraftMutation.isPending,
    finalizeConsensus,
    isFinalizingConsensus: finalizeMutation.isPending,
    submitConsensus,
    isSubmittingConsensus: consensusDraftMutation.isPending || finalizeMutation.isPending,
    reviewerWorkspace,
    isReviewerWorkspaceLoading: reviewerWorkspaceQuery.isLoading,
    fetchReviewerWorkspace,
    fetchFieldComments,
    addFieldComment,
    isAddingFieldComment: commentMutation.isPending,
    editableGrid: gridQuery.data ?? null,
    isGridLoading: gridQuery.isLoading,
    getEditableGrid,
    updateGridCell,
    isUpdatingGrid: gridMutation.isPending,
    auditLogs: auditQuery.data?.items ?? [],
    isAuditLoading: auditQuery.isLoading,
    fetchAuditLogs,
    exportExtractedData: () => exportMutation.mutate(),
    isExporting: exportMutation.isPending,
    extractionPreview: previewQuery.data ?? null,
    isExtractionPreviewLoading: previewQuery.isLoading,
    isExtractionPreviewFetching: previewQuery.isFetching,
    fetchExtractionPreview,
    awaitingConsensus,
    completedStudies,
    handleBack,
  } as UseDataExtractionWorkspaceReturn;
}
