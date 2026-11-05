import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../redux/store";
import AdminProfileRedirect from "../components/profile/AdminProfileRedirect";
import MainLayout from "../layouts/MainLayout";
import ProjectLayout from "../layouts/ProjectLayout";
import ProtectedRoute from "./ProtectedRoute";
import ProtectedRouteForProject from "../components/routes/ProtectedRouteForProject";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ErrorBoundary from "../components/common/ErrorBoundary";

// Lazy loaded page components
const HomePage = lazy(() => import("../pages/home/HomePage"));
const ProjectListPage = lazy(() => import("../pages/projects/ProjectListPage"));
const ProjectDetailPage = lazy(() => import("../pages/projects/ProjectDetailPage"));
const ProjectSettingsPage = lazy(() => import("../pages/projects/ProjectSettingsPage"));
const ReviewProcessWorkspace = lazy(() => import("../pages/reviewProcess/ReviewProcessWorkspace"));
const IdentificationPhaseWorkspace = lazy(() => import("../pages/reviewProcess/IdentificationPhaseWorkspace"));
const PrismaReportWorkspace = lazy(() => import("../pages/reviewProcess/prismaReport/PrismaReportWorkspace"));
const CanonicalReviewPhaseRoute = lazy(() => import("../pages/reviewProcess/CanonicalReviewPhaseRoute"));
const FullTextScreeningWorkspace = lazy(() => import("../pages/reviewProcess/studySelection/fullTextScreening/FullTextScreeningWorkspace"));
const QualityAssessmentWorkspace = lazy(() => import("../pages/reviewProcess/qualityAssessment/QualityAssessmentWorkspace"));
const SynthesisPhaseWorkspace = lazy(() => import("../pages/reviewProcess/synthesisExecution/SynthesisPhaseWorkspace"));
const CanonicalSynthesisRoute = lazy(() => import("../pages/reviewProcess/synthesisExecution/CanonicalSynthesisRoute"));
const InvitationDetailPage = lazy(() => import("../pages/invitations/InvitationDetailPage"));
const DataExtractionPhaseWorkspace = lazy(() => import("../pages/reviewProcess/dataExtraction/DataExtractionPhaseWorkspace"));
const ExtractionGridWorkspace = lazy(() => import("../pages/reviewProcess/dataExtraction/components/gridWorkspace/ExtractionGridWorkspace"));
const MyProfilePage = lazy(() => import("../pages/profile/MyProfilePage"));
const ApiKeysPage = lazy(() => import("../pages/profile/ApiKeysPage"));
const RepositoryApiDocsPage = lazy(() => import("../pages/developer/RepositoryApiDocsPage"));
const ChecklistDashboardWrapper = lazy(() => import("../pages/checklist/ChecklistDashboardWrapper"));
const ChecklistEditorPage = lazy(() => import("../pages/checklist/ChecklistEditorPage"));
const ProjectAuditLogPage = lazy(() => import("../pages/projects/ProjectAuditLogPage"));
const PaperDetailsPage = lazy(() => import("../pages/projects/PaperDetailsPage"));
const ManageStudySelectionPage = lazy(() => import("../pages/manage-study-selection/ManageStudySelectionPage"));
const ScreeningPhaseRouter = lazy(() => import("../pages/reviewProcess/studySelection/ScreeningPhaseRouter"));
const StuSePaperStatisticPage = lazy(() => import("../pages/manage-study-selection/StuSePaperStatisticPage"));
const NotificationCenterPage = lazy(() => import("../pages/notifications/NotificationCenterPage"));
const SharedRepositoryPage = lazy(() => import("../pages/sharedRepository/SharedRepositoryPage"));
const MyIssueReportsPage = lazy(() => import("../pages/issueReports/MyIssueReportsPage"));
const PaperAssetDetailPage = lazy(() => import("../pages/admin/PaperAssetDetailPage"));

function MainRoutes() {
  const { user } = useSelector((state: RootState) => state.auth);
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-bg-primary">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<MainLayout />}>
          {/* Home Page */}
          <Route index element={<HomePage />} />
          <Route path="repository-api-docs" element={<RepositoryApiDocsPage />} />

          {/* Profile Page */}
          <Route
            path="profile"
            element={
              user?.role === "Admin" ? (
                <AdminProfileRedirect />
              ) : (
                <MyProfilePage />
              )
            }
          />
          <Route element={<ProtectedRoute />}>
            <Route path="profile/api-keys" element={<ApiKeysPage />} />
          </Route>

          {/* Project Routes */}
          <Route>
            <Route element={<ProtectedRoute />}>
              <Route path="notifications" element={<NotificationCenterPage />} />
              <Route path="shared-repository" element={<SharedRepositoryPage />} />
              <Route path="shared-repository/:paperId/details" element={<PaperAssetDetailPage />} />
              <Route path="issue-reports" element={<MyIssueReportsPage />} />
              <Route path="projects" element={<ProjectLayout />}>
              <Route index element={<ProjectListPage />} />

              {/* Checklist Routes */}
              <Route
                path=":projectId/checklists"
                element={
                  <ErrorBoundary
                    fallbackTitle="Không thể tải Checklist"
                    fallbackMessage="Đã xảy ra lỗi khi hiển thị bảng quản lý Checklist."
                  >
                    <ChecklistDashboardWrapper />
                  </ErrorBoundary>
                }
              />
              <Route
                path=":projectId/checklists/:checklistId"
                element={
                  <ErrorBoundary
                    fallbackTitle="Không thể tải nội dung Checklist"
                    fallbackMessage="Đã xảy ra lỗi khi tải trình chỉnh sửa Checklist."
                  >
                    <ChecklistEditorPage />
                  </ErrorBoundary>
                }
              />

              <Route path=":id/settings" element={<ProjectSettingsPage />} />
              <Route path=":id/*" element={<ProjectDetailPage />} />

              {/* Canonical Project-Centric Routes (FR-G0-01) */}
              <Route path=":projectId/identification" element={<CanonicalReviewPhaseRoute phase="identification" />} />
              <Route path=":projectId/screening" element={<CanonicalReviewPhaseRoute phase="screening" />} />
              <Route path=":projectId/screening/dashboard" element={<CanonicalReviewPhaseRoute phase="screening-dashboard" />} />
              <Route path=":projectId/screening/assignment-management" element={<CanonicalReviewPhaseRoute phase="assignment-management" />} />
              <Route path=":projectId/screening/full-text" element={<CanonicalReviewPhaseRoute phase="full-text" />} />
              <Route path=":projectId/quality-assessment" element={<CanonicalReviewPhaseRoute phase="quality-assessment" />} />
              <Route path=":projectId/extraction" element={<DataExtractionPhaseWorkspace />} />
              <Route path=":projectId/extraction/workspace/:studyId" element={<DataExtractionPhaseWorkspace />} />
              <Route path=":projectId/extraction/grid" element={<ExtractionGridWorkspace />} />
              <Route path=":projectId/synthesis/*" element={<CanonicalSynthesisRoute />} />
              <Route path=":projectId/prisma-report" element={<PrismaReportWorkspace />} />

              {/* Review Process Workspace (Legacy paths kept for backward compatibility) */}
              <Route
                path=":projectId/processes/:processId"
                element={<ReviewProcessWorkspace />}
              />

              {/* Identification Phase — Leader and Member */}
              <Route
                element={
                  <ProtectedRouteForProject
                    allowedRoles={["OWNER", "ADMIN", 1, 2]}
                    redirectTo="/projects"
                    forbiddenTo="/projects"
                  />
                }
              >
                <Route
                  path=":projectId/processes/:processId/identification/:identificationPhaseId"
                  element={<IdentificationPhaseWorkspace />}
                />
              </Route>

              <Route
                path=":projectId/processes/:processId/screening/:screeningProcessId"
                element={
                  <ProtectedRouteForProject
                    allowedRoles={[1, 3]}
                    redirectTo="/projects"
                  />
                }
              >
                <Route index element={<ScreeningPhaseRouter />} />
                <Route path="papers/:paperId" element={<ScreeningPhaseRouter />} />
                <Route path="dashboard" element={<ScreeningPhaseRouter />} />
                <Route path="assignment-management" element={<ManageStudySelectionPage />} />
              </Route>

              <Route
                path=":projectId/processes/:processId/screening/:screeningProcessId/papers-statistic"
                element={
                  <ProtectedRouteForProject
                    allowedRoles={[1]}
                    redirectTo="/projects"
                  />
                }
              >
                <Route index element={<StuSePaperStatisticPage />} />
              </Route>

              <Route
                path=":projectId/processes/:processId/full-text-screening/:screeningProcessId"
                element={<FullTextScreeningWorkspace />}
              />
              <Route
                path=":projectId/processes/:processId/full-text-screening/:screeningProcessId/papers/:paperId"
                element={<FullTextScreeningWorkspace />}
              />
              {/* Quality Assessment Workspace */}
              <Route
                path=":projectId/processes/:processId/quality-assessment/:qualityAssessmentId"
                element={<QualityAssessmentWorkspace />}
              />
              <Route
                path=":projectId/processes/:processId/synthesis/*"
                element={<SynthesisPhaseWorkspace />}
              />
              <Route
                path=":projectId/processes/:processId/prisma-report"
                element={<PrismaReportWorkspace />}
              />
              <Route
                path=":projectId/papers/:paperId"
                element={<PaperDetailsPage />}
              />
              <Route path=":id/audit-logs" element={<ProjectAuditLogPage />} />
              </Route>
            </Route>

            {/* Invitation Routes */}
            <Route path="invitations">
              <Route path=":invitationId" element={<InvitationDetailPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/404" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default MainRoutes;
