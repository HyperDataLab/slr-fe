import { useMemo, useState } from "react";
import type { Endpoint, EndpointGroup, OpenApiDocument } from "../docs-types";
import { languageExample, operationExample, slug } from "../docs-utils";
import DocsCodeBlock from "./DocsCodeBlock";
import HttpMethodBadge from "./HttpMethodBadge";

type ExampleLanguage = "curl" | "javascript" | "python";
const languages: { id: ExampleLanguage; label: string }[] = [
  { id: "curl", label: "cURL" },
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python" },
];

export default function DocsRightRail({
  activeId,
  endpoint,
  group,
  spec,
  apiBase,
  onNavigate,
}: {
  activeId: string;
  endpoint?: Endpoint;
  group?: EndpointGroup;
  spec: OpenApiDocument | null;
  apiBase: string;
  onNavigate: (id: string) => void;
}) {
  const [language, setLanguage] = useState<ExampleLanguage>("curl");
  const showCode = activeId === "quickstart" || activeId === "api-reference" || activeId.startsWith("reference-");
  const defaultEndpoint = useMemo(() => {
    if (endpoint) return endpoint;
    const workGroup = group?.operations || [];
    return workGroup.find((item) => item.path.endsWith("/works") && item.method === "GET") || workGroup[0];
  }, [endpoint, group]);
  const response = defaultEndpoint && spec ? operationExample(defaultEndpoint.operation, spec) : undefined;
  const responseStatuses = defaultEndpoint ? Object.keys(defaultEndpoint.operation.responses || {}) : [];
  const firstResponse = defaultEndpoint?.operation.responses?.[responseStatuses.find((status) => status.startsWith("2")) || responseStatuses[0] || ""];
  const responseMedia = firstResponse?.content?.["application/json"] || Object.values(firstResponse?.content || {})[0];
  const code = defaultEndpoint
    ? languageExample(language, defaultEndpoint, apiBase, (() => {
      const request = defaultEndpoint.operation.requestBody?.content;
      const media = request?.["application/json"] || Object.values(request || {})[0];
      return media?.example;
    })())
    : `curl --get "${apiBase}/public/v1/repository/works" \\\n+  --header "X-API-Key: $SLR_API_KEY" \\\n+  --data-urlencode "limit=20"`;

  return (
    <aside className="devdocs-rail" aria-label="Code example and page contents">
      {showCode ? (
        <div className="devdocs-rail__code">
          <div className="devdocs-rail__heading"><span>{defaultEndpoint ? `${defaultEndpoint.method} ${defaultEndpoint.path}` : "First request"}</span><span className="devdocs-rail__live"><i /> contract-backed</span></div>
          <div className="devdocs-rail__language" role="tablist" aria-label="Code language">
            {languages.map((item) => <button type="button" role="tab" aria-selected={language === item.id} key={item.id} className={language === item.id ? "is-active" : ""} onClick={() => setLanguage(item.id)}>{item.label}</button>)}
          </div>
          <DocsCodeBlock language={language === "javascript" ? "javascript" : language} code={code} />
          {defaultEndpoint && <div className="devdocs-rail__response">
            <div><span>{responseMedia?.example !== undefined ? "Example response" : "Response schema preview"}</span><span>{responseStatuses[0] || "200"} · JSON</span></div>
            <DocsCodeBlock language="json" code={JSON.stringify(response ?? {}, null, 2)} compact />
          </div>}
          <p className="devdocs-rail__note"><strong>Environment base</strong><code>{apiBase}</code><span>API requests use this deployment’s configured base URL.</span></p>
          {defaultEndpoint && <a className="devdocs-rail__reference-link" href={`#endpoint-${slug(`${defaultEndpoint.method}-${defaultEndpoint.path}`)}`}>View endpoint details <span aria-hidden="true">↗</span></a>}
        </div>
      ) : (
        <div className="devdocs-rail__toc">
          <h2>On this page</h2>
          <a href="#introduction" onClick={() => onNavigate("introduction")}>Introduction</a>
          <a href="#quickstart" onClick={() => onNavigate("quickstart")}>Quickstart</a>
          <a href="#explore-api" onClick={() => onNavigate("explore-api")}>Explore the API</a>
          <a href="#authentication" onClick={() => onNavigate("authentication")}>Authentication</a>
          <a href="#api-keys" onClick={() => onNavigate("api-keys")}>API keys</a>
          <a href="#pagination" onClick={() => onNavigate("pagination")}>Cursor pagination</a>
          <a href="#filtering" onClick={() => onNavigate("filtering")}>Filtering works</a>
          <a href="#errors" onClick={() => onNavigate("errors")}>Errors & rate limits</a>
          {spec?.tags?.length ? <div className="devdocs-rail__toc-related"><span>API reference</span>{spec.tags.map((tag) => <a key={tag.name} href={`#reference-${slug(tag.name)}`} onClick={() => onNavigate(`reference-${slug(tag.name)}`)}>{tag.name}</a>)}</div> : null}
        </div>
      )}
      {endpoint && <div className="devdocs-rail__selected"><HttpMethodBadge method={endpoint.method} /><code>{endpoint.path}</code></div>}
    </aside>
  );
}
