import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, CircleCheck, Save } from "lucide-react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../redux/store";
import type {
  LeaderQAPaperResponse,
  QualityAssessmentDecisionItemResponse,
  QualityAssessmentResolutionRequest,
  QualityAssessmentStrategy,
} from "../../../../types/qualityAssessment";
import type { ReviewerDecisionPayload } from "./ReviewerQAPanel";
import type { HighlightData } from "../sections/QAPapersTabContent";

type CriterionAnswer = {
  value: number;
  comment?: string;
  id?: string;
  pdfHighlightCoordinates?: string;
};

interface LeaderQAPanelProps {
  paper: LeaderQAPaperResponse;
  strategies: QualityAssessmentStrategy[];
  onResolve: (
    data: Omit<QualityAssessmentResolutionRequest, "qualityAssessmentProcessId" | "paperId">,
    decisionData?: { notes: string | null; items: ReviewerDecisionPayload[] },
  ) => void;
  onSaveDraft?: (notes: string | null, items: ReviewerDecisionPayload[]) => void;
  isResolving?: boolean;
  activeCriterionId?: string | null;
  onSelectCriterion?: (id: string | null) => void;
  highlightsByCriterion?: Record<string, HighlightData[]>;
  canEdit?: boolean;
}

const answerLabels: Record<number, string> = { 0: "Yes", 1: "No", 2: "Unclear" };

export default function LeaderQAPanel({
  paper,
  strategies,
  onResolve,
  onSaveDraft,
  isResolving,
  activeCriterionId,
  onSelectCriterion,
  canEdit = true,
}: LeaderQAPanelProps) {
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [finalDecision, setFinalDecision] = useState<number | null>(paper.resolution?.finalDecision ?? null);
  const [resolutionNotes, setResolutionNotes] = useState(paper.resolution?.resolutionNotes ?? "");
  const [answers, setAnswers] = useState<Record<string, CriterionAnswer>>({});
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState<"conflicts" | "all" | "resolved">("all");
  const [openCriterionIds, setOpenCriterionIds] = useState<Set<string>>(new Set());
  const [isFinalDecisionOpen, setIsFinalDecisionOpen] = useState(paper.resolution?.finalDecision != null);

  const criteria = useMemo(
    () => strategies.flatMap((strategy) => strategy.checklists.flatMap((checklist) =>
      checklist.criteria.map((criterion) => ({ ...criterion, checklistName: checklist.name, strategyName: strategy.description }))),
    ),
    [strategies],
  );

  useEffect(() => {
    const ownDecision = paper.decisions?.find((decision) => decision.reviewerId === currentUser?.id);
    const initial: Record<string, CriterionAnswer> = {};
    ownDecision?.decisionItems?.forEach((item) => {
      if (item.qualityCriterionId && item.value != null) {
        initial[item.qualityCriterionId] = {
          value: Number(item.value),
          comment: item.comment ?? "",
          id: item.id ?? undefined,
          pdfHighlightCoordinates: item.pdfHighlightCoordinates ?? "",
        };
      }
    });
    setAnswers(initial);
    setFinalDecision(paper.resolution?.finalDecision ?? null);
    setResolutionNotes(paper.resolution?.resolutionNotes ?? "");
    setNotes("");
    setIsFinalDecisionOpen(paper.resolution?.finalDecision != null);
    // Reset the local editor only when switching papers; query refreshes must not discard a draft.
  }, [paper.paperId, currentUser?.id]);

  const decisionsByCriterion = useMemo(() => {
    const map: Record<string, Record<string, QualityAssessmentDecisionItemResponse>> = {};
    paper.decisions?.forEach((decision) => decision.decisionItems?.forEach((item) => {
      if (!map[item.qualityCriterionId]) map[item.qualityCriterionId] = {};
      map[item.qualityCriterionId][decision.reviewerId] = item;
    }));
    return map;
  }, [paper.decisions]);

  const criterionStates = useMemo(() => {
    const states = new Map<string, { conflict: boolean; resolved: boolean; agreed: boolean; reviewerItems: Array<{ name: string; value: number | null; comment: string | null }> }>();
    criteria.forEach((criterion) => {
      const reviewerItems = (paper.reviewers ?? []).map((reviewer) => {
        const decision = decisionsByCriterion[criterion.criterionId]?.[reviewer.id];
        return {
          name: reviewer.fullname || reviewer.username,
          value: decision?.value == null ? null : Number(decision.value),
          comment: decision?.comment ?? null,
        };
      });
      const values = [...new Set(reviewerItems.flatMap((item) => item.value == null ? [] : [item.value]))];
      states.set(criterion.criterionId, {
        conflict: values.length > 1,
        resolved: answers[criterion.criterionId]?.value != null,
        agreed: reviewerItems.length > 0 && values.length === 1 && reviewerItems.every((item) => item.value != null),
        reviewerItems,
      });
    });
    return states;
  }, [answers, criteria, decisionsByCriterion, paper.reviewers]);

  useEffect(() => {
    setOpenCriterionIds(new Set(
      [...criterionStates.entries()]
        .filter(([, state]) => state.conflict && !state.resolved)
        .map(([criterionId]) => criterionId),
    ));
  // Set the initial expansion when a different paper is selected.
  }, [paper.paperId]);

  const counts = useMemo(() => {
    let conflicts = 0;
    let resolved = 0;
    criterionStates.forEach((state) => {
      if (state.conflict && !state.resolved) conflicts += 1;
      if (state.resolved) resolved += 1;
    });
    return { conflicts, resolved, total: criteria.length };
  }, [criteria.length, criterionStates]);

  useEffect(() => {
    setFilter((current) => current === "all" && counts.conflicts > 0 ? "conflicts" : current);
  }, [counts.conflicts]);

  const visibleCriteria = criteria.filter((criterion) => {
    const state = criterionStates.get(criterion.criterionId);
    if (filter === "conflicts") return !!state?.conflict && !state.resolved;
    if (filter === "resolved") return !!state?.resolved;
    return true;
  });

  const decisionItems: ReviewerDecisionPayload[] = Object.entries(answers).map(([criterionId, answer]) => {
    return {
      criterionId,
      itemId: answer.id,
      value: answer.value,
      comment: answer.comment,
      pdfHighlightCoordinates: answer.pdfHighlightCoordinates,
    };
  });

  const handleResolve = () => {
    if (finalDecision === null || !canEdit) return;
    onResolve(
      { finalDecision, finalScore: 0, resolutionNotes },
      decisionItems.length ? { notes, items: decisionItems } : undefined,
    );
  };

  const answerCriterion = (criterionId: string, value: number) => {
    setAnswers((current) => ({ ...current, [criterionId]: { ...current[criterionId], value } }));
    onSelectCriterion?.(criterionId);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="sticky top-0 z-10 border-b border-border bg-white/95 px-4 py-3 backdrop-blur-sm sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
            <div className="min-w-[180px] flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="text-sm font-semibold text-text-primary">Criterion review</h2>
                <p className="text-xs tabular-nums text-text-secondary"><span className="font-semibold text-text-primary">{counts.resolved} of {counts.total}</span> assessed</p>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-bg-secondary" role="progressbar" aria-label="Criteria assessed" aria-valuemin={0} aria-valuemax={counts.total} aria-valuenow={counts.resolved}>
                <div className="h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${counts.total ? (counts.resolved / counts.total) * 100 : 0}%` }} />
              </div>
            </div>
            <div className="inline-flex items-center gap-0.5 rounded-lg bg-bg-primary p-1" role="group" aria-label="Filter criteria">
              {([
                ["conflicts", `Conflicts${counts.conflicts ? ` · ${counts.conflicts}` : ""}`],
                ["all", "All criteria"],
                ["resolved", `Resolved · ${counts.resolved}`],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value}
                  className={`min-h-9 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${filter === value ? "bg-white text-primary shadow-sm" : "text-text-secondary hover:bg-white/70 hover:text-text-primary"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 pb-5 pt-3 sm:px-6">
          <div className="space-y-2">
          {visibleCriteria.map((criterion, index) => {
            const state = criterionStates.get(criterion.criterionId)!;
            const myAnswer = answers[criterion.criterionId];
            const status = state.resolved ? "Resolved" : state.conflict ? "Conflict" : state.agreed ? "Agreed" : "Awaiting review";
            return (
              <details key={criterion.criterionId} open={openCriterionIds.has(criterion.criterionId)} className={`group rounded-lg border border-border bg-white transition-colors motion-reduce:transition-none ${activeCriterionId === criterion.criterionId ? "border-primary/35 bg-primary-light/20" : "hover:bg-bg-primary/25"}`}>
                <summary onClick={(event) => { event.preventDefault(); onSelectCriterion?.(criterion.criterionId); setOpenCriterionIds((current) => { const next = new Set(current); if (next.has(criterion.criterionId)) next.delete(criterion.criterionId); else next.add(criterion.criterionId); return next; }); }} className="flex min-h-[58px] cursor-pointer list-none items-center gap-3 px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 sm:px-4 [&::-webkit-details-marker]:hidden">
                  <span className="w-7 shrink-0 text-xs font-medium tabular-nums text-text-muted">{String(index + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1 text-sm font-medium leading-5 text-text-primary">{criterion.question}</span>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium ${status === "Conflict" ? "text-amber-800" : status === "Resolved" ? "text-emerald-800" : "text-text-secondary"}`}>
                    <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${status === "Conflict" ? "bg-amber-500" : status === "Resolved" ? "bg-emerald-600" : status === "Agreed" ? "bg-text-muted" : "bg-border"}`} />{status}
                  </span>
                  <ChevronDown aria-hidden="true" size={16} className="shrink-0 text-text-muted transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" />
                </summary>

                <div className="px-3 pb-4 sm:px-4">
                  <p className="mb-2 text-xs font-semibold text-text-secondary">Reviewer evidence</p>
                  <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {state.reviewerItems.map((item) => (
                      <article key={item.name} className="min-w-0 rounded-md bg-bg-primary/55 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 truncate text-xs font-semibold text-text-primary">{item.name}</p>
                          <span className={`shrink-0 text-xs font-semibold ${item.value === 0 ? "text-emerald-700" : item.value === 1 ? "text-rose-700" : "text-text-secondary"}`}>{item.value == null ? "No response" : answerLabels[item.value] ?? "Unclear"}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-text-secondary">{item.comment || "No reasoning provided."}</p>
                      </article>
                    ))}
                  </div>

                  <div className="border-t border-border pt-3">
                    <p className="mb-2 text-xs font-semibold text-text-primary">Your assessment</p>
                    <div className="flex flex-wrap gap-2" role="group" aria-label={`Your assessment for criterion ${index + 1}`}>
                      {[0, 1, 2].map((value) => (
                        <button key={value} type="button" disabled={!canEdit} aria-pressed={myAnswer?.value === value}
                          onClick={() => answerCriterion(criterion.criterionId, value)}
                          className={`min-h-9 rounded-md border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60 ${myAnswer?.value === value ? "border-primary/50 bg-primary-light text-primary" : "border-border bg-white text-text-secondary hover:bg-bg-primary"}`}>
                          {answerLabels[value]}
                        </button>
                      ))}
                    </div>
                    <textarea value={myAnswer?.comment ?? ""} disabled={!canEdit}
                      onChange={(event) => setAnswers((current) => ({ ...current, [criterion.criterionId]: { ...current[criterion.criterionId], value: current[criterion.criterionId]?.value ?? 2, comment: event.target.value } }))}
                      placeholder="Add your reasoning for this criterion…" rows={2}
                      className="mt-2 min-h-16 w-full resize-y rounded-md border border-border bg-white px-3 py-2 text-sm leading-5 text-text-primary outline-none placeholder:text-text-muted focus:border-primary/50 focus:ring-2 focus:ring-primary/10 disabled:bg-bg-primary" />
                  </div>
                </div>
              </details>
            );
          })}
          {visibleCriteria.length === 0 && (
            <div className="rounded-lg border border-border bg-white py-8 text-center">
              <CircleCheck size={22} className="mx-auto text-emerald-700" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium text-text-primary">{filter === "conflicts" ? "No unresolved conflicts" : filter === "resolved" ? "No resolved criteria yet" : "No criteria available"}</p>
              <p className="mt-1 text-xs text-text-secondary">{filter === "all" ? "Assessment criteria will appear here when configured." : "Choose another filter to review the remaining criteria."}</p>
            </div>
          )}
          </div>

          <details className="mt-4 border-y border-border py-2">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-1 text-sm font-medium text-text-primary outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden">
              <span>Assessment notes</span><span className="text-xs font-normal text-text-secondary">Optional context</span>
            </summary>
            <label htmlFor="leader-assessment-notes" className="sr-only">Assessment notes</label>
            <textarea id="leader-assessment-notes" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={!canEdit} rows={2}
              placeholder="Add notes to accompany your criterion assessments…" className="mt-2 w-full resize-y rounded-md border border-border bg-white px-3 py-2 text-sm leading-5 outline-none placeholder:text-text-muted focus:border-primary/50 focus:ring-2 focus:ring-primary/10 disabled:bg-bg-primary" />
          </details>

          <details open={isFinalDecisionOpen} onToggle={(event) => setIsFinalDecisionOpen(event.currentTarget.open)} className="group border-b border-border py-3">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-1 outline-none focus-visible:ring-2 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden">
              <span><span className="block text-sm font-semibold text-text-primary">Final paper decision</span><span className="mt-0.5 block text-xs text-text-secondary">Review the criteria, then record the paper outcome.</span></span>
              <ChevronDown size={17} className="shrink-0 text-text-muted transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
            </summary>
            <div className="pt-3">
              <div className="grid max-w-lg grid-cols-2 gap-2" role="group" aria-label="Final paper quality decision">
                {[{ value: 1, label: "High quality" }, { value: 0, label: "Low quality" }].map((option) => (
                  <button key={option.value} type="button" disabled={!canEdit} aria-pressed={finalDecision === option.value} onClick={() => setFinalDecision(option.value)}
                    className={`min-h-10 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-60 ${finalDecision === option.value ? "border-primary/50 bg-primary-light text-primary" : "border-border text-text-secondary hover:bg-bg-primary"}`}>
                    {option.label}
                  </button>
                ))}
              </div>
              <label className="sr-only" htmlFor="leader-final-decision-notes">Reason for final decision</label>
              <textarea id="leader-final-decision-notes" value={resolutionNotes} onChange={(event) => setResolutionNotes(event.target.value)} disabled={!canEdit} rows={2}
                placeholder="Reason for the final paper decision (optional)" className="mt-2 w-full resize-y rounded-md border border-border bg-white px-3 py-2 text-sm leading-5 outline-none placeholder:text-text-muted focus:border-primary/50 focus:ring-2 focus:ring-primary/10 disabled:bg-bg-primary" />
            </div>
          </details>
        </div>
      </div>

      <footer className="sticky bottom-0 z-20 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-white px-4 py-2.5 sm:px-6">
        <div>
          <p className="text-xs text-text-secondary"><span className="font-semibold tabular-nums text-text-primary">{counts.resolved} of {counts.total}</span> criteria assessed</p>
          <p className="mt-0.5 text-[11px] text-text-muted">{finalDecision === null ? "Choose a final paper decision to submit." : "Final decision ready to submit."}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" disabled={!canEdit || isResolving || !onSaveDraft || (decisionItems.length === 0 && !notes.trim())} onClick={() => onSaveDraft?.(notes, decisionItems)}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-text-primary hover:bg-bg-primary disabled:cursor-not-allowed disabled:opacity-50">
            <Save size={15} aria-hidden="true" /> Save draft
          </button>
          <button type="button" disabled={!canEdit || isResolving || finalDecision === null} onClick={handleResolve}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
            <Check size={15} aria-hidden="true" /> {isResolving ? "Saving…" : "Submit resolution"}
          </button>
        </div>
      </footer>
    </div>
  );
}
