import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminOverview from "../pages/admin/AdminOverview";
import AuditLogPage from "../pages/admin/AuditLogPage";
import SLRProjectManagement from "../pages/admin/SLRProjectManagement";
import ProtectedRoute from "./ProtectedRoute";
import UserManagement from "../pages/admin/UserManagement";
import MasterSourcePage from "../pages/admin/MasterSourcePage";
import SystemSettings from "../pages/admin/SystemSettings";
import TemplateManager from "../pages/admin/TemplateManager";
import MyProfilePage from "../pages/profile/MyProfilePage";
import AgentManagement from "../pages/admin/AgentManagement";
import QualityCriteriaTemplates from "../pages/admin/QualityCriteriaTemplates";
import RepositoryApiClientsPage from "../pages/admin/RepositoryApiClientsPage";
import PaperAssetsPage from "../pages/admin/PaperAssetsPage";
import IssueReportsPage from "../pages/admin/IssueReportsPage";
import LoadingSpinner from "../components/ui/LoadingSpinner";

const NotificationCenterPage = lazy(() => import("../pages/notifications/NotificationCenterPage"));
const PaperAssetDetailPage = lazy(() => import("../pages/admin/PaperAssetDetailPage"));

function AdminRoutes() {
  return (
    <Routes>
      <Route element={<ProtectedRoute allowedRoles={["Admin"]} />}>
        <Route element={<AdminDashboard />}>
          <Route index element={<AdminOverview />} />
          <Route
            path="notifications"
            element={
              <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><LoadingSpinner size="lg" /></div>}>
                <NotificationCenterPage disableNavigation />
              </Suspense>
            }
          />
          <Route path="audit-logs" element={<AuditLogPage />} />
          <Route path="projects" element={<SLRProjectManagement />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="agents" element={<AgentManagement />} />
          <Route path="repository-api" element={<RepositoryApiClientsPage />} />
          <Route path="paper-files" element={<PaperAssetsPage />} />
          <Route path="issue-reports" element={<IssueReportsPage />} />
          <Route
            path="paper-files/repository/:paperId"
            element={(
              <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><LoadingSpinner size="lg" /></div>}>
                <PaperAssetDetailPage />
              </Suspense>
            )}
          />
          <Route
            path="paper-files/:projectId/:paperId"
            element={(
              <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><LoadingSpinner size="lg" /></div>}>
                <PaperAssetDetailPage />
              </Suspense>
            )}
          />
          <Route path="master-sources" element={<MasterSourcePage />} />
          <Route path="settings" element={<SystemSettings />} />
          <Route path="templates" element={<TemplateManager />} />
          <Route path="quality-criteria" element={<QualityCriteriaTemplates />} />
          <Route path="profile" element={<MyProfilePage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}

export default AdminRoutes;
