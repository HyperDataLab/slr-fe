import { useMemo, useState } from "react";
import { FiCheck, FiCopy, FiPlay, FiRotateCcw } from "react-icons/fi";
import type { Endpoint, OpenApiDocument } from "../docs-types";
import { endpointId, resolveSchema, schemaExample } from "../docs-utils";
import DocsCodeBlock from "./DocsCodeBlock";
import HttpMethodBadge from "./HttpMethodBadge";
import ParameterTable from "./ParameterTable";

function getScopeNote(endpoint: Endpoint) {
  const description = endpoint.operation.responses?.["403"]?.description || "";
  const match = description.match(/(?:key|client) must have (.+?)\s+scope(?:s)?\.?/i);
  return match?.[1] ? match[1].replace(/\s+and\s+/g, " + ") : "See the 403 response for this operation's permission details.";
}

function createBodyExample(endpoint: Endpoint, spec: OpenApiDocument) {
  const content = endpoint.operation.requestBody?.content || {};
  const media = content["application/json"] || Object.values(content)[0];
  return media?.example ?? schemaExample(media?.schema, spec);
}

export default function ApiOperationCard({
  endpoint,
  spec,
  apiBase,
  apiKey,
  onMissingKey,
  onSelectEndpoint,
  related,
}: {
  endpoint: Endpoint;
  spec: OpenApiDocument;
  apiBase: string;
  apiKey: string;
  onMissingKey: () => void;
  onSelectEndpoint: (endpoint: Endpoint) => void;
  related: Endpoint[];
}) {
  const id = endpointId(endpoint);
  const parameters = endpoint.operation.parameters || [];
  const content = endpoint.operation.requestBody?.content || {};
  const contentType = Object.keys(content).includes("application/json") ? "application/json" : Object.keys(content)[0];
  const media = contentType ? content[contentType] : undefined;
  const multipart = contentType === "multipart/form-data";
  const requestSchema = resolveSchema(media?.schema, spec);
  const formProperties = Object.entries(requestSchema.properties || {});
  const [values, setValues] = useState<Record<string, string>>({});
  const [fileValues, setFileValues] = useState<Record<string, File | null>>({});
  const [body, setBody] = useState(() => JSON.stringify(createBodyExample(endpoint, spec), null, 2));
  const [response, setResponse] = useState("");
  const [responseJson, setResponseJson] = useState(false);
  const [responseHeaders, setResponseHeaders] = useState<[string, string][]>([]);
  const [responseStatus, setResponseStatus] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [requestId, setRequestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const displayResponses = useMemo(() => Object.entries(endpoint.operation.responses || {}), [endpoint.operation.responses]);
  const security = endpoint.operation.security ?? spec.security;
  const authRequired = Boolean(security?.length);

  const copyEndpoint = async () => {
    try {
      await navigator.clipboard.writeText(`${apiBase}${endpoint.path}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch { setCopied(false); }
  };

  const send = async () => {
    if (authRequired && !apiKey.trim()) { onMissingKey(); setError("Add an API key to send this request."); return; }
    if (endpoint.method !== "GET" && !window.confirm(`Send ${endpoint.method} ${endpoint.path}? This request can change repository data.`)) return;
    setBusy(true);
    setError("");
    setResponse("");
    const startedAt = performance.now();
    try {
      let requestPath = endpoint.path;
      const query = new URLSearchParams();
      const headers: Record<string, string> = { Accept: "application/json" };
      if (apiKey.trim()) headers["X-API-Key"] = apiKey.trim();
      parameters.forEach((parameter) => {
        const value = values[`${parameter.in}:${parameter.name}`]?.trim();
        if (!value) return;
        if (parameter.in === "path") requestPath = requestPath.replace(`{${parameter.name}}`, encodeURIComponent(value));
        if (parameter.in === "query") query.set(parameter.name, value);
        if (parameter.in === "header") headers[parameter.name] = value;
      });
      if (/\{[^}]+\}/.test(requestPath)) throw new Error("Fill in every required path parameter before sending.");

      const url = new URL(`${apiBase}${requestPath}`);
      query.forEach((value, name) => url.searchParams.set(name, value));
      const init: RequestInit = { method: endpoint.method, headers };
      if (endpoint.operation.requestBody && multipart) {
        const form = new FormData();
        formProperties.forEach(([name, schema]) => {
          const property = resolveSchema(schema, spec);
          const file = fileValues[name];
          const value = values[`body:${name}`];
          if (property.format === "binary") { if (file) form.append(name, file); }
          else if (value !== undefined && value !== "") form.append(name, value);
        });
        init.body = form;
      } else if (endpoint.operation.requestBody && contentType === "application/x-www-form-urlencoded") {
        const fields = JSON.parse(body || "{}") as Record<string, string>;
        headers["Content-Type"] = contentType;
        init.body = new URLSearchParams(Object.entries(fields).map(([name, value]) => [name, String(value)]));
      } else if (endpoint.operation.requestBody) {
        headers["Content-Type"] = contentType || "application/json";
        JSON.parse(body || "{}");
        init.body = body || "{}";
      }

      const result = await fetch(url, init);
      const type = result.headers.get("content-type") || "";
      const safeHeaders = [...result.headers.entries()];
      const responseText = type.includes("json")
        ? JSON.stringify(await result.json(), null, 2)
        : type.includes("text") ? await result.text() : `Binary response · ${type || "unknown content type"} · ${result.headers.get("content-length") || "size unavailable"} bytes`;
      setResponse(responseText);
      setResponseJson(type.includes("json"));
      setResponseHeaders(safeHeaders);
      setResponseStatus(`${result.status} ${result.statusText}`.trim());
      setRequestId(result.headers.get("x-request-id") || "");
      setDuration(Math.round(performance.now() - startedAt));
    } catch (cause) {
      setDuration(Math.round(performance.now() - startedAt));
      setError(cause instanceof TypeError
        ? `Could not connect to ${apiBase}. Check the API URL and CORS configuration.`
        : cause instanceof Error ? cause.message : "Could not send request.");
    } finally { setBusy(false); }
  };

  return (
    <details id={id} className="devdocs-endpoint" onToggle={(event) => { if (event.currentTarget.open) onSelectEndpoint(endpoint); }}>
      <summary className="devdocs-endpoint__summary">
        <HttpMethodBadge method={endpoint.method} />
        <code>{endpoint.path}</code>
        <span>{endpoint.operation.summary || endpoint.operation.operationId || "Endpoint"}</span>
        {endpoint.operation.deprecated && <em>Deprecated</em>}
      </summary>
      <div className="devdocs-endpoint__body">
        <div className="devdocs-endpoint__toolbar">
          <span className="devdocs-endpoint__auth"><span aria-hidden="true" /> {authRequired ? <>API key required · <code>X-API-Key</code></> : "No authentication required by this operation"}</span>
          <button type="button" className="devdocs-text-button" onClick={() => void copyEndpoint()}>{copied ? <FiCheck /> : <FiCopy />}{copied ? "Copied" : "Copy URL"}</button>
        </div>
        {endpoint.operation.description && <p className="devdocs-prose">{endpoint.operation.description}</p>}
        <p className="devdocs-endpoint__scope"><strong>Permission:</strong> {getScopeNote(endpoint)}</p>
        {parameters.length > 0 && <section className="devdocs-endpoint__section"><h4>Parameters</h4><ParameterTable parameters={parameters} spec={spec} /></section>}
        {endpoint.operation.requestBody && (
          <section className="devdocs-endpoint__section">
            <h4>Request body <small>{contentType || "application/json"}{endpoint.operation.requestBody.required ? " · required" : " · optional"}</small></h4>
            {multipart ? (
              <ParameterTable parameters={formProperties.map(([name, schema]) => ({ name, in: "formData", required: requestSchema.required?.includes(name), description: resolveSchema(schema, spec).description, schema }))} spec={spec} />
            ) : <DocsCodeBlock language="json" code={JSON.stringify(media?.example ?? schemaExample(media?.schema, spec), null, 2)} compact />}
          </section>
        )}
        <section className="devdocs-endpoint__section devdocs-playground">
          <div className="devdocs-endpoint__section-heading"><div><h4>Try this request</h4><p>Runs from this browser with the key you enter above. The key stays in page memory.</p></div><button type="button" onClick={() => void send()} disabled={busy} className="devdocs-primary-button"><FiPlay aria-hidden="true" />{busy ? "Sending…" : "Send request"}</button></div>
          {parameters.length > 0 && <div className="devdocs-playground__params">{parameters.map((parameter) => {
            const schema = resolveSchema(parameter.schema, spec);
            const key = `${parameter.in}:${parameter.name}`;
            const type = schema.type === "integer" || schema.type === "number" ? "number" : "text";
            return <label key={key} className="devdocs-field"><span>{parameter.name}<small>{parameter.in}{parameter.required ? " · required" : " · optional"}</small></span><input aria-label={`${parameter.name} ${parameter.in}`} type={type} required={parameter.required} value={values[key] || ""} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} placeholder={String(parameter.example ?? schema.example ?? schema.default ?? "")} /></label>;
          })}</div>}
          {endpoint.operation.requestBody && multipart && <div className="devdocs-playground__params">{formProperties.map(([name, fieldSchema]) => {
            const property = resolveSchema(fieldSchema, spec);
            return <label key={name} className="devdocs-field"><span>{name}<small>{property.format === "binary" ? "file upload" : property.type || "text"}</small></span>{property.format === "binary" ? <input type="file" aria-label={name} onChange={(event) => setFileValues((current) => ({ ...current, [name]: event.target.files?.[0] || null }))} /> : <input aria-label={name} value={values[`body:${name}`] || ""} onChange={(event) => setValues((current) => ({ ...current, [`body:${name}`]: event.target.value }))} />}</label>;
          })}</div>}
          {endpoint.operation.requestBody && !multipart && <label className="devdocs-field"><span>Request body JSON</span><textarea aria-label="Request body JSON" spellCheck={false} value={body} onChange={(event) => setBody(event.target.value)} rows={8} /></label>}
          <div className="devdocs-playground__actions"><button type="button" onClick={() => { setValues({}); setFileValues({}); setBody(JSON.stringify(createBodyExample(endpoint, spec), null, 2)); setResponse(""); setResponseStatus(""); setResponseHeaders([]); setError(""); }} className="devdocs-text-button"><FiRotateCcw />Reset request</button><span>Request URL is built from the configured API environment.</span></div>
          {error && <p className="devdocs-alert" role="alert">{error}</p>}
          {responseStatus && <div className="devdocs-response" aria-live="polite"><div className="devdocs-response__meta"><strong>{responseStatus}</strong><span>{duration} ms</span>{requestId && <span>Request ID <code>{requestId}</code></span>}</div>
            {responseHeaders.length > 0 && <details className="devdocs-response__headers"><summary>Response headers</summary><dl>{responseHeaders.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></details>}
            <DocsCodeBlock language={responseJson ? "json" : "text"} code={response} label="Response" compact />
          </div>}
        </section>
        <section className="devdocs-endpoint__section"><h4>Responses</h4>
          {displayResponses.length ? displayResponses.map(([status, item], index) => {
            const responseMedia = item.content?.["application/json"] || Object.values(item.content || {})[0];
            const sample = responseMedia?.example ?? schemaExample(responseMedia?.schema, spec);
            const sampleLabel = responseMedia?.example !== undefined ? "Example response" : "Schema-derived preview · values are illustrative";
            return <details key={status} className="devdocs-status" open={status.startsWith("2") && index === 0}>
              <summary><span className={`devdocs-status__code ${status.startsWith("2") ? "is-success" : status.startsWith("4") ? "is-client-error" : "is-server-error"}`}>{status}</span><span>{item.description || "Response"}</span><small>{Object.keys(item.content || {})[0] || "No response body"}</small></summary>
              {responseMedia && <DocsCodeBlock language="json" label={sampleLabel} code={JSON.stringify(sample, null, 2)} compact />}
            </details>;
          }) : <p className="devdocs-muted">No response examples are defined in the contract.</p>}
        </section>
        {related.length > 0 && <section className="devdocs-endpoint__section"><h4>Related endpoints</h4><div className="devdocs-related">{related.slice(0, 4).map((item) => <button type="button" key={endpointId(item)} onClick={() => { document.getElementById(endpointId(item))?.scrollIntoView({ behavior: "smooth", block: "start" }); document.getElementById(endpointId(item))?.setAttribute("open", ""); onSelectEndpoint(item); }}><HttpMethodBadge method={item.method} /><code>{item.path}</code></button>)}</div></section>}
      </div>
    </details>
  );
}
