import { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router";
import Button from "../ui/Button";
import FormField from "../ui/FormField";
import { authService } from "../../services/authService";
import { login } from "../../redux/slices/authSlice";
import { toastSuccess, toastError } from "../../utils/toast";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY;
const isGoogleSignInConfigured = Boolean(
  GOOGLE_CLIENT_ID?.trim() && FIREBASE_API_KEY?.trim(),
);
const showQuickLogin = import.meta.env.DEV;

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        auto_select: boolean;
        cancel_on_tap_outside: boolean;
      }) => void;
      renderButton: (
        element: HTMLElement | null,
        options: {
          theme: string;
          size: string;
          width: number;
          text: string;
          shape: string;
            locale: string;
        },
      ) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

const normalizeGlobalRole = (role?: string | null) => {
  if (!role) return undefined;

  const normalizedRole = role.trim().toUpperCase();

  return normalizedRole === "ADMIN" ? "Admin" : role.trim() || undefined;
};

const LoginForm: React.FC = () => {
  const [keyLogin, setKeyLogin] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleButtonReady, setIsGoogleButtonReady] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const navigateAfterLogin = (role: string | undefined) => {
    const requestedPath = new URLSearchParams(location.search).get("returnTo");
    const safePath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/";
    navigate(role === "Admin" ? "/admin" : safePath);
  };

  const handleGoogleCredentialResponse = useCallback(
    async (response: GoogleCredentialResponse) => {
      setIsLoading(true);
      try {
        const res = await authService.googleLogin(response.credential);

        if (res.isSuccess) {
          const { accessToken, userId, username, email, role } = res.data;
          const normalizedRole = normalizeGlobalRole(role);

          dispatch(
            login({
              accessToken,
              accessTokenExpiresAt: res.data.accessTokenExpiresAt,
              user: {
                id: userId,
                name: username,
                email,
                username,
                role: normalizedRole,
              },
            }),
          );

          toastSuccess(
            "Welcome to Systematic Review Support System",
            `Hello ${username}`,
          );
          navigateAfterLogin(normalizedRole);
        } else {
          toastError(
            "Login Failed",
            res.message || "Google authentication was rejected. Please try again.",
          );
        }
      } catch (error) {
        toastError(
          "Google sign-in failed",
          error instanceof Error
            ? error.message
            : "Unknown Google authentication error. Please try again.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [dispatch, navigate],
  );

  useEffect(() => {
    if (!isGoogleSignInConfigured) return;

    let resizeObserver: ResizeObserver | undefined;
    let script = document.querySelector(
      'script[src^="https://accounts.google.com/gsi/client"]',
    ) as HTMLScriptElement;

    const initializeGoogleSignIn = () => {
      const google = window.google;
      if (google?.accounts?.id) {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        const buttonHost = document.getElementById("google-signin-btn");
        if (!buttonHost) return;

        let renderedWidth = 0;
        const renderGoogleButton = () => {
          const width = Math.min(400, Math.floor(buttonHost.clientWidth));
          if (!width || width === renderedWidth) return;

          renderedWidth = width;
          buttonHost.replaceChildren();
          google.accounts.id.renderButton(buttonHost, {
            theme: "outline",
            size: "large",
            width,
            text: "continue_with",
            shape: "rectangular",
            locale: "en",
          });
          setIsGoogleButtonReady(true);
        };

        resizeObserver = new ResizeObserver(renderGoogleButton);
        resizeObserver.observe(buttonHost);
        renderGoogleButton();
      }
    };

    if (!script) {
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client?hl=en";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
      script.onload = initializeGoogleSignIn;
    } else {
      initializeGoogleSignIn();
    }

    return () => resizeObserver?.disconnect();
  }, [handleGoogleCredentialResponse]);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!keyLogin.trim()) {
      newErrors.keyLogin = "Username or email is required";
    } else if (keyLogin.includes("@")) {
      if (!validateEmail(keyLogin)) {
        newErrors.keyLogin = "Please enter a valid email address";
      }
    }

    if (!password.trim()) {
      newErrors.password = "Password is required";
    } else if (/\s/.test(password)) {
      newErrors.password = "Spaces are not allowed in password";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const response = await authService.login({ keyLogin, password });

      if (response.isSuccess) {
        const { accessToken, userId, username, email, role } = response.data;
        const normalizedRole = normalizeGlobalRole(role);

        dispatch(
          login({
            accessToken,
            accessTokenExpiresAt: response.data.accessTokenExpiresAt,
            user: {
              id: userId,
              name: username,
              email,
              username,
              role: normalizedRole,
            },
          }),
        );

        toastSuccess(
          "Welcome to Systematic Review Support System",
          `Hello ${response.data.username}`,
        );
        navigateAfterLogin(normalizedRole);
      } else {
        toastError(
          "Login Failed",
          "Your account does not exist or invalid credentials.",
        );

        // Map backend errors if specific fields are provided
        const fieldErrors: Record<string, string> = {};
        response.errors?.forEach((err) => {
          if (err.code.toLowerCase().includes("password"))
            fieldErrors.password = err.message;
          if (
            err.code.toLowerCase().includes("keylogin") ||
            err.code.toLowerCase().includes("username") ||
            err.code.toLowerCase().includes("email")
          ) {
            fieldErrors.keyLogin = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    } catch {
      toastError(
        "Error",
        "Your account does not exist or invalid credentials.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (account: "admin" | "leader" | "reviewer") => {
    setIsLoading(true);
    try {
      const response = await authService.quickLogin(account);
      if (!response.isSuccess) {
        throw new Error("Quick login failed");
      }

      const { accessToken, userId, username, email, role } = response.data;
      const normalizedRole = normalizeGlobalRole(role);
      dispatch(
        login({
          accessToken,
          accessTokenExpiresAt: response.data.accessTokenExpiresAt,
          user: { id: userId, name: username, email, username, role: normalizedRole },
        }),
      );
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
      {/* Heading */}
      <div className="mb-7 w-full text-center">
        <h2 className="mb-3 text-[28px] font-semibold leading-tight tracking-[-0.01em] text-text-primary sm:text-[32px]">
          Welcome back
        </h2>
        <p className="text-text-secondary text-base leading-relaxed">
          Sign in to continue to your account
        </p>
      </div>

      {/* Sign-in Card */}
      <div className="w-full rounded-2xl border border-border bg-surface-white p-5 shadow-[0_1px_3px_rgba(18,35,49,0.06)] sm:p-8">
        {/* Login Form */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <FormField
            id="keyLogin"
            label="Email / Username"
            type="text"
            autoComplete="username"
            placeholder="Enter email or username"
            value={keyLogin}
            onChange={(e) =>
              setKeyLogin(e.target.value.replace(/[^a-zA-Z0-9@._\-+]/g, ""))
            }
            errorMessage={errors.keyLogin}
            disabled={isLoading}
            className="h-12"
          />

          {/* Password Field */}
          <FormField
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value.replace(/\s/g, ""))}
            errorMessage={errors.password}
            disabled={isLoading}
            className="h-12"
          />

          <div className="pt-1">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={isLoading}
            >
              Sign In
            </Button>
          </div>
        </form>

        {showQuickLogin && (
          <div className="mt-6">
            <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-[0.12em] text-text-secondary">
              Quick login (development)
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="!min-h-11 w-full !px-1 text-[10px] sm:!px-3 sm:text-[11px]"
                disabled={isLoading}
                onClick={() => void handleQuickLogin("admin")}
              >
                Admin
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="!min-h-11 w-full !px-1 text-[10px] sm:!px-3 sm:text-[11px]"
                disabled={isLoading}
                onClick={() => void handleQuickLogin("leader")}
              >
                Leader
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="!min-h-11 w-full !px-1 text-[10px] sm:!px-3 sm:text-[11px]"
                disabled={isLoading}
                onClick={() => void handleQuickLogin("reviewer")}
              >
                Reviewer
              </Button>
            </div>
          </div>
        )}

        {isGoogleSignInConfigured && (
          <>
            {isGoogleButtonReady && (
              <div className="my-6 flex items-center gap-3" role="separator" aria-label="Or">
                <div className="min-w-0 flex-1 border-t border-border" />
                <span className="bg-surface-white px-1 text-[11px] font-medium uppercase tracking-[0.12em] leading-none text-text-secondary">
                  Or
                </span>
                <div className="min-w-0 flex-1 border-t border-border" />
              </div>
            )}
            <div
              id="google-signin-btn"
              className={`google-signin-button w-full max-w-[400px] ${isGoogleButtonReady ? "" : "fixed left-[-10000px] top-0 w-[400px]"}`}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default LoginForm;
