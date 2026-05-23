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

export const financeApi = {
  status: () => api.get<FinanceStatus>("/finance/status"),
  bootstrap: () => api.post<FinanceBootstrap>("/finance/bootstrap", {}),
  startDecision: (data: { goal: string; context?: string }) =>
    api.post<FinanceDecisionResult>("/finance/decisions", data),
};
