import api, { getValidAccessToken } from "../config/axios";
import type { ApiResponse } from "../types/project";

export const SLR_ARTIFACT_TYPES = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10"] as const;
export type SlrArtifactType = (typeof SLR_ARTIFACT_TYPES)[number];
export type SlrStoredPayloadKey = SlrArtifactType | "corpus";

export const SLR_FIELD_ROLES = [
  "finding",
  "conclusion",
  "outcome",
  "limitation",
  "population_context",
  "intervention",
  "comparator",
  "context",
  "study_design",
  "publication_year",
  "implementation_condition",
  "mechanism",
  "moderator",
  "effect_direction",
  "topic",
] as const;
export type SlrFieldRole = (typeof SLR_FIELD_ROLES)[number];

export type SlrDimensionRef = { field_id: string } | { role: SlrFieldRole };
export type SlrContextGroupBy = "outcome" | "intervention" | "population_context" | "context";

/** Generation options; every key is optional and the server applies its defaults for the rest. */
export interface SlrGenerateOptions {
  a3Mode?: "deterministic" | "ai";
  researchQuestionId?: string;
  contextGroupBy?: SlrContextGroupBy;
  gapMap?: { rows: SlrDimensionRef; columns: SlrDimensionRef };
  sparseThreshold?: number;
  /** Field id -> role; `null` leaves a field out of the synthesis. */
  fieldRoles?: Record<string, SlrFieldRole | null>;
}

export interface SlrArtifactReview {
  artifact_type: SlrArtifactType;
  decision: "APPROVED" | "REJECTED";
  note: string | null;
  reviewer_id: string;
  at: string;
}

export interface SlrArtifactRun {
  run_id: string;
  project_id: string;
  generated_at: string;
  generated_by: string | null;
  corpus_hash: string;
  corpus_version: string;
  artifacts: Array<{
    artifact_type: SlrArtifactType;
    artifact_id: string;
    review_status: string;
    validation_status: string;
  }>;
  a3?: { validation_status: string };
  reviews?: SlrArtifactReview[];
}

type GenerationStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
interface GenerationJobStatus { jobId: string; status: GenerationStatus; runId?: string; error?: { message?: string } | null }
interface GenerationJobResponse { job: GenerationJobStatus; eventsUrl: string }
const isTerminalGeneration = (job: GenerationJobStatus) => job.status === "COMPLETED" || job.status === "FAILED";

async function streamGenerationStatus(eventsUrl: string): Promise<GenerationJobStatus | null> {
  const token = await getValidAccessToken();
  const apiBasePath = new URL(api.defaults.baseURL || "/api", window.location.origin).pathname.replace(/\/$/, "");
  const relativeUrl = eventsUrl.startsWith(apiBasePath + "/") ? eventsUrl.slice(apiBasePath.length) : eventsUrl;
  const url = new URL(api.getUri({ url: relativeUrl }), window.location.origin);
  const response = await fetch(url, { headers: { Accept: "text/event-stream", Authorization: "Bearer " + token }, credentials: "include", cache: "no-store" });
  if (!response.ok || !response.body) return null;
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
        const data = frame.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
        if (eventName === "stream-error") return null;
        if (eventName === "status" && data) {
          const job = JSON.parse(data) as GenerationJobStatus;
          if (isTerminalGeneration(job)) return job;
        }
        boundary = buffer.indexOf("\n\n");
      }
      if (done) return null;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** The part of the live corpus the generate form needs to offer valid choices. */
export interface SlrCorpusOptions {
  research_questions: Array<{ rq_id: string; code: string | null; question: string }>;
  field_roles: Array<{
    field_id: string;
    field_name: string;
    section_name: string;
    role: SlrFieldRole | null;
  }>;
}

export interface SlrValidationIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
  path?: string;
  node_id?: string;
  edge_id?: string;
}

export interface SlrValidationReport {
  status: "valid" | "invalid";
  layer_a: { valid: boolean; issues: SlrValidationIssue[] };
  layer_b: { valid: boolean; skipped: boolean; issues: SlrValidationIssue[] };
  needs_human_review: boolean;
  error_count: number;
  warning_count: number;
}

const path = (projectId: string) => `/projects/${encodeURIComponent(projectId)}/synthesis/artifacts`;

/** The artifacts API sends `isSuccess` like the rest of the API and keeps the older `success` flag. */
function unwrap<T>(response: ApiResponse<T> & { success?: boolean }): T {
  if (!(response.isSuccess ?? response.success)) throw new Error(response.message || "Request failed");
  return response.data;
}

/** Drops unset keys: the server rejects unknown keys and an empty `researchQuestionId`. */
function pruneOptions(options: SlrGenerateOptions): SlrGenerateOptions {
  const body: SlrGenerateOptions = {};
  if (options.a3Mode) body.a3Mode = options.a3Mode;
  if (options.researchQuestionId) body.researchQuestionId = options.researchQuestionId;
  if (options.contextGroupBy) body.contextGroupBy = options.contextGroupBy;
  if (options.gapMap) body.gapMap = options.gapMap;
  if (options.sparseThreshold !== undefined) body.sparseThreshold = options.sparseThreshold;
  if (options.fieldRoles && Object.keys(options.fieldRoles).length > 0) body.fieldRoles = options.fieldRoles;
  return body;
}

export const slrArtifactsService = {
  async listRuns(projectId: string): Promise<SlrArtifactRun[]> {
    return unwrap((await api.get<ApiResponse<SlrArtifactRun[]>>(`${path(projectId)}/runs`)).data);
  },
  async generateRun(projectId: string, options: SlrGenerateOptions = {}): Promise<SlrArtifactRun> {
    const body = { a3Mode: "ai" as const, ...pruneOptions(options) };
    const queued = unwrap((await api.post<ApiResponse<GenerationJobResponse>>(path(projectId) + "/runs", body)).data);
    let job: GenerationJobStatus | null = null;
    try { job = await streamGenerationStatus(queued.eventsUrl); } catch { /* Recover from a dropped stream through durable status polling. */ }
    while (!job || !isTerminalGeneration(job)) {
      const status = unwrap((await api.get<ApiResponse<GenerationJobStatus>>(path(projectId) + "/runs/jobs/" + encodeURIComponent(queued.job.jobId))).data);
      if (isTerminalGeneration(status)) { job = status; break; }
      await new Promise((resolve) => window.setTimeout(resolve, 3000));
    }
    if (job.status === "FAILED") throw new Error(job.error?.message || "Artifact generation failed. Please try again.");
    if (!job.runId) throw new Error("Artifact generation completed without a run record.");
    return unwrap((await api.get<ApiResponse<SlrArtifactRun>>(path(projectId) + "/runs/" + encodeURIComponent(job.runId))).data);
  },
  async getArtifact(projectId: string, runId: string, artifactType: SlrStoredPayloadKey): Promise<unknown> {
    return unwrap((await api.get<ApiResponse<unknown>>(`${path(projectId)}/runs/${encodeURIComponent(runId)}/artifacts/${artifactType}`)).data);
  },
  async reviewArtifact(
    projectId: string,
    runId: string,
    artifactType: SlrArtifactType,
    decision: "APPROVED" | "REJECTED",
    note?: string,
  ): Promise<SlrArtifactRun> {
    const trimmed = note?.trim();
    const body = trimmed ? { decision, note: trimmed } : { decision };
    return unwrap((await api.post<ApiResponse<SlrArtifactRun>>(`${path(projectId)}/runs/${encodeURIComponent(runId)}/artifacts/${artifactType}/review`, body)).data);
  },
  /** The live corpus (recomputed on every call), used to offer valid generation options. */
  async getCorpusOptions(projectId: string): Promise<SlrCorpusOptions> {
    return unwrap((await api.get<ApiResponse<SlrCorpusOptions>>(`${path(projectId)}/corpus`)).data);
  },
  async getA3Schema(projectId: string): Promise<unknown> {
    return unwrap((await api.get<ApiResponse<unknown>>(`${path(projectId)}/schemas/a3`)).data);
  },
  /** Checks a graph against a run's corpus. The server does not store the graph. */
  async validateA3(projectId: string, graph: unknown, runId?: string): Promise<SlrValidationReport> {
    const body = runId ? { graph, runId } : { graph };
    return unwrap((await api.post<ApiResponse<SlrValidationReport>>(`${path(projectId)}/a3/validate`, body)).data);
  },
};
