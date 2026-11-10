import {
  SLR_FIELD_ROLES,
  type SlrContextGroupBy,
  type SlrCorpusOptions,
  type SlrDimensionRef,
  type SlrFieldRole,
  type SlrGenerateOptions,
} from "../../../../services/slrArtifactsService";

export const EXCLUDE_FIELD = "__exclude";

export interface GenerateFormState {
  a3Mode: "deterministic" | "ai";
  /** Empty means all research questions. */
  researchQuestionId: string;
  contextGroupBy: SlrContextGroupBy;
  sparseThreshold: string;
  /** `""`, `role:<role>` or `field:<fieldId>`. */
  gapRows: string;
  gapColumns: string;
  /** Field id -> `""` (automatic), `EXCLUDE_FIELD` or a role. */
  fieldRoles: Record<string, string>;
}

export const DEFAULT_FORM_STATE: GenerateFormState = {
  a3Mode: "ai",
  researchQuestionId: "",
  contextGroupBy: "outcome",
  sparseThreshold: "1",
  gapRows: "",
  gapColumns: "",
  fieldRoles: {},
};

const isRole = (value: string): value is SlrFieldRole => (SLR_FIELD_ROLES as readonly string[]).includes(value);

/** Reads a `role:x` / `field:id` choice; the id may itself contain colons. */
export function parseDimension(value: string): SlrDimensionRef | null {
  const separator = value.indexOf(":");
  if (separator < 0) return null;
  const kind = value.slice(0, separator);
  const rest = value.slice(separator + 1);
  if (kind === "role" && isRole(rest)) return { role: rest };
  if (kind === "field" && rest) return { field_id: rest };
  return null;
}

export type BuiltOptions = { options: SlrGenerateOptions; error?: undefined } | { options?: undefined; error: string };

/** Turns the form into request options; rejects what the server would reject. */
export function buildGenerateOptions(state: GenerateFormState): BuiltOptions {
  const threshold = Number(state.sparseThreshold);
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 20) {
    return { error: "Sparse threshold must be a whole number from 1 to 20." };
  }
  const rows = parseDimension(state.gapRows);
  const columns = parseDimension(state.gapColumns);
  if (Boolean(rows) !== Boolean(columns)) {
    return { error: "Choose both gap map rows and columns, or leave both unset." };
  }
  const options: SlrGenerateOptions = {
    a3Mode: state.a3Mode,
    contextGroupBy: state.contextGroupBy,
    sparseThreshold: threshold,
  };
  if (state.researchQuestionId) options.researchQuestionId = state.researchQuestionId;
  if (rows && columns) options.gapMap = { rows, columns };
  const fieldRoles: Record<string, SlrFieldRole | null> = {};
  for (const [fieldId, choice] of Object.entries(state.fieldRoles)) {
    if (choice === EXCLUDE_FIELD) fieldRoles[fieldId] = null;
    else if (isRole(choice)) fieldRoles[fieldId] = choice;
  }
  if (Object.keys(fieldRoles).length > 0) options.fieldRoles = fieldRoles;
  return { options };
}

export interface DimensionChoice {
  value: string;
  label: string;
}

/** Roles and fields the corpus really has, so the gap map never points at nothing. */
export function dimensionChoices(corpus: SlrCorpusOptions | undefined): DimensionChoice[] {
  if (!corpus) return [];
  const roles = [...new Set(corpus.field_roles.flatMap((binding) => (binding.role ? [binding.role] : [])))];
  const fields = new Map<string, string>();
  for (const binding of corpus.field_roles) {
    fields.set(binding.field_id, `${binding.section_name} › ${binding.field_name}`);
  }
  return [
    ...roles.map((role) => ({ value: `role:${role}`, label: `Role: ${role.replace(/_/g, " ")}` })),
    ...[...fields].map(([fieldId, label]) => ({ value: `field:${fieldId}`, label: `Field: ${label}` })),
  ];
}
