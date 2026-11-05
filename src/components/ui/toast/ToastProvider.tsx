import React from "react";
import { Toaster } from "react-hot-toast";

export const ToastProvider: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  return (
    <>
      {children}
      <Toaster
        position="top-center"
        reverseOrder={false}
        gutter={8}
        containerClassName=""
        containerStyle={{
          top: 40,
          left: 20,
          bottom: 20,
          right: 20,
        }}
        toastOptions={{
          // We'll mostly use custom toasts, but these are defaults
          duration: 4000,
          style: {
            maxWidth: "450px",
          },
          error: {
            style: {
              maxWidth: "min(450px, calc(100vw - 32px))",
              minHeight: "40px",
              padding: "10px 14px",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              background: "var(--color-surface-white)",
              color: "var(--color-text-primary)",
              boxShadow: "0 3px 10px rgb(18 35 49 / 8%)",
              fontSize: "13px",
              fontWeight: 500,
            },
            iconTheme: {
              primary: "#DC2626",
              secondary: "#FFFFFF",
            },
          },
        }}
      />
    </>
  );
};
