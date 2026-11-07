// PRISMA Export Actions — Export PNG, PDF, and copy data buttons (stubbed logic)

import { toastSuccess } from "../../../../utils/toast";
import {
  FiImage,
  FiFileText,
  FiCopy,
  FiRefreshCw,
  FiClock,
  FiArchive,
} from "react-icons/fi";
import type { PrismaNodeResponse } from "../../../../types/prismaReport";
import { PRISMA_STAGE_LABELS } from "../../../../types/prismaReport";
import Button from "../../../../components/ui/Button";

interface PrismaExportActionsProps {
  /** Whether a report exists to export */
  hasReport: boolean;
  /** Whether report generation is in progress */
  isGenerating: boolean;
  /** Whether report download is in progress */
  isDownloading?: boolean;
  /** Whether the user may save a new snapshot (project leader) */
  canGenerate?: boolean;
  /** Trigger report generation */
  onGenerate: () => void;
  /** Trigger PRISMA diagram download (.docx) */
  onDownloadDiagram?: () => void;
  /** Download the structured PRISMA and included-study handoff for writing. */
  onDownloadWritingExport?: () => void;
  /** Download a complete project data package (.slr). */
  onDownloadProjectPackage?: () => void;
  /** Whether the full project package is being prepared. */
  isExportingProjectPackage?: boolean;
  /** Version label of the latest report */
  version?: string;
  /** Timestamp of last generation */
  generatedAt?: string | null;
  /** Callback to export the diagram as PNG */
  onExportPNG?: () => void;
  /** Remaining cooldown seconds before user can regenerate again */
  cooldown?: number;
  /** Nodes for text copy */
  nodes?: PrismaNodeResponse[];
  /** Included node for text copy */
  includedNode?: PrismaNodeResponse | null;
}

export default function PrismaExportActions({
  hasReport,
  isGenerating,
  isDownloading,
  cooldown = 0,
  canGenerate = true,
  onGenerate,
  onDownloadDiagram,
  onDownloadWritingExport,
  onDownloadProjectPackage,
  isExportingProjectPackage = false,
  onExportPNG,
  nodes,
  includedNode,
  version,
  generatedAt,
}: PrismaExportActionsProps) {
  const handleExportPNG = () => {
    if (onExportPNG) {
      onExportPNG();
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleCopyNumbers = () => {
    if (!nodes && !includedNode) return;

    let text = "PRISMA 2020 Flow Diagram Data\n";
    text += "=============================\n\n";

    const formatNode = (node: PrismaNodeResponse, indent = "") => {
      let line = `${indent}- ${PRISMA_STAGE_LABELS[node.stage] || node.stage}: n=${node.total.toLocaleString()}\n`;
      if (node.breakdown && node.breakdown.length > 0) {
        node.breakdown.forEach((b) => {
          line += `${indent}    * ${b.label}: n=${b.count.toLocaleString()}\n`;
        });
      }
      if (node.reasons && node.reasons.length > 0) {
        line += `${indent}    [Reasons for exclusion]\n`;
        node.reasons.forEach((r) => {
          line += `${indent}    * ${r.label}: n=${r.count.toLocaleString()}\n`;
        });
      }
      if (node.sideBox) {
        line += `${indent}    > Side Box: ${PRISMA_STAGE_LABELS[node.sideBox.stage] || node.sideBox.stage}: n=${node.sideBox.total.toLocaleString()}\n`;
        if (node.sideBox.breakdown && node.sideBox.breakdown.length > 0) {
          node.sideBox.breakdown.forEach((b) => {
            line += `${indent}        * ${b.label}: n=${b.count.toLocaleString()}\n`;
          });
        }
      }
      return line;
    };

    text += "Identification\n";
    nodes
      ?.filter((n) =>
        ["RecordsIdentified", "DuplicateRecordsRemoved"].includes(n.stage),
      )
      .forEach((n) => (text += formatNode(n, "  ")));

    text += "\nScreening & Eligibility\n";
    nodes
      ?.filter(
        (n) =>
          !["RecordsIdentified", "DuplicateRecordsRemoved"].includes(n.stage),
      )
      .forEach((n) => (text += formatNode(n, "  ")));

    if (includedNode) {
      text += "\nStudies Included\n";
      text += formatNode(includedNode, "  ");
    }

    navigator.clipboard.writeText(text);
    toastSuccess("Numbers copied to clipboard");
  };

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-3 lg:w-auto lg:flex-nowrap">
      {/* Generate / Regenerate button */}
      {canGenerate && (
        <Button
          onClick={onGenerate}
          disabled={isGenerating || cooldown > 0}
          className="inline-flex gap-2"
        >
          <FiRefreshCw
            className={`w-4 h-4 ${isGenerating ? "motion-safe:animate-spin motion-reduce:animate-none" : ""}`}
          />
          {isGenerating
            ? "Generating…"
            : cooldown > 0
              ? `Wait ${cooldown}s`
              : hasReport
                ? "Regenerate Report"
                : "Generate PRISMA Report"}
        </Button>
      )}

      {/* Report exports need a snapshot; the project package is independent of it. */}
      <div className="flex min-w-0 max-w-full flex-wrap items-center overflow-hidden rounded-xl border border-border/70 shadow-none">
        <button
          type="button"
          onClick={onDownloadProjectPackage}
          aria-label="Export complete project as an SLR package"
          title="Download complete project package (.slr)"
          disabled={!onDownloadProjectPackage || isExportingProjectPackage}
          className="inline-flex min-h-11 items-center gap-1.5 px-3 py-3 text-sm font-medium text-text-primary bg-surface-white hover:bg-bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 motion-safe:transition-colors motion-reduce:transition-none"
        >
          <FiArchive className={`h-4 w-4 ${isExportingProjectPackage ? "motion-safe:animate-pulse motion-reduce:animate-none" : ""}`} />
          <span className="sm:hidden">{isExportingProjectPackage ? "Preparing…" : ".slr"}</span>
          <span className="hidden sm:inline">{isExportingProjectPackage ? "Preparing package…" : "Export .slr"}</span>
        </button>
        <button
          type="button"
          onClick={onDownloadWritingExport}
          aria-label="Download structured PRISMA data for writing as JSON"
          title="Download structured PRISMA data for writing (.json)"
          className="inline-flex min-h-11 items-center gap-1.5 px-3 py-3 text-sm text-text-primary bg-surface-white hover:bg-bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 motion-safe:transition-colors motion-reduce:transition-none"
        >
          <FiFileText className="w-4 h-4" />
          <span className="sm:hidden">JSON</span>
          <span className="hidden sm:inline">Writing JSON</span>
        </button>
        <button
          onClick={handleExportPNG}
          type="button"
          aria-label="Export PRISMA diagram as PNG"
          disabled={!hasReport}
          title="Export as PNG"
          className="inline-flex min-h-11 items-center gap-1.5 px-3 py-3 text-sm text-text-primary bg-surface-white hover:bg-bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 disabled:opacity-40 disabled:cursor-not-allowed motion-safe:transition-colors motion-reduce:transition-none"
        >
          <FiImage className="w-4 h-4" />
          <span className="sm:hidden">PNG</span>
          <span className="hidden sm:inline">PNG</span>
        </button>

        <button
          type="button"
          onClick={handleExportPDF}
          aria-label="Export PRISMA diagram as PDF"
          disabled={!hasReport}
          title="Export as PDF (print)"
          className="inline-flex min-h-11 items-center gap-1.5 px-3 py-3 text-sm text-text-primary bg-surface-white border-l border-border hover:bg-bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 disabled:opacity-40 disabled:cursor-not-allowed motion-safe:transition-colors motion-reduce:transition-none"
        >
          <FiFileText className="w-4 h-4" />
          <span className="sm:hidden">PDF</span>
          <span className="hidden sm:inline">PDF</span>
        </button>

        <button
          type="button"
          onClick={onDownloadDiagram}
          aria-label="Download PRISMA flow diagram as Word document"
          disabled={!hasReport || isDownloading}
          title="Download PRISMA Flow Diagram (.docx)"
          className="inline-flex min-h-11 items-center gap-1.5 px-3 py-3 text-sm text-text-primary bg-surface-white border-l border-border hover:bg-bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 disabled:opacity-40 disabled:cursor-not-allowed motion-safe:transition-colors motion-reduce:transition-none font-medium shadow-none"
        >
          <FiFileText
            className={`w-4 h-4 ${isDownloading ? "motion-safe:animate-pulse motion-reduce:animate-none" : ""}`}
          />
          <span className="sm:hidden">Word</span>
          <span className="hidden sm:inline">
            {isDownloading ? "Downloading…" : "Word"}
          </span>
        </button>

        <button
          type="button"
          onClick={handleCopyNumbers}
          aria-label="Copy PRISMA numbers"
          disabled={!hasReport}
          title="Copy numbers to clipboard"
          className="inline-flex min-h-11 items-center gap-1.5 px-3 py-3 text-sm text-text-primary bg-surface-white border-l border-border hover:bg-bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 disabled:opacity-40 disabled:cursor-not-allowed motion-safe:transition-colors motion-reduce:transition-none"
        >
          <FiCopy className="w-4 h-4" />
          <span className="sm:hidden">Copy</span>
          <span className="hidden sm:inline">Copy</span>
        </button>
      </div>

      {/* Version / timestamp badge */}
      {hasReport && version && (
        <div className="flex items-center gap-1.5 text-xs text-text-secondary ml-auto">
          <FiClock className="w-3.5 h-3.5" />
          <span>v{version}</span>
          {generatedAt && (
            <>
              <span className="text-text-secondary/40">·</span>
              <span>
                {new Date(generatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
