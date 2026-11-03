import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router";
import { Provider } from "react-redux";
import { persistor, store } from "./redux/store.ts";
import { PersistGate } from "redux-persist/integration/react";
import { ToastProvider } from "./components/ui/toast/ToastProvider.tsx";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./config/queryClient";

const PRELOAD_RELOAD_KEY = "slrs:preload-error-reload-at";
const PRELOAD_RELOAD_COOLDOWN_MS = 30_000;

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();

  const lastReloadAt = Number(sessionStorage.getItem(PRELOAD_RELOAD_KEY) ?? 0);
  if (Date.now() - lastReloadAt < PRELOAD_RELOAD_COOLDOWN_MS) {
    return;
  }

  sessionStorage.setItem(PRELOAD_RELOAD_KEY, String(Date.now()));
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <BrowserRouter>
          <ToastProvider>
            <App />
          </ToastProvider>
        </BrowserRouter>
      </PersistGate>
    </Provider>
  </QueryClientProvider>,
);
