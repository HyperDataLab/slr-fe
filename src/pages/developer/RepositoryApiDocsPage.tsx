import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { FiCheck, FiCopy, FiKey, FiPlay, FiTrash2 } from "react-icons/fi";
import api from "../../config/axios";
import { API_BASE_URL, getRepositoryApiDocsUrl } from "../../config/apiUrls";
import type { RootState } from "../../redux/store";

type Schema = { $ref?: string; type?: string; format?: string; example?: unknown; default?: unknown; enum?: unknown[]; properties?: Record<string, Schema>; items?: Schema; required?: string[] };
type Parameter = { name: string; in: string; required?: boolean; description?: string; schema?: Schema; example?: unknown };
type Operation = { tags?: string[]; summary?: string; description?: string; operationId?: string; parameters?: Parameter[]; requestBody?: { content?: Record<string, { schema?: Schema; example?: unknown }> }; responses?: Record<string, { description?: string; content?: Record<string, { schema?: Schema; example?: unknown }> }>; security?: Record<string, string[]>[] };
type OpenApiDocument = { openapi?: string; info?: { title?: string; description?: string; version?: string }; tags?: { name: string; description?: string }[]; paths?: Record<string, Record<string, Operation>> };
type CreatedApiKey = { key: { displayName: string; scopes: string[] }; secret: string };
type ApiEnvelope<T> = { data: T };

const methodNames = ["get", "post", "put", "patch", "delete", "head", "options"];
const scopeOptions = [
  ["repository:read", "Search and read repository works"],
  ["project:read", "Read project metadata where supported"],
  ["analysis:read", "Read repository analysis"],
  ["artifacts:download", "Download available artifacts"],
] as const;
const defaultScopes = scopeOptions.slice(0, 3).map(([scope]) => scope);
const docsJsonUrl = (origin: string) => getRepositoryApiDocsUrl(origin) + ".json";
const apiError = (error: unknown) => {
  const data = (error as { response?: { data?: { error?: { message?: string }; errors?: string } } })?.response?.data;
  return data?.error?.message || data?.errors || "Could not create the API key. Please try again.";
};
const getApiBase = (origin: string) => new URL(API_BASE_URL, origin).toString().replace(/\/$/, "");

function resolvedSchema(schema: Schema | undefined, spec: OpenApiDocument, depth = 0): Schema {
  if (!schema || depth > 5) return {};
  if (!schema.$ref) return schema;
  const target = schema.$ref.split("/").slice(1).reduce<unknown>((current, key) => (current as Record<string, unknown> | undefined)?.[key.replace(/~1/g, "/").replace(/~0/g, "~")], spec);
  return resolvedSchema(target as Schema, spec, depth + 1);
}

function schemaExample(schema: Schema | undefined, spec: OpenApiDocument): unknown {
  if (!schema) return {};
  const resolved = resolvedSchema(schema, spec);
  if (resolved.example !== undefined) return resolved.example;
  if (resolved.default !== undefined) return resolved.default;
  if (resolved.enum?.length) return resolved.enum[0];
  if (resolved.type === "array") return resolved.items ? [schemaExample(resolved.items, spec)] : [];
  if (resolved.type === "object" || resolved.properties) return Object.fromEntries(Object.entries(resolved.properties || {}).map(([key, value]) => [key, schemaExample(value, spec)]));
  if (resolved.type === "integer" || resolved.type === "number") return 1;
  if (resolved.type === "boolean") return false;
  if (resolved.type === "string") return resolved.format === "binary" ? null : "string";
  return {};
}

function OperationCard({ path, method, operation, spec, apiBase, apiKey, onMissingKey }: { path: string; method: string; operation: Operation; spec: OpenApiDocument; apiBase: string; apiKey: string; onMissingKey: () => void }) {
  const params = operation.parameters || [];
  const content = operation.requestBody?.content || {};
  const bodySchema = content["application/json"] || Object.values(content)[0];
  const contentType = Object.keys(content)[0] || "application/json";
  const multipart = contentType === "multipart/form-data";
  const formProperties = Object.entries(resolvedSchema(bodySchema?.schema, spec).properties || {});
  const [values, setValues] = useState<Record<string, string>>({});
  const [fileValues, setFileValues] = useState<Record<string, File | null>>({});
  const [body, setBody] = useState(JSON.stringify(bodySchema?.example ?? schemaExample(bodySchema?.schema, spec), null, 2));
  const [response, setResponse] = useState("");
  const [responseStatus, setResponseStatus] = useState("");
  const [requestId, setRequestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scopes = [...new Set((operation.security || []).flatMap((item) => Object.values(item).flat()))];

  const send = async () => {
    if (!apiKey.trim()) { onMissingKey(); return; }
    setBusy(true); setError(""); setResponse("");
    try {
      let requestPath = path;
      const query = new URLSearchParams();
      const headers: Record<string, string> = { Accept: "application/json", "X-API-Key": apiKey.trim() };
      params.forEach((parameter) => {
        const value = values[parameter.in + ":" + parameter.name]?.trim();
        if (!value) return;
        if (parameter.in === "path") requestPath = requestPath.replace("{" + parameter.name + "}", encodeURIComponent(value));
        if (parameter.in === "query") query.set(parameter.name, value);
        if (parameter.in === "header") headers[parameter.name] = value;
      });
      if (/\{[^}]+\}/.test(requestPath)) throw new Error("Fill in all required path parameters.");
      const url = new URL(apiBase + (requestPath.startsWith("/") ? requestPath : "/" + requestPath));
      query.forEach((value, name) => url.searchParams.set(name, value));
      const init: RequestInit = { method: method.toUpperCase(), headers };
      if (operation.requestBody && multipart) {
        const form = new FormData();
        formProperties.forEach(([name, schema]) => {
          const property = resolvedSchema(schema, spec);
          const file = fileValues[name];
          const value = values["body:" + name];
          if (property.format === "binary") { if (file) form.append(name, file); }
          else if (value !== undefined && value !== "") form.append(name, value);
        });
        init.body = form;
      } else if (operation.requestBody && contentType === "application/x-www-form-urlencoded") {
        const fields = JSON.parse(body || "{}") as Record<string, string>;
        headers["Content-Type"] = contentType;
        init.body = new URLSearchParams(Object.entries(fields).map(([name, value]) => [name, String(value)]));
      } else if (operation.requestBody) {
        headers["Content-Type"] = contentType;
        init.body = body || "{}";
      }
      const result = await fetch(url, init);
      const type = result.headers.get("content-type") || "";
      const data = type.includes("json") ? await result.json() : await result.text();
      setResponseStatus(result.status + " " + result.statusText);
      setRequestId(result.headers.get("x-request-id") || "");
      setResponse(typeof data === "string" ? data : JSON.stringify(data, null, 2));
    } catch (cause) {
      setError(cause instanceof TypeError ? "Could not connect to " + apiBase + ". Check the API URL and CORS configuration." : cause instanceof Error ? cause.message : "Could not send request.");
    } finally { setBusy(false); }
  };

  return <details className="rounded-xl border border-border bg-surface-white">
    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
      <span className={"min-w-16 rounded px-2 py-1 text-center font-mono text-xs font-bold text-white " + (method === "GET" ? "bg-success" : method === "DELETE" ? "bg-error" : "bg-warning")}>{method}</span>
      <code className="min-w-0 flex-1 break-all text-sm font-semibold">{path}</code><span className="text-xs text-text-secondary">{operation.summary || operation.operationId}</span>
    </summary>
    <div className="grid border-t border-border lg:grid-cols-2">
      <div className="space-y-4 p-4 sm:p-5"><p className="text-sm leading-6 text-text-secondary">{operation.description || operation.summary}</p>
        {scopes.length > 0 && <p className="text-xs text-text-secondary">Required scopes: {scopes.join(", ")}</p>}
        {params.map((parameter) => <label key={parameter.in + ":" + parameter.name} className="block text-xs font-semibold">{parameter.name} ({parameter.in}{parameter.required ? ", required" : ""})<input aria-label={parameter.name + " " + parameter.in} className="mt-1 min-h-10 w-full rounded-md border border-border px-3 font-mono text-xs" value={values[parameter.in + ":" + parameter.name] || ""} onChange={(event) => setValues((current) => ({ ...current, [parameter.in + ":" + parameter.name]: event.target.value }))} placeholder={String(parameter.example ?? parameter.schema?.example ?? "")} />{parameter.description && <span className="mt-1 block font-normal text-text-secondary">{parameter.description}</span>}</label>)}
        {operation.requestBody && multipart && <fieldset className="space-y-3"><legend className="text-xs font-semibold">Upload form</legend>{formProperties.map(([name, schema]) => { const property = resolvedSchema(schema, spec); return <label key={name} className="block text-xs font-semibold">{name}{property.format === "binary" ? <input type="file" aria-label={name} className="mt-1 block min-h-10 w-full rounded-md border border-border p-2" onChange={(event) => setFileValues((current) => ({ ...current, [name]: event.target.files?.[0] || null }))} /> : <input aria-label={name} className="mt-1 min-h-10 w-full rounded-md border border-border px-3" value={values["body:" + name] || ""} onChange={(event) => setValues((current) => ({ ...current, ["body:" + name]: event.target.value }))} />}</label>; })}</fieldset>}
        {operation.requestBody && !multipart && <label className="block text-xs font-semibold">Request body<textarea aria-label="Request body JSON" className="mt-2 min-h-40 w-full rounded-md border border-border p-3 font-mono text-xs" value={body} onChange={(event) => setBody(event.target.value)} /></label>}
        <div className="flex gap-2"><button type="button" onClick={() => void send()} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"><FiPlay aria-hidden="true" />{busy ? "Sending…" : "Try it out"}</button><button type="button" onClick={() => { setValues({}); setResponse(""); setError(""); }} className="min-h-10 rounded-lg border border-border px-3 text-sm">Reset</button></div>
      </div>
      <div className="min-w-0 border-t border-border bg-bg-secondary/30 p-4 sm:p-5 lg:border-l lg:border-t-0"><h4 className="mb-3 text-sm font-bold">Responses</h4><div className="space-y-2">{Object.entries(operation.responses || {}).map(([status, item]) => <details key={status} className="rounded-lg border border-border bg-surface-white"><summary className="cursor-pointer p-3 text-xs"><strong className="mr-2">{status}</strong>{item.description}</summary>{item.content && <pre className="max-h-52 overflow-auto border-t border-border p-3 text-xs">{JSON.stringify(Object.values(item.content)[0]?.example ?? schemaExample(Object.values(item.content)[0]?.schema, spec), null, 2)}</pre>}</details>)}</div>{error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}{response && <div className="mt-4" aria-live="polite"><p className="mb-2 text-xs font-bold">{responseStatus}{requestId && " · request " + requestId}</p><pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-white">{response}</pre></div>}</div>\n+    </div>\n+  </details>;
}

export default function RepositoryApiDocsPage() {
  const navigate = useNavigate();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const [spec, setSpec] = useState<OpenApiDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [apiBase] = useState(() => getApiBase(window.location.origin));
  const [apiKey, setApiKey] = useState("");
  const [keyName, setKeyName] = useState("");
  const [keyScopes, setKeyScopes] = useState<string[]>(defaultScopes);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState("");
  const wasAuthenticated = useRef(isAuthenticated);

  useEffect(() => {
    const controller = new AbortController();
    fetch(docsJsonUrl(window.location.origin), { headers: { Accept: "application/json" }, signal: controller.signal })
      .then(async (res) => { if (!res.ok) throw new Error("OpenAPI returned HTTP " + res.status); return res.json() as Promise<OpenApiDocument>; })
      .then(setSpec)
      .catch((cause: unknown) => { if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : "Could not load the API contract."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated) {
      setApiKey("");
      setCreated(null);
      setCopied(false);
      setShowCreate(false);
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  const groups = useMemo(() => {
    if (!spec?.paths) return [];
    const descriptions = new Map((spec.tags || []).map((tag) => [tag.name, tag.description || ""]));
    const grouped = new Map<string, { description: string; operations: { path: string; method: string; operation: Operation }[] }>();
    Object.entries(spec.paths).forEach(([path, pathItem]) => methodNames.forEach((method) => {
      const operation = pathItem[method];
      if (!operation) return;
      (operation.tags?.length ? operation.tags : ["Other"]).forEach((tag) => {
        const group = grouped.get(tag) || { description: descriptions.get(tag) || "", operations: [] };
        group.operations.push({ path, method: method.toUpperCase(), operation });
        grouped.set(tag, group);
      });
    }));
    return [...grouped.entries()].map(([name, value]) => ({ name, ...value }));
  }, [spec]);

  const filteredGroups = groups.map((group) => ({ ...group, operations: group.operations.filter(({ path, method, operation }) => !filter || (group.name + " " + path + " " + method + " " + operation.summary + " " + operation.description).toLowerCase().includes(filter.toLowerCase())) })).filter((group) => group.operations.length);
  const createKey = async (event: FormEvent) => {
    event.preventDefault(); setCreating(true); setKeyError("");
    try {
      const result = await api.post<ApiEnvelope<CreatedApiKey>>("/me/repository-api-keys", { displayName: keyName.trim(), scopes: keyScopes });
      setCreated(result.data.data); setApiKey(result.data.data.secret); setKeyName(""); setShowCreate(false);
    } catch (cause) { setKeyError(apiError(cause)); }
    finally { setCreating(false); }
  };
  const toggleScope = (scope: string) => setKeyScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]);

  return <main className="min-h-[70vh] bg-bg-primary px-4 py-8 sm:px-6 lg:py-12"><div className="mx-auto max-w-7xl">
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">Public developer docs</p><h1 className="mt-2 text-3xl font-bold text-text-primary sm:text-4xl">{spec?.info?.title || "Research Repository API"}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">{spec?.info?.description || "Integrate repository search, analysis, taxonomy, and artifact endpoints into your system."}</p></div><a href={docsJsonUrl(window.location.origin)} target="_blank" rel="noreferrer" className="min-h-11 rounded-lg border border-border bg-surface-white px-4 py-3 text-sm font-semibold text-primary">OpenAPI JSON ↗</a></div>
    <nav aria-label="Developer docs sections" className="mb-8 flex flex-wrap gap-2 border-b border-border pb-4 text-sm">{[["#quickstart", "Quickstart"], ["#authentication", "Authentication"], ["#guides", "Guides"], ["#reference", "API reference"], ["#get-a-key", "Get an API key"]].map(([href, label]) => <a key={href} href={href} className="rounded-full border border-border bg-surface-white px-3 py-2 font-semibold text-text-secondary hover:text-primary">{label}</a>)}</nav>

    <section id="quickstart" className="mb-8 grid gap-6 rounded-2xl border border-border bg-surface-white p-5 sm:p-7 lg:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">Start here</p><h2 className="mt-2 text-2xl font-bold">Make your first request</h2><ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-text-secondary"><li>Create a read-only API key below. Its secret is shown once.</li><li>Store the secret in an environment variable on your server; never commit it or expose it in browser code.</li><li>Send it in the <code>X-API-Key</code> header.</li></ol><p className="mt-4 text-xs text-text-muted">API base URL: <code className="break-all">{apiBase}</code></p><label className="mt-4 block text-sm font-semibold">API key for Try it out<div className="mt-2 flex gap-2"><input aria-label="API key for Try it out" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-lg border border-border px-3 font-mono text-xs" placeholder="Paste a repository API key" /><button type="button" onClick={() => setApiKey("")} disabled={!apiKey} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm disabled:opacity-50"><FiTrash2 aria-hidden="true" />Clear</button></div></label></div><div className="overflow-hidden rounded-xl bg-slate-950 text-slate-100"><div className="border-b border-white/10 px-4 py-3 text-xs font-bold">cURL · List works</div><pre className="overflow-auto p-4 text-xs leading-6">{'export SLR_API_BASE="' + apiBase + '"\nexport SLR_API_KEY="your_one_time_secret"\ncurl --get "$SLR_API_BASE/public/v1/repository/works" \\\n  --header "X-API-Key: $SLR_API_KEY" \\\n  --data-urlencode "limit=20"'}</pre></div></section>

    <section className="mb-8 rounded-2xl border border-border bg-surface-white p-5 sm:p-7"><h2 className="text-xl font-bold">JavaScript / TypeScript and Python examples</h2><div className="mt-4 grid gap-4 lg:grid-cols-2"><article><h3 className="text-sm font-bold">JavaScript / TypeScript · Node.js 18+</h3><pre className="mt-2 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-white">{'const API_BASE = process.env.SLR_API_BASE;\nconst API_KEY = process.env.SLR_API_KEY;\nif (!API_BASE || !API_KEY) throw new Error("Set SLR_API_BASE and SLR_API_KEY");\nconst response = await fetch(API_BASE + "/public/v1/repository/works?limit=20", {\n  headers: { "X-API-Key": API_KEY, Accept: "application/json" },\n});\nconst result = await response.json();\nif (!response.ok) throw new Error(JSON.stringify(result));\nconsole.log(result.data.items);'}</pre></article><article><h3 className="text-sm font-bold">Python · requests</h3><pre className="mt-2 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-white">{'import os\nimport requests\n\napi_base = os.environ["SLR_API_BASE"]\napi_key = os.environ["SLR_API_KEY"]\nresponse = requests.get(\n    f"{api_base}/public/v1/repository/works",\n    params={"limit": 20},\n    headers={"X-API-Key": api_key},\n    timeout=30,\n)\nresponse.raise_for_status()\nprint(response.json()["data"]["items"])'}</pre></article></div><p className="mt-3 text-xs text-text-secondary">Set <code>SLR_API_BASE</code> to the API base URL displayed above and keep the key in a server-side environment variable.</p></section>

    <section id="authentication" className="mb-8 rounded-xl border border-primary/20 bg-primary-light p-5"><h2 className="text-lg font-bold">Authentication and scopes</h2><p className="mt-2 text-sm leading-6 text-text-secondary">Public repository requests use <code>X-API-Key</code>. User-created keys are read-only and limited to system-wide resources. Wildcard project access and write scopes are unavailable.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{scopeOptions.map(([scope, text]) => <div key={scope} className="rounded-lg border border-border bg-surface-white p-3"><code className="text-xs font-bold">{scope}</code><p className="mt-1 text-xs text-text-secondary">{text}</p></div>)}</div></section>

    <section id="guides" className="mb-8 grid gap-4 lg:grid-cols-3"><article className="rounded-xl border border-border bg-surface-white p-5"><h2 className="font-bold">Cursor pagination</h2><p className="mt-2 text-sm leading-6 text-text-secondary">Pass an opaque <code>nextCursor</code> back unchanged as <code>cursor</code>. Keep filters and page size unchanged while paging. Work search returns it under <code>data.page.nextCursor</code>; other response shapes are documented per endpoint. Stop at <code>null</code>.</p></article><article className="rounded-xl border border-border bg-surface-white p-5"><h2 className="font-bold">Errors and rate limits</h2><p className="mt-2 text-sm leading-6 text-text-secondary"><code>401</code>: invalid, missing, revoked, or rotated key. <code>403</code>: missing scope. <code>429</code>: 120 requests/minute per client and IP; honor <code>Retry-After</code>. Error bodies include a code and message.</p></article><article className="rounded-xl border border-border bg-surface-white p-5"><h2 className="font-bold">Retry safely</h2><p className="mt-2 text-sm leading-6 text-text-secondary">Retry safe reads on temporary network or <code>5xx</code> errors with exponential backoff and jitter. Wait for <code>Retry-After</code> on <code>429</code>. Avoid automatically replaying imports.</p></article></section>

    <section id="get-a-key" className="mb-10 rounded-2xl border border-border bg-surface-white p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">Self-service</p><h2 className="mt-2 text-2xl font-bold">Register an API key</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">Docs are public. Sign in to create a key here; the secret is shown once. Existing keys can be managed from account settings.</p></div>{isAuthenticated ? <Link to="/profile/api-keys" className="min-h-11 rounded-lg border border-border px-4 py-3 text-sm font-semibold text-primary">Manage keys</Link> : <button type="button" onClick={() => navigate("/auth/signin?returnTo=%2Frepository-api-docs")} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white"><FiKey aria-hidden="true" />Sign in to create a key</button>}</div>
      {isAuthenticated && !showCreate && <button type="button" onClick={() => { setShowCreate(true); setKeyError(""); }} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white"><FiKey aria-hidden="true" />Create API key here</button>}
      {isAuthenticated && showCreate && <form onSubmit={(event) => void createKey(event)} className="mt-5 max-w-3xl space-y-4 rounded-xl border border-border p-4 sm:p-5"><label className="block text-sm font-semibold">Key name<input required maxLength={120} value={keyName} onChange={(event) => setKeyName(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-border px-3 font-normal" placeholder="e.g. Research dashboard" /></label><fieldset><legend className="text-sm font-semibold">Permissions</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{scopeOptions.map(([scope, description]) => <label key={scope} className="flex min-h-12 items-start gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={keyScopes.includes(scope)} onChange={() => toggleScope(scope)} className="mt-1 accent-primary" /><span><span className="font-semibold">{scope}</span><span className="mt-1 block text-xs text-text-secondary">{description}</span></span></label>)}</div><p className="mt-2 text-xs text-text-muted">Up to 10 active keys. System-wide read access only.</p></fieldset>{keyError && <p role="alert" className="rounded-lg bg-error/10 p-3 text-sm text-error">{keyError}</p>}<div className="flex gap-2"><button disabled={creating || !keyName.trim() || !keyScopes.length} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50">{creating ? "Creating…" : "Create key"}</button><button type="button" onClick={() => setShowCreate(false)} className="min-h-11 rounded-lg border border-border px-4 text-sm">Cancel</button></div></form>}
      {created && <section className="mt-5 max-w-3xl rounded-xl border border-success/30 bg-success/5 p-4 sm:p-5" aria-label="New API key secret" aria-live="polite"><h3 className="font-bold">Save this secret now</h3><p className="mt-1 text-sm text-text-secondary">It is shown only once and held in page memory for Try it out. It clears when you leave this page.</p><code className="mt-3 block break-all rounded-lg border border-border bg-surface-white p-3 text-sm">{created.secret}</code><div className="mt-3 flex gap-2"><button type="button" onClick={() => { void navigator.clipboard.writeText(created.secret).then(() => setCopied(true)).catch(() => setKeyError("Clipboard access is unavailable. Select and copy the secret manually.")); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-white">{copied ? <FiCheck /> : <FiCopy />}{copied ? "Copied" : "Copy"}</button><button type="button" onClick={() => { setCreated(null); setApiKey(""); setCopied(false); }} className="min-h-10 rounded-lg border border-border px-3 text-sm">I saved it</button></div></section>}
    </section>

    <section id="reference" className="scroll-mt-20"><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">OpenAPI {spec?.openapi}</p><h2 className="mt-1 text-2xl font-bold">API reference</h2><p className="mt-1 text-sm text-text-secondary">Endpoint descriptions, parameters, and response examples load from the backend OpenAPI contract.</p></div><input aria-label="Search API endpoints" value={filter} onChange={(event) => setFilter(event.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-surface-white px-3 text-sm sm:max-w-sm" placeholder="Search operations" /></div>
      {loading && <p role="status" className="rounded-xl border border-border bg-surface-white p-5 text-sm text-text-secondary">Loading API contract…</p>}
      {loadError && <div role="alert" className="rounded-xl border border-error/30 bg-error/5 p-5 text-sm text-error">Could not load the OpenAPI contract: {loadError}. Check that the backend endpoint is reachable at <code>{docsJsonUrl(window.location.origin)}</code>.</div>}
      {spec && <div className="space-y-7">{filteredGroups.map((group) => <section key={group.name}><h3 className="text-lg font-bold">{group.name}</h3>{group.description && <p className="mb-3 mt-1 text-sm text-text-secondary">{group.description}</p>}<div className="space-y-2">{group.operations.map(({ path, method, operation }) => <OperationCard key={method + ":" + path} path={path} method={method} operation={operation} spec={spec} apiBase={apiBase} apiKey={apiKey} onMissingKey={() => { setKeyError("Paste an API key above or create one in this section."); document.getElementById("get-a-key")?.scrollIntoView({ behavior: "smooth" }); }} />)}</div></section>)}</div>}
    </section>
  </div></main>;
}
