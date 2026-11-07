// PRISMA Report Workspace — Slim orchestrator page
// Wires the usePrismaReport hook to section components.

import { useParams, useNavigate } from "react-router";
import { useSelector } from "react-redux";
import { useRef, useCallback, useState, useEffect } from "react";
import { toastInfo, toastSuccess } from "../../../utils/toast";
import type { RootState } from "../../../redux/store";
import { usePrismaReport } from "../../../hooks/usePrismaReport";
import { FiClipboard, FiAlertCircle, FiArrowLeft } from "react-icons/fi";

import PrismaReportHeader from "./sections/PrismaReportHeader";
// import PrismaExportActions from "./sections/PrismaExportActions";
import PrismaSummaryHeader from "./sections/PrismaSummaryHeader";
import PrismaFlowDiagram, {
  type PrismaFlowDiagramRef,
} from "./sections/PrismaFlowDiagram";
import PrismaExclusionTable from "./sections/PrismaExclusionTable";
import PrismaReportHistory from "./sections/PrismaReportHistory";
import PrismaExportActions from "./sections/PrismaExportActions";
import PrismaSourceClassification from "./sections/PrismaSourceClassification";
import Button from "../../../components/ui/Button";
import { useProjectMember } from "../../../hooks/useProjectMember";
import prismaReportService from "../../../services/prismaReportService";

export default function PrismaReportWorkspace() {
  const { projectId, processId } = useParams<{
    projectId: string;
    processId: string;
  }>();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const diagramRef = useRef<PrismaFlowDiagramRef>(null);
  const effectiveProjectId = projectId || processId || "";

  const handleExportPNG = useCallback(() => {
    diagramRef.current?.exportImage();
  }, []);

  const handleDownloadWritingExport = useCallback(async () => {
    try {
      const blob = await prismaReportService.downloadWritingExport(effectiveProjectId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `prisma-writing-${effectiveProjectId}.json`;
      link.click();
      window.URL.revokeObjectURL(url);
      toastSuccess("Writing data downloaded");
    } catch {
      toastInfo("Could not download the writing data. Try again.");
    }
  }, [effectiveProjectId]);

  // Saving a snapshot is the leader's job; every member can read and export one.
  const { member } = useProjectMember(effectiveProjectId);
  const canGenerate = member?.isLeader ?? false;

  const {
    latestReport,
    activeReport,
    reportHistory,
    summaryStats,
    nodes,
    includedNode,
    hasReport,
    isLoadingLatest,
    isLoadingHistory,
    historyError,
    isGenerating,
    isDownloading,
    isLoadingSelected,
    latestError,
    generateError,
    selectedError,
    isViewingHistorical,
    activeReportId,
    generateReport,
    selectReport,
    clearSelection,
    fetchReportHistory,
    downloadPrismaDiagram,
    refreshAll,
  } = usePrismaReport({ reviewProcessId: effectiveProjectId });

  // React Query fetches on mount automatically — no useEffect needed

  const [cooldown, setCooldown] = useState(0);
  const [isExportingProjectPackage, setIsExportingProjectPackage] = useState(false);

  const handleDownloadProjectPackage = useCallback(async () => {
    if (!projectId || isExportingProjectPackage) return;
    setIsExportingProjectPackage(true);
    try {
      const blob = await prismaReportService.downloadProjectPackage(projectId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `slr-project-${projectId}.slr`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toastSuccess("Project package downloaded");
    } catch {
      toastInfo("Could not export the project package. Try again.");
    } finally {
      setIsExportingProjectPackage(false);
    }
  }, [projectId, isExportingProjectPackage]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleBack = () => {
    if (projectId && processId) {
      navigate(`/projects/${projectId}/processes/${processId}`);
    } else {
      navigate(`/projects/${effectiveProjectId}`);
    }
  };

  const handleGenerate = async () => {
    if (cooldown > 0 || isGenerating) return;
    setCooldown(5);

    const nextVersion = latestReport
      ? (Math.round((Number(latestReport.version) + 0.1) * 10) / 10).toFixed(1)
      : "1.0";
    const result = await generateReport({
      version: nextVersion,
      notes: "Generated from PRISMA Report workspace",
      generatedBy: user?.name ?? user?.email ?? undefined,
    });
    
    if (result) {
      if (result.id === latestReport?.id) {
        toastInfo("PRISMA diagram is already up-to-date with current review data.");
      } else {
        toastSuccess(`Generated PRISMA Report v${result.version}`);
      }
    }
  };

  const handleSelectReport = (reportId: string) => {
    // If clicking the report that's already active, do nothing
    if (reportId === activeReportId) return;
    // If clicking the latest report, clear selection instead
    if (reportId === latestReport?.id) {
      clearSelection();
      return;
    }
    selectReport(reportId);
  };

  const isLoading = isLoadingLatest || isLoadingSelected;

  return (
    <div className="min-h-screen bg-surface-white print:bg-surface-white">
      {/* ── Sticky Header ── */}
      <PrismaReportHeader>
        <PrismaExportActions
          hasReport={hasReport}
          isGenerating={isGenerating}
          isDownloading={isDownloading}
          cooldown={cooldown}
          canGenerate={canGenerate}
          onGenerate={handleGenerate}
          onDownloadDiagram={downloadPrismaDiagram}
          onDownloadWritingExport={() => void handleDownloadWritingExport()}
          onDownloadProjectPackage={projectId ? () => void handleDownloadProjectPackage() : undefined}
          isExportingProjectPackage={isExportingProjectPackage}
          onExportPNG={handleExportPNG}
          nodes={nodes}
          includedNode={includedNode}
          version={activeReport?.version}
          generatedAt={activeReport?.generatedAt}
        />
      </PrismaReportHeader>

      {/* ── Main Content ── */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-6">
        <button
          type="button"
          onClick={handleBack}
          className="-ml-2 inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm text-text-secondary transition-colors hover:bg-bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 motion-reduce:transition-none"
        >
          <FiArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to project
        </button>
        <PrismaSourceClassification projectId={effectiveProjectId} />
        {/* Error banner */}
        {(latestError || generateError || selectedError) && (
          <div
            className="flex items-start gap-3 rounded-xl border border-error/20 bg-error/5 p-4"
            role="alert"
          >
            <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-error" />
            <div>
              <p className="text-sm font-medium text-error">
                {latestError || generateError || selectedError}
              </p>
              <button
                onClick={refreshAll}
                className="mt-1 inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-error underline motion-safe:transition-colors motion-reduce:transition-none hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Historical version banner */}
        {isViewingHistorical && activeReport && (
          <div className="flex flex-wrap items-start gap-3 rounded-xl border border-warning/25 bg-warning/5 p-4">
            <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary">
                Viewing historical report — Version {activeReport.version}
                {activeReport.generatedAt && (
                  <span className="font-normal text-text-secondary">
                    {" "}
                    generated on{" "}
                    {new Date(activeReport.generatedAt).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={clearSelection}
              className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-warning/25 bg-surface-white px-3 py-2 text-sm font-medium text-text-primary motion-safe:transition-colors motion-reduce:transition-none hover:bg-warning/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/40 sm:w-auto"
            >
              <FiArrowLeft className="w-3.5 h-3.5" />
              Back to latest
            </button>
          </div>
        )}

        {/* Empty state — no report yet */}
        {!isLoading && !hasReport && !latestError && (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-primary-light flex items-center justify-center">
              <FiClipboard className="w-8 h-8 text-accent" />
            </div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">
              No PRISMA Report Generated
            </h2>
            <p className="text-sm text-text-secondary max-w-md mx-auto mb-6">
              Generate a PRISMA 2020 flow diagram report to visualise the
              current state of your systematic review pipeline. The report is a
              snapshot calculated from your review data.
            </p>
            {canGenerate ? (
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                size="lg"
                className="inline-flex gap-2"
              >
                {isGenerating ? "Generating…" : "Generate PRISMA Report"}
              </Button>
            ) : (
              <p className="text-sm font-medium text-text-secondary">
                The project leader has not generated a PRISMA report yet.
              </p>
            )}
          </div>
        )}

        {/* Report content (visible when report exists or loading) */}
        {(isLoading || hasReport) && (
          <>
            {/* Report overview */}
            <PrismaSummaryHeader
              stats={summaryStats}
              isLoading={isLoading}
              generatedAt={activeReport?.generatedAt}
            />

            {/* Flow diagram — core visual */}
            <section className="bg-surface-white border border-border rounded-xl p-4 sm:p-5 print:shadow-none print:border-0">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-text-primary mb-1">
                  PRISMA 2020 Flow Diagram
                </h2>
                <p className="text-xs sm:text-sm text-text-secondary">
                  Preferred Reporting Items for Systematic Reviews and Meta-Analyses
                </p>
              </div>
              <PrismaFlowDiagram
                ref={diagramRef}
                nodes={nodes}
                includedNode={includedNode}
                isLoading={isLoading}
              />
            </section>

            {/* Bottom grid: Exclusion table + Report history */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5 items-start">
              <div className="lg:col-span-3 bg-surface-white border border-border rounded-xl p-4 sm:p-5">
                <PrismaExclusionTable nodes={nodes} isLoading={isLoading} />
              </div>
              <div className="lg:col-span-2 bg-surface-white border border-border rounded-xl p-4 sm:p-5">
                <PrismaReportHistory
                  reports={reportHistory}
                  isLoading={isLoadingHistory}
                  error={historyError}
                  onRetry={() => void fetchReportHistory()}
                  activeReportId={activeReportId}
                  onSelectReport={handleSelectReport}
                />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
