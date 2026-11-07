import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, BrainCircuit, CheckCircle2, FileText, GitBranch, RefreshCw, ShieldAlert } from "lucide-react";
import Button from "../../../../components/ui/Button";
import LoadingSpinner from "../../../../components/ui/LoadingSpinner";
import Modal from "../../../../components/ui/Modal";
import { useProjectMember } from "../../../../hooks/useProjectMember";
import {
  paperAiAnalysisService,
  type AiComponent,
  type CrossPaperRelation,
  type EvidenceHumanReview,
  type LocatedAiEvidence,
  type PaperAiAnalysisListItem,
  type PaperAiAnalysisResult,
} from "../../../../services/paperAiAnalysisService";
import ArgumentGraph from "./ArgumentGraph";
import ToulminModelGraph from "./ToulminModelGraph";

const isActive = (status: string) => status === "QUEUED" || status === "PROCESSING";

function StatusBadge({ status }: { status: string }) {
  const style = status === "COMPLETED" || status === "VERIFIED" ? "border-success/30 bg-success/10 text-success"
    : status === "VALID" ? "border-success/30 bg-success/10 text-success"
      : status === "CHANGES_REQUESTED" || status === "REJECTED" ? "border-error/30 bg-error/5 text-error"
      : status === "IN_REVIEW" || status === "UNREVIEWED" ? "border-warning/40 bg-warning/10 text-warning"
      : status === "NEEDS_REVIEW" ? "border-warning/40 bg-warning/10 text-warning"
    : status === "FAILED" ? "border-error/30 bg-error/10 text-error"
      : status === "PROCESSING" || status === "QUEUED" ? "border-warning/40 bg-warning/10 text-warning"
        : "border-border bg-bg-secondary text-text-secondary";
  const label: Record<string, string> = { NOT_STARTED: "Not analyzed", WAITING_FOR_SOURCE: "Waiting for full text", QUEUED: "Queued", PROCESSING: "Analyzing", COMPLETED: "Completed", FAILED: "Failed", FULL_TEXT: "Full text", PARTIAL_FULL_TEXT: "Partial full text", ABSTRACT: "Abstract only", VALID: "Basic checks passed", NEEDS_REVIEW: "Needs review", UNREVIEWED: "Human review pending", IN_REVIEW: "Human review in progress", VERIFIED: "Human verified", CHANGES_REQUESTED: "Changes requested", REJECTED: "Rejected by reviewer" };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${style}`}>{label[status] ?? status}</span>;
}

function EvidenceQuotes({ items }: { items: LocatedAiEvidence[] }) {
  if (!items.length) return <p className="text-sm text-text-muted">No source quotation was linked to this component.</p>;
  return <ul className="space-y-3">{items.map((item, index) => <li key={`${index}-${item.quote}`} className="rounded-lg bg-bg-secondary p-3 text-sm text-text-secondary">
    <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-text-muted"><span>{item.section || item.source_location.section || "Source section unavailable"}</span>{typeof item.source_location.paragraph === "number" && <span>Paragraph {item.source_location.paragraph + 1}</span>}<span className={item.quote_is_exact ? "text-success" : "text-warning"}>{!item.quote_is_exact ? "Verify quotation" : item.quote_match_method === "NORMALIZED" ? "Matched after formatting cleanup" : item.quote_match_method === "ELLIPSIS_EXPANDED" ? "Expanded from exact source text" : "Exact source match"}</span>{item.human_review && <span className="font-medium">Human {item.human_review.decision.toLowerCase()}</span>}</div>
    <blockquote className="border-l-2 border-primary/40 pl-3 leading-6">{item.quote}</blockquote>
    {item.human_review?.decision === "CORRECTED" && item.human_review.corrected_quote && <blockquote className="mt-2 border-l-2 border-success/40 pl-3 leading-6 text-text-primary"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-success">Reviewer correction</span>{item.human_review.corrected_quote}</blockquote>}
  </li>)}</ul>;
}

function EvidenceList({ items, title }: { items: LocatedAiEvidence[]; title: string }) {
  const [isOpen, setIsOpen] = useState(false);
  if (!items.length) return <p className="mt-2 text-xs text-text-muted">No source quotation was linked to this component.</p>;
  const reviewCount = items.filter((item) => !item.quote_is_exact).length;
  return <>
    <button type="button" aria-haspopup="dialog" onClick={() => setIsOpen(true)} className="mt-3 inline-flex min-h-10 flex-wrap items-center gap-2 rounded-md bg-bg-secondary px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      <span>View source evidence ({items.length})</span>
      {reviewCount > 0 && <span className="text-warning">{reviewCount} to verify</span>}
    </button>
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={`Source evidence: ${title}`} description="Check quotations marked for review against the original PDF before citing." size="lg">
      <EvidenceQuotes items={items} />
    </Modal>
  </>;
}
function ComponentCard({ label, component, evidenceInModal = false }: { label: string; component: AiComponent | null; evidenceInModal?: boolean }) {
  return <article className="rounded-xl border border-border bg-surface-white p-4"><h5 className="font-semibold text-text-primary">{label}</h5><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{component?.text || "Not identified in the source."}</p>{component && (evidenceInModal ? <div className="mt-3"><EvidenceQuotes items={component.evidence} /></div> : <EvidenceList title={label} items={component.evidence} />)}</article>;
}

function ImradCard({ title, summary, evidence, evidenceInModal = false }: { title: string; summary: string; evidence: LocatedAiEvidence[]; evidenceInModal?: boolean }) {
  return <article className="rounded-xl border border-border bg-surface-white p-4"><h4 className="font-semibold text-text-primary">{title}</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{summary || "This section was not clearly identified in the available source."}</p>{evidenceInModal ? <div className="mt-3"><EvidenceQuotes items={evidence} /></div> : <EvidenceList title={title} items={evidence} />}</article>;
}

function ModelLaunchCard({ title, description, actionLabel, onClick }: { title: string; description: string; actionLabel: string; onClick: () => void }) {
  return <section className="rounded-xl border border-border bg-surface-white p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0 flex-1"><h4 className="font-semibold text-text-primary">{title}</h4><p className="mt-1 text-sm text-text-secondary">{description}</p></div><Button variant="outline" aria-haspopup="dialog" onClick={onClick}>{actionLabel}</Button></div></section>;
}

type AnalysisIssue = PaperAiAnalysisResult["validation"]["issues"][number];
type AnalysisModel = "imrad" | "toulmin" | "aif";

const analysisModels = [
  { id: "imrad", label: "IMRaD", icon: FileText },
  { id: "toulmin", label: "Toulmin Model", icon: BrainCircuit },
  { id: "aif", label: "AIF Graph", icon: GitBranch },
] as const;

function evidencePathLabel(path: string) {
  const imradMatch = path.match(/^imrad\.(introduction|methods|results|discussion)\.evidence\[(\d+)\]$/);
  if (imradMatch) {
    const section = imradMatch[1][0].toUpperCase() + imradMatch[1].slice(1);
    return `${section} | evidence ${Number(imradMatch[2]) + 1}`;
  }

  const argumentMatch = path.match(/^arguments\[(\d+)\]\.(claim|warrant|backing|rebuttal|grounds\[(\d+)\])\.evidence\[(\d+)\]$/);
  if (!argumentMatch) return path;
  const component = argumentMatch[2].startsWith("grounds")
    ? `Grounds ${Number(argumentMatch[3]) + 1}`
    : argumentMatch[2][0].toUpperCase() + argumentMatch[2].slice(1);
  return `Argument ${Number(argumentMatch[1]) + 1} | ${component} | evidence ${Number(argumentMatch[4]) + 1}`;
}

function groupIssues(issues: AnalysisIssue[]) {
  const groups = new Map<string, { issue: AnalysisIssue; count: number }>();
  for (const issue of issues) {
    const key = `${issue.code}\u0000${issue.message}`;
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { issue, count: 1 });
  }
  return [...groups.values()];
}

function evidenceEntriesFromResult(result: PaperAiAnalysisResult) {
  const entries: Array<{ path: string; label: string; evidence: LocatedAiEvidence }> = [];
  for (const [section, value] of Object.entries(result.imrad)) {
    value.evidence.forEach((evidence, index) => entries.push({ path: `imrad.${section}.evidence[${index}]`, label: evidencePathLabel(`imrad.${section}.evidence[${index}]`), evidence }));
  }
  result.toulmin_arguments.forEach((argument, argumentIndex) => {
    const add = (component: string, items: LocatedAiEvidence[]) => items.forEach((evidence, index) => {
      const path = `arguments[${argumentIndex}].${component}.evidence[${index}]`;
      entries.push({ path, label: evidencePathLabel(path), evidence });
    });
    add("claim", argument.claim.evidence);
    argument.grounds.forEach((ground, groundIndex) => add(`grounds[${groundIndex}]`, ground.evidence));
    if (argument.warrant) add("warrant", argument.warrant.evidence);
    if (argument.backing) add("backing", argument.backing.evidence);
    if (argument.rebuttal) add("rebuttal", argument.rebuttal.evidence);
  });
  return entries;
}

function EvidenceReviewCard({
  label, path, evidence, pdfUrl, canReview, isSaving, onReview,
}: {
  label: string;
  path: string;
  evidence: LocatedAiEvidence;
  pdfUrl?: string | null;
  canReview: boolean;
  isSaving: boolean;
  onReview: (path: string, decision: EvidenceHumanReview["decision"], values?: { corrected_quote?: string; source_location?: string; note?: string }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [correctedQuote, setCorrectedQuote] = useState(evidence.human_review?.corrected_quote || evidence.quote);
  const [sourceLocation, setSourceLocation] = useState(evidence.human_review?.source_location || "");
  const [note, setNote] = useState(evidence.human_review?.note || "");
  const review = evidence.human_review;
  const reviewLabel = review?.decision === "VERIFIED" ? "Verified by reviewer"
    : review?.decision === "CORRECTED" ? "Corrected by reviewer"
      : review?.decision === "REJECTED" ? "Rejected by reviewer" : "Not reviewed by a person";
  return <article className="rounded-xl border border-border bg-surface-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h5 className="text-sm font-semibold text-text-primary">{label}</h5><p className="mt-1 text-xs text-text-muted">{evidence.section || evidence.source_location.section || "Source section unavailable"}{typeof evidence.source_location.paragraph === "number" ? ` · Paragraph ${evidence.source_location.paragraph + 1}` : ""}</p></div>
      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${review?.decision === "VERIFIED" || review?.decision === "CORRECTED" ? "border-success/30 bg-success/10 text-success" : review?.decision === "REJECTED" ? "border-error/30 bg-error/5 text-error" : "border-warning/30 bg-warning/5 text-warning"}`}>{reviewLabel}</span>
    </div>
    <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">AI quotation</p>
    <blockquote className="mt-1 border-l-2 border-primary/40 pl-3 text-sm leading-6 text-text-secondary">{evidence.quote}</blockquote>
    {review?.decision === "CORRECTED" && review.corrected_quote && <><p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-success">Reviewer correction</p><blockquote className="mt-1 border-l-2 border-success/40 pl-3 text-sm leading-6 text-text-primary">{review.corrected_quote}</blockquote></>}
    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
      <span className={evidence.quote_is_exact ? "text-success" : "text-warning"}>{evidence.quote_is_exact ? "Matched extracted text" : "Not matched to extracted text"}</span>
      {pdfUrl ? <a className="font-medium text-primary underline underline-offset-2" href={pdfUrl} target="_blank" rel="noreferrer">Open original PDF</a> : <span className="text-text-muted">Original PDF link unavailable</span>}
      {review?.reviewed_at && <span className="text-text-muted">Reviewed {new Date(review.reviewed_at).toLocaleString()} · {review.reviewed_by}</span>}
    </div>
    {review?.note && <p className="mt-2 rounded-lg bg-bg-secondary p-2 text-xs text-text-secondary">Reviewer note: {review.note}</p>}
    {canReview && <div className="mt-4 space-y-3 border-t border-border pt-3">
      {editing && <div className="space-y-2"><label className="block text-xs font-medium text-text-secondary">Corrected quotation<textarea className="mt-1 min-h-20 w-full rounded-lg border border-border bg-surface-white p-2 text-sm text-text-primary" value={correctedQuote} onChange={(event) => setCorrectedQuote(event.target.value)} /></label><label className="block text-xs font-medium text-text-secondary">PDF page / location (optional)<input className="mt-1 min-h-10 w-full rounded-lg border border-border bg-surface-white px-3 text-sm text-text-primary" value={sourceLocation} onChange={(event) => setSourceLocation(event.target.value)} placeholder="For example: page 4, Results" /></label></div>}
      <label className="block text-xs font-medium text-text-secondary">Review note {note ? "" : "(required to reject)"}<input className="mt-1 min-h-10 w-full rounded-lg border border-border bg-surface-white px-3 text-sm text-text-primary" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note; explain if rejecting" /></label>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={isSaving} onClick={() => onReview(path, "VERIFIED")}>Confirm quotation</Button>{editing ? <><Button size="sm" disabled={isSaving || !correctedQuote.trim()} onClick={() => onReview(path, "CORRECTED", { corrected_quote: correctedQuote.trim(), source_location: sourceLocation.trim() || undefined, note: note.trim() || undefined })}>Save correction</Button><Button size="sm" variant="outline" disabled={isSaving} onClick={() => setEditing(false)}>Cancel</Button></> : <Button size="sm" variant="outline" disabled={isSaving} onClick={() => setEditing(true)}>Correct quote</Button>}<Button size="sm" variant="outline" disabled={isSaving || !note.trim()} onClick={() => onReview(path, "REJECTED", { note: note.trim() })}>Reject quotation</Button></div>
    </div>}
  </article>;
}

function AnalysisReviewNotice({
  result, pdfUrl, canReview, isSaving, onEvidenceReview, onAnalysisReview,
}: {
  result: PaperAiAnalysisResult;
  pdfUrl?: string | null;
  canReview: boolean;
  isSaving: boolean;
  onEvidenceReview: (path: string, decision: EvidenceHumanReview["decision"], values?: { corrected_quote?: string; source_location?: string; note?: string }) => void;
  onAnalysisReview: (decision: "VERIFIED" | "CHANGES_REQUESTED", note?: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [analysisNote, setAnalysisNote] = useState(result.human_review?.note || "");
  const quoteIssues = result.validation.issues.filter((issue) => issue.code === "QUOTE_NOT_FOUND");
  const otherIssues = groupIssues(result.validation.issues.filter((issue) => issue.code !== "QUOTE_NOT_FOUND"));
  const evidence = evidenceEntriesFromResult(result);
  const evidenceReviewed = result.human_review?.evidence_reviewed_count ?? 0;
  const edgeReviewed = result.human_review?.edge_reviewed_count ?? 0;
  const edgesCanVerify = result.aif_graph.edges.every((edge) => {
    const extensions = edge.extensions && typeof edge.extensions === "object" ? edge.extensions as Record<string, unknown> : {};
    const review = extensions.human_review && typeof extensions.human_review === "object" ? extensions.human_review as Record<string, unknown> : {};
    return review.decision === "VERIFIED";
  });
  const evidenceCanVerify = evidence.every(({ evidence: item }) => item.human_review?.decision === "VERIFIED" || item.human_review?.decision === "CORRECTED");
  const sourceIsLimited = result.source.level !== "FULL_TEXT";
  const sourceWasTruncated = result.source.coverage === "TRUNCATED";
  const humanStatus = result.human_review?.decision ?? "UNREVIEWED";

  return <>
    <section role="status" aria-label="Human review status" className={`mt-4 flex flex-wrap items-center gap-3 rounded-lg border p-3 ${humanStatus === "VERIFIED" ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"}`}>
      {humanStatus === "VERIFIED" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" /> : <ShieldAlert className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary">Human review: {humanStatus.replaceAll("_", " ")}</p>
        <p className="mt-0.5 text-sm leading-5 text-text-secondary">{evidenceReviewed}/{evidence.length} citations and {edgeReviewed}/{result.aif_graph.edges.length} AIF edges reviewed. {quoteIssues.length > 0 ? `${quoteIssues.length} quotation${quoteIssues.length === 1 ? "" : "s"} did not match extracted text.` : "Machine checks are separate from reviewer confirmation."}</p>
        {result.human_review?.reviewed_at && <p className="mt-1 text-xs text-text-muted">Latest analysis decision: {new Date(result.human_review.reviewed_at).toLocaleString()} · {result.human_review.reviewed_by}</p>}
      </div>
      <Button variant="outline" size="sm" aria-haspopup="dialog" onClick={() => setIsOpen(true)}>Review citations</Button>
      {canReview && <div className="flex flex-wrap gap-2"><Button size="sm" disabled={isSaving || !evidenceCanVerify || !edgesCanVerify} onClick={() => onAnalysisReview("VERIFIED")}>Mark analysis verified</Button><Button variant="outline" size="sm" disabled={isSaving || !analysisNote.trim()} onClick={() => onAnalysisReview("CHANGES_REQUESTED", analysisNote.trim())}>Request changes</Button></div>}
    </section>
    {canReview && humanStatus !== "VERIFIED" && (!evidenceCanVerify || !edgesCanVerify) && <p className="mt-2 text-xs text-text-muted">To verify the complete analysis, mark each citation Verified or Corrected and verify every AIF edge. Rejected items must be reviewed again.</p>}
    {canReview && <label className="mt-2 block text-xs text-text-secondary">Analysis review note (required to request changes)<input className="mt-1 min-h-10 w-full rounded-lg border border-border bg-surface-white px-3 text-sm" value={analysisNote} onChange={(event) => setAnalysisNote(event.target.value)} placeholder="Explain what should be checked or changed" /></label>}
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Source evidence needs review" description="Read the AI quotation, compare it with the original PDF, then record a decision for each citation." size="xl">
      <div className="space-y-4">
        {quoteIssues.length > 0 && <article className="rounded-xl border border-warning/30 bg-warning/5 p-4"><h4 className="font-semibold text-text-primary">Automated exact-text check failed for {quoteIssues.length} {quoteIssues.length === 1 ? "quotation" : "quotations"}</h4><p className="mt-2 text-sm leading-6 text-text-secondary">These are automated extraction checks. A person must compare each quotation with the PDF and record a separate review decision below.</p></article>}
        {evidence.length ? <div className="space-y-3">{evidence.map((item) => <EvidenceReviewCard key={item.path} {...item} pdfUrl={pdfUrl} canReview={canReview} isSaving={isSaving} onReview={onEvidenceReview} />)}</div> : <p className="rounded-lg bg-bg-secondary p-4 text-sm text-text-secondary">No source quotations were returned for this analysis.</p>}
        {otherIssues.map(({ issue, count }) => <article key={`${issue.code}-${issue.message}`} className="rounded-xl border border-border bg-surface-white p-4"><h4 className="font-semibold text-text-primary">{issue.code.replaceAll("_", " ")}{count > 1 ? ` | ${count} occurrences` : ""}</h4><p className="mt-2 text-sm leading-6 text-text-secondary">{issue.message}</p></article>)}
        {(sourceIsLimited || sourceWasTruncated) && <article className="rounded-xl border border-border bg-surface-white p-4"><h4 className="font-semibold text-text-primary">Source coverage</h4>{sourceIsLimited && <p className="mt-2 text-sm leading-6 text-text-secondary">Source used: {result.source.level === "ABSTRACT" ? "title and abstract only" : "partial extracted full text"}.</p>}{sourceWasTruncated && <p className="mt-2 text-sm leading-6 text-text-secondary">The source exceeded the model input limit and was shortened.</p>}</article>}
      </div>
    </Modal>
  </>;
}

function relationLabel(relation: CrossPaperRelation["relation"]) {
  return relation === "supports" ? "Supports" : relation === "contradicts" ? "Contradicts" : "Qualifies";
}

function CrossPaperRelationCard({
  relation, generatedAt, canReview, isSaving, onReview,
}: {
  relation: CrossPaperRelation;
  generatedAt: string;
  canReview: boolean;
  isSaving: boolean;
  onReview: (id: string, input: { generated_at: string; decision: "VERIFIED" | "CORRECTED" | "REJECTED"; corrected_relation?: CrossPaperRelation["relation"]; corrected_rationale?: string; note?: string }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [correctedRelation, setCorrectedRelation] = useState<CrossPaperRelation["relation"]>(relation.effective_relation ?? relation.relation);
  const [correctedRationale, setCorrectedRationale] = useState(relation.effective_rationale ?? relation.rationale);
  const [note, setNote] = useState(relation.human_review?.note ?? "");
  const id = relation.relation_id || `${relation.source_node_id}-${relation.target_node_id}`;
  const review = relation.human_review;
  const shownRelation = relation.effective_relation ?? relation.relation;
  const shownRationale = relation.effective_rationale ?? relation.rationale;
  return <article className={`rounded-xl border bg-surface-white p-4 ${review?.decision === "REJECTED" ? "border-error/30 opacity-80" : "border-border"}`}>
    <div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-medium text-text-primary">{relation.source_paper_title}</span><span className="rounded-full bg-primary/10 px-2 py-1 text-primary">{relationLabel(shownRelation)}</span><span className="font-medium text-text-primary">{relation.target_paper_title}</span></div>
    {review?.decision === "CORRECTED" && <p className="mt-2 text-xs text-text-muted">AI suggested {relationLabel(relation.relation)}; reviewer corrected the relation to {relationLabel(shownRelation)}.</p>}
    <p className="mt-2 text-sm leading-6 text-text-secondary">{shownRationale}</p>
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span className={`rounded-full border px-2.5 py-1 ${review?.decision === "VERIFIED" || review?.decision === "CORRECTED" ? "border-success/30 bg-success/10 text-success" : review?.decision === "REJECTED" ? "border-error/30 bg-error/5 text-error" : "border-warning/30 bg-warning/5 text-warning"}`}>Human review: {review?.decision ?? "UNREVIEWED"}</span>{review?.reviewed_at && <span className="text-text-muted">{new Date(review.reviewed_at).toLocaleString()} · {review.reviewed_by}</span>}</div>
    {review?.note && <p className="mt-2 rounded-lg bg-bg-secondary p-2 text-xs text-text-secondary">Reviewer note: {review.note}</p>}
    {((relation.source_evidence?.length ?? 0) > 0 || (relation.target_evidence?.length ?? 0) > 0) && <details className="mt-3 border-t border-border pt-3"><summary className="cursor-pointer text-xs font-medium text-primary">Source citations ({(relation.source_evidence?.length ?? 0) + (relation.target_evidence?.length ?? 0)})</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{([{ title: "Supporting paper evidence", items: relation.source_evidence ?? [] }, { title: "Target paper evidence", items: relation.target_evidence ?? [] }] as const).map((group) => group.items.length > 0 && <div key={group.title} className="min-w-0 rounded-lg bg-bg-secondary p-3"><p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{group.title}</p>{group.items.map((item) => <blockquote key={item.evidence_id} className="mb-2 border-l-2 border-primary/40 pl-2 text-xs leading-5 text-text-secondary last:mb-0"><span className="mb-1 block text-[10px] text-text-muted">{item.component} · {item.section || "Section unavailable"}</span>{item.quote}</blockquote>)}</div>)}</div></details>}
    {canReview && <div className="mt-3 space-y-2 border-t border-border pt-3"><label className="block text-xs font-medium text-text-secondary">Review note {review?.decision === "REJECTED" || note ? "" : "(required to reject)"}<input className="mt-1 min-h-10 w-full rounded-lg border border-border bg-surface-white px-3 text-sm" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note; explain if rejecting" /></label>
      {editing && <div className="grid gap-2 sm:grid-cols-2"><label className="block text-xs font-medium text-text-secondary">Correct relation<select className="mt-1 min-h-10 w-full rounded-lg border border-border bg-surface-white px-3 text-sm" value={correctedRelation} onChange={(event) => setCorrectedRelation(event.target.value as CrossPaperRelation["relation"])}><option value="supports">Supports</option><option value="contradicts">Contradicts</option><option value="qualifies">Qualifies</option></select></label><label className="block text-xs font-medium text-text-secondary sm:col-span-2">Why this relation is correct<textarea className="mt-1 min-h-20 w-full rounded-lg border border-border bg-surface-white p-2 text-sm" value={correctedRationale} onChange={(event) => setCorrectedRationale(event.target.value)} /></label></div>}
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={isSaving || review?.decision === "VERIFIED"} onClick={() => onReview(id, { generated_at: generatedAt, decision: "VERIFIED" })}>Verify relation</Button>{editing ? <><Button size="sm" disabled={isSaving || !correctedRationale.trim()} onClick={() => onReview(id, { generated_at: generatedAt, decision: "CORRECTED", corrected_relation: correctedRelation, corrected_rationale: correctedRationale.trim(), note: note.trim() || undefined })}>Save correction</Button><Button size="sm" variant="outline" disabled={isSaving} onClick={() => setEditing(false)}>Cancel</Button></> : <Button size="sm" variant="outline" disabled={isSaving} onClick={() => setEditing(true)}>Correct relation</Button>}<Button size="sm" variant="outline" disabled={isSaving || !note.trim() || review?.decision === "REJECTED"} onClick={() => onReview(id, { generated_at: generatedAt, decision: "REJECTED", note: note.trim() })}>Reject relation</Button></div>
    </div>}
  </article>;
}

function PaperDetail({ projectId, paperId, canReview }: { projectId: string; paperId: string; canReview: boolean }) {
  const queryClient = useQueryClient();
  const detailKey = ["paper-ai-analysis-detail", projectId, paperId] as const;
  const refreshReviews = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: detailKey }),
    queryClient.invalidateQueries({ queryKey: ["paper-ai-analysis-papers", projectId] }),
    queryClient.invalidateQueries({ queryKey: ["paper-ai-cross-analysis", projectId] }),
  ]);
  const evidenceReviewMutation = useMutation({ mutationFn: (input: { analysis_id: string; evidence_path: string; decision: EvidenceHumanReview["decision"]; corrected_quote?: string; source_location?: string; note?: string }) => paperAiAnalysisService.reviewEvidence(projectId, paperId, input), onSuccess: refreshReviews });
  const edgeReviewMutation = useMutation({ mutationFn: (input: { analysis_id: string; edge_id: string; decision: "VERIFIED" | "REJECTED"; note?: string }) => paperAiAnalysisService.reviewAifEdge(projectId, paperId, input), onSuccess: refreshReviews });
  const analysisReviewMutation = useMutation({ mutationFn: (input: { analysis_id: string; decision: "VERIFIED" | "CHANGES_REQUESTED"; note?: string }) => paperAiAnalysisService.reviewPaper(projectId, paperId, input), onSuccess: refreshReviews });
  const isReviewSaving = evidenceReviewMutation.isPending || edgeReviewMutation.isPending || analysisReviewMutation.isPending;
  const reviewError = evidenceReviewMutation.error ?? edgeReviewMutation.error ?? analysisReviewMutation.error;
  const query = useQuery({ queryKey: detailKey, queryFn: () => paperAiAnalysisService.getPaper(projectId, paperId), refetchInterval: (current) => current.state.data && isActive(current.state.data.status) ? 2500 : false });
  const modelTabPrefix = useId().replaceAll(":", "");
  const modelTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeModel, setActiveModel] = useState<AnalysisModel>("imrad");
  const [isImradModalOpen, setIsImradModalOpen] = useState(false);
  const [isToulminModalOpen, setIsToulminModalOpen] = useState(false);
  const handleModelKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const nextIndex = event.key === "ArrowRight" ? (currentIndex + 1) % analysisModels.length
      : event.key === "ArrowLeft" ? (currentIndex - 1 + analysisModels.length) % analysisModels.length
        : event.key === "Home" ? 0
          : event.key === "End" ? analysisModels.length - 1
            : null;
    if (nextIndex === null) return;
    event.preventDefault();
    setActiveModel(analysisModels[nextIndex].id);
    modelTabRefs.current[nextIndex]?.focus();
  };
  const detail = query.data;
  const result = detail?.result;
  const canReviewCurrent = canReview && detail?.status === "COMPLETED";
  if (query.isLoading) return <div className="flex min-h-72 items-center justify-center"><LoadingSpinner /></div>;
  if (query.error) return <div role="alert" className="rounded-xl border border-error/30 bg-error/5 p-4 text-sm text-error">{query.error instanceof Error ? query.error.message : "Unable to load the paper analysis."}</div>;
  if (!detail) return null;
  if (!result) return <div className="rounded-xl border border-border bg-surface-white p-6">
    <div className="flex items-center gap-2"><StatusBadge status={detail.status} /><h3 className="font-semibold text-text-primary">{detail.title}</h3></div>
    {detail.status === "FAILED" && <p role="alert" className="mt-3 text-sm text-error">{detail.error?.message || "Analysis failed. Run the pipeline again to retry."}</p>}
    {detail.status === "WAITING_FOR_SOURCE" && <p className="mt-3 text-sm text-text-secondary">Full-text extraction is running. The analysis will start when the source is ready.</p>}
    {(detail.status === "QUEUED" || detail.status === "PROCESSING") && <p className="mt-3 text-sm text-text-secondary">The pipeline is building IMRaD sections, Toulmin arguments, and the AIF graph.</p>}
    {detail.status === "NOT_STARTED" && <p className="mt-3 text-sm text-text-secondary">This paper has not been queued for AI analysis.</p>}
  </div>;

  const sections = [
    ["Introduction", result.imrad.introduction], ["Methods", result.imrad.methods],
    ["Results", result.imrad.results], ["Discussion", result.imrad.discussion],
  ] as const;
  return <>
    <div className="space-y-5">
    <section className="rounded-xl border border-border bg-surface-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold text-text-primary">{result.paper_title}</h3><p className="mt-1 text-xs text-text-muted">{result.source.provider}{result.source.model ? ` / ${result.source.model}` : ""} / {new Date(result.source.analyzed_at).toLocaleString()}</p></div><div className="flex flex-wrap gap-2"><StatusBadge status={result.source.level} /><StatusBadge status={result.validation.status} /></div></div>
      <p className="mt-3 text-xs text-text-muted">AI-generated interpretation. Basic checks cover output structure and source-quote matching; review the paper and reasoning before using these results.</p>
      {reviewError && <p role="alert" className="mt-3 rounded-lg border border-error/30 bg-error/5 p-3 text-sm text-error">{reviewError instanceof Error ? reviewError.message : "Could not save the review decision."}</p>}
      <AnalysisReviewNotice result={result} pdfUrl={detail.pdf_url} canReview={canReviewCurrent} isSaving={isReviewSaving}
        onEvidenceReview={(path, decision, values) => evidenceReviewMutation.mutate({ analysis_id: result.source.analyzed_at, evidence_path: path, decision, ...values })}
        onAnalysisReview={(decision, note) => analysisReviewMutation.mutate({ analysis_id: result.source.analyzed_at, decision, note })} />
      {result.limitations.length > 0 && <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium text-text-secondary">Analysis limitations ({result.limitations.length})</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-text-secondary">{result.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></details>}
    </section>

    <div className="space-y-4">
      <div role="tablist" aria-label="Paper analysis models" className="flex max-w-full overflow-x-auto border-b border-border">
        {analysisModels.map((model, index) => {
          const Icon = model.icon;
          const selected = activeModel === model.id;
          return <button key={model.id} ref={(element) => { modelTabRefs.current[index] = element; }} type="button" role="tab" id={`${modelTabPrefix}-tab-${model.id}`} aria-selected={selected} aria-controls={`${modelTabPrefix}-panel`} tabIndex={selected ? 0 : -1} onClick={() => setActiveModel(model.id)} onKeyDown={(event) => handleModelKeyDown(event, index)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${selected ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary"}`}><Icon className="h-4 w-4" />{model.label}</button>;
        })}
      </div>

      <div role="tabpanel" id={`${modelTabPrefix}-panel`} aria-labelledby={`${modelTabPrefix}-tab-${activeModel}`} tabIndex={0} className="space-y-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        {activeModel === "imrad" && <ModelLaunchCard title="IMRaD analysis" description="Review Introduction, Methods, Results, Discussion, and their source quotations." actionLabel="View IMRaD analysis" onClick={() => setIsImradModalOpen(true)} />}

        {activeModel === "toulmin" && <div className="space-y-3"><ModelLaunchCard title="Toulmin Model analysis" description="Review Claim, Grounds / Data, Warrant, Backing, Qualifier, and Rebuttal for each argument." actionLabel="View Toulmin analysis" onClick={() => setIsToulminModalOpen(true)} /><ToulminModelGraph argumentsList={result.toulmin_arguments} /></div>}

        {activeModel === "aif" && <ArgumentGraph graph={result.aif_graph} onReviewEdge={canReviewCurrent ? (edge_id, decision, note) => edgeReviewMutation.mutate({ analysis_id: result.source.analyzed_at, edge_id, decision, note }) : undefined} isReviewPending={edgeReviewMutation.isPending} />}
      </div>
    </div>
    </div>
    <Modal isOpen={isImradModalOpen} onClose={() => setIsImradModalOpen(false)} title="IMRaD analysis" description="Review the four paper sections and their linked source quotations." size="xl">
      <div className="grid gap-3 md:grid-cols-2">{sections.map(([title, value]) => <ImradCard key={title} title={title} summary={value.summary} evidence={value.evidence} evidenceInModal />)}</div>
    </Modal>
    <Modal isOpen={isToulminModalOpen} onClose={() => setIsToulminModalOpen(false)} title="Toulmin Model analysis" description="Review each argument and its linked source quotations." size="xl">
      {result.toulmin_arguments.length ? <div className="space-y-6">{result.toulmin_arguments.map((argument, index) => <section key={argument.argument_id} className="space-y-3"><h4 className="border-b border-border pb-2 text-lg font-semibold text-text-primary">Argument {argument.argument_id.replace("ARG", "") || index + 1}</h4><div className="grid gap-3 md:grid-cols-2"><ComponentCard label="Claim" component={argument.claim} evidenceInModal /><ComponentCard label="Grounds / Data" component={argument.grounds[0] ?? null} evidenceInModal />{argument.grounds.slice(1).map((ground, groundIndex) => <ComponentCard key={`ground-${groundIndex}`} label={`Grounds / Data ${groundIndex + 2}`} component={ground} evidenceInModal />)}<ComponentCard label="Warrant" component={argument.warrant} evidenceInModal /><ComponentCard label="Backing" component={argument.backing} evidenceInModal /><ComponentCard label="Rebuttal" component={argument.rebuttal} evidenceInModal /><article className="rounded-xl border border-border bg-surface-white p-4"><h5 className="font-semibold text-text-primary">Qualifier</h5><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{argument.qualifier || "Not identified in the source."}</p></article></div></section>)}</div> : <p className="rounded-xl border border-border bg-surface-white p-4 text-sm text-text-secondary">No defensible Toulmin argument was identified in the available source.</p>}
    </Modal>
  </>;
}

export default function PaperAiAnalysisWorkspace({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const { member, isLoading: membershipLoading } = useProjectMember(projectId);
  const isLeader = member?.isLeader ?? false;
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const papersQuery = useQuery({ queryKey: ["paper-ai-analysis-papers", projectId], queryFn: () => paperAiAnalysisService.listPapers(projectId), refetchInterval: (current) => current.state.data?.some((paper) => isActive(paper.status)) ? 2500 : false });
  const crossQuery = useQuery({ queryKey: ["paper-ai-cross-analysis", projectId], queryFn: () => paperAiAnalysisService.getCrossPaper(projectId), refetchInterval: (current) => current.state.data?.status === "PROCESSING" ? 2500 : false });
  const papers = papersQuery.data ?? [];
  const currentPapers = useMemo(() => papers.filter((paper) => !paper.is_duplicate), [papers]);
  const selectedPaper = currentPapers.find((paper) => paper.paper_id === selectedPaperId) ?? currentPapers.find((paper) => paper.status === "COMPLETED") ?? currentPapers[0];
  const completedCount = currentPapers.filter((paper) => paper.status === "COMPLETED").length;
  const queuedCount = currentPapers.filter((paper) => isActive(paper.status)).length;
  const queueMutation = useMutation({ mutationFn: () => paperAiAnalysisService.generateAll(projectId), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["paper-ai-analysis-papers", projectId] }); } });
  const crossMutation = useMutation({ mutationFn: () => paperAiAnalysisService.generateCrossPaper(projectId), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["paper-ai-cross-analysis", projectId] }); } });
  const crossReviewMutation = useMutation({ mutationFn: ({ relationId, input }: { relationId: string; input: Parameters<typeof paperAiAnalysisService.reviewCrossPaperRelation>[2] }) => paperAiAnalysisService.reviewCrossPaperRelation(projectId, relationId, input), onSuccess: async (result) => {
    queryClient.setQueryData(["paper-ai-cross-analysis", projectId], (current: { status: string; result: typeof result } | undefined) => current ? { ...current, result } : current);
    await Promise.all([queryClient.invalidateQueries({ queryKey: ["paper-ai-cross-analysis", projectId] }), queryClient.invalidateQueries({ queryKey: ["paper-ai-analysis-papers", projectId] })]);
  } });

  if (papersQuery.isLoading) return <div className="flex min-h-56 items-center justify-center"><LoadingSpinner /></div>;
  if (papersQuery.error) return <div role="alert" className="rounded-xl border border-error/30 bg-error/5 p-4 text-sm text-error">{papersQuery.error instanceof Error ? papersQuery.error.message : "Unable to load project paper analyses."}</div>;

  const queueSummary = queueMutation.data;
  const crossResult = crossQuery.data?.result ?? (crossMutation.data ? crossMutation.data : null);
  const effectiveCrossStatus = crossQuery.data?.status ?? (crossMutation.isSuccess ? "COMPLETED" : undefined);
  const crossCanReview = Boolean(member) && !membershipLoading && effectiveCrossStatus === "COMPLETED";
  return <>
    <div className="space-y-5" aria-label="AI paper analysis workspace">
    <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-surface-white p-5"><div className="max-w-3xl"><div className="flex items-center gap-2 text-primary"><BrainCircuit className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-wide">AI research analysis</span></div><h2 className="mt-2 text-xl font-semibold text-text-primary">IMRaD, Toulmin & AIF</h2><p className="mt-1 text-sm leading-6 text-text-secondary">Paper analyses are queued after import and full-text extraction. Review source quotes before relying on model-generated interpretations.</p></div>{isLeader && <Button onClick={() => queueMutation.mutate()} isLoading={queueMutation.isPending}><RefreshCw className="h-4 w-4" />Analyze new or changed papers</Button>}</header>
    {!membershipLoading && !isLeader && <p role="status" className="rounded-lg border border-warning/35 bg-warning/5 p-3 text-sm text-text-secondary">This session is detected as {member?.roleText ?? "not a project member"}. Only project leaders can queue existing papers or generate cross-paper links.</p>}

    {(queueMutation.error || crossMutation.error || crossReviewMutation.error) && <div role="alert" className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/5 p-3 text-sm text-error"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{(queueMutation.error ?? crossMutation.error ?? crossReviewMutation.error) instanceof Error ? (queueMutation.error ?? crossMutation.error ?? crossReviewMutation.error as Error).message : "The analysis request failed."}</div>}
    {queueSummary && <p role="status" className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-text-secondary"><strong>Last queue request:</strong> {queueSummary.queued} paper(s) queued; {queueSummary.waiting_for_source} were waiting for PDF extraction; {queueSummary.already_current} already had a current result at that time. Live status is shown below.</p>}

    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-border bg-surface-white p-4"><p className="text-xs text-text-muted">Papers in project</p><p className="mt-1 text-2xl font-semibold text-text-primary">{currentPapers.length}</p></div><div className="rounded-xl border border-border bg-surface-white p-4"><p className="text-xs text-text-muted">Current analyses</p><p className="mt-1 text-2xl font-semibold text-success">{completedCount}</p></div><div className="rounded-xl border border-border bg-surface-white p-4"><p className="text-xs text-text-muted">Queued / processing</p><p className="mt-1 text-2xl font-semibold text-warning">{queuedCount}</p></div></div>

    <div className="grid items-start gap-4 xl:grid-cols-[minmax(250px,0.8fr)_minmax(0,2fr)]">
      <section className="overflow-hidden rounded-xl border border-border bg-surface-white" aria-label="Project papers"><div className="border-b border-border p-4"><h3 className="font-semibold text-text-primary">Project papers</h3><p className="mt-1 text-xs text-text-muted">Duplicates are skipped. Abstracts are analyzed while PDF extraction runs, then refreshed from full text.</p></div><div className="max-h-[700px] space-y-1 overflow-y-auto p-2 scrollbar-hidden">{currentPapers.map((paper: PaperAiAnalysisListItem) => <button key={paper.paper_id} type="button" onClick={() => setSelectedPaperId(paper.paper_id)} className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedPaper?.paper_id === paper.paper_id ? "border-primary/40 bg-primary/5" : "border-transparent hover:border-border hover:bg-bg-secondary"}`}><span className="line-clamp-2 text-sm font-medium text-text-primary">{paper.title}</span><span className="mt-2 flex flex-wrap items-center gap-2"><StatusBadge status={paper.status} />{paper.status === "COMPLETED" && <StatusBadge status={paper.human_review_status ?? "UNREVIEWED"} />}{paper.argument_count > 0 && <span className="text-xs text-text-muted">{paper.argument_count} arguments</span>}</span>{paper.error && <span className="mt-1 block line-clamp-2 text-xs text-error">{paper.error.message}</span>}</button>)}{currentPapers.length === 0 && <p className="p-4 text-sm text-text-secondary">No papers have been imported to this project yet.</p>}</div></section>
      <div>{selectedPaper ? <PaperDetail projectId={projectId} paperId={selectedPaper.paper_id} canReview={Boolean(member) && !membershipLoading} /> : <div className="rounded-xl border border-border bg-surface-white p-8 text-sm text-text-secondary">Select a paper to view its analysis.</div>}</div>
    </div>

    <section className="space-y-4 rounded-xl border border-border bg-bg-primary p-5" aria-label="Cross-paper analysis"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><GitBranch className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold text-text-primary">Cross-paper argument analysis</h3></div><p className="mt-1 text-sm text-text-secondary">Compare current paper claims and create AIF support, contradiction, and qualification links.</p></div>{isLeader && <Button variant="outline" onClick={() => crossMutation.mutate()} isLoading={crossMutation.isPending || crossQuery.data?.status === "PROCESSING"} disabled={completedCount < 2 || crossQuery.data?.status === "PROCESSING"}><GitBranch className="h-4 w-4" />Generate cross-paper links</Button>}</div>
      {crossQuery.error && <p role="alert" className="text-sm text-error">{crossQuery.error instanceof Error ? crossQuery.error.message : "Cross-paper analysis is unavailable."}</p>}
      {crossQuery.data?.status === "FAILED" && crossQuery.data.error?.message && <p role="alert" className="rounded-lg border border-error/30 bg-error/5 p-3 text-sm text-error">{crossQuery.data.error.message}</p>}
      {crossQuery.data?.status === "STALE" && <p className="rounded-lg border border-warning/35 bg-warning/5 p-3 text-sm text-text-secondary">Paper content changed after this cross-paper graph was generated. Regenerate it after the current paper analyses finish.</p>}
      {crossMutation.isPending ? <div className="flex min-h-28 items-center justify-center"><LoadingSpinner /></div> : crossResult ? <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-white p-3">
          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
          <span className="text-sm text-text-secondary">Compared {crossResult.analyzed_paper_count} of {crossResult.project_paper_count} papers | {crossResult.relations.length} {crossResult.relations.length === 1 ? "relation" : "relations"}</span>
          <StatusBadge status={crossResult.validation.status} />
          <span className="text-xs text-text-secondary">Human reviewed: {crossResult.human_review?.reviewed_count ?? crossResult.relations.filter((item) => item.human_review).length}/{crossResult.human_review?.relation_count ?? crossResult.relations.length} relations</span>
          <span className="text-xs text-text-muted">{crossResult.provider}{crossResult.model ? ` / ${crossResult.model}` : ""}</span>
        </div>
        <ArgumentGraph graph={crossResult.aif_graph} title="Cross-paper AIF Argument Graph" />
        {crossResult.relations.length > 0 ? <div className="grid gap-3 md:grid-cols-2">{crossResult.relations.map((relation, index) => <CrossPaperRelationCard key={relation.relation_id ?? `${relation.source_node_id}-${relation.target_node_id}-${index}`} relation={relation} generatedAt={crossResult.generated_at} canReview={crossCanReview} isSaving={crossReviewMutation.isPending} onReview={(relationId, input) => crossReviewMutation.mutate({ relationId, input })} />)}</div> : <p className="rounded-lg bg-surface-white p-4 text-sm text-text-secondary">No cross-paper links passed the two-sided source-evidence check. The graph still shows the analyzed claims; this run found no verifiable link, not that the papers have no relationship.</p>}
        {crossResult.limitations.map((item, index) => <p key={index} className="text-xs text-text-muted">{item}</p>)}
      </div> : <div className="rounded-lg border border-border bg-surface-white p-4 text-sm text-text-secondary">{completedCount < 2 ? "Analyze at least two papers before generating cross-paper links." : "No cross-paper result yet. The project leader can generate links from the current paper analyses."}</div>}    </section>
    </div>
  </>;
}
