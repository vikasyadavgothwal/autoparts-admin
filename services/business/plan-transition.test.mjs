import assert from "node:assert/strict"
import test from "node:test"

import { getPaidDowngradeEffectiveAt, getPlanPeriodEnd, getPlanTransition } from "./plan-transition.ts"

test("upgrades are immediate and downgrades are scheduled", () => {
  assert.equal(getPlanTransition("Free", "Pro"), "upgrade")
  assert.equal(getPlanTransition("Pro", "Enterprise"), "upgrade")
  assert.equal(getPlanTransition("Enterprise", "Pro"), "downgrade")
  assert.equal(getPlanTransition("Pro", "Free"), "downgrade")
  assert.equal(getPlanTransition("Pro", "Pro"), "same")
})

test("monthly and custom plans end after their configured number of days", () => {
  const start = new Date("2026-08-01T00:00:00.000Z")
  assert.equal(
    getPlanPeriodEnd(start, { billingPeriod: "monthly", monthlyBillingDays: 30 }).toISOString(),
    "2026-08-31T00:00:00.000Z",
  )
  assert.equal(
    getPlanPeriodEnd(start, { billingPeriod: "custom", monthlyBillingDays: 45 }).toISOString(),
    "2026-09-15T00:00:00.000Z",
  )
})

test("paid downgrades queue another billing period when already scheduled", () => {
  const currentPeriodEnd = new Date("2026-08-31T00:00:00.000Z")
  const nextPlan = { billingPeriod: "monthly", monthlyBillingDays: 30 }

  assert.equal(
    getPaidDowngradeEffectiveAt(currentPeriodEnd, null, nextPlan).toISOString(),
    "2026-08-31T00:00:00.000Z",
  )
  assert.equal(
    getPaidDowngradeEffectiveAt(currentPeriodEnd, currentPeriodEnd, nextPlan).toISOString(),
    "2026-09-30T00:00:00.000Z",
  )
})
