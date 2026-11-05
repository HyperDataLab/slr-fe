import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { FiCpu, FiEdit2, FiPlus, FiSave, FiSearch, FiToggleLeft, FiToggleRight, FiX } from "react-icons/fi";
import { isAxiosError } from "axios";
import api from "../../config/axios";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Select from "../../components/ui/Select";
import DataTableToolbar from "../../components/ui/DataTableToolbar";
import ActionButton from "../../components/admin/slr-projects/ActionButton";
import ConfirmModal from "../../components/ui/ConfirmModal";
import { toastSuccess } from "../../utils/toast";
import type { RootState } from "../../redux/store";

type Agent = { id: string; name: string; description: string; isActive: boolean };
type ApiData<T> = { data: T };
type StatusFilter = "all" | "active" | "disabled";

const errorText = (error: unknown) => isAxiosError(error)
  ? error.response?.data?.error?.message || error.message
  : "Request failed";

export default function AgentManagement() {
  const queryClient = useQueryClient();
  const userId = useSelector((state: RootState) => state.auth.user?.id ?? "anonymous");
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const agentsKey = ["admin", "agents", userId] as const;
  const agentsQuery = useQuery({
    queryKey: agentsKey,
    queryFn: async () => {
      const { data } = await api.get<ApiData<Agent[]>>("/admin/agents");
      return data.data;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
  const agents = agentsQuery.data ?? [];
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<Agent | null>(null);
  const [disableTarget, setDisableTarget] = useState<Agent | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const reload = async () => {
    await queryClient.invalidateQueries({ queryKey: agentsKey });
  };
  const isLoading = agentsQuery.isLoading;
  const loadError = error || (agentsQuery.error ? errorText(agentsQuery.error) : "");

  const filteredAgents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return agents.filter((agent) => {
      const matchesQuery = !query || agent.name.toLowerCase().includes(query) || (agent.description || "").toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? agent.isActive : !agent.isActive);
      return matchesQuery && matchesStatus;
    });
  }, [agents, searchQuery, statusFilter]);

  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await operation();
      return true;
    } catch (reason) {
      setError(errorText(reason));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const createAgent = async () => {
    setBusy(true);
    setFormError("");
    setError("");
    try {
      await api.post("/admin/agents", { name: name.trim(), description: description.trim() });
      setName("");
      setDescription("");
      setIsCreateOpen(false);
      toastSuccess("Agent added to the catalog.");
      void reload().catch((reason) => setError(errorText(reason)));
    } catch (reason) {
      setFormError(errorText(reason));
    } finally {
      setBusy(false);
    }
  };

  const saveAgent = async () => {
    if (!editing) return;
    const agent = editing;
    const succeeded = await run(async () => {
      await api.patch(`/admin/agents/${agent.id}`, { name: agent.name.trim(), description: agent.description.trim() });
      setEditing(null);
      await reload();
    });
    if (succeeded) toastSuccess("Agent updated.");
  };

  const toggleAgent = async (agent: Agent) => {
    const succeeded = await run(async () => {
      await api.patch(`/admin/agents/${agent.id}`, { isActive: !agent.isActive });
      await reload();
    });
    if (succeeded) toastSuccess(agent.isActive ? "Agent disabled." : "Agent enabled.");
    return succeeded;
  };

  const confirmDisable = async () => {
    if (!disableTarget) return;
    if (await toggleAgent(disableTarget)) setDisableTarget(null);
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 pb-2 text-text-primary">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-[-0.04em] text-text-primary">AI Agent Catalog</h1>
          <p className="mt-1 max-w-3xl text-[14px] leading-5 text-text-secondary">
            Define available agent providers. Project leaders select from this catalog and create project-scoped access.
          </p>
        </div>
        <Button className="h-10 w-full shrink-0 gap-2 sm:w-fit" onClick={() => { setFormError(""); setIsCreateOpen(true); }}>
          <FiPlus size={17} /> Add Agent
        </Button>
      </header>

      {loadError && agents.length > 0 && (
        <div role="alert" className="rounded-lg border border-error/20 bg-error/5 px-3 py-2.5 text-sm text-error">{loadError}</div>
      )}

      <section className="overflow-hidden rounded-xl border border-border bg-white">
        <DataTableToolbar
          search={<div className="group relative w-full min-w-0 sm:max-w-[340px] sm:flex-1">
            <FiSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-accent" />
            <input
              type="search"
              aria-label="Search agents"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-10 min-h-10 w-full rounded-lg border border-border bg-surface-white py-2 pl-9 pr-3 text-[13px] text-text-primary outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 motion-reduce:transition-none"
            />
          </div>}
          filterPlacement="left"
          filters={<div className="w-full sm:w-[180px]">
            <Select
              aria-label="Filter agents by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="h-10 min-h-10 w-full rounded-lg px-3"
              options={[
                { value: "all", label: "All statuses" },
                { value: "active", label: "Available" },
                { value: "disabled", label: "Disabled" },
              ]}
            />
          </div>}
        />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] table-fixed text-left">
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[40%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-bg-primary">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Agent name</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Description</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Status</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 3 }, (_, index) => (
                  <tr key={index} className="motion-safe:animate-pulse motion-reduce:animate-none">
                    <td colSpan={4} className="px-4 py-4"><div className="h-9 rounded-lg bg-bg-primary" /></td>
                  </tr>
                ))
              ) : filteredAgents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center">
                    <p className="text-sm font-semibold text-text-primary">{loadError && agents.length === 0 ? "Could not load agents" : "No agents found"}</p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {loadError && agents.length === 0 ? loadError : "Try another search or status filter."}
                    </p>
                    {loadError && agents.length === 0 && (
                      <Button variant="secondary" size="sm" className="mt-3" onClick={() => { setError(""); void agentsQuery.refetch(); }}>Retry</Button>
                    )}
                  </td>
                </tr>
              ) : filteredAgents.map((agent) => {
                const isEditing = editing?.id === agent.id;
                return (
                  <tr key={agent.id} className="transition-colors hover:bg-bg-primary/60 motion-reduce:transition-none">
                    <td className="px-4 py-4">
                      {isEditing ? (
                        <Input aria-label="Edit agent name" maxLength={120} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
                      ) : (
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-accent"><FiCpu size={17} /></span>
                          <span className="truncate text-[13px] font-semibold text-text-primary">{agent.name}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {isEditing ? (
                        <Input aria-label="Edit agent description" maxLength={1000} value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} />
                      ) : (
                        <span title={agent.description || "No description"} className="block truncate text-[13px] text-text-secondary">{agent.description || "No description"}</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset ${agent.isActive ? "bg-success/10 text-success ring-success/20" : "bg-bg-secondary text-text-secondary ring-border"}`}>
                        {agent.isActive ? "Available" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {isEditing ? (
                          <>
                            <ActionButton icon={FiSave} label="Save agent" disabled={busy || !editing.name.trim()} onClick={() => void saveAgent()} />
                            <ActionButton icon={FiX} label="Cancel editing" disabled={busy} onClick={() => setEditing(null)} />
                          </>
                        ) : (
                          <>
                            <ActionButton icon={FiEdit2} label="Edit agent" disabled={busy} onClick={() => { setError(""); setEditing(agent); }} />
                            {agent.isActive ? (
                              <ActionButton icon={FiToggleRight} label="Disable agent" disabled={busy} onClick={() => setDisableTarget(agent)} />
                            ) : (
                              <ActionButton icon={FiToggleLeft} label="Enable agent" disabled={busy} onClick={() => void toggleAgent(agent)} />
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-border bg-bg-primary px-4 py-3 text-[11px] text-text-muted">
          Showing {filteredAgents.length} of {agents.length} agents
        </div>
      </section>

      <Modal
        isOpen={isCreateOpen}
        onClose={() => { if (!busy) { setIsCreateOpen(false); setFormError(""); } }}
        title="Add agent"
        description="Add an agent provider to the shared catalog."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); setFormError(""); }} disabled={busy}>Cancel</Button>
            <Button type="submit" form="create-agent-form" isLoading={busy} disabled={!name.trim()}>Add Agent</Button>
          </>
        }
      >
        <form id="create-agent-form" onSubmit={(event) => { event.preventDefault(); void createAgent(); }} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="agent-name" className="text-xs font-semibold text-text-primary">Agent name</label>
            <Input id="agent-name" autoFocus required maxLength={120} placeholder="Claude, ChatGPT..." value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="agent-description" className="text-xs font-semibold text-text-primary">Description / Provider Notes</label>
            <Input id="agent-description" maxLength={1000} placeholder="Description or provider notes" value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          {formError && <div role="alert" className="rounded-lg border border-error/20 bg-error/5 px-3 py-2 text-sm text-error">{formError}</div>}
        </form>
      </Modal>

      <ConfirmModal
        isOpen={Boolean(disableTarget)}
        onClose={() => { if (!busy) setDisableTarget(null); }}
        onConfirm={() => void confirmDisable()}
        title="Disable agent?"
        message={<>Project leaders will no longer be able to add <strong>{disableTarget?.name}</strong> to a project.</>}
        confirmText="Disable agent"
        isLoading={busy}
        variant="danger"
      />
    </div>
  );
}
