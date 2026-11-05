export const QUERY_KEYS = {
  // Global / Static
  static: {
    all: ["static-data"] as const,
    questionTypes: ["question-types"] as const,
  },

  // Projects
  projects: {
    all: ["projects"] as const,
    list: (userId: string, params?: object) => ["projects", "list", { userId, ...params }] as const,
    myList: (userId: string, params?: object) => ["projects", "my", { userId, ...params }] as const,
    deleted: (userId: string, params?: object) => ["projects", "deleted", { userId, ...params }] as const,
    detail: (id: string, userId: string) => ["projects", "detail", id, { userId }] as const,
    members: (projectId: string, params?: object) =>
      ["projects", projectId, "members", { ...params }] as const,

    // Governance nested in projects
    needs: (projectId: string) => ["projects", projectId, "review-needs"] as const,
    documents: (projectId: string) => ["projects", projectId, "documents"] as const,
    objectives: (projectId: string) => ["projects", projectId, "objectives"] as const,
    researchQuestions: (projectId: string) =>
      ["projects", projectId, "research-questions"] as const,
    timetable: (projectId: string) => ["projects", projectId, "timetable"] as const,
    invitations: (projectId: string, status?: number) =>
      ["projects", projectId, "invitations", { status }] as const,
    picocs: (projectId: string) => ["projects", projectId, "picocs"] as const,
    myMembership: (projectId: string, userId?: string) => userId
      ? ["projects", projectId, "my-membership", { userId }] as const
      : ["projects", projectId, "my-membership"] as const,
  },

  // Review & Workspace
  reviewProcesses: {
    all: ["review-processes"] as const,
    byProject: (projectId: string) => ["review-processes", "project", projectId] as const,
    detail: (id: string) => ["review-processes", "detail", id] as const,
  },

  paperPool: {
    papers: (projectId: string, params?: Record<string, unknown>) =>
      ["paper-pool", projectId, "papers", params ?? {}] as const,
    metadata: (projectId: string) => ["paper-pool", projectId, "metadata"] as const,
    filterSettings: (projectId: string) => ["paper-pool", projectId, "filter-settings"] as const,
    filterSettingDetail: (projectId: string, filterId: string) =>
      ["paper-pool", projectId, "filter-settings", filterId] as const,
    savedFilterPreview: (projectId: string, filterId: string, params?: Record<string, unknown>) =>
      ["paper-pool", projectId, "saved-filter-preview", filterId, params ?? {}] as const,
    duplicatePairs: (projectId: string, filters?: object) =>
      ["paper-pool", projectId, "duplicate-pairs", filters] as const,
  },

  synthesisExecution: {
    workspace: (reviewProcessId: string) =>
      ["synthesis-execution", "workspace", reviewProcessId] as const,
    sourceDataGroups: (reviewProcessId: string) =>
      ["synthesis-execution", "source-data-groups", reviewProcessId] as const,
    strategies: (synthesisProcessId: string) =>
      ["synthesis-execution", "strategies", synthesisProcessId] as const,
  },

  workspace: {
    detail: (id: string, userId: string) => ["workspace", id, { userId }] as const,
  },

  // Identification Phase / Papers
  identification: {
    all: ["identification-processes"] as const,
    detail: (processId: string) => ["identification-processes", processId, "detail"] as const,
    importBatches: (processId: string) =>
      ["identification-processes", processId, "import-batches"] as const,

    searchExecutions: (processId: string) =>
      ["identification-processes", processId, "search-executions"] as const,
    statistics: (processId: string) =>
      ["identification-processes", processId, "statistics"] as const,
    uniquePapers: (processId: string, filters?: object) =>
      ["identification-processes", processId, "unique-papers", filters] as const,
    readyPapers: (processId: string, filters?: object) =>
      ["identification-processes", processId, "ready-papers", filters] as const,
    snapshotPapers: (processId: string, filters?: object) =>
      ["identification-processes", processId, "snapshot", filters] as const,
  },

  papers: {
    all: ["papers"] as const,
    detail: (paperId: string) => ["papers", "detail", paperId] as const,
    checkedDuplicates: (studySelectionProcessId: string, params?: Record<string, unknown>) =>
      ["papers", "checked-duplicates", studySelectionProcessId, params ?? {}] as const,
    references: (id: string) => ["papers", id, "references"] as const,
    citations: (id: string) => ["papers", id, "citations"] as const,
    graph: (id: string, depth: number, minConfidence: number) =>
      ["papers", id, "graph", { depth, minConfidence }] as const,
    abstract: (id: string, doi?: string | null) => ["papers", id, "abstract", doi ?? ""] as const,
    suggestions: (id: string, params?: Record<string, unknown>) =>
      ["papers", id, "suggestions", params ?? {}] as const,
    topCited: (params?: Record<string, unknown>) => ["papers", "top-cited", params ?? {}] as const,
  },

  // Search & Batches (Global lookups)
  searchExecutions: {
    all: ["search-executions"] as const,
    detail: (id: string) => ["search-executions", id] as const,
    importBatches: (searchId: string) => ["search-executions", searchId, "import-batches"] as const,
  },

  importBatches: {
    all: ["import-batches"] as const,
    detail: (id: string) => ["import-batches", id] as const,
    papers: (id: string) => ["import-batches", id, "papers"] as const,
  },

  // Research Questions specific
  researchQuestions: {
    picoc: (questionId: string) => ["research-questions", questionId, "picoc-elements"] as const,
  },

  // User specific
  user: {
    reports: (userId: string) => ["reports", { userId }] as const,
    notifications: {
      all: (userId: string) => ["notifications", userId] as const,
      list: (userId: string, params?: object) =>
        ["notifications", userId, "list", params ?? {}] as const,
      unreadCount: (userId: string) => ["notifications", userId, "unread-count"] as const,
    },
  },

  // Invitations
  invitations: {
    all: ["invitations"] as const,
    detail: (id: string) => ["invitations", "detail", id] as const,
  },

  // Study Selection Phase
  studySelection: {
    process: (processId: string) => ["study-selection", "process", processId] as const,
    papers: (processId: string, params?: Record<string, unknown>) =>
      ["study-selection", processId, "papers", params ?? {}] as const,
    titleAbstractAssignmentPapers: (processId: string, params?: unknown) =>
      ["title-abstract-assignment-papers", processId, params ?? {}] as const,
    fullTextAssignmentPapers: (processId: string, params?: unknown) =>
      ["full-text-assignment-papers", processId, params ?? {}] as const,
    statistics: (processId: string, phase?: string) =>
      ["study-selection", processId, "statistics", phase ?? "all"] as const,
    conflicts: (processId: string) => ["study-selection", processId, "conflicts"] as const,
    decisionsByPaper: (processId: string, paperId: string) =>
      ["study-selection", processId, "papers", paperId, "decisions"] as const,
    paperDetails: (processId: string, paperId: string, phase?: number) =>
      ["study-selection", processId, "papers", paperId, "detail", phase ?? 0] as const,
    aiAnalysis: (processId: string, paperId: string, phase: number) =>
      ["study-selection", processId, "papers", paperId, "ai-analysis", phase] as const,
    exclusionCodes: (processId: string, params?: object) =>
      ["study-selection", processId, "exclusion-codes", params ?? {}] as const,
    checklistTemplate: (projectId: string) =>
      ["study-selection", projectId, "checklist-template"] as const,
    templateDetail: (projectId: string, templateId: string) =>
      ["study-selection", projectId, "checklist-template", templateId] as const,
    reviewerAssignmentTable: (processId: string, reviewerId: string) =>
      ["study-selection", processId, "reviewers", reviewerId, "assignment-table"] as const,
    conflictStatus: (processId: string, phase: number) =>
      ["study-selection", processId, "conflict-status", phase] as const,
    finalResolutionProgress: (processId: string, params?: object) =>
      ["study-selection", processId, "final-resolution-progress", params ?? {}] as const,
  },

  // Snowballing Candidates
  candidates: {
    all: ["candidates"] as const,
    byReviewProcess: (processId: string, filters?: object) =>
      ["candidates", processId, filters] as const,
  },

  // PRISMA Reports
  prismaReports: {
    all: ["prisma-reports"] as const,
    byReviewProcess: (reviewProcessId: string) =>
      ["prisma-reports", "review-process", reviewProcessId] as const,
    latest: (reviewProcessId: string) =>
      ["prisma-reports", "review-process", reviewProcessId, "latest"] as const,
    detail: (reportId: string) => ["prisma-reports", "detail", reportId] as const,
  },

  // Quality Assessment Phase
  qualityAssessment: {
    process: (qaProcessId: string) => ["quality-assessment", "process", qaProcessId] as const,
    papers: (qaProcessId: string) => ["quality-assessment", qaProcessId, "papers"] as const,
    myAssignedPapers: (qaProcessId: string) =>
      ["quality-assessment", qaProcessId, "assigned-papers", "my"] as const,
    strategies: (qaProcessId: string) => ["quality-assessment", qaProcessId, "strategies"] as const,
    criteriaTemplates: () => ["quality-assessment", "criteria-templates"] as const,
  },

  // Master Search Sources
  masterSources: {
    all: ["master-sources"] as const,
    list: (params?: object) => ["master-sources", "list", params] as const,
    detail: (id: string) => ["master-sources", "detail", id] as const,
  },

  // Exclusion Reason Library
  exclusionReasonLibrary: {
    all: ["exclusion-reason-library"] as const,
    list: (params?: object) => ["exclusion-reason-library", "list", { ...params }] as const,
    detail: (id: string) => ["exclusion-reason-library", "detail", id] as const,
  },

  // Audit Logs
  auditLogs: {
    admin: (params?: object) => ["audit-logs", "admin", params] as const,
    projectLeader: (projectId: string, params?: object) =>
      ["audit-logs", "project-leader", projectId, params] as const,
  },

  // Search Sources (Project-specific)
  searchSources: {
    byProject: (projectId: string) => ["search-sources", projectId] as const,
  },
} as const;

// Backward compatibility mappings - to be removed after full refactor
/** @deprecated Use nested QUERY_KEYS structure */
export const DEPRECATED_QUERY_KEYS = {
  staticData: QUERY_KEYS.static.all,
  projects: QUERY_KEYS.projects.list,
  myProjects: QUERY_KEYS.projects.myList,
  projectDetail: QUERY_KEYS.projects.detail,
  reviewProcesses: QUERY_KEYS.reviewProcesses.byProject,
  reviewProcess: QUERY_KEYS.reviewProcesses.detail,
  workspace: QUERY_KEYS.workspace.detail,
  importBatchesByProcess: QUERY_KEYS.identification.importBatches,
  importBatchesBySearch: QUERY_KEYS.searchExecutions.importBatches,
  importBatch: QUERY_KEYS.importBatches.detail,
  importBatchPapers: QUERY_KEYS.importBatches.papers,
  importBatches: QUERY_KEYS.importBatches.all,
  searchExecutionsByProcess: QUERY_KEYS.identification.searchExecutions,
  searchExecution: QUERY_KEYS.searchExecutions.detail,
  prismaStatistics: QUERY_KEYS.identification.statistics,
  uniquePapers: QUERY_KEYS.identification.uniquePapers,
  searchExecutions: QUERY_KEYS.searchExecutions.all,
  papers: QUERY_KEYS.papers.all,
  reviewNeeds: QUERY_KEYS.projects.needs,
  documents: QUERY_KEYS.projects.documents,
  objectives: QUERY_KEYS.projects.objectives,
  researchQuestions: QUERY_KEYS.projects.researchQuestions,
  timetable: QUERY_KEYS.projects.timetable,
  picocElements: QUERY_KEYS.researchQuestions.picoc,
  questionTypes: QUERY_KEYS.static.questionTypes,
  reports: QUERY_KEYS.user.reports,
  notifications: QUERY_KEYS.user.notifications,
};
