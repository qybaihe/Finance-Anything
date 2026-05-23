import type { CSSProperties } from "react";
import { AlertTriangle, Bot, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CreditRiskLevel, CreditRiskSnapshot } from "./creditRiskTypes";
import { formatRiskCurrency } from "./creditRiskFormat";

type CreditRiskPetProps = {
  snapshot: CreditRiskSnapshot;
  variant?: "card" | "inline";
  className?: string;
};

const petSpriteUrl = "/finance/daodun-risk-actions.webp";
const PET_SPRITE_COLS = 8;
const PET_SPRITE_ROWS = 4;
const PET_FRAME_ASPECT = 208 / 192;

const riskCopy: Record<CreditRiskLevel, {
  label: string;
  headline: string;
  body: string;
  badgeClassName: string;
  ringClassName: string;
  icon: typeof ShieldCheck;
}> = {
  safe: {
    label: "安全",
    headline: "信用边界稳定",
    body: "可以正常比较收益和机会成本。",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300",
    ringClassName: "border-emerald-300 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/30",
    icon: ShieldCheck,
  },
  watch: {
    label: "观察",
    headline: "近期还款密集",
    body: "新增支出需要先看现金流余量。",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300",
    ringClassName: "border-amber-300 bg-amber-50 dark:border-amber-900/70 dark:bg-amber-950/30",
    icon: ShieldAlert,
  },
  stress: {
    label: "承压",
    headline: "现金缓冲偏薄",
    body: "建议降低杠杆和非必要风险敞口。",
    badgeClassName: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/70 dark:bg-orange-950/40 dark:text-orange-300",
    ringClassName: "border-orange-300 bg-orange-50 dark:border-orange-900/70 dark:bg-orange-950/30",
    icon: AlertTriangle,
  },
  danger: {
    label: "警戒",
    headline: "杠杆风险过高",
    body: "先处理逾期、还款和现金缺口。",
    badgeClassName: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300",
    ringClassName: "border-red-300 bg-red-50 dark:border-red-900/70 dark:bg-red-950/30",
    icon: AlertTriangle,
  },
};

const petAnimation: Record<CreditRiskLevel, {
  row: number;
  frames: number;
  durationMs: number;
}> = {
  safe: { row: 0, frames: 6, durationMs: 1200 },
  watch: { row: 1, frames: 8, durationMs: 900 },
  stress: { row: 2, frames: 8, durationMs: 1500 },
  danger: { row: 3, frames: 6, durationMs: 720 },
};

function PetAvatar({ snapshot, size = "large" }: { snapshot: CreditRiskSnapshot; size?: "small" | "large" }) {
  const copy = riskCopy[snapshot.riskLevel];
  const animation = petAnimation[snapshot.riskLevel];
  const frameWidth = size === "small" ? 48 : 96;
  const frameHeight = Math.round(frameWidth * PET_FRAME_ASPECT);
  const spriteStyle = {
    width: frameWidth,
    height: frameHeight,
    "--daodun-row-y": `${-animation.row * frameHeight}px`,
    "--daodun-end-x": `${-animation.frames * frameWidth}px`,
    backgroundImage: `url(${petSpriteUrl})`,
    backgroundSize: `${frameWidth * PET_SPRITE_COLS}px ${frameHeight * PET_SPRITE_ROWS}px`,
    animation: `daodun-risk-sprite ${animation.durationMs}ms steps(${animation.frames}) infinite`,
    imageRendering: "pixelated",
  } as CSSProperties;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md border",
        copy.ringClassName,
      )}
      style={{ width: frameWidth, height: frameHeight }}
    >
      <div
        role="img"
        aria-label={`DaoDun ${copy.label} 动作`}
        className="daodun-risk-sprite h-full w-full bg-no-repeat"
        style={spriteStyle}
      />
      <span className={cn(
        "absolute bottom-1 right-1 rounded-md border px-1 py-0.5 text-[10px] font-medium leading-none",
        copy.badgeClassName,
      )}>
        {copy.label}
      </span>
    </div>
  );
}

export function CreditRiskPet({ snapshot, variant = "card", className }: CreditRiskPetProps) {
  const copy = riskCopy[snapshot.riskLevel];
  const Icon = copy.icon;

  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2", className)}>
        <PetAvatar snapshot={snapshot} size="small" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Bot className="h-3.5 w-3.5 text-cyan-600" />
            <span className="truncate">DaoDun 风险哨兵</span>
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {copy.headline} · 风险分 {snapshot.riskScore}
          </div>
        </div>
      </div>
    );
  }

  return (
    <aside className={cn("min-w-0 rounded-md border border-border bg-card p-4", className)}>
      <div className="flex items-start gap-3">
        <PetAvatar snapshot={snapshot} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-cyan-600" />
            <h2 className="text-sm font-semibold">DaoDun 风险哨兵</h2>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs", copy.badgeClassName)}>
              <Icon className="h-3.5 w-3.5" />
              {copy.label}
            </span>
            <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
              风险分 {snapshot.riskScore}
            </span>
          </div>
          <div className="mt-3 text-sm font-medium">{copy.headline}</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy.body}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="min-w-0 border border-border px-2 py-2">
          <div className="truncate text-[11px] text-muted-foreground">缓冲</div>
          <div className="mt-1 truncate text-sm font-semibold tabular-nums">{snapshot.bufferMonths.toFixed(1)} 月</div>
        </div>
        <div className="min-w-0 border border-border px-2 py-2">
          <div className="truncate text-[11px] text-muted-foreground">还款</div>
          <div className="mt-1 truncate text-sm font-semibold tabular-nums">{formatRiskCurrency(snapshot.future30DayRepaymentCents)}</div>
        </div>
        <div className="min-w-0 border border-border px-2 py-2">
          <div className="truncate text-[11px] text-muted-foreground">可承受</div>
          <div className="mt-1 truncate text-sm font-semibold tabular-nums">{formatRiskCurrency(snapshot.riskCapacityCents)}</div>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-border px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        守护状态由还款墙、现金缓冲、风险容量和 Agent 结论共同驱动。
      </div>
    </aside>
  );
}
