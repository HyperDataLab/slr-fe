// Candidate Paper Service - API Integration Layer
// Handles all HTTP calls related to backward snowballing candidates

import api, { getValidAccessToken } from "../config/axios";

import type {
  CandidatePaperDto,
  SelectCandidatePaperRequest,
  RejectCandidatePaperRequest,
  PaperWithCandidateDto,
} from "../types/paper";
import type { ApiResponse, PaginatedResponse } from "../types/project";

export interface GetCandidatePapersParams {
  pageNumber?: number;
  pageSize?: number;
  searchTerm?: string;
  status?: number;
  year?: string;
}

export interface PaginationParams {
  pageNumber?: number;
  pageSize?: number;
}

export interface GetPapersWithCandidatesOverviewParams extends PaginationParams {
  searchTerm?: string;
  year?: string;
}
type ReferenceExtractionStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

interface ReferenceExtractionJob {
  jobId: string;
  status: ReferenceExtractionStatus;
  eventsUrl: string;
}

interface ReferenceExtractionJobStatus {
  status: ReferenceExtractionStatus;
  found?: number;
  added?: number;
  error?: { message?: string } | null;
}

const extractionDelay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const isTerminalExtractionStatus = (job: ReferenceExtractionJobStatus) =>
  job.status === "COMPLETED" || job.status === "FAILED";

const extractionResult = (
  job: ReferenceExtractionJobStatus,
): ApiResponse<{ found: number; added: number }> => {
  if (job.status === "FAILED") {
    throw new Error(job.error?.message || "Reference extraction failed. Please try again.");
  }
  return {
    isSuccess: true,
    message: "Reference extraction completed",
    data: { found: job.found ?? 0, added: job.added ?? 0 },
    errors: null,
  };
};

const streamExtractionStatus = async (
  eventsUrl: string,
): Promise<ReferenceExtractionJobStatus | null> => {
  const token = await getValidAccessToken();
  const apiBasePath = new URL(api.defaults.baseURL || "/api", window.location.origin).pathname.replace(/\/$/, "");
  const apiRelativeEventsUrl = eventsUrl.startsWith(`${apiBasePath}/`)
    ? eventsUrl.slice(apiBasePath.length)
    : eventsUrl;
  const url = new URL(api.getUri({ url: apiRelativeEventsUrl }), window.location.origin);
  const response = await fetch(url, {
    headers: { Accept: "text/event-stream", Authorization: `Bearer ${token}` },
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Could not follow extraction status (HTTP ${response.status}).`);
  }
  if (!response.body) throw new Error("This browser cannot stream extraction status.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const eventName = frame.match(/^event:\s*(.+)$/m)?.[1]?.trim();
        const data = frame
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (eventName === "stream-error") return null;
        if (eventName === "status" && data) {
          const job = JSON.parse(data) as ReferenceExtractionJobStatus;
          if (isTerminalExtractionStatus(job)) return job;
        }
        boundary = buffer.indexOf("\n\n");
      }
      if (done) return null;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
};

const getExtractionStatus = async (
  paperId: string,
  jobId: string,
): Promise<ReferenceExtractionJobStatus> => {
  const response = await api.get<ApiResponse<ReferenceExtractionJobStatus>>(
    `/papers/${encodeURIComponent(paperId)}/extract-references/${encodeURIComponent(jobId)}`,
  );
  if (!response.data.isSuccess) {
    throw new Error(response.data.message || "Could not read extraction status.");
  }
  return response.data.data;
};

const waitForExtraction = async (
  paperId: string,
  job: ReferenceExtractionJob,
): Promise<ApiResponse<{ found: number; added: number }>> => {
  // Reconnect once if the stream closes early, then use the status endpoint as a fallback.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let streamedJob: ReferenceExtractionJobStatus | null;
    try {
      streamedJob = await streamExtractionStatus(job.eventsUrl);
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      streamedJob = null;
    }
    if (streamedJob) return extractionResult(streamedJob);
    const currentJob = await getExtractionStatus(paperId, job.jobId);
    if (isTerminalExtractionStatus(currentJob)) return extractionResult(currentJob);
    if (attempt === 0) await extractionDelay(1500);
  }

  while (true) {
    await extractionDelay(3000);
    const currentJob = await getExtractionStatus(paperId, job.jobId);
    if (isTerminalExtractionStatus(currentJob)) return extractionResult(currentJob);
  }
};

export const candidatePaperService = {
  /**
   * Retrieves a paginated and filtered list of candidate papers.
   * Note: This endpoint is not explicitly listed in the new guide but kept for compatibility.
   * GET /api/candidate-papers
   */
  async getCandidatesByReviewProcess(
    processId: string,
    params?: GetCandidatePapersParams,
  ): Promise<ApiResponse<PaginatedResponse<CandidatePaperDto>>> {
    const response = await api.get<ApiResponse<PaginatedResponse<CandidatePaperDto>>>(
      `/candidate-papers`,
      { params: { ...params, processId } },
    );
    return response.data;
  },

  /**
   * Rejects one or multiple candidate papers from the pool.
   * POST /api/candidate-papers/reject
   */
  async rejectCandidates(
    request: RejectCandidatePaperRequest,
  ): Promise<ApiResponse<undefined>> {
    const response = await api.post<ApiResponse<undefined>>(
      `/candidate-papers/reject`,
      request,
    );
    return response.data;
  },

  /**
   * Promotes candidates to the main screening queue after deduplication.
   * POST /api/candidate-papers/select
   */
  async selectCandidates(
    request: SelectCandidatePaperRequest,
  ): Promise<ApiResponse<undefined>> {
    const response = await api.post<ApiResponse<undefined>>(
      `/candidate-papers/select`,
      request,
    );
    return response.data;
  },

  /**
   * Retrieves a paginated list of source papers and their candidate counts for a project.
   * GET /api/projects/{projectId}/papers/papers-with-candidates
   */
  async getPapersWithCandidatesOverview(
    projectId: string,
    params?: GetPapersWithCandidatesOverviewParams
  ): Promise<ApiResponse<PaginatedResponse<PaperWithCandidateDto>>> {
    const response = await api.get<ApiResponse<PaginatedResponse<PaperWithCandidateDto>>>(
      `/projects/${projectId}/papers/papers-with-candidates`,
      { params }
    );
    return response.data;
  },

  /**
   * Retrieves extracted candidates for one specific source paper.
   * GET /api/papers/{paperId}/candidates
   */
  async getCandidatesByPaperId(
    paperId: string,
    params?: GetCandidatePapersParams
  ): Promise<ApiResponse<PaginatedResponse<CandidatePaperDto>>> {
    const response = await api.get<ApiResponse<PaginatedResponse<CandidatePaperDto>>>(
      `/papers/${paperId}/candidates`,
      { params }
    );
    return response.data;
  },

  /**
   * Extracts references from a paper's full-text PDF and populates the candidate pool.
   * POST /api/papers/{paperId}/extract-references
   */
  async extractReferences(paperId: string): Promise<ApiResponse<{ found: number; added: number }>> {
    const response = await api.post<ApiResponse<ReferenceExtractionJob>>(
      `/papers/${encodeURIComponent(paperId)}/extract-references`,
    );
    if (!response.data.isSuccess) {
      throw new Error(response.data.message || "Could not start reference extraction.");
    }
    return waitForExtraction(paperId, response.data.data);
  },
};
