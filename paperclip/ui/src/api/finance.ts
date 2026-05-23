import type { Company } from "@paperclipai/shared";
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

export const financeApi = {
  status: () => api.get<FinanceStatus>("/finance/status"),
  bootstrap: () => api.post<FinanceBootstrap>("/finance/bootstrap", {}),
};
