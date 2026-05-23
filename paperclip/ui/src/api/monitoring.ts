import { api } from "./client";

export type UptimeKumaMonitoringStatus = "live" | "frame_blocked" | "repo" | "missing";

export interface UptimeKumaDashboardSnapshot {
  status: UptimeKumaMonitoringStatus;
  baseUrl: string | null;
  embedUrl: string | null;
  repoPath: string | null;
  dependenciesInstalled: boolean;
  pageTitle: string | null;
  checkedAt: string;
  installCommand: string;
  devCommand: string;
  startCommand: string;
  buildCommand: string;
  message: string | null;
}

export const monitoringApi = {
  uptimeKuma: (companyId: string) =>
    api.get<UptimeKumaDashboardSnapshot>(
      `/companies/${encodeURIComponent(companyId)}/monitoring/uptime-kuma`,
    ),
};
