import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { FiBookOpen, FiCommand, FiMenu, FiMoon, FiSearch, FiSun } from "react-icons/fi";
import api from "../../config/axios";
import { API_BASE_URL, getRepositoryApiBase, getRepositoryApiDocsUrl } from "../../config/apiUrls";
import SystemSignature from "../../components/logo/SystemSignature";
import type { RootState } from "../../redux/store";
import type { Endpoint, OpenApiDocument } from "./docs-types";
import { collectEndpointGroups, endpointId, slug } from "./docs-utils";
import ApiOperationCard from "./components/ApiOperationCard";
import DocsCodeBlock from "./components/DocsCodeBlock";
import DocsRightRail from "./components/DocsRightRail";
import DocsSearchDialog from "./components/DocsSearchDialog";
import type { DocsSearchResult } from "./components/DocsSearchDialog";
import DocsSidebar from "./components/DocsSidebar";
import "./developer-docs.css";

type CreatedApiKey = { key: { displayName: string; scopes: string[] }; secret: string };
type ApiEnvelope<T> = { data: T };

const docsJsonUrl = (origin: string) => `${getRepositoryApiDocsUrl(origin)}.json`;
const defaultScopes = ["repository:read", "project:read", "analysis:read"];
const scopeDescriptions: Record<string, string> = {
  "repository:read": "Search and read repository works and metadata.",
  "project:read": "Read project metadata where supported.",
  "analysis:read": "Read repository analysis and analysis runs.",
  "artifacts:download": "Download available repository artifacts.",
  "repository:write": "Import repository works. This scope is provisioned by an administrator.",
};

function getApiError(error: unknown) {
  const data = (error as { response?: { data?: { error?: { message?: string }; errors?: string } } })?.response?.data;
  return data?.error?.message || data?.errors || "Could not create the API key. Please try again.";
}

function Heading({ kicker, title, description }: { kicker: string; title: string; description: string }) {
  return <header className="devdocs-section__heading"><p className="devdocs-section-kicker">{kicker}</p><h2 className="devdocs-section__title">{title}</h2><p className="devdocs-section__description">{description}</p></header>;
}

export default function RepositoryApiDocsPage() {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const navigate = useNavigate();
  const [spec, setSpec] = useState<OpenApiDocument | null>(null);
  const [loadError, setLoadError] = useState("");
  const [activeId, setActiveId] = useState("introduction");
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint>();
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [referenceQuery, setReferenceQuery] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try { return localStorage.getItem("slrs-developer-docs-theme") === "dark" ? "dark" : "light"; }
    catch { return "light"; }
  });
  const [apiKey, setApiKey] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const apiKeyRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => collectEndpointGroups(spec), [spec]);
  const endpoints = useMemo(() => groups.flatMap((group) => group.operations), [groups]);
  const apiBase = useMemo(() => {
    const documentedServer = spec?.servers?.[0]?.url;
    const isLocalHost = (value: string) => {
      try { return ["localhost", "127.0.0.1", "::1"].includes(new URL(value, window.location.origin).hostname); }
      catch { return false; }
    };
    const currentIsLocal = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    const safeServer = documentedServer && (!isLocalHost(documentedServer) || currentIsLocal) ? documentedServer : API_BASE_URL;
    return getRepositoryApiBase(window.location.origin, safeServer);
  }, [spec]);
  const jsonUrl = useMemo(() => docsJsonUrl(window.location.origin), []);
  const currentEndpoint = selectedEndpoint || endpoints.find((endpoint) => endpoint.method === "GET" && endpoint.path.endsWith("/works")) || endpoints[0];
  const currentGroup = groups.find((group) => group.operations.some((endpoint) => endpoint === currentEndpoint));
  const filteredGroups = useMemo(() => {
    const term = referenceQuery.trim().toLowerCase();
    if (!term) return groups;
    return groups.map((group) => ({
      ...group,
      operations: group.operations.filter(({ path, method, operation }) => `${path} ${method} ${operation.summary || ""} ${operation.description || ""} ${operation.operationId || ""}`.toLowerCase().includes(term)),
    })).filter((group) => group.operations.length);
  }, [groups, referenceQuery]);

  const searchEntries = useMemo<DocsSearchResult[]>(() => {
    const entries: DocsSearchResult[] = [
      { id: "introduction", title: "Introduction", description: "Build with the SLRS API", group: "Getting started", keywords: "overview research repository" },
      { id: "quickstart", title: "Quickstart", description: "Make your first repository request", group: "Getting started", keywords: "curl javascript python" },
      { id: "explore-api", title: "Explore the API", description: "Browse the implemented repository API groups", group: "Getting started", keywords: "works journals taxonomy metadata artifacts analysis imports" },
      { id: "authentication", title: "Authentication", description: "Authenticate with an X-API-Key header", group: "Getting started", keywords: "credential security scopes" },
      { id: "api-keys", title: "API keys", description: "Create and manage user API keys", group: "Getting started", keywords: "credentials dashboard" },
      { id: "pagination", title: "Cursor pagination", description: "Continue through paginated repository results", group: "Guides", keywords: "cursor limit next" },
      { id: "filtering", title: "Filtering works", description: "Search and narrow repository works", group: "Guides", keywords: "query filters" },
      { id: "errors", title: "Errors & rate limits", description: "Understand API errors and retry behavior", group: "Guides", keywords: "429 retry-after status" },
    ];
    groups.forEach((group) => {
      entries.push({ id: `reference-${slug(group.name)}`, title: group.name, description: group.description || `${group.operations.length} API operations`, group: "API reference", keywords: group.operations.map((item) => `${item.method} ${item.path}`).join(" ") });
      group.operations.forEach((endpoint) => entries.push({
        id: endpointId(endpoint),
        title: `${endpoint.method} ${endpoint.path}`,
        description: endpoint.operation.summary || endpoint.operation.description || endpoint.operation.operationId || "API endpoint",
        group: group.name,
        keywords: `${endpoint.operation.operationId || ""} ${endpoint.operation.tags?.join(" ") || ""}`,
      }));
    });
    entries.push({ id: "openapi-json", title: "OpenAPI specification", description: "View the live OpenAPI JSON contract", group: "Resources", keywords: "schema json download" });
    return entries;
  }, [groups]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(jsonUrl, { signal: controller.signal, headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Could not load the API contract (${response.status}).`);
        return response.json() as Promise<OpenApiDocument>;
      })
      .then((document) => { setSpec(document); setLoadError(""); })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(error instanceof Error ? error.message : "Could not load the API contract.");
      });
    return () => controller.abort();
  }, [jsonUrl]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "SLRS Developer Docs | Research Repository API";
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const created = !description;
    if (!description) {
      description = document.createElement("meta");
      description.name = "description";
      document.head.append(description);
    }
    const previousDescription = description.content;
    description.content = "Developer documentation for the SLRS Research Repository API, including authentication, research works, taxonomy, artifacts, and analysis.";
    return () => {
      document.title = previousTitle;
      if (created) description?.remove();
      else if (description) description.content = previousDescription;
    };
  }, []);

  useEffect(() => {
    try { localStorage.setItem("slrs-developer-docs-theme", theme); } catch { /* Private browsing may block storage. */ }
  }, [theme]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    const sections = [...document.querySelectorAll<HTMLElement>(".devdocs-article section[id]")];
    if (!sections.length || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setActiveId(visible.target.id);
    }, { rootMargin: "-132px 0px -65% 0px", threshold: [0, 0.15, 0.4] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [spec]);

  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    setActiveId(id);
    const target = endpoints.find((endpoint) => endpointId(endpoint) === id);
    if (target) {
      setSelectedEndpoint(target);
      document.getElementById(id)?.setAttribute("open", "");
    }
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "auto", block: "start" }), 0);
  }, [endpoints]);

  const navigateTo = useCallback((id: string) => {
    setActiveId(id);
    setSearchOpen(false);
    setSidebarOpen(false);
    if (id.startsWith("endpoint-")) {
      document.getElementById(id)?.setAttribute("open", "");
      const target = endpoints.find((endpoint) => endpointId(endpoint) === id);
      if (target) setSelectedEndpoint(target);
    }
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }), 0);
    window.history.replaceState(null, "", `#${id}`);
  }, [endpoints]);

  const createKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!keyName.trim()) return;
    setCreatingKey(true);
    setKeyError("");
    try {
      const response = await api.post<ApiEnvelope<CreatedApiKey>>("/me/repository-api-keys", { displayName: keyName.trim(), scopes: defaultScopes });
      setCreatedKey(response.data.data);
      setApiKey(response.data.data.secret);
      setShowCreate(false);
      setKeyName("");
    } catch (error) { setKeyError(getApiError(error)); }
    finally { setCreatingKey(false); }
  };

  const onMissingKey = () => {
    navigateTo("authentication");
    window.setTimeout(() => apiKeyRef.current?.focus(), 250);
  };

  const environmentLabel = ["localhost", "127.0.0.1"].includes(window.location.hostname) ? "Local development" : "Current deployment";

  return (
    <div className="developer-docs" data-theme={theme}>
      <div className="devdocs-topbar">
        <button type="button" className="devdocs-topbar__mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open documentation navigation"><FiMenu /></button>
        <Link className="devdocs-topbar__identity" to="/projects" aria-label="SLRS developer docs home"><SystemSignature className="devdocs-topbar__logo" logoClassName="h-7"/><span className="devdocs-topbar__divider" /><span>Developer Docs</span></Link>
        <nav className="devdocs-topbar__links" aria-label="Primary navigation"><Link to="/projects">Projects</Link><Link to="/shared-repository">Shared library</Link><Link to="/repository-api-docs" aria-current="page">Developer API</Link></nav>
        <span className="devdocs-topbar__version">v{spec?.info?.version || "…"}</span>
        <button type="button" className="devdocs-topbar__search" onClick={() => setSearchOpen(true)}><FiSearch aria-hidden="true" /><span>Search documentation…</span><kbd><FiCommand aria-hidden="true" /> K</kbd></button>
        <div className="devdocs-topbar__actions">
          <button type="button" className="devdocs-icon-button" aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"} onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}>{theme === "light" ? <FiMoon /> : <FiSun />}</button>
          {isAuthenticated ? <Link className="devdocs-topbar__dashboard" to="/profile/api-keys">Dashboard</Link> : <button type="button" className="devdocs-topbar__signin" onClick={() => navigate("/auth/signin", { state: { from: "/repository-api-docs" } })}>Sign in</button>}
        </div>
      </div>

      <div className="devdocs-layout">
        <DocsSidebar groups={groups} activeId={activeId} open={sidebarOpen} onClose={() => setSidebarOpen(false)} docsJsonUrl={jsonUrl} />
        <main className="devdocs-article">
          <section id="introduction" className="devdocs-intro">
            <p className="devdocs-intro__eyebrow">Public developer docs</p>
            <h1>Build with the SLRS API</h1>
            <p className="devdocs-intro__summary">Access research publications, journal metadata, taxonomy, analysis results, and shared repository resources through a unified developer API.</p>
            <div className="devdocs-intro__actions"><a href="#quickstart" className="devdocs-primary-button" onClick={() => setActiveId("quickstart")}>Get started</a><a href="#api-reference" className="devdocs-secondary-button" onClick={() => setActiveId("api-reference")}>Explore API reference</a></div>
            <div className="devdocs-intro__meta"><span><FiBookOpen aria-hidden="true" /> OpenAPI {spec?.openapi || "3.x"}</span><span>{environmentLabel} · <code>{apiBase}</code></span><span>JSON responses</span></div>
            {loadError && <p className="devdocs-alert" role="status">{loadError} <a href={jsonUrl} target="_blank" rel="noreferrer">Open the API contract</a>.</p>}
          </section>

          <section id="quickstart" className="devdocs-section">
            <Heading kicker="GETTING STARTED" title="Your first request" description="Create a read key, set it as an environment variable, then query the research repository. The examples below use the current deployment base URL." />
            <div className="devdocs-quickstart">
              <ol className="devdocs-steps">
                <li><span className="devdocs-steps__number">01</span><div><strong>Obtain an API key</strong><p>{isAuthenticated ? <>Use the <Link to="/profile/api-keys">API key manager</Link> or create a read-only key below.</> : <button className="devdocs-inline-button" type="button" onClick={() => navigate("/auth/signin", { state: { from: "/repository-api-docs" } })}>Sign in to create a key</button>}</p></div></li>
                <li><span className="devdocs-steps__number">02</span><div><strong>Configure your environment</strong><p>Keep the key in a server-side secret store. Set <code>SLR_API_KEY</code> and <code>SLR_API_BASE</code>.</p></div></li>
                <li><span className="devdocs-steps__number">03</span><div><strong>Send your first request</strong><p>Use the works endpoint and provide the <code>X-API-Key</code> header.</p></div></li>
                <li><span className="devdocs-steps__number">04</span><div><strong>Inspect the response</strong><p>Read the JSON result and use the returned cursor to continue through the result set.</p></div></li>
              </ol>
              <div className="devdocs-quickstart__examples">
                <p className="devdocs-example-label">JavaScript / TypeScript · Node.js 18+</p>
                <DocsCodeBlock language="javascript" code={`const baseUrl = process.env.SLR_API_BASE || "${apiBase}";\nconst response = await fetch(\`${"${baseUrl}"}/public/v1/repository/works?limit=20\`, {\n  headers: {\n    "X-API-Key": process.env.SLR_API_KEY,\n    "Accept": "application/json"\n  }\n});\n\nif (!response.ok) throw new Error(await response.text());\nconst works = await response.json();\nconsole.log(works);`} />
                <p className="devdocs-example-label">Python · requests</p>
                <DocsCodeBlock language="python" code={`import os\nimport requests\n\nbase_url = os.environ.get("SLR_API_BASE", "${apiBase}")\nresponse = requests.get(\n    f"{base_url}/public/v1/repository/works",\n    headers={"X-API-Key": os.environ["SLR_API_KEY"]},\n    params={"limit": 20},\n    timeout=30,\n)\nresponse.raise_for_status()\nprint(response.json())`} compact />
              </div>
            </div>
            <div className="devdocs-callout"><strong>Development URL:</strong> Local development uses the configured `/api` proxy. Production examples use the current deployment origin and its configured API base; localhost is never assumed for production.</div>
          </section>

          <section id="explore-api" className="devdocs-section">
            <Heading kicker="API REFERENCE" title="Explore the API" description="Browse the capabilities documented by the active repository API contract." />
            {groups.length ? <div className="devdocs-api-list">{groups.map((group) => <a href={`#reference-${slug(group.name)}`} key={group.name} className="devdocs-api-list__row" onClick={() => setActiveId(`reference-${slug(group.name)}`)}><span className="devdocs-api-list__name">{group.name}</span><span className="devdocs-api-list__description">{group.description || `Explore ${group.operations.length} operations in this group.`}</span><span className="devdocs-api-list__count">{group.operations.length} ops</span></a>)}</div> : <p className="devdocs-muted">API categories appear here after the OpenAPI contract loads.</p>}
          </section>

          <section id="authentication" className="devdocs-section">
            <Heading kicker="ACCESS & SECURITY" title="Authentication" description="Send a user-managed API key in the X-API-Key header for protected repository API operations." />
            <div className="devdocs-auth-grid">
              <div><h3>API client authentication</h3><p>Public documentation can be read without signing in. API requests use an API client key; user session cookies are not a substitute for the documented <code>X-API-Key</code> credential.</p><div className="devdocs-auth__api-key"><code>X-API-Key: $SLR_API_KEY</code></div><ul><li>Keep keys on a trusted server and out of browser bundles.</li><li>Never commit credentials to source control; use environment variables or a secret manager.</li><li>Use least-privilege scopes and rotate or revoke keys through the API key manager when needed.</li></ul></div>
              <div><h3>Available scopes</h3><div className="devdocs-auth-scopes">{Object.entries(scopeDescriptions).map(([scope, description]) => <div key={scope}><code>{scope}</code><span>{description}</span></div>)}</div><p className="devdocs-muted">Self-service keys are read-only. Repository imports require the administrator-provisioned <code>repository:write</code> scope.</p></div>
            </div>
          </section>

          <section id="api-keys" className="devdocs-section">
            <Heading kicker="CREDENTIALS" title="API keys" description="Create and manage your personal repository API keys from your account. A newly created secret is shown once." />
            <p className="devdocs-prose">Keys are scoped to your account. Self-service keys receive the repository read, project read, and analysis read scopes. They do not grant import or other write access.</p>
            {isAuthenticated ? <div className="devdocs-key-actions"><Link to="/profile/api-keys" className="devdocs-secondary-button">Manage API keys</Link><button type="button" className="devdocs-primary-button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? "Close key form" : "Create API key here"}</button></div> : <button type="button" className="devdocs-primary-button" onClick={() => navigate("/auth/signin", { state: { from: "/repository-api-docs" } })}>Sign in to create a key</button>}
            {showCreate && isAuthenticated && <form className="devdocs-key-form" onSubmit={(event) => void createKey(event)}><label className="devdocs-field"><span>Key name</span><input value={keyName} onChange={(event) => setKeyName(event.target.value)} required maxLength={80} placeholder="For example, Local research client" /></label><p className="devdocs-muted">Granted scopes: {defaultScopes.map((scope) => <code key={scope}>{scope} </code>)}</p><button type="submit" className="devdocs-primary-button" disabled={creatingKey || !keyName.trim()}>{creatingKey ? "Creating…" : "Create key"}</button>{keyError && <p role="alert" className="devdocs-alert">{keyError}</p>}</form>}
            {createdKey && <div className="devdocs-key-created" role="status"><strong>Copy this secret now. It will not be shown again.</strong><label className="devdocs-field"><span>New API key</span><input readOnly value={createdKey.secret} onFocus={(event) => event.currentTarget.select()} /></label><p>{createdKey.key.displayName} · {createdKey.key.scopes.join(", ")}</p></div>}
            <label className="devdocs-field devdocs-key-input"><span>API key for Try it out</span><input ref={apiKeyRef} type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Paste a key for this page session"/><small>This key stays in memory for this page session and is sent only in the X-API-Key request header.</small></label>
          </section>

          <section id="pagination" className="devdocs-section">
            <Heading kicker="DEVELOPER GUIDE" title="Cursor pagination" description="Collection operations expose limit and cursor inputs in the API contract. Use the response cursor fields to request the next page." />
            <p className="devdocs-prose">The maximum page size, defaults, and cursor behavior are endpoint-specific; check each operation’s parameter table and response schema. Do not assume an offset or a cursor field when it is absent from that operation’s contract.</p>
            <div className="devdocs-callout"><strong>Tip:</strong> Search repository works with a smaller <code>limit</code> first, then follow the next cursor returned by the endpoint.</div>
          </section>

          <section id="filtering" className="devdocs-section">
            <Heading kicker="DEVELOPER GUIDE" title="Filtering works" description="Use the filters listed on each works operation to narrow a search. The available fields differ by endpoint." />
            <p className="devdocs-prose">The works search and facets operations describe supported query parameters in the live API reference. Query names, types, constraints, and defaults below are read directly from OpenAPI; use those operation tables as the source of truth.</p>
          </section>

          <section id="errors" className="devdocs-section">
            <Heading kicker="DEVELOPER GUIDE" title="Errors & rate limits" description="Handle HTTP errors explicitly and avoid retrying requests faster than the service allows." />
            <div className="devdocs-guides"><article className="devdocs-guide"><h3>Authentication & permissions</h3><p>401 indicates missing or invalid authentication. A 403 indicates the key lacks required access; each endpoint’s OpenAPI response documents its permission requirement.</p></article><article className="devdocs-guide"><h3>Rate limiting</h3><p>The repository API rate limiter allows up to 120 requests per minute per client and IP. A 429 response includes <code>Retry-After</code>; wait for that interval before retrying.</p></article><article className="devdocs-guide"><h3>Retry safely</h3><p>Use bounded retries with backoff for transient network or 5xx errors. Do not blindly retry write operations; imports support an idempotency key in the API contract.</p></article></div>
          </section>

          <section id="api-reference" className="devdocs-section devdocs-reference">
            <div className="devdocs-reference__heading"><div><p className="devdocs-section-kicker">LIVE OPENAPI CONTRACT</p><h2 className="devdocs-section__title">API reference</h2><p className="devdocs-section__description">Endpoints, parameters, request bodies, and responses are generated from the deployed OpenAPI specification.</p></div><label className="devdocs-reference__search"><FiSearch aria-hidden="true" /><input aria-label="Search repository API" value={referenceQuery} onChange={(event) => setReferenceQuery(event.target.value)} placeholder="Search repository works…" /></label></div>
            {!spec && !loadError && <div className="devdocs-loading" role="status"><span />Loading the live API contract…</div>}
            {loadError && !groups.length && <div className="devdocs-empty"><strong>API reference unavailable</strong><p>Could not load the deployed contract. Retry the page or open the OpenAPI JSON directly.</p><a href={jsonUrl} target="_blank" rel="noreferrer">Open API specification</a></div>}
            {spec && !groups.length && <div className="devdocs-empty"><strong>No operations found in the API contract</strong><p>The published OpenAPI document does not contain endpoint definitions.</p></div>}
            {groups.length > 0 && filteredGroups.length === 0 && <p className="devdocs-empty">No endpoints match “{referenceQuery}”.</p>}
            {filteredGroups.map((group) => {
              const groupId = `reference-${slug(group.name)}`;
              return <section id={groupId} className="devdocs-reference__group" key={group.name}><h3>{group.name}</h3><p>{group.description || `${group.operations.length} operations in this API group.`}</p>{group.operations.map((endpoint) => <ApiOperationCard key={endpointId(endpoint)} endpoint={endpoint} spec={spec!} apiBase={apiBase} apiKey={apiKey} onMissingKey={onMissingKey} onSelectEndpoint={setSelectedEndpoint} related={endpoints.filter((candidate) => candidate !== endpoint && candidate.operation.tags?.some((tag) => endpoint.operation.tags?.includes(tag))).slice(0, 4)} />)}</section>;
            })}
          </section>

          <section id="openapi-json" className="devdocs-section">
            <Heading kicker="RESOURCES" title="OpenAPI specification" description="Use the deployed JSON contract with your preferred client generator, API tooling, or contract validation workflow." />
            <div className="devdocs-openapi-link"><code>{jsonUrl}</code><a href={jsonUrl} target="_blank" rel="noreferrer" className="devdocs-secondary-button">Open specification</a></div>
            <p className="devdocs-muted">Contract version {spec?.info?.version || "loading"} · {groups.reduce((count, group) => count + group.operations.length, 0)} documented operations</p>
          </section>
        </main>
        <DocsRightRail activeId={activeId} endpoint={selectedEndpoint || currentEndpoint} group={currentGroup} spec={spec} apiBase={apiBase} onNavigate={navigateTo} />
      </div>
      <DocsSearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} entries={searchEntries} onSelect={(entry) => navigateTo(entry.id)} />
    </div>
  );
}
