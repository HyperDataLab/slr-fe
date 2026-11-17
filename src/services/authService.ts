import axios from "axios";
import api from "../config/axios";
import type { LoginRequest, LoginResponse, RefreshResponse, RegisterRequest, RegisterResponse } from "../types/auth";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY;
const FIREBASE_CUSTOM_TOKEN_URL =
  import.meta.env.VITE_FIREBASE_CUSTOM_TOKEN_URL ||
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken";
const SSO_BASE_URL =
  import.meta.env.VITE_HYPERDATALAB_SSO_BASE_URL ||
  "https://rpr-grobid-gateway.hpl-storage.workers.dev";
const SSO_CLIENT_ID = import.meta.env.VITE_HYPERDATALAB_SSO_CLIENT_ID?.trim();
const SSO_STATE_KEY = "slrs:sso:state";
const SSO_VERIFIER_KEY = "slrs:sso:verifier";
const SSO_RETURN_TO_KEY = "slrs:sso:return-to";

interface FirebaseCustomTokenResponse {
  idToken: string;
}

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const randomBase64Url = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64Url(bytes);
};

const createSsoCallbackUrl = () => `${window.location.origin}/auth/sso/callback`;

const revokeSsoToken = async (accessToken: string) => {
  try {
    await fetch(new URL("/oauth/revoke", SSO_BASE_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: accessToken }),
      keepalive: true,
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    // Revocation is best-effort; the SSO token expires after one hour.
  }
};

export const authService = {
  isSsoConfigured: () => Boolean(SSO_CLIENT_ID && FIREBASE_API_KEY),

  startSsoSignIn: async (returnTo?: string) => {
    if (!SSO_CLIENT_ID) throw new Error("Google Workspace SSO is not configured");

    const state = randomBase64Url();
    const verifier = randomBase64Url();
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const challenge = toBase64Url(new Uint8Array(digest));
    const callbackUrl = createSsoCallbackUrl();
    sessionStorage.setItem(SSO_STATE_KEY, state);
    sessionStorage.setItem(SSO_VERIFIER_KEY, verifier);
    const safeReturnTo = returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
    sessionStorage.setItem(SSO_RETURN_TO_KEY, safeReturnTo);

    const authorizeUrl = new URL("/oauth/authorize", SSO_BASE_URL);
    authorizeUrl.search = new URLSearchParams({
      response_type: "code",
      client_id: SSO_CLIENT_ID,
      redirect_uri: callbackUrl,
      scope: "email profile hyperdatalab_profile",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    }).toString();
    window.location.assign(authorizeUrl.toString());
  },

  completeSsoSignIn: async (accessToken: string): Promise<LoginResponse> => {
    try {
      const ssoResponse = await api.post<{ data: { customToken: string } }>("/auth/sso/login", { accessToken });
      const customToken = ssoResponse.data.data?.customToken;
      if (!customToken) throw new Error("SLR authentication returned no Firebase custom token");
      if (!FIREBASE_API_KEY) throw new Error("Firebase sign-in is unavailable");

      const firebaseResponse = await axios.post<FirebaseCustomTokenResponse>(
        `${FIREBASE_CUSTOM_TOKEN_URL}?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
        { token: customToken, returnSecureToken: true },
      );
      if (!firebaseResponse.data.idToken) {
        throw new Error("Firebase custom-token exchange returned no ID token");
      }

      const loginResponse = await api.post<LoginResponse>("/auth/google/login", {
        idToken: firebaseResponse.data.idToken,
      });
      return loginResponse.data;
    } finally {
      await revokeSsoToken(accessToken);
    }
  },

  finishSsoSignIn: async (code: string, returnedState: string): Promise<LoginResponse> => {
    const expectedState = sessionStorage.getItem(SSO_STATE_KEY);
    const verifier = sessionStorage.getItem(SSO_VERIFIER_KEY);
    sessionStorage.removeItem(SSO_STATE_KEY);
    sessionStorage.removeItem(SSO_VERIFIER_KEY);
    if (!expectedState || !verifier || returnedState !== expectedState) {
      throw new Error("This SSO sign-in attempt is invalid or expired. Please try again.");
    }
    if (!SSO_CLIENT_ID || !code) throw new Error("The SSO authorization response is incomplete");

    const tokenResponse = await fetch(new URL("/oauth/token", SSO_BASE_URL), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: SSO_CLIENT_ID,
        code,
        redirect_uri: createSsoCallbackUrl(),
        code_verifier: verifier,
      }),
    });
    const tokenBody = await tokenResponse.json().catch(() => null) as
      | { access_token?: unknown }
      | null;
    if (!tokenResponse.ok || typeof tokenBody?.access_token !== "string") {
      throw new Error("ResearchPulse could not complete SSO. Please start sign-in again.");
    }
    return authService.completeSsoSignIn(tokenBody.access_token);
  },

  consumeSsoReturnTo: () => {
    const returnTo = sessionStorage.getItem(SSO_RETURN_TO_KEY);
    sessionStorage.removeItem(SSO_RETURN_TO_KEY);
    return returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  },

  cancelSsoSignIn: () => {
    sessionStorage.removeItem(SSO_STATE_KEY);
    sessionStorage.removeItem(SSO_VERIFIER_KEY);
    sessionStorage.removeItem(SSO_RETURN_TO_KEY);
  },

  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>("/auth/login", credentials);
    return response.data;
  },

  quickLogin: async (keyLogin: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>("/auth/dev/quick-login", { keyLogin });
    return response.data;
  },
  register: async (data: RegisterRequest): Promise<RegisterResponse> => {
    const response = await api.post<RegisterResponse>("/auth/register", data);
    return response.data;
  },
  refresh: async (): Promise<RefreshResponse> => {
    // Use raw axios (not the `api` instance) to avoid interceptor loops
    const response = await axios.post<RefreshResponse>(`${API_BASE_URL}/auth/refresh`, null,
      { withCredentials: true },
    );
    return response.data;
  },
};
