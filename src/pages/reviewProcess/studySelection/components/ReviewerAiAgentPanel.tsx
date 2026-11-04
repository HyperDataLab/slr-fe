import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { isAxiosError } from "axios";
import { FiCopy, FiCpu, FiKey, FiRefreshCw, FiSettings, FiTrash2 } from "react-icons/fi";
import api from "../../../../config/axios";
import Select from "../../../../components/ui/Select";
import Button from "../../../../components/ui/Button";
import ConfirmModal from "../../../../components/ui/ConfirmModal";
import AIReviewResultCard from "../../../../components/projects/AIReviewResultCard";
import { useProjectMember } from "../../../../hooks/useProjectMember";
import { toastError, toastSuccess } from "../../../../utils/toast";
import type { RootState } from "../../../../redux/store";

type ReviewStage = "TITLE_ABSTRACT" | "FULL_TEXT";
type AgentEntry = {
  agent: { id: string; name: string; description: string; isActive: boolean };
  access: { isActive: boolean; agentCapabilities?: string[] } | null;
};
type AgentWorkspace = { agents: AgentEntry[]; selectedAgentId: string | null };
type AgentTask = {
  id: string;
  agentId: string;
  agentName?: string;
  paperId: string;
  stage?: ReviewStage;
  instructions: string;
  status: string;
  result?: { decision: string; reasoning: string; data?: Record<string, unknown> };
  error?: { code?: string; message?: string };
  createdAt: string;
};
type AgentConfirmation = { agentId: string; agentName: string; action: "rotate" | "disable" };

const normalizeDecision = (value: string) => {
  const normalized = value.trim().toUpperCase();
  if (normalized === "INCLUDED") return "INCLUDE";
  if (normalized === "EXCLUDED") return "EXCLUDE";
  return normalized;
};

export default function ReviewerAiAgentPanel({
  paper,
  stage,
}: {
  paper: {
    id: string;
    title?: string;
    abstract?: string | null;
    pdfUrl?: string | null;
    extraction?: { status: string; message?: string | null } | null;
    decisions?: Array<{ reviewerId: string; decision: string; phase?: number }>;
  } | null;
  stage: ReviewStage;
}) {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const { member } = useProjectMember(projectId);
  const isReviewer = member?.role === 3;
  const isOwner = member?.role === 1;
  const currentUserId = useSelector((state: RootState) => state.auth.user?.id);
  const queryClient = useQueryClient();
  const [activeAgentId, setActiveAgentId] = useState("");
  const [isChoosingAgent, setIsChoosingAgent] = useState(false);
  const [taskToRemove, setTaskToRemove] = useState<AgentTask | null>(null);
  const [agentConfirmation, setAgentConfirmation] = useState<AgentConfirmation | null>(null);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});
  const viewerScope = currentUserId ?? "anonymous";
  const agentsKey = ["reviewer-ai-agents", projectId, viewerScope, isReviewer ? "reviewer" : "owner"];
  const tasksKey = ["reviewer-ai-agent-tasks", projectId, viewerScope, isReviewer ? "reviewer" : "owner", paper?.id];
  const taskStateKey = (agentId: string, paperId = paper?.id, taskStage = stage) => `${paperId ?? ""}:${taskStage}:${agentId}`;

  const agentsQuery = useQuery({
    queryKey: agentsKey,
    queryFn: async () => {
      if (isReviewer) {
        const response = await api.get<{ data: AgentWorkspace }>(`/projects/${projectId}/ai-review/agents`);
        return response.data.data;
      }
      const response = await api.get<{ data: AgentEntry[] }>(`/projects/${projectId}/agents`);
      return { agents: response.data.data, selectedAgentId: null };
    },
    enabled: Boolean(projectId && (isReviewer || isOwner)),
  });

  const tasksQuery = useQuery({
    queryKey: tasksKey,
    queryFn: async () => {
      const response = isReviewer
        ? await api.get<{ data: AgentTask[] }>(`/projects/${projectId}/ai-review/tasks`, { params: { paperIds: paper!.id } })
        : await api.get<{ data: AgentTask[] }>(`/projects/${projectId}/agents/tasks`, { params: { paperIds: paper!.id } });
      return response.data.data;
    },
    enabled: Boolean(projectId && paper?.id && (isReviewer || isOwner)),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const connectMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const response = isReviewer
        ? await api.post<{ data: { accessToken: string } }>(`/projects/${projectId}/ai-review/agents`, { agentId })
        : await api.post<{ data: { accessToken: string } }>(`/projects/${projectId}/agents/${agentId}/screening-access`);
      return { agentId, accessToken: response.data.data.accessToken };
    },
    onSuccess: async ({ agentId, accessToken }) => {
      setTokens((previous) => ({ ...previous, [agentId]: accessToken }));
      setActiveAgentId(agentId);
      setIsChoosingAgent(false);
      toastSuccess("AI agent connected", "This agent is now connected to your reviewer workspace for this project.");
      await queryClient.invalidateQueries({ queryKey: agentsKey });
    },
    onError: () => toastError("Could not connect AI agent"),
  });

  const taskMutation = useMutation({
    mutationFn: async ({ agentId, paperId, taskStage }: { agentId: string; paperId: string; taskStage: ReviewStage }) => {
      const taskBody = {
        paperId,
        stage: taskStage,
        instructions: "Review this paper against the protocol criteria. Return a recommendation with criterion-level evidence and reasoning. Do not make or submit a human screening decision.",
      };
      if (isReviewer) {
        await api.post(`/projects/${projectId}/ai-review/agents/${agentId}/tasks`, taskBody);
      } else {
        await api.post(`/projects/${projectId}/agents/${agentId}/screening-tasks`, taskBody);
      }
      return { agentId, paperId, taskStage };
    },
    onSuccess: async ({ agentId, paperId, taskStage }) => {
      setTaskErrors((previous) => ({ ...previous, [taskStateKey(agentId, paperId, taskStage)]: "" }));
      toastSuccess("AI review task assigned");
      await queryClient.invalidateQueries({ queryKey: ["reviewer-ai-agent-tasks", projectId, paperId] });
    },
    onError: (error, variables) => {
      const message = isAxiosError(error)
        ? error.response?.data?.error?.message || error.response?.data?.error?.code || error.message
        : error instanceof Error ? error.message : "Could not assign the paper to this AI agent.";
      setTaskErrors((previous) => ({ ...previous, [taskStateKey(variables.agentId, variables.paperId, variables.taskStage)]: message }));
      toastError("Could not assign the paper to this AI agent", message);
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ agentId, action }: { agentId: string; action: "rotate" | "disable" | "enable" | "token" | "copy" }) => {
      if (action === "rotate") {
        const response = await api.post<{ data: { accessToken: string } }>(`/projects/${projectId}/ai-review/agents/${agentId}/rotate-token`);
        return { agentId, accessToken: response.data.data.accessToken };
      }
      if (action === "token" || action === "copy") {
        const tokenPath = isReviewer
          ? `/projects/${projectId}/ai-review/agents/${agentId}/token`
          : `/projects/${projectId}/agents/${agentId}/token`;
        const response = await api.get<{ data: { accessToken: string } }>(tokenPath);
        return { agentId, accessToken: response.data.data.accessToken };
      }
      await api.patch(`/projects/${projectId}/ai-review/agents/${agentId}`, { isActive: action === "enable" });
      return { agentId, accessToken: "" };
    },
    onSuccess: async ({ agentId, accessToken }, variables) => {
      if (accessToken) setTokens((previous) => ({ ...previous, [agentId]: accessToken }));
      if (variables.action === "copy" && accessToken) {
        try {
          await navigator.clipboard.writeText(accessToken);
          toastSuccess("Agent token copied to clipboard");
        } catch {
          toastError("Could not copy token", "Use the key button to view and copy the token manually.");
        }
      }
      if (variables.action === "disable") setTokens((previous) => ({ ...previous, [agentId]: "" }));
      await queryClient.invalidateQueries({ queryKey: agentsKey });
      if (variables.action === "rotate" || variables.action === "disable") setAgentConfirmation(null);
    },
    onError: (_error, variables) => {
      if (variables.action === "rotate" || variables.action === "disable") setAgentConfirmation(null);
      toastError("Could not update AI agent access");
    },
  });

  const requestAgentAction = (entry: AgentEntry) => {
    if (entry.access?.isActive) {
      setAgentConfirmation({ agentId: entry.agent.id, agentName: entry.agent.name, action: "disable" });
      return;
    }
    actionMutation.mutate({ agentId: entry.agent.id, action: "enable" });
  };

  const removeMutation = useMutation({
    mutationFn: async ({ agentId, taskId }: { agentId: string; taskId: string }) => {
      const endpoint = isReviewer
        ? `/projects/${projectId}/ai-review/agents/${agentId}/tasks/${taskId}`
        : `/projects/${projectId}/agents/${agentId}/tasks/${taskId}`;
      await api.delete(endpoint);
    },
    onSuccess: async () => {
      setTaskToRemove(null);
      await queryClient.invalidateQueries({ queryKey: tasksKey });
    },
    onError: () => toastError("Only pending AI tasks can be removed"),
  });

  const entries = agentsQuery.data?.agents ?? [];
  const isScreeningConnected = (entry: AgentEntry) => Boolean(entry.access?.isActive &&
    (isReviewer || entry.access.agentCapabilities?.includes("screening:leader")));
  const available = entries.filter((entry) => entry.agent.isActive && !isScreeningConnected(entry));
  const agentTasks = useMemo(() => {
    const grouped = new Map<string, AgentTask[]>();
    for (const task of tasksQuery.data ?? []) {
      if (task.paperId !== paper?.id || task.stage !== stage) continue;
      grouped.set(task.agentId, [...(grouped.get(task.agentId) ?? []), task]);
    }
    return grouped;
  }, [paper?.id, stage, tasksQuery.data]);

  useEffect(() => {
    if (!entries.length) return;
    if (activeAgentId && entries.some(({ agent }) => agent.id === activeAgentId)) return;
    const defaultEntry = entries.find(({ agent }) => agent.id === agentsQuery.data?.selectedAgentId)
      ?? entries.find(isScreeningConnected)
      ?? entries.find(({ agent }) => agent.isActive)
      ?? entries[0];
    setActiveAgentId(defaultEntry.agent.id);
  }, [activeAgentId, agentsQuery.data?.selectedAgentId, entries]);

  if ((!isReviewer && !isOwner) || !paper || !projectId) return null;
  const ownDecision = paper.decisions?.find((decision) =>
    decision.reviewerId === currentUserId && decision.phase === (stage === "FULL_TEXT" ? 1 : 0),
  );
  const recommendations = [...new Set((tasksQuery.data ?? [])
    .filter((task) => task.paperId === paper.id && task.stage === stage && task.status === "COMPLETED" && task.result?.decision)
    .map((task) => normalizeDecision(task.result!.decision)))];

  return (
    <section className="w-full min-w-0 overflow-hidden rounded-xl border border-border bg-white" aria-label="AI review workspace">
      <div className="flex min-w-0 items-center gap-2 border-b border-border px-3 pt-3">
        <FiCpu className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <div role="tablist" aria-label="AI review agents" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {entries.map(({ agent, access }) => (
            <button
              key={agent.id}
              id={`ai-agent-tab-${agent.id}`}
              type="button"
              role="tab"
              aria-selected={activeAgentId === agent.id}
              aria-controls={`ai-agent-panel-${agent.id}`}
              onClick={() => { setActiveAgentId(agent.id); setIsChoosingAgent(false); }}
              className={`relative flex min-h-11 max-w-40 shrink-0 items-center gap-1.5 rounded-t-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary motion-reduce:transition-none ${activeAgentId === agent.id ? "bg-primary-light text-primary" : "text-text-secondary hover:bg-bg-secondary hover:text-text-primary"}`}
              title={agent.name}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${access?.isActive ? "bg-success" : access ? "bg-text-muted" : "bg-border"}`} />
              <span className="truncate">{agent.name}</span>
              {activeAgentId === agent.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
          {available.length > 0 && <button type="button" onClick={() => setIsChoosingAgent(true)} className="min-h-11 shrink-0 rounded-t-md px-2 text-xs font-medium text-primary transition-colors hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary motion-reduce:transition-none">+ Connect</button>}
        </div>
        <button type="button" aria-label="Refresh AI agents" title="Refresh agents" onClick={() => void agentsQuery.refetch()} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"><FiRefreshCw className="h-3.5 w-3.5" /></button>
      </div>

      {agentsQuery.isError && <div role="alert" className="m-3 flex items-center justify-between gap-3 rounded-lg border border-error/20 bg-error/5 px-3 py-2 text-xs text-error"><span>Could not load your AI workspace.</span><button type="button" onClick={() => void agentsQuery.refetch()} className="min-h-11 shrink-0 rounded-md px-2 font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error">Retry</button></div>}
      {!entries.length && !agentsQuery.isLoading && !agentsQuery.isError && <div className="p-3 text-xs text-text-secondary">No AI agents are available in this project.</div>}

      {entries.map((entry) => {
        const entryTasks = agentTasks.get(entry.agent.id) ?? [];
        return <div
        key={entry.agent.id}
        id={`ai-agent-panel-${entry.agent.id}`}
        role="tabpanel"
        aria-labelledby={`ai-agent-tab-${entry.agent.id}`}
        hidden={activeAgentId !== entry.agent.id}
        className="min-w-0 p-3"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary"><FiCpu className="h-3.5 w-3.5" /></span>
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">{entry.agent.name}</h3>
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium ${entry.access?.isActive ? "text-success" : "text-text-secondary"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${entry.access?.isActive ? "bg-success" : "bg-text-muted"}`} />
            {isScreeningConnected(entry) ? "Connected" : "Not connected"}
          </span>
          {isScreeningConnected(entry) && <div className="ml-auto flex max-w-full flex-wrap justify-end gap-1">
            <button type="button" aria-label={`Refresh ${entry.agent.name} review`} title="Refresh this agent's results" onClick={() => void tasksQuery.refetch()} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"><FiRefreshCw className="h-3.5 w-3.5" /></button>
            <button type="button" aria-label={`View ${entry.agent.name} token`} title="View token" onClick={() => actionMutation.mutate({ agentId: entry.agent.id, action: "token" })} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"><FiKey className="h-3.5 w-3.5" /></button>
            <button type="button" aria-label={`Copy ${entry.agent.name} token`} title="Copy agent token" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ agentId: entry.agent.id, action: "copy" })} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50"><FiCopy className="h-3.5 w-3.5" /></button>
            {isReviewer && <>
            <button type="button" aria-label={`Rotate ${entry.agent.name} token`} title="Rotate token" onClick={() => setAgentConfirmation({ agentId: entry.agent.id, agentName: entry.agent.name, action: "rotate" })} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"><FiRefreshCw className="h-3.5 w-3.5" /></button>
            <button type="button" aria-label={`${entry.access?.isActive ? "Disconnect" : "Reconnect"} ${entry.agent.name}`} title={entry.access?.isActive ? "Disconnect agent" : "Reconnect agent"} onClick={() => requestAgentAction(entry)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"><FiSettings className="h-3.5 w-3.5" /></button>
            </>}
          </div>}
        </div>

        {(isChoosingAgent && activeAgentId === entry.agent.id || !isScreeningConnected(entry)) && <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
          <Select aria-label="Connect an AI agent" value="" placeholder={available.length ? "Connect another AI agent" : "No additional active agents"} disabled={!available.length || connectMutation.isPending} onChange={(event) => { if (event.target.value) connectMutation.mutate(event.target.value); }} options={available.map(({ agent }) => ({ value: agent.id, label: agent.name, description: agent.description }))} containerClassName="min-w-0 flex-1" menuClassName="max-h-72" className="h-11 rounded-xl px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
          {isChoosingAgent && <button type="button" onClick={() => setIsChoosingAgent(false)} className="min-h-11 shrink-0 rounded-md px-2 text-xs text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none">Cancel</button>}
          {!entry.agent.isActive && <span className="text-[10px] text-text-secondary">This catalog agent is unavailable.</span>}
        </div>}

        {tokens[entry.agent.id] && <div className="mt-3 rounded-lg border border-primary/15 bg-primary-light p-2.5">
          <label className="text-[10px] font-semibold text-primary">AI agent token</label>
          <input readOnly value={tokens[entry.agent.id]} onFocus={(event) => event.currentTarget.select()} className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface-white px-2 py-1.5 font-mono text-[10px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" />
        </div>}

        {isScreeningConnected(entry) && <Button type="button" variant="primary" size="sm" disabled={!entry.agent.isActive || (taskMutation.isPending && taskMutation.variables?.agentId === entry.agent.id && taskMutation.variables.paperId === paper.id && taskMutation.variables.taskStage === stage)} onClick={() => taskMutation.mutate({ agentId: entry.agent.id, paperId: paper.id, taskStage: stage })} className="mt-3 min-h-11 w-full rounded-lg normal-case tracking-normal text-xs font-semibold">
          {taskMutation.isPending && taskMutation.variables?.agentId === entry.agent.id && taskMutation.variables.paperId === paper.id && taskMutation.variables.taskStage === stage ? "Sending to agent…" : "Send to agent"}
        </Button>}
        {taskErrors[taskStateKey(entry.agent.id)] && <div role="alert" className="mt-2 break-words rounded-lg border border-error/20 bg-error/5 px-3 py-2 text-xs text-error">Task assignment failed: {taskErrors[taskStateKey(entry.agent.id)]}</div>}

        {ownDecision && <div className="mt-3 rounded-lg border border-primary/15 bg-primary-light px-3 py-2 text-[11px] text-primary">Your human decision: <strong>{ownDecision.decision}</strong>. AI recommendations never change it.</div>}
        {recommendations.length > 1 && <div className="mt-2 rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-[11px] text-warning">Agents recommend different outcomes. This is AI only and does not create a human review conflict.</div>}

        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-[11px] font-semibold text-text-primary">{stage === "FULL_TEXT" ? "Full text" : "Title / abstract"} screening</h4>
            <span className="text-[10px] text-text-tertiary">{entryTasks.length} {entryTasks.length === 1 ? "task" : "tasks"}</span>
          </div>
          {tasksQuery.isLoading && <p role="status" className="rounded-lg bg-bg-secondary px-3 py-2 text-xs text-text-secondary">Loading AI review results…</p>}
          {tasksQuery.isError && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-error/20 bg-error/5 px-3 py-2 text-xs text-error"><span>Could not load AI task results.</span><button type="button" onClick={() => void tasksQuery.refetch()} className="min-h-11 shrink-0 rounded-md px-2 font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error">Retry</button></div>}
          {!tasksQuery.isLoading && !tasksQuery.isError && !entryTasks.length && <p className="rounded-lg bg-bg-secondary px-3 py-3 text-xs text-text-secondary">{entry.access?.isActive ? "No review yet for this paper." : "Connect this agent to send papers for review. Past results remain available."}</p>}
          <div className="space-y-2">
            {entryTasks.map((task) => <div key={task.id} className="relative min-w-0">
              <AIReviewResultCard task={task} humanDecision={ownDecision?.decision} paperInput={{ hasPdf: Boolean(paper.pdfUrl), extractionStatus: paper.extraction?.status, extractionMessage: paper.extraction?.message }} />
              {(isReviewer || isOwner) && task.status === "ASSIGNED" && !task.result && <div className="mt-1 flex justify-end"><button type="button" aria-label="Remove pending AI review" disabled={removeMutation.isPending && removeMutation.variables?.taskId === task.id} onClick={() => setTaskToRemove(task)} className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-[10px] text-text-secondary transition-colors hover:bg-error/5 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"><FiTrash2 /> Remove pending task</button></div>}
            </div>)}
          </div>
        </div>
      </div>;
      })}
      <ConfirmModal
        isOpen={Boolean(taskToRemove)}
        onClose={() => setTaskToRemove(null)}
        onConfirm={() => {
          if (taskToRemove) {
            removeMutation.mutate({ agentId: taskToRemove.agentId, taskId: taskToRemove.id });
          }
        }}
        title="Remove pending AI task?"
        message="This task has no submitted result. Removing it cannot be undone."
        confirmText="Remove task"
        cancelText="Keep task"
        isLoading={removeMutation.isPending}
        variant="danger"
      />
      <ConfirmModal
        isOpen={Boolean(agentConfirmation)}
        onClose={() => { if (!actionMutation.isPending) setAgentConfirmation(null); }}
        onConfirm={() => {
          if (agentConfirmation) actionMutation.mutate({ agentId: agentConfirmation.agentId, action: agentConfirmation.action });
        }}
        title={agentConfirmation?.action === "rotate" ? "Rotate AI agent token?" : "Disconnect AI agent?"}
        message={agentConfirmation?.action === "rotate"
          ? `Rotate ${agentConfirmation.agentName}'s token? The previous token will stop working.`
          : `${agentConfirmation?.agentName ?? "This agent"} will stop receiving new review tasks. Its existing review history will remain available.`}
        confirmText={agentConfirmation?.action === "rotate" ? "Rotate token" : "Disconnect agent"}
        cancelText="Cancel"
        isLoading={actionMutation.isPending && (actionMutation.variables?.action === "rotate" || actionMutation.variables?.action === "disable")}
        variant="warning"
      />
    </section>
  );
}
