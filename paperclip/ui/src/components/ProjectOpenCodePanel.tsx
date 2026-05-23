import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Project } from "@paperclipai/shared";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FolderCode,
  RefreshCw,
  TerminalSquare,
  Workflow,
} from "lucide-react";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { useToastActions } from "../context/ToastContext";
import { useTheme } from "../context/ThemeContext";
import { CopyText } from "./CopyText";
import { OpenCodeLogoIcon } from "./OpenCodeLogoIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";
import {
  buildEmbeddedOpenCodeProjectUrl,
  readOpenCodeProjectConfig,
  resolveOpenCodeProjectDirectory,
  suggestOpenCodeLaunchCommand,
  writeOpenCodeProjectConfigToMetadata,
} from "@/lib/opencode-project";

interface ProjectOpenCodePanelProps {
  project: Project;
  companyId: string;
  projectRef: string;
  onWorkspaceSaved: () => void;
}

const SIDEBAR_COLLAPSED_STORAGE_PREFIX = "paperclip:project-opencode-sidebar";

function readModelLabel(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readSidebarCollapsed(projectId: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(`${SIDEBAR_COLLAPSED_STORAGE_PREFIX}:${projectId}`);
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
    // ignore storage failures and fall back to the default layout
  }
  return fallback;
}

function writeSidebarCollapsed(projectId: string, value: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${SIDEBAR_COLLAPSED_STORAGE_PREFIX}:${projectId}`, value ? "1" : "0");
  } catch {
    // ignore storage failures
  }
}

function OpenCodeSidebarSection({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-background/80 p-3 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function OpenCodeRailButton({
  label,
  icon,
  onClick,
  disabled = false,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "flex size-10 items-center justify-center rounded-xl border bg-background/80 text-muted-foreground transition-colors",
            "hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            disabled && "cursor-not-allowed opacity-50 hover:bg-background/80 hover:text-muted-foreground",
          )}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function ProjectOpenCodePanel({
  project,
  companyId,
  projectRef,
  onWorkspaceSaved,
}: ProjectOpenCodePanelProps) {
  const { pushToast } = useToastActions();
  const { theme } = useTheme();
  const workspace = project.primaryWorkspace ?? project.workspaces[0] ?? null;
  const resolvedDirectory = useMemo(() => resolveOpenCodeProjectDirectory(project), [project]);
  const savedConfig = useMemo(() => readOpenCodeProjectConfig(workspace?.metadata), [workspace?.id, workspace?.metadata]);
  const [webUrl, setWebUrl] = useState(savedConfig.webUrl);
  const [launchCommand, setLaunchCommand] = useState(savedConfig.launchCommand);
  const [reloadSeed, setReloadSeed] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    readSidebarCollapsed(project.id, Boolean(savedConfig.webUrl && resolvedDirectory.path)),
  );

  useEffect(() => {
    setWebUrl(savedConfig.webUrl);
    setLaunchCommand(savedConfig.launchCommand);
  }, [savedConfig.launchCommand, savedConfig.webUrl, workspace?.id]);

  useEffect(() => {
    writeSidebarCollapsed(project.id, sidebarCollapsed);
  }, [project.id, sidebarCollapsed]);

  const { data: agents = [], isLoading: isAgentsLoading } = useQuery({
    queryKey: ["project-opencode-agents", companyId],
    queryFn: () => agentsApi.list(companyId),
    enabled: Boolean(companyId),
  });

  const openCodeAgents = useMemo(
    () => agents.filter((agent) => agent.adapterType === "opencode_local"),
    [agents],
  );

  const suggestedLaunchCommand = useMemo(() => suggestOpenCodeLaunchCommand(webUrl), [webUrl]);
  const effectiveLaunchCommand = useMemo(
    () => launchCommand.trim() || suggestedLaunchCommand,
    [launchCommand, suggestedLaunchCommand],
  );
  const embeddedUrl = useMemo(
    () => buildEmbeddedOpenCodeProjectUrl(webUrl, resolvedDirectory.path, { theme, hideSidebar: true }),
    [resolvedDirectory.path, theme, webUrl],
  );
  const hasUnsavedChanges =
    webUrl !== savedConfig.webUrl || (launchCommand.trim() || suggestedLaunchCommand) !== savedConfig.launchCommand;
  const isEmbeddedReady = Boolean(embeddedUrl && resolvedDirectory.path);

  useEffect(() => {
    if (!isEmbeddedReady) setSidebarCollapsed(false);
  }, [isEmbeddedReady]);

  const saveWorkspaceConfig = useMutation({
    mutationFn: async () => {
      if (!workspace) {
        throw new Error("Project needs a primary workspace before OpenCode settings can be saved.");
      }
      return projectsApi.updateWorkspace(
        project.id,
        workspace.id,
        {
          metadata: writeOpenCodeProjectConfigToMetadata(workspace.metadata, {
            webUrl,
            launchCommand: effectiveLaunchCommand,
          }),
        },
        companyId,
      );
    },
    onSuccess: () => {
      pushToast({ title: "Saved OpenCode project settings", tone: "success" });
      onWorkspaceSaved();
    },
    onError: (error) => {
      pushToast({
        title: error instanceof Error ? error.message : "Failed to save OpenCode settings",
        tone: "error",
      });
    },
  });

  const openEmbeddedInNewTab = () => {
    if (!embeddedUrl) return;
    window.open(embeddedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <TooltipProvider>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex min-h-[78vh] bg-background">
          <aside
            className={cn(
              "flex shrink-0 flex-col border-r bg-muted/20 transition-[width] duration-200 ease-out",
              sidebarCollapsed ? "w-16" : "w-[23rem]",
            )}
          >
            <div
              className={cn(
                "flex border-b",
                sidebarCollapsed ? "items-center justify-center px-2 py-3" : "items-center gap-3 px-3 py-3",
              )}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-background shadow-xs">
                <OpenCodeLogoIcon className="size-4" />
              </div>
              {!sidebarCollapsed ? (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">OpenCode sidebar</div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      配置、启动命令和 agent 信息都收在左侧，不占主画布。
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setSidebarCollapsed(true)}
                    aria-label="Collapse OpenCode sidebar"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setSidebarCollapsed(false)}
                  aria-label="Expand OpenCode sidebar"
                >
                  <ChevronRight className="size-4" />
                </Button>
              )}
            </div>

            {sidebarCollapsed ? (
              <div className="flex flex-1 flex-col items-center justify-between py-3">
                <div className="flex flex-col items-center gap-2">
                  <OpenCodeRailButton
                    label={`Finance Anything runtime${openCodeAgents.length > 0 ? ` · ${openCodeAgents.length} agents` : ""}`}
                    icon={<OpenCodeLogoIcon className="size-4" />}
                    onClick={() => setSidebarCollapsed(false)}
                  />
                  <OpenCodeRailButton
                    label={workspace ? `Workspace · ${workspace.name}` : "Project workspace binding"}
                    icon={<FolderCode className="size-4" />}
                    onClick={() => setSidebarCollapsed(false)}
                  />
                  <OpenCodeRailButton
                    label="OpenCode Web handoff"
                    icon={<Workflow className="size-4" />}
                    onClick={() => setSidebarCollapsed(false)}
                  />
                </div>

                <div className="flex flex-col items-center gap-2">
                  <OpenCodeRailButton
                    label="Reload embedded OpenCode"
                    icon={<RefreshCw className="size-4" />}
                    onClick={() => setReloadSeed((current) => current + 1)}
                    disabled={!embeddedUrl}
                  />
                  <OpenCodeRailButton
                    label="Open OpenCode in a new tab"
                    icon={<ExternalLink className="size-4" />}
                    onClick={openEmbeddedInNewTab}
                    disabled={!embeddedUrl}
                  />
                </div>
              </div>
            ) : (
              <>
                <ScrollArea className="flex-1">
                  <div className="space-y-3 p-3">
                    <div className="rounded-xl border bg-background/80 p-3 shadow-xs">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">Project-level OpenCode workspace</div>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            现在左边变成收纳式侧边栏，右边尽量完整保留 OpenCode 画布。
                          </p>
                        </div>
                        <Badge variant={isEmbeddedReady ? "secondary" : "outline"}>
                          {isEmbeddedReady ? "Ready" : "Setup required"}
                        </Badge>
                      </div>
                      {hasUnsavedChanges ? (
                        <div className="mt-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                          There are unsaved OpenCode sidebar changes.
                        </div>
                      ) : null}
                    </div>

                    <OpenCodeSidebarSection
                      icon={<OpenCodeLogoIcon className="size-4" />}
                      title="Finance Anything runtime"
                      description="Finance Anything 继续负责任务、agent 和 issue 流程；这里只是把同一个项目直接切进 OpenCode Web。"
                    >
                      {isAgentsLoading ? (
                        <p className="text-sm text-muted-foreground">Loading runtime agents…</p>
                      ) : openCodeAgents.length > 0 ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {openCodeAgents.length} OpenCode agent{openCodeAgents.length > 1 ? "s" : ""}
                            </Badge>
                            <span className="text-xs text-muted-foreground">可以复用到不同项目里。</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {openCodeAgents.map((agent) => {
                              const model = readModelLabel(agent.adapterConfig?.model);
                              return (
                                <Badge key={agent.id} variant="outline" className="max-w-full gap-1.5">
                                  <span className="truncate">{agent.name}</span>
                                  {model ? <span className="truncate text-[10px] text-muted-foreground">{model}</span> : null}
                                </Badge>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                          No OpenCode agent has been created in this company yet. Create one once, then reuse it across projects.
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link to="/agents/new">Create agent</Link>
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                          <Link to="/agents/all">View agents</Link>
                        </Button>
                      </div>
                    </OpenCodeSidebarSection>

                    <OpenCodeSidebarSection
                      icon={<FolderCode className="size-4" />}
                      title="Project workspace binding"
                      description="OpenCode 需要明确的目录。优先用主 workspace，没有的话再回退到项目 codebase。"
                    >
                      <div className="space-y-1">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Directory</div>
                        <div className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs break-all">
                          {resolvedDirectory.path ?? "No project directory is available yet."}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {resolvedDirectory.source === "workspace"
                          ? `Using workspace "${workspace?.name ?? "Primary workspace"}".`
                          : resolvedDirectory.source === "codebase"
                            ? "Using Finance Anything’s resolved codebase folder because the workspace path is empty."
                            : "Set a primary workspace or local code directory before embedding OpenCode."}
                      </div>
                      {!workspace ? (
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/projects/${projectRef}/configuration`}>Open project configuration</Link>
                        </Button>
                      ) : null}
                    </OpenCodeSidebarSection>

                    <OpenCodeSidebarSection
                      icon={<Workflow className="size-4" />}
                      title="OpenCode Web handoff"
                      description="保存一个稳定的 base URL，Finance Anything 就会始终把当前项目直接落到对应目录。"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="project-opencode-web-url">OpenCode base URL</Label>
                        <Input
                          id="project-opencode-web-url"
                          value={webUrl}
                          onChange={(event) => setWebUrl(event.target.value)}
                          placeholder="http://127.0.0.1:4096"
                        />
                        <p className="text-xs text-muted-foreground">
                          Use a fixed port for the cleanest flow. Finance Anything will append the encoded project directory automatically.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <Label htmlFor="project-opencode-launch-command">Launch command</Label>
                          <CopyText
                            text={effectiveLaunchCommand}
                            ariaLabel="Copy OpenCode launch command"
                            className="text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground"
                          >
                            Copy command
                          </CopyText>
                        </div>
                        <Textarea
                          id="project-opencode-launch-command"
                          value={launchCommand}
                          onChange={(event) => setLaunchCommand(event.target.value)}
                          placeholder={suggestedLaunchCommand}
                          rows={3}
                        />
                        <div className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs break-all">
                          {effectiveLaunchCommand}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Resolved project URL</div>
                        <div className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs break-all">
                          {embeddedUrl ?? "Enter a valid base URL to generate the embedded project URL."}
                        </div>
                      </div>
                    </OpenCodeSidebarSection>
                  </div>
                </ScrollArea>

                <div className="border-t p-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => saveWorkspaceConfig.mutate()}
                      disabled={!workspace || saveWorkspaceConfig.isPending || !hasUnsavedChanges}
                    >
                      {saveWorkspaceConfig.isPending ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setReloadSeed((current) => current + 1)}
                      disabled={!embeddedUrl}
                    >
                      <RefreshCw className="size-4" />
                      Reload
                    </Button>
                    {embeddedUrl ? (
                      <Button asChild size="sm" variant="ghost">
                        <a href={embeddedUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-4" />
                          Open in new tab
                        </a>
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" disabled>
                        <ExternalLink className="size-4" />
                        Open in new tab
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <TerminalSquare className="size-4" />
                  <h2 className="text-sm font-medium">Embedded OpenCode workspace</h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  左边是可收纳的项目信息，右边尽量保留完整 OpenCode 工作区。
                </p>
              </div>

              <div className="flex items-center gap-2">
                {sidebarCollapsed ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setSidebarCollapsed(false)}>
                    <ChevronRight className="size-4" />
                    Open sidebar
                  </Button>
                ) : null}
                <Badge variant={resolvedDirectory.path ? "secondary" : "outline"} className="max-w-[16rem] truncate">
                  {resolvedDirectory.path ? (workspace ? `Workspace · ${workspace.name}` : "Project directory ready") : "Waiting for workspace"}
                </Badge>
              </div>
            </div>

            <div className="min-h-0 flex-1">
              {embeddedUrl && resolvedDirectory.path ? (
                <iframe
                  key={`${embeddedUrl}:${reloadSeed}`}
                  src={embeddedUrl}
                  title={`${project.name} OpenCode workspace`}
                  className="h-full min-h-[72vh] w-full bg-background"
                />
              ) : (
                <div className="space-y-3 px-6 py-10 text-sm text-muted-foreground">
                  <p>
                    OpenCode can’t be embedded yet because the project does not have both a valid Web URL and a resolvable
                    working directory.
                  </p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Set the project’s primary workspace to a local folder or repository checkout.</li>
                    <li>Start OpenCode Web with a stable port, for example <code>{suggestedLaunchCommand}</code>.</li>
                    <li>Paste the base URL above and save the project binding.</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
