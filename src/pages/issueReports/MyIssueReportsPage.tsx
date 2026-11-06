import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { isAxiosError } from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiInbox,
  FiMessageCircle,
  FiRefreshCw,
  FiSend,
} from "react-icons/fi";
import {
  issueReportService,
  type IssueReport,
  type IssueReportCategory,
  type IssueReportStatus,
} from "../../services/issueReportService";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import type { RootState } from "../../redux/store";
import PageTransition from "../../components/common/PageTransition";

type PageTab = "new" | "reports";

function getPageUrlError(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return "";

  try {
    const url = new URL(trimmedValue);
    if (url.origin !== window.location.origin || url.username || url.password) {
      return "Use a page URL from this website.";
    }
    return "";
  } catch {
    return "Enter a valid page URL.";
  }
}

const labels = {
  OPEN: "Submitted",
  ACKNOWLEDGED: "Acknowledged",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
} satisfies Record<IssueReportStatus, string>;

const categories = {
  BUG: "Something is broken",
  ACCESS: "Access or permissions",
  DATA: "Incorrect or missing data",
  OTHER: "Other",
} satisfies Record<IssueReportCategory, string>;

const statusStyles = {
  OPEN: "border-sky-200 bg-sky-50 text-sky-800",
  ACKNOWLEDGED: "border-indigo-200 bg-indigo-50 text-indigo-800",
  IN_PROGRESS: "border-amber-200 bg-amber-50 text-amber-800",
  RESOLVED: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

function ReportStatus({ status }: { status: IssueReportStatus }) {
  const Icon = status === "OPEN" ? FiSend : status === "IN_PROGRESS" ? FiClock : FiCheckCircle;

  return (
    <span className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold ${statusStyles[status]}`}>
      <Icon aria-hidden="true" size={13} />
      {labels[status]}
    </span>
  );
}

function ReportCard({ item }: { item: IssueReport }) {
  return (
    <article className="rounded-xl border border-border bg-white p-4 transition-colors hover:border-primary/30 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="break-words text-sm font-semibold text-text-primary sm:text-base">{item.title}</h3>
            <span className="rounded-md bg-bg-secondary px-2 py-0.5 text-[11px] font-medium text-text-secondary">
              {categories[item.category]}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-text-secondary">
            Submitted {new Date(item.createdAt).toLocaleString()}
          </p>
        </div>
        <ReportStatus status={item.status} />
      </div>

      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
        {item.description}
      </p>

      <a
        href={item.pageUrl}
        target="_blank"
        rel="noreferrer"
        title={item.pageUrl}
        className="mt-3 block truncate text-xs text-primary hover:underline"
      >
        Reported page: {item.pageUrl}
      </a>

      {item.adminNote ? (
        <div className="mt-4 rounded-lg bg-primary-light/60 p-3.5 sm:p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <FiMessageCircle aria-hidden="true" size={14} />
            Response from the team
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-primary">{item.adminNote}</p>
        </div>
      ) : (
        <p className="mt-4 text-xs text-text-secondary">The support team has not responded yet.</p>
      )}
    </article>
  );
}

export default function MyIssueReportsPage() {
  const queryClient = useQueryClient();
  const userId = useSelector((state: RootState) => state.auth.user?.id ?? "anonymous");
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const [activeTab, setActiveTab] = useState<PageTab>("new");
  const newTabRef = useRef<HTMLButtonElement>(null);
  const reportsTabRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<IssueReportCategory>("BUG");
  const [description, setDescription] = useState("");
  const [pageUrl, setPageUrl] = useState(window.location.href);
  const [pageUrlError, setPageUrlError] = useState("");

  const reportsKey = ["issue-reports", "mine", userId] as const;
  const reportsQuery = useQuery({
    queryKey: reportsKey,
    queryFn: issueReportService.getMine,
    enabled: isAuthenticated,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchInterval: activeTab === "reports" ? 60_000 : false,
    refetchIntervalInBackground: false,
  });
  const items = reportsQuery.data ?? [];
  const loading = reportsQuery.isLoading;

  const refreshReports = () => {
    setError("");
    void reportsQuery.refetch({ throwOnError: true }).catch(() => {
      setError("Your reports could not be loaded. Please try again.");
    });
  };

  const openReports = items.filter((item) => item.status !== "RESOLVED").length;
  const resolvedReports = items.length - openReports;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = getPageUrlError(pageUrl);
    if (validationError) {
      setPageUrlError(validationError);
      return;
    }
    setPageUrlError("");
    const parsedPageUrl = new URL(pageUrl.trim());
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const created = await issueReportService.create({
        title: title.trim(),
        category,
        description: description.trim(),
        pageUrl: parsedPageUrl.href,
      });
      queryClient.setQueryData<IssueReport[]>(reportsKey, (current = []) => [created, ...current.filter((item) => item.id !== created.id)]);
      setTitle("");
      setDescription("");
      setMessage("Your report was submitted. You can follow its progress in My reports.");
      setActiveTab("reports");
    } catch (submitError) {
      const apiMessage = isAxiosError<{ error?: { message?: string } }>(submitError)
        ? submitError.response?.data?.error?.message
        : undefined;
      setError(apiMessage || "Your report could not be submitted. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const selectTab = (tab: PageTab) => {
    setActiveTab(tab);
    setError("");
    setMessage("");
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const nextTab = event.key === "Home" ? "new" : event.key === "End" ? "reports" : activeTab === "new" ? "reports" : "new";
    selectTab(nextTab);
    (nextTab === "new" ? newTabRef : reportsTabRef).current?.focus();
  };

  return (
    <div data-page-transition-single className="mx-auto w-full max-w-[1600px] space-y-5 p-5 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-tight text-text-primary sm:text-[28px]">Report a problem</h1>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-text-secondary">
            Send an issue to our team and keep track of its progress in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshReports}
          disabled={reportsQuery.isFetching}
          className="inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-lg border border-border bg-white px-4 text-sm font-medium text-text-primary transition-colors hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60 sm:self-center"
        >
          <FiRefreshCw aria-hidden="true" className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      <div className="border-b border-border">
        <div role="tablist" aria-label="Issue report options" className="flex flex-wrap gap-x-5 sm:gap-x-7">
          <button
            id="new-report-tab"
            ref={newTabRef}
            type="button"
            role="tab"
            aria-selected={activeTab === "new"}
            aria-controls="new-report-panel"
            tabIndex={activeTab === "new" ? 0 : -1}
            onClick={() => selectTab("new")}
            onKeyDown={handleTabKeyDown}
            className={`-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 ${activeTab === "new" ? "border-primary text-primary" : "border-transparent text-text-secondary hover:border-border hover:text-text-primary"}`}
          >
            <FiSend aria-hidden="true" size={16} />
            New report
          </button>
          <button
            id="my-reports-tab"
            ref={reportsTabRef}
            type="button"
            role="tab"
            aria-selected={activeTab === "reports"}
            aria-controls="my-reports-panel"
            tabIndex={activeTab === "reports" ? 0 : -1}
            onClick={() => selectTab("reports")}
            onKeyDown={handleTabKeyDown}
            className={`-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 ${activeTab === "reports" ? "border-primary text-primary" : "border-transparent text-text-secondary hover:border-border hover:text-text-primary"}`}
          >
            <FiFileText aria-hidden="true" size={16} />
            My reports
            <span className="text-xs text-text-muted">
              {items.length}
            </span>
          </button>
        </div>
      </div>

      {(error || (reportsQuery.isError && activeTab === "reports")) && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error || "Your reports could not be loaded. Please try again."}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </p>
      )}

      <PageTransition
        className="page-transition-host--contents"
        stagger={false}
        transitionKey={activeTab}
        skipInitialAnimation
      >
        {activeTab === "new" ? (
          <section
            id="new-report-panel"
            role="tabpanel"
            aria-labelledby="new-report-tab"
            className="rounded-xl border border-border bg-white p-5 sm:p-6"
          >
          <div className="mb-6 flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
              <FiAlertCircle aria-hidden="true" size={19} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Tell us what happened</h2>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                A clear description helps us investigate and resolve the issue sooner.
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-medium text-text-primary">
                Short title
                <input
                  required
                  minLength={3}
                  maxLength={160}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="For example, screening decisions are not saving"
                  className="mt-2 min-h-11 w-full rounded-xl border border-border bg-white px-3.5 text-sm font-normal text-text-primary placeholder:text-text-secondary outline-none transition-shadow focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>
              <label className="text-sm font-medium text-text-primary">
                Issue type
                <Select
                  aria-label="Issue type"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as IssueReportCategory)}
                  options={[
                    { value: "BUG", label: "Something is broken" },
                    { value: "ACCESS", label: "Access or permissions" },
                    { value: "DATA", label: "Incorrect or missing data" },
                    { value: "OTHER", label: "Other" },
                  ]}
                  className="mt-2 h-11 w-full rounded-xl px-3.5 text-sm"
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-text-primary">
              What happened?
              <textarea
                required
                minLength={10}
                maxLength={5000}
                rows={6}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe what you expected, what happened, and the steps that led to it."
                className="mt-2 w-full resize-y rounded-xl border border-border bg-white px-3.5 py-3 text-sm font-normal leading-6 text-text-primary placeholder:text-text-secondary outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              <span className="mt-1.5 block text-right text-xs font-normal text-text-secondary">
                {description.length}/5000 characters
              </span>
            </label>

            <label className="block text-sm font-medium text-text-primary">
              Page address
              <Input
                type="url"
                required
                value={pageUrl}
                aria-describedby="page-url-help"
                error={Boolean(pageUrlError)}
                onChange={(event) => {
                  setPageUrl(event.target.value);
                  setPageUrlError("");
                }}
                onPaste={(event) => {
                  const input = event.currentTarget;
                  window.setTimeout(() => setPageUrlError(getPageUrlError(input.value)), 0);
                }}
                onBlur={(event) => setPageUrlError(getPageUrlError(event.currentTarget.value))}
                placeholder="https://example.com/page"
                className="mt-2"
              />
              <span
                id="page-url-help"
                className={`mt-1.5 block text-xs font-normal ${pageUrlError ? "text-error" : "text-text-secondary"}`}
                role={pageUrlError ? "alert" : undefined}
              >
                {pageUrlError || "Use a page on this website. Change the path if the issue happened elsewhere."}
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
              <p className="text-xs leading-5 text-text-secondary">Your report is visible only to you and the support team.</p>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiSend aria-hidden="true" />
                {busy ? "Submitting…" : "Submit report"}
              </button>
            </div>
          </form>
          </section>
        ) : (
          <section id="my-reports-panel" role="tabpanel" aria-labelledby="my-reports-tab" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 px-1">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Your reports</h2>
              <p className="mt-1 text-sm text-text-secondary">Check the latest status and responses from the support team.</p>
            </div>
            {!loading && items.length > 0 && (
              <p className="text-xs font-medium text-text-secondary">
                {openReports} open · {resolvedReports} resolved
              </p>
            )}
          </div>

          {loading ? (
            <div className="space-y-3" aria-label="Loading reports" aria-busy="true">
              {[0, 1].map((item) => (
                <div key={item} className="rounded-xl border border-border bg-white p-5">
                  <div className="h-4 w-2/5 animate-pulse rounded bg-bg-secondary" />
                  <div className="mt-3 h-3 w-1/4 animate-pulse rounded bg-bg-secondary" />
                  <div className="mt-6 h-3 w-full animate-pulse rounded bg-bg-secondary" />
                  <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-bg-secondary" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-white px-5 py-14 text-center sm:py-16">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-secondary text-text-secondary">
                <FiInbox aria-hidden="true" size={21} />
              </span>
              <h3 className="mt-4 text-base font-semibold text-text-primary">No reports yet</h3>
              <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-text-secondary">
                When you submit a report, you can follow its status and read the team’s response here.
              </p>
              <button
                type="button"
                onClick={() => selectTab("new")}
                className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
              >
                <FiSend aria-hidden="true" size={14} />
                Create a report
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => <ReportCard key={item.id} item={item} />)}
            </div>
          )}
          </section>
        )}
      </PageTransition>
    </div>
  );
}
