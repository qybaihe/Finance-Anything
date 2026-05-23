import { z } from "zod";

export const knowledgeScopeTypeSchema = z.enum(["company", "project"]);
export const knowledgeDocumentFormatSchema = z.enum(["markdown"]);

export const knowledgeDocumentSummarySchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  scopeType: knowledgeScopeTypeSchema,
  scopeId: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().nullable(),
  format: knowledgeDocumentFormatSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const knowledgeDocumentSchema = knowledgeDocumentSummarySchema.extend({
  body: z.string(),
});

export const createKnowledgeDocumentSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).nullable().optional(),
  body: z.string().nullable().optional(),
});

export const updateKnowledgeDocumentSchema = z
  .object({
    title: z.string().min(1).nullable().optional(),
    body: z.string().optional(),
  })
  .refine((value) => value.title !== undefined || value.body !== undefined, {
    message: "At least one field must be provided.",
  });

export type CreateKnowledgeDocument = z.infer<typeof createKnowledgeDocumentSchema>;
export type UpdateKnowledgeDocument = z.infer<typeof updateKnowledgeDocumentSchema>;
