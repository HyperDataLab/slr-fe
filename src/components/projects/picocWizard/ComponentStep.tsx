import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiAlertTriangle, FiCheck, FiHelpCircle, FiPlus, FiRefreshCw, FiX } from "react-icons/fi";
import { picocWizardStateService } from "../../../services/picocWizardStateService";
import {
  addCustomTerm,
  applyReviewFlags,
  buildSuggestionRequest,
  COMPONENT_LABELS,
  COMPONENT_QUESTIONS,
  keepItem,
  normalizeLabel,
  ORIGIN_LABELS,
  removeItem,
  setComparisonNotApplicable,
  setSuggestionState,
  upstreamSignature,
} from "./picocDraft";
import type { PicocComponent, PicocItem, PicocSuggestion, PicocSuggestionResponse, PicocWizardDraft } from "./types";

export interface SuggestionCacheEntry {
  signature: string;
  suggestions: PicocSuggestion[];
  source: PicocSuggestionResponse["source"];
  fallbackReason: string | null;
}

interface ComponentStepProps {
  projectId: string;
  component: PicocComponent;
  draft: PicocWizardDraft;
  update: (change: (current: PicocWizardDraft) => PicocWizardDraft) => void;
  /** Suggestions per component, kept by the wizard so revisiting a step does not re-query the AI. */
  cache: Partial<Record<PicocComponent, SuggestionCacheEntry>>;
  onGenerateAll?: () => void;
  batchLoading?: boolean;
}

const ComponentStep: React.FC<ComponentStepProps> = ({ projectId, component, draft, update, cache, onGenerateAll = () => undefined, batchLoading = false }) => {
  const signature = useMemo(() => upstreamSignature(draft, component), [draft, component]);
  const draftRef = useRef(draft);
  useEffect(() => { draftRef.current = draft; }, [draft]);
  const cached = cache[component];
  const [entry, setEntry] = useState<SuggestionCacheEntry | undefined>(cached);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState(false);
  const [moreMessage, setMoreMessage] = useState<string | null>(null);
  const [openRationale, setOpenRationale] = useState<string | null>(null);
  const [customTerm, setCustomTerm] = useState("");
  const [naChecked, setNaChecked] = useState(Boolean(draft.comparisonNotApplicable));
  const [naReason, setNaReason] = useState(draft.comparisonNotApplicable?.reason ?? "");
  const stale = Boolean(entry && entry.signature !== signature);

  const fetchSuggestions = useCallback(async (mode: "refresh" | "more") => {
    setLoading(true);
    setRequestError(false);
    setMoreMessage(null);
    try {
      const previous = cache[component];
      const existingSuggestions = previous?.suggestions ?? [];
      const currentItems = draftRef.current.picoc[component];
      const shown = mode === "more"
        ? [...existingSuggestions.flatMap((item) => [item.label, ...item.synonyms]), ...currentItems.flatMap((item) => [item.label, ...item.synonyms])]
        : [];
      const response = await picocWizardStateService.suggest(projectId, buildSuggestionRequest(draftRef.current, component, mode, shown));
      const excluded = new Set(shown.map(normalizeLabel));
      const additions = mode === "more" && response.source === "default_fallback"
        ? []
        : response.suggestions.filter((suggestion) => {
          const terms = [suggestion.label, ...suggestion.synonyms].map(normalizeLabel).filter(Boolean);
          if (terms.some((term) => excluded.has(term))) return false;
          terms.forEach((term) => excluded.add(term));
          return true;
        });
      if (mode === "more" && additions.length === 0) {
        setMoreMessage("No new relevant terms this time. Try again for more suggestions.");
      }
      const next: SuggestionCacheEntry = {
        signature,
        suggestions: mode === "more" ? [...existingSuggestions, ...additions] : response.suggestions,
        source: response.source,
        fallbackReason: response.fallbackReason,
      };
      cache[component] = next;
      setEntry(next);
      picocWizardStateService.track(projectId, "suggestion_viewed", {
        component,
        source: response.source,
        count: additions.length,
      });
      // Only flag selections when an earlier step changed during this session (T-08).
      if (mode === "refresh" && previous && previous.signature !== signature) {
        update((current) => applyReviewFlags(current, component, response.selectionsToReview));
      }
    } catch {
      setRequestError(true);
    } finally {
      setLoading(false);
    }
  }, [cache, component, projectId, signature, update]);

  useEffect(() => {
    setEntry(cache[component]);
  }, [cache[component]]);

  const items = draft.picoc[component];
  const itemFor = (label: string) => items.find((item) => normalizeLabel(item.label) === normalizeLabel(label));
  // The same concept can arrive more than once across AI, OpenAlex, and saved suggestions.
  // PICOC choices are persisted by normalized label, so render each concept only once.
  const suggestions = (entry?.suggestions ?? []).filter((suggestion, index, all) =>
    all.findIndex((candidate) => normalizeLabel(candidate.label) === normalizeLabel(suggestion.label)) === index,
  );
  const suggestionLabels = new Set(suggestions.map((item) => normalizeLabel(item.label)));
  const otherItems = items.filter((item) => !suggestionLabels.has(normalizeLabel(item.label)));

  const toggle = (suggestion: PicocSuggestion, status: PicocItem["status"]) => {
    const current = itemFor(suggestion.label);
    const next = current?.status === status ? null : status;
    update((value) => setSuggestionState(value, component, suggestion, next));
    if (next === "selected") picocWizardStateService.track(projectId, "suggestion_selected", { component, source: suggestion.sourceType });
  };

  const addCustom = () => {
    if (!customTerm.trim()) return;
    update((value) => addCustomTerm(value, component, customTerm));
    picocWizardStateService.track(projectId, "custom_concept_added", { component });
    setCustomTerm("");
  };

  const applyNa = (checked: boolean, reason: string) => {
    setNaChecked(checked);
    setNaReason(reason);
    if (!checked) {
      if (draft.comparisonNotApplicable) update((value) => setComparisonNotApplicable(value, null));
    } else if (reason.trim()) {
      update((value) => setComparisonNotApplicable(value, reason.trim()));
    } else if (draft.comparisonNotApplicable) {
      // N/A without a reason is not saved.
      update((value) => setComparisonNotApplicable(value, null));
    }
  };

  // Selecting a comparator clears N/A in the draft; keep the checkbox in sync.
  useEffect(() => {
    if (component === "comparison" && !draft.comparisonNotApplicable && naChecked && naReason.trim()) setNaChecked(false);
  }, [draft.comparisonNotApplicable]);

  return (
    <section aria-labelledby={`picoc-step-${component}`} className="space-y-6">
      <header>
        <p className="text-xs font-semibold text-primary">{COMPONENT_LABELS[component]}</p>
        <h3 id={`picoc-step-${component}`} className="mt-1 text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">{COMPONENT_QUESTIONS[component]}</h3>
        <p className="mt-2 text-sm leading-6 text-text-secondary">Select every term that applies. Suggestions are not chosen for you; mark a term "Not sure" to come back to it.</p>
      </header>

      {component === "comparison" ? (
        <div className="rounded-xl border border-border bg-bg-primary/60 p-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-text-primary">
            <input type="checkbox" checked={naChecked} onChange={(event) => applyNa(event.target.checked, naReason)} className="mt-1 h-4 w-4 shrink-0 accent-primary" />
            <span>
              Comparison is not applicable (N/A) for this review
              <span className="mt-1 block text-xs leading-5 text-text-secondary">
                {draft.reviewType === "comparative"
                  ? "Comparative reviews normally need a comparator — N/A will be flagged for review."
                  : "Common for mapping and exploratory reviews. Selected comparators are removed."}
              </span>
            </span>
          </label>
          {naChecked ? (
            <div className="mt-3">
              <label htmlFor="picoc-na-reason" className="text-xs font-semibold text-text-primary">Reason (required)</label>
              <textarea
                id="picoc-na-reason"
                value={naReason}
                onChange={(event) => applyNa(true, event.target.value)}
                rows={2}
                maxLength={1000}
                className="mt-2 w-full rounded-lg border border-border bg-surface-white p-3 text-sm leading-5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                aria-invalid={!naReason.trim()}
              />
              {!naReason.trim() ? <p role="alert" className="mt-1 text-xs font-medium text-error">Enter a reason to mark Comparison as N/A.</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {!entry && !loading ? (
        <div className="rounded-xl border border-border bg-bg-primary/60 p-4">
          <p className="text-sm font-medium text-text-primary">PICOC suggestions have not been generated yet.</p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">Generate a compact set for all five components once, then review each step at your pace.</p>
          <button type="button" disabled={batchLoading || !draft.intent.topic.trim()} onClick={onGenerateAll} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-3.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
            <FiRefreshCw aria-hidden className={batchLoading ? "motion-safe:animate-spin motion-reduce:animate-none" : undefined} /> {batchLoading ? "Generating PICOC suggestions…" : "Generate all suggestions"}
          </button>
        </div>
      ) : null}

      {stale && entry ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/20 bg-warning/5 p-3.5 text-xs text-text-primary">
          <span>Earlier PICOC choices changed. These suggestions are still available; refresh this step to include the new context.</span>
          <button type="button" disabled={loading} onClick={() => void fetchSuggestions("refresh")} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface-white px-3 font-semibold hover:bg-bg-secondary disabled:opacity-50"><FiRefreshCw aria-hidden /> Refresh this step</button>
        </div>
      ) : null}

      {entry && entry.source !== "ai" ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/20 bg-success/5 p-3">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-text-primary">
            <FiCheck aria-hidden className="text-success" /> Suggestions are ready to review
          </span>
          {entry.source === "openalex_fallback" ? (
            <p className="basis-full text-xs leading-5 text-text-secondary">
              AI suggestions are unavailable{entry.fallbackReason === "AI_TIMEOUT" ? " (the AI service timed out)" : entry.fallbackReason === "AI_INVALID_OUTPUT" ? " (the AI returned unusable suggestions)" : " (the AI service is unavailable)"}. Showing OpenAlex suggestions instead.
            </p>
          ) : null}
          <button type="button" disabled={loading} onClick={() => void fetchSuggestions("refresh")} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface-white px-3 text-xs font-semibold text-text-primary hover:bg-bg-secondary disabled:cursor-wait disabled:opacity-60">
            <FiRefreshCw aria-hidden className={loading ? "motion-safe:animate-spin motion-reduce:animate-none" : undefined} /> {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      ) : null}

      {requestError ? (
        <div role="status" className="flex justify-end rounded-xl border border-border bg-bg-primary/60 p-3">
          <button type="button" disabled={loading} onClick={() => void fetchSuggestions("refresh")} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface-white px-3 text-xs font-semibold text-text-primary hover:bg-bg-secondary disabled:cursor-wait disabled:opacity-60">
            <FiRefreshCw aria-hidden className={loading ? "motion-safe:animate-spin motion-reduce:animate-none" : undefined} /> {loading ? "Retrying…" : "Retry"}
          </button>
        </div>
      ) : null}

      {loading && entry && entry.suggestions.length > 0 ? (
        <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-xl border border-primary/15 bg-primary-light/40 px-4 py-3">
          <FiRefreshCw aria-hidden className="h-4 w-4 shrink-0 text-primary motion-safe:animate-spin motion-reduce:animate-none" />
          <span className="text-sm font-medium text-text-primary">Updating suggestions…</span>
          <span aria-hidden="true" className="ml-auto flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/50 motion-safe:animate-pulse motion-reduce:animate-none" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/50 motion-safe:animate-pulse motion-reduce:animate-none [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/50 motion-safe:animate-pulse motion-reduce:animate-none [animation-delay:300ms]" />
          </span>
        </div>
      ) : null}

      {loading && (!entry || entry.suggestions.length === 0) ? (
        <section role="status" aria-live="polite" aria-label={`Generating ${COMPONENT_LABELS[component].toLowerCase()} suggestions`} className="space-y-3">
          <span className="sr-only">Generating suggestions…</span>
          <div aria-hidden="true" className="overflow-hidden rounded-xl border border-primary/15 bg-primary-light/40">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-white text-primary shadow-sm">
                <FiRefreshCw className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-primary">Finding relevant {COMPONENT_LABELS[component].toLowerCase()} terms</p>
                <p className="mt-0.5 text-xs leading-5 text-text-secondary">Using your review topic and confirmed PICOC context.</p>
              </div>
              <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/50 motion-safe:animate-pulse motion-reduce:animate-none" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary/50 motion-safe:animate-pulse motion-reduce:animate-none [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary/50 motion-safe:animate-pulse motion-reduce:animate-none [animation-delay:300ms]" />
              </span>
            </div>
            <div className="h-1 overflow-hidden bg-primary/10">
              <div className="h-full w-1/3 rounded-full bg-primary/65 motion-safe:animate-pulse motion-reduce:animate-none" />
            </div>
          </div>
          <ul className="grid gap-3 md:grid-cols-2" aria-hidden="true">
            {[0, 1].map((index) => (
              <li key={index} className="rounded-xl border border-border bg-surface-white p-4 motion-safe:animate-pulse motion-reduce:animate-none">
                <div className="h-4 w-2/3 rounded bg-bg-secondary" />
                <div className="mt-3 h-3 w-1/2 rounded bg-bg-secondary/80" />
                <div className="mt-5 flex gap-2">
                  <div className="h-8 w-20 rounded-lg bg-bg-secondary" />
                  <div className="h-8 w-24 rounded-lg bg-bg-secondary" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {!draft.intent.topic.trim() ? <p className="text-sm text-text-secondary">Enter the research topic first to get suggestions.</p> : null}

      {entry && entry.suggestions.length === 0 && !loading ? (
        <p className="rounded-xl border border-border bg-bg-primary/60 p-4 text-sm text-text-secondary">No suggestions are available. Add your own terms below.</p>
      ) : null}

      <ul className="grid gap-3 md:grid-cols-2">
        {suggestions.map((suggestion) => {
          const current = itemFor(suggestion.label);
          const selected = current?.status === "selected";
          const unsure = current?.status === "unsure";
          return (
            <li key={normalizeLabel(suggestion.label)} className={`rounded-xl border p-4 transition-colors ${selected ? "border-primary/30 bg-primary-light/50" : "border-border bg-surface-white hover:border-primary/25"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold leading-5 text-text-primary">{suggestion.label}</p>
                  {suggestion.synonyms.length ? <p className="mt-1 text-xs leading-5 text-text-secondary">Also: {suggestion.synonyms.join(", ")}</p> : null}
                </div>
                <span className="shrink-0 rounded-full border border-border bg-bg-primary px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                  {ORIGIN_LABELS[suggestion.sourceType]}
                </span>
              </div>
              {current?.needsReview ? <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-warning/10 px-2 py-1 text-xs font-medium text-warning"><FiAlertTriangle aria-hidden />Needs review</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggle(suggestion, "selected")}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${selected ? "border-primary bg-primary text-white" : "border-border bg-surface-white text-text-primary hover:bg-bg-secondary"}`}
                >
                  <FiCheck aria-hidden /> {selected ? "Selected" : "Select"}
                </button>
                <button
                  type="button"
                  aria-pressed={unsure}
                  onClick={() => toggle(suggestion, "unsure")}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${unsure ? "border-primary/25 bg-primary-light text-primary" : "border-border bg-surface-white text-text-secondary hover:bg-bg-secondary"}`}
                >
                  <FiHelpCircle aria-hidden /> Not sure
                </button>
                {suggestion.rationale ? <button
                  type="button"
                  aria-expanded={openRationale === suggestion.conceptId}
                  onClick={() => setOpenRationale(openRationale === suggestion.conceptId ? null : suggestion.conceptId)}
                  className="min-h-11 rounded-lg px-2 text-xs font-medium text-text-secondary underline underline-offset-4 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  Why?
                </button> : null}
              </div>
              {openRationale === suggestion.conceptId && suggestion.rationale ? <p className="mt-3 rounded-lg bg-bg-secondary/70 p-3 text-xs leading-5 text-text-secondary">{suggestion.rationale}</p> : null}
            </li>
          );
        })}
      </ul>

      {entry ? (
        <div className="space-y-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void fetchSuggestions("more")}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface-white px-3 text-xs font-semibold text-text-primary transition-colors hover:bg-bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiRefreshCw aria-hidden className={loading ? "motion-safe:animate-spin motion-reduce:animate-none" : undefined} /> {loading ? "Finding new terms…" : "Show more suggestions"}
          </button>
          {moreMessage ? <p role="status" className="text-xs text-text-secondary">{moreMessage}</p> : null}
        </div>
      ) : null}

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          addCustom();
        }}
      >
        <label htmlFor={`picoc-custom-${component}`} className="sr-only">Add your own {COMPONENT_LABELS[component]} term</label>
        <input
          id={`picoc-custom-${component}`}
          value={customTerm}
          onChange={(event) => setCustomTerm(event.target.value)}
          maxLength={300}
          placeholder={`Add your own ${COMPONENT_LABELS[component].toLowerCase()} term`}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-surface-white px-3.5 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
        <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
          <FiPlus aria-hidden /> Add
        </button>
      </form>

      {otherItems.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-text-primary">Your other terms</p>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-white">
            {otherItems.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3 text-sm">
                <span className="text-text-primary">
                  {item.label}
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-text-muted">{ORIGIN_LABELS[item.origin]}</span>
                  {item.status === "unsure" ? <span className="ml-2 text-xs text-text-secondary">Not sure</span> : null}
                  {item.needsReview ? <span className="ml-2 text-xs text-text-primary"><FiAlertTriangle aria-hidden className="mr-1 inline" />Needs review — no longer suggested after an earlier change</span> : null}
                </span>
                <span className="flex gap-2">
                  {item.needsReview ? (
                    <button type="button" onClick={() => update((value) => keepItem(value, component, item.id))} className="min-h-11 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-bg-secondary">Keep</button>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`Remove ${item.label}`}
                    onClick={() => update((value) => removeItem(value, component, item.id))}
                    className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                  >
                    <FiX aria-hidden /> Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
};

export default ComponentStep;
