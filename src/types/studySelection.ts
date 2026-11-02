// Study Selection API Types — aligned 1:1 with backend contract
// Source: StudySelectionApiDoc.md

import type { ParsedSectionDto } from "./paper";
import type { ApiResponse } from "./project";
export type { ApiResponse };

// ============================================
// ENUMS
// ============================================

export const SelectionProcessStatus = {
  NotStarted: 0,
  InProgress: 1,
  Completed: 2,
} as const;

export type SelectionProcessStatus =
  (typeof SelectionProcessStatus)[keyof typeof SelectionProcessStatus];

export const ScreeningDecisionType = {
  Include: 0,
  Exclude: 1,
} as const;

export type ScreeningDecisionType =
  (typeof ScreeningDecisionType)[keyof typeof ScreeningDecisionType];

export const PaperSelectionStatus = {
  Pending: 0,
  Included: 1,
  Excluded: 2,
  Conflict: 3,
  Resolved: 4,
} as const;

export type PaperSelectionStatus = (typeof PaperSelectionStatus)[keyof typeof PaperSelectionStatus];

export const PaperSortBy = {
  TitleAsc: 0,
  TitleDesc: 1,
  YearNewest: 2,
  YearOldest: 3,
  RelevanceDesc: 4,
} as const;

export type PaperSortBy = (typeof PaperSortBy)[keyof typeof PaperSortBy];

// ============================================
// GENERIC PAGINATED RESPONSE
// ============================================

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

// ============================================
// REQUEST TYPES
// ============================================

export interface CreateStudySelectionProcessRequest {
  notes?: string | null;
}

export const ScreeningPhaseQuery = {
  TitleAbstract: "TitleAbstract",
  FullText: "FullText",
} as const;

export type ScreeningPhaseQuery = (typeof ScreeningPhaseQuery)[keyof typeof ScreeningPhaseQuery];

export const PaperPhase = {
  TitleAbstract: 0,
  FullText: 1,
} as const;

export type PaperPhase = (typeof PaperPhase)[keyof typeof PaperPhase];

export const FullTextRetrievalStatus = {
  Unknown: 0,
  Retrieved: 1,
  NotRetrieved: 2,
} as const;

export type FullTextRetrievalStatus =
  (typeof FullTextRetrievalStatus)[keyof typeof FullTextRetrievalStatus];

export interface PapersWithDecisionsParams {
  phase?: ScreeningPhaseQuery;
  search?: string;
  status?: PaperSelectionStatus;
  sortBy?: PaperSortBy;
  pageNumber?: number;
  pageSize?: number;
  hasFullText?: boolean;
  hasConflict?: boolean;
  decidedByReviewerId?: string;
}

export interface AssignedPapersParams {
  search?: string | null;
  status?: PaperSelectionStatus | null;
  sortBy?: PaperSortBy;
  pageNumber?: number;
  pageSize?: number;
  hasFullText?: boolean | null;
  hasConflict?: boolean | null;
  hasReferences?: boolean;
  hasCitations?: boolean;
  phase?: PaperPhase;
}

export interface ConflictsByPhaseParams {
  phase: PaperPhase;
  status?: PaperSelectionStatus | null;
  search?: string;
  pageNumber?: number;
  pageSize?: number;
}

export interface UploadPaperFullTextRequest {
  file: File;
  projectId: string;
  paperId: string;
  extractWithGrobid?: boolean;
}

export interface UpdatePaperFullTextRequest {
  pdfUrl?: string;
  pdfFileName?: string;
  url?: string;
  extractWithGrobid?: boolean;
}

export const ExclusionReasonCode = {
  NotRelevantToTopic: 0,
  NotRelevantPopulation: 1,
  NotRelevantIntervention: 2,
  NotEmpiricalStudy: 3,
  NotResearchPaper: 4,
  OutsideTimeRange: 5,
  UnsupportedLanguage: 6,
  DuplicateStudy: 7,
  Other: 99,
} as const;

export type ExclusionReasonCode = (typeof ExclusionReasonCode)[keyof typeof ExclusionReasonCode];

export interface SubmitScreeningDecisionRequest {
  reviewerId: string;
  decision: ScreeningDecisionType;
  phase: PaperPhase;
  comment?: string | null;
  /** @deprecated Use comment. Kept for older callers. */
  reason?: string | null;
  exclusionReasonId?: string | null;
}

export interface ResolveScreeningConflictRequest {
  finalDecision: ScreeningDecisionType;
  phase: PaperPhase;
  resolvedBy: string;
  resolutionNotes?: string | null;
  exclusionReasonId?: string | null;
}

export interface BulkResolvePapersRequest {
  paperIds: string[];
  finalDecision: ScreeningDecisionType;
  phase: PaperPhase;
  resolvedBy: string;
  exclusionReasonId?: string | null;
  resolutionNotes?: string | null;
}

export interface BulkAddToDatasetRequest {
  paperIds: string[];
}

export interface RetryExtractionRequest {
  provider: string;
  projectId: string;
}

export interface ApplyMetadataRequest {
  sourceMetadataId: string;
  fields: string[];
}

export interface CustomExclusionReasonRequest {
  code: number;
  name: string;
}

export interface AddExclusionReasonsRequest {
  libraryReasonIds: string[];
  customReasons: CustomExclusionReasonRequest[];
}

export interface GetExclusionReasonsParams {
  onlyActive?: boolean;
  source?: number; // 0: All, 1: Library, 2: Custom
  search?: string;
  pageNumber?: number;
  pageSize?: number;
}

export const AssignmentFilterStatus = {
  All: 0,
  Assigned: 1,
  Unassigned: 2,
} as const;

export type AssignmentFilterStatus =
  (typeof AssignmentFilterStatus)[keyof typeof AssignmentFilterStatus];

export const ResolutionFilterStatus = {
  All: 0,
  NotDecided: 1,
  Include: 2,
  Exclude: 3,
} as const;

export type ResolutionFilterStatus =
  (typeof ResolutionFilterStatus)[keyof typeof ResolutionFilterStatus];

export interface GetAssignmentPapersParams {
  search?: string;
  year?: number;
  searchSourceId?: string;
  assignmentStatus?: number;
  decisionStatus?: number;
  pageNumber?: number;
  pageSize?: number;
}

// ============================================
// RESPONSE TYPES
// ============================================

export type AssignedPaperResponse = PaperWithDecisionsResponse;

export interface StudySelectionProcessResponse {
  id: string;
  reviewProcessId: string;
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  status: SelectionProcessStatus;
  statusText: string;
  createdAt: string;
  modifiedAt: string;
  screenedStudy: number;
  studyToScreen: number;
  phaseStatistics: PhaseStatisticsResponse;
  isHaveCriteria: boolean;
}

export interface ScreeningDecisionResponse {
  id: string;
  studySelectionProcessId: string;
  paperId: string;
  paperTitle: string;
  reviewerId: string;
  reviewerName: string;
  decision: ScreeningDecisionType;
  decisionText: string;
  phase: PaperPhase;
  phaseText: string;
  exclusionReasonId: string | null;
  exclusionReasonCode: number | null;
  exclusionReasonName: string | null;
  reason: string | null;
  comment?: string | null;
  decidedAt: string;
}

export interface ScreeningResolutionResponse {
  id: string;
  studySelectionProcessId: string;
  paperId: string;
  paperTitle: string;
  finalDecision: ScreeningDecisionType;
  finalDecisionText: string;
  phase: PaperPhase;
  phaseText: string;
  resolutionNotes: string | null;
  resolvedBy: string;
  resolverName: string;
  resolvedAt: string;
}

export type MetadataSourceProvider = "RIS" | "GROBID" | "MANUAL";

export interface ExtractionStatusResponse {
  requested: boolean;
  provider: string | null;
  status: "not_requested" | "succeeded" | "failed" | "partial";
  message: string | null;
  retryToken: string | null;
}

export interface MetadataSourcesResponse {
  title: MetadataSourceProvider | null;
  authors: MetadataSourceProvider | null;
  abstract: MetadataSourceProvider | null;
  doi: MetadataSourceProvider | null;
  journal: MetadataSourceProvider | null;
  volume: MetadataSourceProvider | null;
  issue: MetadataSourceProvider | null;
  pages: MetadataSourceProvider | null;
  keywords: MetadataSourceProvider | null;
  publisher: MetadataSourceProvider | null;
  publishedDate: MetadataSourceProvider | null;
  year: MetadataSourceProvider | null;
  issn: MetadataSourceProvider | null;
  eissn: MetadataSourceProvider | null;
  language: MetadataSourceProvider | null;
  md5: MetadataSourceProvider | null;
}

export interface ExtractionResultResponse {
  title: string | null;
  authors: string | null;
  abstract: string | null;
  doi: string | null;
  journal: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  keywords: string | null;
  publisher: string | null;
  publishedDate: string | null;
  year: number | null;
  issn: string | null;
  eissn: string | null;
  language: string | null;
  md5: string | null;
  updatedFields: string[];
}

export interface ExtractionSuggestionResponse {
  sourceMetadataId: string;
  updatedFields?: string[];
  suggestedFields?: string[];
  title?: string | null;
  authors?: string | null;
  abstract?: string | null;
  doi?: string | null;
  journal?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  keywords?: string | null;
  publisher?: string | null;
  year?: number | null;
  publishedDate?: string | null;
  issn?: string | null;
  eissn?: string | null;
  language?: string | null;
  md5?: string | null;
}

export interface PaperWithDecisionsResponse {
  paperId: string;
  title: string;
  doi: string | null;
  authors: string | null;
  publicationYear: number | null;
  publicationDate: string | null;
  abstract: string | null;
  journal: string | null;
  source: string | null;
  keywords: string | null;
  publicationType: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  publisher: string | null;
  language: string | null;
  url: string | null;
  pdfUrl: string | null;
  pdfFileName: string | null;
  conferenceName: string | null;
  conferenceLocation: string | null;
  journalIssn: string | null;
  journalEIssn: string | null;
  md5: string | null;
  status: PaperSelectionStatus;
  statusText: string;
  fullTextRetrievalStatus: FullTextRetrievalStatus;
  fullTextRetrievalStatusText: string;
  finalDecision: ScreeningDecisionType | null;
  finalDecisionText: string | null;
  aiReviewSubmitted?: boolean;
  myDecision?: ScreeningDecisionResponse | null;
  citationCount: number;
  referenceCount: number;
  decisions: ScreeningDecisionResponse[];
  resolution: ScreeningResolutionResponse | null;
  extraction: ExtractionStatusResponse | null;
  metadataSources: MetadataSourcesResponse | null;
  extractionResult: ExtractionResultResponse | null;
  extractionSuggestion?: ExtractionSuggestionResponse | null;
  assignedReviewers?: AssignedReviewer[];
  fullTextSections?: ParsedSectionDto[] | null;
}

export interface ConflictedPaperResponse {
  paperId: string;
  title: string;
  doi: string | null;
  conflictingDecisions: ScreeningDecisionResponse[];
}

export interface SelectionStatisticsResponse {
  studySelectionProcessId: string;
  totalPapers: number;
  includedCount: number;
  excludedCount: number;
  conflictCount: number;
  pendingCount: number;
  completionPercentage: number;
}

export interface PhaseStatisticsResponse {
  titleAbstract: SelectionStatisticsResponse;
  fullText: SelectionStatisticsResponse;
}

// ============================================
// API RESPONSE ALIASES
// ============================================

export type CreateStudySelectionResponse = ApiResponse<StudySelectionProcessResponse>;
export type GetStudySelectionResponse = ApiResponse<StudySelectionProcessResponse>;
export type StartStudySelectionResponse = ApiResponse<StudySelectionProcessResponse>;
export type CompleteStudySelectionResponse = ApiResponse<StudySelectionProcessResponse>;
export type GetEligiblePapersResponse = ApiResponse<string[]>;
export type SubmitDecisionResponse = ApiResponse<ScreeningDecisionResponse>;
export type GetDecisionsByPaperResponse = ApiResponse<ScreeningDecisionResponse[]>;
export type GetConflictedPapersResponse = ApiResponse<ConflictedPaperResponse[]>;
export type ResolveConflictResponse = ApiResponse<ScreeningResolutionResponse>;
export type GetPaperStatusResponse = ApiResponse<PaperSelectionStatus>;
export type GetSelectionStatisticsResponse = ApiResponse<SelectionStatisticsResponse>;
export type GetPapersWithDecisionsResponse = ApiResponse<
  PaginatedResponse<PaperWithDecisionsResponse>
>;
export type GetAssignedPapersResponse = ApiResponse<PaginatedResponse<AssignedPaperResponse>>;
export type UploadFullTextResponse = ApiResponse<PaperWithDecisionsResponse>;
export type RetryExtractionResponse = ApiResponse<PaperWithDecisionsResponse>;
export type ApplyMetadataResponse = ApiResponse<PaperWithDecisionsResponse>;
export type GetPaperDetailsResponse = ApiResponse<PaperWithDecisionsResponse>;
export interface ConflictDetailResponse extends PaperWithDecisionsResponse {
  isFinishReview: boolean;
  assignedMembers?: AssignedMember[];
  hasConflict?: boolean;
}
export type GetConflictDetailResponse = ApiResponse<ConflictDetailResponse>;
export type BulkResolvePapersResponse = ApiResponse<ScreeningResolutionResponse[]>;

export type EvaluateFullTextAiResponse = ApiResponse<boolean>;

export type BulkAddToDatasetResponse = ApiResponse<null>;

// ============================================
// CITATION & DISCOVERY TYPES
// ============================================

export interface PaperNodeDto {
  id: string; // Local paper ID for the graph root; OpenAlex ID for external works.
  title: string;
  year: number | null;
  authors: string | null;
  doi: string | null;
  citationCount: number;
}

export interface CitationEdgeDto {
  sourcePaperId: string; // Guid
  targetPaperId: string; // Guid
  confidenceScore: number;
  relationType?: "REFERENCE" | "CITATION";
}

export interface CitationGraphNodeDto extends PaperNodeDto {
  /** Minimum number of citation hops from the root paper. */
  depth?: number;
  /** Number of other first-level papers connected to this node. */
  commonNeighborCount?: number;
}

export interface CitationGraphDto {
  nodes: CitationGraphNodeDto[];
  edges: CitationEdgeDto[];
  intersections?: Array<{ paperId: string; commonNeighborIds: string[] }>;
}

export interface PaperAbstractDto {
  abstract: string | null;
  source: "OPENALEX" | "CROSSREF" | null;
}

export interface GetCitationGraphQuery {
  depth?: number; // backend clamps to [0..3]
  minConfidence?: number; // default 0.7
}

export interface GetTopCitedPapersQuery {
  topN?: number; // backend clamps to [1..100]
}

export interface GetSuggestedPapersQuery {
  limit?: number; // default 5
}

// Citation Responses
export type GetReferencesResponse = ApiResponse<PaperNodeDto[]>;
export type GetCitationsResponse = ApiResponse<PaperNodeDto[]>;
export type GetCitationCountResponse = ApiResponse<number>;
export type GetReferenceCountResponse = ApiResponse<number>;
export type GetCitationGraphResponse = ApiResponse<CitationGraphDto>;
export type GetPaperAbstractResponse = ApiResponse<PaperAbstractDto>;
export type GetTopCitedPapersResponse = ApiResponse<PaperNodeDto[]>;
export type GetSuggestedPapersResponse = ApiResponse<PaperNodeDto[]>;

export interface AssignedMember {
  projectMemberId: string;
  reviewerId: string;
  reviewerName: string;
}

export interface AssignedReviewer {
  reviewerId: string;
  reviewerName: string;
  reviewerEmail: string;
  decision: string;
  exclusionReasonCode?: number;
  exclusionReasonName?: string;
  exclusionNote?: string;
}

export interface SimplifiedPaperItem {
  id: string;
  title: string;
  author: string;
  year: string;
  source: string;
  status: string;
  isAssigned: boolean;
  assignedReviewers?: AssignedReviewer[];
}

export interface AssignmentPaginatedResponse<T> extends PaginatedResponse<T> {
  currentPhase: number;
  currentPhaseText: string;
}

export type GetAssignmentPapersResponse = ApiResponse<
  AssignmentPaginatedResponse<SimplifiedPaperItem>
>;

export interface ConflictPaperItem {
  paperId: string;
  title: string;
  authors: string | null;
  doi: string | null;
  year: string | null;
  source: string | null;
  phase: PaperPhase;
  phaseText: string;
  status: PaperSelectionStatus;
  statusText: string;
}

export type GetConflictsByPhaseResponse = ApiResponse<PaginatedResponse<ConflictPaperItem>>;

export interface AiMatchResult {
  value: string;
  match: string;
}

export interface AiPicocMatching {
  population: AiMatchResult;
  intervention: AiMatchResult;
  comparison: AiMatchResult;
  outcome: AiMatchResult;
  context: AiMatchResult;
}

export interface AiResearchQuestionResult {
  question: string;
  match: string;
  picocMatching?: AiPicocMatching;
}

export interface AiInclusionResult {
  rule: string;
  match: string;
}

export interface AiExclusionResult {
  rule: string;
  match: string;
  highlight: string | null;
}

export interface AiCriteriaGroupResult {
  description: string;
  inclusionResults: AiInclusionResult[];
  exclusionResults: AiExclusionResult[];
}

export interface AiOutputData {
  criteriaGroupResults: AiCriteriaGroupResult[];
  inclusionMatches: number;
  exclusionMatches: number;
  exclusionHighlights: string[];
  relevanceScore: number;
  recommendation: string;
  reasoning: string;
}

export interface AiAnalysisData {
  id: string;
  studySelectionProcessId: string;
  paperId: string;
  reviewerId: string;
  phase: number;
  aiOutput: AiOutputData;
  relevanceScore: number;
  recommendation: number;
  createdAt: string;
  modifiedAt: string;
}

export type GetAiAnalysisResultResponse = ApiResponse<AiAnalysisData>;

export interface StudySelectionExclusionReason {
  id: string;
  studySelectionProcessId: string;
  libraryReasonId: string | null;
  code: number;
  name: string;
  source: number; // 0: Library, 1: Custom
  isActive: boolean;
}

export type GetExclusionReasonsResponse = ApiResponse<StudySelectionExclusionReason[]>;
export type AddExclusionReasonsResponse = ApiResponse<StudySelectionExclusionReason[]>;
export type ToggleExclusionReasonActiveResponse = ApiResponse<StudySelectionExclusionReason>;

export interface ReviewerDecisionDetail {
  reviewerId: string;
  reviewerName: string;
  decision: ScreeningDecisionResponse | null;
}

export type GetReviewerDecisionsResponse = ApiResponse<ReviewerDecisionDetail[]>;

export interface IncludedFullTextPaperItem {
  id: string;
  title: string;
  authors: string | null;
  publicationYear: string | null;
  doi?: string | null;
  domain?: string | null;
  abstract?: string | null;
}

export interface GetIncludedFullTextPapersParams {
  search?: string;
  pageNumber?: number;
  pageSize?: number;
}

export type GetIncludedFullTextPapersResponse = ApiResponse<
  PaginatedResponse<IncludedFullTextPaperItem>
>;

export interface IncludedPaperItem {
  id: string;
  paperId: string;
  title: string;
  doi: string | null;
  authors: string | null;
  abstract: string | null;
  publicationYear: string | null;
  publicationType: string | null;
  journal: string | null;
  source: string | null;
  keywords: string | null;
  url: string | null;
  pdfUrl: string | null;
  createdAt: string;
}

export interface GetIncludedPapersParams {
  search?: string;
  pageNumber?: number;
  pageSize?: number;
}

export type GetIncludedPapersResponse = ApiResponse<PaginatedResponse<IncludedPaperItem>>;

export interface ReviewerAssignmentTableItemResponse {
  paperId: string;
  paperTitle: string;
  titleAbstractDisplay: string;
  fullTextDisplay: string;
  overallStatus: string;
}

export type GetReviewerAssignmentTableResponse = ApiResponse<ReviewerAssignmentTableItemResponse[]>;

export interface PaperConflictStatus {
  paperId: string;
  hasConflict: boolean;
}

export type GetConflictStatusResponse = ApiResponse<PaperConflictStatus[]>;

export interface ExclusionReasonDetailResponse {
  code: number;
  name: string;
}

export interface TopExclusionReasonResponse {
  name: string;
  code: number;
  count: number;
}

export interface PhaseStatusResponse {
  status: string;
}

export interface PaperResolutionProgressItem {
  paperId: string;
  title: string;
  authors: string;
  journal: string;
  publicationYear: string;
  doi: string | null;
  titleAbstractStatus: PhaseStatusResponse;
  fullTextStatus: PhaseStatusResponse;
  finalDecision: string;
  exclusionReason: ExclusionReasonDetailResponse | null;
}

export interface FinalResolutionProgressResponse {
  totalPapers: number;
  includedCount: number;
  excludedCount: number;
  pendingCount: number;
  topExclusionReason: TopExclusionReasonResponse | null;
  papers: PaperResolutionProgressItem[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

export interface FinalResolutionProgressParams {
  status?: number;
  exclusionReasonCode?: number;
  search?: string;
  fromYear?: number;
  toYear?: number;
  pageNumber?: number;
  pageSize?: number;
}

export type GetFinalResolutionProgressResponse = ApiResponse<FinalResolutionProgressResponse>;
