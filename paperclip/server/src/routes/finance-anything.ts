import { Router, type Request } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { and, eq, ne } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents as agentsTable, projects as projectsTable } from "@paperclipai/db";
import { PERMISSION_KEYS } from "@paperclipai/shared";
import { badRequest, forbidden, notFound } from "../errors.js";
import { assertAuthenticated, assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import {
  accessService,
  agentInstructionsService,
  agentService,
  companyService,
  documentService,
  goalService,
  heartbeatService,
  issueReferenceService,
  issueService,
  logActivity,
  projectService,
  workProductService,
} from "../services/index.js";
import { queueIssueAssignmentWakeup } from "../services/issue-assignment-wakeup.js";

type FinanceBootstrapResult = {
  enabled: true;
  productName: string;
  company: Awaited<ReturnType<ReturnType<typeof companyService>["getById"]>>;
  goalId: string;
  projectId: string;
  defaultAgentId: string | null;
  agentCount: number;
};

type FinanceCompany = NonNullable<Awaited<ReturnType<ReturnType<typeof companyService>["getById"]>>>;

const DEFAULT_PRODUCT_NAME = "Finance Anything";
const DEFAULT_MODEL = "xiaomi/mimo-v2.5-pro";
const REPORT_DOCUMENT_KEYS = new Set([
  "final-report",
  "final_report",
  "decision-report",
  "decision_report",
  "report",
  "summary",
]);
const REPORT_TEXT_RE = /(最终报告|决策报告|决策结论|final\s*report|decision\s*report|report)/i;

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
  config.command = readTextField(config.command) || "opencode";
  config.dangerouslySkipPermissions = config.dangerouslySkipPermissions ?? true;

  const env = asRecord(config.env);
  const apiKey = process.env.OPENAI_API_KEY?.trim() || process.env.FINANCE_ANYTHING_API_KEY?.trim();
  const baseUrl = process.env.OPENAI_BASE_URL?.trim() || process.env.OPENAI_API_BASE?.trim();
  if (apiKey) env.OPENAI_API_KEY = apiKey;
  if (baseUrl) {
    env.OPENAI_BASE_URL = baseUrl;
    env.OPENAI_API_BASE = baseUrl;
  }
  env.OPENCODE_DISABLE_PROJECT_CONFIG = "true";
  config.env = env;

  const root = financeWorkspaceRoot();
  if (root) {
    const workspaceDir = path.join(root, sanitizeWorkspaceSegment(input.company.issuePrefix || input.company.id));
    await fs.mkdir(workspaceDir, { recursive: true });
    config.cwd = workspaceDir;
  }

  return config;
}

function rewriteRuntimeConfigForFinance(input: unknown) {
  const runtimeConfig = asRecord(input);
  const modelProfiles = asRecord(runtimeConfig.modelProfiles);
  const cheapProfile = asRecord(modelProfiles.cheap);
  const cheapAdapterConfig = asRecord(cheapProfile.adapterConfig);

  modelProfiles.cheap = {
    ...cheapProfile,
    enabled: cheapProfile.enabled ?? true,
    label: readTextField(cheapProfile.label) || "快速复核",
    adapterConfig: {
      ...cheapAdapterConfig,
      model: defaultModel(),
      modelReasoningEffort: readTextField(cheapAdapterConfig.modelReasoningEffort) || "low",
    },
  };
  runtimeConfig.modelProfiles = modelProfiles;
  return runtimeConfig;
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

async function resolveOrCreateBoardFinanceCompany(input: {
  req: Request;
  companies: ReturnType<typeof companyService>;
  access: ReturnType<typeof accessService>;
}) {
  const { req, companies, access } = input;
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
  }

  await access.ensureMembership(company.id, "user", req.actor.userId, "owner", "active");
  await access.setPrincipalGrants(
    company.id,
    "user",
    req.actor.userId,
    PERMISSION_KEYS.map((permissionKey) => ({ permissionKey })),
    req.actor.userId,
  );
  return company;
}

async function resolveFinanceCompanyForActor(input: {
  req: Request;
  companies: ReturnType<typeof companyService>;
  access: ReturnType<typeof accessService>;
}) {
  const { req, companies } = input;
  assertAuthenticated(req);

  if (req.actor.type === "agent") {
    const companyId = req.actor.companyId;
    if (!companyId) throw forbidden("Agent company scope required");
    assertCompanyAccess(req, companyId);
    const company = await companies.getById(companyId);
    if (!company || company.status === "archived") {
      throw notFound("Finance company not found");
    }
    return company;
  }

  return resolveOrCreateBoardFinanceCompany(input);
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
      runtimeConfig: rewriteRuntimeConfigForFinance(sourceAgent.runtimeConfig),
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
    const finalAdapterConfig = await rewriteAdapterConfigForFinance({
      config: materialized.adapterConfig,
      company: input.company,
    });
    const updated = await agents.update(created.id, { adapterConfig: finalAdapterConfig });
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

async function repairFinanceAgents(input: {
  agents: ReturnType<typeof agentService>;
  company: { id: string; issuePrefix: string };
  agentList: Awaited<ReturnType<ReturnType<typeof agentService>["list"]>>;
}) {
  const repaired: Awaited<ReturnType<ReturnType<typeof agentService>["list"]>> = [];
  for (const agent of input.agentList) {
    if (agent.adapterType !== "opencode_local") {
      repaired.push(agent);
      continue;
    }
    const adapterConfig = await rewriteAdapterConfigForFinance({
      config: agent.adapterConfig,
      company: input.company,
    });
    const runtimeConfig = rewriteRuntimeConfigForFinance(agent.runtimeConfig);
    const updated = await input.agents.update(agent.id, { adapterConfig, runtimeConfig });
    repaired.push(updated ?? agent);
  }
  return repaired;
}

async function ensureFinanceWorkspace(input: {
  db: Db;
  company: FinanceCompany;
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
  agentList = await repairFinanceAgents({ agents, company: input.company, agentList });

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

function readTextField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readDecisionRequest(body: unknown) {
  const data = asRecord(body);
  const goal = readTextField(data.goal) || readTextField(data.message) || readTextField(data.title);
  const context = readTextField(data.context) || readTextField(data.description);
  if (!goal) {
    throw badRequest("Decision goal is required");
  }
  return { goal, context };
}

function buildDecisionDescription(input: { goal: string; context?: string }) {
  return [
    "这是 Finance Anything 的用户决策目标。",
    "",
    `用户目标：${input.goal}`,
    input.context ? ["", "补充背景：", input.context].join("\n") : "",
    "",
    "请多 Agent 协同完成信息采集、证据校验、替代方案、成本收益、风险、场景模拟、反方辩论、二手价值分析，并由决策报告 Agent 输出最终决策报告。",
    "",
    "最终报告要求：必须生成一份可打开的 HTML 报告文件并上传到本目标，报告需要综合各 Agent 结论、关键证据、分歧、评分、风险控制、执行条件和复盘计划。",
    "",
    "报告沉淀要求：决策报告 Agent 完成后，必须同步创建或更新 key 为 final-report 的 Issue Document，标题写“最终报告”，正文包含最终结论、报告摘要、HTML/PDF 报告链接或附件说明；如果创建 Work Product 或上传 HTML/PDF 附件，标题或文件名必须包含“最终报告”或“决策报告”。",
  ].filter(Boolean).join("\n");
}

type FinanceReportIssue = {
  id: string;
  identifier: string | null;
  title: string;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  completedAt?: Date | string | null;
};
type FinanceReportDocument = Awaited<ReturnType<ReturnType<typeof documentService>["listIssueDocuments"]>>[number];
type FinanceReportWorkProduct = Awaited<ReturnType<ReturnType<typeof workProductService>["listForIssue"]>>[number];
type FinanceReportAttachment = Awaited<ReturnType<ReturnType<typeof issueService>["listAttachments"]>>[number];

function maybeDateString(value: unknown) {
  return value instanceof Date ? value.toISOString() : typeof value === "string" ? value : null;
}

function isReportDocument(doc: FinanceReportDocument) {
  if (REPORT_DOCUMENT_KEYS.has(doc.key)) return true;
  return REPORT_TEXT_RE.test(doc.title ?? "");
}

function isReportWorkProduct(product: FinanceReportWorkProduct) {
  const haystack = [
    product.title,
    product.summary,
    product.url,
    product.type,
    product.provider,
  ].filter(Boolean).join(" ");
  if (product.isPrimary && (product.type === "document" || product.type === "artifact")) return true;
  return REPORT_TEXT_RE.test(haystack) || /\.html?(?:$|[?#])/i.test(product.url ?? "");
}

function isReportAttachment(attachment: FinanceReportAttachment) {
  const filename = attachment.originalFilename ?? "";
  const contentType = attachment.contentType ?? "";
  return REPORT_TEXT_RE.test(filename)
    || /\.html?$/i.test(filename)
    || /\.pdf$/i.test(filename)
    || contentType === "text/html"
    || contentType === "application/pdf";
}

function sourceUpdatedAt(source: { updatedAt?: unknown; createdAt?: unknown }) {
  return maybeDateString(source.updatedAt) ?? maybeDateString(source.createdAt) ?? new Date(0).toISOString();
}

function sourceScore(source: { kind: string; key?: string | null; isPrimary?: boolean | null; contentType?: string | null; title?: string | null }) {
  let score = 0;
  if (source.isPrimary) score += 50;
  if (source.key === "final-report") score += 60;
  if (source.kind === "document") score += 35;
  if (source.kind === "attachment" && source.contentType === "text/html") score += 30;
  if (source.kind === "work_product") score += 25;
  if (REPORT_TEXT_RE.test(source.title ?? "")) score += 15;
  return score;
}

function pickPrimarySource<T extends { kind: string; updatedAt: string; key?: string | null; isPrimary?: boolean | null; contentType?: string | null; title?: string | null }>(sources: T[]) {
  return [...sources].sort((a, b) => {
    const scoreDiff = sourceScore(b) - sourceScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  })[0] ?? null;
}

function buildReportSources(input: {
  documents: FinanceReportDocument[];
  workProducts: FinanceReportWorkProduct[];
  attachments: FinanceReportAttachment[];
  includeBody?: boolean;
}) {
  const documentSources = input.documents
    .filter(isReportDocument)
    .map((doc) => ({
      id: doc.id,
      kind: "document" as const,
      key: doc.key,
      title: doc.title ?? (doc.key === "final-report" ? "最终报告" : doc.key),
      format: doc.format,
      revisionNumber: doc.latestRevisionNumber,
      url: null,
      summary: null,
      contentType: "text/markdown",
      filename: null,
      isPrimary: doc.key === "final-report",
      body: input.includeBody ? doc.body : undefined,
      createdAt: sourceUpdatedAt({ createdAt: doc.createdAt }),
      updatedAt: sourceUpdatedAt(doc),
    }));
  const productSources = input.workProducts
    .filter(isReportWorkProduct)
    .map((product) => ({
      id: product.id,
      kind: "work_product" as const,
      key: null,
      title: product.title,
      format: null,
      revisionNumber: null,
      url: product.url,
      summary: product.summary,
      contentType: null,
      filename: null,
      isPrimary: product.isPrimary,
      status: product.status,
      body: undefined,
      createdAt: sourceUpdatedAt(product),
      updatedAt: sourceUpdatedAt(product),
    }));
  const attachmentSources = input.attachments
    .filter(isReportAttachment)
    .map((attachment) => ({
      id: attachment.id,
      kind: "attachment" as const,
      key: null,
      title: attachment.originalFilename ?? "最终报告附件",
      format: null,
      revisionNumber: null,
      url: `/api/attachments/${attachment.id}/content`,
      summary: `${attachment.contentType} · ${attachment.byteSize} bytes`,
      contentType: attachment.contentType,
      filename: attachment.originalFilename,
      isPrimary: attachment.contentType === "text/html",
      body: undefined,
      createdAt: sourceUpdatedAt(attachment),
      updatedAt: sourceUpdatedAt(attachment),
    }));
  return [...documentSources, ...productSources, ...attachmentSources]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

async function buildReportEntry(input: {
  issue: FinanceReportIssue;
  documents: ReturnType<typeof documentService>;
  workProducts: ReturnType<typeof workProductService>;
  issues: ReturnType<typeof issueService>;
  includeBody?: boolean;
}) {
  const [documents, workProducts, attachments] = await Promise.all([
    input.documents.listIssueDocuments(input.issue.id),
    input.workProducts.listForIssue(input.issue.id),
    input.issues.listAttachments(input.issue.id),
  ]);
  const sources = buildReportSources({
    documents,
    workProducts,
    attachments,
    includeBody: input.includeBody,
  });
  const primarySource = pickPrimarySource(sources);
  return {
    issueId: input.issue.id,
    issueIdentifier: input.issue.identifier,
    issueTitle: input.issue.title,
    issueStatus: input.issue.status,
    issuePath: `/issues/${input.issue.identifier ?? input.issue.id}`,
    reportStatus: primarySource ? "ready" as const : "pending" as const,
    sourceCount: sources.length,
    primarySource,
    sources,
    createdAt: sourceUpdatedAt({ createdAt: input.issue.createdAt }),
    updatedAt: sourceUpdatedAt(input.issue),
    completedAt: maybeDateString("completedAt" in input.issue ? input.issue.completedAt : null),
  };
}

export function financeAnythingRoutes(db: Db) {
  const router = Router();
  const companies = companyService(db);
  const access = accessService(db);
  const issues = issueService(db);
  const issueReferences = issueReferenceService(db);
  const documents = documentService(db);
  const workProducts = workProductService(db);
  const heartbeat = heartbeatService(db);

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
    const company = await resolveOrCreateBoardFinanceCompany({ req, companies, access });

    const workspace = await ensureFinanceWorkspace({ db, company });
    const result: FinanceBootstrapResult = {
      enabled: true,
      productName: productName(),
      company,
      ...workspace,
    };
    res.json(result);
  });

  router.get("/reports", async (req, res) => {
    if (!financeModeEnabled()) {
      throw notFound("Finance Anything is not enabled");
    }
    const company = await resolveFinanceCompanyForActor({ req, companies, access });
    const workspace = await ensureFinanceWorkspace({ db, company });
    const limit = Math.min(
      100,
      Math.max(1, Number.isFinite(Number(req.query.limit)) ? Number(req.query.limit) : 60),
    );
    const decisionIssues = await issues.list(company.id, {
      projectId: workspace.projectId,
      limit,
    });
    const reports = await Promise.all(
      decisionIssues.map((issue) =>
        buildReportEntry({
          issue,
          documents,
          workProducts,
          issues,
        }),
      ),
    );
    res.json({
      company,
      projectId: workspace.projectId,
      reports,
      updatedAt: new Date().toISOString(),
    });
  });

  router.get("/reports/:issueId", async (req, res) => {
    if (!financeModeEnabled()) {
      throw notFound("Finance Anything is not enabled");
    }
    const company = await resolveFinanceCompanyForActor({ req, companies, access });
    const workspace = await ensureFinanceWorkspace({ db, company });
    const issue = await issues.getById(req.params.issueId as string);
    if (!issue || issue.companyId !== company.id || issue.projectId !== workspace.projectId) {
      throw notFound("Finance decision report not found");
    }
    const report = await buildReportEntry({
      issue,
      documents,
      workProducts,
      issues,
      includeBody: true,
    });
    res.json({ report });
  });

  router.post("/decisions", async (req, res) => {
    if (!financeModeEnabled()) {
      throw notFound("Finance Anything is not enabled");
    }

    const decision = readDecisionRequest(req.body);
    const company = await resolveFinanceCompanyForActor({ req, companies, access });
    const workspace = await ensureFinanceWorkspace({ db, company });
    if (!workspace.defaultAgentId) {
      throw notFound("Finance decision orchestrator is not configured");
    }

    const actor = getActorInfo(req);
    const issue = await issues.create(company.id, {
      title: decision.goal,
      description: buildDecisionDescription(decision),
      status: "todo",
      priority: "high",
      assigneeAgentId: workspace.defaultAgentId,
      projectId: workspace.projectId,
      goalId: workspace.goalId,
      createdByAgentId: actor.agentId,
      createdByUserId: actor.actorType === "user" ? actor.actorId : null,
    });
    await issueReferences.syncIssue(issue.id);
    await logActivity(db, {
      companyId: company.id,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "finance.decision_created",
      entityType: "issue",
      entityId: issue.id,
      details: {
        title: issue.title,
        identifier: issue.identifier,
        projectId: workspace.projectId,
        goalId: workspace.goalId,
      },
    });
    void queueIssueAssignmentWakeup({
      heartbeat,
      issue,
      reason: "finance_decision_started",
      mutation: "create",
      contextSource: "finance.decision",
      requestedByActorType: actor.actorType,
      requestedByActorId: actor.actorId,
    });

    res.status(201).json({
      enabled: true,
      productName: productName(),
      company,
      ...workspace,
      issue,
      issuePath: `/${company.issuePrefix}/issues/${issue.identifier ?? issue.id}`,
    });
  });

  return router;
}
