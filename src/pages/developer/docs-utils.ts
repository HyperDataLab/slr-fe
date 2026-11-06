import type { Endpoint, OpenApiDocument, Operation, Schema } from "./docs-types";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];

export function collectEndpointGroups(spec: OpenApiDocument | null) {
  if (!spec?.paths) return [];
  const descriptions = new Map((spec.tags || []).map((tag) => [tag.name, tag.description || ""]));
  const grouped = new Map<string, Endpoint[]>();

  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    HTTP_METHODS.forEach((method) => {
      const operation = pathItem[method];
      if (!operation) return;
      const tags = operation.tags?.length ? operation.tags : ["Other"];
      tags.forEach((tag) => {
        const endpoints = grouped.get(tag) || [];
        endpoints.push({ path, method: method.toUpperCase(), operation });
        grouped.set(tag, endpoints);
      });
    });
  });

  return [...grouped.entries()].map(([name, operations]) => ({
    name,
    description: descriptions.get(name) || "",
    operations,
  }));
}

export function resolveSchema(schema: Schema | undefined, spec: OpenApiDocument, depth = 0): Schema {
  if (!schema || depth > 8) return {};
  if (!schema.$ref) {
    if (schema.allOf?.length) return schema.allOf.reduce<Schema>((merged, part) => ({
      ...merged,
      ...resolveSchema(part, spec, depth + 1),
      properties: { ...merged.properties, ...resolveSchema(part, spec, depth + 1).properties },
      required: [...(merged.required || []), ...(resolveSchema(part, spec, depth + 1).required || [])],
    }), schema);
    return schema;
  }

  const target = schema.$ref.split("/").slice(1).reduce<unknown>((current, key) => (
    (current as Record<string, unknown> | undefined)?.[key.replace(/~1/g, "/").replace(/~0/g, "~")]
  ), spec);
  return resolveSchema(target as Schema, spec, depth + 1);
}

export function schemaExample(schema: Schema | undefined, spec: OpenApiDocument, depth = 0): unknown {
  if (!schema || depth > 8) return {};
  const resolved = resolveSchema(schema, spec);
  if (resolved.example !== undefined) return resolved.example;
  if (resolved.default !== undefined) return resolved.default;
  if (resolved.enum?.length) return resolved.enum[0];
  if (resolved.oneOf?.length) return schemaExample(resolved.oneOf[0], spec, depth + 1);
  if (resolved.anyOf?.length) return schemaExample(resolved.anyOf[0], spec, depth + 1);
  if (resolved.type === "array") return resolved.items ? [schemaExample(resolved.items, spec, depth + 1)] : [];
  if (resolved.type === "object" || resolved.properties) {
    return Object.fromEntries(Object.entries(resolved.properties || {}).map(([key, value]) => [key, schemaExample(value, spec, depth + 1)]));
  }
  if (resolved.type === "integer" || resolved.type === "number") return resolved.minimum ?? 1;
  if (resolved.type === "boolean") return false;
  if (resolved.type === "string") return resolved.format === "binary" ? null : "string";
  return {};
}

export function operationExample(operation: Operation, spec: OpenApiDocument) {
  const preferred = operation.responses?.["200"] || operation.responses?.["201"] || Object.values(operation.responses || {})[0];
  const media = preferred?.content?.["application/json"] || Object.values(preferred?.content || {})[0];
  return media?.example ?? schemaExample(media?.schema, spec);
}

export function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function endpointId(endpoint: Endpoint) {
  return `endpoint-${slug(`${endpoint.method}-${endpoint.path}`)}`;
}

export function describeSchema(schema: Schema | undefined, spec: OpenApiDocument): string {
  const resolved = resolveSchema(schema, spec);
  const union = resolved.oneOf || resolved.anyOf;
  if (union?.length) return union.map((entry): string => describeSchema(entry, spec)).join(" | ");
  const type = resolved.type || (resolved.properties ? "object" : "any");
  return resolved.nullable ? `${type} | null` : type;
}

export function constraintText(schema: Schema | undefined, spec: OpenApiDocument) {
  const resolved = resolveSchema(schema, spec);
  return [
    resolved.format,
    resolved.enum?.length ? `one of ${resolved.enum.join(", ")}` : "",
    resolved.minimum !== undefined ? `min ${resolved.minimum}` : "",
    resolved.maximum !== undefined ? `max ${resolved.maximum}` : "",
    resolved.minLength !== undefined ? `min length ${resolved.minLength}` : "",
    resolved.maxLength !== undefined ? `max length ${resolved.maxLength}` : "",
    resolved.pattern ? `pattern ${resolved.pattern}` : "",
  ].filter(Boolean).join(" · ");
}

export function buildCurl(endpoint: Endpoint, apiBase: string, body?: unknown) {
  const path = endpoint.path.replace(/\{([^}]+)\}/g, (_match, name: string) => `\${${name.replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase()}}`);
  const isMultipart = Object.keys(endpoint.operation.requestBody?.content || {}).includes("multipart/form-data");
  const query = new URLSearchParams();
  (endpoint.operation.parameters || [])
    .filter((parameter) => parameter.in === "query")
    .forEach((parameter) => {
      const value = parameter.example ?? parameter.schema?.example ?? parameter.schema?.default;
      if (value !== undefined) query.set(parameter.name, String(value));
    });
  const queryString = query.size ? `?${query.toString()}` : "";
  const args = [
    `curl --request ${endpoint.method} "${apiBase}${path}${queryString}"`,
    '  --header "X-API-Key: $SLR_API_KEY"',
    '  --header "Accept: application/json"',
  ];
  if (endpoint.operation.requestBody && isMultipart) {
    args.push('  --form "pdf=@./paper.pdf"');
  } else if (body !== undefined && endpoint.operation.requestBody) {
    args.push('  --header "Content-Type: application/json"');
    args.push(`  --data '${JSON.stringify(body, null, 2).replace(/'/g, "'\\''")}'`);
  }
  return `# Set SLR_API_BASE, SLR_API_KEY, and path variables before running\n${args.join(" \\\n")}`;
}

export function languageExample(language: "curl" | "javascript" | "python", endpoint: Endpoint, apiBase: string, body?: unknown) {
  if (language === "curl") return buildCurl(endpoint, apiBase, body);
  const path = language === "python"
    ? endpoint.path.replace(/\{([^}]+)\}/g, (_match, name: string) => `{${name}}`)
    : endpoint.path.replace(/\{([^}]+)\}/g, (_match, name: string) => `\${${name}}`);
  const sampleBody = endpoint.operation.requestBody && body !== undefined ? JSON.stringify(body, null, 2) : undefined;
  const queryExample = Object.fromEntries((endpoint.operation.parameters || [])
    .filter((parameter) => parameter.in === "query")
    .flatMap((parameter) => {
      const value = parameter.example ?? parameter.schema?.example ?? parameter.schema?.default;
      return value === undefined ? [] : [[parameter.name, value]];
    }));
  if (language === "python") {
    return `import os\nimport requests\n\nbase_url = os.environ.get("SLR_API_BASE", "${apiBase}")\nresponse = requests.request(\n    "${endpoint.method}",\n    f"{base_url}${path}",\n    headers={"X-API-Key": os.environ["SLR_API_KEY"], "Accept": "application/json"},${Object.keys(queryExample).length ? `\n    params=${JSON.stringify(queryExample)},` : ""}${sampleBody ? `\n    json=${sampleBody},` : ""}\n    timeout=30,\n)\nresponse.raise_for_status()\nprint(response.json())`;
  }
  return `const baseUrl = process.env.SLR_API_BASE || "${apiBase}";\nconst query = new URLSearchParams(${JSON.stringify(queryExample)});\nconst url = \`${"${baseUrl}"}${path}\` + (query.toString() ? \`?\${query}\` : "");\nconst response = await fetch(url, {\n  method: "${endpoint.method}",\n  headers: {\n    "X-API-Key": process.env.SLR_API_KEY,\n    "Accept": "application/json",${sampleBody ? `\n    "Content-Type": "application/json",` : ""}\n  },${sampleBody ? `\n  body: JSON.stringify(${sampleBody}),` : ""}\n});\n\nif (!response.ok) throw new Error(await response.text());\nconsole.log(await response.json());`;
}
