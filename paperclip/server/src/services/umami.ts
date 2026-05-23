import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const reposRoot = path.resolve(moduleDir, "../../../../");

const DEFAULT_UMAMI_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_UMAMI_USERNAME = "admin";
const DEFAULT_UMAMI_PASSWORD = "umami";
const DEFAULT_DASHBOARD_WINDOW_DAYS = 7;

export type UmamiIntegrationStatus =
  | "live"
  | "repo"
  | "missing"
  | "auth_error"
  | "site_missing";

export interface UmamiWebsiteRecord {
  id: string;
  name: string;
  domain: string;
  shareId?: string | null;
}

interface UmamiWebsiteListResponse {
  data: UmamiWebsiteRecord[];
  count: number;
  page: number;
  pageSize: number;
}

export interface UmamiStatsResponse {
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  totaltime: number;
  comparison: {
    pageviews: number;
    visitors: number;
    visits: number;
    bounces: number;
    totaltime: number;
  };
}

export interface UmamiPageviewsResponse {
  pageviews: Array<{ x: string; y: number }>;
  sessions: Array<{ x: string; y: number }>;
  compare?: {
    pageviews: Array<{ x: string; y: number }>;
    sessions: Array<{ x: string; y: number }>;
  };
}

export interface UmamiDashboardSnapshot {
  status: UmamiIntegrationStatus;
  baseUrl: string | null;
  repoPath: string | null;
  website: UmamiWebsiteRecord | null;
  stats: UmamiStatsResponse | null;
  pageviews: UmamiPageviewsResponse | null;
  checkedAt: string;
  message: string | null;
}

function normalizeText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readUmamiRepoPath() {
  const direct = path.join(reposRoot, "umami");
  return existsSync(direct) ? direct : null;
}

function readUmamiBaseUrl() {
  return normalizeText(process.env.UMAMI_BASE_URL) ?? DEFAULT_UMAMI_BASE_URL;
}

function readUmamiCredentials() {
  return {
    username: normalizeText(process.env.UMAMI_USERNAME) ?? DEFAULT_UMAMI_USERNAME,
    password: normalizeText(process.env.UMAMI_PASSWORD) ?? DEFAULT_UMAMI_PASSWORD,
  };
}

function buildDefaultWindow(days = DEFAULT_DASHBOARD_WINDOW_DAYS) {
  const endAt = Date.now();
  const startAt = endAt - days * 24 * 60 * 60 * 1000;
  return { startAt, endAt };
}

async function safeJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

async function probeHeartbeat(baseUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(`${baseUrl}/api/heartbeat`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function readDomainFromSiteUrl(siteUrl: string | null) {
  if (!siteUrl) return null;
  try {
    const parsed = new URL(siteUrl);
    return normalizeText(parsed.host);
  } catch {
    return null;
  }
}

function sameWebsiteDomain(left: string | null, right: string | null) {
  return normalizeText(left)?.toLowerCase() === normalizeText(right)?.toLowerCase();
}

class UmamiClient {
  readonly baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl = readUmamiBaseUrl()) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async request<T>(input: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${input}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Umami API ${response.status}: ${text || response.statusText}`);
    }

    return safeJson<T>(response);
  }

  async login() {
    if (this.token) return this.token;
    const { username, password } = readUmamiCredentials();
    const payload = await this.request<{ token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    this.token = payload.token;
    return this.token;
  }

  async listWebsites() {
    await this.login();
    const payload = await this.request<UmamiWebsiteListResponse>("/api/websites");
    return payload.data ?? [];
  }

  async createWebsite(input: { name: string; domain: string }) {
    await this.login();
    return this.request<UmamiWebsiteRecord>("/api/websites", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async getWebsiteStats(websiteId: string, window = buildDefaultWindow()) {
    await this.login();
    const query = new URLSearchParams({
      startAt: String(window.startAt),
      endAt: String(window.endAt),
      compare: "prev",
    });
    return this.request<UmamiStatsResponse>(`/api/websites/${encodeURIComponent(websiteId)}/stats?${query}`);
  }

  async getWebsitePageviews(websiteId: string, window = buildDefaultWindow()) {
    await this.login();
    const query = new URLSearchParams({
      startAt: String(window.startAt),
      endAt: String(window.endAt),
      unit: "day",
      compare: "prev",
    });
    return this.request<UmamiPageviewsResponse>(`/api/websites/${encodeURIComponent(websiteId)}/pageviews?${query}`);
  }
}

export function umamiService() {
  return {
    readRepoPath: readUmamiRepoPath,
    readBaseUrl: readUmamiBaseUrl,
    async getDashboard(input: {
      productName: string;
      siteUrl: string | null;
      createWebsiteIfMissing?: boolean;
    }): Promise<UmamiDashboardSnapshot> {
      const checkedAt = new Date().toISOString();
      const repoPath = readUmamiRepoPath();
      const baseUrl = readUmamiBaseUrl();
      const siteDomain = readDomainFromSiteUrl(input.siteUrl);
      const heartbeatOk = await probeHeartbeat(baseUrl);

      if (!repoPath && !heartbeatOk) {
        return {
          status: "missing",
          baseUrl: null,
          repoPath: null,
          website: null,
          stats: null,
          pageviews: null,
          checkedAt,
          message: "Umami repo and service are both missing.",
        };
      }

      if (!heartbeatOk) {
        return {
          status: repoPath ? "repo" : "missing",
          baseUrl: null,
          repoPath,
          website: null,
          stats: null,
          pageviews: null,
          checkedAt,
          message: repoPath ? "Umami repo is present but the local service is not running." : "Umami service is unavailable.",
        };
      }

      const client = new UmamiClient(baseUrl);

      try {
        const websites = await client.listWebsites();
        let website =
          websites.find((item) => sameWebsiteDomain(item.domain, siteDomain))
          ?? websites.find((item) => normalizeText(item.name) === normalizeText(input.productName))
          ?? null;

        if (!website && siteDomain && input.createWebsiteIfMissing !== false) {
          website = await client.createWebsite({
            name: input.productName,
            domain: siteDomain,
          });
        }

        if (!website) {
          return {
            status: "site_missing",
            baseUrl,
            repoPath,
            website: null,
            stats: null,
            pageviews: null,
            checkedAt,
            message: "Umami is running, but no matching website exists yet.",
          };
        }

        const [stats, pageviews] = await Promise.all([
          client.getWebsiteStats(website.id),
          client.getWebsitePageviews(website.id),
        ]);

        return {
          status: "live",
          baseUrl,
          repoPath,
          website,
          stats,
          pageviews,
          checkedAt,
          message: null,
        };
      } catch (error) {
        return {
          status: "auth_error",
          baseUrl,
          repoPath,
          website: null,
          stats: null,
          pageviews: null,
          checkedAt,
          message: error instanceof Error ? error.message : "Failed to access Umami.",
        };
      }
    },
  };
}
