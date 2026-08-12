import db from "../src/lib/db.ts";
import { validateSubscriptionPlan, validateBillingPlan, resolveValidSubscriptionPlanId } from "../src/lib/plan-validator.ts";
import { getDefaultTrialPlanId } from "../src/lib/services/subscription-access.service.ts";

async function main() {
  console.log("=== VERIFYING BILLING & SUBSCRIPTION PLAN ARCHITECTURE ===");

  // 1. Verify getDefaultTrialPlanId returns a subscription_plans.id
  const defaultTrialId = await getDefaultTrialPlanId();
  console.log("Default trial plan ID resolved:", defaultTrialId);

  const subCheck = await validateSubscriptionPlan(defaultTrialId);
  console.log("Is valid subscription_plans record:", subCheck);

  if (!subCheck.exists || !subCheck.isActive) {
    throw new Error("FAILED: getDefaultTrialPlanId did NOT return an active subscription_plan!");
  }

  // 2. Verify validateBillingPlan returns billing_plans JOIN subscription_plans
  const billingPlans = await db.query("SELECT id FROM billing_plans WHERE is_active = 1 LIMIT 1");
  if (billingPlans.length > 0) {
    const billingPlanId = billingPlans[0].id;
    const billCheck = await validateBillingPlan(billingPlanId);
    console.log("Billing plan validation result:", billCheck);
    if (!billCheck.exists || !billCheck.subscriptionPlanId) {
      throw new Error("FAILED: validateBillingPlan did NOT return subscriptionPlanId link!");
    }
  }

  // 3. Verify resolveValidSubscriptionPlanId NEVER returns a billing_plans.id
  const resolvedSubId = await resolveValidSubscriptionPlanId("non-existent-id");
  const subCheckResolved = await validateSubscriptionPlan(resolvedSubId);
  console.log("Resolved fallback subscription plan:", resolvedSubId, subCheckResolved.exists);

  if (!subCheckResolved.exists) {
    throw new Error("FAILED: Fallback subscription plan ID does not exist in subscription_plans!");
  }

  console.log("=== ALL BILLING & SUBSCRIPTION CHECKS PASSED PERFECTLY ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
