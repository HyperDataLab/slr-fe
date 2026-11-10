import { Component, type ErrorInfo, type ReactNode } from "react";
import SystemErrorPage from "../../pages/system-error/SystemErrorPage";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary caught an error]:", error, errorInfo);
  }

  handleReload = () => {
    this.props.onReset?.();
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <SystemErrorPage
          title={this.props.fallbackTitle ?? "Ứng dụng gặp sự cố"}
          description={
            this.props.fallbackMessage ??
            "Đã xảy ra lỗi khi hiển thị nội dung. Hãy thử tải lại trang."
          }
          onRetry={this.handleReload}
        />
      );
    }

    return this.props.children;
  }
}
