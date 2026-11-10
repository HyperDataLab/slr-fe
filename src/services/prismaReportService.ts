// PRISMA Report Service — API calls for PRISMA report endpoints

import api from "../config/axios";
import type { ApiResponse } from "../types/project";
import type {
  GeneratePrismaReportRequest,
  PrismaReportResponse,
  PrismaReportListResponse,
} from "../types/prismaReport";

class PrismaReportService {
  private static instance: PrismaReportService;

  private constructor() {}

  static getInstance(): PrismaReportService {
    if (!PrismaReportService.instance) {
      PrismaReportService.instance = new PrismaReportService();
    }
    return PrismaReportService.instance;
  }

  /** Generate a new PRISMA report snapshot for a project */
  async generateReport(
    projectId: string,
    request: GeneratePrismaReportRequest = {},
  ): Promise<ApiResponse<PrismaReportResponse>> {
    const response = await api.post<ApiResponse<PrismaReportResponse>>(
      `/projects/${projectId}/prisma/reports`,
      request,
    );
    return response.data;
  }

  /** Get a specific PRISMA report by its ID */
  async getReportById(reportId: string, projectId?: string): Promise<ApiResponse<PrismaReportResponse>> {
    const targetUrl = projectId
      ? `/projects/${projectId}/prisma/reports/${reportId}`
      : `/projects/current/prisma/reports/${reportId}`;
    const response = await api.get<ApiResponse<PrismaReportResponse>>(targetUrl);
    return response.data;
  }

  /** Get all PRISMA reports for a project */
  async getReportsByReviewProcess(
    projectId: string,
  ): Promise<ApiResponse<PrismaReportListResponse[]>> {
    const response = await api.get<ApiResponse<PrismaReportListResponse[]>>(
      `/projects/${projectId}/prisma/reports`,
    );
    return response.data;
  }

  /** Get the latest PRISMA report for a project */
  async getLatestReport(projectId: string): Promise<ApiResponse<PrismaReportResponse>> {
    const response = await api.get<ApiResponse<PrismaReportResponse>>(
      `/projects/${projectId}/prisma/reports/latest`,
    );
    return response.data;
  }

  /** Download the latest PRISMA flow diagram for a review process as .docx */
  async downloadPrismaFlowDiagram(reviewProcessId: string): Promise<Blob> {
    const response = await api.get(`/projects/${reviewProcessId}/prisma/reports/latest/docx`, {
      responseType: "blob",
    });
    return response.data;
  }

  /** Download the live, structured handoff for the writing step. */
  async downloadWritingExport(projectId: string): Promise<Blob> {
    const response = await api.get(`/projects/${projectId}/prisma/writing-export.json`, {
      responseType: "blob",
    });
    return response.data;
  }

  /** Download a complete project archive in the native .slr package format. */
  async downloadProjectPackage(projectId: string): Promise<Blob> {
    const response = await api.get(`/projects/${projectId}/export/slr`, {
      responseType: "blob",
      timeout: 0,
    });
    return response.data;
  }

  async classifySearchSource(
    projectId: string,
    sourceId: string,
    group: "DATABASES_AND_REGISTERS" | "OTHER_METHODS" | null,
  ): Promise<void> {
    await api.patch(`/projects/${projectId}/prisma/sources/${sourceId}/classification`, { group });
  }
}

const prismaReportService = PrismaReportService.getInstance();
export default prismaReportService;
