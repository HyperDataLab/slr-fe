import { useEffect, useRef, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FiArrowRight, FiCheck, FiClock, FiExternalLink, FiLock, FiRefreshCw } from "react-icons/fi";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { ReviewProcess } from "../../../types/reviewProcess";
import { useProject } from "../../../hooks/useProjects";
import {
  PLANNING_MODULES,
  REPORTING_MODULES,
  SLR_WORKFLOW_PHASES,
  type SLRPhaseKey,
  type SLRWorkflowModule,
} from "../../../constants/slrWorkflow";

gsap.registerPlugin(useGSAP);

interface SLRPhaseWorkspaceProps {
  projectId: string;
  processId: string;
  process: ReviewProcess;
  children: ReactNode;
}

type ModuleStatus = "NotStarted" | "InProgress" | "Completed" | "Cancelled";

const STATUS_COPY: Record<ModuleStatus, string> = {
  NotStarted: "Not started",
  InProgress: "In progress",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

function moduleStatus(status?: string | null): ModuleStatus | null {
  if (status === "Completed") return "Completed";
  if (status === "Cancelled") return "Cancelled";
  if (status === "InProgress" || status === "Reopened") return "InProgress";
  if (status === "NotStarted" || status === "Pending") return "NotStarted";
  return null;
}

export default function SLRPhaseWorkspace({ projectId, processId, process, children }: SLRPhaseWorkspaceProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const workspaceRef = useRef<HTMLElement>(null);
  const phaseIndicatorRef = useRef<HTMLSpanElement>(null);
  const phaseIndicatorInitializedRef = useRef(false);
  const projectQuery = useProject(projectId);
  const phaseACompleted = projectQuery.project?.statusText === "Active" || projectQuery.project?.statusText === "Completed";
  const phaseAStatusKnown = !projectQuery.isLoading && !projectQuery.isError && Boolean(projectQuery.project);
  const phaseBCompleted = process.statusText === "Completed";
  const requestedPhase = searchParams.get("phase");
  const canOpenPhase = (phase: SLRPhaseKey) => {
    if (phase === "planning") return true;
    if (!phaseACompleted) return false;
    return phase !== "reporting" || phaseBCompleted;
  };
  const activePhase: SLRPhaseKey = requestedPhase === "planning"
    ? "planning"
    : requestedPhase === "reporting" && canOpenPhase("reporting")
      ? "reporting"
      : canOpenPhase("conducting")
        ? "conducting"
        : "planning";
  useEffect(() => {
    if (requestedPhase === "reporting" && !canOpenPhase("reporting")) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("phase");
        return next;
      }, { replace: true });
    } else if (requestedPhase === "conducting" && !canOpenPhase("conducting")) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("phase");
        return next;
      }, { replace: true });
    }
  }, [requestedPhase, phaseACompleted, phaseBCompleted, setSearchParams]);
  const setActivePhase = (phase: SLRPhaseKey) => {
    if (!canOpenPhase(phase)) return;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (phase === "conducting") next.delete("phase");
      else next.set("phase", phase);
      return next;
    }, { replace: true });
  };
  const projectRoute = (route: string) => {
    if (!processId || processId === "undefined" || processId === "null") {
      return `/projects/${projectId}/overview`;
    }
    if (route.includes(":identificationPhaseId") && !process.identificationProcess?.id) {
      return `/projects/${projectId}/processes/${processId}`;
    }
    return route
      .replace(":projectId", projectId)
      .replace(":processId", processId)
      .replace(":identificationPhaseId", process.identificationProcess?.id ?? "");
  };
  const statusLabel = process.statusText === "Completed"
    ? "Completed"
    : process.statusText === "InProgress"
      ? "In progress"
      : process.statusText === "Cancelled"
        ? "Cancelled"
        : "Not started";
  const identificationStats = process.identificationProcess?.prismaStatistics;
  const identificationWorkspacePath = processId && processId !== "undefined" && processId !== "null" && process.identificationProcess?.id
    ? `/projects/${projectId}/processes/${processId}/identification/${process.identificationProcess.id}`
    : undefined;
  const activeDefinition = SLR_WORKFLOW_PHASES.find((phase) => phase.id === activePhase)!;
  const previousPhaseRef = useRef(activePhase);
  const activePhaseStatus = activePhase === "planning"
    ? phaseACompleted ? "Completed" : "Current"
    : activePhase === "conducting"
      ? statusLabel
      : !phaseACompleted ? "Locked" : phaseBCompleted ? "Ready" : "Locked";
  const activePhaseStatusClass = activePhaseStatus === "Completed"
    ? "bg-success/10 text-success"
    : activePhaseStatus === "Locked" || activePhaseStatus === "Cancelled"
      ? "bg-bg-secondary text-text-secondary"
      : "bg-primary-light text-primary";
  const activePhaseStatusDotClass = activePhaseStatus === "Completed"
    ? "bg-success"
    : activePhaseStatus === "Locked" || activePhaseStatus === "Cancelled"
      ? "bg-text-muted"
      : "bg-primary";
  useGSAP(() => {
    if (previousPhaseRef.current === activePhase) return;
    previousPhaseRef.current = activePhase;

    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const targets = workspaceRef.current?.querySelectorAll<HTMLElement>("[data-phase-transition]");
      if (!targets?.length) return;
      gsap.fromTo(targets, { y: 4, autoAlpha: 0.78 }, {
        y: 0,
        autoAlpha: 1,
        duration: 0.2,
        stagger: 0.025,
        ease: "power2.out",
        clearProps: "transform,opacity,visibility",
      });
    });

    return () => media.revert();
  }, { scope: workspaceRef, dependencies: [activePhase], revertOnUpdate: true });

  useGSAP(() => {
    const indicator = phaseIndicatorRef.current;
    const phaseIndex = SLR_WORKFLOW_PHASES.findIndex((phase) => phase.id === activePhase);
    if (!indicator || phaseIndex < 0) return;

    const targetXPercent = phaseIndex * 100;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!phaseIndicatorInitializedRef.current || prefersReducedMotion) {
      gsap.set(indicator, { xPercent: targetXPercent });
      phaseIndicatorInitializedRef.current = true;
      return;
    }

    gsap.to(indicator, {
      xPercent: targetXPercent,
      duration: 0.28,
      ease: "power2.out",
      overwrite: "auto",
    });
  }, { scope: workspaceRef, dependencies: [activePhase] });
  const identificationWorkspaceContent = (
    <>
      <span className="flex min-w-0 items-center gap-3">
        <ModuleStatusIcon status={moduleStatus(process.identificationProcess?.statusText)} />
        <span className="min-w-0">
          <span className="block text-base font-semibold text-text-primary">Literature identification</span>
          <span className="mt-0.5 block text-sm text-text-secondary">Search sources, import references and resolve duplicates.</span>
          {identificationStats ? <span className="mt-1 block text-xs text-text-secondary">{identificationStats.totalRecordsImported.toLocaleString()} imported · {identificationStats.uniqueRecords.toLocaleString()} unique</span> : null}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <StatusPill status={moduleStatus(process.identificationProcess?.statusText)} />
        <FiExternalLink className="h-4 w-4 text-text-muted" aria-hidden="true" />
      </span>
    </>
  );

  return (
    <section ref={workspaceRef} aria-labelledby="slr-workflow-title" className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="slr-workflow-title" className="text-xl font-semibold tracking-tight text-text-primary">Review phases</h2>
          <p className="mt-1 text-sm text-text-secondary">Move through each phase as your review progresses.</p>
        </div>
      </div>

      <div className="relative grid grid-cols-1 border-b border-border md:grid-cols-3" role="group" aria-label="Review phases">
        <span
          ref={phaseIndicatorRef}
          aria-hidden="true"
          className="absolute bottom-0 left-0 z-20 hidden h-0.5 w-1/3 origin-left bg-primary md:block"
        />
        {SLR_WORKFLOW_PHASES.map((phase) => {
          const selected = phase.id === activePhase;
          const locked = !canOpenPhase(phase.id);
          const phaseStatus = phase.id === "planning"
            ? phaseACompleted ? "Complete" : "Current"
            : phase.id === "conducting"
              ? !phaseACompleted ? phaseAStatusKnown ? "Locked" : "Checking setup" : statusLabel
              : !phaseACompleted ? "Locked" : phaseBCompleted ? "Ready" : "Locked";
          return (
            <button
              key={phase.id}
              type="button"
              aria-pressed={selected}
              aria-disabled={locked}
              disabled={locked}
              onClick={() => setActivePhase(phase.id)}
              title={locked ? phase.id === "conducting" ? "Complete Phase A first" : "Complete Phase B first" : undefined}
              className={`relative flex min-h-[68px] w-full items-center gap-3 border-b-2 px-3 py-2.5 text-left transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 sm:px-4 ${selected ? "border-primary bg-primary-light/35 md:border-transparent md:bg-primary-light/25" : locked ? "cursor-not-allowed border-transparent bg-transparent opacity-65" : "border-transparent bg-transparent hover:bg-bg-secondary/50"}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${phaseStatus === "Complete" ? "bg-success/10 text-success" : selected ? "bg-primary text-white" : "bg-bg-secondary text-text-secondary"}`}>
                {phaseStatus === "Complete" ? <FiCheck aria-hidden="true" /> : locked ? <FiLock aria-hidden="true" /> : phase.letter}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-text-primary">Phase {phase.letter} · {phase.title}</span>
                <span className="mt-0.5 block truncate text-[13px] text-text-secondary">{locked ? phase.id === "conducting" ? phaseAStatusKnown ? "Complete Phase A to unlock" : "Checking Phase A status" : phaseACompleted ? "Complete Phase B to unlock" : "Complete Phase A to unlock" : phaseStatus}</span>
              </span>
              {selected ? <span className="rounded-full bg-primary-light px-2.5 py-1 text-xs font-semibold text-primary">Current</span> : null}
              {locked ? <span className="sr-only">Locked until the previous phase is complete</span> : null}
            </button>
          );
        })}
      </div>

      <section aria-labelledby="slr-phase-detail-title" className="space-y-3">
        <header data-phase-transition className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 id="slr-phase-detail-title" className="text-xl font-semibold tracking-tight text-text-primary">{activeDefinition.title}</h3>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-text-secondary">{activeDefinition.summary}</p>
          </div>
          <span className={`inline-flex w-fit shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${activePhaseStatusClass}`}>
            <span className={`h-2 w-2 rounded-full ${activePhaseStatusDotClass}`} aria-hidden="true" />
            {activePhaseStatus}
          </span>
        </header>

        {activePhase === "planning" ? (
          <>
            {!phaseACompleted ? (
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-white px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <p className="text-sm font-medium text-text-primary">{projectQuery.isLoading ? "Checking Phase A status…" : phaseAStatusKnown ? "Complete project setup to unlock Phase B." : "Project setup status could not be confirmed."}</p>
                  <p className="mt-1 text-xs text-text-secondary">{projectQuery.isLoading ? "The review workspace will unlock when setup is confirmed." : phaseAStatusKnown ? "Finish the remaining preparation steps and activate the review." : "Retry the status check before opening the review phase."}</p>
                </div>
                {projectQuery.isLoading ? <span className="inline-flex min-h-9 shrink-0 items-center px-2 text-xs text-text-secondary">Checking…</span> : phaseAStatusKnown ? <Link to={`/projects/${projectId}?step=picoc-scope`} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white transition-colors motion-reduce:transition-none hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">Open project setup <FiArrowRight aria-hidden="true" /></Link> : <button type="button" onClick={() => void projectQuery.refetch()} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-text-secondary transition-colors motion-reduce:transition-none hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"><FiRefreshCw aria-hidden="true" />Retry status</button>}
              </div>
            ) : (
              <ModuleList
                title="Planning workspaces"
                description="Review the project protocol, search plan and analysis setup."
                modules={PLANNING_MODULES}
                projectRoute={projectRoute}
              />
            )}
          </>
        ) : activePhase === "reporting" ? (
          <ModuleList
            title="Reporting workspaces"
            description="Prepare the review flow, evidence summary and publication outputs."
            modules={REPORTING_MODULES}
            projectRoute={projectRoute}
          />
        ) : (
          <>
            {identificationWorkspacePath ? (
              <Link data-phase-transition to={identificationWorkspacePath} className="group flex min-h-14 items-center justify-between gap-4 rounded-xl border border-border bg-surface-white px-3 py-2.5 transition-colors motion-reduce:transition-none hover:border-primary/30 hover:bg-primary-light/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-4">
                {identificationWorkspaceContent}
              </Link>
            ) : (
              <div data-phase-transition aria-disabled="true" title="Identification workspace is not available for this review process yet" className="flex min-h-14 items-center justify-between gap-4 rounded-xl border border-border bg-surface-white px-3 py-2.5 sm:px-4">
                {identificationWorkspaceContent}
              </div>
            )}
            <div data-phase-transition>{children}</div>
          </>
        )}
        <PhaseFooterNavigation activePhase={activePhase} onChangePhase={setActivePhase} canOpenPhase={canOpenPhase} />
      </section>
    </section>
  );
}

function ModuleList({
  title,
  description,
  modules,
  projectRoute,
}: {
  title: string;
  description: string;
  modules: SLRWorkflowModule[];
  projectRoute: (route: string) => string;
}) {
  return (
    <section aria-label={title} className="overflow-hidden rounded-xl border border-border bg-surface-white">
      <header className="border-b border-border bg-bg-secondary/40 px-4 py-3 sm:px-5">
        <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
        <p className="mt-0.5 text-xs leading-5 text-text-secondary">{description}</p>
      </header>
      <ul>
        {modules.map((module) => {
          const actions = module.links ?? (module.route ? [{ label: "Open workspace", route: module.route }] : []);

          return (
            <li
              key={module.id}
              className="group flex flex-col gap-2.5 border-b border-border px-4 py-3.5 transition-colors last:border-b-0 motion-reduce:transition-none hover:bg-bg-primary/70 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5"
            >
              <div className="min-w-0">
                <h5 className="text-sm font-medium leading-5 text-text-primary">{module.title}</h5>
                <p className="mt-0.5 text-xs leading-5 text-text-secondary">{module.description}</p>
              </div>
              {module.availability === "available" ? (
                <nav aria-label={`${module.title} workspaces`} className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 sm:justify-end">
                  {actions.map((action) => (
                    <Link
                      key={action.label}
                      to={projectRoute(action.route)}
                      className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-primary transition-colors motion-reduce:transition-none hover:text-primary-hover focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      {action.label}
                      <FiArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform motion-reduce:transition-none group-hover:translate-x-0.5" />
                    </Link>
                  ))}
                </nav>
              ) : (
                <span className="inline-flex min-h-9 shrink-0 items-center gap-1.5 text-xs text-text-secondary">
                  <FiLock aria-hidden="true" className="h-3.5 w-3.5" />
                  Not available yet
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ModuleStatusIcon({ status }: { status: ModuleStatus | null }) {
  if (status === "Completed") return <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/10 text-success"><FiCheck aria-hidden className="h-3.5 w-3.5" /></span>;
  if (status === "InProgress") return <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light"><span className="h-2 w-2 rounded-full bg-primary" /></span>;
  return <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-secondary text-text-secondary"><FiClock aria-hidden className="h-3.5 w-3.5" /></span>;
}

function StatusPill({ status }: { status: ModuleStatus | null }) {
  if (!status) return <span className="rounded-full bg-bg-secondary px-2.5 py-1 text-[11px] font-medium text-text-secondary">Not tracked</span>;
  const classes = status === "Completed" ? "bg-success/10 text-success" : status === "InProgress" ? "bg-primary-light text-primary" : "bg-bg-secondary text-text-secondary";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${classes}`}>{STATUS_COPY[status]}</span>;
}

function PhaseFooterNavigation({ activePhase, onChangePhase, canOpenPhase }: { activePhase: SLRPhaseKey; onChangePhase: (phase: SLRPhaseKey) => void; canOpenPhase: (phase: SLRPhaseKey) => boolean }) {
  const currentIndex = SLR_WORKFLOW_PHASES.findIndex((phase) => phase.id === activePhase);
  const previous = SLR_WORKFLOW_PHASES[currentIndex - 1];
  const next = SLR_WORKFLOW_PHASES[currentIndex + 1];
  return (
    <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-4 sm:px-6">
      {previous ? (
        <button type="button" onClick={() => onChangePhase(previous.id)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-text-primary transition-colors motion-reduce:transition-none hover:bg-bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"><FiArrowRight aria-hidden className="h-3.5 w-3.5 rotate-180" />Phase {previous.letter}</button>
      ) : <span />}
      {next ? (
        <button type="button" onClick={() => onChangePhase(next.id)} disabled={!canOpenPhase(next.id)} aria-disabled={!canOpenPhase(next.id)} title={!canOpenPhase(next.id) ? next.id === "conducting" ? "Complete Phase A first" : "Complete Phase B first" : undefined} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:bg-bg-secondary disabled:text-text-muted enabled:bg-accent enabled:text-white enabled:hover:bg-primary-hover">{!canOpenPhase(next.id) && <FiLock aria-hidden className="h-3.5 w-3.5" />}Phase {next.letter}<FiArrowRight aria-hidden className="h-3.5 w-3.5" /></button>
      ) : <span />}
    </footer>
  );
}
