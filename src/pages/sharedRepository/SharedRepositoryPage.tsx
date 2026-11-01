import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FiBookOpen, FiDownload, FiRefreshCw, FiSearch, FiUploadCloud } from "react-icons/fi";
import api from "../../config/axios";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { toastError, toastSuccess } from "../../utils/toast";
import { getErrorMessage } from "../../utils/errorUtils";

type TaxonomyLevel = "domain" | "field" | "subfield" | "topic";
type Taxon = { id: string; label: string; level: TaxonomyLevel; parent?: { id: string; label: string; level: TaxonomyLevel } };
type Work = {
  workId: string; doi: string | null; title: string;
  metadata: { authors?: Array<string | { name: string }>; publicationYear?: number; journal?: string };
  classification: { primaryTopicId?: string; topicIds?: string[]; subfieldIds?: string[]; fieldIds?: string[]; domainIds?: string[] };
  availability: { hasPdf?: boolean; hasFullText?: boolean; hasAnalysis?: boolean; currentPdfArtifactId?: string; currentFullTextArtifactId?: string };
};
type Envelope<T> = { isSuccess: boolean; data: T; errors?: Array<{ message?: string }> | null };
type TaxonomyState = Record<TaxonomyLevel, Taxon[]>;
const emptyTaxonomy: TaxonomyState = { domain: [], field: [], subfield: [], topic: [] };
const levels: TaxonomyLevel[] = ["domain", "field", "subfield", "topic"];
const labels: Record<TaxonomyLevel, string> = { domain: "Domain", field: "Field", subfield: "Subfield", topic: "Topic" };

function SharedRepositoryPage() {
  const [works, setWorks] = useState<Work[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyState>(emptyTaxonomy);
  const [filters, setFilters] = useState<Record<TaxonomyLevel, string>>({ domain: "", field: "", subfield: "", topic: "" });
  const [assignment, setAssignment] = useState<Record<TaxonomyLevel, string>>({ domain: "", field: "", subfield: "", topic: "" });
  const [query, setQuery] = useState("");
  const [classificationFilter, setClassificationFilter] = useState<"all" | "classified" | "unclassified">("all");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDoi, setUploadDoi] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedWork, setSelectedWork] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const loadTaxonomy = useCallback(async (level: TaxonomyLevel, parentId?: string) => {
    const response = await api.get<Envelope<{ items: Taxon[] }>>("/repository/taxonomy", { params: { level, ...(parentId ? { parentId } : {}), limit: 100 } });
    return response.data.data.items || [];
  }, []);

  const loadWorks = useCallback(async (cursor?: string, append = false) => {
    if (!append) setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = { limit: 50, ...(query.trim() ? { q: query.trim() } : {}), ...(cursor ? { cursor } : {}) };
      if (classificationFilter !== "all") params.hasClassification = classificationFilter === "classified";
      for (const level of levels) if (filters[level]) params[`${level}Id`] = filters[level];
      const response = await api.get<Envelope<{ items: Work[]; page: { nextCursor: string | null } }>>("/repository/works", { params });
      setWorks((current) => append ? [...current, ...(response.data.data.items || [])] : (response.data.data.items || []));
      setNextCursor(response.data.data.page?.nextCursor || null);
    } catch (error) { toastError("Không tải được kho bài báo", getErrorMessage(error, "Thử tải lại sau.")); }
    finally { setLoading(false); }
  }, [classificationFilter, filters, query]);

  useEffect(() => { loadTaxonomy("domain").then((items) => setTaxonomy((current) => ({ ...current, domain: items }))).catch((error) => toastError("Không tải được taxonomy OpenAlex", getErrorMessage(error, "Thử làm mới trang."))); }, [loadTaxonomy]);
  useEffect(() => { const timer = window.setTimeout(() => { void loadWorks(); }, 250); return () => window.clearTimeout(timer); }, [loadWorks]);

  const updateLevel = async (stateSetter: typeof setFilters, level: TaxonomyLevel, id: string) => {
    const index = levels.indexOf(level);
    stateSetter((current) => ({ ...current, [level]: id, ...Object.fromEntries(levels.slice(index + 1).map((child) => [child, ""])) }));
    setTaxonomy((current) => ({ ...current, ...Object.fromEntries(levels.slice(index + 1).map((child) => [child, []])) }));
    const child = levels[index + 1];
    if (child && id) {
      try { const items = await loadTaxonomy(child, id); setTaxonomy((current) => ({ ...current, [child]: items })); }
      catch (error) { toastError("Không tải được nhánh taxonomy", getErrorMessage(error, "Thử chọn lại cấp taxonomy.")); }
    }
  };

  const submitUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (!uploadFile) { toastError("Chưa chọn file", "Chọn PDF hoặc Markdown để đưa vào kho chung."); return; }
    const body = new FormData(); body.append("file", uploadFile);
    if (uploadTitle.trim()) body.append("title", uploadTitle.trim());
    if (uploadDoi.trim()) body.append("doi", uploadDoi.trim());
    setBusy(true);
    try {
      await api.post("/repository/works/upload", body);
      setUploadFile(null); setUploadTitle(""); setUploadDoi("");
      const input = document.getElementById("shared-repository-file") as HTMLInputElement | null;
      if (input) input.value = "";
      toastSuccess("Đã lưu vào kho chung", "Bài báo được đưa vào Unclassified cho đến khi có taxonomy.");
      await loadWorks();
    } catch (error) { toastError("Upload thất bại", getErrorMessage(error, "Không thể lưu file vào kho chung.")); }
    finally { setBusy(false); }
  };

  const saveClassification = async (workId: string) => {
    if (!assignment.topic) { toastError("Chưa chọn Topic", "Chọn Topic OpenAlex để phân loại bài báo."); return; }
    const find = (level: TaxonomyLevel) => taxonomy[level].find((item) => item.id === assignment[level]);
    const selected = Object.fromEntries(levels.map((level) => [level, find(level)])) as Record<TaxonomyLevel, Taxon | undefined>;
    setBusy(true);
    try {
      await api.patch(`/repository/works/${encodeURIComponent(workId)}/classification`, {
        primaryTopicId: assignment.topic,
        topicIds: [assignment.topic],
        subfieldIds: selected.subfield ? [selected.subfield.id] : [],
        fieldIds: selected.field ? [selected.field.id] : [],
        domainIds: selected.domain ? [selected.domain.id] : [],
      });
      setSelectedWork(null); setAssignment({ domain: "", field: "", subfield: "", topic: "" });
      toastSuccess("Đã phân loại bài báo", "Work vẫn nằm trong kho chung và có thể lọc theo OpenAlex.");
      await loadWorks();
    } catch (error) { toastError("Không lưu được taxonomy", getErrorMessage(error, "Thử chọn lại OpenAlex Topic.")); }
    finally { setBusy(false); }
  };

  const download = async (work: Work, artifactId?: string) => {
    if (!artifactId) return;
    try {
      const response = await api.get(`/repository/works/${encodeURIComponent(work.workId)}/artifacts/${encodeURIComponent(artifactId)}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data as Blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${work.title.replace(/[\\/:*?"<>|]/g, "_")}.${work.availability.currentPdfArtifactId === artifactId ? "pdf" : "md"}`; anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) { toastError("Tải file thất bại", getErrorMessage(error, "Không thể tải artifact này.")); }
  };

  const taxonomySelect = (level: TaxonomyLevel, value: string, stateSetter: typeof setFilters, data: Taxon[]) => (
    <label key={level} className="grid gap-1 text-xs font-medium text-text-secondary">
      {labels[level]}
      <select value={value} onChange={(event) => void updateLevel(stateSetter, level, event.target.value)} className="min-h-10 rounded-lg border border-border bg-surface-white px-3 text-sm text-text-primary">
        <option value="">{`Tất cả ${labels[level]}`}</option>
        {data.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label>
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary"><FiBookOpen /> Work chung · OpenAlex</p><h1 className="text-2xl font-bold text-text-primary sm:text-3xl">Kho bài báo</h1><p className="mt-2 max-w-2xl text-sm text-text-secondary">Mọi user đăng nhập có thể thêm file. Bài mới ở Unclassified; phân loại tạo ngăn logic theo taxonomy, không di chuyển file.</p></div>
        <Button variant="secondary" onClick={() => void loadWorks()} disabled={loading}><FiRefreshCw className={loading ? "animate-spin" : ""} /> Làm mới</Button>
      </header>

      <form onSubmit={submitUpload} className="grid gap-3 rounded-2xl border border-border bg-surface-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <label className="grid gap-1 text-xs font-medium text-text-secondary lg:col-span-2">PDF hoặc Markdown
          <input id="shared-repository-file" type="file" accept=".pdf,.md,.markdown,application/pdf,text/markdown" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} className="min-h-10 rounded-lg border border-border px-2 py-2 text-sm" />
        </label>
        <label className="grid gap-1 text-xs font-medium text-text-secondary">Tiêu đề (tùy chọn)<input value={uploadTitle} onChange={(event) => setUploadTitle(event.target.value)} className="min-h-10 rounded-lg border border-border px-3 text-sm" placeholder="Tự lấy từ file nếu để trống" /></label>
        <label className="grid gap-1 text-xs font-medium text-text-secondary">DOI (không bắt buộc)<input value={uploadDoi} onChange={(event) => setUploadDoi(event.target.value)} className="min-h-10 rounded-lg border border-border px-3 text-sm" placeholder="10.xxxx/..." /></label>
        <div className="flex items-end"><Button type="submit" disabled={busy || !uploadFile} className="min-h-10 w-full"><FiUploadCloud /> {busy ? "Đang lưu…" : "Đưa vào Unclassified"}</Button></div>
      </form>

      <section className="space-y-4 rounded-2xl border border-border bg-surface-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2"><div className="relative min-w-56 flex-1"><FiSearch className="absolute left-3 top-3 text-text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-10 w-full rounded-lg border border-border pl-9 pr-3 text-sm" placeholder="Tìm tiêu đề, tác giả, DOI…" /></div><select value={classificationFilter} onChange={(event) => setClassificationFilter(event.target.value as typeof classificationFilter)} className="min-h-10 rounded-lg border border-border bg-white px-3 text-sm"><option value="all">Tất cả bài</option><option value="unclassified">Unclassified</option><option value="classified">Đã phân loại</option></select><button type="button" onClick={() => { setFilters({ domain: "", field: "", subfield: "", topic: "" }); setClassificationFilter("all"); }} className="min-h-10 rounded-lg border border-border px-3 text-sm text-primary">Xóa bộ lọc</button></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{levels.map((level) => taxonomySelect(level, filters[level], setFilters, taxonomy[level]))}</div>
        {loading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : works.length === 0 ? <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-text-secondary">Không có bài báo khớp bộ lọc.</div> : <div className="space-y-3">{works.map((work) => {
          const classified = Boolean(work.classification?.primaryTopicId || work.classification?.topicIds?.length);
          return <article key={work.workId} className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-semibold text-text-primary">{work.title}</h2><p className="mt-1 text-xs text-text-secondary">{work.metadata?.authors?.map((author) => typeof author === "string" ? author : author.name).filter(Boolean).join(", ") || "Chưa có tác giả"}{work.metadata?.publicationYear ? ` · ${work.metadata.publicationYear}` : ""}{work.doi ? ` · DOI ${work.doi}` : ""}</p><p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classified ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>{classified ? `Topic: ${work.classification.primaryTopicId || work.classification.topicIds?.[0]}` : "Unclassified"}</p></div>
              <div className="flex flex-wrap gap-2">{work.availability.currentPdfArtifactId && <Button variant="secondary" size="sm" onClick={() => void download(work, work.availability.currentPdfArtifactId)}><FiDownload /> PDF</Button>}{work.availability.currentFullTextArtifactId && <Button variant="secondary" size="sm" onClick={() => void download(work, work.availability.currentFullTextArtifactId)}><FiDownload /> Markdown</Button>}<Button variant="secondary" size="sm" onClick={() => setSelectedWork(selectedWork === work.workId ? null : work.workId)}>{classified ? "Sửa taxonomy" : "Phân loại"}</Button></div></div>
            {selectedWork === work.workId && <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-5">{levels.map((level) => taxonomySelect(level, assignment[level], setAssignment, taxonomy[level]))}<div className="flex items-end"><Button disabled={busy || !assignment.topic} onClick={() => void saveClassification(work.workId)} className="min-h-10 w-full">Lưu phân loại</Button></div></div>}
          </article>;
        })}{nextCursor && <div className="flex justify-center pt-2"><Button variant="secondary" disabled={loading} onClick={() => void loadWorks(nextCursor, true)}>Tải thêm</Button></div>}</div>}
      </section>
    </div>
  );
}

export default SharedRepositoryPage;
