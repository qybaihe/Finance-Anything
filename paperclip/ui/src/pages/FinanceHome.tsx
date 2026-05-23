import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, BrainCircuit, CircleDollarSign, FileText, Play, ShieldCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { financeApi } from "../api/finance";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
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

  const createIssueMutation = useMutation({
    mutationFn: async () => {
      if (!company || !bootstrapQuery.data?.projectId || !bootstrapQuery.data.goalId) {
        throw new Error("工作空间还没有准备好");
      }
      const title = goalText.trim();
      if (!title) throw new Error("请先输入你的决策目标");
      const issue = await issuesApi.create(company.id, {
        title,
        description: [
          "这是 Finance Anything 的用户决策目标。",
          "",
          "请多 Agent 协同完成信息采集、证据校验、替代方案、成本收益、风险、场景模拟、反方辩论、二手价值分析，并由决策报告 Agent 输出最终决策报告。",
          "",
          "最终报告要求：必须生成一份可打开的 HTML 报告文件并上传到本目标，报告需要综合各 Agent 结论、关键证据、分歧、评分、风险控制、执行条件和复盘计划。",
        ].join("\n"),
        status: "todo",
        priority: "high",
        assigneeAgentId: bootstrapQuery.data.defaultAgentId,
        projectId: bootstrapQuery.data.projectId,
        goalId: bootstrapQuery.data.goalId,
      });
      return issue;
    },
    onSuccess: async (issue) => {
      setError(null);
      if (company) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(company.id) });
        await queryClient.invalidateQueries({ queryKey: queryKeys.liveRuns(company.id) });
      }
      navigate(`/issues/${issue.identifier ?? issue.id}`);
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
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 lg:px-6">
        <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CircleDollarSign className="h-4 w-4 text-emerald-500" />
              <span>Finance Anything</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal">万能决策助手</h1>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
            <div className="rounded-md border border-border px-3 py-2">
              <div className="text-muted-foreground">工作空间</div>
              <div className="mt-1 font-medium">{company?.name ?? "准备中"}</div>
            </div>
            <div className="rounded-md border border-border px-3 py-2">
              <div className="text-muted-foreground">协同团队</div>
              <div className="mt-1 font-medium">{formatAgentCount(bootstrapQuery.data?.agentCount)}</div>
            </div>
            <div className="rounded-md border border-border px-3 py-2">
              <div className="text-muted-foreground">状态</div>
              <div className="mt-1 font-medium">可启动</div>
            </div>
          </div>
        </header>

        <main className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-md border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-cyan-500" />
              <h2 className="text-base font-semibold">提出一个目标</h2>
            </div>
            <Textarea
              value={goalText}
              onChange={(event) => setGoalText(event.target.value)}
              placeholder="例如：我是否应该在这个价格买入特斯拉股票？"
              className="min-h-40 resize-none text-base"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLE_GOALS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-foreground/40 hover:text-foreground"
                  onClick={() => setGoalText(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {bootstrapQuery.data?.defaultAgentId ? "总规划师会自动接手并分配给其他 Agent。" : "正在等待总规划师就绪。"}
              </div>
              <Button
                type="button"
                disabled={!canStart}
                onClick={() => createIssueMutation.mutate()}
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                {createIssueMutation.isPending ? "启动中..." : "开始决策"}
              </Button>
            </div>
          </section>

          <aside className="space-y-3">
            <div className="rounded-md border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold">协同 Agent</h2>
              </div>
              <div className="mt-3 max-h-[360px] space-y-2 overflow-auto pr-1">
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
