import React, { memo, useMemo, useCallback } from "react";
import { FiCopy, FiExternalLink, FiTag } from "react-icons/fi";
import { toastSuccess, toastError } from "../../../../utils/toast";

import PaperAbstractSection from "../../../../components/papers/PaperAbstractSection";
import PaperMetadataGrid from "../../../../components/papers/PaperMetadataGrid";
import type { WorkspaceQAPaper } from "../QualityAssessmentWorkspace";

// ============================================
// Props
// ============================================

interface QAPaperDetailsProps {
  paper: WorkspaceQAPaper;
}

// ============================================
// Keywords Component
// ============================================

const PaperKeywords = memo(({ keywords }: { keywords?: string | null }) => {
  const tags = useMemo(() => {
    if (!keywords) return [];
    return keywords
      .split(/[;,]/)
      .map((k) => k.trim())
      .filter(Boolean);
  }, [keywords]);

  if (tags.length === 0) return null;

  return (
    <section className="mt-5">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-text-secondary">
        <FiTag className="h-3.5 w-3.5" /> Keywords
      </h3>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex items-center rounded-md bg-bg-primary px-2 py-1 text-xs text-text-secondary"
          >
            {tag}
          </span>
        ))}
      </div>
    </section>
  );
});
PaperKeywords.displayName = "PaperKeywords";

// ============================================
// Header Section
// ============================================

const PaperHeader = memo(({ paper }: { paper: WorkspaceQAPaper }) => {
  const handleCopyDoi = useCallback(() => {
    if (paper.doi) {
      navigator.clipboard.writeText(paper.doi).then(
        () => toastSuccess("DOI copied to clipboard"),
        () => toastError("Failed to copy DOI"),
      );
    }
  }, [paper.doi]);

  return (
    <header className="mb-6">
      <h1 className="mb-3 text-xl font-semibold leading-7 tracking-[-0.02em] text-text-primary wrap-break-word sm:text-[22px] sm:leading-8">
        {paper.title}
      </h1>

      <dl className="flex flex-wrap gap-x-2 gap-y-1 text-xs leading-5 text-text-secondary">
        {paper.authors && <div className="w-full"><dt className="sr-only">Authors</dt><dd className="wrap-break-word">{paper.authors}</dd></div>}
        {(paper.publicationYear || paper.publicationType || paper.source) && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-2">
            <dt className="sr-only">Publication details</dt>
            <dd>{[paper.publicationYear, paper.publicationType, paper.source].filter(Boolean).join(" · ")}</dd>
          </div>
        )}
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {paper.doi && (
          <button
            onClick={handleCopyDoi}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md text-xs font-medium text-text-secondary transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            title={`Copy DOI: ${paper.doi}`}
          >
            <FiCopy className="w-3.5 h-3.5" />
            Copy DOI
          </button>
        )}
        {paper.doi && (
          <a
            href={`https://doi.org/${paper.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md text-xs font-medium text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <FiExternalLink className="w-3.5 h-3.5" />
            Open DOI
          </a>
        )}
        {paper.url && !paper.doi && (
          <a
            href={paper.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md text-xs font-medium text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <FiExternalLink className="w-3.5 h-3.5" />
            Open URL
          </a>
        )}
      </div>
    </header>
  );
});
PaperHeader.displayName = "PaperHeader";

// ============================================
// Main Content
// ============================================

const QAPaperDetails: React.FC<QAPaperDetailsProps> = ({ paper }) => {
  return (
    <div className="bg-surface-white">
      <PaperHeader paper={paper} />
      <section aria-labelledby="paper-abstract-heading" className="border-t border-border pt-4">
        <h2 id="paper-abstract-heading" className="mb-2 text-sm font-semibold text-text-primary">Abstract</h2>
        <PaperAbstractSection abstract={paper.abstract} showHeading={false} />
      </section>
      {/* Fallback type to any since PaperResponse differs slightly from WorkspaceQAPaper but contains the matched fields */}
      <details className="mt-3 border-t border-border py-1">
        <summary className="flex min-h-9 cursor-pointer list-none items-center text-left text-sm font-medium leading-5 text-text-primary outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden">
          More publication details
        </summary>
        <div className="pt-4">
          <PaperMetadataGrid paper={paper as any} />
          <PaperKeywords keywords={paper.keywords} />
        </div>
      </details>
    </div>
  );
};

export default memo(QAPaperDetails);
