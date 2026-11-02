import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape from "cytoscape";
import { GitBranch } from "lucide-react";
import { FiMaximize2, FiMinus, FiPlus, FiRotateCw, FiSearch } from "react-icons/fi";
import type { CitationGraphDto } from "../../../../../../types/studySelection";
import Select from "../../../../../../components/ui/Select";
import Input from "../../../../../../components/ui/Input";
import { citationEdgeId, layoutCitationGraph } from "./citationGraphLayout";

interface CitationGraphCanvasProps {
  data: CitationGraphDto;
  rootPaperId?: string;
  selectedPaperId?: string | null;
  onNodeClick?: (paperId: string | null) => void;
}

type HoverDetails = {
  id: string;
  title: string;
  authors: string;
  year: number | null;
  citationCount: number;
  relations: string;
  x: number;
  y: number;
};
type RelationFilters = { references: boolean; citing: boolean; shared: boolean };

const BUTTON_CLASS = "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-white px-2.5 text-[11px] font-medium text-text-primary transition-colors hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 motion-reduce:transition-none";
const FILTER_CLASS = "inline-flex h-7 items-center gap-1.5 rounded-full border px-2 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 motion-reduce:transition-none";

const stylesheet: NonNullable<React.ComponentProps<typeof CytoscapeComponent>["stylesheet"]> = [
  {
    selector: "node",
    style: {
      "background-color": "mapData(yearProgress, 0, 1, #C3DCE8, #1680BC)",
      "border-color": "#FFFFFF",
      "border-width": 2,
      width: "data(size)",
      height: "data(size)",
      label: "data(label)",
      color: "#4F6574",
      "font-family": "Manrope, sans-serif",
      "font-size": 9,
      "font-weight": 500,
      "text-valign": "bottom",
      "text-halign": "center",
      "text-margin-y": 7,
      "text-wrap": "ellipsis",
      "text-max-width": "120px",
      "text-outline-color": "#F7F9FA",
      "text-outline-width": 2,
      "overlay-opacity": 0,
      "transition-property": "opacity border-color border-width background-color",
      "transition-duration": 160,
    },
  },
  {
    selector: "node.root",
    style: { "background-color": "#0071BC", "border-color": "#FFFFFF", "border-width": 3, "font-weight": 700, color: "#17384F" },
  },
  {
    selector: "node.selected",
    style: { "border-color": "#0071BC", "border-width": 4, "font-weight": 700, "overlay-color": "#0071BC", "overlay-opacity": 0.08, "overlay-padding": 8 },
  },
  {
    selector: "node.label-hidden",
    style: { label: "" },
  },
  {
    selector: "edge",
    style: {
      width: 1.15,
      "line-color": "#8FA4B1",
      opacity: 0.2,
      "curve-style": "bezier",
      "control-point-step-size": 32,
      "target-arrow-shape": "triangle",
      "target-arrow-color": "#8FA4B1",
      "target-arrow-fill": "filled",
      "arrow-scale": 0.62,
      "transition-property": "line-color opacity width target-arrow-color",
      "transition-duration": 160,
    },
  },
  {
    selector: "edge.citing",
    style: { "line-style": "dashed", "line-color": "#7896A8", "target-arrow-color": "#7896A8" },
  },
  {
    selector: "edge.shared",
    style: { "line-style": "dotted", "line-color": "#4D91B8", "target-arrow-color": "#4D91B8" },
  },
  {
    selector: "node.highlight",
    style: { opacity: 1 },
  },
  {
    selector: "node.dimmed",
    style: { opacity: 0.45 },
  },
  {
    selector: "edge.highlight",
    style: { opacity: 0.88, width: 2, "line-color": "#3989B8", "target-arrow-color": "#3989B8", "arrow-scale": 0.78 },
  },
  {
    selector: "edge.dimmed",
    style: { opacity: 0.12, width: 1 },
  },
  {
    selector: ".filter-hidden, .focus-hidden",
    style: { display: "none" },
  },
];

function shortenLabel(paper: CitationGraphDto["nodes"][number]): string {
  const firstAuthor = paper.authors?.split(",")[0]?.trim();
  const nameParts = firstAuthor?.split(/\s+/).filter(Boolean) ?? [];
  const author = nameParts.length > 1 ? nameParts[nameParts.length - 1] : firstAuthor;
  const fallback = paper.title.length > 20 ? `${paper.title.slice(0, 17).trimEnd()}…` : paper.title;
  return `${author || fallback}${paper.year ? `, ${paper.year}` : ""}`;
}

const CitationGraphCanvas: React.FC<CitationGraphCanvasProps> = ({ data, rootPaperId, selectedPaperId, onNodeClick }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const appliedLayoutRevision = useRef(0);
  const dragOrigins = useRef(new Map<string, { x: number; y: number }>());
  const [isCyReady, setIsCyReady] = useState(false);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const [yearFrom, setYearFrom] = useState<number | null>(null);
  const [yearTo, setYearTo] = useState<number | null>(null);
  const [relationFilters, setRelationFilters] = useState<RelationFilters>({ references: true, citing: true, shared: true });
  const [relationView, setRelationView] = useState<"focus" | "all">("focus");
  const [showLabels, setShowLabels] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [hoverDetails, setHoverDetails] = useState<HoverDetails | null>(null);

  const rootId = useMemo(() => rootPaperId ?? data.nodes.find((node) => node.depth === 0)?.id ?? data.nodes[0]?.id ?? "", [data.nodes, rootPaperId]);
  const currentYear = new Date().getFullYear();
  const layout = useMemo(() => layoutCitationGraph(data, rootId, currentYear), [data, rootId, currentYear, layoutRevision]);
  const years = useMemo(() => [...new Set(data.nodes.flatMap((node) => node.year === null ? [] : [node.year]))].sort((a, b) => a - b), [data.nodes]);
  const degreeById = useMemo(() => {
    const degree = new Map(data.nodes.map((node) => [node.id, 0]));
    data.edges.forEach((edge) => {
      degree.set(edge.sourcePaperId, (degree.get(edge.sourcePaperId) ?? 0) + 1);
      degree.set(edge.targetPaperId, (degree.get(edge.targetPaperId) ?? 0) + 1);
    });
    return degree;
  }, [data.edges, data.nodes]);
  const importantIds = useMemo(() => {
    const ranked = data.nodes.slice().sort((a, b) => (degreeById.get(b.id) ?? 0) - (degreeById.get(a.id) ?? 0));
    return new Set([rootId, ...ranked.slice(0, Math.min(8, Math.ceil(ranked.length * 0.08))).map((node) => node.id)]);
  }, [data.nodes, degreeById, rootId]);
  const relationsById = useMemo(() => {
    const result = new Map<string, Set<string>>();
    data.edges.forEach((edge) => {
      const label = edge.relationType === "CITATION" ? "Citing paper" : "Reference";
      [edge.sourcePaperId, edge.targetPaperId].forEach((id) => {
        const entries = result.get(id) ?? new Set<string>();
        entries.add(label);
        result.set(id, entries);
      });
    });
    return result;
  }, [data.edges]);
  const papersRef = useRef(data.nodes);
  const relationsRef = useRef(relationsById);
  const onNodeClickRef = useRef(onNodeClick);
  useEffect(() => {
    papersRef.current = data.nodes;
    relationsRef.current = relationsById;
    onNodeClickRef.current = onNodeClick;
  }, [data.nodes, relationsById, onNodeClick]);

  const elements = useMemo(() => {
    const nodes = data.nodes.map((paper) => {
      const diameter = layout.diameterById.get(paper.id) ?? 28;
      const depth = layout.depthById.get(paper.id) ?? 1;
      const isRoot = paper.id === rootId;
      const isYearFiltered = paper.year !== null && ((yearFrom !== null && paper.year < yearFrom) || (yearTo !== null && paper.year > yearTo));
      return {
        data: {
          id: paper.id,
          label: shortenLabel(paper),
          fullTitle: paper.title,
          authors: paper.authors || "Author details unavailable",
          year: paper.year,
          citationCount: paper.citationCount,
          size: diameter,
          yearProgress: paper.year === null || paper.year > currentYear ? 0 : Math.max(0, Math.min(1, (paper.year - (currentYear - 30)) / 30)),
          depth,
          isRoot,
          important: importantIds.has(paper.id),
          relationSummary: [...(relationsById.get(paper.id) ?? [])].join(" · ") || "Connected paper",
        },
        position: layout.positions.get(paper.id) ?? { x: 0, y: 0 },
        classes: [isRoot ? "root" : "", isYearFiltered ? "filter-hidden" : ""].filter(Boolean).join(" "),
      };
    });
    const nodeDepth = layout.depthById;
    const edges = data.edges.map((edge, index) => {
      const isShared = nodeDepth.get(edge.sourcePaperId) === 1 && nodeDepth.get(edge.targetPaperId) === 1;
      const relationKey = isShared ? "shared" : edge.relationType === "CITATION" ? "citing" : "references";
      return {
        data: { id: citationEdgeId(edge, index), source: edge.sourcePaperId, target: edge.targetPaperId, relationType: edge.relationType ?? "REFERENCE", isShared },
        classes: [edge.relationType === "CITATION" ? "citing" : "", isShared ? "shared" : "", relationFilters[relationKey] ? "" : "filter-hidden"].filter(Boolean).join(" "),
      };
    });
    return [...nodes, ...edges];
  }, [data, layout, rootId, yearFrom, yearTo, importantIds, relationsById, relationFilters]);

  const runFit = useCallback((animate = true) => {
    const cy = cyRef.current;
    if (!cy || cy.elements().empty()) return;
    const visibleNodes = cy.nodes(":visible");
    if (animate) cy.animate({ fit: { eles: visibleNodes, padding: 64 }, duration: 180 });
    else cy.fit(visibleNodes, 64);
  }, []);

  const handleCyReady = useCallback((cy: cytoscape.Core) => {
    if (cyRef.current === cy) return;
    cyRef.current = cy;
    setIsCyReady(true);
    cy.on("tap", "node", (event) => onNodeClickRef.current?.(event.target.id()));
    cy.on("tap", (event) => { if (event.target === cy) onNodeClickRef.current?.(null); });
    cy.on("grab", "node", (event) => {
      const node = event.target;
      dragOrigins.current.set(node.id(), { ...node.position() });
    });
    cy.on("free", "node", (event) => {
      const node = event.target;
      const origin = dragOrigins.current.get(node.id());
      if (!origin) return;
      node.animate({ position: origin }, {
        duration: 180,
        easing: "ease-out-cubic",
        complete: () => dragOrigins.current.delete(node.id()),
      });
    });
    cy.on("zoom", () => setZoom(cy.zoom() >= 1.38 ? 1.4 : 1));
    cy.on("mouseover", "node", (event) => {
      const node = event.target;
      const paper = papersRef.current.find((entry) => entry.id === node.id());
      if (!paper) return;
      const original = event.originalEvent as MouseEvent | undefined;
      const rect = hostRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(290, rect.width - 24);
      const x = Math.max(12, Math.min((original?.clientX ?? rect.left + 12) - rect.left + 14, rect.width - width - 12));
      const y = Math.max(12, Math.min((original?.clientY ?? rect.top + 12) - rect.top + 14, rect.height - 132));
      setHoverDetails({ id: paper.id, title: paper.title, authors: paper.authors || "Author details unavailable", year: paper.year, citationCount: paper.citationCount, relations: [...(relationsRef.current.get(paper.id) ?? [])].join(" · ") || "Connected paper", x, y });
    });
    cy.on("mousemove", "node", (event) => {
      const original = event.originalEvent as MouseEvent | undefined;
      const rect = hostRef.current?.getBoundingClientRect();
      if (!rect || !original) return;
      setHoverDetails((details) => details ? { ...details, x: Math.max(12, Math.min(original.clientX - rect.left + 14, rect.width - 300)), y: Math.max(12, Math.min(original.clientY - rect.top + 14, rect.height - 132)) } : details);
    });
    cy.on("mouseout", "node", () => setHoverDetails(null));
  }, []);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !isCyReady) return;
    const previousPositions = new Map(cy.nodes().map((node) => [node.id(), { ...node.position() }]));
    const previousIds = new Set(previousPositions.keys());
    const nextIds = new Set(layout.positions.keys());
    const shouldResetLayout = appliedLayoutRevision.current !== layoutRevision;
    const topologyChanged = previousIds.size !== nextIds.size || [...nextIds].some((id) => !previousIds.has(id));
    const shouldFit = previousIds.size === 0 || topologyChanged || shouldResetLayout;
    cy.elements().remove();
    cy.add(elements.map((element) => {
      if (!("position" in element)) return element;
      const savedPosition = shouldResetLayout ? undefined : previousPositions.get(element.data.id);
      return savedPosition ? { ...element, position: savedPosition } : element;
    }));
    appliedLayoutRevision.current = layoutRevision;
    if (shouldFit) runFit(false);
  }, [elements, isCyReady, layout.positions, layoutRevision, runFit]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !isCyReady) return;
    cy.elements().removeClass("selected highlight dimmed focus-hidden label-hidden");
    if (!showLabels) cy.nodes().addClass("label-hidden");
    else if (zoom < 1.38) cy.nodes().filter((node) => !node.data("isRoot") && node.id() !== selectedPaperId && node.id() !== hoverDetails?.id && !node.data("important")).addClass("label-hidden");
    const activeId = hoverDetails?.id ?? selectedPaperId ?? rootId;
    const activeNode = cy.getElementById(activeId);
    if (activeNode.empty()) return;
    activeNode.addClass("selected");
    const neighbors = activeNode.neighborhood("node").add(activeNode);
    neighbors.addClass("highlight").removeClass("dimmed label-hidden");
    cy.nodes().difference(neighbors).addClass("dimmed");
    const directEdges = activeNode.connectedEdges();
    directEdges.addClass("highlight").removeClass("dimmed");
    cy.edges().difference(directEdges).addClass("dimmed");
    if (relationView === "focus") cy.edges().difference(directEdges).addClass("focus-hidden");
  }, [isCyReady, selectedPaperId, hoverDetails?.id, rootId, showLabels, zoom, relationView, elements]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !isCyReady) return;
    if (selectedPaperId && cy.getElementById(selectedPaperId).empty()) onNodeClick?.(null);
  }, [isCyReady, selectedPaperId, elements, onNodeClick]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !isCyReady) return;
    const handleResize = () => requestAnimationFrame(() => { cy.resize(); runFit(false); });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isCyReady, runFit]);

  const searchPaper = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return;
    const paper = data.nodes.find((node) => node.title.toLocaleLowerCase() === query || node.authors?.toLocaleLowerCase() === query)
      ?? data.nodes.find((node) => node.title.toLocaleLowerCase().includes(query) || node.authors?.toLocaleLowerCase().includes(query));
    if (!paper) { setSearchMessage("No paper matches that search."); return; }
    setSearchMessage("");
    setYearFrom(null);
    setYearTo(null);
    setRelationFilters({ references: true, citing: true, shared: true });
    onNodeClick?.(paper.id);
    const cy = cyRef.current;
    const node = cy?.getElementById(paper.id);
    if (node && !node.empty()) cy?.animate({ center: { eles: node }, zoom: Math.max(cy.zoom(), 0.9), duration: 220 });
  };

  const toggleRelation = (key: keyof RelationFilters) => setRelationFilters((current) => ({ ...current, [key]: !current[key] }));
  const relationButton = (key: keyof RelationFilters, label: string, dot: string) => (
    <button key={key} type="button" aria-pressed={relationFilters[key]} onClick={() => toggleRelation(key)} className={`${FILTER_CLASS} ${relationFilters[key] ? "border-primary/40 bg-primary-light/70 text-primary" : "border-border bg-surface-white text-text-secondary"}`}><i className={`h-1.5 w-1.5 rounded-full ${dot}`} />{label}</button>
  );

  return (
    <div ref={hostRef} className="group relative h-full min-h-0 w-full overflow-hidden rounded-xl bg-bg-primary" aria-label="Academic citation network">
      <CytoscapeComponent elements={[]} stylesheet={stylesheet} cy={handleCyReady} style={{ width: "100%", height: "100%" }} minZoom={0.12} maxZoom={2.5} wheelSensitivity={0.18} boxSelectionEnabled={false} />

      <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-wrap items-center gap-2 sm:inset-x-4 sm:top-4">
        <form onSubmit={searchPaper} className="pointer-events-auto min-w-[170px] flex-1 sm:max-w-[270px]">
          <div className="relative"><FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" aria-hidden="true" /><Input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSearchMessage(""); }} placeholder="Search author or paper" aria-label="Search papers in the network" className="h-9 min-h-9 rounded-lg bg-surface-white py-1.5 pl-9 pr-3 text-xs" /><button type="submit" className="sr-only">Find paper</button></div>
        </form>
        <div className="pointer-events-auto flex h-9 items-center gap-1 rounded-lg border border-border bg-surface-white px-2">
          <span className="text-[10px] font-medium text-text-secondary">Year</span>
          <Select aria-label="Publication year from" value={yearFrom ?? ""} onChange={(event) => setYearFrom(event.target.value ? Number(event.target.value) : null)} className="h-8 w-[66px] border-transparent bg-transparent px-1 py-0 text-[11px] focus-visible:ring-0"><option value="">Any</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</Select>
          <span className="text-text-secondary">–</span>
          <Select aria-label="Publication year to" value={yearTo ?? ""} onChange={(event) => setYearTo(event.target.value ? Number(event.target.value) : null)} className="h-8 w-[66px] border-transparent bg-transparent px-1 py-0 text-[11px] focus-visible:ring-0"><option value="">Any</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</Select>
        </div>
        <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-border bg-surface-white/95 p-1">{relationButton("references", "References", "bg-[#829CAB]")}{relationButton("citing", "Citing", "bg-[#7896A8]")}{relationButton("shared", "Shared", "bg-primary")}</div>
        <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-border bg-surface-white/95 p-1">
          <button type="button" aria-pressed={relationView === "all"} onClick={() => setRelationView((mode) => mode === "focus" ? "all" : "focus")} className={BUTTON_CLASS}>{relationView === "focus" ? "Focus" : "All links"}</button>
          <button type="button" aria-pressed={showLabels} onClick={() => setShowLabels((visible) => !visible)} className={BUTTON_CLASS}>Labels {showLabels ? "On" : "Off"}</button>
        </div>
        <span className="ml-auto hidden items-center text-[11px] text-text-secondary xl:inline-flex">{data.nodes.length} papers · {data.edges.length} relations</span>
      </div>

      {searchMessage && <p className="absolute left-4 top-[3.35rem] z-30 rounded-md bg-surface-white px-2.5 py-1.5 text-xs text-error" role="status">{searchMessage}</p>}
      {hoverDetails && <div className="pointer-events-none absolute z-30 w-[min(290px,calc(100%-1.5rem))] rounded-lg border border-border bg-surface-white px-3.5 py-3 text-text-primary shadow-md" style={{ left: hoverDetails.x, top: hoverDetails.y }} role="status"><p className="line-clamp-2 text-xs font-semibold leading-snug">{hoverDetails.title}</p><p className="mt-1 line-clamp-2 text-[11px] text-text-secondary">{hoverDetails.authors}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-text-secondary">{hoverDetails.year && <span>{hoverDetails.year}</span>}{hoverDetails.citationCount > 0 && <span>{hoverDetails.citationCount} citations</span>}<span>{hoverDetails.relations}</span></div></div>}

      <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface-white/95 px-3 py-2 text-[10px] text-text-secondary sm:bottom-4 sm:left-4 sm:gap-x-4 sm:text-[11px]" role="img" aria-label="Node size represents publication recency; edge is a citation relationship">
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-full border-2 border-primary bg-white" />Selected paper</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-full border border-[#B7CBD7] bg-[#D7ECF7]" />Newer papers are larger</span>
        <span className="hidden items-center gap-1.5 sm:flex"><i className="h-px w-4 bg-[#829CAB]" />Citation relation</span>
      </div>

      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-lg border border-border bg-surface-white/95 p-1 sm:bottom-4 sm:right-4">
        <button type="button" className={BUTTON_CLASS} onClick={() => cyRef.current?.zoom({ level: cyRef.current.zoom() * 1.2, renderedPosition: { x: hostRef.current?.clientWidth ? hostRef.current.clientWidth / 2 : 0, y: hostRef.current?.clientHeight ? hostRef.current.clientHeight / 2 : 0 } })} aria-label="Zoom in" title="Zoom in"><FiPlus /></button>
        <button type="button" className={BUTTON_CLASS} onClick={() => cyRef.current?.zoom({ level: cyRef.current.zoom() / 1.2, renderedPosition: { x: hostRef.current?.clientWidth ? hostRef.current.clientWidth / 2 : 0, y: hostRef.current?.clientHeight ? hostRef.current.clientHeight / 2 : 0 } })} aria-label="Zoom out" title="Zoom out"><FiMinus /></button>
        <button type="button" className={BUTTON_CLASS} onClick={() => runFit()} aria-label="Fit graph to view" title="Fit view"><FiMaximize2 /></button>
        <button type="button" className={BUTTON_CLASS} onClick={() => setLayoutRevision((revision) => revision + 1)} aria-label="Reset graph layout" title="Reset layout"><FiRotateCw /></button>
      </div>

      {!data.nodes.length && <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-5 pt-16 text-center"><div className="max-w-sm text-text-secondary"><GitBranch className="mx-auto mb-2 h-6 w-6" aria-hidden="true" /><p className="text-sm font-semibold text-text-primary">No citation data available</p><p className="mt-1 text-xs leading-relaxed">This paper has no citation network to display yet.</p></div></div>}
    </div>
  );
};

export default CitationGraphCanvas;
