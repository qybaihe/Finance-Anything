import type {
  CreateKnowledgeDocumentRequest,
  KnowledgeDocument,
  KnowledgeDocumentSummary,
  UpdateKnowledgeDocumentRequest,
} from "@paperclipai/shared";
import { api } from "./client";

export const knowledgeApi = {
  listCompany: (companyId: string) =>
    api.get<KnowledgeDocumentSummary[]>(`/companies/${encodeURIComponent(companyId)}/knowledge`),
  createCompany: (companyId: string, body: CreateKnowledgeDocumentRequest) =>
    api.post<KnowledgeDocument>(`/companies/${encodeURIComponent(companyId)}/knowledge`, body),
  getCompany: (companyId: string, docId: string) =>
    api.get<KnowledgeDocument>(`/companies/${encodeURIComponent(companyId)}/knowledge/${encodeURIComponent(docId)}`),
  updateCompany: (companyId: string, docId: string, body: UpdateKnowledgeDocumentRequest) =>
    api.patch<KnowledgeDocument>(
      `/companies/${encodeURIComponent(companyId)}/knowledge/${encodeURIComponent(docId)}`,
      body,
    ),

  listProject: (projectId: string) =>
    api.get<KnowledgeDocumentSummary[]>(`/projects/${encodeURIComponent(projectId)}/knowledge`),
  createProject: (projectId: string, body: CreateKnowledgeDocumentRequest) =>
    api.post<KnowledgeDocument>(`/projects/${encodeURIComponent(projectId)}/knowledge`, body),
  getProject: (projectId: string, docId: string) =>
    api.get<KnowledgeDocument>(`/projects/${encodeURIComponent(projectId)}/knowledge/${encodeURIComponent(docId)}`),
  updateProject: (projectId: string, docId: string, body: UpdateKnowledgeDocumentRequest) =>
    api.patch<KnowledgeDocument>(
      `/projects/${encodeURIComponent(projectId)}/knowledge/${encodeURIComponent(docId)}`,
      body,
    ),
};
