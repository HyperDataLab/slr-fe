import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import Button from "../../../../components/ui/Button";
import { getErrorMessage } from "../../../../utils/errorUtils";
import {
  SLR_FIELD_ROLES,
  slrArtifactsService,
  type SlrContextGroupBy,
  type SlrGenerateOptions,
} from "../../../../services/slrArtifactsService";
import {
  DEFAULT_FORM_STATE,
  EXCLUDE_FIELD,
  buildGenerateOptions,
  dimensionChoices,
  type GenerateFormState,
} from "./generateOptions";

const CONTEXT_GROUPS: Array<{ value: SlrContextGroupBy; label: string }> = [
  { value: "outcome", label: "Outcome" },
  { value: "intervention", label: "Intervention" },
  { value: "population_context", label: "Population context" },
  { value: "context", label: "Context" },
];

const controlClass = "mt-1 block h-10 w-full rounded-lg border border-border bg-surface-white px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="block text-xs font-medium text-text-secondary">{label}{children}{hint && <span className="mt-1 block font-normal text-text-muted">{hint}</span>}</label>;
}

interface GenerateOptionsPanelProps {
  projectId: string;
  isSubmitting: boolean;
  /** Error from the last generate attempt, e.g. an unknown field or a missing AI key. */
  submitError: string | null;
  onSubmit: (options: SlrGenerateOptions) => void;
  onCancel: () => void;
}

/** Leader-only form for the A1–A10 generation options. The live corpus is read once, when the form opens. */
export default function GenerateOptionsPanel({ projectId, isSubmitting, submitError, onSubmit, onCancel }: GenerateOptionsPanelProps) {
  const [state, setState] = useState<GenerateFormState>(DEFAULT_FORM_STATE);
  const [validationError, setValidationError] = useState<string | null>(null);
  const corpusQuery = useQuery({
    queryKey: ["slr-artifact-corpus-options", projectId],
    queryFn: () => slrArtifactsService.getCorpusOptions(projectId),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const corpus = corpusQuery.data;
  const choices = useMemo(() => dimensionChoices(corpus), [corpus]);
  const fields = useMemo(() => {
    const seen = new Map<string, { id: string; label: string }>();
    for (const binding of corpus?.field_roles ?? []) seen.set(binding.field_id, { id: binding.field_id, label: `${binding.section_name} › ${binding.field_name}` });
    return [...seen.values()];
  }, [corpus]);
  const set = <K extends keyof GenerateFormState>(key: K, value: GenerateFormState[K]) => {
    setValidationError(null);
    setState((current) => ({ ...current, [key]: value }));
  };

  const submit = () => {
    const built = buildGenerateOptions(state);
    if (built.error !== undefined) {
      setValidationError(built.error);
      return;
    }
    setValidationError(null);
    onSubmit(built.options);
  };

  const error = validationError ?? submitError;
  return <section aria-label="Generate options" className="space-y-4 rounded-xl border border-border bg-surface-white p-4">
    <h3 className="font-semibold text-text-primary">Generation options</h3>
    {corpusQuery.isLoading && <p className="text-sm text-text-muted" role="status">Reading the project corpus…</p>}
    {corpusQuery.error != null && <p role="alert" className="text-sm text-warning">Project fields could not be loaded ({getErrorMessage(corpusQuery.error, "corpus unavailable")}). You can still generate with the defaults.</p>}
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="A3 argument graph" hint="AI mode sends a request through OpenRouter for A3. The other artifacts are built from the corpus in the backend.">
        <select className={controlClass} value={state.a3Mode} onChange={(event) => set("a3Mode", event.target.value === "ai" ? "ai" : "deterministic")}>
          <option value="deterministic">Deterministic (from extracted evidence)</option>
          <option value="ai">AI-assisted</option>
        </select>
      </Field>
      <Field label="Research question">
        <select className={controlClass} value={state.researchQuestionId} onChange={(event) => set("researchQuestionId", event.target.value)}>
          <option value="">All research questions</option>
          {(corpus?.research_questions ?? []).map((question) => <option key={question.rq_id} value={question.rq_id}>{question.code ? `${question.code} · ` : ""}{question.question}</option>)}
        </select>
      </Field>
    </div>
    <details className="group rounded-lg border border-border/70 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-text-primary">More options <span className="font-normal text-text-muted">· A5 grouping, gap map, field roles</span></summary>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Field label="A5 grouping">
          <select className={controlClass} value={state.contextGroupBy} onChange={(event) => set("contextGroupBy", event.target.value as SlrContextGroupBy)}>
            {CONTEXT_GROUPS.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
          </select>
        </Field>
        <Field label="Sparse threshold (1–20)">
          <input type="number" min={1} max={20} step={1} className={controlClass} value={state.sparseThreshold} onChange={(event) => set("sparseThreshold", event.target.value)} />
        </Field>
        <Field label="Gap map rows">
          <select className={controlClass} value={state.gapRows} onChange={(event) => set("gapRows", event.target.value)} disabled={!choices.length}>
            <option value="">Not configured</option>
            {choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
          </select>
        </Field>
        <Field label="Gap map columns">
          <select className={controlClass} value={state.gapColumns} onChange={(event) => set("gapColumns", event.target.value)} disabled={!choices.length}>
            <option value="">Not configured</option>
            {choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
          </select>
        </Field>
      </div>
      {fields.length > 0 && <div className="mt-4 border-t border-border/70 pt-3">
        <p className="text-xs font-medium text-text-secondary">Field roles <span className="font-normal text-text-muted">· leave on Automatic unless a detected role is wrong</span></p>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {fields.map((field) => <Field key={field.id} label={field.label}>
            <select className={controlClass} value={state.fieldRoles[field.id] ?? ""} onChange={(event) => set("fieldRoles", { ...state.fieldRoles, [field.id]: event.target.value })}>
              <option value="">Automatic</option>
              <option value={EXCLUDE_FIELD}>Exclude from synthesis</option>
              {SLR_FIELD_ROLES.map((role) => <option key={role} value={role}>{role.replace(/_/g, " ")}</option>)}
            </select>
          </Field>)}
        </div>
      </div>}
    </details>
    {error && <p role="alert" className="rounded-lg border border-error/30 bg-error/5 p-3 text-sm text-text-secondary">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
      <Button onClick={submit} isLoading={isSubmitting}><RefreshCw className="h-4 w-4" />Generate A1–A10</Button>
    </div>
  </section>;
}
