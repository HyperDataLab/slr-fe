import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { gsap } from "gsap";
import { studySelectionService } from "../../services/studySelectionService";
import { QUERY_KEYS } from "../../constants/queryKeys";

import {
  FiArrowLeft,
  FiFileText,
  FiExternalLink,
  FiUploadCloud,
  FiZap,
} from "react-icons/fi";
import { toastError, toastSuccess } from "../../utils/toast";
import { formatAuthors } from "../../utils/formatAuthors";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import Button from "../../components/ui/Button";
import type { ScreeningPaper } from "../reviewProcess/studySelection/titleAbstractScreening/types";
import { usePaperDetails } from "../../hooks/usePaperDetails";
import {
  usePaperCitations,
  usePaperGraph,
} from "../../hooks/usePaperDiscovery";
import { usePaperSpecificCandidates } from "../../hooks/useSnowballCandidates";
import type { PaperNodeDto } from "../../types/studySelection";

import {
  ContentSection,
  PublicationInfoCard,
  IdentifierSection,
  SystemMetadataCollapse,
  TabButton,
  GraphSection,
  PaperNodeList,
} from "../../components/shared/paper/PaperViewer/components";
import PdfJsViewer from "../../components/shared/paper/PdfJsViewer/PdfJsViewer";
import UploadFullTextPdfModal from "../reviewProcess/studySelection/components/UploadFullTextPdfModal";
import { useProjectMember } from "../../hooks/useProjectMember";
import { usePaperActions } from "../../hooks/usePaperActions";
import MetadataSuggestionModal from "../reviewProcess/studySelection/components/MetadataSuggestionModal";

export default function PaperDetailsPage() {
  const { projectId, paperId } = useParams<{
    projectId: string;
    paperId: string;
  }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("abstract");
  const tabPanelRef = useRef<HTMLDivElement>(null);
  const hasRenderedTabPanel = useRef(false);
  const [graphDepth, setGraphDepth] = useState(2);
  const [minConfidence, setMinConfidence] = useState(0.1);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);

  const queryClient = useQueryClient();
  const { member } = useProjectMember(projectId || "");
  const isLeader = member?.isLeader ?? false;
  const {
    applyMetadataSuggestion,
    isApplyingMetadataSuggestion,
  } = usePaperActions();

  const {
    data: paper,
    isLoading: isPaperLoading,
    error: paperError,
  } = usePaperDetails(paperId);

  // Discovery Hooks
  const { data: candidateResponse, isLoading: isLoadingCandidates } =
    usePaperSpecificCandidates(paperId || "", { pageNumber: 1, pageSize: 100 });
  const snowballingReferences = useMemo<PaperNodeDto[]>(
    () =>
      (candidateResponse?.items ?? []).map((candidate) => ({
        id: candidate.candidateId,
        title: candidate.title || candidate.rawReference || "Untitled reference",
        year: candidate.publicationYear
          ? Number.parseInt(candidate.publicationYear, 10) || null
          : null,
        authors: candidate.authors || null,
        doi: candidate.doi || null,
        citationCount: 0,
      })),
    [candidateResponse?.items],
  );
  const { data: citations = [], isLoading: isCitationsLoading } =
    usePaperCitations(paperId);
  const { data: citationGraph, isLoading: isGraphLoading } = usePaperGraph(
    paperId,
    {
      depth: graphDepth,
      minConfidence,
    },
  );

  const [activeSection, setActiveSection] = useState<string | null>(null);

  const handleSectionClick = (sectionKey: string) => {
    setActiveSection(sectionKey);
  };

  const activeSectionCoords = useMemo(() => {
    if (!activeSection) return null;
    const section = paper?.fullTextSections?.find(
      (s) => s.sectionTitle === activeSection,
    );
    return section?.coordinates || null;
  }, [activeSection, paper]);

  const isDiscoveryLoading = isCitationsLoading || isGraphLoading;

  useEffect(() => {
    const panel = tabPanelRef.current;
    if (!panel) return;
    if (!hasRenderedTabPanel.current) {
      hasRenderedTabPanel.current = true;
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const context = gsap.context(() => {
      gsap.fromTo(
        panel,
        { autoAlpha: 0, y: 8 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.2,
          ease: "power2.out",
          clearProps: "transform,opacity,visibility",
        },
      );
    }, panel);

    return () => context.revert();
  }, [activeTab]);

  // ---- Mutation: Upload Full-Text PDF ----
  const uploadMutation = useMutation({
    mutationFn: async (vars: { file: File; extractWithGrobid?: boolean }) => {
      if (!projectId || !paperId) return;
      return studySelectionService.uploadPaperFullText({
        file: vars.file,
        projectId,
        paperId,
        extractWithGrobid: vars.extractWithGrobid,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.papers.detail(paperId!),
      });
      toastSuccess("PDF uploaded successfully.");
      setIsUploadModalOpen(false);
    },
    onError: (error) => {
      toastError(
        error instanceof Error
          ? error.message
          : "Failed to upload PDF. Please try again.",
      );
    },
  });

  const handleApplySuggestion = async (selectedFields: string[]) => {
    if (!paper?.extractionSuggestion || !paperId) return;
    await applyMetadataSuggestion(
      paperId,
      paper.extractionSuggestion.sourceMetadataId,
      selectedFields,
    );
    setIsSuggestionModalOpen(false);
  };

  // Adapt API metadata to the shared paper viewer model.
  const adaptedPaper = useMemo<ScreeningPaper | null>(() => {
    if (!paper) return null;
    const publicationYear = paper.publicationYearInt ??
      (paper.publicationYear ? Number.parseInt(paper.publicationYear, 10) : null);
    return {
      id: paper.id,
      title: paper.title,
      authors: paper.authors ?? null,
      doi: paper.doi ?? null,
      publicationYear: Number.isNaN(publicationYear) ? null : publicationYear,
      publicationDate: paper.publicationDate ?? null,
      abstract: paper.abstract ?? null,
      journal: paper.journal ?? null,
      source: paper.source ?? null,
      keywords: paper.keywords ?? null,
      publicationType: paper.publicationType ?? null,
      volume: paper.volume ?? null,
      issue: paper.issue ?? null,
      pages: paper.pages ?? null,
      publisher: paper.publisher ?? null,
      language: paper.language ?? null,
      url: paper.url ?? null,
      pdfUrl: paper.pdfUrl ?? null,
      pdfFileName: null,
      conferenceName: paper.conferenceName ?? null,
      conferenceLocation: paper.conferenceLocation ?? null,
      journalIssn: paper.journalIssn ?? null,
      journalEIssn: paper.journalEIssn ?? null,
      md5: paper.md5 ?? null,
      referenceCount: candidateResponse?.totalCount ?? snowballingReferences.length,
      citationCount: citations?.length || 0,
      screeningStatus: "pending",
      finalDecision: null,
      finalDecisionText: null,
      decisions: [],
      extraction: null,
      metadataSources: null,
      extractionResult: null,
      extractionSuggestion: paper.extractionSuggestion ?? null,
      resolution: null,
      fullTextSections: paper.fullTextSections ?? null,
    };
  }, [paper, candidateResponse?.totalCount, snowballingReferences.length, citations]);

  const isFieldUpdated = () => false; // No suggestions view in this standalone page for now
  const hasPublicationDetails = [
    paper?.journal,
    paper?.conferenceName,
    paper?.publisher,
    paper?.volume,
    paper?.issue,
    paper?.pages,
    paper?.publicationDate,
    paper?.language,
    paper?.publicationType,
  ].some(Boolean);
  const hasIdentifiers = [paper?.doi, paper?.journalIssn, paper?.journalEIssn, paper?.md5].some(Boolean);

  if (isPaperLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-bg-secondary/50">
        <LoadingSpinner size="lg" className="mb-4" />
        <p className="text-text-secondary font-medium">
          Loading paper details...
        </p>
      </div>
    );
  }

  if (paperError || !paper) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-bg-secondary/50 px-6 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-xl border border-error/20 bg-surface-white text-error">
          <FiFileText className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-black text-text-primary mb-2">
          Paper Not Found
        </h1>
        <p className="text-text-secondary max-w-md mb-8">
          The paper you are looking for might have been removed or you don't
          have permission to view it.
        </p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface-white px-6 py-3 font-bold text-text-primary transition-colors hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 motion-reduce:transition-none"
        >
          <FiArrowLeft className="w-4 h-4" />
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary/30">
      <div className="mx-auto w-full max-w-[1560px] px-4 py-3 sm:px-5 lg:px-6 lg:py-4">
        <section className="mb-4" aria-labelledby="paper-details-title">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg pr-2 text-sm font-medium text-text-secondary transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 motion-reduce:transition-none"
            aria-label="Back to previous page"
          >
            <FiArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </button>

          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-primary">Paper details</p>
              <h1 id="paper-details-title" className="mt-1.5 max-w-[82rem] text-2xl font-semibold leading-tight tracking-tight text-text-primary sm:text-[26px] [text-wrap:balance]">
                {paper.title || "Untitled paper"}
              </h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-text-secondary">
                {[formatAuthors(paper.authors), paper.publicationYearInt ?? paper.publicationYear ?? paper.year]
                  .filter((value) => value !== null && value !== undefined && value !== "")
                  .join(" \u00b7 ") || "Bibliographic record and review evidence."}
              </p>
            </div>

            {paper.url && (
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 w-fit shrink-0 items-center gap-2 rounded-lg border border-border bg-surface-white px-3.5 text-sm font-medium text-text-primary transition-colors hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 motion-reduce:transition-none"
              >
                Source link
                <FiExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            )}
          </div>
        </section>

        {paper.extractionSuggestion && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/15 bg-primary-light px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-primary">
                <FiZap className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="text-sm font-semibold text-text-primary">
                AI metadata suggestions available
              </p>
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setIsSuggestionModalOpen(true)}
              className="min-h-9 rounded-lg px-3 text-xs"
            >
              Review suggestions
            </Button>
          </div>
        )}

        <div className="space-y-4">
          {/* Tab Navigation */}
          <div className="border-b border-border">
            <nav
              aria-label="Paper details sections"
              className="flex flex-wrap items-end gap-x-6"
            >
              <TabButton
                active={activeTab === "abstract"}
                onClick={() => setActiveTab("abstract")}
                label="Overview"
                variant="underline"
              />
              <TabButton
                active={activeTab === "references"}
                onClick={() => setActiveTab("references")}
                label="References"
                count={candidateResponse?.totalCount ?? snowballingReferences.length}
                variant="underline"
              />
              <TabButton
                active={activeTab === "citations"}
                onClick={() => setActiveTab("citations")}
                label="Citations"
                count={citations?.length}
                variant="underline"
              />
              <TabButton
                active={activeTab === "graph"}
                onClick={() => setActiveTab("graph")}
                label="Network"
                variant="underline"
              />
              <TabButton
                active={activeTab === "fulltext"}
                onClick={() => setActiveTab("fulltext")}
                label="Full Text"
                variant="underline"
              />
            </nav>
          </div>

          {/* 2. Tab Content */}
          <div ref={tabPanelRef} className="space-y-4">
            {activeTab === "abstract" && (
              <div className="space-y-4">
                <div className={`grid grid-cols-1 items-start gap-4 ${hasPublicationDetails || hasIdentifiers ? "lg:grid-cols-[minmax(0,2fr)_minmax(280px,0.95fr)]" : ""}`}>
                  <ContentSection
                    paper={paper}
                    isFieldUpdated={isFieldUpdated}
                    collapsibleAbstract
                  />
                  {(hasPublicationDetails || hasIdentifiers) && (
                    <aside className="overflow-hidden rounded-xl border border-border bg-surface-white">
                      {hasPublicationDetails && (
                        <PublicationInfoCard
                          paper={adaptedPaper!}
                          isFieldUpdated={isFieldUpdated}
                          variant="embedded"
                        />
                      )}
                      {hasPublicationDetails && hasIdentifiers && (
                        <div className="mx-5 h-px bg-border" aria-hidden="true" />
                      )}
                      {hasIdentifiers && (
                        <IdentifierSection
                          paper={adaptedPaper!}
                          isFieldUpdated={isFieldUpdated}
                          variant="embedded"
                        />
                      )}
                    </aside>
                  )}
                </div>

                <SystemMetadataCollapse
                  paper={adaptedPaper!}
                  variant="compact"
                  extras={{
                    importedAt: paper.importedAt ?? null,
                    createdAt: paper.createdAt ?? null,
                    modifiedAt: paper.modifiedAt ?? paper.updatedAt ?? null,
                    pdfFileName: paper.pdfFileName ?? paper.pdf?.fileName ?? null,
                    pdfSizeBytes: paper.pdf?.sizeBytes ?? null,
                    pdfUrl: paper.pdfUrl ?? null,
                    pdfProcessingStatus: paper.pdf?.processingStatus ?? null,
                    fullTextStatus: paper.pdf?.fullText?.status ?? null,
                    extractionError: paper.pdf?.processingError?.message ?? null,
                    sectionCount: paper.pdf?.fullText?.sectionCount ?? null,
                    referenceCount: paper.pdf?.fullText?.referenceCount ?? null,
                    figureCount: paper.pdf?.fullText?.figureCount ?? null,
                  }}
                />
              </div>
            )}

            {activeTab === "references" && (
              <section className="space-y-2" aria-labelledby="cited-references-heading">
                <div className="flex items-center gap-2">
                  <h2 id="cited-references-heading" className="text-base font-semibold text-text-primary">
                  Cited References
                  </h2>
                  <span className="rounded-full bg-bg-secondary px-2 py-0.5 text-xs tabular-nums text-text-secondary">
                    {candidateResponse?.totalCount ?? snowballingReferences.length}
                  </span>
                </div>
                <PaperNodeList
                  nodes={snowballingReferences}
                  isLoading={isLoadingCandidates}
                  emptyLabel="No references found."
                  variant="flat"
                />
              </section>
            )}

            {activeTab === "citations" && (
              <section className="space-y-2" aria-label="Citing Papers">
                <PaperNodeList
                  nodes={citations}
                  isLoading={isDiscoveryLoading}
                  emptyLabel="No citations found."
                  variant="flat"
                  flatHeading="Citing Papers"
                  flatHeadingId="citing-papers-heading"
                />
              </section>
            )}

            {activeTab === "graph" && (
              <GraphSection
                citationGraph={citationGraph}
                isDiscoveryLoading={isDiscoveryLoading}
                graphDepth={graphDepth}
                setGraphDepth={setGraphDepth}
                minConfidence={minConfidence}
                setMinConfidence={setMinConfidence}
                rootPaperId={paper.id}
                showGraphInline
              />
            )}

            {activeTab === "fulltext" && (
              <div className="flex h-[min(82vh,900px)] min-h-[560px] flex-col overflow-hidden rounded-xl border border-border bg-surface-white">
                {!paper.pdfUrl && <div className="flex items-center border-b border-border bg-bg-secondary/50 px-4 py-3">
                  <h2 className="text-xs font-black text-text-primary uppercase tracking-tight">
                    Full-Text Access
                  </h2>
                </div>}

                {paper.pdfUrl ? (
                  <div className="min-h-0 flex-1">
                    <PdfJsViewer
                      fileUrl={paper.pdfUrl}
                      documentTitle={paper.title}
                      coordinateStr={activeSectionCoords}
                      sections={paper.fullTextSections}
                      activeSection={activeSection}
                      onSectionSelect={handleSectionClick}
                      scale={1.25}
                    />
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center bg-bg-secondary/30 p-12">
                    <div className="w-20 h-20 bg-surface-white rounded-xl shadow-none flex items-center justify-center mb-6 text-text-muted border border-border">
                      <FiFileText className="w-10 h-10" />
                    </div>
                    <h3 className="text-lg font-bold text-text-primary mb-2">
                      No PDF attached yet
                    </h3>
                    <p className="text-sm text-text-secondary max-w-sm text-center mb-8 leading-relaxed">
                      PDF is not available for this paper.
                    </p>
                    {isLeader && (
                      <Button
                        variant="primary"
                        onClick={() => setIsUploadModalOpen(true)}
                        className="gap-2"
                      >
                        <FiUploadCloud className="w-4 h-4" />
                        Upload Full-Text PDF
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {isUploadModalOpen && paper && (
        <UploadFullTextPdfModal
          isOpen={isUploadModalOpen}
          isUploading={false} // Standalone page doesn't track this easily without extra hooks
          paper={{
            title: paper.title,
            authors: paper.authors ?? "",
            doi: paper.doi ?? "",
            abstract: paper.abstract ?? "",
            journal: paper.journal ?? "",
          }}
          onClose={() => setIsUploadModalOpen(false)}
          onSubmit={async (file, options) => {
            await uploadMutation.mutateAsync({
              file,
              extractWithGrobid: options?.extractWithGrobid,
            });
          }}
        />
      )}

      {paper.extractionSuggestion && (
        <MetadataSuggestionModal
          isOpen={isSuggestionModalOpen}
          isApplying={isApplyingMetadataSuggestion}
          currentMetadata={{
            title: paper.title,
            authors: paper.authors ?? "",
            abstract: paper.abstract ?? "",
            doi: paper.doi ?? "",
            journal: paper.journal ?? "",
            volume: paper.volume ?? "",
            issue: paper.issue ?? "",
            pages: paper.pages ?? "",
            keywords: paper.keywords ?? "",
            year: paper.publicationYear?.toString(),
            publishedDate: paper.publicationDate ?? "",
            issn: paper.journalIssn ?? "",
            eissn: paper.journalEIssn ?? "",
            language: paper.language ?? "",
            md5: paper.md5 ?? "",
            publisher: paper.publisher,
          }}
          suggestion={paper.extractionSuggestion as any}
          onApply={handleApplySuggestion}
          onClose={() => setIsSuggestionModalOpen(false)}
        />
      )}
    </div>
  );
}
