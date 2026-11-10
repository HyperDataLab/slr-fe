import { useEffect } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router";
import { useSelector, useDispatch } from "react-redux";
import { MotionConfig } from "framer-motion";
import store, { type RootState } from "./redux/store";
import {
  updateAccessToken,
  setInitialized,
  logout,
} from "./redux/slices/authSlice";
import { isTokenExpired } from "./utils/auth";
import "./App.css";
import AuthRoutes from "./routes/AuthRoutes";
import AdminRoutes from "./routes/AdminRoutes";
import MainRoutes from "./routes/MainRoutes";
import NotFoundPage from "./pages/not-found/NotFoundPage";
import { authService } from "./services/authService";
import ErrorBoundary from "./components/common/ErrorBoundary";
import SystemErrorPage from "./pages/system-error/SystemErrorPage";
import { SYSTEM_ERROR_EVENT } from "./utils/systemError";

function App() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, accessTokenExpiresAt, isInitialized } = useSelector(
    (state: RootState) => state.auth,
  );

  useEffect(() => {
    const handleSystemError = () => {
      if (location.pathname !== "/system-error") {
        const returnTo = `${location.pathname}${location.search}${location.hash}`;
        navigate("/system-error", {
          replace: true,
          state: { from: returnTo },
        });
      }
    };

    window.addEventListener(SYSTEM_ERROR_EVENT, handleSystemError);
    return () => window.removeEventListener(SYSTEM_ERROR_EVENT, handleSystemError);
  }, [location.hash, location.pathname, location.search, navigate]);

  useEffect(() => {
    // 3. Handle Expiration on App Initialization
    const CheckAuthentication = async () => {
      try {
        if (isAuthenticated && isTokenExpired(accessTokenExpiresAt)) {
          try {
            const response = await authService.refresh();

            if (response.isSuccess) {
              const { accessToken, accessTokenExpiresAt } = response.data;

              // Update the store, after this all requests will use the new token (axios apply access token from store before each request)
              store.dispatch(
                updateAccessToken({ accessToken, accessTokenExpiresAt }),
              );
            } else {
              dispatch(logout());
              console.log("Session expired.");
            }
          } catch {
            dispatch(logout());
            console.log("Session expired.");
          }
        }
      } finally {
        dispatch(setInitialized(true));
      }
    };
    CheckAuthentication();
  }, [isAuthenticated, accessTokenExpiresAt, dispatch, navigate]); // Added dependencies for clarity

  if (!isInitialized) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 motion-safe:animate-spin motion-reduce:animate-none rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-lg font-medium text-muted-foreground motion-safe:animate-pulse motion-reduce:animate-none">
            Initializing application...
          </p>
        </div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <Routes>
          <Route path="system-error" element={<SystemErrorPage />} />
          <Route path="auth/*" element={<AuthRoutes />} />
          <Route path="admin/*" element={<AdminRoutes />} />
          <Route path="404" element={<NotFoundPage />} />
          <Route path="*" element={<MainRoutes />} />
        </Routes>
      </ErrorBoundary>
    </MotionConfig>
  );
}

export default App;
