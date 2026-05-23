import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  CreateKnowledgeDocumentRequest,
  KnowledgeDocument,
  KnowledgeDocumentSummary,
  UpdateKnowledgeDocumentRequest,
} from "@paperclipai/shared";
import { notFound, unprocessable } from "../errors.js";
import { resolveCompanyKnowledgeDir, resolveProjectKnowledgeDir } from "../home-paths.js";

type CompanyKnowledgeScope = {
  scopeType: "company";
  companyId: string;
};

type ProjectKnowledgeScope = {
  scopeType: "project";
  companyId: string;
  projectId: string;
};

type KnowledgeScope = CompanyKnowledgeScope | ProjectKnowledgeScope;

type StoredKnowledgeDocumentMeta = {
  id: string;
  companyId: string;
  projectId: string | null;
  scopeType: "company" | "project";
  scopeId: string;
  slug: string;
  title: string;
  format: "markdown";
  createdAt: string;
  updatedAt: string;
};

const SAFE_FILE_SEGMENT_RE = /^[a-zA-Z0-9._-]+$/;

function ensureSafeFileSegment(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed || !SAFE_FILE_SEGMENT_RE.test(trimmed)) {
    throw unprocessable(`Invalid ${label}.`);
  }
  return trimmed;
}

function resolveScopeDir(scope: KnowledgeScope) {
  return scope.scopeType === "company"
    ? resolveCompanyKnowledgeDir(scope.companyId)
    : resolveProjectKnowledgeDir(scope.projectId);
}

function resolveDocPaths(scope: KnowledgeScope, docId: string) {
  const safeDocId = ensureSafeFileSegment(docId, "document id");
  const scopeDir = resolveScopeDir(scope);
  return {
    dir: scopeDir,
    metaPath: path.join(scopeDir, `${safeDocId}.json`),
    bodyPath: path.join(scopeDir, `${safeDocId}.md`),
  };
}

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

function normalizeSlug(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  const normalized = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "doc";
}

function dedupeSlug(baseSlug: string, existingSlugs: Set<string>) {
  if (!existingSlugs.has(baseSlug)) return baseSlug;
  let index = 2;
  while (existingSlugs.has(`${baseSlug}-${index}`)) {
    index += 1;
  }
  return `${baseSlug}-${index}`;
}

function buildSummary(body: string): string | null {
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  const heading = lines.find((line) => line.startsWith("# "))?.replace(/^#\s+/, "") ?? null;
  const paragraph = lines.find((line) => !line.startsWith("#") && !line.startsWith("|")) ?? null;
  const base = heading ?? paragraph;
  if (!base) return null;
  if (!paragraph || paragraph === heading) return base.slice(0, 140);
  return `${heading} · ${paragraph.slice(0, 110)}`.slice(0, 160);
}

function toSummary(meta: StoredKnowledgeDocumentMeta, body: string): KnowledgeDocumentSummary {
  return {
    id: meta.id,
    companyId: meta.companyId,
    projectId: meta.projectId,
    scopeType: meta.scopeType,
    scopeId: meta.scopeId,
    slug: meta.slug,
    title: meta.title,
    summary: buildSummary(body),
    format: meta.format,
    createdAt: new Date(meta.createdAt),
    updatedAt: new Date(meta.updatedAt),
  };
}

function toDocument(meta: StoredKnowledgeDocumentMeta, body: string): KnowledgeDocument {
  return {
    ...toSummary(meta, body),
    body,
  };
}

async function readDocumentMeta(filePath: string): Promise<StoredKnowledgeDocumentMeta | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoredKnowledgeDocumentMeta>;
    if (
      typeof parsed.id !== "string"
      || typeof parsed.companyId !== "string"
      || typeof parsed.scopeId !== "string"
      || typeof parsed.slug !== "string"
      || typeof parsed.title !== "string"
      || (parsed.scopeType !== "company" && parsed.scopeType !== "project")
    ) {
      return null;
    }
    return {
      id: parsed.id,
      companyId: parsed.companyId,
      projectId: typeof parsed.projectId === "string" ? parsed.projectId : null,
      scopeType: parsed.scopeType,
      scopeId: parsed.scopeId,
      slug: parsed.slug,
      title: parsed.title,
      format: parsed.format === "markdown" ? "markdown" : "markdown",
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function readBodyFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8").catch(() => "");
}

async function listStoredDocuments(scope: KnowledgeScope) {
  const dir = resolveScopeDir(scope);
  const stat = await fs.stat(dir).catch(() => null);
  if (!stat?.isDirectory()) return [] as Array<{ meta: StoredKnowledgeDocumentMeta; body: string }>;

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const docs: Array<{ meta: StoredKnowledgeDocumentMeta; body: string }> = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const metaPath = path.join(dir, entry.name);
    const meta = await readDocumentMeta(metaPath);
    if (!meta) continue;
    const body = await readBodyFile(path.join(dir, `${meta.id}.md`));
    docs.push({ meta, body });
  }

  docs.sort((left, right) => {
    return new Date(right.meta.updatedAt).getTime() - new Date(left.meta.updatedAt).getTime();
  });
  return docs;
}

async function readStoredDocument(scope: KnowledgeScope, docId: string) {
  const { metaPath, bodyPath } = resolveDocPaths(scope, docId);
  const meta = await readDocumentMeta(metaPath);
  if (!meta) throw notFound("Knowledge document not found");
  const body = await readBodyFile(bodyPath);
  return { meta, body };
}

function assertTitle(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    throw unprocessable("Knowledge document title is required.");
  }
  return trimmed;
}

function buildInitialBody(title: string, body?: string | null) {
  const normalized = body?.replace(/\r\n/g, "\n").trim();
  if (normalized && normalized.length > 0) return normalized;
  return `# ${title}\n\n`;
}

export function knowledgeService() {
  return {
    async list(scope: KnowledgeScope): Promise<KnowledgeDocumentSummary[]> {
      const docs = await listStoredDocuments(scope);
      return docs.map((doc) => toSummary(doc.meta, doc.body));
    },

    async get(scope: KnowledgeScope, docId: string): Promise<KnowledgeDocument> {
      const doc = await readStoredDocument(scope, docId);
      return toDocument(doc.meta, doc.body);
    },

    async create(scope: KnowledgeScope, input: CreateKnowledgeDocumentRequest): Promise<KnowledgeDocument> {
      const title = assertTitle(input.title);
      const existingDocs = await listStoredDocuments(scope);
      const existingSlugs = new Set(existingDocs.map((doc) => doc.meta.slug));
      const slug = dedupeSlug(normalizeSlug(input.slug ?? title), existingSlugs);
      const now = new Date().toISOString();
      const id = randomUUID();
      const body = buildInitialBody(title, input.body);
      const meta: StoredKnowledgeDocumentMeta = {
        id,
        companyId: scope.companyId,
        projectId: scope.scopeType === "project" ? scope.projectId : null,
        scopeType: scope.scopeType,
        scopeId: scope.scopeType === "project" ? scope.projectId : scope.companyId,
        slug,
        title,
        format: "markdown",
        createdAt: now,
        updatedAt: now,
      };
      const { dir, metaPath, bodyPath } = resolveDocPaths(scope, id);
      await ensureDir(dir);
      await fs.writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
      await fs.writeFile(bodyPath, body.endsWith("\n") ? body : `${body}\n`, "utf8");
      return toDocument(meta, body);
    },

    async update(
      scope: KnowledgeScope,
      docId: string,
      input: UpdateKnowledgeDocumentRequest,
    ): Promise<KnowledgeDocument> {
      const existing = await readStoredDocument(scope, docId);
      const nextTitle = input.title === undefined || input.title === null
        ? existing.meta.title
        : assertTitle(input.title);
      const nextBody = input.body === undefined
        ? existing.body
        : input.body.replace(/\r\n/g, "\n");
      const nextMeta: StoredKnowledgeDocumentMeta = {
        ...existing.meta,
        title: nextTitle,
        updatedAt: new Date().toISOString(),
      };
      const { metaPath, bodyPath } = resolveDocPaths(scope, docId);
      await fs.writeFile(metaPath, `${JSON.stringify(nextMeta, null, 2)}\n`, "utf8");
      await fs.writeFile(bodyPath, nextBody.endsWith("\n") ? nextBody : `${nextBody}\n`, "utf8");
      return toDocument(nextMeta, nextBody);
    },
  };
}
