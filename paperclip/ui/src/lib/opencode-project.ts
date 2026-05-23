import type { Project } from "@paperclipai/shared";

export const DEFAULT_OPENCODE_WEB_URL = "http://127.0.0.1:4096";

export interface OpenCodeProjectConfig {
  webUrl: string;
  launchCommand: string;
}

export interface ResolvedOpenCodeDirectory {
  path: string | null;
  source: "workspace" | "codebase" | "none";
}

export interface OpenCodeEmbedUrlOptions {
  theme?: "light" | "dark" | null;
  hideSidebar?: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function base64UrlEncodeUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function suggestOpenCodeLaunchCommand(webUrl?: string | null): string {
  const rawUrl = readNonEmptyString(webUrl) ?? DEFAULT_OPENCODE_WEB_URL;
  try {
    const url = new URL(rawUrl);
    const args: string[] = [];
    if (url.hostname && !["127.0.0.1", "localhost"].includes(url.hostname)) {
      args.push("--hostname 0.0.0.0");
    }
    if (url.port) {
      args.push(`--port ${url.port}`);
    }
    return `opencode web${args.length > 0 ? ` ${args.join(" ")}` : ""}`;
  } catch {
    return "opencode web --port 4096";
  }
}

export function readOpenCodeProjectConfig(metadata: Record<string, unknown> | null | undefined): OpenCodeProjectConfig {
  const integrations = asRecord(metadata?.integrations);
  const opencode = asRecord(integrations?.opencode);
  const webUrl = readNonEmptyString(opencode?.webUrl) ?? DEFAULT_OPENCODE_WEB_URL;
  const launchCommand = readNonEmptyString(opencode?.launchCommand) ?? suggestOpenCodeLaunchCommand(webUrl);
  return {
    webUrl,
    launchCommand,
  };
}

export function writeOpenCodeProjectConfigToMetadata(
  metadata: Record<string, unknown> | null | undefined,
  config: Partial<OpenCodeProjectConfig>,
): Record<string, unknown> {
  const nextMetadata = asRecord(metadata) ? { ...metadata } : {};
  const existingIntegrations = asRecord(nextMetadata.integrations);
  const integrations = existingIntegrations ? { ...existingIntegrations } : {};
  const webUrl = readNonEmptyString(config.webUrl) ?? DEFAULT_OPENCODE_WEB_URL;
  const launchCommand = readNonEmptyString(config.launchCommand) ?? suggestOpenCodeLaunchCommand(webUrl);
  integrations.opencode = {
    webUrl,
    launchCommand,
  };
  nextMetadata.integrations = integrations;
  return nextMetadata;
}

export function resolveOpenCodeProjectDirectory(
  project: Pick<Project, "primaryWorkspace" | "workspaces" | "codebase">,
): ResolvedOpenCodeDirectory {
  const primaryWorkspace = project.primaryWorkspace ?? project.workspaces[0] ?? null;
  const workspacePath = readNonEmptyString(primaryWorkspace?.cwd);
  if (workspacePath) {
    return { path: workspacePath, source: "workspace" };
  }
  const fallbackPath = readNonEmptyString(project.codebase.effectiveLocalFolder);
  if (fallbackPath) {
    return { path: fallbackPath, source: "codebase" };
  }
  return { path: null, source: "none" };
}

export function buildOpenCodeProjectUrl(baseUrl: string | null | undefined, directory?: string | null): string | null {
  const rawUrl = readNonEmptyString(baseUrl);
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    const normalizedBasePath = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
    if (directory) {
      url.pathname = `${normalizedBasePath}/${base64UrlEncodeUtf8(directory)}/session`.replace(/\/{2,}/g, "/");
    } else {
      url.pathname = normalizedBasePath || "/";
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function buildEmbeddedOpenCodeProjectUrl(
  baseUrl: string | null | undefined,
  directory?: string | null,
  options: OpenCodeEmbedUrlOptions = {},
): string | null {
  const rawUrl = buildOpenCodeProjectUrl(baseUrl, directory);
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    url.searchParams.set("paperclip_embed", "1");
    if (options.theme) {
      url.searchParams.set("paperclip_theme", options.theme);
    }
    if (options.hideSidebar !== false) {
      url.searchParams.set("paperclip_sidebar", "hidden");
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}
