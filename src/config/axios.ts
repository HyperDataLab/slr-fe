import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import store, { type RootState } from "../redux/store";
import { updateAccessToken, logout } from "../redux/slices/authSlice";

import { isTokenExpired } from "../utils/auth";
import { authService } from "../services/authService";

import { toastWarning } from "../utils/toast";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
const TIMEOUT = 30000;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// Flag to prevent multiple logouts/toasts during parallel requests
let isLoggingOut = false;

const handleGlobalLogout = () => {
  const { isAuthenticated } = store.getState().auth;

  if (!isAuthenticated || isLoggingOut) return;

  isLoggingOut = true;

  store.dispatch(logout());

  toastWarning("Session Expired", "Session timed out, please sign in again.");

  if (window.location.pathname !== "/auth/signin") {
    window.location.replace("/auth/signin");
  }
};

// Mutex to prevent multiple concurrent refresh attempts.
// When a refresh is in-flight, subsequent callers await the same promise.
let refreshPromise: Promise<string | null> | null = null;

const refreshToken = async (): Promise<string | null> => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await authService.refresh();

      if (!response.isSuccess || !response.data) {
        return null;
      }

      const { accessToken, accessTokenExpiresAt } = response.data;
      store.dispatch(updateAccessToken({ accessToken, accessTokenExpiresAt }));

      return accessToken;
    } catch (error) {
      console.error("[Axios] Token refresh failed:", error);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/** Returns a fresh bearer token for fetch-based APIs such as authenticated SSE. */
export const getValidAccessToken = async (): Promise<string> => {
  const { accessToken, isAuthenticated, accessTokenExpiresAt } = store.getState().auth;
  if (!isAuthenticated) throw new Error("Please sign in to continue.");

  if (isTokenExpired(accessTokenExpiresAt)) {
    const refreshedToken = await refreshToken();
    if (!refreshedToken) {
      handleGlobalLogout();
      throw new Error("Your session expired. Please sign in again.");
    }
    return refreshedToken;
  }

  if (!accessToken) {
    handleGlobalLogout();
    throw new Error("Your session expired. Please sign in again.");
  }
  return accessToken;
};
// Add token from Redux store to request headers
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (config.data instanceof FormData && config.headers) {
      delete config.headers["Content-Type"];
    }

    const state: RootState = store.getState();
    const { accessToken, isAuthenticated, accessTokenExpiresAt } = state.auth;

    if (isAuthenticated && isTokenExpired(accessTokenExpiresAt)) {
      // Attempt silent refresh before giving up
      const newToken = await refreshToken();

      if (newToken) {
        if (config.headers) {
          config.headers.Authorization = `Bearer ${newToken}`;
        }

        return config;
      } else {
        handleGlobalLogout();
        return Promise.reject(new Error("Token expired"));
      }
    }

    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error: unknown) => Promise.reject(error),
);

// Handle response errors globally
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      const { isAuthenticated } = store.getState().auth;

      if (isAuthenticated) {
        originalRequest._retry = true;

        const newToken = await refreshToken();

        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }

        // If refresh fails, log out to clear the "null" state
        store.dispatch(logout());
      }
    } else if (error.response?.status === 401) {
      // If we get a 401 and we're not retrying (or retry failed), clean up
      store.dispatch(logout());
    } else if (error.code === "ECONNABORTED") {
      console.error("Request timed out");
    } else if (!error.response) {
      console.error("Network or unknown error", error.message);
    }

    return Promise.reject(error);
  },
);

export default api;
