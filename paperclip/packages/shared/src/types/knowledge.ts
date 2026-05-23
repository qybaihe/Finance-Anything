export type KnowledgeScopeType = "company" | "project";

export type KnowledgeDocumentFormat = "markdown";

export interface KnowledgeDocumentSummary {
  id: string;
  companyId: string;
  projectId: string | null;
  scopeType: KnowledgeScopeType;
  scopeId: string;
  slug: string;
  title: string;
  summary: string | null;
  format: KnowledgeDocumentFormat;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeDocument extends KnowledgeDocumentSummary {
  body: string;
}

export interface CreateKnowledgeDocumentRequest {
  title: string;
  slug?: string | null;
  body?: string | null;
}

export interface UpdateKnowledgeDocumentRequest {
  title?: string | null;
  body?: string;
}
