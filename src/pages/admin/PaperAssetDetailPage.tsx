import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Background, BaseEdge, Controls, EdgeLabelRenderer, MiniMap, Position, ReactFlow, getSmoothStepPath, useReactFlow, type Edge, type EdgeProps, type Node, type NodeProps, Handle } from "@xyflow/react";
import ELK, { type ElkNode } from "elkjs/lib/elk-api.js";
import elkWorkerUrl from "elkjs/lib/elk-worker.min.js?url";
import { Link, useLocation, useParams } from "react-router-dom";
import { FiArrowLeft, FiBookOpen, FiCheckCircle, FiChevronLeft, FiChevronRight, FiDownload, FiExternalLink, FiFileText, FiGitBranch, FiInfo, FiRefreshCw, FiSearch } from "react-icons/fi";
import { paperService } from "../../services/paperService";
import { paperAiAnalysisService, type AiComponent, type LocatedAiEvidence, type PaperAiAnalysisResult } from "../../services/paperAiAnalysisService";
import { getAdminPaperAssetInventory, getAdminRepositoryPaperAnalysis, getAdminRepositoryPaperDetails, type AdminRepositoryPaperDetails, type AdminRepositoryAnalysis } from "../../services/adminPaperAssetService";
import api from "../../config/axios";
import { toastError, toastSuccess } from "../../utils/toast";
import { getErrorMessage } from "../../utils/errorUtils";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Select from "../../components/ui/Select";
import PdfJsViewer from "../../components/shared/paper/PdfJsViewer/PdfJsViewer";
import UnifiedResearchWorkspace, { type ResearchWorkspaceMode } from "../../components/admin/paper-assets/UnifiedResearchWorkspace";

type AnalysisTab = "aif" | "toulmin" | "craft";
type FlowNodeData = { label: string; role: string; detail: string; evidence?: LocatedAiEvidence[]; nodeType?: string; aifShape?: "I" | "RA" | "CA"; tone?: "primary" | "success" | "warning" | "danger" | "neutral"; isCurrent?: boolean };
type FlowNode = Node<FlowNodeData>;
type FlowEdgeData = { points?: { x: number; y: number }[]; relationship?: string };
type FlowEdge = Edge<FlowEdgeData>;
type CraftArgument = { id?: string; claim_id?: string; claim_proposition_id?: string; relation_id?: string; claim?: string | { text?: string }; reasons?: unknown[]; evidence?: unknown[]; warrant?: unknown; acknowledgment_and_response?: { acknowledgment?: unknown; related_objections?: unknown[]; response?: unknown } };

const elk = new ELK({ workerUrl: elkWorkerUrl });

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const asText = (value: unknown): string => typeof value === "string" ? value : "";
const componentText = (value: unknown): string => typeof value === "string" ? value : isObject(value) ? asText(value.text) : "";
const componentEvidence = (value: unknown): LocatedAiEvidence[] => isObject(value) && Array.isArray(value.evidence) ? value.evidence.filter(isObject) as unknown as LocatedAiEvidence[] : [];
const clip = (value: string, size = 100) => value.length > size ? `${value.slice(0, size - 1).trimEnd()}…` : value;
const toneForRole = (role: string): FlowNodeData["tone"] => role === "Claim" ? "success" : role === "Rebuttal" || role === "Objection" ? "danger" : role === "Qualifier" ? "warning" : role === "Backing" ? "neutral" : "primary";
const toulminRoleBadgeClass: Record<string, string> = {
  claim: "bg-emerald-100 text-emerald-800",
  ground: "bg-sky-100 text-sky-800",
  warrant: "bg-violet-100 text-violet-800",
  backing: "bg-teal-100 text-teal-800",
  qualifier: "bg-amber-100 text-amber-800",
  rebuttal: "bg-rose-100 text-rose-800",
};

function buildSelectedArgumentAif(argument: PaperAiAnalysisResult["toulmin_arguments"][number], argumentId: string) {
  const nodes: Array<Record<string, unknown>> = [];
  const edges: Array<Record<string, unknown>> = [];
  const addInformation = (id: string, role: string, component: AiComponent | null, fallback = ""): string => {
    const content = componentText(component).trim() || fallback;
    nodes.push({
      node_id: id,
      type: "I",
      content,
      content_kind: role.toLowerCase(),
      evidence: componentEvidence(component),
      extensions: { argument_id: argumentId, toulmin_role: role.toLowerCase() },
    });
    return id;
  };
  const claimId = addInformation("selected-claim", "Claim", argument.claim, "This claim has no content");
  const premises = [
    ...argument.grounds.map((component, index) => ({ component, role: "Ground", id: `selected-ground-${index}` })),
    ...(argument.warrant ? [{ component: argument.warrant, role: "Warrant", id: "selected-warrant" }] : []),
    ...(argument.backing ? [{ component: argument.backing, role: "Backing", id: "selected-backing" }] : []),
  ];
  const premiseIds = premises.filter(({ component }) => componentText(component).trim()).map(({ component, role, id }) => addInformation(id, role, component));
  if (premiseIds.length) {
    nodes.push({ node_id: "selected-ra", type: "S", scheme_type: "RA", label: "Toulmin inference", extensions: { argument_id: argumentId } });
    premiseIds.forEach((id) => edges.push({ source: id, target: "selected-ra", role: "premise" }));
    edges.push({ source: "selected-ra", target: claimId, role: "conclusion" });
  }
  if (argument.rebuttal && componentText(argument.rebuttal).trim()) {
    addInformation("selected-rebuttal", "Rebuttal", argument.rebuttal);
    nodes.push({ node_id: "selected-ca", type: "S", scheme_type: "CA", label: "Toulmin rebuttal", extensions: { argument_id: argumentId } });
    edges.push({ source: "selected-rebuttal", target: "selected-ca", role: "attacking_information" });
    edges.push({ source: "selected-ca", target: claimId, role: "attacked_information" });
  }
  return { nodes, edges };
}

function readCraftPayload(result: PaperAiAnalysisResult | null): unknown {
  if (!result) return undefined;
  const raw = result as PaperAiAnalysisResult & Record<string, unknown>;
  return raw.craftOfResearch ?? raw.craft_of_research ?? raw.craft_of_research_analysis;
}

function firstRepositoryValue(source: Record<string, unknown> | undefined, ...keys: string[]): unknown {
  for (const key of keys) if (source?.[key] !== undefined && source[key] !== null) return source[key];
  return undefined;
}

function repositoryText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(repositoryText).filter(Boolean).join("\n");
  if (!isObject(value)) return "";
  const text = firstRepositoryValue(value, "text", "content", "statement", "value", "description", "quote");
  return text === undefined ? displayValue(value) : repositoryText(text);
}

function repositoryStatement(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (Array.isArray(value)) return value.map(repositoryStatement).filter(Boolean).join("\n");
  if (!isObject(value)) return "";
  const text = firstRepositoryValue(value, "text", "content", "statement", "value", "description", "quote");
  return text === undefined ? "" : repositoryStatement(text);
}

function repositoryEvidence(value: unknown): LocatedAiEvidence[] {
  const items = Array.isArray(value) ? value : isObject(value) ? [value] : [];
  return items.map((item) => typeof item === "string" ? { text: item, quote: item } : item).filter(isObject).map((item) => {
    const location = isObject(item.source_location) ? item.source_location : {};
    const section = repositoryText(firstRepositoryValue(item, "section") ?? location.section) || null;
    const paragraphValue = location.paragraph ?? item.paragraph;
    const paragraph = typeof paragraphValue === "number" && Number.isFinite(paragraphValue) ? paragraphValue : null;
    const pageValue = location.page ?? location.page_number ?? item.page ?? item.page_number;
    const parsedPage = typeof pageValue === "number" ? pageValue : typeof pageValue === "string" ? Number(pageValue) : NaN;
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : undefined;
    const charStartValue = location.char_start ?? location.start_offset ?? item.char_start ?? item.start_offset;
    const charEndValue = location.char_end ?? location.end_offset ?? item.char_end ?? item.end_offset;
    const char_start = typeof charStartValue === "number" && Number.isFinite(charStartValue) ? charStartValue : undefined;
    const char_end = typeof charEndValue === "number" && Number.isFinite(charEndValue) ? charEndValue : undefined;
    const quote = repositoryText(firstRepositoryValue(item, "quote", "text", "snippet"));
    return {
      text: repositoryText(firstRepositoryValue(item, "text", "quote", "snippet")) || quote,
      quote,
      section,
      quote_is_exact: Boolean(firstRepositoryValue(item, "quote_is_exact", "is_exact")),
      source_location: { section, paragraph, ...(page === undefined ? {} : { page }), ...(char_start === undefined ? {} : { char_start }), ...(char_end === undefined ? {} : { char_end }) },
    };
  });
}

function craftPartEvidence(value: unknown, includeText = false): LocatedAiEvidence[] {
  if (Array.isArray(value)) return value.flatMap((item) => craftPartEvidence(item, includeText));
  if (!isObject(value)) return typeof value === "string" ? repositoryEvidence(value) : [];
  if (Array.isArray(value.evidence) || Array.isArray(value.evidence_ledger) || Array.isArray(value.evidence_spans)) {
    return repositoryEvidence(firstRepositoryValue(value, "evidence", "evidence_ledger", "evidence_spans"));
  }
  return value.source_location || value.quote || value.snippet || (includeText && (value.text || value.content)) ? repositoryEvidence(value) : [];
}

function findCraftArgument(args: CraftArgument[], argumentId: string, claimText: string): CraftArgument | undefined {
  const relationId = argumentId.startsWith("ta:") ? argumentId.slice(3) : "";
  return args.find((argument) => argument.id === argumentId
    || argument.claim_id === argumentId
    || argument.claim_proposition_id === argumentId
    || Boolean(relationId && (argument.relation_id === relationId || argument.id === `cr:${relationId}`))
    || Boolean(claimText && (typeof argument.claim === "string" ? argument.claim : argument.claim?.text || "").trim().toLocaleLowerCase() === claimText.trim().toLocaleLowerCase()))
    ?? (args.length === 1 ? args[0] : undefined);
}

type RoleEvidence = { evidence?: LocatedAiEvidence; role: string; text: string; page?: number };

function roleEvidenceForComponent(component: unknown, role: string): RoleEvidence[] {
  const evidence = componentEvidence(component);
  if (evidence.length) {
    return evidence.map((item) => ({ evidence: item, role, text: item.quote || item.text, page: item.source_location?.page }));
  }
  const text = componentText(component).trim();
  return text ? [{ role, text }] : [];
}

function argumentEvidenceByRole(argument: PaperAiAnalysisResult["toulmin_arguments"][number] | undefined): RoleEvidence[] {
  if (!argument) return [];
  return [
    { role: "Claim", component: argument.claim },
    ...argument.grounds.map((component) => ({ role: "Ground", component })),
    ...(argument.warrant ? [{ role: "Warrant", component: argument.warrant }] : []),
    ...(argument.backing ? [{ role: "Backing", component: argument.backing }] : []),
    ...(argument.qualifier ? [{ role: "Qualifier", component: argument.qualifier }] : []),
    ...(argument.rebuttal ? [{ role: "Rebuttal", component: argument.rebuttal }] : []),
  ].flatMap(({ role, component }) => roleEvidenceForComponent(component, role));
}

function craftArgumentEvidenceByRole(argument: CraftArgument | undefined): RoleEvidence[] {
  if (!argument) return [];
  const response = argument.acknowledgment_and_response;
  const components = [
    { role: "Claim", value: argument.claim },
    ...(argument.reasons ?? []).map((value) => ({ role: "Reason", value })),
    { role: "Warrant", value: argument.warrant },
    { role: "Qualifier", value: response?.acknowledgment },
    ...(response?.related_objections ?? []).map((value) => ({ role: "Rebuttal", value })),
    { role: "Response", value: response?.response },
    ...(argument.evidence ?? []).map((value) => ({ role: "Evidence", value })),
  ];
  return components.flatMap(({ role, value }) => {
    const evidence = craftPartEvidence(value, role === "Evidence");
    if (evidence.length) return evidence.map((item) => ({ evidence: item, role, text: item.quote || item.text, page: item.source_location?.page }));
    const text = repositoryStatement(value).trim();
    return text ? [{ role, text }] : [];
  });
}

function uniqueRoleEvidence(items: RoleEvidence[]): RoleEvidence[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const text = item.text.trim();
    if (!text) return false;
    const key = `${item.role}:${item.page ?? ""}:${text.toLocaleLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function repositoryComponent(value: unknown): AiComponent | null {
  if (value === undefined || value === null) return null;
  const source = isObject(value) ? value : undefined;
  const text = repositoryStatement(value)
    || (source && Array.isArray(source.items) ? source.items.map(repositoryStatement).filter(Boolean).join("\n") : "");
  if (!text) return null;
  return {
    text,
    evidence: repositoryEvidence(firstRepositoryValue(source, "evidence", "evidence_ledger", "evidence_spans")),
  };
}

function repositoryList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isObject(value) && Array.isArray(value.items)) return value.items;
  return value === undefined || value === null ? [] : [value];
}

function repositoryCraftPayload(payload: Record<string, unknown>, argumentation: Record<string, unknown>, analysis: Record<string, unknown>, envelope: Record<string, unknown>): unknown {
  const craftKeys = ["craft_of_research", "craftOfResearch", "craft_arguments", "craftArguments", "craft_of_research_arguments"];
  const candidates: unknown[] = [];
  const visited = new Set<Record<string, unknown>>();
  const queue = [payload, argumentation, analysis, envelope].map((value) => ({ value, depth: 0 }));
  while (queue.length) {
    const { value, depth } = queue.shift()!;
    if (depth > 5 || visited.has(value)) continue;
    visited.add(value);
    for (const key of craftKeys) {
      if (value[key] !== undefined && value[key] !== null) candidates.push(value[key]);
    }
    const sections = isObject(value.sections) ? value.sections : undefined;
    const craftSection = sections ? firstRepositoryValue(sections, "craftOfResearch", "craft_of_research") : undefined;
    if (craftSection !== undefined) candidates.push(craftSection);
    for (const key of ["analysis", "argumentation", "analysis_payload", "analysisPayload", "result", "sections", "craftOfResearch", "craft_of_research"]) {
      if (isObject(value[key]) && !visited.has(value[key] as Record<string, unknown>)) {
        queue.push({ value: value[key] as Record<string, unknown>, depth: depth + 1 });
      }
    }
  }
  const getArguments = (value: unknown, depth = 0): unknown[] => {
    if (Array.isArray(value)) return value;
    if (!isObject(value) || depth > 3) return [];
    const nested = firstRepositoryValue(value, "arguments", "craft_arguments", "craftArguments", "argument_cards", "items");
    return nested === undefined ? [] : getArguments(nested, depth + 1);
  };
  const rawArguments = candidates.map(getArguments).find((items) => items.some(isObject)) ?? [];
  const componentText = (value: unknown) => {
    if (isObject(value) && Array.isArray(value.items)) return value.items.map(repositoryText).map((text) => text.trim()).filter(Boolean).join("\n");
    return repositoryText(value);
  };
  const argumentsList = rawArguments.filter(isObject).map((item, index) => {
    const context = isObject(firstRepositoryValue(item, "acknowledgment_and_response", "acknowledgmentAndResponse"))
      ? firstRepositoryValue(item, "acknowledgment_and_response", "acknowledgmentAndResponse") as Record<string, unknown>
      : {};
    return {
      id: repositoryText(firstRepositoryValue(item, "id", "argument_id")) || String(index),
      claim_id: repositoryText(firstRepositoryValue(item, "claim_id")) || undefined,
      claim_proposition_id: repositoryText(firstRepositoryValue(item, "claim_proposition_id")) || undefined,
      relation_id: repositoryText(firstRepositoryValue(item, "relation_id")) || undefined,
      claim: componentText(firstRepositoryValue(item, "claim", "claim_text")),
      reasons: repositoryList(firstRepositoryValue(item, "reasons", "reason")).map(componentText).filter(Boolean),
      evidence: repositoryList(firstRepositoryValue(item, "evidence", "grounds")).map(componentText).filter(Boolean),
      warrant: componentText(firstRepositoryValue(item, "warrant")),
      acknowledgment_and_response: {
        acknowledgment: componentText(firstRepositoryValue(context, "acknowledgment")),
        related_objections: repositoryList(firstRepositoryValue(context, "related_objections", "objections")).map(componentText).filter(Boolean),
        response: componentText(firstRepositoryValue(context, "response")),
      },
    };
  });
  return { available: argumentsList.length > 0, arguments: argumentsList };
}

function normalizeRepositoryAnalysis(
  repositoryAnalysis: Awaited<ReturnType<typeof getAdminRepositoryPaperAnalysis>>,
  workId: string,
  title: string,
): { paper_id: string; title: string; status: "COMPLETED" | "NOT_STARTED"; source_revision: string | null; updated_at: string | null; pdf_url?: string | null; error: null; result: PaperAiAnalysisResult | null } {
  if (!repositoryAnalysis) return { paper_id: workId, title, status: "NOT_STARTED", source_revision: null, updated_at: null, error: null, result: null };

  const root = isObject(repositoryAnalysis.analysis) ? repositoryAnalysis.analysis : {};
  const analysis = isObject(root.analysis) ? root.analysis : root;
  const argumentation = isObject(analysis.argumentation) ? analysis.argumentation : {};
  const payload = isObject(argumentation.analysis_payload) ? argumentation.analysis_payload : {};
  const graphSource = firstRepositoryValue(argumentation, "graph", "aif") ?? firstRepositoryValue(payload, "graph", "aif");
  const rawGraph = isObject(graphSource) ? graphSource : {};
  const nodes = (Array.isArray(rawGraph.nodes) ? rawGraph.nodes : []).filter(isObject).map((node, index) => {
    const extensions = isObject(node.extensions) ? { ...node.extensions } : {};
    const argumentId = firstRepositoryValue(node, "argument_id") ?? firstRepositoryValue(extensions, "argument_id");
    if (argumentId !== undefined) extensions.argument_id = repositoryText(argumentId);
    const role = repositoryText(firstRepositoryValue(node, "toulmin_role", "role"));
    if (role && extensions.toulmin_role === undefined) extensions.toulmin_role = role;
    const nodeType = repositoryText(firstRepositoryValue(node, "type", "node_type", "scheme_type"));
    const schemeType = repositoryText(firstRepositoryValue(node, "scheme_type")) || (["RA", "CA"].includes(nodeType.toUpperCase()) ? nodeType : "");
    return {
      ...node,
      node_id: repositoryText(firstRepositoryValue(node, "node_id", "id")) || `repository-node-${index}`,
      type: nodeType,
      scheme_type: schemeType,
      content: repositoryText(firstRepositoryValue(node, "content", "text", "proposition", "statement", "label")),
      label: repositoryText(firstRepositoryValue(node, "label", "name")),
      content_kind: repositoryText(firstRepositoryValue(node, "content_kind", "role")),
      argument_id: argumentId === undefined ? undefined : repositoryText(argumentId),
      extensions,
      evidence: repositoryEvidence(firstRepositoryValue(node, "evidence", "evidence_spans")),
    };
  });
  const edges = (Array.isArray(rawGraph.edges) ? rawGraph.edges : []).filter(isObject).map((edge, index) => ({
    ...edge,
    edge_id: repositoryText(firstRepositoryValue(edge, "edge_id", "id")) || `repository-edge-${index}`,
    source: repositoryText(firstRepositoryValue(edge, "source", "source_node_id", "from")),
    target: repositoryText(firstRepositoryValue(edge, "target", "target_node_id", "to")),
    role: repositoryText(firstRepositoryValue(edge, "role", "edge_type", "relationship", "relation", "type")),
  }));

  const toulminContainerValue = firstRepositoryValue(payload, "toulmin", "toulmin_model", "toulminModel");
  const toulminContainer = isObject(toulminContainerValue) ? toulminContainerValue : {};
  const rawArguments = repositoryList(firstRepositoryValue(toulminContainer, "arguments", "argument_cards")
    ?? firstRepositoryValue(payload, "arguments", "argument_cards")
    ?? firstRepositoryValue(argumentation, "toulmin_arguments", "toulminArguments"));
  const toulminArguments = rawArguments.filter(isObject).map((item, index) => {
    const claim = repositoryComponent(firstRepositoryValue(item, "claim", "claim_text", "conclusion")) || { text: "", evidence: [] };
    const grounds = repositoryList(firstRepositoryValue(item, "grounds", "ground", "data", "premises"))
      .map(repositoryComponent).filter((component): component is AiComponent => component !== null);
    const qualifier = repositoryComponent(firstRepositoryValue(item, "qualifier"))?.text || "";
    return {
      argument_id: repositoryText(firstRepositoryValue(item, "argument_id", "id", "claim_id")) || String(index),
      claim,
      grounds,
      warrant: repositoryComponent(firstRepositoryValue(item, "warrant")),
      backing: repositoryComponent(firstRepositoryValue(item, "backing")),
      qualifier: qualifier || null,
      rebuttal: repositoryComponent(firstRepositoryValue(item, "rebuttal", "exception")),
    };
  });

  const draft = isObject(analysis.draft) ? analysis.draft : {};
  const imrad = {
    introduction: { summary: repositoryText(firstRepositoryValue(draft, "objective", "summary")), evidence: [] },
    methods: { summary: repositoryText(firstRepositoryValue(draft, "methodology")), evidence: [] },
    results: { summary: repositoryText(firstRepositoryValue(draft, "key_findings", "outcomes")), evidence: [] },
    discussion: { summary: repositoryText(firstRepositoryValue(draft, "conclusion", "limitations")), evidence: [] },
  };
  const rawValidation = isObject(argumentation.validation) ? argumentation.validation : {};
  const rawIssues = Array.isArray(rawValidation.issues) ? rawValidation.issues : [];
  const limitations = Array.isArray(payload.limitations) ? payload.limitations.filter((item): item is string => typeof item === "string") : [];
  const analyzedAt = repositoryAnalysis.run.completedAt || repositoryAnalysis.run.createdAt;
  const provider = repositoryText(firstRepositoryValue(analysis, "provider")) || repositoryAnalysis.run.provenance?.provider || "Repository analysis";
  const model = repositoryText(firstRepositoryValue(analysis, "model")) || repositoryAnalysis.run.provenance?.model || null;
  const result: PaperAiAnalysisResult = {
    schema_version: repositoryAnalysis.run.schemaVersion,
    project_id: "",
    paper_id: workId,
    paper_title: title,
    source: { level: "FULL_TEXT", source_asset_id: null, source_revision: repositoryAnalysis.run.runId, source_hash: "", analyzed_at: analyzedAt, provider, model, coverage: "COMPLETE" },
    imrad,
    toulmin_arguments: toulminArguments,
    craftOfResearch: repositoryCraftPayload(payload, argumentation, analysis, root),
    aif_graph: { artifact_id: repositoryAnalysis.run.runId, artifact_type: "A3", schema_version: repositoryAnalysis.run.schemaVersion, title: `${title} AIF`, nodes, edges, extensions: isObject(rawGraph.extensions) ? rawGraph.extensions : {} },
    limitations,
    validation: {
      status: rawValidation.human_review_required === true ? "NEEDS_REVIEW" : "VALID",
      issues: rawIssues.filter(isObject).map((issue) => ({ code: repositoryText(issue.code) || "ANALYSIS_ISSUE", message: repositoryText(issue.message), ...(repositoryText(issue.path) ? { path: repositoryText(issue.path) } : {}) })),
    },
  };

  return { paper_id: workId, title, status: "COMPLETED", source_revision: repositoryAnalysis.run.runId, updated_at: analyzedAt, error: null, result };
}

function edgeLabelPoint(points: { x: number; y: number }[]): { x: number; y: number } {
  const segments = points.slice(1).map((point, index) => ({ from: points[index], to: point, length: Math.hypot(point.x - points[index].x, point.y - points[index].y) }));
  const halfway = segments.reduce((total, segment) => total + segment.length, 0) / 2;
  let traversed = 0;
  for (const segment of segments) {
    if (traversed + segment.length >= halfway) {
      const ratio = segment.length ? (halfway - traversed) / segment.length : 0;
      return { x: segment.from.x + (segment.to.x - segment.from.x) * ratio, y: segment.from.y + (segment.to.y - segment.from.y) * ratio };
    }
    traversed += segment.length;
  }
  return points[0] ?? { x: 0, y: 0 };
}

async function layoutWithElk(nodes: FlowNode[], edges: FlowEdge[]) {
  const graph: ElkNode = {
    id: "paper-argument-graph",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.layered.mergeEdges": "false",
      "elk.spacing.nodeNode": "54",
      "elk.layered.spacing.nodeNodeBetweenLayers": "132",
      "elk.layered.spacing.edgeNodeBetweenLayers": "34",
      "elk.layered.spacing.edgeEdgeBetweenLayers": "24",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.padding": "[top=30,left=36,bottom=30,right=36]",
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: node.data.aifShape === "RA" ? 136 : node.data.aifShape === "CA" ? 166 : 252,
      height: node.data.aifShape === "RA" ? 136 : node.data.aifShape === "CA" ? 166 : 110,
    })),
    edges: edges.map((edge) => ({ id: edge.id, sources: [String(edge.source)], targets: [String(edge.target)] })),
  };
  const layout = await elk.layout(graph);
  const positions = new Map((layout.children ?? []).map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]));
  const routes = new Map((layout.edges ?? []).map((edge) => {
    const section = edge.sections?.[0];
    const points = section ? [section.startPoint, ...(section.bendPoints ?? []), section.endPoint] : [];
    return [edge.id, points];
  }));
  return {
    nodes: nodes.map((node) => ({ ...node, position: positions.get(node.id) ?? node.position })),
    edges: edges.map((edge) => {
      const points = routes.get(edge.id) ?? [];
      return { ...edge, type: "routed", data: { ...edge.data, points } };
    }),
  };
}

function AifNode({ data, selected }: NodeProps<FlowNode>) {
  const tone = data.tone ?? (data.nodeType === "S" ? "warning" : "primary");
  const styles = {
    primary: { border: "border-primary/40", badge: "bg-primary-light text-primary", handle: "!bg-primary" },
    success: { border: "border-success/40 bg-success/[0.035]", badge: "bg-success/10 text-success", handle: "!bg-success" },
    warning: { border: "border-warning/40 bg-warning/[0.035]", badge: "bg-warning/10 text-warning", handle: "!bg-warning" },
    danger: { border: "border-error/40 bg-error/[0.025]", badge: "bg-error/10 text-error", handle: "!bg-error" },
    neutral: { border: "border-border bg-bg-secondary/60", badge: "bg-bg-secondary text-text-secondary", handle: "!bg-text-secondary" },
  }[tone];
  if (data.aifShape === "RA") return <div className={`relative flex h-[136px] w-[136px] flex-col items-center justify-center rounded-full border-2 px-4 text-center shadow-sm transition-colors ${styles.border} ${selected ? "!border-primary ring-2 ring-primary/20" : ""} ${data.isCurrent ? "paper-node-current" : ""}`}>
    <Handle type="target" position={Position.Left} className={`!h-2.5 !w-2.5 !border-2 !border-white ${styles.handle}`} />
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${styles.badge}`}>RA</span><p className="mt-1 line-clamp-3 text-[11px] leading-4 text-text-primary">{data.label}</p>
    <Handle type="source" position={Position.Right} className={`!h-2.5 !w-2.5 !border-2 !border-white ${styles.handle}`} />
  </div>;
  if (data.aifShape === "CA") return <div className={`relative flex h-[166px] w-[166px] items-center justify-center ${data.isCurrent ? "paper-node-current" : ""}`}>
    <div className={`absolute h-[116px] w-[116px] rotate-45 rounded-xl border-2 shadow-sm transition-colors ${styles.border} ${selected ? "!border-primary ring-2 ring-primary/20" : ""}`} />
    <Handle type="target" position={Position.Left} className={`!h-2.5 !w-2.5 !border-2 !border-white ${styles.handle}`} />
    <div className="relative z-10 max-w-[116px] px-2 text-center"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${styles.badge}`}>CA</span><p className="mt-1 line-clamp-3 text-[10px] leading-4 text-text-primary">{data.label}</p></div>
    <Handle type="source" position={Position.Right} className={`!h-2.5 !w-2.5 !border-2 !border-white ${styles.handle}`} />
  </div>;
  const isAifInformation = data.aifShape === "I";
  return <div className={`relative h-[110px] w-[252px] rounded-xl border px-3.5 py-3 shadow-sm transition-colors ${styles.border} ${selected ? "!border-primary ring-2 ring-primary/20" : ""} ${data.isCurrent ? "paper-node-current" : ""}`}>
    <Handle type="target" position={Position.Left} className={`!h-2.5 !w-2.5 !border-2 !border-white ${styles.handle}`} />
    <div className="flex items-center gap-2"><span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles.badge}`}>{isAifInformation ? "Information" : data.role}</span>{isAifInformation && <span className="truncate text-[10px] text-text-muted">{data.role}</span>}</div>
    <p className="mt-2 line-clamp-3 text-xs leading-5 text-text-primary">{data.label}</p>
    <Handle type="source" position={Position.Right} className={`!h-2.5 !w-2.5 !border-2 !border-white ${styles.handle}`} />
  </div>;
}

const nodeTypes = { argument: AifNode };

function normalizeEvidenceText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function findNodeForEvidence(nodes: FlowNode[], evidence?: LocatedAiEvidence | null): string | undefined {
  if (!evidence) return undefined;
  const target = normalizeEvidenceText(evidence.quote || evidence.text);
  if (target.length < 24) return undefined;
  const targetPage = evidence.source_location?.page;
  return nodes.map((node) => {
    const score = (node.data.evidence ?? []).reduce((best, item) => {
      const candidate = normalizeEvidenceText(item.quote || item.text);
      if (candidate.length < 24) return best;
      const textMatches = candidate === target || candidate.includes(target) || target.includes(candidate);
      const pageMatches = targetPage !== undefined && item.source_location?.page === targetPage;
      return Math.max(best, textMatches ? (pageMatches ? 4 : 3) : 0);
    }, 0);
    return { id: node.id, score };
  }).filter((item) => item.score > 0).sort((left, right) => right.score - left.score)[0]?.id;
}

const AifGraph = memo(function AifGraph({ result, argumentId, focusEvidence, onSelect }: { result: PaperAiAnalysisResult; argumentId?: string; focusEvidence?: LocatedAiEvidence | null; onSelect: (node: FlowNode | null) => void }) {
  const graph = result.aif_graph;
  const allNodes = Array.isArray(graph?.nodes) ? graph.nodes.filter(isObject) : [];
  let rawEdges = Array.isArray(graph?.edges) ? graph.edges.filter(isObject) : [];
  const selectedArgument = argumentId
    ? result.toulmin_arguments.find((argument, index) => (argument.argument_id || String(index)) === argumentId)
    : undefined;
  const matchingArgumentNodes = argumentId ? allNodes.filter((node) => {
    const extensions = isObject(node.extensions) ? node.extensions : {};
    return asText(node.argument_id) === argumentId || asText(extensions.argument_id) === argumentId;
  }) : allNodes;
  const matchingNodeIds = new Set(matchingArgumentNodes.map((node) => asText(node.node_id)).filter(Boolean));
  const isSchemeNode = (node: Record<string, unknown> | undefined) => {
    if (!node) return false;
    const type = asText(node.type).toUpperCase();
    const schemeType = asText(node.scheme_type).toUpperCase();
    return type === "S" || type === "RA" || type === "CA" || schemeType === "RA" || schemeType === "CA";
  };
  let rawNodes = allNodes;
  if (argumentId) {
    const keptNodeIds = new Set(matchingNodeIds);
    let hasArgumentEdges = false;
    if (matchingArgumentNodes.length) {
      for (const edge of rawEdges) {
        const source = asText(edge.source);
        const target = asText(edge.target);
        if (matchingNodeIds.has(source) && isSchemeNode(allNodes.find((node) => asText(node.node_id) === target))) keptNodeIds.add(target);
        if (matchingNodeIds.has(target) && isSchemeNode(allNodes.find((node) => asText(node.node_id) === source))) keptNodeIds.add(source);
      }
      hasArgumentEdges = rawEdges.some((edge) => keptNodeIds.has(asText(edge.source)) && keptNodeIds.has(asText(edge.target)));
    } else if (selectedArgument) {
      const argumentRecord = selectedArgument as unknown as Record<string, unknown>;
      const claimRecord = isObject(argumentRecord.claim) ? argumentRecord.claim : {};
      const claimNodeReferences = new Set([
        argumentRecord.claim_node_id,
        argumentRecord.claim_proposition_id,
        argumentRecord.claim_id,
        claimRecord.node_id,
        claimRecord.proposition_id,
        claimRecord.id,
      ].map(repositoryText).filter(Boolean));
      const claimText = componentText(selectedArgument.claim).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const candidate = allNodes.map((node) => {
        const nodeId = asText(node.node_id);
        const nodeExtensions = isObject(node.extensions) ? node.extensions : {};
        const referenceMatches = claimNodeReferences.has(nodeId)
          || claimNodeReferences.has(asText(node.proposition_id))
          || claimNodeReferences.has(asText(nodeExtensions.proposition_id));
        const content = (asText(node.content) || asText(node.label)).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        const textMatches = claimText.length >= 16 && content.length >= 16
          && (content === claimText || content.includes(claimText) || claimText.includes(content));
        const score = referenceMatches ? 3 : textMatches && content === claimText ? 2 : textMatches ? 1 : 0;
        return { node, nodeId, score, contentLength: content.length };
      }).filter((item) => item.score > 0).sort((left, right) => right.score - left.score || Math.abs(left.contentLength - claimText.length) - Math.abs(right.contentLength - claimText.length));
      const claimAnchor = candidate[0];
      if (claimAnchor) {
        keptNodeIds.add(claimAnchor.nodeId);
        const claimIncoming = rawEdges.filter((edge) => asText(edge.target) === claimAnchor.nodeId);
        for (const edge of claimIncoming) {
          const sourceId = asText(edge.source);
          const sourceNode = allNodes.find((node) => asText(node.node_id) === sourceId);
          keptNodeIds.add(sourceId);
          if (isSchemeNode(sourceNode)) {
            rawEdges.filter((incoming) => asText(incoming.target) === sourceId).forEach((incoming) => {
              keptNodeIds.add(asText(incoming.source));
            });
          }
        }
      }
      hasArgumentEdges = rawEdges.some((edge) => keptNodeIds.has(asText(edge.source)) && keptNodeIds.has(asText(edge.target)));
    }
    if (selectedArgument && !hasArgumentEdges) {
      const fallback = buildSelectedArgumentAif(selectedArgument, argumentId);
      rawEdges = fallback.edges;
      rawNodes = fallback.nodes;
    }
    if (rawNodes === allNodes) rawNodes = allNodes.filter((node) => keptNodeIds.has(asText(node.node_id)));
  }
  const conclusions = new Set(rawEdges.filter((edge) => asText(edge.role).toLowerCase().includes("conclusion")).map((edge) => asText(edge.target)));
  const attacked = new Set(rawEdges.filter((edge) => asText(edge.role).toLowerCase().includes("attacked")).map((edge) => asText(edge.target)));
  const premises = new Set(rawEdges.filter((edge) => asText(edge.role).toLowerCase().includes("premise")).map((edge) => asText(edge.source)));
  const nodes = rawNodes.map((raw, index): FlowNode => {
    const id = asText(raw.node_id) || `aif-node-${index}`;
    const rawContent = asText(raw.content) || asText(raw.label) || id;
    const nodeType = asText(raw.type);
    const label = asText(raw.label).toLowerCase();
    const schemeType = asText(raw.scheme_type).toUpperCase() || (nodeType === "RA" || nodeType === "CA" ? nodeType : label.includes("rebuttal") || label.includes("conflict") ? "CA" : label.includes("inference") || label.includes("support") ? "RA" : "");
    const aifShape = schemeType === "CA" ? "CA" : schemeType === "RA" || nodeType === "S" ? "RA" : "I";
    const extensions = isObject(raw.extensions) ? raw.extensions : {};
    const contentKind = asText(raw.content_kind);
    const toulminRole = asText(extensions.toulmin_role);
    const tone = aifShape === "CA" ? "danger" : aifShape === "RA" ? "primary" : contentKind === "claim" || toulminRole === "claim" || conclusions.has(id) ? "success" : toulminRole === "rebuttal" || attacked.has(id) ? "warning" : premises.has(id) ? "primary" : "neutral";
    return { id, type: "argument", position: { x: 0, y: 0 }, data: { label: clip(rawContent, 120), detail: rawContent, role: toulminRole || contentKind || schemeType || nodeType || "AIF node", nodeType, aifShape, tone, evidence: componentEvidence(raw) } };
  });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = rawEdges.flatMap((raw, index): FlowEdge[] => {
    const source = asText(raw.source);
    const target = asText(raw.target);
    if (!nodeIds.has(source) || !nodeIds.has(target)) return [];
    const relationship = asText(raw.role).toLowerCase();
    const stroke = relationship.includes("attack") ? "#dc2626" : relationship.includes("conclusion") ? "#117035" : relationship.includes("premise") || relationship.includes("support") ? "#0071bc" : "#647381";
    return [{ id: asText(raw.edge_id) || `aif-edge-${index}`, source, target, label: relationship.replaceAll("_", " "), data: { relationship }, style: { stroke, strokeWidth: 1.35, ...(relationship.includes("attacked") ? { strokeDasharray: "5 4" } : {}) } }];
  });
  if (!nodes.length) return <EmptyGraph message="No AIF nodes were generated for this paper." />;
  return <LayoutFlow nodes={nodes} edges={edges} focusNodeId={findNodeForEvidence(nodes, focusEvidence)} onSelect={onSelect} ariaLabel="AIF graph" />;
});

const ToulminGraph = memo(function ToulminGraph({ result, argumentId, focusEvidence, onSelect }: { result: PaperAiAnalysisResult; argumentId?: string; focusEvidence?: LocatedAiEvidence | null; onSelect: (node: FlowNode | null) => void }) {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const add = (id: string, label: string, role: string, detail: string, evidence: LocatedAiEvidence[], x: number, y: number) => {
    if (!detail.trim()) return;
    nodes.push({ id, type: "argument", position: { x, y }, data: { label: clip(label, 110), detail, role, evidence, nodeType: "I", tone: toneForRole(role) } });
  };
  const selectedArguments = argumentId
    ? result.toulmin_arguments.filter((argument, index) => (argument.argument_id || String(index)) === argumentId)
    : result.toulmin_arguments;
  selectedArguments.forEach((argument, index) => {
    const originalIndex = result.toulmin_arguments.indexOf(argument);
    const base = `toulmin-${argument.argument_id || originalIndex}`;
    const lane = argumentId ? 0 : index * 250;
    const claim = componentText(argument.claim);
    const warrant = componentText(argument.warrant);
    add(`${base}-claim`, claim || "This claim has no content", "Claim", claim, componentEvidence(argument.claim), 940, lane);
    argument.grounds.forEach((ground, groundIndex) => {
      const id = `${base}-ground-${groundIndex}`;
      const text = componentText(ground);
      add(id, text || "Ground", "Ground", text, componentEvidence(ground), 0, lane + groundIndex * 118);
      if (warrant) edges.push({ id: `${id}-to-warrant`, source: id, target: `${base}-warrant`, label: "supports", type: "smoothstep" });
      else edges.push({ id: `${id}-to-claim`, source: id, target: `${base}-claim`, label: "supports", type: "smoothstep" });
    });
    if (warrant) {
      add(`${base}-warrant`, warrant, "Warrant", warrant, componentEvidence(argument.warrant), 630, lane);
      edges.push({ id: `${base}-warrant-to-claim`, source: `${base}-warrant`, target: `${base}-claim`, label: "warrants", type: "smoothstep" });
    }
    const backing = componentText(argument.backing);
    if (backing) {
      add(`${base}-backing`, backing, "Backing", backing, componentEvidence(argument.backing), 310, lane + 118);
      edges.push({ id: `${base}-backing-to-warrant`, source: `${base}-backing`, target: warrant ? `${base}-warrant` : `${base}-claim`, label: "backs", type: "smoothstep" });
    }
    const rebuttal = componentText(argument.rebuttal);
    if (rebuttal) {
      add(`${base}-rebuttal`, rebuttal, "Rebuttal", rebuttal, componentEvidence(argument.rebuttal), 940, lane + 126);
      edges.push({ id: `${base}-rebuttal-to-claim`, source: `${base}-rebuttal`, target: `${base}-claim`, label: "challenges", type: "smoothstep", style: { stroke: "#92400e", strokeDasharray: "5 4" } });
    }
    if (argument.qualifier) {
      add(`${base}-qualifier`, argument.qualifier, "Qualifier", argument.qualifier, [], 630, lane + 126);
      edges.push({ id: `${base}-qualifier-to-claim`, source: `${base}-qualifier`, target: `${base}-claim`, label: "qualifies", type: "smoothstep" });
    }
  });
  if (!nodes.length) return <EmptyGraph message="No Toulmin analysis is available for this paper." />;
  return <LayoutFlow nodes={nodes} edges={edges} focusNodeId={findNodeForEvidence(nodes, focusEvidence)} onSelect={onSelect} ariaLabel="Toulmin graph" />;
});

function LayoutFlow({ nodes, edges, focusNodeId, onSelect, ariaLabel }: { nodes: FlowNode[]; edges: FlowEdge[]; focusNodeId?: string; onSelect: (node: FlowNode | null) => void; ariaLabel: string }) {
  const [layout, setLayout] = useState<{ nodes: FlowNode[]; edges: FlowEdge[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLayout(null);
    void layoutWithElk(nodes, edges).then((nextLayout) => {
      if (!cancelled) setLayout(nextLayout);
    }).catch(() => {
      if (!cancelled) setLayout({ nodes, edges: edges.map((edge) => ({ ...edge, type: "smoothstep" })) });
    });
    return () => { cancelled = true; };
  }, [nodes, edges]);
  if (!layout) return <div className="flex h-full min-h-0 items-center justify-center bg-[#f8fafb]"><LoadingSpinner size="md" /><span className="ml-3 text-xs text-text-secondary">Arranging graph…</span></div>;
  return <FlowCanvas nodes={layout.nodes} edges={layout.edges} focusNodeId={focusNodeId} onSelect={onSelect} ariaLabel={ariaLabel} />;
}

function RoutedRelationshipEdge({ id, sourceX, sourceY, targetX, targetY, data, markerEnd, style, label }: EdgeProps<FlowEdge>) {
  const fallback = getSmoothStepPath({ sourceX, sourceY, targetX, targetY });
  const route = data?.points ?? [];
  const points = [{ x: sourceX, y: sourceY }];
  route.slice(1, -1).forEach((waypoint) => {
    const previous = points[points.length - 1];
    if (previous.x !== waypoint.x && previous.y !== waypoint.y) points.push({ x: waypoint.x, y: previous.y });
    points.push(waypoint);
  });
  const last = points[points.length - 1];
  if (last.x !== targetX && last.y !== targetY) points.push({ x: last.x, y: targetY });
  if (route.length <= 2 && sourceY !== targetY) {
    points.splice(1, points.length - 1, { x: (sourceX + targetX) / 2, y: sourceY }, { x: (sourceX + targetX) / 2, y: targetY });
  }
  points.push({ x: targetX, y: targetY });
  const path = route.length > 1 ? `M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")}` : fallback[0];
  const labelPosition = edgeLabelPoint(points);
  return <>
    <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
    {label && <EdgeLabelRenderer><div className="nodrag nopan pointer-events-none absolute rounded-md border border-border/80 bg-white/95 px-1.5 py-0.5 text-[10px] leading-4 text-text-secondary shadow-sm transition-opacity duration-200" style={{ opacity: typeof style?.opacity === "number" ? style.opacity : 1, transform: `translate(-50%, -50%) translate(${labelPosition.x}px,${labelPosition.y}px)` }}>{label}</div></EdgeLabelRenderer>}
  </>;
}

const edgeTypes = { routed: RoutedRelationshipEdge };

function FocusGraphNode({ nodeId, skipNodeId, onFocus }: { nodeId?: string; skipNodeId: string | null; onFocus: (nodeId: string) => void }) {
  const { fitView } = useReactFlow();
  const onFocusRef = useRef(onFocus);
  const handledNodeIdRef = useRef<string | null>(null);
  useEffect(() => {
    onFocusRef.current = onFocus;
  }, [onFocus]);
  useEffect(() => {
    if (!nodeId) {
      handledNodeIdRef.current = null;
      return;
    }
    if (handledNodeIdRef.current === nodeId) return;
    handledNodeIdRef.current = nodeId;
    if (skipNodeId === nodeId) return;
    onFocusRef.current(nodeId);
    void fitView({ nodes: [{ id: nodeId }], duration: 280, padding: 0.5, maxZoom: 1.2 });
  }, [fitView, nodeId, skipNodeId]);
  return null;
}

function FlowCanvas({ nodes, edges, focusNodeId, onSelect, ariaLabel }: { nodes: FlowNode[]; edges: FlowEdge[]; focusNodeId?: string; onSelect: (node: FlowNode | null) => void; ariaLabel: string }) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [clickedNodeId, setClickedNodeId] = useState<string | null>(null);
  const [traversalStep, setTraversalStep] = useState(0);
  const [lastClickedNodeId, setLastClickedNodeId] = useState<string | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  const connectedEdges = useMemo(() => {
    const nodeIds = new Set(nodes.map((node) => node.id));
    return edges.filter((edge) => nodeIds.has(String(edge.source)) && nodeIds.has(String(edge.target)));
  }, [edges, nodes]);
  const focusedNodeId = hoveredNodeId ?? clickedNodeId;
  const traversal = useMemo(() => {
    if (!focusedNodeId) return null;
    const adjacency = new Map(nodes.map((node) => [node.id, [] as { next: string; edgeId: string }[]]));
    connectedEdges.forEach((edge) => {
      const source = String(edge.source);
      const target = String(edge.target);
      adjacency.get(source)?.push({ next: target, edgeId: edge.id });
    });
    const visited = new Set([focusedNodeId]);
    const nodeOrder: string[] = [];
    const edgeOrder: string[] = [];
    const queue = [focusedNodeId];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      for (const link of adjacency.get(current) ?? []) {
        if (visited.has(link.next)) continue;
        visited.add(link.next);
        queue.push(link.next);
        nodeOrder.push(link.next);
        edgeOrder.push(link.edgeId);
      }
    }
    connectedEdges.forEach((edge) => {
      if (edgeOrder.includes(edge.id) || !visited.has(String(edge.source)) || !visited.has(String(edge.target))) return;
      edgeOrder.push(edge.id);
    });
    return { nodeOrder, edgeOrder };
  }, [connectedEdges, focusedNodeId, nodes]);

  useEffect(() => {
    if (!traversal?.edgeOrder.length) {
      setTraversalStep(0);
      return;
    }
    setTraversalStep(0);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTraversalStep(traversal.edgeOrder.length);
      return;
    }
    let timer = 0;
    timer = window.setInterval(() => {
      setTraversalStep((current) => {
        if (current >= traversal.edgeOrder.length) {
          window.clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, 520);
    return () => window.clearInterval(timer);
  }, [traversal]);

  const visibleStep = Math.min(traversalStep, traversal?.edgeOrder.length ?? 0);
  const visitedNodeIds = useMemo(() => new Set([focusedNodeId, ...(traversal?.nodeOrder.slice(0, visibleStep) ?? [])].filter((id): id is string => Boolean(id))), [focusedNodeId, traversal, visibleStep]);
  const visitedEdgeIds = useMemo(() => new Set(traversal?.edgeOrder.slice(0, visibleStep) ?? []), [traversal, visibleStep]);
  const currentNodeId = visibleStep === 0 ? focusedNodeId : traversal?.nodeOrder[visibleStep - 1] ?? focusedNodeId;
  const displayNodes = useMemo(() => nodes.map((node) => {
    if (!focusedNodeId) return node;
    const isVisited = visitedNodeIds.has(node.id);
    const isCurrent = node.id === currentNodeId;
    return {
      ...node,
      className: `${node.className ?? ""} ${isVisited ? "" : "paper-node-dim"}`.trim(),
      style: { ...node.style, opacity: isVisited ? 1 : 0.14 },
      data: { ...node.data, isCurrent },
    };
  }), [currentNodeId, focusedNodeId, nodes, visitedNodeIds]);
  const displayEdges = useMemo(() => connectedEdges.map((edge) => {
    if (!focusedNodeId) return edge;
    const isVisited = visitedEdgeIds.has(edge.id);
    return {
      ...edge,
      className: `${edge.className ?? ""} ${isVisited ? "paper-edge-travel-forward" : "paper-edge-muted"}`.trim(),
      style: { ...edge.style, opacity: isVisited ? 1 : 0.12, ...(isVisited ? { stroke: "#0071bc", strokeWidth: 1.8 } : {}) },
    };
  }), [connectedEdges, focusedNodeId, traversal, visitedEdgeIds]);

  const handleNodeClick = (_event: React.MouseEvent, node: FlowNode) => {
    setLastClickedNodeId(node.id);
    setClickedNodeId((current) => current === node.id ? null : node.id);
    onSelect(node);
  };
  const focusRequestedNode = (nodeId: string) => {
    if (lastClickedNodeId === nodeId) return;
    const matchingNode = nodes.find((node) => node.id === nodeId);
    if (!matchingNode) return;
    setClickedNodeId(nodeId);
    onSelectRef.current(matchingNode);
  };
  const clearFocus = () => {
    setHoveredNodeId(null);
    setClickedNodeId(null);
    setLastClickedNodeId(null);
    onSelect(null);
  };
  const minimapColor = (node: FlowNode) => ({ primary: "#0071bc", success: "#117035", warning: "#92400e", danger: "#dc2626", neutral: "#84919a" }[node.data?.tone ?? "neutral"]);
  return <div className="paper-flow-graph h-full min-h-0 w-full bg-[#f8fafb]" aria-label={ariaLabel} onMouseLeave={() => setHoveredNodeId(null)}>
    <ReactFlow nodes={displayNodes} edges={displayEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodeClick={handleNodeClick} onNodeMouseEnter={(_event, node) => setHoveredNodeId(node.id)} onPaneClick={clearFocus} fitView fitViewOptions={{ padding: 0.22 }} minZoom={0.2} maxZoom={1.8} proOptions={{ hideAttribution: true }}>
      <FocusGraphNode nodeId={focusNodeId} skipNodeId={lastClickedNodeId} onFocus={focusRequestedNode} />
      <Background color="#dce4e9" gap={22} size={1} />
      <MiniMap pannable zoomable nodeColor={minimapColor} className="!bg-white" />
      <Controls position="top-right" showInteractive={false} />
    </ReactFlow>
  </div>;
}

function EmptyGraph({ message }: { message: string }) {
  return <div className="flex h-64 items-center justify-center bg-bg-secondary/40 px-5 text-center text-sm text-text-secondary"><div><FiInfo className="mx-auto mb-2 h-5 w-5 text-text-muted" aria-hidden="true" />{message}</div></div>;
}

type ArgumentOption = { value: string; label: string; description?: string };

function ArgumentSwitcher({ options, value, search, onChange, onSearchChange }: {
  options: ArgumentOption[];
  value: string;
  search: string;
  onChange: (value: string) => void;
  onSearchChange: (value: string) => void;
}) {
  const selectedIndex = options.findIndex((option) => option.value === value);
  const filteredOptions = options.filter((option) => option.label.toLowerCase().includes(search.trim().toLowerCase()));
  const selectValue = filteredOptions.some((option) => option.value === value) ? value : "";
  if (!options.length || selectedIndex < 0) return null;

  return <div className="flex min-w-0 flex-[1_1_450px] flex-nowrap items-center gap-1.5">
    <div className="relative w-[clamp(132px,11vw,170px)] shrink-0">
      <FiSearch aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
      <input type="search" aria-label="Search arguments" title="Search arguments" placeholder="Search arguments..." value={search} onChange={(event) => onSearchChange(event.target.value)} className="h-9 w-full rounded-lg border border-border bg-surface-white pl-8 pr-2.5 text-xs text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15" />
    </div>
    <Select aria-label="Select argument" options={filteredOptions} value={selectValue} onChange={(event) => onChange(event.target.value)} placeholder={filteredOptions.length ? "Select an argument" : "No matches"} disabled={!filteredOptions.length} className="h-9 w-full rounded-lg px-2.5 text-xs" containerClassName="min-w-[180px] w-[clamp(180px,16vw,240px)] max-w-[240px] flex-[0_1_240px]" />
    <span className="min-w-[42px] px-0.5 text-center text-[11px] tabular-nums text-text-secondary" aria-live="polite">{selectedIndex + 1} / {options.length}</span>
    <button type="button" aria-label="Previous argument" title="Previous argument" disabled={selectedIndex === 0} onClick={() => onChange(options[selectedIndex - 1].value)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-white text-text-secondary transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40">
      <FiChevronLeft aria-hidden="true" />
    </button>
    <button type="button" aria-label="Next argument" title="Next argument" disabled={selectedIndex === options.length - 1} onClick={() => onChange(options[selectedIndex + 1].value)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-white text-text-secondary transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40">
      <FiChevronRight aria-hidden="true" />
    </button>
  </div>;
}

function PaperArgumentOutline({
  argumentsList,
  selectedArgumentId,
  search,
  onSearchChange,
  onSelectArgument,
  onHighlightArgument,
  onChooseEvidence,
  onOpenGraph,
}: {
  argumentsList: PaperAiAnalysisResult["toulmin_arguments"];
  selectedArgumentId: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectArgument: (argumentId: string) => void;
  onHighlightArgument: (argumentId: string) => void;
  onChooseEvidence: (argumentId: string, evidence?: LocatedAiEvidence, role?: string, componentText?: string) => void;
  onOpenGraph: (argumentId: string, evidence?: LocatedAiEvidence, role?: string) => void;
}) {
  const normalized = search.trim().toLocaleLowerCase();
  const entries = argumentsList.map((argument, index) => {
    const id = argument.argument_id || String(index);
    const components = [
      { role: "Claim", component: argument.claim },
      ...argument.grounds.map((component) => ({ role: "Ground", component })),
      ...(argument.warrant ? [{ role: "Warrant", component: argument.warrant }] : []),
      ...(argument.backing ? [{ role: "Backing", component: argument.backing }] : []),
      ...(argument.qualifier ? [{ role: "Qualifier", component: argument.qualifier }] : []),
      ...(argument.rebuttal ? [{ role: "Rebuttal", component: argument.rebuttal }] : []),
    ].map((item) => ({ ...item, text: componentText(item.component).trim(), evidence: componentEvidence(item.component) })).filter((item) => item.text);
    return { id, index, argument, components };
  }).filter((entry) => !normalized || entry.components.some((item) => `${item.role} ${item.text}`.toLocaleLowerCase().includes(normalized)));

  return <div className="flex h-full min-h-0 flex-col">
    <div className="sticky top-0 z-10 border-b border-border bg-white p-2.5">
      <div className="relative"><FiSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" aria-hidden="true" /><input type="search" aria-label="Search arguments" placeholder="Search arguments..." value={search} onChange={(event) => onSearchChange(event.target.value)} className="h-9 w-full rounded-md border border-border bg-white pl-8 pr-2 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></div>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto">
      {!entries.length ? <p className="px-3 py-5 text-xs leading-5 text-text-muted">No arguments match your search.</p> : entries.map((entry) => <article key={entry.id} className={`border-b border-border/80 ${entry.id === selectedArgumentId ? "bg-primary/[0.035]" : ""}`}>
        <div className="flex items-start gap-1 px-3 pb-1 pt-2.5">
          <button type="button" onClick={() => onHighlightArgument(entry.id)} title="Highlight all argument components in the PDF" aria-label={`Select argument ${entry.index + 1} and highlight all components in the PDF`} className="min-w-0 flex-1 text-left">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-text-muted">Argument {entry.index + 1}</span>
            <span className="mt-0.5 block line-clamp-2 text-xs font-medium leading-4 text-text-primary">{componentText(entry.argument.claim) || "This claim has no content"}</span>
          </button>
          <button type="button" aria-label={`Highlight all components of argument ${entry.index + 1} in the PDF`} title="Highlight entire argument in the PDF" onClick={() => onHighlightArgument(entry.id)} className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-primary hover:bg-primary-light"><FiBookOpen aria-hidden="true" /></button>
          <button type="button" aria-label={`Open argument ${entry.index + 1} in the graph`} title="Open in graph" onClick={() => { onSelectArgument(entry.id); onOpenGraph(entry.id); }} className="mt-1 inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[10px] font-medium text-primary hover:bg-primary-light"><FiGitBranch /> Graph</button>
        </div>
        <ul className="space-y-0.5 px-3 pb-2 pl-5">
          {entry.components.map((item, index) => <li key={`${entry.id}-${item.role}-${index}`}>
            <div className="flex items-start gap-1">
              <button type="button" title={`${item.role}: ${item.text}`} onClick={() => { onSelectArgument(entry.id); onChooseEvidence(entry.id, item.evidence[0], item.role, item.text); }} className="min-w-0 flex-1 rounded px-1.5 py-1 text-left hover:bg-white">
                <span className={`mr-1.5 inline-block min-w-12 rounded px-1.5 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide ${toulminRoleBadgeClass[item.role.toLowerCase()] ?? "bg-primary/10 text-primary"}`}>{item.role}</span>
                <span className="text-[11px] leading-4 text-text-secondary">{clip(item.text, 84)}</span>
              </button>
              {item.evidence[0] && <>
                <button type="button" aria-label={`Open ${item.role} on page ${item.evidence[0].source_location?.page ?? "source"}`} title={item.evidence[0].source_location?.page ? `Page ${item.evidence[0].source_location.page}` : "View citation"} onClick={() => { onSelectArgument(entry.id); onChooseEvidence(entry.id, item.evidence[0], item.role, item.text); }} className="mt-1 shrink-0 rounded px-1 text-[9px] tabular-nums text-text-muted hover:bg-white hover:text-primary">{item.evidence[0].source_location?.page ? `p.${item.evidence[0].source_location.page}` : "↗"}</button>
                <button type="button" aria-label={`Open ${item.role} in the graph`} title={`Open ${item.role} in the graph`} onClick={() => { onSelectArgument(entry.id); onOpenGraph(entry.id, item.evidence[0], item.role); }} className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-muted hover:bg-white hover:text-primary"><FiGitBranch aria-hidden="true" /></button>
              </>}
            </div>
          </li>)}
        </ul>
      </article>)}
    </div>
  </div>;
}
function PaperAssetDetailPage() {
  const { projectId, paperId = "" } = useParams<{ projectId?: string; paperId: string }>();
  const location = useLocation();
  const isRepositoryRoute = !projectId;
  const isSharedLibraryRoute = location.pathname.startsWith("/shared-repository/");
  const rootRef = useRef<HTMLDivElement>(null);
  const pdfViewerRef = useRef<import("../../components/shared/paper/PdfJsViewer/PdfJsViewer").PdfJsViewerRef>(null);
  const pdfNavigationSequence = useRef(0);
  const [activeTab, setActiveTab] = useState<AnalysisTab>("aif");
  const [workspaceMode, setWorkspaceMode] = useState<ResearchWorkspaceMode>("graph");
  const [hasOpenedPdf, setHasOpenedPdf] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [splitRatio, setSplitRatio] = useState(65);
  const [graphScope, setGraphScope] = useState<"argument" | "all">("argument");
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<LocatedAiEvidence | null>(null);
  const [selectedCitationRole, setSelectedCitationRole] = useState<string | null>(null);
  const [selectedComponentQuery, setSelectedComponentQuery] = useState<{ text: string; role: string } | null>(null);
  const [pendingPdfNavigation, setPendingPdfNavigation] = useState<{ evidence?: LocatedAiEvidence; queryText?: string; sequence: number } | null>(null);
  const [selectedArgumentId, setSelectedArgumentId] = useState("");
  const [argumentSearch, setArgumentSearch] = useState("");
  const [outlineSearch, setOutlineSearch] = useState("");
  const [metadataEnrichmentBusy, setMetadataEnrichmentBusy] = useState(false);
  const deferredArgumentSearch = useDeferredValue(argumentSearch);
  const inventoryQuery = useQuery({ queryKey: ["admin-paper-assets"], queryFn: getAdminPaperAssetInventory, staleTime: 60_000, enabled: !isSharedLibraryRoute });
  const asset = inventoryQuery.data?.find((item) => isRepositoryRoute
    ? item.repositoryOnly && (item.workId === paperId || item.paper.id === paperId)
    : item.projectId === projectId && item.paper.id === paperId);
  const detailsQuery = useQuery({
    queryKey: ["admin-paper-asset-detail", paperId],
    queryFn: async () => {
      const response = await paperService.getPaperDetails(paperId);
      if (!response.isSuccess) throw new Error(response.message || "Unable to load paper details.");
      return response.data;
    },
    enabled: Boolean(projectId && paperId),
    staleTime: 30_000,
  });
  type RepositoryDetails = AdminRepositoryPaperDetails & { assets?: { pdfUrl?: string; pdfFileName?: string; pdfSizeBytes?: number; markdownUrl?: string; markdownFileName?: string; markdownSizeBytes?: number } };
  const repositoryDetailsQuery = useQuery<RepositoryDetails>({
    queryKey: [isSharedLibraryRoute ? "shared-repository-paper-details" : "admin-repository-paper-details", paperId],
    queryFn: async () => {
      if (!isSharedLibraryRoute) return getAdminRepositoryPaperDetails(paperId);
      const response = await api.get<{ isSuccess: boolean; data: RepositoryDetails; message?: string }>(`/repository/works/${encodeURIComponent(paperId)}/details`);
      if (!response.data.isSuccess) throw new Error(response.data.message || "Unable to load paper details.");
      return response.data.data;
    },
    enabled: Boolean(isRepositoryRoute && paperId),
    staleTime: 5 * 60_000,
  });
  const analysisQuery = useQuery({
    queryKey: [isSharedLibraryRoute ? "shared-paper-ai-analysis-detail" : "admin-paper-ai-analysis-detail", projectId, paperId],
    queryFn: async () => {
      if (isRepositoryRoute) {
        const savedAnalysis = isSharedLibraryRoute
          ? (await api.get<{ isSuccess: boolean; data: AdminRepositoryAnalysis | null; message?: string }>(`/repository/works/${encodeURIComponent(paperId)}/analysis`)).data.data
          : await getAdminRepositoryPaperAnalysis(paperId);
        return normalizeRepositoryAnalysis(savedAnalysis, paperId, asset?.paper.title || paperId);
      }
      return paperAiAnalysisService.getPaper(projectId!, paperId);
    },
    enabled: Boolean(paperId),
    staleTime: 30_000,
  });
  useGSAP(() => {
    const media = gsap.matchMedia(rootRef);
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(".research-workspace", { opacity: 0.88 }, { opacity: 1, duration: 0.16, ease: "power1.out" });
    });
    return () => media.revert();
  }, { scope: rootRef, dependencies: [activeTab, workspaceMode], revertOnUpdate: true });

  const paper = isRepositoryRoute ? undefined : detailsQuery.data;
  const ai = analysisQuery.data;
  const result = ai?.result ?? null;
  const argumentOptions = useMemo<ArgumentOption[]>(() => (result?.toulmin_arguments ?? []).map((argument, index) => {
    const claim = componentText(argument.claim).trim();
    const id = argument.argument_id || String(index);
    return { value: id, label: `${index + 1}. ${clip(claim || "No claim", 76)}`, description: id };
  }), [result]);
  const currentArgumentId = argumentOptions.some((option) => option.value === selectedArgumentId)
    ? selectedArgumentId
    : argumentOptions[0]?.value ?? "";
  const currentArgument = result?.toulmin_arguments.find((argument, index) => (argument.argument_id || String(index)) === currentArgumentId);
  const currentClaimText = componentText(currentArgument?.claim).trim();
  const switchArgument = useCallback((argumentId: string) => {
    setSelectedArgumentId(argumentId);
    setArgumentSearch("");
    setSelectedNode(null);
    setSelectedCitation(null);
    setSelectedCitationRole(null);
    setSelectedComponentQuery(null);
    setInspectorOpen(false);
  }, []);
  const handleGraphNodeSelect = useCallback((node: FlowNode | null) => {
    setSelectedNode(node);
    setInspectorOpen(Boolean(node));
    if (!node) {
      setSelectedCitation(null);
      setSelectedCitationRole(null);
      setSelectedComponentQuery(null);
      return;
    }
    if (workspaceMode === "split" && syncEnabled) {
      const evidence = node.data.evidence?.[0];
      if (evidence) {
        setHasOpenedPdf(true);
        setSelectedCitation(evidence);
        setSelectedCitationRole(node.data.role);
        setSelectedComponentQuery(null);
        pdfNavigationSequence.current += 1;
        setPendingPdfNavigation({ evidence, sequence: pdfNavigationSequence.current });
        return;
      }
    }
    setSelectedCitation(null);
    setSelectedCitationRole(null);
    setSelectedComponentQuery(null);
  }, [syncEnabled, workspaceMode]);
  useEffect(() => {
    setSelectedArgumentId("");
    setArgumentSearch("");
    setOutlineSearch("");
    setWorkspaceMode("graph");
    setHasOpenedPdf(false);
    setSplitRatio(65);
    setGraphScope("argument");
    setSelectedNode(null);
    setSelectedCitation(null);
    setSelectedCitationRole(null);
    setSelectedComponentQuery(null);
    setPendingPdfNavigation(null);
    setInspectorOpen(false);
  }, [paperId]);
  const craftPayload = readCraftPayload(result);
  const craftArgumentsValue = isObject(craftPayload) ? craftPayload.arguments : undefined;
  const craftAvailable = isObject(craftPayload) && ((Array.isArray(craftArgumentsValue) && craftArgumentsValue.length > 0) || (isObject(craftArgumentsValue) && Array.isArray(craftArgumentsValue.items) && craftArgumentsValue.items.length > 0));
  const craftArgs = useMemo(() => {
    if (!craftAvailable || !isObject(craftPayload)) return [] as CraftArgument[];
    const args = craftPayload.arguments;
    const items = Array.isArray(args) ? args : isObject(args) && Array.isArray(args.items) ? args.items : [];
    return items.filter(isObject) as CraftArgument[];
  }, [craftAvailable, craftPayload]);
  const currentCraftArgument = findCraftArgument(craftArgs, currentArgumentId, currentClaimText);
  const pdfHighlightEvidence = useMemo((): RoleEvidence[] => {
    if (selectedComponentQuery) return [];
    if (selectedCitation) return [{ evidence: selectedCitation, role: selectedCitationRole || "Evidence", text: selectedCitation.quote || selectedCitation.text, page: selectedCitation.source_location?.page }];
    if (selectedNode?.data.evidence?.length) {
      return selectedNode.data.evidence.map((evidence) => ({ evidence, role: selectedNode.data.role, text: evidence.quote || evidence.text, page: evidence.source_location?.page }));
    }
    return uniqueRoleEvidence(activeTab === "craft"
      ? craftArgumentEvidenceByRole(currentCraftArgument)
      : argumentEvidenceByRole(currentArgument));
  }, [activeTab, currentArgument, currentCraftArgument, selectedCitation, selectedCitationRole, selectedComponentQuery, selectedNode]);
  const pdfHighlightQueries = useMemo(() => (selectedComponentQuery
    ? [selectedComponentQuery]
    : pdfHighlightEvidence.map(({ text, page, role }) => ({ text, page, role }))).filter((item) => item.text.trim()), [pdfHighlightEvidence, selectedComponentQuery]);
  const repositoryMetadata = repositoryDetailsQuery.data?.metadata;
  const missingMetadataCount = countMissingMetadata(repositoryMetadata as (AdminRepositoryPaperDetails["metadata"] & { isOpenAccess?: boolean }) | undefined);
  const title = repositoryMetadata?.title || paper?.title || asset?.paper.title || ai?.title || "Untitled paper";
  const authors = formatAuthors(repositoryMetadata?.authors) || formatAuthors(paper?.authors) || asset?.paper.authors || "Author information unavailable";
  const pdfUrl = repositoryDetailsQuery.data?.assets?.pdfUrl || asset?.paper.pdfUrl || paper?.pdfUrl || ai?.pdf_url;
  const markdownUrl = repositoryDetailsQuery.data?.assets?.markdownUrl || asset?.paper.metadataUrl || asset?.paper.metadataFile?.url;
  const requestPdfNavigation = useCallback((evidence: LocatedAiEvidence, switchToPdf: boolean, role?: string) => {
    setHasOpenedPdf(true);
    setSelectedCitation(evidence);
    setSelectedCitationRole(role ?? null);
    setSelectedComponentQuery(null);
    if (switchToPdf) setWorkspaceMode("pdf");
    pdfNavigationSequence.current += 1;
    setPendingPdfNavigation({ evidence, sequence: pdfNavigationSequence.current });
  }, []);
  const requestPdfComponentHighlight = useCallback((text: string, role: string) => {
    const queryText = text.trim();
    setHasOpenedPdf(true);
    setSelectedCitation(null);
    setSelectedCitationRole(role);
    setSelectedComponentQuery(queryText ? { text: queryText, role } : null);
    if (queryText) {
      pdfNavigationSequence.current += 1;
      setPendingPdfNavigation({ queryText, sequence: pdfNavigationSequence.current });
    }
  }, []);
  useEffect(() => {
    if (!hasOpenedPdf || !pendingPdfNavigation || !pdfViewerRef.current) return;
    const evidence = pendingPdfNavigation.evidence;
    const page = evidence?.source_location?.page;
    if (page) pdfViewerRef.current.scrollToPage(page - 1);
    else if ((evidence?.quote || evidence?.text || pendingPdfNavigation.queryText || "").trim().length >= 18) pdfViewerRef.current.scrollToFirstHighlight();
    setPendingPdfNavigation(null);
  }, [hasOpenedPdf, pendingPdfNavigation, workspaceMode]);
  const isBusy = (!isSharedLibraryRoute && inventoryQuery.isLoading) || (Boolean(projectId) && detailsQuery.isLoading) || (isRepositoryRoute && repositoryDetailsQuery.isLoading) || analysisQuery.isLoading;
  const retryDetails = () => {
    if (isRepositoryRoute) {
      if (!isSharedLibraryRoute) void inventoryQuery.refetch();
      void repositoryDetailsQuery.refetch();
    }
    else void detailsQuery.refetch();
  };
  const enrichMissingMetadata = async () => {
    setMetadataEnrichmentBusy(true);
    try {
      const response = await api.post<{ isSuccess: boolean; data: { updatedFields: string[] }; message?: string }>(
        `/admin/paper-assets/repository/${encodeURIComponent(paperId)}/enrich-metadata`,
      );
      if (!response.data.isSuccess) throw new Error(response.data.message || "Metadata lookup failed.");
      await repositoryDetailsQuery.refetch();
      const updatedFields = response.data.data.updatedFields;
      toastSuccess(
        updatedFields.length ? "Metadata updated" : "Metadata checked",
        updatedFields.length ? `Added: ${updatedFields.join(", ")}.` : "Crossref and OpenAlex did not return any additional metadata.",
      );
    } catch (error) {
      toastError("Could not enrich metadata", getErrorMessage(error, "Please try again."));
    } finally {
      setMetadataEnrichmentBusy(false);
    }
  };

  if (isBusy) return <div className="flex min-h-[45vh] items-center justify-center"><LoadingSpinner size="lg" /><span className="ml-3 text-sm text-text-secondary">Loading paper details…</span></div>;
  const detailError = detailsQuery.isError
    || (isRepositoryRoute && repositoryDetailsQuery.isError)
    || (isRepositoryRoute && !isSharedLibraryRoute && !asset);
  if (detailError) return <div className="rounded-xl border border-error/20 bg-surface-white p-6"><h1 className="text-lg font-semibold text-text-primary">Unable to load paper details</h1><p className="mt-1 text-sm text-text-secondary">{repositoryDetailsQuery.error instanceof Error ? repositoryDetailsQuery.error.message : detailsQuery.error instanceof Error ? detailsQuery.error.message : "Paper not found in the repository."}</p><Button className="mt-4" variant="secondary" onClick={retryDetails}><FiRefreshCw /> Retry</Button></div>;

  const tabOptions: { id: AnalysisTab; label: string; count?: number }[] = [
    { id: "aif", label: "AIF", count: result ? result.toulmin_arguments.length || result.aif_graph.nodes.filter((node) => {
      const aifNode = node as unknown as Record<string, unknown>;
      const schemeType = aifNode.scheme_type ?? aifNode.type;
      return typeof schemeType === "string" && schemeType.toUpperCase() === "RA";
    }).length : undefined },
    { id: "toulmin", label: "Toulmin Model", count: result?.toulmin_arguments.length },
    ...(craftAvailable ? [{ id: "craft" as const, label: "Craft of Research", count: craftArgs.length }] : []),
  ];
  const graphArgumentId = graphScope === "all" ? undefined : currentArgumentId;
  const changeWorkspaceMode = (mode: ResearchWorkspaceMode) => {
    if (mode !== "graph" && pdfUrl) setHasOpenedPdf(true);
    setWorkspaceMode(mode);
  };
  const highlightArgumentInPdf = (argumentId: string) => {
    switchArgument(argumentId);
    const nextArgument = result?.toulmin_arguments.find((argument, index) => (argument.argument_id || String(index)) === argumentId);
    const firstComponent = argumentEvidenceByRole(nextArgument)[0];
    setHasOpenedPdf(true);
    if (firstComponent) {
      pdfNavigationSequence.current += 1;
      setPendingPdfNavigation({
        ...(firstComponent.evidence ? { evidence: firstComponent.evidence } : { queryText: firstComponent.text }),
        sequence: pdfNavigationSequence.current,
      });
    }
  };
  const chooseOutlineEvidence = (argumentId: string, evidence?: LocatedAiEvidence, role = "Evidence", text = "") => {
    switchArgument(argumentId);
    if (evidence) requestPdfNavigation(evidence, false, role);
    else requestPdfComponentHighlight(text, role);
  };
  const openGraphFromOutline = (argumentId: string, evidence?: LocatedAiEvidence, role?: string) => {
    switchArgument(argumentId);
    setActiveTab("toulmin");
    setGraphScope("argument");
    setWorkspaceMode("graph");
    if (evidence) {
      setSelectedCitation(evidence);
      setSelectedCitationRole(role ?? null);
    }
  };
  const changeModel = (tab: AnalysisTab) => {
    setActiveTab(tab);
    setSelectedNode(null);
    setInspectorOpen(false);
  };
  const graphToolbar = <>
    <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-bg-secondary/70 p-1" role="tablist" aria-label="Argumentation model">
      {tabOptions.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => changeModel(tab.id)} className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors ${activeTab === tab.id ? "bg-white text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"}`}>{tab.label}{tab.count !== undefined && <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] tabular-nums text-text-muted">{tab.count}</span>}</button>)}
    </div>
    <ArgumentSwitcher options={argumentOptions} value={currentArgumentId} search={deferredArgumentSearch} onChange={switchArgument} onSearchChange={setArgumentSearch} />
    <button type="button" aria-pressed={graphScope === "all"} title={graphScope === "all" ? "Showing the full graph" : "Focusing on the selected argument"} onClick={() => setGraphScope((scope) => scope === "all" ? "argument" : "all")} className={`ml-1.5 inline-flex h-8 shrink-0 items-center rounded-lg border px-2.5 text-[11px] font-medium transition-colors ${graphScope === "all" ? "border-primary/30 bg-primary-light text-primary" : "border-border bg-white text-text-secondary hover:text-primary"}`}>{graphScope === "all" ? "Full graph" : "One argument"}</button>
    {selectedNode && !inspectorOpen && <button type="button" onClick={() => setInspectorOpen(true)} className="inline-flex h-8 shrink-0 items-center rounded-lg border border-border bg-white px-2.5 text-[11px] font-medium text-text-secondary hover:border-primary/30 hover:text-primary">Node details</button>}
  </>;
  const pdfToolbar = <>
    <button type="button" aria-expanded={outlineOpen} onClick={() => setOutlineOpen((open) => !open)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 text-[11px] font-medium text-text-secondary hover:border-primary/30 hover:text-primary"><FiGitBranch />{outlineOpen ? "Hide outline" : "Argument outline"}</button>
    <ArgumentSwitcher options={argumentOptions} value={currentArgumentId} search={deferredArgumentSearch} onChange={highlightArgumentInPdf} onSearchChange={setArgumentSearch} />
  </>;
  const splitToolbar = <>
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" onClick={() => setSplitRatio(65)} className="inline-flex h-8 items-center rounded-lg border border-border bg-white px-2 text-[10px] font-medium text-text-secondary hover:text-primary">Reset</button>
      <button type="button" aria-pressed={syncEnabled} onClick={() => setSyncEnabled((enabled) => !enabled)} className={`inline-flex h-8 items-center rounded-lg border px-2 text-[10px] font-medium transition-colors ${syncEnabled ? "border-primary/30 bg-primary-light text-primary" : "border-border bg-white text-text-secondary"}`}>Sync {syncEnabled ? "On" : "Off"}</button>
    </div>
    {graphToolbar}
  </>;
  const contextToolbar = workspaceMode === "graph" ? graphToolbar : workspaceMode === "pdf" ? pdfToolbar : splitToolbar;
  const outline = result ? <PaperArgumentOutline argumentsList={result.toulmin_arguments} selectedArgumentId={currentArgumentId} search={outlineSearch} onSearchChange={setOutlineSearch} onSelectArgument={switchArgument} onHighlightArgument={highlightArgumentInPdf} onChooseEvidence={chooseOutlineEvidence} onOpenGraph={openGraphFromOutline} /> : <p className="p-4 text-xs text-text-muted">No argument data is available to build the outline.</p>;
  const inspector = selectedNode ? <EvidenceInspector node={selectedNode} onShowEvidence={(evidence) => requestPdfNavigation(evidence, true, selectedNode.data.role)} onOpenGraph={() => { setWorkspaceMode("graph"); setInspectorOpen(false); }} /> : null;

  return <div ref={rootRef} className="mx-auto max-w-[1600px] space-y-5 px-4 pb-6 pt-4 sm:px-6 sm:pt-5 lg:px-8">
    <nav className="flex items-center gap-2 text-sm text-text-secondary"><Link to={isSharedLibraryRoute ? "/shared-repository" : "/admin/paper-files"} className="inline-flex items-center gap-2 hover:text-primary"><FiArrowLeft aria-hidden="true" /> {isSharedLibraryRoute ? "Shared library" : "Paper management"}</Link><span aria-hidden="true">/</span><span className="truncate text-text-primary">Paper details</span></nav>
    <header className="rounded-2xl border border-border bg-surface-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary-light px-2.5 py-1 text-[11px] font-semibold text-primary">{isSharedLibraryRoute || asset?.repositoryOnly ? "Shared repository" : asset?.projectTitle || "Project"}</span><AnalysisStatus status={ai?.status} /></div>
          <h1 className="mt-3 max-w-5xl text-xl font-semibold leading-snug tracking-tight text-text-primary sm:text-2xl">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{authors}</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-muted">{(repositoryMetadata?.doi || paper?.doi || asset?.paper.doi) && <span>DOI: {repositoryMetadata?.doi || paper?.doi || asset?.paper.doi}</span>}{(repositoryMetadata?.publicationYear || paper?.publicationYear || paper?.year || asset?.paper.publicationYear) && <span>Publication year: {repositoryMetadata?.publicationYear || paper?.publicationYear || paper?.year || asset?.paper.publicationYear}</span>}{(repositoryMetadata?.journal || repositoryMetadata?.venue || paper?.journal || paper?.publisher || asset?.paper.journal) && <span>{repositoryMetadata?.journal || repositoryMetadata?.venue || paper?.journal || paper?.publisher || asset?.paper.journal}</span>}</div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {isRepositoryRoute && !isSharedLibraryRoute && missingMetadataCount > 0 && <Button variant="secondary" disabled={metadataEnrichmentBusy} onClick={() => void enrichMissingMetadata()}><FiSearch />{metadataEnrichmentBusy ? "Searching metadata…" : `Find missing metadata (${missingMetadataCount})`}</Button>}
          {pdfUrl && <a href={pdfUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-white px-3.5 text-sm font-semibold text-text-primary hover:bg-bg-secondary"><FiExternalLink /> Open PDF</a>}
          {markdownUrl && <a href={markdownUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-white px-3.5 text-sm font-semibold text-text-primary hover:bg-bg-secondary"><FiDownload /> Markdown full text</a>}
        </div>
      </div>
      <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetadataField label="Journal / venue" value={repositoryMetadata?.journal || repositoryMetadata?.venue || paper?.journal || asset?.paper.journal} /><MetadataField label="Publisher" value={repositoryMetadata?.publisher || paper?.publisher} />
        <MetadataField label="Publication type" value={repositoryMetadata?.publicationType || paper?.publicationType} /><MetadataField label="Language" value={repositoryMetadata?.language || paper?.language} />
        <MetadataField label="Keywords" value={repositoryMetadata?.keywords?.join(", ") || paper?.keywords || asset?.paper.keywords} /><MetadataField label="Publication date" value={repositoryMetadata?.publicationDate || paper?.publicationDate} />
        <MetadataField label="Volume / issue / pages" value={[repositoryMetadata?.volume || paper?.volume, repositoryMetadata?.issue || paper?.issue, repositoryMetadata?.pages || paper?.pages].filter(Boolean).join(" / ")} />
        <MetadataField label="Journal ISSN" value={repositoryMetadata?.journalIssn} />
        <MetadataField label="OpenAlex ID" value={repositoryMetadata?.openAlexId} />
        <MetadataField label="External identifiers" value={Object.entries({ ...(repositoryMetadata?.externalIdentifiers || {}), ...(repositoryDetailsQuery.data?.identifiers.external || {}) }).map(([name, id]) => `${name}: ${id}`).join(" · ")} />
        <MetadataField label="Conference" value={[paper?.conferenceName, paper?.conferenceLocation, paper?.conferenceCountry].filter(Boolean).join(" · ")} />
        <MetadataField label="PDF filename" value={repositoryDetailsQuery.data?.assets?.pdfFileName || paper?.pdfFileName || asset?.paper.pdfFileName} /><MetadataField label="PDF size" value={repositoryDetailsQuery.data?.assets?.pdfSizeBytes ? formatBytes(repositoryDetailsQuery.data.assets.pdfSizeBytes) : paper?.pdf?.sizeBytes ? formatBytes(paper.pdf.sizeBytes) : undefined} />
        <MetadataField label="Full-text extraction" value={paper?.pdf?.fullText?.status || asset?.paper.pdfFullTextStatus} /><MetadataField label="Full-text sections" value={paper?.pdf?.fullText?.sectionCount} />
        <MetadataField label="References" value={paper?.pdf?.fullText?.referenceCount} /><MetadataField label="Import source" value={paper?.source} />
        <MetadataField label="Metadata sources" value={repositoryDetailsQuery.data?.metadataSources.map((source) => source.provider).filter(Boolean).join(", ") || repositoryDetailsQuery.data?.metadataProvenance.source || paper?.source} />
        <MetadataField label="Metadata retrieved" value={repositoryDetailsQuery.data?.metadataProvenance.retrievedAt ? formatDate(repositoryDetailsQuery.data.metadataProvenance.retrievedAt) : undefined} />
        <MetadataField label="Imported on" value={paper?.importedAt ? formatDate(paper.importedAt) : repositoryDetailsQuery.data?.createdAt ? formatDate(repositoryDetailsQuery.data.createdAt) : undefined} /><MetadataField label="Paper ID" value={paperId} />
      </div>
    </header>

    {(repositoryMetadata?.abstract || paper?.abstract || asset?.paper.abstract) && <section className="rounded-xl border border-border bg-surface-white p-5"><h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary"><FiBookOpen className="text-primary" /> Abstract</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{repositoryMetadata?.abstract || paper?.abstract || asset?.paper.abstract}</p></section>}

    <UnifiedResearchWorkspace
      mode={workspaceMode}
      onModeChange={changeWorkspaceMode}
      paperTitle={title}
      argumentCount={argumentOptions.length}
      analysisStatus={ai?.status?.replaceAll("_", " ")}
      sourceLabel={result?.source ? `${result.source.level.replaceAll("_", " ")} · ${formatDate(result.source.analyzed_at)}` : undefined}
      hasPdf={Boolean(pdfUrl)}
      toolbar={contextToolbar}
      graph={analysisQuery.isError ? <div className="m-5 rounded-lg border border-error/20 bg-error/5 p-4 text-sm text-error">Unable to load AI analysis. {analysisQuery.error instanceof Error ? analysisQuery.error.message : "Please try again."}<button type="button" onClick={() => void analysisQuery.refetch()} className="ml-2 font-semibold underline">Retry</button></div> : !result ? <AnalysisEmpty status={ai?.status} error={ai?.error?.message || (isRepositoryRoute ? "The shared repository has no completed analysis to display." : undefined)} /> : <div className="flex h-full min-h-0 flex-col"><p className="flex min-h-9 shrink-0 items-center border-b border-border bg-white px-3 text-[11px] text-text-secondary">Drag nodes to rearrange · scroll to zoom · select a node to view its content and sources</p><div className="min-h-0 flex-1">{activeTab === "aif" && <AifGraph result={result} argumentId={graphArgumentId} focusEvidence={selectedCitation} onSelect={handleGraphNodeSelect} />}{activeTab === "toulmin" && <ToulminGraph result={result} argumentId={graphArgumentId} focusEvidence={selectedCitation} onSelect={handleGraphNodeSelect} />}{activeTab === "craft" && (craftAvailable ? <CraftGraph args={craftArgs} argumentId={graphArgumentId} claimText={currentClaimText} focusEvidence={selectedCitation} onSelect={handleGraphNodeSelect} /> : <EmptyGraph message="Craft of Research is not available in this paper's analysis data." />)}</div></div>}
      pdf={pdfUrl && hasOpenedPdf ? <div className="h-full min-h-0 bg-bg-secondary/40"><PdfJsViewer ref={pdfViewerRef} fileUrl={pdfUrl} documentTitle={title} highlightQueries={pdfHighlightQueries} scale={1} initialFitMode="width" allowDownload /></div> : <div className="flex h-full min-h-[420px] items-center justify-center bg-bg-secondary/40 px-5 text-center"><div><FiBookOpen className="mx-auto h-6 w-6 text-primary" /><p className="mt-3 text-sm font-medium text-text-primary">Open the PDF</p><p className="mt-1 text-xs text-text-secondary">The reader loads when you switch to PDF mode to keep the graph responsive.</p><button type="button" onClick={() => { setHasOpenedPdf(true); setWorkspaceMode("pdf"); }} className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover"><FiBookOpen /> Read PDF</button></div></div>}
      outline={outline}
      inspector={inspector}
      inspectorOpen={inspectorOpen && Boolean(selectedNode)}
      onInspectorOpenChange={setInspectorOpen}
      outlineOpen={outlineOpen}
      onOutlineOpenChange={setOutlineOpen}
      splitRatio={splitRatio}
      onSplitRatioChange={setSplitRatio}
    />
  </div>;
}

const CraftGraph = memo(function CraftGraph({ args, argumentId, claimText, focusEvidence, onSelect }: { args: CraftArgument[]; argumentId?: string; claimText: string; focusEvidence?: LocatedAiEvidence | null; onSelect: (node: FlowNode | null) => void }) {
  if (!args.length) return <EmptyGraph message="The API marked Craft of Research as available but returned no arguments." />;
  const selectedArgument = argumentId ? findCraftArgument(args, argumentId, claimText) : undefined;
  if (argumentId && !selectedArgument) return <EmptyGraph message="The selected argument has no Craft of Research data." />;
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  (selectedArgument ? [selectedArgument] : args).forEach((argument, index) => {
    const claim = typeof argument.claim === "string" ? argument.claim : argument.claim?.text || "";
    const base = `craft-${argument.id || index}`;
    const claimId = `${base}-claim`;
    const add = (id: string, role: string, raw: unknown, x: number, y: number, isEvidence = false): boolean => {
      const detail = displayValue(raw);
      if (!detail) return false;
      const tone = role === "Warrant" ? "warning" : role === "Evidence" ? "neutral" : toneForRole(role);
      nodes.push({ id, type: "argument", position: { x, y }, data: { label: clip(detail, 110), detail, role, nodeType: "I", tone, evidence: craftPartEvidence(raw, isEvidence) } });
      return true;
    };
    const hasClaim = claim ? add(claimId, "Claim", claim, 930, index * 250) : false;
    const reasons = Array.isArray(argument.reasons) ? argument.reasons : [];
    reasons.forEach((reason, reasonIndex) => {
      const id = `${base}-reason-${reasonIndex}`;
      if (add(id, "Reason", reason, 0, index * 250 + reasonIndex * 120) && hasClaim) edges.push({ id: `${id}-claim`, source: id, target: claimId, label: "supports", type: "smoothstep" });
    });
    if (add(`${base}-warrant`, "Warrant", argument.warrant, 620, index * 250) && hasClaim) edges.push({ id: `${base}-warrant-claim`, source: `${base}-warrant`, target: claimId, label: "warrants", type: "smoothstep" });
    const evidence = Array.isArray(argument.evidence) ? argument.evidence : [];
    evidence.forEach((item, evidenceIndex) => {
      const id = `${base}-evidence-${evidenceIndex}`;
      if (add(id, "Evidence", item, 310, index * 250 + evidenceIndex * 110, true) && hasClaim) edges.push({ id: `${id}-claim`, source: id, target: claimId, label: "grounds", type: "smoothstep" });
    });
    const response = argument.acknowledgment_and_response;
    if (response?.acknowledgment && add(`${base}-acknowledgment`, "Acknowledgment", response.acknowledgment, 310, index * 250 + 170) && hasClaim) edges.push({ id: `${base}-ack-claim`, source: `${base}-acknowledgment`, target: claimId, label: "acknowledges", type: "smoothstep" });
    const objections = Array.isArray(response?.related_objections) ? response.related_objections : [];
    objections.forEach((objection, objectionIndex) => {
      const id = `${base}-objection-${objectionIndex}`;
      if (add(id, "Objection", objection, 620, index * 250 + 130 + objectionIndex * 110) && hasClaim) edges.push({ id: `${id}-claim`, source: id, target: claimId, label: "challenges", type: "smoothstep", style: { stroke: "#92400e", strokeDasharray: "5 4" } });
    });
    if (response?.response && add(`${base}-response`, "Response", response.response, 930, index * 250 + 150) && hasClaim) edges.push({ id: `${base}-response-claim`, source: `${base}-response`, target: claimId, label: "responds", type: "smoothstep" });
  });
  return nodes.length ? <LayoutFlow nodes={nodes} edges={edges} focusNodeId={findNodeForEvidence(nodes, focusEvidence)} onSelect={onSelect} ariaLabel="Craft of Research graph" /> : <EmptyGraph message="Craft of Research has no components to display." />;
});
function EvidenceInspector({ node, onShowEvidence, onOpenGraph }: { node: FlowNode; onShowEvidence: (evidence: LocatedAiEvidence) => void; onOpenGraph: () => void }) {
  const evidence = node.data.evidence ?? [];
  return <div className="min-h-full p-4"><span className="rounded-md bg-primary-light px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">{node.data.role}</span><h3 className="mt-3 text-sm font-semibold text-text-primary">Content</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary">{node.data.detail || node.data.label}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={!evidence.length} onClick={() => evidence[0] && onShowEvidence(evidence[0])} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-bg-secondary disabled:text-text-muted"><FiBookOpen /> View in PDF</button><button type="button" onClick={onOpenGraph} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-[11px] font-medium text-text-secondary hover:border-primary/30 hover:text-primary"><FiGitBranch /> Graph focus</button></div><h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-text-muted">Source evidence ({evidence.length})</h4>{evidence.length ? <div className="mt-2 space-y-2">{evidence.map((item, index) => <blockquote key={`${item.source_location?.section}-${item.source_location?.paragraph}-${index}`} className="rounded-lg bg-bg-secondary/50 p-3 text-xs leading-5 text-text-secondary"><p>“{item.quote || item.text}”</p><p className="mt-2 text-[10px] text-text-muted">{item.section || item.source_location?.section || "Unknown section"}{item.source_location?.page ? ` · Page ${item.source_location.page}` : ""}{item.source_location?.paragraph ? ` · Paragraph ${item.source_location.paragraph}` : ""}{item.human_review?.decision ? ` · ${item.human_review.decision}` : ""}</p>{item.source_location?.page && <button type="button" onClick={() => onShowEvidence(item)} className="mt-2 text-[10px] font-semibold text-primary hover:underline">Open page {item.source_location.page}</button>}</blockquote>)}</div> : <p className="mt-2 text-xs text-text-muted">No source citations are attached to this node.</p>}<p className="mt-5 rounded-md bg-bg-secondary/70 p-3 text-[11px] leading-4 text-text-secondary">AI-generated analysis may require human review.</p></div>;
}

function AnalysisStatus({ status }: { status?: string }) {
  const complete = status === "COMPLETED";
  const tone = complete ? "bg-success/10 text-success" : status === "FAILED" ? "bg-error/10 text-error" : "bg-bg-secondary text-text-secondary";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{complete && <FiCheckCircle aria-hidden="true" />}{status ? status.replaceAll("_", " ") : "Not analyzed"}</span>;
}

function AnalysisEmpty({ status, error }: { status?: string; error?: string }) {
  const queued = status === "QUEUED" || status === "PROCESSING";
  return <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-bg-secondary text-text-secondary">{queued ? <LoadingSpinner size="sm" /> : <FiFileText className="h-5 w-5" />}</span><h3 className="mt-3 text-sm font-semibold text-text-primary">{queued ? "Analysis in progress" : status === "FAILED" ? "Analysis failed" : "No AI analysis available"}</h3><p className="mt-1 max-w-lg text-xs leading-5 text-text-secondary">{error || (status === "WAITING_FOR_SOURCE" ? "A PDF or full-text Markdown file is required to create an analysis." : "AIF and Toulmin graphs will appear here after the paper has been analyzed in the workspace.")}</p></div>;
}

function MetadataField({ label, value }: { label: string; value?: string | number | null }) {
  return <div className="min-w-0"><p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">{label}</p><p className="mt-1 break-words text-xs font-medium text-text-primary">{value ?? "—"}</p></div>;
}

function formatAuthors(value: unknown): string {
  if (typeof value === "string") return value.trim();
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.map((item) => {
    if (typeof item === "string") return item;
    if (!isObject(item)) return "";
    const name = asText(item.name);
    const affiliation = asText(item.affiliation);
    return [name, affiliation].filter(Boolean).join(" · ");
  }).filter(Boolean).join(", ");
}

function countMissingMetadata(metadata?: AdminRepositoryPaperDetails["metadata"] & { isOpenAccess?: boolean }): number {
  if (!metadata) return 0;
  const usableText = (value?: string) => Boolean(value?.trim());
  const venue = metadata.journal?.trim() || metadata.venue?.trim() || "";
  const placeholderVenue = /^(open access(?:\s*\(web\))?|unknown|n\/a|not available|none)$/i.test(venue);
  return [
    !usableText(metadata.abstract),
    !metadata.authors?.length,
    metadata.publicationYear === undefined,
    !usableText(metadata.publicationDate),
    !venue || placeholderVenue,
    !usableText(metadata.journalIssn),
    !usableText(metadata.volume),
    !usableText(metadata.issue),
    !usableText(metadata.pages),
    !usableText(metadata.publisher),
    !usableText(metadata.language),
    !usableText(metadata.publicationType),
    !usableText(metadata.openAlexId),
    !metadata.keywords?.length,
    metadata.isOpenAccess === undefined,
  ].filter(Boolean).length;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
}

function displayValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(displayValue).filter(Boolean).join("\n");
  if (isObject(value)) return Object.entries(value).map(([key, entry]) => `${key.replaceAll("_", " ")}: ${displayValue(entry)}`).join("\n");
  return value === undefined || value === null ? "" : String(value);
}

function formatDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

export default PaperAssetDetailPage;
