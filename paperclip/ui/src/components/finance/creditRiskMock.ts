import type { Issue } from "@paperclipai/shared";
import type {
  CreditCalendarMarkerSeverity,
  CreditRiskCalendarItem,
  CreditRiskLevel,
  CreditRiskSnapshot,
} from "./creditRiskTypes";

const DAY_MS = 24 * 60 * 60 * 1000;

const BASE_TOTAL_ASSETS_CENTS = 12_860_000;
const BASE_TOTAL_LIABILITIES_CENTS = 4_620_000;
const BASE_LIQUID_ASSETS_CENTS = 3_860_000;
const BASE_MONTHLY_INCOME_CENTS = 2_150_000;
const BASE_FIXED_EXPENSE_CENTS = 1_340_000;
const BASE_MONTHLY_REPAYMENT_CENTS = 752_000;
const BASE_CURRENT_EXPOSURE_CENTS = 580_000;

const RISK_KEYWORDS: Array<{ pattern: RegExp; severity: CreditCalendarMarkerSeverity }> = [
  { pattern: /逾期|过度杠杆|爆仓|现金流断裂|资不抵债|强平|违约|不建议/i, severity: "critical" },
  { pattern: /高风险|谨慎|杠杆|现金流|还款压力|负债|裁员|亏损/i, severity: "high" },
  { pattern: /波动|压力|延期|分期|预算|回撤|不确定/i, severity: "medium" },
];

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setHours(12, 0, 0, 0);
  next.setDate(next.getDate() + days);
  return next;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mapRiskLevel(score: number): CreditRiskLevel {
  if (score < 35) return "safe";
  if (score < 60) return "watch";
  if (score < 80) return "stress";
  return "danger";
}

function mapPetMood(riskLevel: CreditRiskLevel): CreditRiskSnapshot["petMood"] {
  if (riskLevel === "safe") return "confident";
  if (riskLevel === "watch") return "guarded";
  if (riskLevel === "stress") return "alert";
  return "panic";
}

function severityBoost(severity: CreditCalendarMarkerSeverity) {
  if (severity === "critical") return 18;
  if (severity === "high") return 10;
  if (severity === "medium") return 5;
  return 1;
}

function inferIssueSeverity(issue: Issue): CreditCalendarMarkerSeverity {
  const text = `${issue.title} ${issue.description ?? ""}`;
  for (const item of RISK_KEYWORDS) {
    if (item.pattern.test(text)) return item.severity;
  }
  if (issue.status === "blocked") return "high";
  if (issue.status === "done") return "low";
  return "medium";
}

function issueMarkerTitle(issue: Issue) {
  const prefix = issue.status === "done" ? "决策结论" : "Agent 跟进";
  return `${prefix}：${issue.title}`;
}

function buildAgentMarkers(issues: Issue[], now: Date): CreditRiskCalendarItem[] {
  const fallbackDate = toDateKey(now);
  const markers = issues.slice(0, 4).map((issue) => {
    const rawDate = issue.completedAt ?? issue.updatedAt ?? issue.createdAt;
    const date = rawDate ? toDateKey(new Date(rawDate)) : fallbackDate;
    const severity = inferIssueSeverity(issue);
    return {
      id: `agent-${issue.id}`,
      date,
      title: issueMarkerTitle(issue),
      kind: "agent_conclusion" as const,
      severity,
      source: "agent" as const,
      issueId: issue.id,
      issueIdentifier: issue.identifier ?? undefined,
      summary: issue.status === "done" ? "已沉淀为决策结论" : "正在形成决策结论",
    };
  });

  if (markers.length > 0) return markers;
  return [{
    id: "agent-empty-state",
    date: fallbackDate,
    title: "首个 Agent 结论待沉淀",
    kind: "agent_conclusion",
    severity: "low",
    source: "system",
    summary: "开始一次决策后，这里会出现结论标志",
  }];
}

function buildBaseCalendarItems(now: Date, riskCapacityCents: number): CreditRiskCalendarItem[] {
  const nextBufferSeverity: CreditCalendarMarkerSeverity =
    riskCapacityCents < 500_000 ? "high" : riskCapacityCents < 1_000_000 ? "medium" : "low";

  return [
    {
      id: "asset-capacity-today",
      date: toDateKey(now),
      title: "当前风险额度",
      kind: "asset_capacity",
      severity: nextBufferSeverity,
      amountCents: riskCapacityCents,
      currency: "CNY",
      source: "system",
      summary: "基于流动资产、30 天还款和当前敞口估算",
    },
    {
      id: "cmb-card-repayment",
      date: toDateKey(addDays(now, 5)),
      title: "招行信用卡还款",
      kind: "repayment_due",
      severity: "medium",
      amountCents: 482_000,
      currency: "CNY",
      source: "user",
      summary: "建议提前 2 天确认自动扣款余额",
    },
    {
      id: "cash-buffer-warning",
      date: toDateKey(addDays(now, 8)),
      title: "现金缓冲低于 3 个月",
      kind: "risk_warning",
      severity: "high",
      source: "system",
      summary: "近期还款集中，新增风险敞口需压低",
    },
    {
      id: "mortgage-repayment",
      date: toDateKey(addDays(now, 12)),
      title: "房贷扣款",
      kind: "repayment_due",
      severity: "medium",
      amountCents: 920_000,
      currency: "CNY",
      source: "user",
      summary: "固定支出占用流动性",
    },
    {
      id: "system-review",
      date: toDateKey(addDays(now, 18)),
      title: "额度复核提醒",
      kind: "manual_note",
      severity: "low",
      source: "system",
      summary: "复查账单、分期和可用现金",
    },
    {
      id: "installment-repayment",
      date: toDateKey(addDays(now, 26)),
      title: "分期还款",
      kind: "repayment_due",
      severity: "low",
      amountCents: 135_000,
      currency: "CNY",
      source: "user",
      summary: "小额固定还款",
    },
  ];
}

export function buildCreditRiskWorkspace(issues: Issue[], now = new Date()) {
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);

  const future30DayRepaymentCents = BASE_MONTHLY_REPAYMENT_CENTS;
  const riskCapacityCents = Math.max(
    0,
    Math.round(BASE_LIQUID_ASSETS_CENTS * 0.45 - future30DayRepaymentCents - BASE_CURRENT_EXPOSURE_CENTS * 0.3),
  );
  const debtToAssetRatio = BASE_TOTAL_LIABILITIES_CENTS / BASE_TOTAL_ASSETS_CENTS;
  const repaymentPressureRatio = BASE_MONTHLY_REPAYMENT_CENTS / BASE_MONTHLY_INCOME_CENTS;
  const bufferMonths = BASE_LIQUID_ASSETS_CENTS / BASE_FIXED_EXPENSE_CENTS;

  const baseItems = buildBaseCalendarItems(today, riskCapacityCents);
  const agentItems = buildAgentMarkers(issues, today);
  const items = [...baseItems, ...agentItems].sort((a, b) => a.date.localeCompare(b.date));

  const maxAgentSeverityBoost = Math.max(0, ...agentItems.map((item) => severityBoost(item.severity)));
  const thinBufferBoost = Math.max(0, 3 - bufferMonths) * 8;
  const capacityBoost = riskCapacityCents < 500_000 ? 12 : riskCapacityCents < 1_000_000 ? 6 : 0;
  const score = clamp(Math.round(
    24 +
    debtToAssetRatio * 50 +
    repaymentPressureRatio * 26 +
    (BASE_CURRENT_EXPOSURE_CENTS / BASE_LIQUID_ASSETS_CENTS) * 16 +
    thinBufferBoost +
    capacityBoost +
    maxAgentSeverityBoost,
  ), 0, 100);
  const riskLevel = mapRiskLevel(score);

  const snapshot: CreditRiskSnapshot = {
    riskLevel,
    riskScore: score,
    riskCapacityCents,
    currentExposureCents: BASE_CURRENT_EXPOSURE_CENTS,
    totalAssetsCents: BASE_TOTAL_ASSETS_CENTS,
    totalLiabilitiesCents: BASE_TOTAL_LIABILITIES_CENTS,
    liquidAssetsCents: BASE_LIQUID_ASSETS_CENTS,
    monthlyRepaymentCents: BASE_MONTHLY_REPAYMENT_CENTS,
    future30DayRepaymentCents,
    monthlyIncomeCents: BASE_MONTHLY_INCOME_CENTS,
    fixedExpenseCents: BASE_FIXED_EXPENSE_CENTS,
    debtToAssetRatio,
    repaymentPressureRatio,
    bufferMonths,
    updatedAt: today.toISOString(),
    petMood: mapPetMood(riskLevel),
  };

  return { snapshot, calendarItems: items };
}

export function getCreditRiskWindow(now = new Date()) {
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = addDays(today, mondayOffset);
  return Array.from({ length: 35 }, (_, index) => addDays(start, index));
}
