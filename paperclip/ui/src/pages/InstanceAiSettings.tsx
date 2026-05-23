import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Eye, EyeOff, KeyRound, Link2, Save, Sparkles } from "lucide-react";
import {
  DEFAULT_INSTANCE_AI_GATEWAY,
  type InstanceAiGatewaySettings,
} from "@paperclipai/shared";
import { instanceSettingsApi } from "@/api/instanceSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useLanguage } from "@/context/LanguageContext";
import { queryKeys } from "@/lib/queryKeys";

function normalizeFormState(value: InstanceAiGatewaySettings | null | undefined): InstanceAiGatewaySettings {
  return {
    ...DEFAULT_INSTANCE_AI_GATEWAY,
    ...(value ?? {}),
    baseUrl: value?.baseUrl ?? "",
    apiKey: value?.apiKey ?? "",
    defaultModel: value?.defaultModel ?? "",
  };
}

function buildPatch(value: InstanceAiGatewaySettings): InstanceAiGatewaySettings {
  return {
    enabled: value.enabled === true,
    provider: "openai_compatible",
    baseUrl: value.baseUrl.trim(),
    apiKey: value.apiKey.trim(),
    defaultModel: value.defaultModel.trim(),
  };
}

export function InstanceAiSettings() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [form, setForm] = useState<InstanceAiGatewaySettings>(DEFAULT_INSTANCE_AI_GATEWAY);

  useEffect(() => {
    setBreadcrumbs([
      { label: t("Instance Settings") },
      { label: t("AI") },
    ]);
  }, [setBreadcrumbs, t]);

  const aiQuery = useQuery({
    queryKey: queryKeys.instance.aiSettings,
    queryFn: () => instanceSettingsApi.getAi(),
  });

  useEffect(() => {
    if (aiQuery.data) {
      setForm(normalizeFormState(aiQuery.data));
    }
  }, [aiQuery.data]);

  const saveMutation = useMutation({
    mutationFn: instanceSettingsApi.updateAi,
    onSuccess: async (next) => {
      setActionError(null);
      setForm(normalizeFormState(next));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.instance.aiSettings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.instance.generalSettings }),
      ]);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : t("Failed to update AI settings."));
    },
  });

  const persisted = useMemo(
    () => buildPatch(normalizeFormState(aiQuery.data)),
    [aiQuery.data],
  );
  const draft = useMemo(() => buildPatch(form), [form]);
  const hasChanges = JSON.stringify(persisted) !== JSON.stringify(draft);

  if (aiQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">{t("Loading AI settings...")}</div>;
  }

  if (aiQuery.error) {
    return (
      <div className="text-sm text-destructive">
        {aiQuery.error instanceof Error ? aiQuery.error.message : t("Failed to load AI settings.")}
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t("AI")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("Configure one unified AI gateway for Finance Anything internal OpenAI-compatible calls and Finance Anything-launched OpenCode, Codex, and Cursor runtimes.")}
        </p>
      </div>

      {actionError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{t("Enable unified AI gateway")}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("When enabled, Paperclip will inject this gateway into supported OpenAI-compatible runtimes by default.")}
            </p>
          </div>
          <ToggleSwitch
            checked={form.enabled}
            onCheckedChange={(checked) => setForm((current) => ({ ...current, enabled: checked }))}
            disabled={saveMutation.isPending}
            aria-label={t("Toggle unified AI gateway")}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="instance-ai-provider">{t("Provider")}</Label>
              <Input id="instance-ai-provider" value={t("OpenAI-compatible")} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instance-ai-model">{t("Default model")}</Label>
              <div className="relative">
                <Sparkles className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="instance-ai-model"
                  value={form.defaultModel}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, defaultModel: event.target.value }))
                  }
                  placeholder="gpt-5"
                  className="pl-9"
                  disabled={saveMutation.isPending}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instance-ai-base-url">{t("Base URL")}</Label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="instance-ai-base-url"
                value={form.baseUrl}
                onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))}
                placeholder="https://api.openai.com/v1"
                className="pl-9"
                disabled={saveMutation.isPending}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("Use the OpenAI-compatible API root. For example: OpenAI, OpenRouter, or your own gateway / proxy endpoint.")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instance-ai-api-key">{t("API key")}</Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="instance-ai-api-key"
                type={showApiKey ? "text" : "password"}
                value={form.apiKey}
                onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
                placeholder="sk-..."
                className="pl-9 pr-11"
                autoComplete="off"
                disabled={saveMutation.isPending}
              />
              <button
                type="button"
                onClick={() => setShowApiKey((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showApiKey ? t("Hide API key") : t("Show API key")}
                title={showApiKey ? t("Hide API key") : t("Show API key")}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            {t("This gateway is applied to Finance Anything internal OpenAI-compatible model discovery and to Finance Anything-launched Codex / Cursor / OpenCode runtimes.")}
          </p>
          <p>
            {t("If a specific agent already sets its own model or OpenAI environment variables, that explicit agent-level configuration still wins.")}
          </p>
          <p>
            {t("The API key is only exposed on this dedicated settings page. The general settings API and activity log keep it redacted.")}
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => saveMutation.mutate(draft)}
          disabled={saveMutation.isPending || !hasChanges}
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? t("Saving AI settings...") : t("Save AI settings")}
        </Button>
        {hasChanges ? (
          <Button
            variant="outline"
            onClick={() => setForm(normalizeFormState(aiQuery.data))}
            disabled={saveMutation.isPending}
          >
            {t("Reset")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
