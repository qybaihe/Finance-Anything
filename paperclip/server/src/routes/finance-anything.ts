import { Router, type Request } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { and, eq, ne } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents as agentsTable, projects as projectsTable } from "@paperclipai/db";
import { PERMISSION_KEYS } from "@paperclipai/shared";
import { forbidden, notFound } from "../errors.js";
import { assertBoard } from "./authz.js";
import {
  accessService,
  agentInstructionsService,
  agentService,
  companyService,
  goalService,
  projectService,
} from "../services/index.js";

type FinanceBootstrapResult = {
  enabled: true;
  productName: string;
  company: Awaited<ReturnType<ReturnType<typeof companyService>["getById"]>>;
  goalId: string;
  projectId: string;
  defaultAgentId: string | null;
  agentCount: number;
};

const DEFAULT_PRODUCT_NAME = "Finance Anything";
const DEFAULT_MODEL = "xiaomi-token-plan-cn/mimo-v2.5-pro";

function isTruthy(value: string | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function financeModeEnabled() {
  return isTruthy(process.env.FINANCE_ANYTHING_MODE) || isTruthy(process.env.PAPERCLIP_FINANCE_ANYTHING_MODE);
}

function productName() {
  return process.env.PAPERCLIP_PRODUCT_NAME?.trim() || DEFAULT_PRODUCT_NAME;
}

function defaultModel() {
  return process.env.FINANCE_DEFAULT_MODEL?.trim() || DEFAULT_MODEL;
}

function templateCompanyId() {
  return process.env.FINANCE_TEMPLATE_COMPANY_ID?.trim() || null;
}

function financeWorkspaceRoot() {
  return process.env.FINANCE_WORKSPACE_ROOT?.trim() || process.env.PAPERCLIP_FINANCE_WORKSPACE_ROOT?.trim() || null;
}

function sanitizeWorkspaceSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "workspace";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

async function rewriteAdapterConfigForFinance(input: {
  config: unknown;
  company: { id: string; issuePrefix: string };
}) {
  const config = asRecord(input.config);
  config.model = defaultModel();

  const root = financeWorkspaceRoot();
  if (root) {
    const workspaceDir = path.join(root, sanitizeWorkspaceSegment(input.company.issuePrefix || input.company.id));
    await fs.mkdir(workspaceDir, { recursive: true });
    config.cwd = workspaceDir;
  }

  return config;
}

async function resolveExistingUserCompany(req: Request, companies: ReturnType<typeof companyService>) {
  if (req.actor.type !== "board") return null;
  const companyIds = req.actor.companyIds ?? [];
  for (const companyId of companyIds) {
    const company = await companies.getById(companyId);
    if (company && company.status !== "archived") return company;
  }
  return null;
}

async function cloneTemplateAgents(input: {
  db: Db;
  company: { id: string; issuePrefix: string };
  sourceCompanyId: string;
}) {
  if (input.sourceCompanyId === input.company.id) return [];

  const agents = agentService(input.db);
  const instructions = agentInstructionsService();
  const sourceAgents = await input.db
    .select()
    .from(agentsTable)
    .where(and(eq(agentsTable.companyId, input.sourceCompanyId), ne(agentsTable.status, "terminated")));

  const byTemplateId = new Map<string, Awaited<ReturnType<typeof agents.create>>>();

  for (const sourceAgent of sourceAgents) {
    const adapterConfig = await rewriteAdapterConfigForFinance({
      config: sourceAgent.adapterConfig,
      company: input.company,
    });
    const created = await agents.create(input.company.id, {
      name: sourceAgent.name,
      role: sourceAgent.role,
      title: sourceAgent.title,
      icon: sourceAgent.icon,
      status: "idle",
      reportsTo: null,
      capabilities: sourceAgent.capabilities,
      adapterType: sourceAgent.adapterType,
      adapterConfig,
      runtimeConfig: sourceAgent.runtimeConfig,
      defaultEnvironmentId: null,
      budgetMonthlyCents: sourceAgent.budgetMonthlyCents,
      permissions: sourceAgent.permissions,
      metadata: {
        ...asRecord(sourceAgent.metadata),
        financeTemplateAgentId: sourceAgent.id,
      },
    });

    const exported = await instructions.exportFiles(sourceAgent);
    const materialized = await instructions.materializeManagedBundle(created, exported.files, {
      entryFile: exported.entryFile,
      replaceExisting: true,
      clearLegacyPromptTemplate: true,
    });
    const updated = await agents.update(created.id, { adapterConfig: materialized.adapterConfig });
    byTemplateId.set(sourceAgent.id, updated ?? created);
  }

  for (const sourceAgent of sourceAgents) {
    if (!sourceAgent.reportsTo) continue;
    const created = byTemplateId.get(sourceAgent.id);
    const manager = byTemplateId.get(sourceAgent.reportsTo);
    if (created && manager) {
      await agents.update(created.id, { reportsTo: manager.id });
    }
  }

  return Array.from(byTemplateId.values());
}

async function ensureFinanceWorkspace(input: {
  db: Db;
  company: NonNullable<Awaited<ReturnType<ReturnType<typeof companyService>["getById"]>>>;
}) {
  const goals = goalService(input.db);
  const projects = projectService(input.db);
  const agents = agentService(input.db);

  const goalList = await goals.list(input.company.id);
  const goal =
    goalList.find((item) => item.title === "决策目标") ??
    await goals.create(input.company.id, {
      title: "决策目标",
      description: "Finance Anything 用户的长期决策目标。",
      level: "company",
      status: "active",
    });

  const projectList = await projects.list(input.company.id);
  const project =
    projectList.find((item) => item.name === "决策工作台") ??
    await projects.create(input.company.id, {
      name: "决策工作台",
      description: "记录用户目标、agent 协同过程与最终决策报告。",
      status: "in_progress",
      goalId: goal.id,
      goalIds: [goal.id],
    });

  let agentList = await agents.list(input.company.id);
  if (agentList.length === 0) {
    const sourceCompanyId = templateCompanyId();
    if (!sourceCompanyId) {
      throw notFound("Finance template company is not configured");
    }
    agentList = await cloneTemplateAgents({
      db: input.db,
      company: input.company,
      sourceCompanyId,
    });
  }

  const defaultAgent =
    agentList.find((agent) => agent.name.includes("决策总规划师")) ??
    agentList.find((agent) => agent.name.includes("决策报告")) ??
    agentList[0] ??
    null;

  if (defaultAgent && project.leadAgentId !== defaultAgent.id) {
    await input.db
      .update(projectsTable)
      .set({ leadAgentId: defaultAgent.id, updatedAt: new Date() })
      .where(eq(projectsTable.id, project.id));
  }

  return {
    goalId: goal.id,
    projectId: project.id,
    defaultAgentId: defaultAgent?.id ?? null,
    agentCount: agentList.length,
  };
}

export function financeAnythingRoutes(db: Db) {
  const router = Router();
  const companies = companyService(db);
  const access = accessService(db);

  router.get("/status", (_req, res) => {
    res.json({
      enabled: financeModeEnabled(),
      productName: productName(),
    });
  });

  router.post("/bootstrap", async (req, res) => {
    if (!financeModeEnabled()) {
      throw notFound("Finance Anything is not enabled");
    }
    assertBoard(req);
    if (!req.actor.userId) {
      throw forbidden("User session required");
    }

    let company = await resolveExistingUserCompany(req, companies);
    if (!company) {
      const userName = req.actor.userName?.trim() || "用户";
      company = await companies.create({
        name: `${userName} 的 Finance Anything`,
        description: "个人万能决策助手工作空间",
        status: "active",
        budgetMonthlyCents: 0,
        requireBoardApprovalForNewAgents: false,
        feedbackDataSharingEnabled: false,
        brandColor: "#14b8a6",
      });
      await access.ensureMembership(company.id, "user", req.actor.userId, "owner", "active");
      await access.setPrincipalGrants(
        company.id,
        "user",
        req.actor.userId,
        PERMISSION_KEYS.map((permissionKey) => ({ permissionKey })),
        req.actor.userId,
      );
    }
    await access.ensureMembership(company.id, "user", req.actor.userId, "owner", "active");
    await access.setPrincipalGrants(
      company.id,
      "user",
      req.actor.userId,
      PERMISSION_KEYS.map((permissionKey) => ({ permissionKey })),
      req.actor.userId,
    );

    const workspace = await ensureFinanceWorkspace({ db, company });
    const result: FinanceBootstrapResult = {
      enabled: true,
      productName: productName(),
      company,
      ...workspace,
    };
    res.json(result);
  });

  return router;
}
