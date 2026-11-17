import { useState } from "react";
import { useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router";
import Button from "../ui/Button";
import { authService } from "../../services/authService";
import { login } from "../../redux/slices/authSlice";
import { toastSuccess, toastError } from "../../utils/toast";

const showQuickLogin = import.meta.env.DEV;

const normalizeGlobalRole = (role?: string | null) =>
  role?.trim().toUpperCase() === "ADMIN" ? "Admin" : role?.trim() || undefined;

const LoginForm: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const navigateAfterLogin = (role: string | undefined) => {
    const requestedPath = new URLSearchParams(location.search).get("returnTo");
    const safePath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/";
    navigate(role === "Admin" ? "/admin" : safePath);
  };

  const handleSsoSignIn = async () => {
    setIsLoading(true);
    try {
      await authService.startSsoSignIn(new URLSearchParams(location.search).get("returnTo") || undefined);
    } catch (error) {
      toastError(
        "Google Workspace sign-in unavailable",
        error instanceof Error ? error.message : "Please try again later.",
      );
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (account: "admin" | "leader" | "reviewer") => {
    setIsLoading(true);
    try {
      const response = await authService.quickLogin(account);
      if (!response.isSuccess) throw new Error("Quick login failed");

      const { accessToken, accessTokenExpiresAt, userId, username, email, role } = response.data;
      const normalizedRole = normalizeGlobalRole(role);
      dispatch(login({
        accessToken,
        accessTokenExpiresAt,
        user: { id: userId, name: username, email, username, role: normalizedRole },
      }));
      toastSuccess("Welcome to Systematic Review Support System", `Hello ${username}`);
      navigateAfterLogin(normalizedRole);
    } catch {
      toastError("Quick Login Failed", "Check that development authentication is enabled on the server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex w-full flex-col items-center">
      <div className="mb-7 w-full text-center">
        <h2 className="mb-3 text-[28px] font-semibold leading-tight tracking-[-0.01em] text-text-primary sm:text-[32px]">
          Welcome back
        </h2>
        <p className="text-text-secondary text-base leading-relaxed">
          Sign in with your Google Workspace account to continue
        </p>
      </div>

      <div className="w-full rounded-2xl border border-border bg-surface-white p-5 shadow-[0_1px_3px_rgba(18,35,49,0.06)] sm:p-8">
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="w-full"
          isLoading={isLoading}
          disabled={!authService.isSsoConfigured() || isLoading}
          onClick={() => void handleSsoSignIn()}
        >
          Continue with Google Workspace
        </Button>

        {!authService.isSsoConfigured() && (
          <p className="mt-3 text-center text-sm text-text-secondary">
            SSO client configuration is required to enable sign-in.
          </p>
        )}

        {showQuickLogin && (
          <div className="mt-6 border-t border-border pt-5">
            <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-[0.12em] text-text-secondary">
              Quick login (development)
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {(["admin", "leader", "reviewer"] as const).map((account) => (
                <Button
                  key={account}
                  type="button"
                  variant="secondary"
                  size="md"
                  className="!min-h-11 w-full !px-1 text-[10px] sm:!px-3 sm:text-[11px]"
                  disabled={isLoading}
                  onClick={() => void handleQuickLogin(account)}
                >
                  {account[0].toUpperCase() + account.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginForm;
