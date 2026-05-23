import type {
  InstanceAiGatewaySettings,
  InstanceGeneralSettings,
} from "@paperclipai/shared";

const OPENAI_COMPATIBLE_GATEWAY_ADAPTER_TYPES = new Set([
  "codex_local",
  "cursor",
  "opencode_local",
]);

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const env: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string") env[key] = entry;
  }
  return env;
}

export function normalizeAiGatewayBaseUrl(value: unknown): string {
  const raw = asNonEmptyString(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.search = "";
    url.hash = "";
    let pathname = url.pathname.replace(/\/+$/, "");
    if (pathname.endsWith("/models")) pathname = pathname.slice(0, -"/models".length);
    if (pathname.endsWith("/chat/completions")) {
      pathname = pathname.slice(0, -"/chat/completions".length);
    }
    if (pathname.endsWith("/responses")) pathname = pathname.slice(0, -"/responses".length);
    url.pathname = pathname === "" || pathname === "/" ? "/v1" : pathname;
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

export function buildAiGatewayOpenAiEnv(
  aiGateway: InstanceAiGatewaySettings | null | undefined,
): Record<string, string> {
  if (!aiGateway || aiGateway.enabled !== true) return {};
  const env: Record<string, string> = {};
  const apiKey = asNonEmptyString(aiGateway.apiKey);
  const baseUrl = normalizeAiGatewayBaseUrl(aiGateway.baseUrl);
  if (apiKey) env.OPENAI_API_KEY = apiKey;
  if (baseUrl) env.OPENAI_BASE_URL = baseUrl;
  return env;
}

export function adapterSupportsAiGateway(adapterType: string | null | undefined): boolean {
  return Boolean(adapterType && OPENAI_COMPATIBLE_GATEWAY_ADAPTER_TYPES.has(adapterType));
}

export function mergeAiGatewayIntoAdapterConfig(input: {
  adapterType: string | null | undefined;
  adapterConfig: Record<string, unknown>;
  aiGateway: InstanceAiGatewaySettings | null | undefined;
}): {
  adapterConfig: Record<string, unknown>;
  injectedSecretKeys: string[];
} {
  if (!adapterSupportsAiGateway(input.adapterType)) {
    return {
      adapterConfig: input.adapterConfig,
      injectedSecretKeys: [],
    };
  }

  const gatewayEnv = buildAiGatewayOpenAiEnv(input.aiGateway);
  const currentEnv = asStringRecord(input.adapterConfig.env);
  const gatewayDefaultModel =
    input.aiGateway?.enabled === true ? asNonEmptyString(input.aiGateway.defaultModel) : null;
  if (Object.keys(gatewayEnv).length === 0 && !gatewayDefaultModel) {
    return {
      adapterConfig: input.adapterConfig,
      injectedSecretKeys: [],
    };
  }
  const nextEnv = { ...currentEnv };
  const injectedSecretKeys: string[] = [];

  if (gatewayEnv.OPENAI_API_KEY && !Object.prototype.hasOwnProperty.call(currentEnv, "OPENAI_API_KEY")) {
    nextEnv.OPENAI_API_KEY = gatewayEnv.OPENAI_API_KEY;
    injectedSecretKeys.push("OPENAI_API_KEY");
  }
  if (gatewayEnv.OPENAI_BASE_URL && !Object.prototype.hasOwnProperty.call(currentEnv, "OPENAI_BASE_URL")) {
    nextEnv.OPENAI_BASE_URL = gatewayEnv.OPENAI_BASE_URL;
  }

  const nextConfig: Record<string, unknown> = {
    ...input.adapterConfig,
    ...(Object.keys(nextEnv).length > 0 ? { env: nextEnv } : {}),
  };

  if (!asNonEmptyString(nextConfig.model) && gatewayDefaultModel) {
    nextConfig.model = gatewayDefaultModel;
  }

  return {
    adapterConfig: nextConfig,
    injectedSecretKeys,
  };
}

export function redactAiGatewayForLogs(
  aiGateway: InstanceAiGatewaySettings | null | undefined,
): InstanceAiGatewaySettings {
  return {
    enabled: aiGateway?.enabled === true,
    provider: aiGateway?.provider ?? "openai_compatible",
    baseUrl: aiGateway?.baseUrl ?? "",
    apiKey: asNonEmptyString(aiGateway?.apiKey) ? "***REDACTED***" : "",
    defaultModel: aiGateway?.defaultModel ?? "",
  };
}

export function redactInstanceGeneralSettingsForLogs(
  general: InstanceGeneralSettings,
): InstanceGeneralSettings {
  return {
    ...general,
    aiGateway: redactAiGatewayForLogs(general.aiGateway),
  };
}

export function redactInstanceGeneralSettingsForRead(
  general: InstanceGeneralSettings,
): InstanceGeneralSettings {
  return {
    ...general,
    aiGateway: {
      ...general.aiGateway,
      apiKey: "",
    },
  };
}

export function buildOpenAiModelsEndpoint(baseUrl: string | null | undefined): string {
  const normalizedBaseUrl = normalizeAiGatewayBaseUrl(baseUrl);
  if (!normalizedBaseUrl) return "https://api.openai.com/v1/models";
  return new URL("models", `${normalizedBaseUrl.replace(/\/$/, "")}/`).toString();
}
