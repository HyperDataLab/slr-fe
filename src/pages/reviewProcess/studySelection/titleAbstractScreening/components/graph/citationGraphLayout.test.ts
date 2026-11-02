import { describe, expect, it } from "vitest";
import cytoscape from "cytoscape";
import type { CitationGraphDto } from "../../../../../../types/studySelection";
import { citationNodeDiameter, layoutCitationGraph, NODE_CLEARANCE } from "./citationGraphLayout";

function makeGraph(count: number): CitationGraphDto {
  const nodes: CitationGraphDto["nodes"] = Array.from({ length: count }, (_, index) => ({
    id: `paper-${index}`,
    title: `Research paper ${index}`,
    year: 2026 - (index % 18),
    authors: `Author ${index}`,
    doi: null,
    citationCount: index * 3,
    depth: index === 0 ? 0 : index < Math.ceil(count / 2) ? 1 : 2,
  }));
  const edges: CitationGraphDto["edges"] = [];
  for (let index = 1; index < count; index += 1) {
    const parent = index < Math.ceil(count / 2) ? 0 : 1 + ((index - 1) % Math.max(1, Math.ceil(count / 2) - 1));
    edges.push({ sourcePaperId: `paper-${parent}`, targetPaperId: `paper-${index}`, confidenceScore: 0.9, relationType: "REFERENCE" });
    if (index > 2 && index % 4 === 0) {
      edges.push({ sourcePaperId: `paper-${index - 1}`, targetPaperId: `paper-${index}`, confidenceScore: 0.85, relationType: "CITATION" });
    }
  }
  return { nodes, edges };
}

describe("citation graph layout", () => {
  it("scales smoothly by publication age and uses a neutral fallback for missing or future years", () => {
    expect(citationNodeDiameter(2026, 2026)).toBe(78);
    expect(citationNodeDiameter(2024, 2026)).toBeGreaterThan(citationNodeDiameter(2021, 2026));
    expect(citationNodeDiameter(2020, 2026)).toBe(citationNodeDiameter(2020, 2026));
    expect(citationNodeDiameter(null, 2026)).toBe(42);
    expect(citationNodeDiameter(2028, 2026)).toBe(42);
    expect(citationNodeDiameter(1980, 2026)).toBe(34);
  });

  it.each([8, 100])("produces stable finite positions and separated nodes for a %i paper graph", (count) => {
    const graph = makeGraph(count);
    const first = layoutCitationGraph(graph, "paper-0", 2026);
    const second = layoutCitationGraph(graph, "paper-0", 2026);
    expect(first.positions.size).toBe(count);
    expect(first.positions.get("paper-0")).toEqual({ x: 0, y: 0 });
    const matchingYear = graph.nodes.find((node, index) => index > 0 && node.year === graph.nodes[0].year);
    if (matchingYear) expect(first.diameterById.get(matchingYear.id)).toBe(first.diameterById.get("paper-0"));

    for (const [id, point] of first.positions) {
      expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
      expect(point).toEqual(second.positions.get(id));
    }
    const cy = cytoscape({ headless: true, elements: graph.nodes.map(({ id }) => ({ data: { id } })) });
    cy.layout({ name: "preset", positions: Object.fromEntries(first.positions), fit: false }).run();
    for (const [id, expected] of first.positions) {
      expect(cy.getElementById(id).position()).toEqual(expected);
    }
    cy.destroy();
    for (let leftIndex = 0; leftIndex < graph.nodes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < graph.nodes.length; rightIndex += 1) {
        const left = graph.nodes[leftIndex];
        const right = graph.nodes[rightIndex];
        const leftPosition = first.positions.get(left.id)!;
        const rightPosition = first.positions.get(right.id)!;
        const required = (first.diameterById.get(left.id)! + first.diameterById.get(right.id)!) / 2 + NODE_CLEARANCE * 2;
        expect(Math.hypot(leftPosition.x - rightPosition.x, leftPosition.y - rightPosition.y)).toBeGreaterThanOrEqual(required - 2);
      }
    }
  });

});
