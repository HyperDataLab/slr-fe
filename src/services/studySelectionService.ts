// Study Selection Service — API Integration Layer
// Source: StudySelectionApiDoc.md (13 endpoints)

import api from "../config/axios";
import type {
  CreateStudySelectionProcessRequest,
  SubmitScreeningDecisionRequest,
  ResolveScreeningConflictRequest,
  PapersWithDecisionsParams,
  CreateStudySelectionResponse,
  GetStudySelectionResponse,
  StartStudySelectionResponse,
  CompleteStudySelectionResponse,
  GetEligiblePapersResponse,
  SubmitDecisionResponse,
  GetDecisionsByPaperResponse,
  GetConflictedPapersResponse,
  ResolveConflictResponse,
  GetPaperStatusResponse,
  GetSelectionStatisticsResponse,
  GetPapersWithDecisionsResponse,
  UpdatePaperFullTextRequest,
  UploadFullTextResponse,
  UploadPaperFullTextRequest,
  RetryExtractionRequest,
  RetryExtractionResponse,
  ApplyMetadataRequest,
  ApplyMetadataResponse,
  GetAssignmentPapersParams,
  GetAssignmentPapersResponse,
  ScreeningPhaseQuery,
  AssignedPapersParams,
  PaperPhase,
  GetAssignedPapersResponse,
  ConflictsByPhaseParams,
  GetConflictsByPhaseResponse,
  GetPaperDetailsResponse,
  GetReferencesResponse,
  GetCitationsResponse,
  GetCitationGraphResponse,
  GetPaperAbstractResponse,
  GetCitationGraphQuery,
  GetTopCitedPapersQuery,
  GetTopCitedPapersResponse,
  GetSuggestedPapersQuery,
  GetSuggestedPapersResponse,
  GetConflictDetailResponse,
  GetAiAnalysisResultResponse,
  EvaluateFullTextAiResponse,
  AddExclusionReasonsRequest,
  GetExclusionReasonsParams,
  GetExclusionReasonsResponse,
  ApiResponse,
  AddExclusionReasonsResponse,
  ToggleExclusionReasonActiveResponse,
  BulkResolvePapersRequest,
  BulkResolvePapersResponse,
  GetReviewerDecisionsResponse,
  GetIncludedFullTextPapersParams,
  GetIncludedFullTextPapersResponse,
  GetIncludedPapersParams,
  GetIncludedPapersResponse,
  BulkAddToDatasetRequest,
  BulkAddToDatasetResponse,
  GetReviewerAssignmentTableResponse,
  GetConflictStatusResponse,
  FinalResolutionProgressParams,
  GetFinalResolutionProgressResponse,
} from "../types/studySelection";

export const studySelectionService = {
  // 1. Create Study Selection Process
  async create(
    reviewProcessId: string,
    request?: CreateStudySelectionProcessRequest,
  ): Promise<CreateStudySelectionResponse> {
    const response = await api.post<CreateStudySelectionResponse>(
      `/review-processes/${reviewProcessId}/study-selection`,
      request ?? {},
    );
    return response.data;
  },

  // 2. Get Study Selection Process by ID
  async getById(id: string): Promise<GetStudySelectionResponse> {
    const response = await api.get<GetStudySelectionResponse>(`/study-selection/${id}`);
    return response.data;
  },

  // 3. Start Study Selection Process
  async start(id: string): Promise<StartStudySelectionResponse> {
    const response = await api.post<StartStudySelectionResponse>(`/study-selection/${id}/start`);
    const data = response.data;
    if (!data.isSuccess) {
      throw new Error(data.message || "Failed to start study selection");
    }
    return data;
  },

  // 4. Complete Study Selection Process
  async complete(id: string): Promise<CompleteStudySelectionResponse> {
    const response = await api.post<CompleteStudySelectionResponse>(
      `/study-selection/${id}/complete`,
    );
    const data = response.data;
    if (!data.isSuccess) {
      throw new Error(data.message || "Failed to complete study selection");
    }
    return data;
  },

  // 5. Get Eligible Papers (returns paper IDs only)
  async getEligiblePapers(id: string): Promise<GetEligiblePapersResponse> {
    const response = await api.get<GetEligiblePapersResponse>(
      `/study-selection/${id}/eligible-papers`,
    );
    return response.data;
  },

  // 6. Submit Screening Decision
  async submitDecision(
    processId: string,
    paperId: string,
    request: SubmitScreeningDecisionRequest,
  ): Promise<SubmitDecisionResponse> {
    const response = await api.post<SubmitDecisionResponse>(
      `/study-selection/${processId}/papers/${paperId}/decision`,
      request,
    );
    return response.data;
  },

  // 7. Get Decisions by Paper
  async getDecisionsByPaper(
    processId: string,
    paperId: string,
  ): Promise<GetDecisionsByPaperResponse> {
    const response = await api.get<GetDecisionsByPaperResponse>(
      `/study-selection/${processId}/papers/${paperId}/decisions`,
    );
    return response.data;
  },

  // 8. Get Conflicted Papers
  async getConflictedPapers(processId: string): Promise<GetConflictedPapersResponse> {
    const response = await api.get<GetConflictedPapersResponse>(
      `/study-selection/${processId}/conflicts`,
    );
    return response.data;
  },

  // 9. Resolve Conflict
  async resolveConflict(
    processId: string,
    paperId: string,
    request: ResolveScreeningConflictRequest,
  ): Promise<ResolveConflictResponse> {
    const response = await api.post<ResolveConflictResponse>(
      `/study-selection/${processId}/papers/${paperId}/resolve`,
      request,
    );
    return response.data;
  },

  // 10. Get Paper Selection Status
  async getPaperStatus(processId: string, paperId: string): Promise<GetPaperStatusResponse> {
    const response = await api.get<GetPaperStatusResponse>(
      `/study-selection/${processId}/papers/${paperId}/status`,
    );
    return response.data;
  },

  // 11. Get Selection Statistics
  async getStatistics(
    processId: string,
    phase?: ScreeningPhaseQuery,
  ): Promise<GetSelectionStatisticsResponse> {
    const response = await api.get<GetSelectionStatisticsResponse>(
      `/study-selection/${processId}/statistics`,
      { params: { phase } },
    );
    return response.data;
  },

  // 12. Get Papers with Decisions (Paginated)
  async getPapersWithDecisions(
    processId: string,
    params?: PapersWithDecisionsParams,
  ): Promise<GetPapersWithDecisionsResponse> {
    const response = await api.get<GetPapersWithDecisionsResponse>(
      `/study-selection/${processId}/papers`,
      { params },
    );
    return response.data;
  },

  // 13. Upload/Link Full Text for Paper
  async uploadFullText(
    paperId: string,
    request: UpdatePaperFullTextRequest,
  ): Promise<UploadFullTextResponse> {
    const response = await api.post<UploadFullTextResponse>(
      `/papers/${paperId}/full-text`,
      request,
    );
    return response.data;
  },


  // 14. Upload Full-Text PDF File (Direct-to-Cloud Upload with fallback to proxy upload)
  async uploadPaperFullText(params: UploadPaperFullTextRequest): Promise<UploadFullTextResponse> {
    let directUploadCompleted = false;
    try {
      // Step 1: Request signed upload credentials from backend
      const sigResponse = await api.post<{
        isSuccess?: boolean;
        success?: boolean;
        data: {
          uploadUrl: string;
          apiKey: string;
          timestamp: number;
          signature: string;
          folder: string;
          publicId: string;
          type?: "authenticated";
          baseName: string;
          fileName: string;
        };
      }>("/paper-fulltext/upload-signature", {
        projectId: params.projectId,
        paperId: params.paperId,
        fileName: params.file.name,
      });

      const sigData = sigResponse.data?.data;
      if (sigData?.uploadUrl && sigData?.signature && sigData?.apiKey) {
        // Step 2: Upload file directly to Cloudinary via native fetch (zero server bandwidth)
        const cldFormData = new FormData();
        cldFormData.append("file", params.file);
        cldFormData.append("api_key", sigData.apiKey);
        cldFormData.append("timestamp", String(sigData.timestamp));
        cldFormData.append("signature", sigData.signature);
        cldFormData.append("folder", sigData.folder);
        cldFormData.append("public_id", sigData.publicId);
        if (sigData.type) cldFormData.append("type", sigData.type);

        const cldRes = await fetch(sigData.uploadUrl, {
          method: "POST",
          body: cldFormData,
        });

        if (cldRes.ok) {
          directUploadCompleted = true;
          const cldJson = (await cldRes.json()) as {
            public_id: string;
            secure_url: string;
            bytes?: number;
          };

          // Step 3: Finalize upload on backend
          const finResponse = await api.post<UploadFullTextResponse>("/paper-fulltext/finalize-upload", {
            projectId: params.projectId,
            paperId: params.paperId,
            publicId: cldJson.public_id,
            secureUrl: cldJson.secure_url,
            fileName: params.file.name,
            baseName: sigData.baseName,
            bytes: cldJson.bytes ?? params.file.size,
            extractWithGrobid: params.extractWithGrobid,
          });

          return finResponse.data;
        } else {
          console.warn("[DirectUpload] Cloudinary returned error status:", cldRes.status);
        }
      }
    } catch (directErr) {
      if (directUploadCompleted) throw directErr;
      console.warn("[DirectUpload] Direct-to-Cloud upload failed, falling back to server proxy upload:", directErr);
    }

    // Step 4: Fallback to proxy upload endpoint
    const formData = new FormData();
    formData.append("File", params.file);
    formData.append("ProjectId", params.projectId);
    formData.append("PaperId", params.paperId);
    if (params.extractWithGrobid !== undefined) {
      formData.append("ExtractWithGrobid", String(params.extractWithGrobid));
    }

    const response = await api.post<UploadFullTextResponse>("/paper-fulltext/upload", formData);
    return response.data;
  },
  // 14. Get Title/Abstract Assignment Papers
  async getTitleAbstractAssignmentPapers(
    studySelectionProcessId: string,
    params?: GetAssignmentPapersParams,
  ): Promise<GetAssignmentPapersResponse> {
    const response = await api.get<GetAssignmentPapersResponse>(
      `/study-selection/${studySelectionProcessId}/title-abstract/papers`,
      { params },
    );
    return response.data;
  },

  // 15. Get Full-Text Assignment Papers
  async getFullTextAssignmentPapers(
    studySelectionProcessId: string,
    params?: GetAssignmentPapersParams,
  ): Promise<GetAssignmentPapersResponse> {
    const response = await api.get<GetAssignmentPapersResponse>(
      `/study-selection/${studySelectionProcessId}/full-text/papers`,
      { params },
    );
    return response.data;
  },
  // 15. Retry metadata extraction for existing uploaded PDF
  async retryExtraction(
    paperId: string,
    request: RetryExtractionRequest,
  ): Promise<RetryExtractionResponse> {
    const response = await api.post<RetryExtractionResponse>(
      `/paper-fulltext/${paperId}/extract-metadata`,
      request,
    );
    return response.data;
  },

  // 16. Apply extracted metadata suggestions to canonical paper fields
  async applyMetadata(
    paperId: string,
    request: ApplyMetadataRequest,
  ): Promise<ApplyMetadataResponse> {
    const response = await api.post<ApplyMetadataResponse>(
      `/papers/${paperId}/apply-metadata`,
      request,
    );
    return response.data;
  },
  // 17. Get Assigned Papers for Current User
  async getAssignedPapers(
    id: string,
    params?: AssignedPapersParams,
  ): Promise<GetAssignedPapersResponse> {
    const response = await api.get<GetAssignedPapersResponse>(
      `/study-selection/${id}/assigned-papers`,
      { params },
    );
    return response.data;
  },

  async getConflictsByPhase(
    id: string,
    params: ConflictsByPhaseParams,
  ): Promise<GetConflictsByPhaseResponse> {
    const response = await api.get<GetConflictsByPhaseResponse>(
      `/study-selection/${id}/conflicts-by-phase`,
      { params },
    );
    return response.data;
  },
  // 18. Get Detailed Paper Info (with decisions/resolution)
  async getPaperDetails(
    processId: string,
    paperId: string,
    phase?: PaperPhase,
  ): Promise<GetPaperDetailsResponse> {
    const response = await api.get<GetPaperDetailsResponse>(
      `/study-selection/${processId}/papers/${paperId}`,
      { params: phase === undefined ? undefined : { phase } },
    );
    return response.data;
  },
  // 18.1 Get Conflict Detail
  async getConflictDetail(
    processId: string,
    paperId: string,
    phase: number,
  ): Promise<GetConflictDetailResponse> {
    const response = await api.get<GetConflictDetailResponse>(
      `/study-selection/${processId}/papers/${paperId}/conflict-detail`,
      { params: { phase } },
    );
    return response.data;
  },
  // 19. Get References
  async getReferences(id: string): Promise<GetReferencesResponse> {
    const response = await api.get<GetReferencesResponse>(`/papers/${id}/references`);
    return response.data;
  },

  // 20. Get Citations
  async getCitations(id: string): Promise<GetCitationsResponse> {
    const response = await api.get<GetCitationsResponse>(`/papers/${id}/citations`);
    return response.data;
  },

  // 21. Get Citation Graph
  async getCitationGraph(
    id: string,
    params?: GetCitationGraphQuery,
  ): Promise<GetCitationGraphResponse> {
    const response = await api.get<GetCitationGraphResponse>(`/papers/${id}/graph`, { params });
    return response.data;
  },

  // Get an external paper abstract from OpenAlex, with Crossref fallback.
  async getPaperAbstract(id: string, doi?: string | null): Promise<GetPaperAbstractResponse> {
    const response = await api.get<GetPaperAbstractResponse>(
      `/papers/${encodeURIComponent(id)}/abstract`,
      { params: doi ? { doi } : undefined, timeout: 6000 },
    );
    return response.data;
  },

  // 22. Get Top Cited Papers
  async getTopCited(params?: GetTopCitedPapersQuery): Promise<GetTopCitedPapersResponse> {
    const response = await api.get<GetTopCitedPapersResponse>(`/papers/top-cited`, { params });
    return response.data;
  },

  // 23. Get Suggested Papers
  async getSuggestions(
    id: string,
    params?: GetSuggestedPapersQuery,
  ): Promise<GetSuggestedPapersResponse> {
    const response = await api.get<GetSuggestedPapersResponse>(`/papers/${id}/suggestions`, {
      params,
    });
    return response.data;
  },
  // 24. Get AI Analysis Result
  async getAiAnalysisResult(
    processId: string,
    paperId: string,
    phase: number,
  ): Promise<GetAiAnalysisResultResponse> {
    const response = await api.get<GetAiAnalysisResultResponse>(
      `/study-selection/${processId}/papers/${paperId}/ai-result`,
      { params: { phase } },
    );
    return response.data;
  },

  // 25. Evaluate AI (Trigger Analysis)
  async evaluateAi(processId: string, paperId: string): Promise<GetAiAnalysisResultResponse> {
    const response = await api.post<GetAiAnalysisResultResponse>(
      `/study-selection/${processId}/papers/${paperId}/ai-evaluate`,
    );
    return response.data;
  },

  // 25.1 Evaluate AI Full-text (Trigger Analysis)
  async evaluateFullTextAi(processId: string, paperId: string): Promise<EvaluateFullTextAiResponse> {
    const response = await api.post<EvaluateFullTextAiResponse>(
      `/study-selection/${processId}/papers/${paperId}/full-text/ai-evaluate`,
    );
    return response.data;
  },

  // 26. Add Exclusion Reasons (Bulk)
  async addExclusionReasons(
    processId: string,
    request: AddExclusionReasonsRequest,
  ): Promise<AddExclusionReasonsResponse> {
    const response = await api.post<AddExclusionReasonsResponse>(
      `/study-selection/${processId}/exclusion-reasons`,
      request,
    );
    return response.data;
  },

  // 27. Get Exclusion Reasons
  async getExclusionReasons(
    processId: string,
    params?: GetExclusionReasonsParams,
  ): Promise<GetExclusionReasonsResponse> {
    const response = await api.get<GetExclusionReasonsResponse>(
      `/study-selection/${processId}/exclusion-reasons`,
      { params },
    );
    return response.data;
  },

  // 28. Toggle Exclusion Reason Active Status
  async toggleExclusionReasonActive(id: string): Promise<ToggleExclusionReasonActiveResponse> {
    const response = await api.patch<ToggleExclusionReasonActiveResponse>(
      `/study-selection/exclusion-reasons/${id}/toggle-active`,
    );
    return response.data;
  },

  // 29. Delete Exclusion Reason
  async deleteExclusionReason(id: string): Promise<ApiResponse<null>> {
    const response = await api.delete<ApiResponse<null>>(`/study-selection/exclusion-reasons/${id}`);
    return response.data;
  },

  // 30. Bulk Resolve Papers
  async bulkResolvePapers(
    id: string,
    request: BulkResolvePapersRequest,
  ): Promise<BulkResolvePapersResponse> {
    const response = await api.post<BulkResolvePapersResponse>(
      `/study-selection/${id}/papers/bulk-resolve`,
      request,
    );
    return response.data;
  },

  // 31. Get Reviewer Decisions for a Paper
  async getReviewerDecisions(
    id: string,
    paperId: string,
    phase: number,
  ): Promise<GetReviewerDecisionsResponse> {
    const response = await api.get<GetReviewerDecisionsResponse>(
      `/study-selection/${id}/papers/${paperId}/reviewer-decisions`,
      { params: { phase } },
    );
    return response.data;
  },


  // 33. Get Included Full-Text Papers
  async getIncludedFullTextPapers(
    id: string,
    params?: GetIncludedFullTextPapersParams,
  ): Promise<GetIncludedFullTextPapersResponse> {
    const response = await api.get<GetIncludedFullTextPapersResponse>(
      `/study-selection/${id}/included-full-text-papers`,
      { params },
    );
    return response.data;
  },

  // 34. Get Included Papers (Snapshoted)
  async getIncludedPapers(
    id: string,
    params?: GetIncludedPapersParams,
  ): Promise<GetIncludedPapersResponse> {
    const response = await api.get<GetIncludedPapersResponse>(
      `/study-selection/${id}/included-papers`,
      { params },
    );
    return response.data;
  },
 
  // 35. Bulk Add Papers to Dataset (Snapshot)
  async bulkAddToDataset(
    id: string,
    request: BulkAddToDatasetRequest,
  ): Promise<BulkAddToDatasetResponse> {
    const response = await api.post<BulkAddToDatasetResponse>(
      `/study-selection/${id}/bulk-dataset`,
      request,
    );
    return response.data;
  },



  // 37. Get Reviewer Assignment Table
  async getReviewerAssignmentTable(
    processId: string,
    reviewerId: string,
  ): Promise<GetReviewerAssignmentTableResponse> {
    const response = await api.get<GetReviewerAssignmentTableResponse>(
      `/study-selection/${processId}/reviewers/${reviewerId}/assignment-table`,
    );
    return response.data;
  },

  // 38. Get Conflict Status for Papers
  async getConflictStatus(processId: string, phase: number): Promise<GetConflictStatusResponse> {
    const response = await api.get<GetConflictStatusResponse>(
      `/study-selection/${processId}/papers/conflict-status`,
      { params: { phase } },
    );
    return response.data;
  },

  // 39. Live Review Import (Fetch criteria from protocol/live review)
  async getLiveReviewImport(id: string): Promise<ApiResponse<unknown>> {
    const response = await api.get<ApiResponse<unknown>>(`/study-selection/${id}/live-review-import`);
    return response.data;
  },
  
  // 40. Get Final Resolution Progress (Statistics & Unified Paper List)
  async getFinalResolutionProgress(
    id: string,
    params?: FinalResolutionProgressParams,
  ): Promise<GetFinalResolutionProgressResponse> {
    const response = await api.get<GetFinalResolutionProgressResponse>(
      `/study-selection/${id}/final-resolution-progress`,
      { params },
    );
    return response.data;
  },
};
