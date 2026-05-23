import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { KnowledgeDocument, KnowledgeDocumentSummary } from "@paperclipai/shared";
import { BookOpenText, Building2, FileText, FolderKanban, Plus, Save } from "lucide-react";
import { knowledgeApi } from "@/api/knowledge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { queryKeys } from "@/lib/queryKeys";
import { cn, relativeTime } from "@/lib/utils";
import { useToastActions } from "@/context/ToastContext";
import { MilkdownEditor, type MilkdownEditorHandle } from "./MilkdownEditor";

type CompanyKnowledgeScope = {
  kind: "company";
  companyId: string;
  companyName?: string | null;
};

type ProjectKnowledgeScope = {
  kind: "project";
  companyId: string;
  projectId: string;
  projectName: string;
  projectColor?: string | null;
};

type KnowledgeWorkspaceProps = {
  scope: CompanyKnowledgeScope | ProjectKnowledgeScope;
};

function newDocumentTitle(scope: KnowledgeWorkspaceProps["scope"], t: (key: string) => string) {
  return scope.kind === "company" ? t("Company overview") : t("Project overview");
}

function scopeLabel(scope: KnowledgeWorkspaceProps["scope"], t: (key: string) => string) {
  return scope.kind === "company" ? t("Company knowledge") : t("Project knowledge");
}

function scopeIcon(scope: KnowledgeWorkspaceProps["scope"]) {
  return scope.kind === "company" ? Building2 : FolderKanban;
}

export function KnowledgeWorkspace({ scope }: KnowledgeWorkspaceProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { pushToast } = useToastActions();
  const queryClient = useQueryClient();
  const editorRef = useRef<MilkdownEditorHandle | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  const listQueryKey = useMemo(
    () => (
      scope.kind === "company"
        ? queryKeys.knowledge.companyList(scope.companyId)
        : queryKeys.knowledge.projectList(scope.projectId)
    ),
    [scope],
  );

  const listQuery = useQuery({
    queryKey: listQueryKey,
    queryFn: () => (
      scope.kind === "company"
        ? knowledgeApi.listCompany(scope.companyId)
        : knowledgeApi.listProject(scope.projectId)
    ),
  });

  const docs = listQuery.data ?? [];

  useEffect(() => {
    setSelectedDocId(null);
    setDraftTitle("");
  }, [scope.kind, scope.kind === "company" ? scope.companyId : scope.projectId]);

  useEffect(() => {
    if (docs.length === 0) {
      setSelectedDocId(null);
      return;
    }
    if (!selectedDocId || !docs.some((doc) => doc.id === selectedDocId)) {
      setSelectedDocId(docs[0]?.id ?? null);
    }
  }, [docs, selectedDocId]);

  const detailQueryKey = selectedDocId
    ? scope.kind === "company"
      ? queryKeys.knowledge.companyDoc(scope.companyId, selectedDocId)
      : queryKeys.knowledge.projectDoc(scope.projectId, selectedDocId)
    : ["knowledge", "detail", "__empty__"] as const;

  const detailQuery = useQuery({
    queryKey: detailQueryKey,
    queryFn: () => {
      if (!selectedDocId) throw new Error("No knowledge document selected.");
      return scope.kind === "company"
        ? knowledgeApi.getCompany(scope.companyId, selectedDocId)
        : knowledgeApi.getProject(scope.projectId, selectedDocId);
    },
    enabled: Boolean(selectedDocId),
  });

  useEffect(() => {
    if (!detailQuery.data) return;
    setDraftTitle(detailQuery.data.title);
  }, [detailQuery.data?.id, detailQuery.data?.title]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const title = newDocumentTitle(scope, t);
      return scope.kind === "company"
        ? knowledgeApi.createCompany(scope.companyId, { title, body: `# ${title}\n\n` })
        : knowledgeApi.createProject(scope.projectId, { title, body: `# ${title}\n\n` });
    },
    onSuccess: async (created) => {
      setSelectedDocId(created.id);
      setDraftTitle(created.title);
      await queryClient.invalidateQueries({ queryKey: listQueryKey });
      queryClient.setQueryData(
        scope.kind === "company"
          ? queryKeys.knowledge.companyDoc(scope.companyId, created.id)
          : queryKeys.knowledge.projectDoc(scope.projectId, created.id),
        created,
      );
      pushToast({ title: t("Created knowledge document"), body: created.title, tone: "success" });
    },
    onError: (error) => {
      pushToast({
        title: t("Could not create knowledge document"),
        body: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDocId || !detailQuery.data) {
        throw new Error(t("Choose a document"));
      }
      const body = editorRef.current?.getMarkdown() ?? detailQuery.data.body;
      const title = draftTitle.trim() || detailQuery.data.title;
      return scope.kind === "company"
        ? knowledgeApi.updateCompany(scope.companyId, selectedDocId, { title, body })
        : knowledgeApi.updateProject(scope.projectId, selectedDocId, { title, body });
    },
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: listQueryKey }),
        queryClient.invalidateQueries({ queryKey: detailQueryKey }),
      ]);
      setDraftTitle(saved.title);
      pushToast({ title: t("Saved knowledge document"), body: saved.title, tone: "success" });
    },
    onError: (error) => {
      pushToast({
        title: t("Could not save knowledge document"),
        body: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    },
  });

  const ScopeIcon = scopeIcon(scope);
  const currentDoc = detailQuery.data ?? null;
  const countLabel = `${docs.length}`;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card px-4 py-3 shadow-xs">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ScopeIcon className="h-4 w-4 text-muted-foreground" />
              <h1 className="text-sm font-medium">{scopeLabel(scope, t)}</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {scope.kind === "company"
                ? t("Company-wide notes, SOPs, integration checklists, and shared context live here.")
                : t("Project-specific architecture notes, launch steps, and implementation memory live here.")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline">{countLabel} {t("Documents")}</Badge>
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              <Plus className="h-4 w-4" />
              {createMutation.isPending ? t("Creating...") : t("New document")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !currentDoc}
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? t("Saving...") : t("Save")}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
          <div className="border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <BookOpenText className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">{t("Knowledge library")}</h2>
            </div>
          </div>
          <ScrollArea className="h-[72vh]">
            <div className="space-y-2 p-3">
              {listQuery.isLoading ? (
                <div className="rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">
                  {t("Loading knowledge documents...")}
                </div>
              ) : docs.length === 0 ? (
                <div className="rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">
                  <div className="font-medium text-foreground">{t("No documents yet")}</div>
                  <div className="mt-1">{t("Create the first note, SOP, or architecture page for this scope.")}</div>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => createMutation.mutate()}>
                    <Plus className="h-4 w-4" />
                    {t("Create first document")}
                  </Button>
                </div>
              ) : (
                docs.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setSelectedDocId(doc.id)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                      selectedDocId === doc.id
                        ? "border-primary/40 bg-primary/5"
                        : "border-border hover:bg-accent/40",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{doc.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {relativeTime(doc.updatedAt)}
                        </div>
                        {doc.summary ? (
                          <div className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">{doc.summary}</div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="space-y-4">
          {detailQuery.isLoading && currentDoc === null ? (
            <div className="rounded-2xl border bg-card px-4 py-8 text-sm text-muted-foreground shadow-xs">
              {t("Loading knowledge document...")}
            </div>
          ) : currentDoc ? (
            <>
              <div className="rounded-2xl border bg-card px-4 py-3 shadow-xs">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {scope.kind === "company" ? (scope.companyName ?? t("Company")) : scope.projectName}
                    </Badge>
                    <Badge variant="outline">{t("Updated")} · {relativeTime(currentDoc.updatedAt)}</Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("Document title")}</div>
                    <Input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
                  </div>
                </div>
              </div>

              <MilkdownEditor
                ref={editorRef}
                key={`${currentDoc.id}:${String(currentDoc.updatedAt)}`}
                editorKey={`${currentDoc.id}:${String(currentDoc.updatedAt)}`}
                initialMarkdown={currentDoc.body}
                theme={theme}
              />
            </>
          ) : (
            <div className="rounded-2xl border border-dashed bg-card px-4 py-10 text-sm text-muted-foreground shadow-xs">
              {t("Choose a document")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
