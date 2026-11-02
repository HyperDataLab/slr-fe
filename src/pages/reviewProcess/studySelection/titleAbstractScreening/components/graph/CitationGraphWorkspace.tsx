import React, { useMemo, useState } from "react";
import { FiInfo, FiRefreshCw } from "react-icons/fi";
import type { CitationGraphDto } from "../../../../../../types/studySelection";
import { useExternalPaperAbstract } from "../../../../../../hooks/usePaperDiscovery";
import { usePaperDetails } from "../../../../../../hooks/usePaperDetails";
import CitationGraphCanvas from "./CitationGraphCanvas";
import PaperDetailsPanel from "./PaperDetailsPanel";

interface CitationGraphWorkspaceProps {
  data: CitationGraphDto;
  rootPaperId?: string;
  className?: string;
}

const CitationGraphWorkspace: React.FC<CitationGraphWorkspaceProps> = ({
  data,
  rootPaperId,
  className,
}) => {
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);

  const selectedNode = data.nodes.find((node) => node.id === selectedPaperId);
  const selectedNodeIsExternal = selectedPaperId?.startsWith("openalex:") ?? false;
  const { data: paperData, isLoading: isLoadingDetails } = usePaperDetails(
    selectedPaperId && !selectedNodeIsExternal ? selectedPaperId : undefined,
  );
  const { data: externalAbstract, isLoading: isLoadingExternalAbstract } = useExternalPaperAbstract(
    selectedNodeIsExternal ? selectedPaperId ?? undefined : undefined,
    selectedNode?.doi,
  );

  const paperDetails = useMemo(() => {
    if (paperData) {
      return {
        id: paperData.id,
        title: paperData.title,
        authors: paperData.authors ?? undefined,
        year:
          paperData.publicationYearInt ||
          (paperData.publicationYear
            ? Number(paperData.publicationYear)
            : undefined),
        doi: paperData.doi ?? undefined,
        abstract: paperData.abstract ?? undefined,
      };
    }
    if (!selectedNode) return null;
    return {
      id: selectedNode.id,
      title: selectedNode.title,
      authors: selectedNode.authors ?? undefined,
      year: selectedNode.year ?? undefined,
      doi: selectedNode.doi ?? undefined,
      citationCount: selectedNode.citationCount,
      abstract: externalAbstract?.abstract ?? undefined,
      abstractSource: externalAbstract?.source ?? undefined,
    };
  }, [paperData, selectedNode, externalAbstract]);

  return (
    <div className={`relative ${className ?? "h-[min(72vh,720px)] min-h-[520px]"} min-w-0 overflow-hidden rounded-xl bg-bg-secondary/45`}>
      <div className="absolute inset-0 overflow-hidden rounded-xl bg-bg-secondary/45">
        <CitationGraphCanvas
          data={data}
          rootPaperId={rootPaperId}
          selectedPaperId={selectedPaperId}
          onNodeClick={setSelectedPaperId}
        />
      </div>

      {selectedPaperId && (
        <aside className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-4 motion-safe:duration-200 absolute bottom-3 left-3 top-3 z-30 flex w-[min(360px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-xl border border-border/70 bg-surface-white/95 shadow-lg backdrop-blur-sm sm:bottom-4 sm:left-4 sm:top-4">
          {isLoadingDetails ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-text-secondary" role="status" aria-live="polite" aria-busy="true">
              <FiRefreshCw aria-hidden="true" className="mb-3 h-7 w-7 motion-safe:animate-spin motion-reduce:animate-none text-primary" />
              <p className="text-sm font-medium">Fetching details...</p>
            </div>
          ) : paperDetails ? (
            <PaperDetailsPanel
              paper={paperDetails}
              abstractLoading={selectedNodeIsExternal && isLoadingExternalAbstract}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-text-secondary">
              <FiInfo className="mb-3 h-8 w-8 opacity-40" aria-hidden="true" />
              <p className="text-sm font-medium">Details not available</p>
            </div>
          )}
        </aside>
      )}
    </div>
  );
};

export default CitationGraphWorkspace;
