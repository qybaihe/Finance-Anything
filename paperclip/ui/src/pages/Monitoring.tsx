import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ExternalLink,
  Maximize2,
  Minimize2,
  RefreshCw,
} from "lucide-react";
import { monitoringApi } from "@/api/monitoring";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useCompany } from "@/context/CompanyContext";
import { useLanguage } from "@/context/LanguageContext";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";

function statusBadgeClass(status: "live" | "frame_blocked" | "repo" | "missing") {
  switch (status) {
    case "live":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "frame_blocked":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
    case "repo":
      return "bg-sky-500/10 text-sky-700 dark:text-sky-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

const UPTIME_KUMA_EMBED_SCALE = 0.85;

export function Monitoring() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { t } = useLanguage();
  const [reloadSeed, setReloadSeed] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: t("Monitoring") }]);
  }, [setBreadcrumbs, t]);

  const monitoringQuery = useQuery({
    queryKey: selectedCompanyId
      ? queryKeys.monitoring.uptimeKuma(selectedCompanyId)
      : ["monitoring", "__empty__"],
    queryFn: () => monitoringApi.uptimeKuma(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === viewportRef.current);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  async function toggleFullscreen() {
    if (!viewportRef.current) return;

    if (document.fullscreenElement === viewportRef.current) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }

    await viewportRef.current.requestFullscreen().catch(() => undefined);
  }

  if (!selectedCompanyId) {
    return <EmptyState icon={Activity} message={t("Select a company to open monitoring.")} />;
  }

  if (monitoringQuery.isLoading) {
    return <PageSkeleton variant="detail" />;
  }

  if (monitoringQuery.error || !monitoringQuery.data) {
    return (
      <div className="text-sm text-destructive">
        {monitoringQuery.error instanceof Error
          ? monitoringQuery.error.message
          : t("Failed to load monitoring dashboard.")}
      </div>
    );
  }

  const snapshot = monitoringQuery.data;
  const isEmbeddable = snapshot.status === "live" && Boolean(snapshot.embedUrl);
  const iframeScalePercent = `${(100 / UPTIME_KUMA_EMBED_SCALE).toFixed(4)}%`;
  const embeddedFrameStyle = {
    width: iframeScalePercent,
    height: iframeScalePercent,
    transform: `scale(${UPTIME_KUMA_EMBED_SCALE})`,
    transformOrigin: "top left",
  } as const;

  function refreshViewport() {
    void monitoringQuery.refetch();
    if (snapshot.embedUrl) {
      setReloadSeed((value) => value + 1);
    }
  }

  return (
    <div
      ref={viewportRef}
      className={cn(
        "flex h-[calc(100dvh-10rem)] min-h-[26rem] flex-col overflow-hidden rounded-2xl border bg-card shadow-xs md:h-[calc(100dvh-6rem)]",
        isFullscreen && "h-screen rounded-none border-0 shadow-none",
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-card/95 px-3 py-2 backdrop-blur sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Badge className={cn("border-0", statusBadgeClass(snapshot.status))}>
            {snapshot.status === "live"
              ? t("Live")
              : snapshot.status === "frame_blocked"
                ? t("Needs frame override")
                : snapshot.status === "repo"
                  ? snapshot.dependenciesInstalled
                    ? t("Repo detected")
                    : t("Dependencies missing")
                  : t("Not connected")}
          </Badge>
          <span className="truncate text-sm font-medium text-foreground">
            {snapshot.pageTitle ?? t("Monitoring")}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {snapshot.baseUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={snapshot.baseUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">{t("Open Uptime Kuma")}</span>
              </a>
            </Button>
          ) : null}
          <Button
            size="icon-sm"
            variant="outline"
            onClick={refreshViewport}
            aria-label={t("Refresh monitoring")}
            title={t("Refresh monitoring")}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {snapshot.embedUrl ? (
            <Button
              size="icon-sm"
              variant="outline"
              onClick={() => void toggleFullscreen()}
              aria-label={isFullscreen ? t("Exit fullscreen") : t("Enter fullscreen")}
              title={isFullscreen ? t("Exit fullscreen") : t("Enter fullscreen")}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          ) : null}
        </div>
      </div>

      {isEmbeddable ? (
        <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
          <iframe
            key={`${snapshot.embedUrl}:${reloadSeed}`}
            src={snapshot.embedUrl!}
            title="Uptime Kuma"
            style={embeddedFrameStyle}
            className="absolute left-0 top-0 block border-0 bg-background"
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center">
          <div className="w-full space-y-4 px-6 py-8">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                {snapshot.status === "frame_blocked"
                  ? t("Uptime Kuma is already online, but Finance Anything cannot embed it until the frame protection header is disabled for this local integration.")
                  : t("Start the integrated Uptime Kuma service from source, then this page will load the original monitoring UI here.")}
              </p>
              {snapshot.message ? <p>{snapshot.message}</p> : null}
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-xl border bg-background/70 px-3 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("Install command")}
                </div>
                <div className="mt-2 break-all font-mono text-xs text-foreground">{snapshot.installCommand}</div>
              </div>
              <div className="rounded-xl border bg-background/70 px-3 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("Preferred start command")}
                </div>
                <div className="mt-2 break-all font-mono text-xs text-foreground">{snapshot.devCommand}</div>
              </div>
              <div className="rounded-xl border bg-background/70 px-3 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("Production-style start command")}
                </div>
                <div className="mt-2 break-all font-mono text-xs text-foreground">{snapshot.startCommand}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
