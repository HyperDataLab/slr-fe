import { Suspense, useState } from "react";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import ClientWorkspaceSidebar from "../components/layout/ClientWorkspaceSidebar";
import { Outlet, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../redux/store";
import AdminAccessGuard from "../components/auth/AdminAccessGuard";
import SectionGuard from "../components/auth/SectionGuard";
import SignalRConnectionManager from "../components/SignalRConnectionManager";
import { ClientWorkspaceSidebarContext } from "../contexts/ClientWorkspaceSidebarContext";
import LoadingSpinner from "../components/ui/LoadingSpinner";

export default function MainLayout() {
  const { pathname } = useLocation();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const isScreeningWorkspace =
    /\/projects\/[^/]+\/(?:processes\/[^/]+\/)?screening(?:\/|$)/.test(pathname);
  const isFullTextScreeningWorkspace = /\/full-text-screening(?:\/|$)/.test(pathname);
  const isReviewProcessDashboard = /\/projects\/[^/]+\/processes\/[^/]+\/?$/.test(pathname);
  const isDataExtractionWorkspace = /\/projects\/[^/]+\/processes\/[^/]+\/extraction(?:\/|$)/.test(pathname);
  const isQualityAssessmentWorkspace = /\/projects\/[^/]+\/(?:processes\/[^/]+\/)?quality-assessment(?:\/|$)/.test(pathname);
  const isSynthesisWorkspace = /\/projects\/[^/]+\/(?:processes\/[^/]+\/)?synthesis(?:\/|$)/.test(pathname);
  const isPrismaReportWorkspace = /\/projects\/[^/]+\/(?:processes\/[^/]+\/)?prisma-report(?:\/|$)/.test(pathname);
  const isChecklistEditorWorkspace = /\/projects\/[^/]+\/checklists\/[^/]+(?:\/|$)/.test(pathname);
  const isProjectsRoute = pathname === "/projects" || pathname.startsWith("/projects/");
  const isProjectListRoute = pathname === "/projects";
  const isViewportWorkspace = isScreeningWorkspace || isFullTextScreeningWorkspace || isChecklistEditorWorkspace || isQualityAssessmentWorkspace;
  const showHeader = isProjectListRoute || (!isScreeningWorkspace && !isFullTextScreeningWorkspace && !isReviewProcessDashboard &&
    !isDataExtractionWorkspace && !isQualityAssessmentWorkspace &&
    !isSynthesisWorkspace && !isPrismaReportWorkspace && !isChecklistEditorWorkspace && !isProjectsRoute);
  const showClientSidebar = isAuthenticated && (
    showHeader || isProjectsRoute || isReviewProcessDashboard || isScreeningWorkspace || isFullTextScreeningWorkspace ||
    isDataExtractionWorkspace || isQualityAssessmentWorkspace
  ) && (
    pathname === "/projects" || pathname.startsWith("/projects/") ||
    pathname === "/shared-repository" || pathname.startsWith("/shared-repository/") || pathname === "/profile" || pathname === "/issue-reports"
  );

  return (
    <div className={isViewportWorkspace ? "flex h-dvh min-h-0 overflow-hidden bg-bg-primary" : "flex min-h-screen bg-bg-primary"}>
      <SignalRConnectionManager />
      {showClientSidebar && (
        <ClientWorkspaceSidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
          isMobileOpen={isMobileSidebarOpen}
          onMobileClose={() => setIsMobileSidebarOpen(false)}
        />
      )}
      <div className={`${isViewportWorkspace ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" : "flex min-w-0 flex-1 flex-col"} ${showClientSidebar ? (isSidebarCollapsed ? "lg:ml-16" : "lg:ml-[216px]") : ""}`}>
        {showHeader && <Header onMenuClick={showClientSidebar ? () => setIsMobileSidebarOpen((open) => !open) : undefined} isSidebarOpen={isMobileSidebarOpen} hideAccountMenu={showClientSidebar} />}
        <main
          className={isViewportWorkspace
            ? "app-content min-h-0 flex-1 overflow-hidden overscroll-none"
            : `app-content flex-grow ${pathname === "/" ? "home-content" : "standard-content"}`}
        >
          <AdminAccessGuard />
          <SectionGuard section="client">
            <ClientWorkspaceSidebarContext.Provider value={() => setIsMobileSidebarOpen(true)}>
              <Suspense
                fallback={
                  <div className="flex min-h-48 flex-1 items-center justify-center" role="status" aria-label="Loading page">
                    <LoadingSpinner size="md" />
                  </div>
                }
              >
                <div
                  key={pathname}
                  className={`route-content-enter ${isViewportWorkspace ? "h-full min-h-0" : ""}`}
                >
                  <Outlet />
                </div>
              </Suspense>
            </ClientWorkspaceSidebarContext.Provider>
          </SectionGuard>
        </main>
        {!isViewportWorkspace && !isChecklistEditorWorkspace && <Footer />}
      </div>
    </div>
  );
}
