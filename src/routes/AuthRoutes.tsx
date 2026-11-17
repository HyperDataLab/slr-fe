import { Route, Routes, Navigate } from "react-router";
import LoginPage from "../pages/auth/LoginPage";
import PolicyPage from "../pages/auth/PolicyPage";
import SsoCallbackPage from "../pages/auth/SsoCallbackPage";

function AuthRoutes() {
  return (
    <Routes>
      <Route path="signin" element={<LoginPage />} />
      <Route path="sso/callback" element={<SsoCallbackPage />} />
      <Route path="policy" element={<PolicyPage />} />
      <Route index element={<Navigate to="signin" replace />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}

export default AuthRoutes;
