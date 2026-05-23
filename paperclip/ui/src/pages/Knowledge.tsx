import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpenText, Building2, Plus } from "lucide-react";
import { useSearchParams } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KnowledgeWorkspace } from "@/components/KnowledgeWorkspace";
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

type KnowledgeView = "company" | "project";

function normalizeView(value: string | null): KnowledgeView {
  return value === "project" ? "project" : "company";
}

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

export function Knowledge() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { openNewProject } = useDialogActions();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    setBreadcrumbs([{ label: t("Knowledge") }]);
  }, [setBreadcrumbs, t]);

  const { data: allProjects, isLoading } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const projects = useMemo(
    () => (allProjects ?? []).filter((project) => !project.archivedAt),
    [allProjects],
  );

  const requestedProjectRef = searchParams.get("project");
  const requestedView = normalizeView(searchParams.get("view"));
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
  const activeView: KnowledgeView =
    requestedView === "project" && activeProject ? "project" : "company";

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;

    if (!searchParams.get("view")) {
      next.set("view", "company");
      changed = true;
    }

    if (activeView === "project" && activeProjectRef && requestedProjectRef !== activeProjectRef) {
      next.set("project", activeProjectRef);
      changed = true;
    }

    if (requestedView === "project" && !activeProject) {
      next.set("view", "company");
      next.delete("project");
      changed = true;
    }

    if (changed) {
      setSearchParams(next, { replace: true });
    }
  }, [activeProject, activeProjectRef, activeView, requestedProjectRef, requestedView, searchParams, setSearchParams]);

  useEffect(() => {
    if (!activeProject || activeView !== "project") return;
    trackRecentProject(activeProject.id);
  }, [activeProject?.id, activeView]);

  if (!selectedCompanyId) {
    return <EmptyState icon={BookOpenText} message={t("Select a company to open its knowledge base.")} />;
  }

  if (isLoading) {
    return <PageSkeleton variant="detail" />;
  }

  function switchToCompanyKnowledge() {
    const next = new URLSearchParams(searchParams);
    next.set("view", "company");
    next.delete("project");
    setSearchParams(next);
  }

  function switchToProjectKnowledge(projectRef: string) {
    const next = new URLSearchParams(searchParams);
    next.set("view", "project");
    next.set("project", projectRef);
    setSearchParams(next);
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-[calc(100vh-11rem)] gap-4">
        <aside className="hidden md:flex w-[72px] shrink-0 flex-col items-center rounded-2xl border bg-card/80 py-3 shadow-xs">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t("Company knowledge")}
                onClick={switchToCompanyKnowledge}
                className={cn(
                  "flex size-11 items-center justify-center rounded-xl border transition-all",
                  activeView === "company"
                    ? "border-foreground/20 bg-accent shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
                    : "border-transparent hover:border-border hover:bg-accent/40",
                )}
              >
                <Building2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{t("Company knowledge")}</TooltipContent>
          </Tooltip>

          <div className="mt-4 flex-1 min-h-0 w-full overflow-y-auto border-t px-2 pt-4">
            <div className="flex flex-col items-center gap-2">
              {orderedProjects.map((project) => {
                const routeRef = projectRouteRef(project);
                const active = activeView === "project" && routeRef === activeProjectRef;
                return (
                  <Tooltip key={project.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={project.name}
                        onClick={() => switchToProjectKnowledge(routeRef)}
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
          <div className="rounded-2xl border bg-card px-4 py-3 shadow-xs">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <BookOpenText className="h-4 w-4 text-muted-foreground" />
                  <h1 className="text-sm font-medium">{t("Knowledge")}</h1>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("This page holds company knowledge and project knowledge. Pick the company or a project from the left.")}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="md:hidden space-y-2">
                  <div className="flex gap-2">
                    <Button size="sm" variant={activeView === "company" ? "secondary" : "outline"} onClick={switchToCompanyKnowledge}>
                      <Building2 className="h-4 w-4" />
                      {t("Company knowledge")}
                    </Button>
                    <Button
                      size="sm"
                      variant={activeView === "project" ? "secondary" : "outline"}
                      onClick={() => {
                        if (activeProjectRef) switchToProjectKnowledge(activeProjectRef);
                      }}
                      disabled={!activeProjectRef}
                    >
                      <BookOpenText className="h-4 w-4" />
                      {t("Project knowledge")}
                    </Button>
                  </div>
                  <Select
                    value={activeProjectRef ?? undefined}
                    onValueChange={(value) => switchToProjectKnowledge(value)}
                    disabled={orderedProjects.length === 0}
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
                </div>

                <div className="hidden min-w-0 md:flex md:flex-col md:items-end">
                  <div className="text-sm font-medium">
                    {activeView === "company" ? (selectedCompany?.name ?? t("Company")) : (activeProject?.name ?? t("Project knowledge"))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {activeView === "company"
                      ? t("Company-wide notes, SOPs, integration checklists, and shared context live here.")
                      : t("Project-specific architecture notes, launch steps, and implementation memory live here.")}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {activeView === "company" ? (
            <KnowledgeWorkspace
              scope={{
                kind: "company",
                companyId: selectedCompanyId,
                companyName: selectedCompany?.name ?? null,
              }}
            />
          ) : activeProject ? (
            <KnowledgeWorkspace
              scope={{
                kind: "project",
                companyId: selectedCompanyId,
                projectId: activeProject.id,
                projectName: activeProject.name,
                projectColor: activeProject.color,
              }}
            />
          ) : (
            <EmptyState
              icon={BookOpenText}
              message={t("No projects yet. Create a project first, then add project knowledge here.")}
              action={t("Add Project")}
              onAction={openNewProject}
            />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
