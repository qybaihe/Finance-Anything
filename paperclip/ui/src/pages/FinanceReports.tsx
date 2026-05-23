import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileText,
  RefreshCw,
  Search,
} from "lucide-react";
import { financeApi, type FinanceReportEntry, type FinanceReportSource } from "../api/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useSearchParams } from "@/lib/router";
import { queryKeys } from "../lib/queryKeys";
import { cn, relativeTime } from "../lib/utils";

type ReportFilter = "all" | "ready" | "pending";

function statusText(status: string) {
  if (status === "done") return "已完成";
  if (status === "in_progress") return "生成中";
  if (status === "todo") return "排队中";
  if (status === "blocked") return "已阻塞";
  return status;
}

function sourceKindText(source: FinanceReportSource | null) {
  if (!source) return "等待 HTML";
  if (source.kind === "attachment") return "HTML 附件";
  if (source.kind === "work_product") return "HTML 产物";
  return "报告索引";
}

function sourceHref(source: FinanceReportSource | null, report: FinanceReportEntry) {
  if (!source) return report.issuePath;
  return source.url ?? report.issuePath;
}

function canEmbed(source: FinanceReportSource | null) {
  if (!source?.url) return false;
  if (source.kind === "attachment") return (source.contentType ?? "").toLowerCase().startsWith("text/html");
  return source.url.startsWith("/") && /\.html?(?:$|[?#])/i.test(source.url);
}

function reportScoreLabel(report: FinanceReportEntry) {
  if (report.reportStatus === "ready") return `${report.sourceCount} 份 HTML 报告`;
  if (report.issueStatus === "done") return "等待归档";
  return "等待 HTML 报告";
}

function ReportPreview({ report }: { report: FinanceReportEntry | null }) {
  const source = report?.primarySource ?? null;
  if (!report) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center rounded-md border border-dashed border-border bg-card text-sm text-muted-foreground">
        选择一份决策报告
      </div>
    );
  }

  return (
    <section className="min-h-[520px] overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{report.issueIdentifier ?? report.issueId.slice(0, 8)}</span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span>{sourceKindText(source)}</span>
          </div>
          <h2 className="mt-1 truncate text-base font-semibold">{source?.title ?? report.issueTitle}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to={report.issuePath}>
              <FileText className="h-3.5 w-3.5" />
              决策记录
            </Link>
          </Button>
          {source?.url ? (
            <Button asChild size="sm" className="gap-1.5">
              <a href={sourceHref(source, report)} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                打开 HTML
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      {canEmbed(source) ? (
        <iframe
          title={source?.title ?? report.issueTitle}
          src={source?.url ?? undefined}
          className="h-[76vh] min-h-[620px] w-full bg-background"
          sandbox="allow-same-origin allow-popups allow-forms"
        />
      ) : source?.url ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 px-6 text-center">
          <FileCheck2 className="h-10 w-10 text-primary" />
          <div>
            <p className="text-sm font-medium">报告产物已就绪</p>
            <p className="mt-1 text-xs text-muted-foreground">此 HTML 报告会在新窗口打开。</p>
          </div>
          <Button asChild className="gap-1.5">
            <a href={source.url} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              打开 HTML
            </a>
          </Button>
        </div>
      ) : (
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 px-6 text-center">
          <Clock3 className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">HTML 报告还在生成中</p>
            <p className="mt-1 text-xs text-muted-foreground">报告 Agent 上传 HTML 文件后会自动在这里预览。</p>
          </div>
        </div>
      )}
    </section>
  );
}

export function FinanceReports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<ReportFilter>("all");
  const [search, setSearch] = useState("");
  const selectedIssueId = searchParams.get("issueId");

  const reportsQuery = useQuery({
    queryKey: queryKeys.finance.reports,
    queryFn: () => financeApi.reports(80),
    refetchInterval: 10_000,
  });

  const reports = reportsQuery.data?.reports ?? [];
  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reports.filter((report) => {
      if (filter !== "all" && report.reportStatus !== filter) return false;
      if (!query) return true;
      return [
        report.issueTitle,
        report.issueIdentifier,
        report.primarySource?.title,
        report.primarySource?.summary,
      ].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [filter, reports, search]);

  const activeReport = useMemo(() => {
    return filteredReports.find((report) => report.issueId === selectedIssueId)
      ?? filteredReports[0]
      ?? null;
  }, [filteredReports, selectedIssueId]);

  useEffect(() => {
    if (!activeReport || activeReport.issueId === selectedIssueId) return;
    setSearchParams({ issueId: activeReport.issueId }, { replace: true });
  }, [activeReport, selectedIssueId, setSearchParams]);

  const detailQuery = useQuery({
    queryKey: activeReport ? queryKeys.finance.report(activeReport.issueId) : ["finance", "reports", "__idle__"],
    queryFn: () => financeApi.report(activeReport!.issueId),
    enabled: Boolean(activeReport),
    refetchInterval: activeReport?.reportStatus === "pending" ? 10_000 : false,
  });

  const detailedReport = detailQuery.data?.report ?? activeReport;
  const readyCount = reports.filter((report) => report.reportStatus === "ready").length;
  const pendingCount = reports.length - readyCount;

  return (
    <div className="min-h-full bg-[#f8fafc] dark:bg-background/95">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-4 pb-24 pt-4 sm:py-6 lg:px-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded bg-emerald-500/10 p-1">
                <FileCheck2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h1 className="text-lg font-bold tracking-tight sm:text-xl">最终报告</h1>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">每一次决策的 HTML 报告都会沉淀在这里。</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs sm:w-[360px]">
            <div className="rounded-md border bg-card px-3 py-2">
              <div className="text-muted-foreground">总决策</div>
              <div className="mt-1 text-base font-semibold">{reports.length}</div>
            </div>
            <div className="rounded-md border bg-card px-3 py-2">
              <div className="text-muted-foreground">可查看</div>
              <div className="mt-1 text-base font-semibold text-emerald-600">{readyCount}</div>
            </div>
            <div className="rounded-md border bg-card px-3 py-2">
              <div className="text-muted-foreground">生成中</div>
              <div className="mt-1 text-base font-semibold text-amber-600">{pendingCount}</div>
            </div>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[410px_minmax(0,1fr)]">
          <section className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
            <div className="border-b bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="搜索决策或报告"
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => reportsQuery.refetch()}
                  aria-label="刷新报告"
                  title="刷新报告"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", reportsQuery.isFetching && "animate-spin")} />
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1 rounded-md bg-background p-1">
                {([
                  ["all", "全部"],
                  ["ready", "可查看"],
                  ["pending", "生成中"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={cn(
                      "h-7 rounded text-xs font-medium text-muted-foreground transition",
                      filter === value && "bg-foreground text-background shadow-sm",
                    )}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[72vh] divide-y divide-border overflow-y-auto">
              {reportsQuery.isError ? (
                <div className="flex items-center gap-2 px-4 py-5 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  报告列表加载失败
                </div>
              ) : reportsQuery.isLoading ? (
                <div className="px-4 py-5 text-sm text-muted-foreground">正在加载报告...</div>
              ) : filteredReports.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">暂无匹配报告</div>
              ) : (
                filteredReports.map((report) => {
                  const selected = activeReport?.issueId === report.issueId;
                  return (
                    <button
                      key={report.issueId}
                      type="button"
                      className={cn(
                        "block w-full px-4 py-3 text-left transition hover:bg-muted/40",
                        selected && "bg-primary/5",
                      )}
                      onClick={() => setSearchParams({ issueId: report.issueId })}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="font-mono">{report.issueIdentifier ?? report.issueId.slice(0, 8)}</span>
                            <span className="h-1 w-1 rounded-full bg-border" />
                            <span>{statusText(report.issueStatus)}</span>
                          </div>
                          <div className="mt-1 line-clamp-2 text-sm font-semibold">{report.issueTitle}</div>
                          <div className="mt-1 truncate text-xs text-muted-foreground">
                            {report.primarySource?.title ?? reportScoreLabel(report)}
                          </div>
                        </div>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold",
                            report.reportStatus === "ready"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                          )}
                        >
                          {report.reportStatus === "ready" ? <CheckCircle2 className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                          {report.reportStatus === "ready" ? "已归档" : "待生成"}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{sourceKindText(report.primarySource)}</span>
                        <span>{relativeTime(report.updatedAt)}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <ReportPreview report={detailedReport} />
        </div>
      </div>
    </div>
  );
}
