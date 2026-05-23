import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FolderCode, Plus, TerminalSquare } from "lucide-react";
import { useSearchParams } from "@/lib/router";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OpenCodeWorkspaceViewport } from "@/components/OpenCodeWorkspaceViewport";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { projectsApi } from "../api/projects";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { useLanguage } from "../context/LanguageContext";
import { queryKeys } from "../lib/queryKeys";
import { getRecentProjectIds, trackRecentProject } from "../lib/recent-projects";
import { RECENT_SELECTION_DISPLAY_LIMIT, orderItemsBySelectedAndRecent } from "../lib/recent-selections";
import { cn, projectRouteRef } from "../lib/utils";

function matchesProjectRef(
  project: { id: string; urlKey?: string | null; name?: string | null },
  value: string | null,
) {
  if (!value) return false;
  return project.id === value || project.urlKey === value || projectRouteRef(project) === value;
}

function projectTileLabel(name: string | null | undefined) {
  const value = name?.trim();
  if (!value) return "P";
  return Array.from(value).slice(0, 1).join("").toUpperCase();
}

export function OpenCode() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { openNewProject } = useDialogActions();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    setBreadcrumbs([{ label: t("Open Code") }]);
  }, [setBreadcrumbs, t]);

  const { data: allProjects, isLoading, error } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const projects = useMemo(
    () => (allProjects ?? []).filter((project) => !project.archivedAt),
    [allProjects],
  );

  const requestedProjectRef = searchParams.get("project");
  const recentProjectIds = useMemo(() => getRecentProjectIds(), [selectedCompanyId]);

  const requestedProject = useMemo(
    () => projects.find((project) => matchesProjectRef(project, requestedProjectRef)) ?? null,
    [projects, requestedProjectRef],
  );

  const orderedProjects = useMemo(
    () =>
      orderItemsBySelectedAndRecent(
        projects,
        requestedProject?.id ?? null,
        recentProjectIds,
        Math.max(recentProjectIds.length, RECENT_SELECTION_DISPLAY_LIMIT),
      ),
    [projects, recentProjectIds, requestedProject?.id],
  );

  const fallbackProject = orderedProjects[0] ?? null;
  const activeProjectRef = requestedProject
    ? projectRouteRef(requestedProject)
    : fallbackProject
      ? projectRouteRef(fallbackProject)
      : null;

  const { data: activeProjectDetail } = useQuery({
    queryKey: activeProjectRef ? queryKeys.projects.detail(activeProjectRef) : ["projects", "detail", "__empty__"],
    queryFn: () => projectsApi.get(activeProjectRef!, selectedCompanyId!),
    enabled: Boolean(selectedCompanyId && activeProjectRef),
  });

  const activeProject = activeProjectDetail ?? requestedProject ?? fallbackProject;

  useEffect(() => {
    if (!activeProjectRef) return;
    if (requestedProjectRef === activeProjectRef) return;
    const next = new URLSearchParams(searchParams);
    next.set("project", activeProjectRef);
    setSearchParams(next, { replace: true });
  }, [activeProjectRef, requestedProjectRef, searchParams, setSearchParams]);

  useEffect(() => {
    if (!activeProject) return;
    trackRecentProject(activeProject.id);
  }, [activeProject?.id]);

  if (!selectedCompanyId) {
    return <EmptyState icon={FolderCode} message={t("Select a company to open its Open Code workspace.")} />;
  }

  if (isLoading) {
    return <PageSkeleton variant="detail" />;
  }

  if (projects.length === 0) {
    return (
        <EmptyState
          icon={FolderCode}
          message={t("No projects yet. Create a project first, then Open Code can mount that workspace here.")}
          action={t("Add Project")}
          onAction={openNewProject}
        />
      );
  }

  if (!activeProject || !activeProjectRef) {
    return <EmptyState icon={TerminalSquare} message={t("Open Code could not resolve a project to display.")} />;
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-[calc(100vh-11rem)] gap-4">
        <aside className="hidden md:flex w-[72px] shrink-0 flex-col items-center rounded-2xl border bg-card/80 py-3 shadow-xs">
          <div className="flex size-10 items-center justify-center rounded-xl border bg-background text-muted-foreground">
            <TerminalSquare className="h-4 w-4" />
          </div>

          <div className="mt-3 flex-1 min-h-0 w-full overflow-y-auto px-2">
            <div className="flex flex-col items-center gap-2">
              {orderedProjects.map((project) => {
                const routeRef = projectRouteRef(project);
                const active = routeRef === activeProjectRef;
                return (
                  <Tooltip key={project.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={project.name}
                        onClick={() => {
                          const next = new URLSearchParams(searchParams);
                          next.set("project", routeRef);
                          setSearchParams(next);
                        }}
                        className={cn(
                          "flex size-11 items-center justify-center rounded-xl border text-sm font-semibold transition-all",
                          active
                            ? "border-foreground/20 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
                            : "border-transparent hover:border-border hover:bg-accent/40",
                        )}
                        style={{
                          backgroundColor: project.color ?? "#6366f1",
                          color: "#ffffff",
                        }}
                      >
                        {projectTileLabel(project.name)}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <div className="max-w-[16rem]">
                        <div className="font-medium">{project.name}</div>
                        {active ? <div className="mt-0.5 text-[11px] opacity-80">{t("Current project")}</div> : null}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={openNewProject}
                className="mt-2 flex size-10 items-center justify-center rounded-xl border border-dashed text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label={t("Add Project")}
              >
                <Plus className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{t("Add Project")}</TooltipContent>
          </Tooltip>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="md:hidden rounded-2xl border bg-card px-4 py-3 shadow-xs">
            <Select
              value={activeProjectRef}
              onValueChange={(value) => {
                const next = new URLSearchParams(searchParams);
                next.set("project", value);
                setSearchParams(next);
              }}
            >
              <SelectTrigger className="min-w-[16rem] max-w-full">
                <SelectValue placeholder={t("Choose a project")} />
              </SelectTrigger>
              <SelectContent align="end">
                {orderedProjects.map((project) => {
                  const value = projectRouteRef(project);
                  return (
                    <SelectItem key={project.id} value={value}>
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: project.color ?? "#6366f1" }}
                        />
                        <span className="truncate">{project.name}</span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {error ? (
              <p className={cn("mt-3 text-sm text-destructive")}>
                {error.message}
              </p>
            ) : null}
          </div>

          <OpenCodeWorkspaceViewport project={activeProject} />
        </div>
      </div>
    </TooltipProvider>
  );
}
