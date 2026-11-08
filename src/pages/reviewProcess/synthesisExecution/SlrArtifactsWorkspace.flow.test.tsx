import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectMember } from "../../../hooks/useProjectMember";
import { slrArtifactsService } from "../../../services/slrArtifactsService";
import SlrArtifactsWorkspace from "./SlrArtifactsWorkspace";

vi.mock("../../../hooks/useProjectMember", () => ({ useProjectMember: vi.fn() }));
vi.mock("../../../services/slrArtifactsService", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../services/slrArtifactsService")>();
  return {
    ...original,
    slrArtifactsService: {
      listRuns: vi.fn(),
      generateRun: vi.fn(),
      getArtifact: vi.fn(),
      reviewArtifact: vi.fn(),
      getCorpusOptions: vi.fn(),
      getA3Schema: vi.fn(),
      validateA3: vi.fn(),
    },
  };
});

const RUN_ID = "run-20261001000000-abc123";
const run = { run_id: RUN_ID, project_id: "p1", generated_at: "2026-10-01T00:00:00.000Z", generated_by: "u1", corpus_hash: "h", corpus_version: "2", artifacts: [] };

const artifactFor = (reviewStatus = "unreviewed", validationStatus = "not_applicable", reviews: unknown[] = []) => ({
  artifact_id: "art-1",
  title: "Stored artifact",
  nodes: [],
  edges: [],
  metadata: { review_status: reviewStatus, validation_status: validationStatus, reviews },
});

function renderWorkspace() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><SlrArtifactsWorkspace projectId="p1" /></QueryClientProvider>);
}

function asMember(isLeader: boolean) {
  vi.mocked(useProjectMember).mockReturnValue({ member: { isLeader } } as ReturnType<typeof useProjectMember>);
}

describe("SlrArtifactsWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asMember(true);
    vi.mocked(slrArtifactsService.listRuns).mockResolvedValue([run]);
    vi.mocked(slrArtifactsService.getArtifact).mockResolvedValue(artifactFor());
    vi.mocked(slrArtifactsService.reviewArtifact).mockResolvedValue(run);
    vi.mocked(slrArtifactsService.generateRun).mockResolvedValue(run);
    vi.mocked(slrArtifactsService.getCorpusOptions).mockResolvedValue({
      research_questions: [{ rq_id: "rq1", code: "RQ1", question: "What works?" }],
      field_roles: [{ field_id: "f1", field_name: "Outcome", section_name: "Results", role: "outcome" }],
    });
  });

  const chooseArtifact = async (name: RegExp) => {
    fireEvent.click(await screen.findByRole("button", { name: "Artifact" }));
    fireEvent.click(await screen.findByRole("option", { name }));
  };

  it("switches artifacts from the dropdown and loads the chosen one", async () => {
    renderWorkspace();
    await chooseArtifact(/A8 · Evidence Gap Map/);
    await waitFor(() => expect(slrArtifactsService.getArtifact).toHaveBeenCalledWith("p1", RUN_ID, "A8"));
    expect(screen.getByRole("button", { name: "Artifact" }).textContent).toContain("A8 · Evidence Gap Map");
  });

  it("steps through artifacts with the previous and next buttons", async () => {
    renderWorkspace();
    fireEvent.click(await screen.findByRole("button", { name: "Next artifact" }));
    await waitFor(() => expect(slrArtifactsService.getArtifact).toHaveBeenCalledWith("p1", RUN_ID, "A4"));
  });

  it("rejects with a note and shows the recorded history", async () => {
    vi.mocked(slrArtifactsService.getArtifact).mockResolvedValue(artifactFor("rejected", "not_applicable", [
      { artifact_type: "A1", decision: "REJECTED", note: "Missing quotes", reviewer_id: "u1", at: "2026-10-02T00:00:00.000Z" },
    ]));
    renderWorkspace();
    const history = await screen.findByRole("list", { name: "Review history" });
    expect(within(history).getByText("Missing quotes")).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Review note/), { target: { value: "  Needs another pass  " } });
    fireEvent.click(screen.getByRole("button", { name: /Approve after review/ }));
    await waitFor(() => expect(slrArtifactsService.reviewArtifact).toHaveBeenCalledWith("p1", RUN_ID, "A1", "APPROVED", "Needs another pass"));
  });

  it("lets the leader reject an artifact that failed validation but not approve it", async () => {
    vi.mocked(slrArtifactsService.getArtifact).mockResolvedValue(artifactFor("needs_human_review", "invalid"));
    renderWorkspace();
    const approve = await screen.findByRole("button", { name: /Approve after review/ });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
    const reject = screen.getByRole("button", { name: /Reject/ });
    expect((reject as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(reject);
    await waitFor(() => expect(slrArtifactsService.reviewArtifact).toHaveBeenCalledWith("p1", RUN_ID, "A1", "REJECTED", ""));
  });

  it("hides review actions from reviewers but still shows the history", async () => {
    asMember(false);
    renderWorkspace();
    expect(await screen.findByRole("region", { name: "Artifact review" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Reject/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Generate A1–A10/ })).toBeNull();
  });

  it("opens the options form, sends the chosen options and closes it", async () => {
    renderWorkspace();
    fireEvent.click(await screen.findByRole("button", { name: /Generate A1–A10/ }));
    const form = await screen.findByRole("region", { name: "Generate options" });
    await waitFor(() => expect(within(form).getByRole("option", { name: /RQ1/ })).toBeTruthy());

    fireEvent.change(within(form).getByLabelText(/Research question/), { target: { value: "rq1" } });
    fireEvent.change(within(form).getByLabelText(/Gap map rows/), { target: { value: "role:outcome" } });
    fireEvent.click(within(form).getByRole("button", { name: /Generate A1–A10/ }));
    expect(await within(form).findByRole("alert")).toBeTruthy();
    expect(slrArtifactsService.generateRun).not.toHaveBeenCalled();

    fireEvent.change(within(form).getByLabelText(/Gap map columns/), { target: { value: "field:f1" } });
    fireEvent.click(within(form).getByRole("button", { name: /Generate A1–A10/ }));
    await waitFor(() => expect(slrArtifactsService.generateRun).toHaveBeenCalledWith("p1", {
      a3Mode: "ai",
      contextGroupBy: "outcome",
      sparseThreshold: 1,
      researchQuestionId: "rq1",
      gapMap: { rows: { role: "outcome" }, columns: { field_id: "f1" } },
    }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Generate options" })).toBeNull());
  });

  it("keeps the form open and shows the server message when generation fails", async () => {
    vi.mocked(slrArtifactsService.generateRun).mockRejectedValue({ response: { status: 400, data: { message: "Unknown extraction field(s): f9" } } });
    renderWorkspace();
    fireEvent.click(await screen.findByRole("button", { name: /Generate A1–A10/ }));
    const form = await screen.findByRole("region", { name: "Generate options" });
    fireEvent.click(within(form).getByRole("button", { name: /Generate A1–A10/ }));
    expect(await within(form).findByText("Unknown extraction field(s): f9")).toBeTruthy();
  });

  it("validates an edited A3 graph and lists the issues", async () => {
    vi.mocked(slrArtifactsService.validateA3).mockResolvedValue({
      status: "invalid",
      layer_a: { valid: true, issues: [] },
      layer_b: { valid: false, skipped: false, issues: [{ code: "ORPHAN", severity: "error", message: "Node n1 has no edges", node_id: "n1" }] },
      needs_human_review: false,
      error_count: 1,
      warning_count: 0,
    });
    renderWorkspace();
    await chooseArtifact(/A3 · Scientific Argument Graph/);
    const textarea = await screen.findByLabelText("A3 graph JSON");
    expect((textarea as HTMLTextAreaElement).value).not.toContain("metadata");

    fireEvent.change(textarea, { target: { value: "{ not json" } });
    fireEvent.click(screen.getByRole("button", { name: /Validate graph/ }));
    expect(await screen.findByText(/not valid JSON/)).toBeTruthy();
    expect(slrArtifactsService.validateA3).not.toHaveBeenCalled();

    fireEvent.change(textarea, { target: { value: JSON.stringify({ nodes: [], edges: [] }) } });
    fireEvent.click(screen.getByRole("button", { name: /Validate graph/ }));
    expect(await screen.findByText(/Node n1 has no edges/)).toBeTruthy();
    expect(slrArtifactsService.validateA3).toHaveBeenCalledWith("p1", { nodes: [], edges: [] }, RUN_ID);
  });
});
