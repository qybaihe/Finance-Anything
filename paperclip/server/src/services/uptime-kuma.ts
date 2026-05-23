import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const reposRoot = path.resolve(moduleDir, "../../../../");

const DEFAULT_UPTIME_KUMA_BASE_URL = "http://127.0.0.1:3001";
const UPTIME_KUMA_REPO_PATH = path.join(reposRoot, "uptime-kuma");

export type UptimeKumaIntegrationStatus =
  | "live"
  | "frame_blocked"
  | "repo"
  | "missing";

export interface UptimeKumaDashboardSnapshot {
  status: UptimeKumaIntegrationStatus;
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

function normalizeText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readRepoPath() {
  return existsSync(UPTIME_KUMA_REPO_PATH) ? UPTIME_KUMA_REPO_PATH : null;
}

function readDependenciesInstalled(repoPath: string | null) {
  return Boolean(repoPath && existsSync(path.join(repoPath, "node_modules")));
}

function readBaseUrl() {
  return normalizeText(process.env.UPTIME_KUMA_BASE_URL) ?? DEFAULT_UPTIME_KUMA_BASE_URL;
}

async function probeBaseUrl(baseUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(baseUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      },
    });

    const html = await response.text().catch(() => "");
    const title = normalizeText(html.match(/<title>(.*?)<\/title>/is)?.[1]?.replace(/\s+/g, " ") ?? null);
    const xFrameOptions = normalizeText(response.headers.get("x-frame-options"));

    return {
      ok: response.ok,
      title,
      xFrameOptions,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function uptimeKumaService() {
  return {
    readRepoPath,
    readBaseUrl,
    async getDashboard(): Promise<UptimeKumaDashboardSnapshot> {
      const checkedAt = new Date().toISOString();
      const repoPath = readRepoPath();
      const dependenciesInstalled = readDependenciesInstalled(repoPath);
      const baseUrl = readBaseUrl();

      const installCommand = "npm install";
      const devCommand = "npm run dev:paperclip";
      const startCommand = "npm run start:paperclip";
      const buildCommand = "npm run build";

      if (!repoPath) {
        return {
          status: "missing",
          baseUrl: null,
          embedUrl: null,
          repoPath: null,
          dependenciesInstalled: false,
          pageTitle: null,
          checkedAt,
          installCommand,
          devCommand,
          startCommand,
          buildCommand,
          message: "Uptime Kuma repo is missing.",
        };
      }

      const probe = await probeBaseUrl(baseUrl);
      if (!probe?.ok) {
        return {
          status: "repo",
          baseUrl: null,
          embedUrl: null,
          repoPath,
          dependenciesInstalled,
          pageTitle: null,
          checkedAt,
          installCommand,
          devCommand,
          startCommand,
          buildCommand,
          message: dependenciesInstalled
            ? "Uptime Kuma repo is present but the service is not running."
            : "Uptime Kuma repo is present but dependencies are not installed yet.",
        };
      }

      const frameBlocked = Boolean(
        probe.xFrameOptions && /^(sameorigin|deny)$/i.test(probe.xFrameOptions),
      );

      return {
        status: frameBlocked ? "frame_blocked" : "live",
        baseUrl,
        embedUrl: frameBlocked ? null : baseUrl,
        repoPath,
        dependenciesInstalled,
        pageTitle: probe.title,
        checkedAt,
        installCommand,
        devCommand,
        startCommand,
        buildCommand,
        message: frameBlocked
          ? "Uptime Kuma is running, but X-Frame-Options still blocks embedding."
          : "Uptime Kuma is running locally and can be embedded.",
      };
    },
  };
}
