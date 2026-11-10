import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "../config/axios";
import { slrArtifactsService } from "./slrArtifactsService";

vi.mock("../config/axios", () => ({ default: { get: vi.fn(), post: vi.fn(), defaults: { baseURL: "http://localhost/api" }, getUri: ({ url }: { url: string }) => url }, getValidAccessToken: vi.fn(async () => "test-token") }));

const run = { run_id: "run-20261001000000-abc123", artifacts: [], reviews: [] };
const base = "/projects/p1/synthesis/artifacts";

describe("slrArtifactsService", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

  it("queues generation, follows the SSE status, and returns the completed run", async () => {
    const job = { jobId: "job-1", status: "COMPLETED", runId: run.run_id };
    vi.mocked(api.post).mockResolvedValue({ data: { isSuccess: true, data: { job, eventsUrl: base + "/runs/jobs/job-1/events" }, message: "" } });
    vi.mocked(api.get).mockResolvedValue({ data: { isSuccess: true, data: run, message: "" } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("event: status\ndata: " + JSON.stringify(job) + "\n\n", { status: 200 })));
    await expect(slrArtifactsService.generateRun("p1", { researchQuestionId: "", fieldRoles: {}, sparseThreshold: 2 })).resolves.toEqual(run);
    expect(api.post).toHaveBeenCalledWith(base + "/runs", { a3Mode: "ai", sparseThreshold: 2 });
    expect(api.get).toHaveBeenCalledWith(base + "/runs/" + run.run_id);
  });

  it("reads the success flag under either name", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { success: true, data: [run], message: "" } });
    await expect(slrArtifactsService.listRuns("p1")).resolves.toEqual([run]);
    vi.mocked(api.get).mockResolvedValueOnce({ data: { isSuccess: false, data: null, message: "nope" } });
    await expect(slrArtifactsService.listRuns("p1")).rejects.toThrow("nope");
  });

  it("sends the review note only when there is one", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { isSuccess: true, data: run, message: "" } });
    await slrArtifactsService.reviewArtifact("p1", run.run_id, "A3", "REJECTED", "  Unsupported CA  ");
    expect(api.post).toHaveBeenLastCalledWith(`${base}/runs/${run.run_id}/artifacts/A3/review`, { decision: "REJECTED", note: "Unsupported CA" });
    await slrArtifactsService.reviewArtifact("p1", run.run_id, "A3", "APPROVED", "   ");
    expect(api.post).toHaveBeenLastCalledWith(`${base}/runs/${run.run_id}/artifacts/A3/review`, { decision: "APPROVED" });
  });

  it("validates a graph against a run", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { isSuccess: true, data: { status: "valid" }, message: "" } });
    await slrArtifactsService.validateA3("p1", { nodes: [] }, run.run_id);
    expect(api.post).toHaveBeenCalledWith(`${base}/a3/validate`, { graph: { nodes: [] }, runId: run.run_id });
  });
});
