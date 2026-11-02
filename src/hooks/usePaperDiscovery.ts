import { useQuery } from "@tanstack/react-query";
import { studySelectionService } from "../services/studySelectionService";
import { QUERY_KEYS } from "../constants/queryKeys";
import type { PaperNodeDto, CitationGraphDto, GetCitationGraphQuery, PaperAbstractDto } from "../types/studySelection";

export const useExternalPaperAbstract = (
  paperId: string | undefined,
  doi?: string | null,
) => {
  return useQuery<PaperAbstractDto>({
    queryKey: QUERY_KEYS.papers.abstract(paperId ?? "", doi),
    queryFn: async () => {
      const response = await studySelectionService.getPaperAbstract(paperId!, doi);
      if (!response.isSuccess) {
        throw new Error(response.message || "Failed to fetch paper abstract");
      }
      return response.data;
    },
    enabled: !!paperId,
    staleTime: (query) => query.state.data?.abstract ? 24 * 60 * 60 * 1000 : 60 * 1000,
    retry: 0,
  });
};

/**
 * Hook to fetch references for a paper.
 */
export const usePaperReferences = (paperId: string | undefined) => {
  return useQuery<PaperNodeDto[]>({
    queryKey: QUERY_KEYS.papers.references(paperId ?? ""),
    queryFn: async () => {
      const response = await studySelectionService.getReferences(paperId!);
      if (!response.isSuccess) {
        throw new Error(response.message || "Failed to fetch references");
      }
      return response.data;
    },
    enabled: !!paperId,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook to fetch citations for a paper.
 */
export const usePaperCitations = (paperId: string | undefined) => {
  return useQuery<PaperNodeDto[]>({
    queryKey: QUERY_KEYS.papers.citations(paperId ?? ""),
    queryFn: async () => {
      const response = await studySelectionService.getCitations(paperId!);
      if (!response.isSuccess) {
        throw new Error(response.message || "Failed to fetch citations");
      }
      return response.data;
    },
    enabled: !!paperId,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook to fetch citation graph for a paper.
 */
export const usePaperGraph = (
  paperId: string | undefined,
  query: GetCitationGraphQuery = { depth: 2, minConfidence: 0.1 }
) => {
  return useQuery<CitationGraphDto>({
    queryKey: QUERY_KEYS.papers.graph(paperId ?? "", query.depth ?? 2, query.minConfidence ?? 0.1),
    queryFn: async () => {
      const response = await studySelectionService.getCitationGraph(paperId!, query);
      if (!response.isSuccess) {
        throw new Error(response.message || "Failed to fetch citation graph");
      }
      return response.data;
    },
    enabled: !!paperId,
    staleTime: 5 * 60 * 1000,
  });
};
