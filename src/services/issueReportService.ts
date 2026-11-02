import api from "../config/axios";
export type IssueReportStatus = "OPEN" | "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED";
export type IssueReportCategory = "BUG" | "ACCESS" | "DATA" | "OTHER";
export interface IssueReport { id: string; reporterUid: string; reporterName: string; reporterEmail: string; title: string; category: IssueReportCategory; description: string; pageUrl: string; status: IssueReportStatus; adminNote: string; createdAt: string; updatedAt: string }
interface ApiResponse<T> { isSuccess: boolean; data: T; message?: string }
const unwrap = <T,>(response: ApiResponse<T>): T => { if (!response.isSuccess) throw new Error(response.message || "Request failed"); return response.data; };
export const issueReportService = {
  async create(input: Pick<IssueReport, "title" | "category" | "description"> & { pageUrl: string }) { const response = await api.post<ApiResponse<IssueReport>>("/issue-reports", input); return unwrap(response.data); },
  async getMine() { const response = await api.get<ApiResponse<{ items: IssueReport[] }>>("/issue-reports/mine"); return unwrap(response.data).items; },
  async getAll() { const response = await api.get<ApiResponse<{ items: IssueReport[] }>>("/admin/issue-reports"); return unwrap(response.data).items; },
  async update(id: string, input: Pick<IssueReport, "status" | "adminNote">) { const response = await api.patch<ApiResponse<IssueReport>>("/admin/issue-reports/" + encodeURIComponent(id), input); return unwrap(response.data); },
};
