export type CreditCalendarMarkerKind =
  | "repayment_due"
  | "risk_warning"
  | "agent_conclusion"
  | "asset_capacity"
  | "manual_note";

export type CreditCalendarMarkerSeverity =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type CreditRiskLevel = "safe" | "watch" | "stress" | "danger";

export type CreditPetMood = "confident" | "guarded" | "alert" | "panic";

export type CreditRiskCalendarItem = {
  id: string;
  date: string;
  title: string;
  kind: CreditCalendarMarkerKind;
  severity: CreditCalendarMarkerSeverity;
  amountCents?: number;
  currency?: string;
  source?: "user" | "agent" | "system";
  issueId?: string;
  issueIdentifier?: string;
  summary?: string;
};

export type CreditRiskSnapshot = {
  riskLevel: CreditRiskLevel;
  riskScore: number;
  riskCapacityCents: number;
  currentExposureCents: number;
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  liquidAssetsCents: number;
  monthlyRepaymentCents: number;
  future30DayRepaymentCents: number;
  monthlyIncomeCents: number;
  fixedExpenseCents: number;
  debtToAssetRatio: number;
  repaymentPressureRatio: number;
  bufferMonths: number;
  updatedAt: string;
  petMood: CreditPetMood;
};
