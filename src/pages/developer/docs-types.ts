export type Schema = {
  $ref?: string;
  type?: string;
  format?: string;
  description?: string;
  example?: unknown;
  default?: unknown;
  enum?: unknown[];
  properties?: Record<string, Schema>;
  items?: Schema;
  required?: string[];
  oneOf?: Schema[];
  anyOf?: Schema[];
  allOf?: Schema[];
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  [key: string]: unknown;
};

export type Parameter = {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: Schema;
  example?: unknown;
};

export type MediaType = { schema?: Schema; example?: unknown };
export type ApiResponse = {
  description?: string;
  content?: Record<string, MediaType>;
  headers?: Record<string, { description?: string; schema?: Schema }>;
};

export type Operation = {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: Parameter[];
  requestBody?: { required?: boolean; content?: Record<string, MediaType> };
  responses?: Record<string, ApiResponse>;
  security?: Record<string, string[]>[];
  deprecated?: boolean;
};

export type OpenApiDocument = {
  openapi?: string;
  info?: { title?: string; description?: string; version?: string };
  servers?: { url: string; description?: string }[];
  tags?: { name: string; description?: string }[];
  security?: Record<string, string[]>[];
  paths?: Record<string, Record<string, Operation>>;
  components?: Record<string, unknown>;
};

export type Endpoint = { path: string; method: string; operation: Operation };
export type EndpointGroup = { name: string; description: string; operations: Endpoint[] };
