import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { isAxiosError } from "axios";
import { FiAlertTriangle, FiCopy, FiKey, FiPlus, FiSave, FiShield, FiToggleLeft, FiToggleRight, FiX } from "react-icons/fi";
import api from "../../config/axios";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import type { RootState } from "../../redux/store";

type Scope = "repository:read" | "repository:write" | "project:read" | "project:write" | "analysis:read" | "analysis:write" | "artifacts:download";
type Client = {
  clientId: string;
  displayName: string;
  keyPrefix: string;
  scopes: Scope[];
  allowedProjectIds: string[];
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};
type Project = { id: string; name: string; status: string };
type ApiEnvelope<T> = { data: T };
type Draft = Pick<Client, "clientId" | "displayName" | "scopes" | "allowedProjectIds">;

const SCOPE_OPTIONS: { value: Scope; label: string; description: string }[] = [
  { value: "repository:read", label: "Read repository", description: "Search works and read metadata, taxonomy, and artifact manifests." },
  { value: "repository:write", label: "Import to shared repository", description: "Upload a paper directly to the system-wide repository without linking it to a project." },
  { value: "project:read", label: "List projects", description: "List only the projects selected below." },
  { value: "project:write", label: "Upload to projects", description: "Upload PDFs only to the projects selected below." },
  { value: "analysis:read", label: "Read analyses", description: "List analysis runs and their saved metadata." },
  { value: "analysis:write", label: "Upload project analyses", description: "Submit Paper Fetcher analysis runs only to the projects selected below." },
  { value: "artifacts:download", label: "Download artifacts", description: "Download PDFs and analysis files. Requires the corresponding read scope." },
];
const errorText = (error: unknown) => isAxiosError(error) ? error.response?.data?.error?.message || error.message : "Request failed";
const emptyDraft = (): Draft => ({ clientId: "", displayName: "", scopes: ["repository:read"], allowedProjectIds: [] });

function ProjectPermissions({ projects, value, onChange }: { projects: Project[]; value: string[]; onChange: (ids: string[]) => void }) {
  const isAllProjects = value.includes("*");
  const toggleProject = (id: string) => onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value.filter((item) => item !== "*"), id]);
  return (
    <fieldset className="min-w-0 w-full space-y-3">
      <legend className="text-sm font-semibold text-text-primary">Project access</legend>
      <p className="text-xs leading-5 text-text-secondary">Project permissions apply to project listing, PDF upload, and analysis upload. Project-scoped reads are limited to these projects; restricted works still require an explicit project grant.</p>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-primary/20 bg-primary-light px-3 text-sm font-semibold text-text-primary">
        <input type="checkbox" checked={isAllProjects} onChange={(event) => onChange(event.target.checked ? ["*"] : [])} className="soft-checkbox" />
        All projects
      </label>
      {!isAllProjects && (
        <div className="dropdown-scroll-area custom-scrollbar max-h-56 w-full min-w-0 max-w-full space-y-1 overflow-x-hidden overflow-y-auto rounded-xl border border-border p-2">
          {!projects.length && <p className="p-3 text-xs text-text-secondary">No projects available.</p>}
          {projects.map((project) => (
            <label key={project.id} className="grid min-h-10 w-full min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-lg px-2.5 text-sm hover:bg-bg-secondary">
              <input type="checkbox" checked={value.includes(project.id)} onChange={() => toggleProject(project.id)} className="soft-checkbox" />
              <span className="min-w-0 truncate">{project.name}</span>
              <span className="max-w-28 truncate text-right text-[10px] text-text-muted">{project.status}</span>
            </label>
          ))}
        </div>
      )}
      <p className="text-[11px] text-text-muted">No projects selected means project scopes cannot access project records; system-wide repository works remain available under repository scopes.</p>
    </fieldset>
  );
}

export default function RepositoryApiClientsPage() {
  const queryClient = useQueryClient();
  const userId = useSelector((state: RootState) => state.auth.user?.id ?? "anonymous");
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const clientsKey = ["admin", "repository-api-clients", userId] as const;
  const clientsQuery = useQuery({
    queryKey: clientsKey,
    queryFn: async () => {
      const [clientsResponse, projectsResponse] = await Promise.all([
        api.get<ApiEnvelope<Client[]>>("/admin/repository-api-clients"),
        api.get<ApiEnvelope<Project[]>>("/admin/repository-api-clients/projects"),
      ]);
      // Keep the query cache limited to displayable metadata, even if the API
      // accidentally adds a one-time credential field to its list response.
      const clients = clientsResponse.data.data.map((client) => ({
        clientId: client.clientId,
        displayName: client.displayName,
        keyPrefix: client.keyPrefix,
        scopes: client.scopes,
        allowedProjectIds: client.allowedProjectIds,
        isActive: client.isActive,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
      }));
      return { clients, projects: projectsResponse.data.data };
    },
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const clients = clientsQuery.data?.clients ?? [];
  const projects = clientsQuery.data?.projects ?? [];
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rotateTarget, setRotateTarget] = useState<Client | null>(null);
  const [revealedKey, setRevealedKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const keyPanelRef = useRef<HTMLElement>(null);

  const reload = async () => {
    await queryClient.invalidateQueries({ queryKey: clientsKey });
  };
  useEffect(() => {
    if (revealedKey) keyPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [revealedKey]);

  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError(""); setNotice("");
    try { await operation(); } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };

  const create = () => run(async () => {
    const response = await api.post<ApiEnvelope<{ client: Client; apiKey: string }>>("/admin/repository-api-clients", {
      ...draft,
      clientId: draft.clientId.trim(),
      displayName: draft.displayName.trim(),
    });
    setRevealedKey(response.data.data.apiKey);
    setDraft(emptyDraft());
    await reload();
  });

  const beginEdit = (client: Client) => {
    setEditingId(client.clientId);
    setDraft({ clientId: client.clientId, displayName: client.displayName, scopes: [...client.scopes], allowedProjectIds: [...client.allowedProjectIds] });
  };

  const save = () => editingId && run(async () => {
    await api.patch(`/admin/repository-api-clients/${encodeURIComponent(editingId)}`, {
      displayName: draft.displayName.trim(), scopes: draft.scopes, allowedProjectIds: draft.allowedProjectIds,
    });
    setEditingId(null); setNotice("Client permissions updated."); await reload();
  });

  const toggle = (client: Client) => run(async () => {
    await api.patch(`/admin/repository-api-clients/${encodeURIComponent(client.clientId)}`, { isActive: !client.isActive });
    setNotice(client.isActive ? "Client disabled." : "Client enabled."); await reload();
  });

  const replaceAndCopyKey = (client: Client) => setRotateTarget(client);

  const confirmKeyRotation = () => {
    if (!rotateTarget) return;
    const client = rotateTarget;
    void run(async () => {
      const response = await api.post<ApiEnvelope<{ client: Client; apiKey: string }>>(`/admin/repository-api-clients/${encodeURIComponent(client.clientId)}/rotate`);
      const apiKey = response.data.data.apiKey;
      setRotateTarget(null);
      setRevealedKey(apiKey);
      setNotice("New key generated. The previous key stopped working immediately.");
      await reload();
      try {
        await navigator.clipboard.writeText(apiKey);
        setNotice("New API key copied. The previous key stopped working immediately.");
      } catch {
        setNotice("New API key generated. Copy it from the panel above; the previous key stopped working.");
      }
    });
  };

  const toggleScope = (scope: Scope) => setDraft((current) => ({ ...current, scopes: current.scopes.includes(scope) ? current.scopes.filter((item) => item !== scope) : [...current.scopes, scope] }));
  const copyKey = async () => {
    await navigator.clipboard.writeText(revealedKey);
    setNotice("API key copied. Store it in your integration's secret manager.");
  };

  return (
    <div className="mx-auto min-w-0 w-full max-w-[1600px] overflow-x-clip space-y-4 pb-6 text-text-primary">
      <header className="space-y-1.5 border-b border-border pb-4">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Repository API access</h1>
          <p className="mt-1 max-w-none text-sm leading-5 text-text-secondary">Manage client credentials, scopes, and project access.</p>
        </div>
      </header>

      {(error || clientsQuery.error) && <div role="alert" className="rounded-xl border border-error/20 bg-error/5 p-3 text-sm text-error">{error || errorText(clientsQuery.error)}</div>}
      {notice && <div role="status" className="rounded-xl border border-success/20 bg-success/5 p-3 text-sm text-success">{notice}</div>}

      <Modal
        isOpen={Boolean(rotateTarget)}
        onClose={() => setRotateTarget(null)}
        title="Replace this API key?"
        description="The current key will stop working as soon as a replacement is generated."
        size="sm"
        closeOnEsc={!busy}
        closeOnOutsideClick={!busy}
        footer={(
          <>
            <Button variant="secondary" size="sm" onClick={() => setRotateTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={confirmKeyRotation} isLoading={busy}>
              <FiKey aria-hidden="true" /> Generate replacement
            </Button>
          </>
        )}
      >
        {rotateTarget && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/5 p-4">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <FiAlertTriangle aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary">Connected integrations will need the new key.</p>
                <p className="mt-1 text-sm leading-5 text-text-secondary">
                  Any request using the current credential will be rejected immediately. The replacement is shown once, so copy and update it in the partner system.
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-bg-secondary/60 px-3 py-2.5">
              <p className="text-[11px] font-medium text-text-muted">API client</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-text-primary">{rotateTarget.displayName}</p>
              <code className="mt-1 block text-xs text-text-secondary">{rotateTarget.clientId}</code>
            </div>
          </div>
        )}
      </Modal>

      {revealedKey && (
        <section ref={keyPanelRef} className="rounded-xl border border-warning/30 bg-warning/5 p-4" aria-labelledby="new-key-title">
          <div className="flex items-start justify-between gap-3">
            <div><h2 id="new-key-title" className="font-semibold">Copy this API key now</h2><p className="mt-1 text-sm text-text-secondary">It is shown once. SLR stores only its hash, so this value cannot be retrieved later.</p></div>
            <button type="button" onClick={() => setRevealedKey("")} aria-label="Dismiss API key" className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white"><FiX /></button>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row"><code className="min-h-10 flex-1 break-all rounded-lg border border-border bg-white px-3 py-2.5 text-xs">{revealedKey}</code><button type="button" onClick={() => void copyKey().catch((reason) => setError(errorText(reason)))} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"><FiCopy /> Copy key</button></div>
        </section>
      )}

      <section className="rounded-xl border border-border bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-primary"><FiPlus /></span><div><h2 className="font-semibold">Create API client</h2><p className="mt-0.5 text-xs text-text-secondary">The key is shown once after creation.</p></div></div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-xs font-semibold"><span>Client ID</span><Input required maxLength={100} value={draft.clientId} onChange={(event) => setDraft({ ...draft, clientId: event.target.value })} placeholder="partner-a" /></label>
          <label className="flex flex-col gap-2 text-xs font-semibold"><span>Display name</span><Input required maxLength={120} value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} placeholder="Partner integration" /></label>
          <fieldset className="min-w-0 space-y-2.5 md:col-span-2"><legend className="text-sm font-semibold">API scopes</legend>{SCOPE_OPTIONS.map((scope) => <label key={scope.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-2.5"><input type="checkbox" checked={draft.scopes.includes(scope.value)} onChange={() => toggleScope(scope.value)} className="soft-checkbox mt-0.5" /><span><span className="block text-sm font-medium">{scope.label}</span><span className="mt-0.5 block text-xs leading-5 text-text-secondary">{scope.description}</span><code className="mt-1 block text-[10px] text-text-muted">{scope.value}</code></span></label>)}</fieldset>
          <div className="min-w-0 md:col-span-2"><ProjectPermissions projects={projects} value={draft.allowedProjectIds} onChange={(ids) => setDraft({ ...draft, allowedProjectIds: ids })} /></div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <span className="text-xs text-text-muted">Clients and permissions are stored in Firestore.</span>
          <button type="button" disabled={busy || !draft.clientId.trim() || !draft.displayName.trim() || !draft.scopes.length} onClick={() => void create()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"><FiKey /> Create client</button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-white">
        <div className="border-b border-border px-4 py-3"><h2 className="font-semibold">API clients <span className="ml-1 text-xs font-normal text-text-muted">{clients.length}</span></h2><p className="mt-0.5 text-xs text-text-secondary">Keys are stored as hashes. Copy API key generates a replacement and disables the current key.</p></div>
        {!clients.length ? <div className="p-8 text-center"><FiShield className="mx-auto h-8 w-8 text-text-muted" /><p className="mt-3 text-sm font-medium">No API clients configured</p><p className="mt-1 text-xs text-text-secondary">Create a client above to issue access to a partner system.</p></div> : <div className="divide-y divide-border">{clients.map((client) => editingId === client.clientId ? (
          <div key={client.clientId} className="space-y-4 bg-bg-secondary/50 p-5">
            <div className="grid min-w-0 gap-4 md:grid-cols-2"><label className="min-w-0 space-y-1.5 text-xs font-semibold">Display name<Input maxLength={120} value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} /></label><div className="min-w-0 space-y-3"><span className="text-sm font-semibold">API scopes</span>{SCOPE_OPTIONS.map((scope) => <label key={scope.value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-white p-3"><input type="checkbox" checked={draft.scopes.includes(scope.value)} onChange={() => toggleScope(scope.value)} className="soft-checkbox mt-0.5" /><span><span className="block text-sm font-medium">{scope.label}</span><code className="text-[10px] text-text-muted">{scope.value}</code></span></label>)}</div><div className="min-w-0 md:col-span-2"><ProjectPermissions projects={projects} value={draft.allowedProjectIds} onChange={(ids) => setDraft({ ...draft, allowedProjectIds: ids })} /></div></div>
            <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setEditingId(null)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-white px-4 text-sm"><FiX /> Cancel</button><button type="button" disabled={busy || !draft.scopes.length || !draft.displayName.trim()} onClick={() => void save()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"><FiSave /> Save permissions</button></div>
          </div>
        ) : (
          <article key={client.clientId} className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary"><FiKey /></div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{client.displayName}</h3><code className="rounded bg-bg-secondary px-2 py-1 text-[11px] text-text-secondary">{client.clientId}</code><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${client.isActive ? "bg-success/10 text-success" : "bg-bg-secondary text-text-muted"}`}>{client.isActive ? "Active" : "Disabled"}</span></div><p className="mt-1 text-xs text-text-secondary">Key prefix <code>{client.keyPrefix || "hidden"}…</code></p><div className="mt-3 flex flex-wrap gap-1.5">{client.scopes.map((scope) => <code key={scope} className="rounded-md border border-border px-2 py-1 text-[10px]">{scope}</code>)}</div><p className="mt-2 text-xs text-text-muted">Projects: {client.allowedProjectIds.includes("*") ? "All projects" : client.allowedProjectIds.length ? client.allowedProjectIds.map((id) => projects.find((project) => project.id === id)?.name || id).join(", ") : "System-wide works only"}</p></div>
              <div className="flex shrink-0 flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => beginEdit(client)} className="min-h-11 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-bg-secondary">Edit access</button><button type="button" disabled={busy} onClick={() => void replaceAndCopyKey(client)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-bg-secondary"><FiCopy /> Copy API key</button><button type="button" disabled={busy} onClick={() => void toggle(client)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-bg-secondary">{client.isActive ? <FiToggleRight /> : <FiToggleLeft />}{client.isActive ? "Disable" : "Enable"}</button></div>
            </div>
          </article>
        ))}</div>}
      </section>
    </div>
  );
}
