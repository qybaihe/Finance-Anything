export function formatRiskCurrency(cents: number, currency = "CNY") {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatRiskPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function formatRiskDateLabel(date: Date | string) {
  const value = typeof date === "string" ? new Date(`${date}T12:00:00`) : date;
  return `${value.getMonth() + 1}/${value.getDate()}`;
}
