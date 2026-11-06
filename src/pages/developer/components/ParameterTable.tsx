import type { OpenApiDocument, Parameter } from "../docs-types";
import { constraintText, describeSchema } from "../docs-utils";

export default function ParameterTable({ parameters, spec }: { parameters: Parameter[]; spec: OpenApiDocument }) {
  if (!parameters.length) return <p className="devdocs-muted">This endpoint does not accept parameters.</p>;

  return (
    <div className="devdocs-table-wrap">
      <table className="devdocs-table">
        <thead><tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
        <tbody>
          {parameters.map((parameter) => (
            <tr key={`${parameter.in}-${parameter.name}`}>
              <td><code>{parameter.name}</code><span className="devdocs-table__location">{parameter.in}</span></td>
              <td>
                <code>{describeSchema(parameter.schema, spec)}</code>
                {constraintText(parameter.schema, spec) && <span className="devdocs-table__constraint">{constraintText(parameter.schema, spec)}</span>}
              </td>
              <td>{parameter.required ? <span className="devdocs-required">Required</span> : <span className="devdocs-muted">Optional</span>}</td>
              <td>{parameter.description || parameter.schema?.description || "—"}{parameter.schema?.default !== undefined && <span className="devdocs-table__constraint">Default: <code>{String(parameter.schema.default)}</code></span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
