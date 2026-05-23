import type { Db } from "@paperclipai/db";
import type { ProjectWorkspace, WorkspaceRuntimeService } from "@paperclipai/shared";
import { projectService } from "./projects.js";

const PRODUCT_PREVIEW_CANDIDATES = [
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
  "http://127.0.0.1:3003",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:5173",
] as const;

type ProbedUrl = {
  url: string;
  status: number;
  title: string | null;
};

type ProductProjectShape = {
  id: string;
  urlKey: string | null;
  primaryWorkspace: (Pick<ProjectWorkspace, "runtimeServices"> & { runtimeServices?: WorkspaceRuntimeService[] }) | null;
  workspaces: Array<Pick<ProjectWorkspace, "runtimeServices"> & { runtimeServices?: WorkspaceRuntimeService[] }>;
};

function readRouteRef(project: Pick<ProductProjectShape, "id" | "urlKey">) {
  return project.urlKey?.trim() || project.id;
}

function normalizeText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function summarizeProjectRuntimeServices(project: ProductProjectShape) {
  const seen = new Set<string>();
  const services: WorkspaceRuntimeService[] = [];
  const workspaceCandidates = [project.primaryWorkspace, ...project.workspaces]
    .filter(Boolean)
    .flatMap((workspace) => workspace?.runtimeServices ?? []);

  for (const service of workspaceCandidates) {
    const key = service.id || `${service.serviceName}:${service.url ?? service.port ?? "none"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    services.push(service);
  }

  return services;
}

async function probeUrl(url: string): Promise<ProbedUrl | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      },
    });

    const contentType = response.headers.get("content-type") ?? "";
    let title: string | null = null;

    if (contentType.includes("text/html")) {
      const html = await response.text();
      const match = html.match(/<title>(.*?)<\/title>/is);
      title = normalizeText(match?.[1]?.replace(/\s+/g, " ") ?? null);
    } else {
      await response.arrayBuffer().catch(() => null);
    }

    return {
      url,
      status: response.status,
      title,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function productService(db: Db) {
  const projects = projectService(db);

  return {
    listCompanyProducts: async (companyId: string) => {
      const companyProjects = (await projects.list(companyId)).filter((project) => !project.archivedAt);
      const previewCandidates = (await Promise.all(PRODUCT_PREVIEW_CANDIDATES.map((url) => probeUrl(url))))
        .filter((result): result is ProbedUrl => Boolean(result));

      // KidCompass 产品端现在以可维护的 HTML 财务规划报告为主入口。
      // 监控/Umami 路径在该部署中显式关闭，避免产品页继续把“分析监控”作为默认焦点。
      let previewIndex = 0;

      const products = companyProjects.map((project) => {
        const projectRef = readRouteRef(project);
        const runtimeServices = summarizeProjectRuntimeServices(project);
        const liveRuntimeService =
          runtimeServices.find((service) => normalizeText(service.url) && service.healthStatus === "healthy")
          ?? runtimeServices.find((service) => normalizeText(service.url) && service.status === "running")
          ?? runtimeServices.find((service) => normalizeText(service.url));

        const runtimeUrl = normalizeText(liveRuntimeService?.url);
        const preview = runtimeUrl ? null : previewCandidates[previewIndex] ?? null;
        if (!runtimeUrl && preview) {
          previewIndex += 1;
        }

        const previewUrl = runtimeUrl ?? preview?.url ?? null;
        const siteTitle = preview?.title ?? null;

        return {
          id: projectRef,
          name: project.name,
          projectId: project.id,
          projectRef,
          projectName: project.name,
          projectColor: project.color ?? null,
          projectLocalFolder: project.codebase.effectiveLocalFolder ?? null,
          site: {
            name: siteTitle ?? `${project.name} website`,
            title: siteTitle,
            url: previewUrl,
            status: previewUrl ? "live" : "planned",
            source: runtimeUrl ? "runtime_service" : preview ? "local_preview" : "missing",
            runtimeServices: runtimeServices.map((service) => ({
              id: service.id,
              serviceName: service.serviceName,
              status: service.status,
              healthStatus: service.healthStatus,
              port: service.port,
              url: service.url,
            })),
          },
          analytics: {
            provider: "disabled",
            status: "missing",
            baseUrl: null,
            embedUrl: null,
            repoPath: null,
            installCommand: "pnpm install",
            databaseCommand: "docker compose up -d db",
            devCommand: "pnpm dev",
            buildCommand: "pnpm build && pnpm start",
          },
        };
      });

      return {
        checkedAt: new Date().toISOString(),
        umami: {
          status: "missing",
          baseUrl: null,
          repoPath: null,
        },
        products,
      };
    },
  };
}
