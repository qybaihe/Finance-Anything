import { Activity, Banknote, BarChart3, CircleDollarSign, Gauge, Landmark, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CreditRiskSnapshot } from "./creditRiskTypes";
import { formatRiskCurrency, formatRiskPercent } from "./creditRiskFormat";

type CreditRiskDashboardProps = {
  snapshot: CreditRiskSnapshot;
};

type MetricProps = {
  label: string;
  value: string;
  detail: string;
  icon: typeof CircleDollarSign;
  tone?: "default" | "good" | "watch" | "danger";
};

const toneClassName: Record<NonNullable<MetricProps["tone"]>, string> = {
  default: "text-muted-foreground",
  good: "text-emerald-600",
  watch: "text-amber-600",
  danger: "text-red-600",
};

function Metric({ label, value, detail, icon: Icon, tone = "default" }: MetricProps) {
  return (
    <div className="min-w-0 border border-border px-3 py-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", toneClassName[tone])} />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 truncate text-lg font-semibold tabular-nums">{value}</div>
      <div className="mt-1 truncate text-[11px] text-muted-foreground">{detail}</div>
    </div>
  );
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, Math.round(value * 100)));
}

function AssetStack({ snapshot }: CreditRiskDashboardProps) {
  const liquidPct = clampPercent(snapshot.liquidAssetsCents / snapshot.totalAssetsCents);
  const liabilityPct = clampPercent(snapshot.totalLiabilitiesCents / snapshot.totalAssetsCents);
  const stablePct = Math.max(0, 100 - liquidPct);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium">资产 / 负债分布</span>
        <span className="text-muted-foreground">负债率 {formatRiskPercent(snapshot.debtToAssetRatio)}</span>
      </div>
      <div className="h-5 overflow-hidden rounded-md border border-border bg-muted">
        <div className="flex h-full">
          <div
            className="bg-emerald-500"
            style={{ width: `${liquidPct}%` }}
            title={`流动资产 ${formatRiskCurrency(snapshot.liquidAssetsCents)}`}
          />
          <div
            className="bg-cyan-500"
            style={{ width: `${stablePct}%` }}
            title="其他资产"
          />
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-md bg-muted">
        <div
          className="h-full bg-amber-500"
          style={{ width: `${liabilityPct}%` }}
          title={`总负债 ${formatRiskCurrency(snapshot.totalLiabilitiesCents)}`}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />流动资产</span>
        <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />其他资产</span>
        <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />负债占比</span>
      </div>
    </div>
  );
}

function CapacityBar({ snapshot }: CreditRiskDashboardProps) {
  const total = Math.max(1, snapshot.riskCapacityCents + snapshot.currentExposureCents);
  const exposurePct = clampPercent(snapshot.currentExposureCents / total);
  const capacityPct = clampPercent(snapshot.riskCapacityCents / total);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium">风险容量条</span>
        <span className="text-muted-foreground">当前评估</span>
      </div>
      <div className="flex h-8 overflow-hidden rounded-md border border-border bg-muted">
        <div
          className="flex items-center justify-center bg-red-500/85 text-[11px] font-medium text-white"
          style={{ width: `${Math.max(12, exposurePct)}%` }}
          title={`当前敞口 ${formatRiskCurrency(snapshot.currentExposureCents)}`}
        >
          敞口
        </div>
        <div
          className="flex items-center justify-center bg-emerald-500/90 text-[11px] font-medium text-white"
          style={{ width: `${Math.max(12, capacityPct)}%` }}
          title={`可承受额度 ${formatRiskCurrency(snapshot.riskCapacityCents)}`}
        >
          容量
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
        <div className="truncate">当前敞口 {formatRiskCurrency(snapshot.currentExposureCents)}</div>
        <div className="truncate text-right">可承受 {formatRiskCurrency(snapshot.riskCapacityCents)}</div>
      </div>
    </div>
  );
}

function PressureGauge({ snapshot }: CreditRiskDashboardProps) {
  const pressurePct = clampPercent(snapshot.repaymentPressureRatio);
  const bufferPct = clampPercent(snapshot.bufferMonths / 6);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <div className="mb-1 flex justify-between text-xs">
          <span className="font-medium">30 天还款压力</span>
          <span className="text-muted-foreground">{pressurePct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-md bg-muted">
          <div className="h-full bg-amber-500" style={{ width: `${pressurePct}%` }} />
        </div>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs">
          <span className="font-medium">流动性缓冲</span>
          <span className="text-muted-foreground">{snapshot.bufferMonths.toFixed(1)} 个月</span>
        </div>
        <div className="h-2 overflow-hidden rounded-md bg-muted">
          <div className="h-full bg-emerald-500" style={{ width: `${bufferPct}%` }} />
        </div>
      </div>
    </div>
  );
}

export function CreditRiskDashboard({ snapshot }: CreditRiskDashboardProps) {
  const capacityTone = snapshot.riskCapacityCents < 500_000
    ? "danger"
    : snapshot.riskCapacityCents < 1_000_000
      ? "watch"
      : "good";

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-semibold">资产可视化仪表盘</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">估算口径 · 不等同银行授信</p>
        </div>
        <div className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground">
          更新 {new Date(snapshot.updatedAt).toLocaleDateString("zh-CN")}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Metric
          label="资产"
          value={formatRiskCurrency(snapshot.totalAssetsCents)}
          detail={`流动 ${formatRiskCurrency(snapshot.liquidAssetsCents)}`}
          icon={CircleDollarSign}
          tone="good"
        />
        <Metric
          label="负债"
          value={formatRiskCurrency(snapshot.totalLiabilitiesCents)}
          detail={`负债率 ${formatRiskPercent(snapshot.debtToAssetRatio)}`}
          icon={Landmark}
          tone={snapshot.debtToAssetRatio > 0.5 ? "danger" : "default"}
        />
        <Metric
          label="流动性缓冲"
          value={`${snapshot.bufferMonths.toFixed(1)} 个月`}
          detail={formatRiskCurrency(snapshot.liquidAssetsCents)}
          icon={WalletCards}
          tone={snapshot.bufferMonths < 3 ? "watch" : "good"}
        />
        <Metric
          label="未来 30 天还款"
          value={formatRiskCurrency(snapshot.future30DayRepaymentCents)}
          detail={`收入占比 ${formatRiskPercent(snapshot.repaymentPressureRatio)}`}
          icon={Banknote}
          tone={snapshot.repaymentPressureRatio > 0.4 ? "watch" : "default"}
        />
        <Metric
          label="可承受风险额度"
          value={formatRiskCurrency(snapshot.riskCapacityCents)}
          detail="流动资产折扣后估算"
          icon={Gauge}
          tone={capacityTone}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 border border-border p-3">
          <AssetStack snapshot={snapshot} />
        </div>
        <div className="min-w-0 border border-border p-3">
          <CapacityBar snapshot={snapshot} />
        </div>
      </div>

      <div className="mt-4 border border-border p-3">
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="h-3.5 w-3.5 text-cyan-600" />
          <span>还款压力和现金缓冲用于给决策问题设定风险边界。</span>
        </div>
        <PressureGauge snapshot={snapshot} />
      </div>
    </section>
  );
}
