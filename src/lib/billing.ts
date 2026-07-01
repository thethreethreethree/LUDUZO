// Billing enums — mirror migration 0005.
export const PLAN_INTERVALS = ["day", "week", "month", "year", "one_time"] as const;
export const MANAGEMENT_ROLES = ["owner", "admin", "manager"];

// Subscription statuses — mirror the subscription_status enum in migration 0005.
// 'paused' is the freeze/hold state.
export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "paused",
  "canceled",
  "incomplete",
  "expired",
] as const;

export function formatMoney(cents: number, currency = "usd"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format((cents ?? 0) / 100);
  } catch {
    return `${((cents ?? 0) / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
