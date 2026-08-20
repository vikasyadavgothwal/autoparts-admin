export type BusinessPlanTier = "Free" | "Pro" | "Enterprise"

const planTierRank: Record<BusinessPlanTier, number> = {
  Free: 0,
  Pro: 1,
  Enterprise: 2,
}

export const getPlanTransition = (
  current: BusinessPlanTier,
  next: BusinessPlanTier,
) => planTierRank[next] === planTierRank[current]
  ? "same"
  : planTierRank[next] > planTierRank[current]
    ? "upgrade"
    : "downgrade"

export const getPlanPeriodEnd = (
  activatedAt: Date,
  plan: { billingPeriod: string; monthlyBillingDays: number },
) => {
  const end = new Date(activatedAt)
  if (plan.billingPeriod.toLowerCase().includes("year")) {
    end.setUTCFullYear(end.getUTCFullYear() + 1)
  } else {
    end.setUTCDate(end.getUTCDate() + Math.max(1, plan.monthlyBillingDays || 30))
  }
  return end
}
