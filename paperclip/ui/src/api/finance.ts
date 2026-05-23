import type { Company, Issue } from "@paperclipai/shared";
import { api } from "./client";

export type FinanceStatus = {
  enabled: boolean;
  productName: string;
};

export type FinanceBootstrap = {
  enabled: true;
  productName: string;
  company: Company;
  goalId: string;
  projectId: string;
  defaultAgentId: string | null;
  agentCount: number;
};

export type FinanceDecisionResult = FinanceBootstrap & {
  issue: Issue;
  issuePath: string;
};

export type FinanceReportSource = {
  id: string;
  kind: "document" | "work_product" | "attachment";
  key: string | null;
  title: string;
  format: string | null;
  revisionNumber: number | null;
  url: string | null;
  summary: string | null;
  contentType: string | null;
  filename: string | null;
  isPrimary: boolean;
  status?: string;
  body?: string;
  createdAt: string;
  updatedAt: string;
};

export type FinanceReportEntry = {
  issueId: string;
  issueIdentifier: string | null;
  issueTitle: string;
  issueStatus: string;
  issuePath: string;
  reportStatus: "ready" | "pending";
  sourceCount: number;
  primarySource: FinanceReportSource | null;
  sources: FinanceReportSource[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type FinanceReportsResult = {
  company: Company;
  projectId: string;
  reports: FinanceReportEntry[];
  updatedAt: string;
};

export type FinanceReportDetailResult = {
  report: FinanceReportEntry;
};

export const financeApi = {
  status: () => api.get<FinanceStatus>("/finance/status"),
  bootstrap: () => api.post<FinanceBootstrap>("/finance/bootstrap", {}),
  startDecision: (data: { goal: string; context?: string }) =>
    api.post<FinanceDecisionResult>("/finance/decisions", data),
  reports: (limit = 60) => api.get<FinanceReportsResult>(`/finance/reports?limit=${limit}`),
  report: (issueId: string) => api.get<FinanceReportDetailResult>(`/finance/reports/${encodeURIComponent(issueId)}`),
};
