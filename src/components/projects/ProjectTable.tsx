import React, { useMemo, useState } from "react";
import { FiArrowDown, FiArrowUp, FiCheckSquare, FiEye, FiRotateCcw, FiTrash2 } from "react-icons/fi";
import type { Project } from "../../types/project";
import { getProjectRoleLabel } from "../../types/project";
import { cn } from "../../utils/cn";
import Button from "../ui/Button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../ui/Table";

interface ProjectTableProps {
  projects: Project[];
  onView: (id: string) => void;
  onChecklistClick?: (projectId: string) => void;
  onDelete?: (project: Project) => void;
  onRestore?: (project: Project) => void;
  isDeletedView?: boolean;
  busyProjectId?: string | null;
}

type SortField = "title" | "domain" | "status" | "createdAt" | "modifiedAt";
type SortOrder = "asc" | "desc";

const formatDate = (value: string) =>
  value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const statusClass = (status: Project["statusText"]) => {
  if (status === "Active") return "border-success/20 bg-success/10 text-success";
  if (status === "Completed") return "border-primary/20 bg-primary-light text-primary";
  return "border-border bg-bg-primary text-text-secondary";
};

const ProjectTable: React.FC<ProjectTableProps> = ({
  projects,
  onView,
  onChecklistClick,
  onDelete,
  onRestore,
  isDeletedView = false,
  busyProjectId = null,
}) => {
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const sortedProjects = useMemo(() => {
    const direction = sortOrder === "asc" ? 1 : -1;
    return [...projects].sort((left, right) => {
      const leftValue = left[sortField] ?? "";
      const rightValue = right[sortField] ?? "";
      if (sortField === "createdAt" || sortField === "modifiedAt") {
        return (new Date(String(leftValue)).getTime() - new Date(String(rightValue)).getTime()) * direction;
      }
      return String(leftValue).localeCompare(String(rightValue)) * direction;
    });
  }, [projects, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((order) => (order === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const SortLabel: React.FC<{ label: string; field: SortField }> = ({ label, field }) => (
    <button
      type="button"
      onClick={() => handleSort(field)}
      className="inline-flex min-h-8 items-center gap-1.5 text-left font-medium text-text-secondary transition-colors motion-reduce:transition-none hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
    >
      {label}
      {sortField === field && (sortOrder === "asc" ? <FiArrowUp size={13} /> : <FiArrowDown size={13} />)}
    </button>
  );

  const handleChecklist = (event: React.MouseEvent, projectId: string) => {
    event.stopPropagation();
    onChecklistClick?.(projectId);
  };

  return (
    <>
      <div className="project-table-scroll-area hidden lg:block">
        <Table className="w-full min-w-[1280px] table-fixed">
          <colgroup>
            <col className="w-[36%]" />
            <col className="w-[10%]" />
            <col className="w-[12%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
          </colgroup>
          <TableHeader className="bg-bg-primary">
            <TableRow className="cursor-default hover:bg-transparent">
              <TableHead className="px-4 py-2.5 text-xs font-semibold normal-case tracking-normal">Project</TableHead>
              <TableHead className="px-4 py-2.5 text-center text-xs font-semibold normal-case tracking-normal">Status</TableHead>
              <TableHead className="px-4 py-2.5 text-left text-xs font-semibold normal-case tracking-normal">Your role</TableHead>
              <TableHead className="px-4 py-2.5 text-left text-xs font-semibold normal-case tracking-normal">Leader</TableHead>
              <TableHead className="px-4 py-2.5 text-left text-xs font-semibold normal-case tracking-normal"><SortLabel label="Dates" field="modifiedAt" /></TableHead>
              <TableHead className="px-4 py-2.5 text-right text-xs font-semibold normal-case tracking-normal">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProjects.map((project) => (
              <TableRow
                key={project.id}
                onClick={() => { if (!isDeletedView) onView(project.id); }}
                className={`group bg-surface-white transition-colors motion-reduce:transition-none hover:bg-bg-primary/60 ${isDeletedView ? "cursor-default" : "cursor-pointer"}`}
              >
                <TableCell className="px-4 py-2.5">
                  <div className="block min-w-0 truncate text-sm font-semibold text-text-primary group-hover:text-accent" title={project.title}>
                    {project.title}
                  </div>
                  <div className="mt-1 flex min-w-0 items-center gap-2 overflow-hidden text-xs text-text-secondary">
                    <span className="shrink-0 font-mono text-accent">{project.code}</span>
                    <span aria-hidden="true">·</span>
                    <span className="min-w-0 truncate">{project.domain}</span>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-center">
                  <span className={cn("inline-flex rounded-md border px-2 py-1 text-xs font-medium", statusClass(project.statusText))}>
                    {project.statusText}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-left text-sm text-text-primary">
                  {getProjectRoleLabel(project.role ?? project.roleText)}
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  <span className="block truncate text-sm text-text-primary" title={project.leader?.fullName}>
                    {project.leader?.fullName || "—"}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-xs leading-[18px] text-text-secondary">
                  {isDeletedView ? (
                    <div>Deleted {formatDate(project.deletedAt || "")}</div>
                  ) : (
                    <>
                      <div>Created {formatDate(project.createdAt)}</div>
                      <div>Updated {formatDate(project.modifiedAt)}</div>
                    </>
                  )}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {isDeletedView && onRestore ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={busyProjectId === project.id}
                        onClick={(event) => { event.stopPropagation(); onRestore(project); }}
                        className="gap-1.5 normal-case tracking-normal"
                      >
                        <FiRotateCcw size={14} /> Restore
                      </Button>
                    ) : !isDeletedView && onChecklistClick ? (
                      <button
                        type="button"
                        onClick={(event) => handleChecklist(event, project.id)}
                        className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-text-secondary transition-colors motion-reduce:transition-none hover:bg-bg-secondary hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        title="Open checklists"
                        aria-label={`Open checklists for ${project.title}`}
                      >
                        <FiCheckSquare size={16} />
                      </button>
                    ) : null}
                    {!isDeletedView && (
                      <>
                        {onDelete && getProjectRoleLabel(project.role ?? project.roleText) === "Project Leader" && (
                          <button
                            type="button"
                            disabled={busyProjectId === project.id}
                            onClick={(event) => { event.stopPropagation(); onDelete(project); }}
                            className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-text-secondary transition-colors motion-reduce:transition-none hover:bg-error/10 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error disabled:opacity-50"
                            title="Move project to deleted projects"
                            aria-label={`Delete project ${project.title}`}
                          >
                            <FiTrash2 size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); onView(project.id); }}
                          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-accent transition-colors motion-reduce:transition-none hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          <FiEye size={15} /> View
                        </button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {sortedProjects.length === 0 && (
              <TableRow className="cursor-default hover:bg-transparent">
                <TableCell colSpan={6} className="p-10 text-center text-sm text-text-secondary">
                  No projects to show.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="divide-y divide-border lg:hidden">
        {sortedProjects.map((project) => (
          <article key={project.id} className="space-y-4 bg-surface-white p-4 sm:p-5">
            <button type="button" onClick={() => { if (!isDeletedView) onView(project.id); }} className="block min-h-11 w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40" disabled={isDeletedView}>
              <div className="text-sm font-semibold text-text-primary">{project.title}</div>
              <div className="mt-1 text-xs text-text-secondary">
                <span className="font-mono text-accent">{project.code}</span> · {project.domain}
              </div>
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex rounded-md border px-2 py-1 text-xs font-medium", statusClass(project.statusText))}>{project.statusText}</span>
              <span className="rounded-md border border-border px-2 py-1 text-xs text-text-secondary">{getProjectRoleLabel(project.role ?? project.roleText)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
              <div><span className="block text-text-secondary">Leader</span><span className="mt-1 block truncate text-text-primary">{project.leader?.fullName || "—"}</span></div>
              <div><span className="block text-text-secondary">{isDeletedView ? "Deleted" : "Updated"}</span><span className="mt-1 block text-text-primary">{formatDate(isDeletedView ? project.deletedAt || "" : project.modifiedAt)}</span></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {isDeletedView && onRestore ? (
                <Button type="button" variant="secondary" size="sm" disabled={busyProjectId === project.id} onClick={() => onRestore(project)} className="min-h-11 gap-2 normal-case tracking-normal">
                  <FiRotateCcw size={15} /> Restore project
                </Button>
              ) : !isDeletedView && onChecklistClick ? (
                <Button type="button" variant="secondary" size="sm" onClick={(event) => handleChecklist(event, project.id)} className="min-h-11 gap-2">
                  <FiCheckSquare size={15} /> Checklists
                </Button>
              ) : null}
              {!isDeletedView && (
                <>
                  {onDelete && getProjectRoleLabel(project.role ?? project.roleText) === "Project Leader" && (
                    <Button type="button" variant="ghost" size="sm" disabled={busyProjectId === project.id} onClick={() => onDelete(project)} className="min-h-11 gap-2 text-error hover:bg-error/10 hover:text-error">
                      <FiTrash2 size={15} /> Delete
                    </Button>
                  )}
                  <Button type="button" variant="primary" size="sm" onClick={() => onView(project.id)} className="min-h-11 gap-2">
                    <FiEye size={15} /> View project
                  </Button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
};

export default ProjectTable;
