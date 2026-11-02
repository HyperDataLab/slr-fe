import React from "react";
import { FiFileText } from "react-icons/fi";

export interface PaperDetails {
  id: string;
  title: string;
  authors?: unknown;
  year?: number;
  doi?: string;
  abstract?: string;
  abstractSource?: "OPENALEX" | "CROSSREF";
  citationCount?: number;
  referenceCount?: number;
}

interface PaperDetailsPanelProps {
  paper: PaperDetails;
  abstractLoading?: boolean;
}

const PaperDetailsPanel: React.FC<PaperDetailsPanelProps> = ({ paper, abstractLoading = false }) => {
  const authorList = Array.isArray(paper.authors)
    ? paper.authors
        .map((author: unknown) => {
          if (typeof author === "string") return author.trim();
          if (!author || typeof author !== "object") return "";

          const item = author as {
            name?: unknown;
            display_name?: unknown;
            given?: unknown;
            family?: unknown;
            author?: { display_name?: unknown };
          };
          const name = item.name ?? item.display_name ?? item.author?.display_name;
          if (typeof name === "string" && name.trim()) return name.trim();
          return [item.given, item.family]
            .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
            .join(" ");
        })
        .filter(Boolean)
    : typeof paper.authors === "string"
      ? paper.authors.split(/[;,]/).map((author) => author.trim()).filter(Boolean)
      : [];

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent text-text-primary">
      <div className="modal-scroll-area min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden p-4 sm:p-5">
        {/* Header Section: Title & Year */}
        <header className="space-y-2">
          <h2 className="line-clamp-3 text-base font-semibold leading-snug text-text-primary">
            {paper.title}
            {paper.year && (
              <span className="ml-2 inline-block font-medium text-text-secondary">
                ({paper.year})
              </span>
            )}
          </h2>

        </header>

        {/* Authors Section */}
        {authorList.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-text-secondary">
              Authors
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {authorList.map((author, idx) => (
                <span
                  key={idx}
                  className="rounded-full bg-primary-light/60 px-2.5 py-1 text-[11px] font-medium text-primary"
                >
                  {author}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* DOI Section */}
        {paper.doi && (
          <div className="space-y-1.5">
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-text-secondary">
              DOI
            </h3>
            <a
              href={`https://doi.org/${paper.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:underline truncate block"
            >
              {paper.doi}
            </a>
          </div>
        )}

        {/* Abstract Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FiFileText className="w-3 h-3 text-text-secondary" />
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-text-secondary">
              Abstract
            </h3>
          </div>
          {paper.abstractSource && (
            <p className="text-[10px] font-medium text-text-secondary">
              Source: {paper.abstractSource === "OPENALEX" ? "OpenAlex" : "Crossref"}
            </p>
          )}
          <p className="text-xs leading-relaxed text-text-secondary line-clamp-[8] text-justify font-normal" aria-live="polite">
            {paper.abstract || (abstractLoading
              ? "Looking for an abstract in OpenAlex and Crossref…"
              : "No abstract available for this paper.")}
          </p>
        </div>
      </div>

    </div>
  );
};

export default PaperDetailsPanel;
