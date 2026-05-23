import type { InstanceAiGatewaySettings } from "@paperclipai/shared";
import type { AdapterModel } from "./types.js";
import { models as codexFallbackModels } from "@paperclipai/adapter-codex-local";
import { readConfigFile } from "../config-file.js";
import { buildOpenAiModelsEndpoint, normalizeAiGatewayBaseUrl } from "../services/ai-gateway.js";

const OPENAI_MODELS_TIMEOUT_MS = 5000;
const OPENAI_MODELS_CACHE_TTL_MS = 60_000;

let cached: { keyFingerprint: string; expiresAt: number; models: AdapterModel[] } | null = null;

function fingerprint(apiKey: string, baseUrl: string): string {
  return `${apiKey.length}:${apiKey.slice(-6)}@${baseUrl}`;
}

function dedupeModels(models: AdapterModel[]): AdapterModel[] {
  const seen = new Set<string>();
  const deduped: AdapterModel[] = [];
  for (const model of models) {
    const id = model.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push({ id, label: model.label.trim() || id });
  }
  return deduped;
}

function mergedWithFallback(models: AdapterModel[]): AdapterModel[] {
  return dedupeModels([
    ...models,
    ...codexFallbackModels,
  ]).sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true, sensitivity: "base" }));
}

function resolveOpenAiDiscoveryConfig(aiGateway?: InstanceAiGatewaySettings | null): {
  apiKey: string | null;
  baseUrl: string;
} {
  const gatewayApiKey = aiGateway?.enabled === true ? aiGateway.apiKey?.trim() : "";
  const gatewayBaseUrl = aiGateway?.enabled === true ? normalizeAiGatewayBaseUrl(aiGateway.baseUrl) : "";

  const envKey = process.env.OPENAI_API_KEY?.trim();
  const envBaseUrl = normalizeAiGatewayBaseUrl(process.env.OPENAI_BASE_URL);
  if (gatewayApiKey || envKey) {
    return {
      apiKey: gatewayApiKey || envKey || null,
      baseUrl: gatewayBaseUrl || envBaseUrl || "https://api.openai.com/v1",
    };
  }

  const config = readConfigFile();
  if (config?.llm?.provider !== "openai") {
    return {
      apiKey: null,
      baseUrl: "https://api.openai.com/v1",
    };
  }
  const configKey = config.llm.apiKey?.trim();
  return {
    apiKey: configKey && configKey.length > 0 ? configKey : null,
    baseUrl: gatewayBaseUrl || "https://api.openai.com/v1",
  };
}

async function fetchOpenAiModels(apiKey: string, baseUrl: string): Promise<AdapterModel[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_MODELS_TIMEOUT_MS);
  try {
    const response = await fetch(buildOpenAiModelsEndpoint(baseUrl), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });
    if (!response.ok) return [];

    const payload = (await response.json()) as { data?: unknown };
    const data = Array.isArray(payload.data) ? payload.data : [];
    const models: AdapterModel[] = [];
    for (const item of data) {
      if (typeof item !== "object" || item === null) continue;
      const id = (item as { id?: unknown }).id;
      if (typeof id !== "string" || id.trim().length === 0) continue;
      models.push({ id, label: id });
    }
    return dedupeModels(models);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function loadCodexModels(options?: {
  forceRefresh?: boolean;
  aiGateway?: InstanceAiGatewaySettings | null;
}): Promise<AdapterModel[]> {
  const forceRefresh = options?.forceRefresh === true;
  const { apiKey, baseUrl } = resolveOpenAiDiscoveryConfig(options?.aiGateway);
  const fallback = dedupeModels(codexFallbackModels);
  if (!apiKey) return fallback;

  const now = Date.now();
  const keyFingerprint = fingerprint(apiKey, baseUrl);
  if (!forceRefresh && cached && cached.keyFingerprint === keyFingerprint && cached.expiresAt > now) {
    return cached.models;
  }

  const fetched = await fetchOpenAiModels(apiKey, baseUrl);
  if (fetched.length > 0) {
    const merged = mergedWithFallback(fetched);
    cached = {
      keyFingerprint,
      expiresAt: now + OPENAI_MODELS_CACHE_TTL_MS,
      models: merged,
    };
    return merged;
  }

  if (cached && cached.keyFingerprint === keyFingerprint && cached.models.length > 0) {
    return cached.models;
  }

  return fallback;
}

export async function listCodexModels(options?: {
  aiGateway?: InstanceAiGatewaySettings | null;
}): Promise<AdapterModel[]> {
  return loadCodexModels(options);
}

export async function refreshCodexModels(options?: {
  aiGateway?: InstanceAiGatewaySettings | null;
}): Promise<AdapterModel[]> {
  return loadCodexModels({ forceRefresh: true, aiGateway: options?.aiGateway });
}

export function resetCodexModelsCacheForTests() {
  cached = null;
}
