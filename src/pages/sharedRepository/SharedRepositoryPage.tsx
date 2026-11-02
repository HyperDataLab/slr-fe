import { Fragment, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../redux/store";
import { FiBookOpen, FiDownload, FiRefreshCw, FiSearch } from "react-icons/fi";
import api from "../../config/axios";
import Button from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import DataTableToolbar from "../../components/ui/DataTableToolbar";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/Table";
import { toastError, toastSuccess } from "../../utils/toast";
import { getErrorMessage } from "../../utils/errorUtils";

type TaxonomyLevel = "domain" | "field" | "subfield" | "topic";
type Taxon = { id: string; label: string; level: TaxonomyLevel; parent?: { id: string; label: string; level: TaxonomyLevel } };
type Work = {
  workId: string; doi: string | null; title: string;
  metadata: { authors?: Array<string | { name: string }>; publicationYear?: number; journal?: string; isOpenAccess?: boolean; openAccessUrl?: string };
  classification: {
    primaryTopicId?: string; topicIds?: string[]; subfieldIds?: string[]; fieldIds?: string[]; domainIds?: string[];
    taxonomyLabels?: { domain?: string; field?: string; subfield?: string; topic?: string };
  };
  availability: { hasPdf?: boolean; hasFullText?: boolean; hasAnalysis?: boolean; currentPdfArtifactId?: string; currentFullTextArtifactId?: string };
};
type Envelope<T> = { isSuccess: boolean; data: T; errors?: Array<{ message?: string }> | null };
type TaxonomyState = Record<TaxonomyLevel, Taxon[]>;
const emptyTaxonomy: TaxonomyState = { domain: [], field: [], subfield: [], topic: [] };
const levels: TaxonomyLevel[] = ["domain", "field", "subfield", "topic"];
const labels: Record<TaxonomyLevel, string> = { domain: "Domain", field: "Field", subfield: "Subfield", topic: "Topic" };

function SharedRepositoryPage() {
  const navigate = useNavigate();
  const [works, setWorks] = useState<Work[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyState>(emptyTaxonomy);
  const [filters, setFilters] = useState<Record<TaxonomyLevel, string>>({ domain: "", field: "", subfield: "", topic: "" });
  const [assignment, setAssignment] = useState<Record<TaxonomyLevel, string>>({ domain: "", field: "", subfield: "", topic: "" });
  const [query, setQuery] = useState("");
  const [classificationFilter, setClassificationFilter] = useState<"all" | "classified" | "unclassified">("all");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedWork, setSelectedWork] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const isGlobalAdmin = useSelector((state: RootState) => state.auth.user?.role === "Admin");

  const loadTaxonomy = useCallback(async (level: TaxonomyLevel, parentId?: string) => {
    const response = await api.get<Envelope<{ items: Taxon[] }>>("/repository/taxonomy", { params: { level, ...(parentId ? { parentId } : {}), limit: 100 } });
    return response.data.data.items || [];
  }, []);

  const loadWorks = useCallback(async (cursor?: string, append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    try {
      const params: Record<string, string | number | boolean> = { limit: 50, openAccessOnly: true, ...(query.trim() ? { q: query.trim() } : {}), ...(cursor ? { cursor } : {}) };
      if (classificationFilter !== "all") params.hasClassification = classificationFilter === "classified";
      for (const level of levels) if (filters[level]) params[`${level}Id`] = filters[level];
      const response = await api.get<Envelope<{ items: Work[]; page: { nextCursor: string | null } }>>("/repository/works", { params });
      setWorks((current) => append ? [...current, ...(response.data.data.items || [])] : (response.data.data.items || []));
      setNextCursor(response.data.data.page?.nextCursor || null);
    } catch (error) { toastError("Could not load the paper library", getErrorMessage(error, "Please try again.")); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [classificationFilter, filters, query]);

  useEffect(() => {
    loadTaxonomy("domain")
      .then((items) => setTaxonomy((current) => ({ ...current, domain: items })))
      .catch((error) => toastError("Could not load OpenAlex taxonomy", getErrorMessage(error, "Please refresh the page.")));
  }, [loadTaxonomy]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadWorks(); }, 250);
    return () => window.clearTimeout(timer);
  }, [loadWorks]);

  const updateLevel = async (stateSetter: typeof setFilters, level: TaxonomyLevel, id: string) => {
    const index = levels.indexOf(level);
    stateSetter((current) => ({ ...current, [level]: id, ...Object.fromEntries(levels.slice(index + 1).map((child) => [child, ""])) }));
    setTaxonomy((current) => ({ ...current, ...Object.fromEntries(levels.slice(index + 1).map((child) => [child, []])) }));
    const child = levels[index + 1];
    if (child && id) {
      try {
        const items = await loadTaxonomy(child, id);
        setTaxonomy((current) => ({ ...current, [child]: items }));
      } catch (error) {
        toastError("Could not load taxonomy options", getErrorMessage(error, "Please select the taxonomy level again."));
      }
    }
  };

  const saveClassification = async (workId: string) => {
    if (!assignment.topic) {
      toastError("Topic not selected", "Select an OpenAlex topic to classify this paper.");
      return;
    }
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
      setSelectedWork(null);
      setAssignment({ domain: "", field: "", subfield: "", topic: "" });
      toastSuccess("Paper classified", "The paper remains in the shared library and can be filtered by OpenAlex taxonomy.");
      await loadWorks();
    } catch (error) {
      toastError("Could not save taxonomy", getErrorMessage(error, "Please select an OpenAlex topic again."));
    } finally {
      setBusy(false);
    }
  };
  const download = async (work: Work, artifactId?: string) => {
    if (!artifactId) return;
    try {
      const response = await api.get(`/repository/works/${encodeURIComponent(work.workId)}/artifacts/${encodeURIComponent(artifactId)}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data as Blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${work.title.replace(/[\\/:*?"<>|]/g, "_")}.${work.availability.currentPdfArtifactId === artifactId ? "pdf" : "md"}`; anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) { toastError("Download failed", getErrorMessage(error, "Could not download this file.")); }
  };

  const taxonomySelect = (level: TaxonomyLevel, value: string, stateSetter: typeof setFilters, data: Taxon[]) => (
    <label key={level} className="grid gap-1 text-xs font-medium text-text-secondary">
      {labels[level]}
      <Select
        aria-label={`Filter by ${labels[level]}`}
        searchable
        searchPlaceholder={`Search ${labels[level].toLowerCase()}...`}
        value={value}
        onChange={(event) => void updateLevel(stateSetter, level, event.target.value)}
        options={[
          { value: "", label: `All ${labels[level]}` },
          ...data.map((item) => ({ value: item.id, label: item.label })),
        ]}
        className="h-10 min-h-10 w-full rounded-lg px-3 text-sm"
      />
    </label>
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary"><FiBookOpen /> Shared library | OpenAlex</p><h1 className="text-[26px] font-semibold leading-tight tracking-tight text-text-primary">Paper library</h1><p className="mt-1 max-w-3xl text-[13px] leading-5 text-text-secondary sm:text-sm">Only Open Access records confirmed by OpenAlex are shown in this library.</p></div>
        <Button variant="secondary" onClick={() => void loadWorks()} disabled={loading}><FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh</Button>
      </header>

      <section className="overflow-hidden rounded-xl border border-border bg-surface-white">
        <DataTableToolbar
          search={(
            <div className="group relative w-full min-w-0 sm:max-w-[320px] sm:flex-1">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-accent" />
              <input
                aria-label="Search papers"
                placeholder="Search title, author, DOI..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-9 min-h-9 w-full rounded-lg border border-border bg-surface-white pl-9 pr-3 text-[13px] text-text-primary outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}
          filters={(
            <div className="flex flex-wrap items-center gap-2">
              <Select
                aria-label="Filter by classification status"
                value={classificationFilter}
                onChange={(event) => setClassificationFilter(event.target.value as typeof classificationFilter)}
                options={[
                  { value: "all", label: "All papers" },
                  { value: "unclassified", label: "Unclassified" },
                  { value: "classified", label: "Classified" },
                ]}
                className="h-9 min-h-9 min-w-[150px] rounded-lg px-3 text-[13px]"
              />
              <button type="button" onClick={() => { setFilters({ domain: "", field: "", subfield: "", topic: "" }); setClassificationFilter("all"); }} className="inline-flex h-9 min-h-9 items-center rounded-lg border border-border bg-surface-white px-3 text-[13px] text-primary transition-colors hover:bg-bg-primary">
                Clear filters
              </button>
            </div>
          )}
          filtersClassName="flex-1"
        />
        <div className="grid gap-3 border-b border-border bg-surface-white px-3 py-3 sm:grid-cols-2 sm:px-4 lg:grid-cols-4">
          {levels.map((level) => taxonomySelect(level, filters[level], setFilters, taxonomy[level]))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : works.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center text-sm text-text-secondary">
            <p>No confirmed Open Access papers match these filters.</p>
            {nextCursor && <Button variant="secondary" size="sm" disabled={loadingMore} onClick={() => void loadWorks(nextCursor, true)}>{loadingMore ? "Checking..." : "Check more papers"}</Button>}
          </div>
        ) : (
          <>
            <Table containerClassName="custom-scrollbar" className="w-full min-w-[1080px] lg:min-w-full table-fixed">
              <colgroup>
                <col className={isGlobalAdmin ? "w-[38%]" : "w-[42%]"} />
                <col className="w-[9%]" />
                <col className={isGlobalAdmin ? "w-[17%]" : "w-[18%]"} />
                <col className={isGlobalAdmin ? "w-[16%]" : "w-[17%]"} />
                <col className={isGlobalAdmin ? "w-[10%]" : "w-[14%]"} />
                {isGlobalAdmin && <col className="w-[10%]" />}
              </colgroup>
                <TableHeader className="bg-bg-primary">
                  <TableRow className="border-b border-border bg-bg-primary">
                    <TableHead scope="col" className="px-5 py-2.5 text-xs font-semibold normal-case tracking-normal text-text-secondary">Paper</TableHead>
                    <TableHead scope="col" className="px-4 py-2.5 text-xs font-semibold normal-case tracking-normal text-text-secondary">Year</TableHead>
                    <TableHead scope="col" className="px-4 py-2.5 text-xs font-semibold normal-case tracking-normal text-text-secondary">DOI</TableHead>
                    <TableHead scope="col" className="px-4 py-2.5 text-xs font-semibold normal-case tracking-normal text-text-secondary">Topic</TableHead>
                    <TableHead scope="col" className="px-4 py-2.5 text-xs font-semibold normal-case tracking-normal text-text-secondary">Files</TableHead>
                    {isGlobalAdmin && <TableHead scope="col" className="px-5 py-2.5 text-right text-xs font-semibold normal-case tracking-normal text-text-secondary">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {works.map((work) => {
                    const topicId = work.classification?.primaryTopicId || work.classification?.topicIds?.[0];
                    const classified = Boolean(topicId);
                    const taxonomyPath = [
                      { id: work.classification?.domainIds?.[0], label: work.classification?.taxonomyLabels?.domain },
                      { id: work.classification?.fieldIds?.[0], label: work.classification?.taxonomyLabels?.field },
                      { id: work.classification?.subfieldIds?.[0], label: work.classification?.taxonomyLabels?.subfield },
                      { id: topicId, label: work.classification?.taxonomyLabels?.topic },
                    ].filter((item): item is { id: string; label: string | undefined } => Boolean(item.id && item.label));
                    const taxonomyTitle = taxonomyPath.map((item) => item.label || item.id).join(" > ");
                    return (
                      <Fragment key={work.workId}>
                        <TableRow className="group transition-colors hover:bg-bg-primary/60">
                          <TableCell className="px-5 py-2.5">
                            <button type="button" onClick={() => navigate("/shared-repository/" + encodeURIComponent(work.workId) + "/details")} className="block w-full truncate text-left font-semibold text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" title={work.title}>{work.title}</button>
                            <div className="mt-1 truncate text-xs text-text-secondary">
                              {work.metadata?.authors?.map((author) => typeof author === "string" ? author : author.name).filter(Boolean).join(", ") || "Author unavailable"}
                              {work.metadata?.journal ? ` Â· ${work.metadata.journal}` : ""}
                            </div>
                            {taxonomyPath.length > 0 && (
                              <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px]" aria-label="OpenAlex taxonomy" title={taxonomyTitle}>
                                <span className="shrink-0 text-text-secondary">Taxonomy:</span>
                                <div className="min-w-0 truncate text-primary">
                                  {taxonomyPath.map((item, index) => (
                                    <Fragment key={item.id}>
                                      {index > 0 && <span className="px-1 text-text-muted">{"\u203a"}</span>}
                                      <a href={item.id} target="_blank" rel="noreferrer" title={item.label ? item.label + " (" + item.id + ")" : item.id} className="hover:underline">
                                        {item.label}
                                      </a>
                                    </Fragment>
                                  ))}
                                </div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-2.5 text-sm text-text-secondary">{work.metadata?.publicationYear || "—"}</TableCell>
                          <TableCell className="px-4 py-2.5">
                            {work.doi ? <span className="block truncate text-xs text-text-secondary" title={work.doi}>{work.doi}</span> : <span className="text-xs text-text-muted">—</span>}
                          </TableCell>
                          <TableCell className="px-4 py-2.5">
                            <span className={`inline-flex max-w-full truncate rounded-md border px-2 py-1 text-[11px] font-medium ${classified ? "border-success/20 bg-success/10 text-success" : "border-warning/20 bg-warning/10 text-warning"}`} title={taxonomyTitle || undefined}>
                              {classified ? (work.classification?.taxonomyLabels?.topic || "Taxonomy details pending") : "Unclassified"}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-2.5">
                            <div className="flex items-center gap-1">
                              {work.availability.currentPdfArtifactId && <Button variant="secondary" size="sm" className="min-h-8 gap-1 px-2 text-xs" onClick={() => void download(work, work.availability.currentPdfArtifactId)}><FiDownload size={13} /> PDF</Button>}
                              {work.availability.currentFullTextArtifactId && <Button variant="secondary" size="sm" className="min-h-8 gap-1 px-2 text-xs" onClick={() => void download(work, work.availability.currentFullTextArtifactId)}><FiDownload size={13} /> MD</Button>}
                              {!work.availability.currentPdfArtifactId && !work.availability.currentFullTextArtifactId && <span className="text-xs text-text-muted">—</span>}
                            </div>
                          </TableCell>
                          {isGlobalAdmin && (<TableCell className="px-5 py-2.5 text-right">
                            <Button variant="secondary" size="sm" className="min-h-8 normal-case tracking-normal" onClick={() => setSelectedWork(selectedWork === work.workId ? null : work.workId)}>{selectedWork === work.workId ? "Close" : classified ? "Edit topic" : "Classify"}</Button>
                          </TableCell>)}
                        </TableRow>
                        {isGlobalAdmin && selectedWork === work.workId && (
                          <TableRow>
                            <TableCell colSpan={isGlobalAdmin ? 6 : 5} className="bg-bg-primary/50 px-5 py-2.5">
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                                {levels.map((level) => taxonomySelect(level, assignment[level], setAssignment, taxonomy[level]))}
                                <div className="flex items-end"><Button disabled={busy || !assignment.topic} onClick={() => void saveClassification(work.workId)} className="min-h-10 w-full">Save classification</Button></div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            <div className="flex flex-col gap-2 border-t border-border bg-bg-primary/50 px-3 py-2.5 text-xs text-text-secondary sm:flex-row sm:items-center sm:justify-between sm:px-4"><span>Showing {works.length} Open Access papers</span>{nextCursor && <Button variant="secondary" size="sm" disabled={loadingMore} onClick={() => void loadWorks(nextCursor, true)}>{loadingMore ? "Checking..." : "Load more"}</Button>}</div>
          </>
        )}
      </section>
    </div>
  );
}

export default SharedRepositoryPage;
