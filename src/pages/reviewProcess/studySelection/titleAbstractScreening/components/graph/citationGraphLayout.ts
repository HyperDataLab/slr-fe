import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceRadial,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import type { CitationEdgeDto, CitationGraphDto, CitationGraphNodeDto } from "../../../../../../types/studySelection";

export interface GraphPoint {
  x: number;
  y: number;
}

export interface CitationGraphLayout {
  positions: Map<string, GraphPoint>;
  depthById: Map<string, number>;
  diameterById: Map<string, number>;
}

const UNKNOWN_YEAR_DIAMETER = 42;
export const NODE_CLEARANCE = 24;
const MIN_RING_RADIUS = 185;
const MIN_RING_SEPARATION = 145;
const SIMULATION_TICKS = 240;
const FULL_TURN = Math.PI * 2;

const diameterStops = [
  { age: 0, diameter: 78 },
  { age: 2, diameter: 70 },
  { age: 3, diameter: 66 },
  { age: 5, diameter: 58 },
  { age: 6, diameter: 54 },
  { age: 10, diameter: 46 },
  { age: 11, diameter: 42 },
  { age: 30, diameter: 34 },
] as const;

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

/** Recent papers receive larger nodes; missing or implausible years stay at a neutral size. */
export function citationNodeDiameter(year: number | null | undefined, currentYear = new Date().getFullYear()): number {
  if (!Number.isInteger(year) || year! < 1500 || year! > currentYear) return UNKNOWN_YEAR_DIAMETER;

  const age = currentYear - year!;
  const upperStopIndex = diameterStops.findIndex((stop) => stop.age >= age);
  if (upperStopIndex === -1) return diameterStops[diameterStops.length - 1].diameter;
  if (upperStopIndex === 0) return diameterStops[0].diameter;

  const lower = diameterStops[upperStopIndex - 1];
  const upper = diameterStops[upperStopIndex];
  const progress = (age - lower.age) / (upper.age - lower.age);
  return Math.round(lower.diameter + (upper.diameter - lower.diameter) * smoothstep(progress));
}

function buildDepthMap(data: CitationGraphDto, rootId: string): Map<string, number> {
  const depths = new Map<string, number>();
  data.nodes.forEach((node) => {
    if (Number.isInteger(node.depth) && node.depth! >= 0) depths.set(node.id, node.depth!);
  });
  depths.set(rootId, 0);

  const neighbours = new Map<string, Set<string>>();
  data.edges.forEach(({ sourcePaperId, targetPaperId }) => {
    neighbours.set(sourcePaperId, (neighbours.get(sourcePaperId) ?? new Set()).add(targetPaperId));
    neighbours.set(targetPaperId, (neighbours.get(targetPaperId) ?? new Set()).add(sourcePaperId));
  });

  const queue = [rootId];
  while (queue.length) {
    const currentId = queue.shift()!;
    const currentDepth = depths.get(currentId) ?? 0;
    for (const neighbourId of neighbours.get(currentId) ?? []) {
      if (!depths.has(neighbourId)) {
        depths.set(neighbourId, currentDepth + 1);
        queue.push(neighbourId);
      }
    }
  }

  data.nodes.forEach((node) => {
    if (!depths.has(node.id)) depths.set(node.id, Math.max(1, node.depth ?? 1));
  });
  return depths;
}

interface ForceNode extends SimulationNodeDatum {
  id: string;
  depth: number;
  diameter: number;
  targetRadius: number;
  collisionRadius: number;
}

interface ForceLink extends SimulationLinkDatum<ForceNode> {
  targetDistance: number;
}

function initialAngle(node: CitationGraphNodeDto, index: number, count: number, rootId: string): number {
  const angle = -Math.PI / 2 + (index / Math.max(count, 1)) * FULL_TURN;
  let hash = 2166136261;
  for (const character of `${rootId}:${node.id}`) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  const rotation = (hash >>> 0) / 0xffffffff * 0.16 - 0.08;
  return angle + rotation;
}

/** Deterministic radial force layout: depth anchors define hierarchy; charge, links and collision settle the network. */
export function layoutCitationGraph(
  data: CitationGraphDto,
  rootId: string,
  currentYear = new Date().getFullYear(),
): CitationGraphLayout {
  const depthById = buildDepthMap(data, rootId);
  const diameterById = new Map(data.nodes.map((node) => [node.id, citationNodeDiameter(node.year, currentYear)]));
  if (!data.nodes.length) return { positions: new Map(), depthById, diameterById };

  const nodesByDepth = new Map<number, CitationGraphNodeDto[]>();
  data.nodes.forEach((node) => {
    const depth = depthById.get(node.id) ?? 1;
    nodesByDepth.set(depth, [...(nodesByDepth.get(depth) ?? []), node]);
  });

  const radiusByDepth = new Map<number, number>([[0, 0]]);
  let previousRingRadius = 0;
  [...nodesByDepth.keys()].filter((depth) => depth > 0).sort((left, right) => left - right).forEach((depth) => {
    const layer = (nodesByDepth.get(depth) ?? []).slice().sort((left, right) => {
      const leftYear = left.year ?? -1;
      const rightYear = right.year ?? -1;
      return leftYear - rightYear || left.id.localeCompare(right.id);
    });
    const meanSpacing = layer.reduce((sum, node) => sum + (diameterById.get(node.id) ?? UNKNOWN_YEAR_DIAMETER) + NODE_CLEARANCE * 2, 0) / Math.max(layer.length, 1);
    const circumferenceRadius = (layer.length * meanSpacing) / FULL_TURN;
    const radius = depth === 1
      ? Math.max(depth * MIN_RING_RADIUS, circumferenceRadius, previousRingRadius + MIN_RING_SEPARATION)
      : Math.max(depth * MIN_RING_RADIUS, previousRingRadius - 90);
    radiusByDepth.set(depth, radius);
    previousRingRadius = radius;
  });

  const forceNodes: ForceNode[] = data.nodes.map((node) => {
    const depth = depthById.get(node.id) ?? 1;
    const layer = nodesByDepth.get(depth) ?? [];
    const index = layer.findIndex((item) => item.id === node.id);
    const angle = initialAngle(node, index, layer.length, rootId);
    const targetRadius = radiusByDepth.get(depth) ?? depth * MIN_RING_RADIUS;
    const diameter = diameterById.get(node.id) ?? UNKNOWN_YEAR_DIAMETER;
    const isRoot = node.id === rootId;
    return {
      id: node.id,
      depth,
      diameter,
      targetRadius,
      collisionRadius: diameter / 2 + NODE_CLEARANCE,
      x: isRoot ? 0 : Math.cos(angle) * targetRadius,
      y: isRoot ? 0 : Math.sin(angle) * targetRadius,
      ...(isRoot ? { fx: 0, fy: 0 } : {}),
    };
  });
  const validNodeIds = new Set(forceNodes.map((node) => node.id));
  const forceLinks: ForceLink[] = data.edges.flatMap((edge) => {
    if (!validNodeIds.has(edge.sourcePaperId) || !validNodeIds.has(edge.targetPaperId)) return [];
    const sourceDepth = depthById.get(edge.sourcePaperId) ?? 1;
    const targetDepth = depthById.get(edge.targetPaperId) ?? 1;
    const depthDelta = Math.abs(sourceDepth - targetDepth);
    return [{ source: edge.sourcePaperId, target: edge.targetPaperId, targetDistance: depthDelta > 0 ? 180 : 240 }];
  });

  const links = forceLink<ForceNode, ForceLink>(forceLinks)
    .id((node) => node.id)
    .distance((link) => link.targetDistance)
    .strength(0.28);
  const charge = forceManyBody<ForceNode>().strength(-44).distanceMax(1800);
  const radial = forceRadial<ForceNode>((node) => node.targetRadius, 0, 0)
    .strength((node) => node.depth === 0 ? 1 : node.depth === 1 ? 0.36 : 0.08);
  const collision = forceCollide<ForceNode>()
    .radius((node) => node.collisionRadius)
    .strength(1)
    .iterations(4);

  const simulation = forceSimulation(forceNodes)
    .alpha(1)
    .alphaDecay(0.025)
    .velocityDecay(0.38)
    .force("link", links)
    .force("charge", charge)
    .force("radial", radial)
    .force("collision", collision)
    .stop();
  simulation.tick(SIMULATION_TICKS);

  const positions = new Map(forceNodes.map((node) => [node.id, {
    x: Number.isFinite(node.x) ? node.x! : 0,
    y: Number.isFinite(node.y) ? node.y! : 0,
  }]));
  positions.set(rootId, { x: 0, y: 0 });
  return { positions, depthById, diameterById };
}

export function citationEdgeId(edge: CitationEdgeDto, index: number): string {
  return `citation-${encodeURIComponent(`${index}:${edge.sourcePaperId}:${edge.targetPaperId}:${edge.relationType ?? "REFERENCE"}`)}`;
}
