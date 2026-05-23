import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Command,
  Cpu,
  FileText,
  Layers,
  Play,
  ShieldCheck,
  Terminal,
  TrendingUp,
} from "lucide-react";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { financeApi } from "../api/finance";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { useNavigate } from "../lib/router";
import { queryKeys } from "../lib/queryKeys";

const EXAMPLE_GOALS = [
  "买入某只股票的投资可行性分析",
  "二手设备残值评估与购入建议",
  "同预算下多款金融产品的对比决策",
];

function formatAgentCount(count: number | undefined) {
  if (count === undefined) return "--";
  return String(count);
}

export function FinanceHome() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedCompany, setSelectedCompanyId, reloadCompanies } = useCompany();
  const [goalText, setGoalText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const bootstrapQuery = useQuery({
    queryKey: queryKeys.finance.bootstrap,
    queryFn: () => financeApi.bootstrap(),
    retry: 1,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const company = bootstrapQuery.data?.company ?? selectedCompany;
  const agentQuery = useQuery({
    queryKey: company ? queryKeys.agents.list(company.id) : ["agents", "finance", "pending"],
    queryFn: () => agentsApi.list(company!.id),
    enabled: Boolean(company),
    staleTime: 15_000,
  });

  useEffect(() => {
    const nextCompany = bootstrapQuery.data?.company;
    if (!nextCompany) return;
    setSelectedCompanyId(nextCompany.id, { source: "bootstrap" });
    void reloadCompanies();
  }, [bootstrapQuery.data?.company, reloadCompanies, setSelectedCompanyId]);

  const readyAgents = useMemo(
    () => (agentQuery.data ?? []).filter((agent) => agent.status !== "terminated"),
    [agentQuery.data],
  );

  const recentDecisionQuery = useQuery({
    queryKey: company && bootstrapQuery.data?.projectId
      ? queryKeys.issues.listByProject(company.id, bootstrapQuery.data.projectId)
      : ["issues", "finance", "recent", "pending"],
    queryFn: () => issuesApi.list(company!.id, { projectId: bootstrapQuery.data!.projectId, limit: 10 }),
    enabled: Boolean(company && bootstrapQuery.data?.projectId),
    staleTime: 15_000,
  });

  const recentDecisions = useMemo(
    () => [...(recentDecisionQuery.data ?? [])]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 6),
    [recentDecisionQuery.data],
  );

  const createIssueMutation = useMutation({
    mutationFn: async () => {
      const title = goalText.trim();
      if (!title) throw new Error("请先输入你的决策目标");
      return financeApi.startDecision({ goal: title });
    },
    onSuccess: async (result) => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(result.company.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.issues.listByProject(result.company.id, result.projectId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.liveRuns(result.company.id) });
      navigate(result.issuePath);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "启动失败，请稍后重试");
    },
  });

  const canStart =
    goalText.trim().length > 0 &&
    Boolean(company) &&
    Boolean(bootstrapQuery.data?.defaultAgentId) &&
    !createIssueMutation.isPending;

  if (bootstrapQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <div className="text-sm font-medium text-muted-foreground">初始化 Finance Anything 环境...</div>
        </div>
      </div>
    );
  }

  if (bootstrapQuery.isError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-md border border-destructive/20 bg-destructive/5 p-6">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <h1 className="font-semibold">工作空间加载失败</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {bootstrapQuery.error instanceof Error ? bootstrapQuery.error.message : "连接到金融决策引擎时发生错误。请检查网络或联系管理员。"}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            重试
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#f8fafc] dark:bg-background/95">
      <div className="mx-auto max-w-[1280px] px-4 py-4 sm:py-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded bg-emerald-500/10 p-1">
                <CircleDollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">金融决策中心</h1>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">金融智能体协同决策系统 v2.5</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden h-9 items-center gap-4 rounded-md border bg-card px-4 text-xs font-medium sm:flex">
              <div className="flex items-center gap-1.5 border-r pr-4">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-muted-foreground uppercase tracking-wider">引擎：</span>
                <span>就绪</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground uppercase tracking-wider">智能体：</span>
                <span>{formatAgentCount(bootstrapQuery.data?.agentCount)} 在线</span>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
              <div className="flex min-w-0 items-center justify-between gap-3 border-b bg-muted/30 px-4 py-2.5">
                <div className="flex shrink-0 items-center gap-2 text-sm font-semibold">
                  <Terminal className="h-4 w-4 text-primary" />
                  <span>决策指令下达</span>
                </div>
                <div className="flex min-w-0 items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <div className="flex min-w-0 items-center gap-1">
                    <Layers className="h-3 w-3" />
                    <span className="truncate">项目：{bootstrapQuery.data?.projectId || "默认"}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5">
                <div className="relative">
                  <Textarea
                    id="finance-decision-input"
                    value={goalText}
                    onChange={(event) => setGoalText(event.target.value)}
                    placeholder="请输入你的决策目标，例如：我是否应该在这个价格买入特斯拉股票？包含预算、时间、风险偏好效果更佳。"
                    className="min-h-[160px] resize-none border-none bg-muted/20 p-4 text-base focus-visible:ring-0 sm:min-h-[180px]"
                  />
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">快速指令预设</p>
                  <div className="flex flex-wrap gap-2">
                    {EXAMPLE_GOALS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="rounded border border-border bg-background px-3 py-1.5 text-left text-xs text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                        onClick={() => setGoalText(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                {error ? (
                  <div className="mt-4 flex items-center gap-2 rounded border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {error}
                  </div>
                ) : null}

                <div className="mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                    <Cpu className="h-3.5 w-3.5" />
                    <span>总规划师自动接手并并行派发任务</span>
                  </div>
                  <Button
                    type="button"
                    disabled={!canStart}
                    onClick={() => createIssueMutation.mutate()}
                    className="h-10 w-full gap-2 px-6 sm:w-auto"
                  >
                    {createIssueMutation.isPending ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current" />
                    )}
                    {createIssueMutation.isPending ? "引擎启动中..." : "启动决策引擎"}
                  </Button>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Activity className="h-4 w-4 text-primary" />
                  <span>最近决策动态</span>
                </div>
                <Link to="/issues" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                  查看全部 <ChevronRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="divide-y divide-border">
                {recentDecisions.length > 0 ? recentDecisions.map((issue) => (
                  <Link
                    key={issue.id}
                    to={`/issues/${issue.identifier ?? issue.id}`}
                    className="group block px-4 py-3 transition hover:bg-muted/30"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 whitespace-nowrap text-[10px] font-mono font-medium text-muted-foreground">
                            #{issue.identifier ?? issue.id.slice(0, 8)}
                          </span>
                          <span className="h-1 w-1 rounded-full bg-border" />
                          <span className="truncate text-sm font-medium group-hover:text-primary transition-colors">
                            {issue.title}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span>{new Date(issue.updatedAt).toLocaleDateString()}</span>
                          <span className="flex items-center gap-1">
                            <BrainCircuit className="h-3 w-3" />
                            {(issue.assigneeAgentId || issue.assigneeUserId) ? "已分配智能体" : "自动分发"}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <div className={`
                          flex h-6 items-center rounded px-2 text-[10px] font-semibold uppercase tracking-wider
                          ${issue.status === "done" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                            issue.status === "in_progress" ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" :
                            "bg-muted text-muted-foreground"}
                        `}>
                          {issue.status === "todo" ? "待处理" : issue.status === "in_progress" ? "进行中" : issue.status === "done" ? "已完成" : issue.status}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </Link>
                )) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Command className="h-8 w-8 text-muted/40 mb-2" />
                    <p className="text-sm text-muted-foreground">暂无历史决策记录</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <div className="rounded-md border border-border bg-card shadow-sm overflow-hidden">
              <div className="bg-muted/30 border-b px-4 py-2.5">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">决策环境概览</h2>
              </div>

              <div className="p-4 space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <TrendingUp className="h-3.5 w-3.5" />
                    核心模型
                  </div>
                  <div className="rounded border bg-muted/20 px-3 py-2">
                    <div className="text-sm font-bold">mimo-V2.5-Pro</div>
                    <div className="text-[10px] text-muted-foreground">金融深度推理引擎</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    协同机制
                  </div>
                  <div className="space-y-2">
                    {[
                      { icon: <CheckCircle2 className="h-3 w-3" />, text: "全栈信息自动化采集与聚合" },
                      { icon: <Cpu className="h-3 w-3" />, text: "多维度风险评估与对冲建议" },
                      { icon: <FileText className="h-3 w-3" />, text: "自动化生成 HTML 深度决策报告" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground leading-normal">
                        <div className="mt-0.5 text-primary">{item.icon}</div>
                        {item.text}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <BrainCircuit className="h-3.5 w-3.5" />
                      协同 Agent 队列
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                      {readyAgents.length} 就绪
                    </span>
                  </div>

                  <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
                    {readyAgents.length > 0 ? readyAgents.map((agent) => (
                      <div
                        key={agent.id}
                        className="flex items-center gap-3 rounded border border-border/50 bg-background/50 px-3 py-2 shadow-sm"
                      >
                        <div className="relative">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                            {agent.name.slice(0, 1)}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-bold">{agent.name}</div>
                          <div className="truncate text-[9px] text-muted-foreground uppercase tracking-tighter">
                            {agent.title || agent.role || "专项智能体"}
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                        正在扫描可用智能体...
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded border border-primary/10 bg-primary/5 p-3">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-primary mb-1">
                    <FileText className="h-3.5 w-3.5" />
                    交付物规格
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    决策引擎将汇总所有 Agent 的研究结论，生成包含图表、证据链和量化评分的 HTML 报告，并直接挂载至决策记录。
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
