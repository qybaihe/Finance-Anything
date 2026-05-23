import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, BrainCircuit, CheckCircle2, CircleDollarSign, FileText, Play, ShieldCheck, TrendingUp } from "lucide-react";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { financeApi } from "../api/finance";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { CreditRiskCalendarWall } from "../components/finance/CreditRiskCalendarWall";
import { CreditRiskDashboard } from "../components/finance/CreditRiskDashboard";
import { CreditRiskPet } from "../components/finance/CreditRiskPet";
import { buildCreditRiskWorkspace } from "../components/finance/creditRiskMock";
import { useCompany } from "../context/CompanyContext";
import { useNavigate } from "../lib/router";
import { queryKeys } from "../lib/queryKeys";

const EXAMPLE_GOALS = [
  "我现在适合买入某只股票吗？",
  "这台二手设备是否值得入手？",
  "同预算下哪一个商品更适合我？",
];

function formatAgentCount(count: number | undefined) {
  if (!count) return "准备中";
  return `${count} 个 Agent 已就绪`;
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
    queryFn: () => issuesApi.list(company!.id, { projectId: bootstrapQuery.data!.projectId, limit: 6 }),
    enabled: Boolean(company && bootstrapQuery.data?.projectId),
    staleTime: 15_000,
  });
  const recentDecisions = useMemo(
    () => [...(recentDecisionQuery.data ?? [])]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 4),
    [recentDecisionQuery.data],
  );
  const creditRiskWorkspace = useMemo(
    () => buildCreditRiskWorkspace(recentDecisions),
    [recentDecisions],
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
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="text-sm text-muted-foreground">正在准备你的 Finance Anything 工作空间...</div>
      </div>
    );
  }

  if (bootstrapQuery.isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
          <div>
            <h1 className="text-base font-semibold">工作空间没有准备成功</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {bootstrapQuery.error instanceof Error ? bootstrapQuery.error.message : "请稍后重试。"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-0 pb-4 pt-1 sm:px-4 sm:py-6 lg:px-6">
        <section className="rounded-md border border-border bg-card p-4 sm:p-7">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CircleDollarSign className="h-4 w-4 text-emerald-500" />
                <span>Finance Anything</span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-normal sm:text-3xl">你现在要决策什么？</h1>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:min-w-[280px]">
              <div className="rounded-md border border-border px-3 py-2">
                <div className="text-muted-foreground">协同团队</div>
                <div className="mt-1 font-medium leading-snug">{formatAgentCount(bootstrapQuery.data?.agentCount)}</div>
              </div>
              <div className="rounded-md border border-border px-3 py-2">
                <div className="text-muted-foreground">状态</div>
                <div className="mt-1 font-medium">可启动</div>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border/80 bg-background/60 p-3 sm:p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-cyan-500" />
                <h2 className="text-base font-semibold">提出一个目标</h2>
              </div>
              <CreditRiskPet snapshot={creditRiskWorkspace.snapshot} variant="inline" className="sm:max-w-[360px]" />
            </div>
            <Textarea
              id="finance-decision-input"
              value={goalText}
              onChange={(event) => setGoalText(event.target.value)}
              placeholder="例如：我是否应该在这个价格买入特斯拉股票？预算、时间、风险偏好也可以一起写。"
              className="min-h-44 resize-none text-base sm:min-h-52"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLE_GOALS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="max-w-full rounded-md border border-border px-3 py-1.5 text-left text-xs leading-snug text-muted-foreground transition hover:border-foreground/40 hover:text-foreground"
                  onClick={() => setGoalText(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
            <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {bootstrapQuery.data?.defaultAgentId ? "总规划师会自动接手并分配给其他 Agent。" : "正在等待总规划师就绪。"}
              </div>
              <Button
                type="button"
                disabled={!canStart}
                onClick={() => createIssueMutation.mutate()}
                className="h-11 w-full gap-2 sm:h-10 sm:w-auto"
              >
                <Play className="h-4 w-4" />
                {createIssueMutation.isPending ? "启动中..." : "开始决策"}
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <CreditRiskCalendarWall
            items={creditRiskWorkspace.calendarItems}
            snapshot={creditRiskWorkspace.snapshot}
          />
          <CreditRiskPet snapshot={creditRiskWorkspace.snapshot} />
        </section>

        <CreditRiskDashboard snapshot={creditRiskWorkspace.snapshot} />

        <main className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-md border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <h2 className="text-sm font-semibold">最近决策</h2>
              </div>
              <Link to="/issues" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                全部
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="mt-3 divide-y divide-border overflow-hidden rounded-md border border-border/70">
              {recentDecisions.length > 0 ? recentDecisions.map((issue) => (
                <Link
                  key={issue.id}
                  to={`/issues/${issue.identifier ?? issue.id}`}
                  className="block px-3 py-3 text-sm transition hover:bg-accent/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="line-clamp-2 font-medium">{issue.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{issue.identifier ?? issue.id.slice(0, 8)}</div>
                    </div>
                    <span className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                      {issue.status === "todo" ? "排队中" : issue.status === "in_progress" ? "进行中" : issue.status === "done" ? "已完成" : issue.status}
                    </span>
                  </div>
                </Link>
              )) : (
                <div className="px-3 py-4 text-sm text-muted-foreground">还没有决策记录。</div>
              )}
            </div>
          </section>

          <aside className="space-y-3 pb-2">
            <div className="rounded-md border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold">协同方式</h2>
              </div>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <div className="flex gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                  <span>信息采集、证据校验、风险、替代方案并行展开。</span>
                </div>
                <div className="flex gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-cyan-500" />
                  <span>股票、商品、二手价值等专项 Agent 按目标介入。</span>
                </div>
                <div className="flex gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" />
                  <span>最终报告 Agent 汇总为 HTML 决策报告。</span>
                </div>
              </div>
            </div>
            <div className="rounded-md border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-cyan-500" />
                <h2 className="text-sm font-semibold">协同 Agent</h2>
              </div>
              <div className="mt-3 max-h-none space-y-2 overflow-visible pr-0 lg:max-h-[320px] lg:overflow-auto lg:pr-1">
                {readyAgents.length > 0 ? readyAgents.map((agent) => (
                  <div key={agent.id} className="flex items-start gap-2 rounded-md border border-border/70 px-3 py-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{agent.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{agent.title || agent.role}</div>
                    </div>
                  </div>
                )) : (
                  <div className="text-sm text-muted-foreground">Agent 正在载入...</div>
                )}
              </div>
            </div>
            <div className="rounded-md border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-cyan-500" />
                <h2 className="text-sm font-semibold">默认模型</h2>
              </div>
              <p className="mt-2 break-words text-sm text-muted-foreground">mimo-V2.5pro</p>
            </div>
            <div className="rounded-md border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-500" />
                <h2 className="text-sm font-semibold">输出</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                最终报告智能体会把各 Agent 结论汇总成 HTML 报告文件，并附在刚创建的目标里。
              </p>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
