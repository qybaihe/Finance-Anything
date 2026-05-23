import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Bot,
  CalendarClock,
  Gauge,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { Link } from "@/lib/router";
import { CreditRiskCalendarWall } from "../components/finance/CreditRiskCalendarWall";
import { CreditRiskDashboard } from "../components/finance/CreditRiskDashboard";
import { CreditRiskPet } from "../components/finance/CreditRiskPet";
import { buildCreditRiskWorkspace } from "../components/finance/creditRiskMock";
import type {
  CreditCalendarMarkerKind,
  CreditCalendarMarkerSeverity,
  CreditRiskCalendarItem,
  CreditRiskLevel,
} from "../components/finance/creditRiskTypes";
import { formatRiskCurrency, formatRiskPercent } from "../components/finance/creditRiskFormat";
import { financeApi } from "../api/finance";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { cn } from "../lib/utils";
import { queryKeys } from "../lib/queryKeys";

const riskCopy: Record<CreditRiskLevel, {
  label: string;
  title: string;
  summary: string;
  toneClassName: string;
}> = {
  safe: {
    label: "安全",
    title: "信用边界稳定",
    summary: "当前现金缓冲可以覆盖近期还款，新增决策可正常比较收益和机会成本。",
    toneClassName: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  watch: {
    label: "观察",
    title: "近期还款密集",
    summary: "新增支出需要先确认自动扣款、现金余额和 Agent 给出的风险边界。",
    toneClassName: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300",
  },
  stress: {
    label: "承压",
    title: "现金缓冲偏薄",
    summary: "建议压低非必要风险敞口，优先处理 30 天内还款和固定支出。",
    toneClassName: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/70 dark:bg-orange-950/40 dark:text-orange-300",
  },
  danger: {
    label: "警戒",
    title: "杠杆风险过高",
    summary: "先处理逾期、还款和现金缺口，再让 Agent 评估新的决策机会。",
    toneClassName: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300",
  },
};

const kindLabel: Record<CreditCalendarMarkerKind, string> = {
  repayment_due: "还款",
  risk_warning: "预警",
  agent_conclusion: "Agent 结论",
  asset_capacity: "额度",
  manual_note: "提醒",
};

const severityLabel: Record<CreditCalendarMarkerSeverity, string> = {
  low: "低",
  medium: "中",
  high: "高",
  critical: "急",
};

const severityRank: Record<CreditCalendarMarkerSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const riskSteps: Array<{ level: CreditRiskLevel; label: string }> = [
  { level: "safe", label: "安全" },
  { level: "watch", label: "观察" },
  { level: "stress", label: "承压" },
  { level: "danger", label: "警戒" },
];

function formatDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function MetricCell({
  label,
  value,
  detail,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof ShieldCheck;
  tone?: "default" | "good" | "watch" | "danger";
}) {
  const toneClassName = {
    default: "text-muted-foreground",
    good: "text-emerald-600",
    watch: "text-amber-600",
    danger: "text-red-600",
  }[tone];

  return (
    <div className="min-w-0 px-3 py-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", toneClassName)} />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 truncate text-xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 truncate text-[11px] text-muted-foreground">{detail}</div>
    </div>
  );
}

function PriorityEvent({ item }: { item: CreditRiskCalendarItem }) {
  const severityClassName = item.severity === "critical"
    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
    : item.severity === "high"
      ? "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/70 dark:bg-orange-950/40 dark:text-orange-300"
      : item.severity === "medium"
        ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300"
        : "border-border bg-muted/60 text-muted-foreground";

  return (
    <div className="flex min-w-0 items-start gap-3 border-b border-border py-3 last:border-b-0">
      <div className="w-11 shrink-0 rounded-md border border-border px-2 py-1 text-center">
        <div className="text-xs font-semibold tabular-nums">{formatDate(item.date)}</div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">{kindLabel[item.kind]}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-sm font-medium">{item.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className={cn("rounded-md border px-1.5 py-0.5", severityClassName)}>
            {severityLabel[item.severity]}
          </span>
          {item.amountCents !== undefined ? <span>{formatRiskCurrency(item.amountCents, item.currency)}</span> : null}
        </div>
        {item.summary ? <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.summary}</div> : null}
      </div>
    </div>
  );
}

export function FinanceRiskWorkbench() {
  const { selectedCompany, setSelectedCompanyId, reloadCompanies } = useCompany();
  const bootstrapQuery = useQuery({
    queryKey: queryKeys.finance.bootstrap,
    queryFn: () => financeApi.bootstrap(),
    retry: 1,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const company = bootstrapQuery.data?.company ?? selectedCompany;

  useEffect(() => {
    const nextCompany = bootstrapQuery.data?.company;
    if (!nextCompany) return;
    setSelectedCompanyId(nextCompany.id, { source: "bootstrap" });
    void reloadCompanies();
  }, [bootstrapQuery.data?.company, reloadCompanies, setSelectedCompanyId]);

  const recentDecisionQuery = useQuery({
    queryKey: company && bootstrapQuery.data?.projectId
      ? queryKeys.issues.listByProject(company.id, bootstrapQuery.data.projectId)
      : ["issues", "finance", "credit-risk", "pending"],
    queryFn: () => issuesApi.list(company!.id, { projectId: bootstrapQuery.data!.projectId, limit: 8 }),
    enabled: Boolean(company && bootstrapQuery.data?.projectId),
    staleTime: 15_000,
  });

  const recentDecisions = useMemo(
    () => [...(recentDecisionQuery.data ?? [])]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 6),
    [recentDecisionQuery.data],
  );

  const workspace = useMemo(() => buildCreditRiskWorkspace(recentDecisions), [recentDecisions]);
  const { snapshot, calendarItems } = workspace;
  const currentRisk = riskCopy[snapshot.riskLevel];
  const currentStepIndex = riskSteps.findIndex((step) => step.level === snapshot.riskLevel);

  const priorityItems = useMemo(
    () => [...calendarItems]
      .sort((a, b) => {
        const severityDelta = severityRank[b.severity] - severityRank[a.severity];
        return severityDelta || a.date.localeCompare(b.date);
      })
      .slice(0, 5),
    [calendarItems],
  );
  const agentMarkers = useMemo(
    () => calendarItems.filter((item) => item.kind === "agent_conclusion").slice(0, 5),
    [calendarItems],
  );

  if (bootstrapQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="text-sm text-muted-foreground">正在准备信用风控工作台...</div>
      </div>
    );
  }

  if (bootstrapQuery.isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
          <div>
            <h1 className="text-base font-semibold">信用风控工作台没有准备成功</h1>
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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-0 pb-4 pt-1 sm:px-4 sm:py-6 lg:px-6">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 rounded-md border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>信用风控工作台</span>
                  <span className={cn("rounded-md border px-2 py-0.5 text-xs", currentRisk.toneClassName)}>
                    {currentRisk.label}
                  </span>
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-normal sm:text-3xl">{currentRisk.title}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{currentRisk.summary}</p>
              </div>
              <Link
                to="/finance"
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-foreground/40 hover:text-foreground"
              >
                回到决策提问
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-5 overflow-hidden rounded-md border border-border">
              <div className="grid divide-y divide-border sm:grid-cols-4 sm:divide-x sm:divide-y-0">
                <MetricCell
                  label="风险分"
                  value={`${snapshot.riskScore}`}
                  detail="当前评估"
                  icon={Gauge}
                  tone={snapshot.riskScore >= 80 ? "danger" : snapshot.riskScore >= 60 ? "watch" : "good"}
                />
                <MetricCell
                  label="可承受风险额度"
                  value={formatRiskCurrency(snapshot.riskCapacityCents)}
                  detail="流动资产折扣估算"
                  icon={ShieldCheck}
                  tone={snapshot.riskCapacityCents < 500_000 ? "danger" : "good"}
                />
                <MetricCell
                  label="30 天还款"
                  value={formatRiskCurrency(snapshot.future30DayRepaymentCents)}
                  detail={`收入占比 ${formatRiskPercent(snapshot.repaymentPressureRatio)}`}
                  icon={Banknote}
                  tone={snapshot.repaymentPressureRatio > 0.4 ? "watch" : "default"}
                />
                <MetricCell
                  label="现金缓冲"
                  value={`${snapshot.bufferMonths.toFixed(1)} 月`}
                  detail={formatRiskCurrency(snapshot.liquidAssetsCents)}
                  icon={WalletCards}
                  tone={snapshot.bufferMonths < 3 ? "watch" : "good"}
                />
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>风控状态轨道</span>
                <span>估算口径，不等同银行授信</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {riskSteps.map((step, index) => (
                  <div
                    key={step.level}
                    className={cn(
                      "h-2 rounded-sm bg-muted",
                      index <= currentStepIndex && snapshot.riskLevel === "safe" && "bg-emerald-500",
                      index <= currentStepIndex && snapshot.riskLevel === "watch" && "bg-amber-500",
                      index <= currentStepIndex && snapshot.riskLevel === "stress" && "bg-orange-500",
                      index <= currentStepIndex && snapshot.riskLevel === "danger" && "bg-red-500",
                    )}
                    title={step.label}
                  />
                ))}
              </div>
              <div className="mt-1 grid grid-cols-4 gap-1.5 text-[10px] text-muted-foreground">
                {riskSteps.map((step) => <span key={step.level}>{step.label}</span>)}
              </div>
            </div>
          </div>

          <CreditRiskPet snapshot={snapshot} className="h-full min-w-0" />
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <CreditRiskCalendarWall items={calendarItems} snapshot={snapshot} />

          <aside className="min-w-0 rounded-md border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-cyan-600" />
                <h2 className="text-sm font-semibold">今日守护动作</h2>
              </div>
              <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                {priorityItems.length} 项
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">按严重程度和日期排序，优先处理会影响决策边界的事项。</p>
            <div className="mt-3">
              {priorityItems.map((item) => <PriorityEvent key={item.id} item={item} />)}
            </div>
          </aside>
        </section>

        <CreditRiskDashboard snapshot={snapshot} />

        <section className="min-w-0 rounded-md border border-border bg-card p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-violet-600" />
                <h2 className="text-sm font-semibold">Agent 结论沉淀</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">最近的决策结果会回写为日历标志，后续可升级为结构化 metadata。</p>
            </div>
            <Link to="/issues" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              查看历史
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-3 divide-y divide-border overflow-hidden rounded-md border border-border">
            {agentMarkers.map((item) => {
              const content = (
                <div className="flex min-w-0 items-start justify-between gap-3 px-3 py-3 text-sm transition hover:bg-accent/50">
                  <div className="min-w-0">
                    <div className="line-clamp-2 font-medium">{item.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDate(item.date)} · {severityLabel[item.severity]}严重度
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                    {item.issueIdentifier ?? "system"}
                  </span>
                </div>
              );

              if (item.issueIdentifier ?? item.issueId) {
                return (
                  <Link key={item.id} to={`/issues/${item.issueIdentifier ?? item.issueId}`}>
                    {content}
                  </Link>
                );
              }

              return <div key={item.id}>{content}</div>;
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
