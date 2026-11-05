export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export const getRepositoryApiDocsUrl = (origin: string, apiBaseUrl = API_BASE_URL) => {
  const url = new URL(apiBaseUrl, origin);
  const apiPath = url.pathname.replace(/\/+$/, "").replace(/\/api$/, "");
  url.pathname = `${apiPath}/repository-api-docs`;
  url.search = "";
  url.hash = "";
  return url.toString();
};
