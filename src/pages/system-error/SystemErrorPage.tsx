import { useEffect, useRef, useState } from "react";
import { FiAlertTriangle, FiHome, FiRefreshCw } from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import "./SystemErrorPage.css";

interface SystemErrorPageProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

function SystemConnectionVisualization() {
  return (
    <svg
      className="system-error-visual"
      viewBox="0 0 360 132"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle className="system-error-pulse" cx="180" cy="66" r="43" />

      <path className="system-error-connection" d="M32 66h96" />
      <path className="system-error-connection system-error-connection-dashed" d="M232 66h32" />
      <path className="system-error-connection" d="m276 66 35-25" />
      <path className="system-error-connection system-error-connection-dashed" d="m276 66 35 25" />

      <circle className="system-error-node system-error-node-blue" cx="25" cy="66" r="7" />
      <circle className="system-error-node system-error-node-muted" cx="318" cy="36" r="6" />
      <circle className="system-error-node system-error-node-muted" cx="318" cy="96" r="6" />

      <path className="system-error-break" d="m266 59 7 7-7 7" />

      <rect className="system-error-server" x="145" y="31" width="70" height="70" rx="18" />
      <rect className="system-error-server-slot" x="162" y="48" width="36" height="8" rx="4" />
      <rect className="system-error-server-slot" x="162" y="63" width="36" height="8" rx="4" />
      <rect className="system-error-server-slot" x="162" y="78" width="36" height="8" rx="4" />
      <circle className="system-error-server-light" cx="190" cy="52" r="2" />
      <circle className="system-error-server-light" cx="190" cy="67" r="2" />
      <circle className="system-error-server-light" cx="190" cy="82" r="2" />
    </svg>
  );
}

export default function SystemErrorPage({
  title = "Hệ thống đang gặp sự cố",
  description = "Một số dịch vụ hiện chưa thể phản hồi. Vui lòng thử lại sau ít phút.",
  onRetry,
}: SystemErrorPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isRetrying, setIsRetrying] = useState(false);
  const retryTimeoutRef = useRef<number | null>(null);
  const routeState = location.state as { from?: unknown } | null;
  const requestedReturnPath = routeState?.from;
  const retryPath =
    typeof requestedReturnPath === "string" &&
    requestedReturnPath.startsWith("/") &&
    !requestedReturnPath.startsWith("//") &&
    !requestedReturnPath.startsWith("/system-error")
      ? requestedReturnPath
      : "/";

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const handleRetry = () => {
    if (isRetrying) return;

    setIsRetrying(true);
    retryTimeoutRef.current = window.setTimeout(() => {
      if (onRetry) {
        onRetry();
      } else {
        navigate(retryPath, { replace: true });
      }
    }, 350);
  };

  return (
    <main className="system-error-page flex min-h-svh w-full items-center justify-center bg-surface-white px-5 py-8 sm:px-8">
      <div className="system-error-composition flex w-full max-w-xl flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-warning/20 bg-warning/5 px-3 py-1.5 text-sm font-medium text-warning">
          <FiAlertTriangle aria-hidden="true" className="h-4 w-4" />
          Dịch vụ tạm thời gián đoạn
        </div>

        <h1
          id="system-error-title"
          className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-text-primary sm:text-[2.125rem]"
        >
          {title}
        </h1>
        <p className="mt-3 max-w-lg text-base leading-7 text-text-secondary">
          {description}
        </p>

        <SystemConnectionVisualization />

        <div className="mt-1 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          <Button
            variant="primary"
            size="md"
            className="w-full min-w-44 sm:w-auto"
            onClick={handleRetry}
            disabled={isRetrying}
            aria-live="polite"
          >
            {isRetrying ? (
              <>
                <FiRefreshCw aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                Đang thử lại...
              </>
            ) : (
              <>
                <FiRefreshCw aria-hidden="true" className="h-4 w-4" />
                Thử kết nối lại
              </>
            )}
          </Button>
          <Button
            variant="secondary"
            size="md"
            className="w-full min-w-44 sm:w-auto"
            onClick={() => navigate("/", { replace: true })}
            disabled={isRetrying}
          >
            <FiHome aria-hidden="true" className="h-4 w-4" />
            Về trang chủ
          </Button>
        </div>

        <p className="mt-6 max-w-md text-sm leading-6 text-text-secondary">
          Các thay đổi chưa được lưu có thể cần thực hiện lại sau khi kết nối được khôi phục.
        </p>
      </div>
    </main>
  );
}
