import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SynthesisWorkspaceDto } from "../../../types/synthesisExecution";
import SynthesisDashboard from "./SynthesisDashboard";

const workspace = {
  process: { status: "InProgress", startedAt: null, completedAt: null },
  totalExtractedPapers: 3,
  themes: [{ id: "t1" }],
  findings: [{ id: "f1" }, { id: "f2" }],
} as unknown as SynthesisWorkspaceDto;

function renderDashboard(props: {
  isSynthesisComplete?: boolean;
  isReadOnly?: boolean;
  withArtifacts?: boolean;
  workspace?: SynthesisWorkspaceDto;
}) {
  const onNavigateToArtifacts = vi.fn();
  const onNavigateToThematic = vi.fn();
  const onNavigateToCharts = vi.fn();
  const onNavigateToRqReporting = vi.fn();
  const dashboardWorkspace = props.workspace ?? workspace;
  const finalizedFindingCount = props.isSynthesisComplete
    ? dashboardWorkspace.findings.length
    : Math.min(1, dashboardWorkspace.findings.length);
  render(
    <SynthesisDashboard
      workspace={dashboardWorkspace}
      finalizedFindingCount={finalizedFindingCount}
      evidenceCount={dashboardWorkspace.themes.length === 0 ? 0 : 4}
      isReadOnly={props.isReadOnly}
      isSynthesisComplete={props.isSynthesisComplete}
      onNavigateToThematic={onNavigateToThematic}
      onNavigateToDescriptiveCharts={onNavigateToCharts}
      onNavigateToRqReporting={onNavigateToRqReporting}
      onNavigateToArtifacts={props.withArtifacts === false ? undefined : onNavigateToArtifacts}
    />,
  );
  return { onNavigateToArtifacts, onNavigateToThematic, onNavigateToCharts, onNavigateToRqReporting };
}

describe("SynthesisDashboard", () => {
  it("shows the four summary metrics and navigates to each available module", () => {
    const callbacks = renderDashboard({ isSynthesisComplete: true });

    expect(screen.getByText("Synthesis overview")).toBeTruthy();
    expect(screen.getByText("Themes")).toBeTruthy();
    expect(screen.getByText("RQ findings")).toBeTruthy();
    expect(screen.getByText("Linked evidence")).toBeTruthy();
    expect(screen.getByText("Extracted papers")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Thematic Analysis/ }));
    fireEvent.click(screen.getByRole("button", { name: /Descriptive Charts/ }));
    fireEvent.click(screen.getByRole("button", { name: /RQ Reporting/ }));
    fireEvent.click(screen.getByRole("button", { name: /SLR Artifacts/ }));

    expect(callbacks.onNavigateToThematic).toHaveBeenCalledOnce();
    expect(callbacks.onNavigateToCharts).toHaveBeenCalledOnce();
    expect(callbacks.onNavigateToRqReporting).toHaveBeenCalledOnce();
    expect(callbacks.onNavigateToArtifacts).toHaveBeenCalledOnce();
    expect(screen.getByText("Ready to generate")).toBeTruthy();
  });

  it("shows the remaining RQ prerequisite for artifacts", () => {
    renderDashboard({ isSynthesisComplete: false });
    expect(screen.getByText("1 of 2 findings finalized")).toBeTruthy();
  });

  it("hides the artifacts module when its route handler is unavailable", () => {
    renderDashboard({ withArtifacts: false });
    expect(screen.queryByRole("button", { name: /SLR Artifacts/ })).toBeNull();
  });

  it("keeps completed empty workspaces read-only and reports their missing data", () => {
    const emptyCompletedWorkspace = {
      process: { status: "Completed", startedAt: null, completedAt: null },
      totalExtractedPapers: 0,
      themes: [],
      findings: [],
    } as unknown as SynthesisWorkspaceDto;
    renderDashboard({ workspace: emptyCompletedWorkspace, isReadOnly: true });

    expect(screen.getByText("Completed")).toBeTruthy();
    expect(screen.getByText("Read-only")).toBeTruthy();
    expect(screen.getByText("This synthesis is marked completed, but extracted papers and RQ findings are not recorded. Verify the source data if this is unexpected.")).toBeTruthy();
    expect(screen.getByText("0 of 0 findings finalized")).toBeTruthy();
  });
});
