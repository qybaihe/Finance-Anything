import { AlertTriangle, Bell, Bot, CalendarDays, CreditCard, Gauge, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CreditCalendarMarkerKind,
  CreditCalendarMarkerSeverity,
  CreditRiskCalendarItem,
  CreditRiskSnapshot,
} from "./creditRiskTypes";
import { getCreditRiskWindow } from "./creditRiskMock";
import { formatRiskCurrency, formatRiskDateLabel } from "./creditRiskFormat";

type CreditRiskCalendarWallProps = {
  items: CreditRiskCalendarItem[];
  snapshot: CreditRiskSnapshot;
};

const weekdayLabels = ["一", "二", "三", "四", "五", "六", "日"];

const kindConfig: Record<CreditCalendarMarkerKind, {
  label: string;
  icon: typeof CreditCard;
  className: string;
  dotClassName: string;
}> = {
  repayment_due: {
    label: "还款",
    icon: CreditCard,
    className: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300",
    dotClassName: "bg-sky-500",
  },
  risk_warning: {
    label: "预警",
    icon: AlertTriangle,
    className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300",
    dotClassName: "bg-amber-500",
  },
  agent_conclusion: {
    label: "结论",
    icon: Bot,
    className: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/70 dark:bg-violet-950/40 dark:text-violet-300",
    dotClassName: "bg-violet-500",
  },
  asset_capacity: {
    label: "额度",
    icon: Gauge,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300",
    dotClassName: "bg-emerald-500",
  },
  manual_note: {
    label: "提醒",
    icon: Bell,
    className: "border-border bg-muted/60 text-muted-foreground",
    dotClassName: "bg-muted-foreground",
  },
};

const severityConfig: Record<CreditCalendarMarkerSeverity, {
  label: string;
  className: string;
}> = {
  low: { label: "低", className: "ring-0" },
  medium: { label: "中", className: "ring-1 ring-yellow-400/40" },
  high: { label: "高", className: "ring-1 ring-orange-500/60" },
  critical: { label: "急", className: "ring-2 ring-red-500/70" },
};

function markerSummary(item: CreditRiskCalendarItem) {
  const amount = item.amountCents === undefined
    ? null
    : formatRiskCurrency(item.amountCents, item.currency);
  return [item.title, amount, item.summary].filter(Boolean).join(" · ");
}

function CalendarMarker({ item }: { item: CreditRiskCalendarItem }) {
  const config = kindConfig[item.kind];
  const Icon = config.icon;
  return (
    <div
      title={markerSummary(item)}
      className={cn(
        "min-w-0 rounded-md border px-1.5 py-1 text-[11px] leading-tight",
        "sm:flex sm:items-center sm:gap-1.5",
        config.className,
        severityConfig[item.severity].className,
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <Icon className="hidden h-3 w-3 shrink-0 sm:block" />
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full sm:hidden", config.dotClassName)} />
        <span className="truncate">{item.title}</span>
      </div>
      {item.amountCents !== undefined ? (
        <div className="hidden shrink-0 tabular-nums sm:block">
          {formatRiskCurrency(item.amountCents, item.currency)}
        </div>
      ) : null}
    </div>
  );
}

function startOfDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function CreditRiskCalendarWall({ items, snapshot }: CreditRiskCalendarWallProps) {
  const days = getCreditRiskWindow(new Date(snapshot.updatedAt));
  const itemsByDate = new Map<string, CreditRiskCalendarItem[]>();
  for (const item of items) {
    const group = itemsByDate.get(item.date) ?? [];
    group.push(item);
    itemsByDate.set(item.date, group);
  }

  const keyDates = items
    .filter((item) => item.kind === "repayment_due" || item.kind === "risk_warning")
    .slice(0, 3);
  const mobileTimelineItems = [...items]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  return (
    <section className="min-w-0 rounded-md border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-cyan-600" />
            <h2 className="text-sm font-semibold">信用风控日历墙</h2>
          </div>
          <p className="mt-1 break-words text-xs text-muted-foreground">近 5 周窗口 · 还款、预警和 Agent 结论统一落点</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(kindConfig).map(([kind, config]) => (
            <span key={kind} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground">
              <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClassName)} />
              {config.label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-2 sm:hidden">
        {mobileTimelineItems.map((item) => {
          const config = kindConfig[item.kind];
          const Icon = config.icon;
          return (
            <div key={item.id} className="flex min-w-0 items-start gap-3 rounded-md border border-border px-3 py-2">
              <div className="w-12 shrink-0 text-center">
                <div className="text-sm font-semibold tabular-nums">{formatRiskDateLabel(item.date)}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{config.label}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="truncate text-sm font-medium">{item.title}</div>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                  <span className={cn("rounded-md border px-1.5 py-0.5", config.className)}>
                    {severityConfig[item.severity].label}严重度
                  </span>
                  {item.amountCents !== undefined ? <span>{formatRiskCurrency(item.amountCents, item.currency)}</span> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 hidden grid-cols-7 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid">
        {weekdayLabels.map((label) => (
          <div key={label} className="bg-muted px-1 py-2 text-center text-[11px] font-medium text-muted-foreground">
            {label}
          </div>
        ))}
        {days.map((day) => {
          const dateKey = startOfDayKey(day);
          const dayItems = (itemsByDate.get(dateKey) ?? []).slice(0, 3);
          const overflowCount = Math.max(0, (itemsByDate.get(dateKey)?.length ?? 0) - dayItems.length);
          const isToday = dateKey === startOfDayKey(new Date(snapshot.updatedAt));

          return (
            <div
              key={dateKey}
              className={cn(
                "min-w-0 bg-card p-1.5 sm:p-2",
                "min-h-20 sm:min-h-[112px]",
                isToday && "bg-cyan-50/50 dark:bg-cyan-950/20",
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <span className={cn(
                  "text-[11px] font-medium tabular-nums text-muted-foreground",
                  isToday && "rounded-md bg-cyan-600 px-1.5 py-0.5 text-white",
                )}>
                  {formatRiskDateLabel(day)}
                </span>
                {dayItems.some((item) => item.severity === "high" || item.severity === "critical") ? (
                  <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" />
                ) : null}
              </div>
              <div className="space-y-1">
                {dayItems.map((item) => (
                  <CalendarMarker key={item.id} item={item} />
                ))}
                {overflowCount > 0 ? (
                  <div className="rounded-md bg-muted px-1.5 py-1 text-[11px] text-muted-foreground">
                    +{overflowCount}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 hidden gap-2 sm:grid sm:grid-cols-3">
        {keyDates.map((item) => {
          const config = kindConfig[item.kind];
          const Icon = config.icon;
          return (
            <div key={item.id} className="flex min-w-0 items-start gap-2 rounded-md border border-border px-3 py-2">
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">{item.title}</div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {item.date}
                  {item.amountCents !== undefined ? ` · ${formatRiskCurrency(item.amountCents, item.currency)}` : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        <span>当前评估：标志按类型区分，严重程度用细边框提示。</span>
      </div>
    </section>
  );
}
