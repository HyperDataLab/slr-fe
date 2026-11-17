import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router";
import { login } from "../../redux/slices/authSlice";
import { authService } from "../../services/authService";
import AuthLayout from "../../components/auth/AuthLayout";

const normalizeGlobalRole = (role?: string | null) =>
  role?.trim().toUpperCase() === "ADMIN" ? "Admin" : role?.trim() || undefined;

function SsoCallbackPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code") || "";
    const state = params.get("state") || "";
    const providerError = params.get("error");
    window.history.replaceState({}, document.title, window.location.pathname);

    if (providerError) {
      authService.cancelSsoSignIn();
      setError("Google Workspace sign-in was not completed. Please try again.");
      return;
    }

    void authService.finishSsoSignIn(code, state)
      .then((response) => {
        const { accessToken, accessTokenExpiresAt, userId, username, email, role } = response.data;
        const normalizedRole = normalizeGlobalRole(role);
        dispatch(login({
          accessToken,
          accessTokenExpiresAt,
          user: { id: userId, name: username, email, username, role: normalizedRole },
        }));
        const returnTo = authService.consumeSsoReturnTo();
        navigate(normalizedRole === "Admin" ? "/admin" : returnTo, { replace: true });
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Google Workspace sign-in failed. Please try again.");
      });
  }, [dispatch, navigate]);

  return (
    <AuthLayout>
      <div className="flex min-h-64 w-full flex-col items-center justify-center gap-4 text-center">
        {error ? (
          <>
            <h2 className="text-xl font-semibold text-text-primary">Sign-in could not be completed</h2>
            <p className="max-w-md text-sm text-text-secondary">{error}</p>
            <Link className="text-sm font-medium text-primary underline" to="/auth/signin">
              Return to sign in
            </Link>
          </>
        ) : (
          <>
            <div className="h-10 w-10 motion-safe:animate-spin motion-reduce:animate-none rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-text-secondary">Completing Google Workspace sign-in…</p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}

export default SsoCallbackPage;
