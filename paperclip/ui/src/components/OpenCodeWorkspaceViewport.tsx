import { useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "@paperclipai/shared";
import { ExternalLink, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import {
  buildEmbeddedOpenCodeProjectUrl,
  readOpenCodeProjectConfig,
  resolveOpenCodeProjectDirectory,
  suggestOpenCodeLaunchCommand,
} from "@/lib/opencode-project";
import { cn } from "@/lib/utils";

export function OpenCodeWorkspaceViewport({
  project,
}: {
  project: Project;
}) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [reloadSeed, setReloadSeed] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const workspace = project.primaryWorkspace ?? project.workspaces[0] ?? null;
  const savedConfig = useMemo(() => readOpenCodeProjectConfig(workspace?.metadata), [workspace?.id, workspace?.metadata]);
  const resolvedDirectory = useMemo(() => resolveOpenCodeProjectDirectory(project), [project]);
  const embeddedUrl = useMemo(
    () =>
      buildEmbeddedOpenCodeProjectUrl(savedConfig.webUrl, resolvedDirectory.path, {
        theme,
        hideSidebar: true,
      }),
    [resolvedDirectory.path, savedConfig.webUrl, theme],
  );
  const suggestedLaunchCommand = useMemo(() => suggestOpenCodeLaunchCommand(savedConfig.webUrl), [savedConfig.webUrl]);

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(document.fullscreenElement === viewportRef.current);
    };

    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  async function toggleFullscreen() {
    if (!viewportRef.current) return;

    if (document.fullscreenElement === viewportRef.current) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }

    await viewportRef.current.requestFullscreen().catch(() => undefined);
  }

  return (
    <div
      ref={viewportRef}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card shadow-xs",
        isFullscreen && "rounded-none border-0 shadow-none",
      )}
    >
      {(embeddedUrl || workspace) ? (
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          {workspace ? (
            <Badge variant="secondary" className="max-w-[14rem] truncate bg-background/90 backdrop-blur">
              {workspace.name}
            </Badge>
          ) : null}
          <Button
            size="icon-sm"
            variant="outline"
            className="bg-background/90 backdrop-blur"
            onClick={() => setReloadSeed((value) => value + 1)}
            disabled={!embeddedUrl}
            aria-label={t("Reload")}
            title={t("Reload")}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {embeddedUrl ? (
            <Button asChild size="icon-sm" variant="outline" className="bg-background/90 backdrop-blur">
              <a href={embeddedUrl} target="_blank" rel="noreferrer" aria-label={t("Open in new tab")} title={t("Open in new tab")}>
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          ) : null}
          {embeddedUrl ? (
            <Button
              size="icon-sm"
              variant="outline"
              className="bg-background/90 backdrop-blur"
              onClick={() => void toggleFullscreen()}
              aria-label={isFullscreen ? t("Exit fullscreen") : t("Enter fullscreen")}
              title={isFullscreen ? t("Exit fullscreen") : t("Enter fullscreen")}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          ) : null}
        </div>
      ) : null}

      {embeddedUrl && resolvedDirectory.path ? (
        <iframe
          key={`${embeddedUrl}:${reloadSeed}`}
          src={embeddedUrl}
          title={`${project.name} OpenCode workspace`}
          className={cn(
            "w-full bg-background",
            isFullscreen ? "h-screen" : "h-[78vh]",
          )}
        />
      ) : (
        <div className="space-y-3 px-6 py-10 text-sm text-muted-foreground">
          <p>
            {t("This project cannot be embedded in OpenCode yet because Finance Anything still needs a resolvable directory and a working OpenCode Web URL.")}
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t("Bind a local workspace or code directory to the project.")}</li>
            <li>{t("Start OpenCode Web, for example {{command}}.", { command: suggestedLaunchCommand })}</li>
            <li>{t("Then save the base URL in the project OpenCode settings.")}</li>
          </ul>
        </div>
      )}
    </div>
  );
}
