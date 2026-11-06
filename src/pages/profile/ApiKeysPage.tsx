import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { FiCheck, FiCopy, FiKey, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import api from '../../config/axios';
import ConfirmModal from '../../components/ui/ConfirmModal';

type ApiKey = {
  keyId: string;
  displayName: string;
  keyPrefix: string;
  scopes: string[];
  allowedProjectIds: string[];
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  lastUsedAt: string | null;
};
type Envelope<T> = { isSuccess: boolean; data: T; errors: unknown };
type OneTimeSecret = { key: ApiKey; secret: string };
type PendingKeyAction = { type: 'rotate' | 'revoke'; key: ApiKey };

const scopeOptions = [
  ['repository:read', 'Search and read system wide repository works'],
  ['project:read', 'Read public project metadata'],
  ['analysis:read', 'Read repository analysis'],
  ['artifacts:download', 'Download available artifacts'],
] as const;
const defaultScopes = scopeOptions.slice(0, 3).map(([scope]) => scope);
const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString() : '—';
const apiError = (error: unknown) => {
  const response = (error as { response?: { data?: { errors?: unknown; message?: string } } })?.response?.data;
  if (typeof response?.message === 'string') return response.message;
  if (typeof response?.errors === 'string') return response.errors;
  return 'The request could not be completed. Please try again.';
};

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(defaultScopes);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [oneTimeSecret, setOneTimeSecret] = useState<OneTimeSecret | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [editName, setEditName] = useState('');
  const [editScopes, setEditScopes] = useState<string[]>([]);
  const [pendingKeyAction, setPendingKeyAction] = useState<PendingKeyAction | null>(null);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<Envelope<ApiKey[]>>('/me/repository-api-keys');
      setKeys(data.data);
    } catch (cause) { setError(apiError(cause)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadKeys(); }, [loadKeys]);
  const createKey = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || scopes.length === 0) return;
    setBusy(true); setError('');
    try {
      const { data } = await api.post<Envelope<OneTimeSecret>>('/me/repository-api-keys', { displayName: name.trim(), scopes });
      setOneTimeSecret(data.data); setName(''); await loadKeys();
    } catch (cause) { setError(apiError(cause)); }
    finally { setBusy(false); }
  };

  const rotateKey = (key: ApiKey) => setPendingKeyAction({ type: 'rotate', key });

  const revokeKey = (key: ApiKey) => setPendingKeyAction({ type: 'revoke', key });

  const confirmKeyAction = async () => {
    if (!pendingKeyAction) return;
    const action = pendingKeyAction;
    setPendingKeyAction(null);
    setBusy(true); setError('');
    try {
      if (action.type === 'rotate') {
        const { data } = await api.post<Envelope<OneTimeSecret>>(`/me/repository-api-keys/${encodeURIComponent(action.key.keyId)}/rotate`);
        setOneTimeSecret(data.data);
      } else {
        await api.delete(`/me/repository-api-keys/${encodeURIComponent(action.key.keyId)}`);
      }
      await loadKeys();
    } catch (cause) { setError(apiError(cause)); }
    finally { setBusy(false); }
  };

  const saveKeyEdits = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingKey || !editName.trim() || editScopes.length === 0) return;
    setBusy(true); setError('');
    try {
      await api.patch(`/me/repository-api-keys/${encodeURIComponent(editingKey.keyId)}`, { displayName: editName.trim(), scopes: editScopes });
      setEditingKey(null); await loadKeys();
    } catch (cause) { setError(apiError(cause)); }
    finally { setBusy(false); }
  };

  const copySecret = async () => {
    if (!oneTimeSecret) return;
    try { await navigator.clipboard.writeText(oneTimeSecret.secret); setCopied(true); }
    catch { setError('Could not copy the secret. Select and copy it manually.'); }
  };

  const toggleScope = (scope: string) => setScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]);
  const toggleEditScope = (scope: string) => setEditScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-widest text-primary">Account settings</p><h1 className="mt-2 flex items-center gap-3 text-3xl font-bold text-text-primary"><FiKey aria-hidden="true" /> API Keys</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">Create and manage credentials for the Research Repository API. Keys only access system wide data and cannot write data.</p></div>
        <a className="min-h-11 rounded-lg border border-border px-4 py-3 text-sm font-semibold text-primary hover:bg-bg-secondary" href="/repository-api-docs">API documentation</a>
      </div>

      {error && <div role="alert" className="mb-5 rounded-lg border border-error/30 bg-error/5 p-4 text-sm text-error">{error}</div>}

      {oneTimeSecret && <section aria-label="New API key secret" className="mb-8 rounded-xl border border-primary/30 bg-primary-light p-5 sm:p-6">
        <h2 className="text-lg font-bold text-text-primary">Save your API key now</h2><p className="mt-1 text-sm text-text-secondary">This secret is shown once. Store it somewhere secure; it cannot be viewed again.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row"><code className="min-w-0 flex-1 break-all rounded-lg border border-border bg-surface-white p-3 text-sm">{oneTimeSecret.secret}</code><button type="button" onClick={() => void copySecret()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white">{copied ? <FiCheck /> : <FiCopy />}{copied ? 'Copied' : 'Copy secret'}</button></div>
        <button type="button" className="mt-4 min-h-11 rounded-lg border border-border bg-surface-white px-4 text-sm font-semibold text-text-primary" onClick={() => { setOneTimeSecret(null); setCopied(false); }}>I have saved it</button>
      </section>}

      <section className="mb-8 rounded-xl border border-border bg-surface-white p-5 sm:p-6">
        <h2 className="text-lg font-bold text-text-primary">Create an API key</h2><p className="mt-1 text-sm text-text-secondary">You can have up to 10 active keys. Read scopes are selected by default.</p>
        <form className="mt-5 space-y-5" onSubmit={createKey}>
          <label className="block text-sm font-semibold text-text-primary">Key name<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Research dashboard" className="mt-2 min-h-11 w-full rounded-lg border border-border bg-surface-white px-3 font-normal outline-none focus:border-primary" /></label>
          <fieldset><legend className="text-sm font-semibold text-text-primary">Permissions</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{scopeOptions.map(([scope, description]) => <label key={scope} className="flex min-h-12 items-start gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} className="mt-1 accent-primary" /><span><span className="font-semibold">{scope}</span><span className="mt-1 block text-xs text-text-secondary">{description}</span></span></label>)}</div></fieldset>
          <p className="text-xs leading-5 text-text-muted">Project scoped resources are not enabled for self service yet. Keys never include write permissions.</p>
          <button disabled={busy || !name.trim() || scopes.length === 0} className="min-h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Working…' : 'Create key'}</button>
        </form>
      </section>

      <section><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-text-primary">Your API keys</h2><button type="button" onClick={() => void loadKeys()} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-primary">Refresh</button></div>
        {loading ? <p role="status" className="rounded-xl border border-border p-6 text-sm text-text-secondary">Loading API keys…</p> : keys.length === 0 ? <div className="rounded-xl border border-dashed border-border p-8 text-center"><FiKey className="mx-auto h-6 w-6 text-text-muted" /><p className="mt-3 font-semibold text-text-primary">No API keys yet</p><p className="mt-1 text-sm text-text-secondary">Create a key above to make your first authenticated API request.</p></div> : <div className="space-y-3">{keys.map((key) => <article key={key.keyId} className="rounded-xl border border-border bg-surface-white p-4 sm:p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-text-primary">{key.displayName}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${key.isActive ? 'bg-success/10 text-success' : 'bg-bg-secondary text-text-muted'}`}>{key.isActive ? 'Active' : 'Revoked'}</span></div><p className="mt-1 font-mono text-sm text-text-secondary">{key.keyPrefix}••••••••</p><p className="mt-2 text-xs text-text-muted">Created {formatDate(key.createdAt)} · Updated {formatDate(key.updatedAt)}</p><div className="mt-2 flex flex-wrap gap-1.5">{key.scopes.map((scope) => <span key={scope} className="rounded bg-bg-secondary px-2 py-1 text-xs text-text-secondary">{scope}</span>)}</div></div>{key.isActive && <div className="flex shrink-0 gap-2"><button disabled={busy} type="button" onClick={() => { setEditingKey(key); setEditName(key.displayName); setEditScopes([...key.scopes]); }} className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-semibold text-text-primary">Edit</button><button disabled={busy} type="button" onClick={() => void rotateKey(key)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-text-primary disabled:opacity-50"><FiRefreshCw />Rotate</button><button disabled={busy} type="button" onClick={() => void revokeKey(key)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-error/30 px-3 text-sm font-semibold text-error disabled:opacity-50"><FiTrash2 />Revoke</button></div>}</div></article>)}</div>}
      </section>
      <ConfirmModal
        isOpen={pendingKeyAction !== null}
        onClose={() => setPendingKeyAction(null)}
        onConfirm={() => void confirmKeyAction()}
        title={pendingKeyAction?.type === 'revoke' ? 'Revoke API key?' : 'Rotate API key?'}
        message={pendingKeyAction?.type === 'revoke'
          ? <>Revoke <strong>{pendingKeyAction.key.displayName}</strong>? This cannot be undone, and clients using this key will lose access immediately.</>
          : <>Rotate <strong>{pendingKeyAction?.key.displayName}</strong>? The current secret will stop working immediately, so update any clients that use it.</>}
        confirmText={pendingKeyAction?.type === 'revoke' ? 'Revoke key' : 'Rotate key'}
        cancelText="Keep key"
        variant={pendingKeyAction?.type === 'revoke' ? 'danger' : 'warning'}
      />
      {editingKey && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div role="dialog" aria-modal="true" aria-labelledby="edit-api-key-title" className="w-full max-w-xl rounded-xl bg-surface-white p-5 shadow-xl sm:p-6"><h2 id="edit-api-key-title" className="text-lg font-bold text-text-primary">Edit API key</h2><form onSubmit={saveKeyEdits} className="mt-4 space-y-4"><label className="block text-sm font-semibold">Key name<input required maxLength={120} value={editName} onChange={(event) => setEditName(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-border px-3 font-normal" /></label><fieldset><legend className="text-sm font-semibold">Permissions</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{scopeOptions.map(([scope, description]) => <label key={scope} className="flex min-h-12 items-start gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={editScopes.includes(scope)} onChange={() => toggleEditScope(scope)} className="mt-1 accent-primary" /><span><span className="font-semibold">{scope}</span><span className="mt-1 block text-xs text-text-secondary">{description}</span></span></label>)}</div></fieldset><div className="flex justify-end gap-2"><button type="button" onClick={() => setEditingKey(null)} className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold">Cancel</button><button disabled={busy || !editName.trim() || editScopes.length === 0} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50">Save changes</button></div></form></div></div>}
    </main>
  );
}
