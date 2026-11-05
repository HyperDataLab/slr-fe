import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ArgumentGraph from "./ArgumentGraph";

vi.mock("react-cytoscapejs", () => ({ default: () => null }));
afterEach(cleanup);
const claim = "A full claim that remains readable in the inspector even when the graph card truncates long source text.";
const graph = { nodes: [{ node_id: "claim", type: "I", content: claim }, { node_id: "scheme", type: "S", label: "Support" }], edges: [{ edge_id: "edge-1", source: "claim", target: "scheme", role: "premise" }] };

describe("Shared admin graph in the leader workspace", () => {
  it("opens full node details and closes the inspector", () => {
    render(<ArgumentGraph graph={graph} />);
    fireEvent.click(screen.getByRole("button", { name: claim }));
    expect(screen.getByRole("complementary", { name: "Selected graph node" }).textContent).toContain(claim);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("complementary")).toBeNull();
  });
  it("preserves edge review and requires a rejection reason", () => {
    const review = vi.fn();
    render(<ArgumentGraph graph={graph} onReviewEdge={review} />);
    fireEvent.click(screen.getByRole("button", { name: "Verify edge" }));
    expect(review).toHaveBeenCalledWith("edge-1", "VERIFIED");
    const reject = screen.getByRole("button", { name: "Reject edge" }) as HTMLButtonElement;
    expect(reject.disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: "Reason for rejecting edge edge-1" }), { target: { value: "Source does not support the claim" } });
    fireEvent.click(reject);
    expect(review).toHaveBeenCalledWith("edge-1", "REJECTED", "Source does not support the claim");
  });
  it("does not expose review actions without permission", () => {
    render(<ArgumentGraph graph={graph} />);
    expect(screen.queryByRole("button", { name: "Verify edge" })).toBeNull();
  });
});
