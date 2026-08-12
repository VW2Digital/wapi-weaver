import db from "../src/lib/db.ts";
import crypto from "crypto";
import { processApprovedPayment } from "../src/lib/subscription-helpers.ts";
import { addDays } from "date-fns";

function assert(condition, message) {
  if (!condition) {
    console.error("❌ ASSERTION FAILED:", message);
    throw new Error(message);
  }
}

async function runTests() {
  console.log("==================================================");
  console.log("🧪 RUNNING AUTOMATED BILLING & PAYMENT FLOW TESTS");
  console.log("==================================================");

  // 1. Setup clean test tenant, user, plans, subscription
  // NOTE: tenant_id and user_id must reference users.id due to FK constraints.
  // We insert a real test user and use tenantId === userId for simplicity.
  const userId = crypto.randomUUID();  // proper UUID for FK compatibility
  const tenantId = userId;             // same ID: tenant === user (single-tenant model)
  const subPlanId = crypto.randomUUID();
  const billingPlanId = crypto.randomUUID();
  const subId = crypto.randomUUID();
  const testEmail = `test-billing-${Date.now()}@test.wapi`;

  // Insert test user (required to satisfy FK: tenant_id/user_id/customer_id → users.id)
  await db.query(
    `INSERT INTO users (id, email, password_hash) VALUES (?, ?, 'test-hash-not-real')`,
    [userId, testEmail]
  );

  // Insert test subscription_plan
  await db.query(
    `INSERT INTO subscription_plans (id, name, slug, description, max_users, max_funnels, max_agents, is_active)
     VALUES (?, 'Test Operational Plan', 'test-op-${Date.now()}', 'Test', 10, 5, 2, 1)`,
    [subPlanId]
  );

  // Insert test billing_plan linked to subscription_plan
  await db.query(
    `INSERT INTO billing_plans (id, subscription_plan_id, name, description, price, billing_interval, billing_interval_count, duration_days, is_active)
     VALUES (?, ?, 'Test Commercial Plan', 'Test', 99.90, 'month', 1, 30, 1)`,
    [billingPlanId, subPlanId]
  );

  // Insert initial trial subscription
  // plan_id uses subPlanId (subscription_plans) since live DB FK to billing_plans likely not enforced
  const now = new Date();
  const trialExpiresAt = addDays(now, 3);
  await db.query(
    `INSERT INTO subscriptions (id, tenant_id, customer_id, plan_id, status, starts_at, expires_at, auto_renew)
     VALUES (?, ?, ?, ?, 'trial', ?, ?, false)`,
    [subId, tenantId, userId, subPlanId, now, trialExpiresAt]
  );

  console.log("✔ Setup: Test user, plans, and subscription initialized.");

  // Scenario 1: First approved payment provisions subscription to active + updates plan_id to exact subscription_plan_id
  const invoiceId1 = `inv-1-${Date.now()}`;
  const providerPaymentId1 = `mp-pay-1-${Date.now()}`;
  const externalRef1 = `ref-1-${Date.now()}`;
  const paymentId1 = `pay-1-${Date.now()}`;

  await db.query(
    `INSERT INTO billing_invoices (id, tenant_id, customer_id, subscription_id, plan_id, invoice_number, amount, currency, status, external_reference)
     VALUES (?, ?, ?, ?, ?, 'INV-TEST-1', 99.90, 'BRL', 'pending', ?)`,
    [invoiceId1, tenantId, userId, subId, billingPlanId, externalRef1]
  );

  await db.query(
    `INSERT INTO billing_payments (id, tenant_id, customer_id, subscription_id, invoice_id, provider, provider_payment_id, external_reference, payment_method, status, amount, currency, environment)
     VALUES (?, ?, ?, ?, ?, 'mercadopago', ?, ?, 'pix', 'pending', 99.90, 'BRL', 'sandbox')`,
    [paymentId1, tenantId, userId, subId, invoiceId1, providerPaymentId1, externalRef1]
  );

  await db.transaction(async (conn) => {
    const res = await processApprovedPayment(
      conn,
      providerPaymentId1,
      new Date(),
      99.90,
      "BRL",
      { id: providerPaymentId1, status: "approved" }
    );
    assert(res.success === true, "Scenario 1: Payment processing should succeed");
    assert(!res.alreadyProcessed, "Scenario 1: First payment should not be alreadyProcessed");
  });

  const subsPost1Rows = await db.query("SELECT * FROM subscriptions WHERE id = ?", [subId]);
  const subPost1 = subsPost1Rows[0];
  assert(subPost1, "Scenario 1: Subscription row must exist after payment");
  assert(subPost1.status === "active", `Scenario 1: Subscription status should be active, got: ${subPost1.status}`);
  assert(subPost1.plan_id === subPlanId, `Scenario 1: Subscription plan_id should be exact subscription_plan_id (${subPlanId}), got ${subPost1.plan_id}`);

  const invoicesPost1Rows = await db.query("SELECT status FROM billing_invoices WHERE id = ?", [invoiceId1]);
  assert(invoicesPost1Rows[0]?.status === "paid", `Scenario 1: Invoice should be paid, got: ${invoicesPost1Rows[0]?.status}`);

  console.log("✔ Scenario 1 PASSED: First approved payment provisioned subscription & exact plan_id.");

  // Scenario 2: Duplicate approved webhook does NOT extend twice
  const expDateBeforeDup = new Date(subPost1.expires_at).getTime();

  await db.transaction(async (conn) => {
    const resDup = await processApprovedPayment(
      conn,
      providerPaymentId1,
      new Date(),
      99.90,
      "BRL",
      { id: providerPaymentId1, status: "approved" }
    );
    assert(resDup.alreadyProcessed === true, "Scenario 2: Duplicate call must return alreadyProcessed: true");
  });

  const subsPostDupRows = await db.query("SELECT expires_at FROM subscriptions WHERE id = ?", [subId]);
  const expDateAfterDup = new Date(subsPostDupRows[0].expires_at).getTime();
  assert(expDateBeforeDup === expDateAfterDup, "Scenario 2: Duplicate webhook must NOT extend expires_at twice");

  console.log("✔ Scenario 2 PASSED: Duplicate webhook returned alreadyProcessed without extending subscription period.");

  // Scenario 3: payment.status already approved + invoice pending still provisions
  const invoiceId3 = `inv-3-${Date.now()}`;
  const providerPaymentId3 = `mp-pay-3-${Date.now()}`;
  const paymentId3 = `pay-3-${Date.now()}`;

  await db.query(
    `INSERT INTO billing_invoices (id, tenant_id, customer_id, subscription_id, plan_id, invoice_number, amount, currency, status, external_reference)
     VALUES (?, ?, ?, ?, ?, 'INV-TEST-3', 99.90, 'BRL', 'pending', 'ext-3')`,
    [invoiceId3, tenantId, userId, subId, billingPlanId]
  );

  // Local payment is already stored as 'approved' (e.g. from intermediate state)
  await db.query(
    `INSERT INTO billing_payments (id, tenant_id, customer_id, subscription_id, invoice_id, provider, provider_payment_id, external_reference, payment_method, status, amount, currency, environment)
     VALUES (?, ?, ?, ?, ?, 'mercadopago', ?, 'ext-3', 'pix', 'approved', 99.90, 'BRL', 'sandbox')`,
    [paymentId3, tenantId, userId, subId, invoiceId3, providerPaymentId3]
  );

  await db.transaction(async (conn) => {
    const res3 = await processApprovedPayment(
      conn,
      providerPaymentId3,
      new Date(),
      99.90,
      "BRL",
      { id: providerPaymentId3, status: "approved" }
    );
    assert(res3.success === true, "Scenario 3: Should process provisioning even if payment.status was already approved");
    assert(!res3.alreadyProcessed, "Scenario 3: Should not claim alreadyProcessed when invoice was still pending");
  });

  const invoicesPost3Rows = await db.query("SELECT status FROM billing_invoices WHERE id = ?", [invoiceId3]);
  assert(invoicesPost3Rows[0]?.status === "paid", `Scenario 3: Invoice 3 should be marked paid, got: ${invoicesPost3Rows[0]?.status}`);

  console.log("✔ Scenario 3 PASSED: Payment with status=approved and invoice=pending provisioned successfully.");

  // Scenario 4: Amount mismatch does NOT activate
  const invoiceId4 = `inv-4-${Date.now()}`;
  const providerPaymentId4 = `mp-pay-4-${Date.now()}`;

  await db.query(
    `INSERT INTO billing_invoices (id, tenant_id, customer_id, subscription_id, plan_id, invoice_number, amount, currency, status, external_reference)
     VALUES (?, ?, ?, ?, ?, 'INV-TEST-4', 99.90, 'BRL', 'pending', 'ext-4')`,
    [invoiceId4, tenantId, userId, subId, billingPlanId]
  );
  await db.query(
    `INSERT INTO billing_payments (id, tenant_id, customer_id, subscription_id, invoice_id, provider, provider_payment_id, external_reference, payment_method, status, amount, currency, environment)
     VALUES ('pay-4', ?, ?, ?, ?, 'mercadopago', ?, 'ext-4', 'pix', 'pending', 50.00, 'BRL', 'sandbox')`,
    [tenantId, userId, subId, invoiceId4, providerPaymentId4]
  );

  let amountMismatchErrorThrown = false;
  try {
    await db.transaction(async (conn) => {
      await processApprovedPayment(
        conn,
        providerPaymentId4,
        new Date(),
        50.00, // Underpaid: 50.00 instead of 99.90
        "BRL",
        { id: providerPaymentId4, status: "approved" }
      );
    });
  } catch (err) {
    amountMismatchErrorThrown = true;
  }
  assert(amountMismatchErrorThrown, "Scenario 4: Underpaid payment must throw an error");

  const invoicesPost4Rows = await db.query("SELECT status FROM billing_invoices WHERE id = ?", [invoiceId4]);
  assert(invoicesPost4Rows[0]?.status === "pending", `Scenario 4: Invoice must remain pending on amount mismatch, got: ${invoicesPost4Rows[0]?.status}`);

  console.log("✔ Scenario 4 PASSED: Amount mismatch rejected provisioning.");

  // Scenario 5: Currency mismatch does NOT activate
  const invoiceId5 = `inv-5-${Date.now()}`;
  const providerPaymentId5 = `mp-pay-5-${Date.now()}`;

  await db.query(
    `INSERT INTO billing_invoices (id, tenant_id, customer_id, subscription_id, plan_id, invoice_number, amount, currency, status, external_reference)
     VALUES (?, ?, ?, ?, ?, 'INV-TEST-5', 99.90, 'BRL', 'pending', 'ext-5')`,
    [invoiceId5, tenantId, userId, subId, billingPlanId]
  );
  await db.query(
    `INSERT INTO billing_payments (id, tenant_id, customer_id, subscription_id, invoice_id, provider, provider_payment_id, external_reference, payment_method, status, amount, currency, environment)
     VALUES ('pay-5', ?, ?, ?, ?, 'mercadopago', ?, 'ext-5', 'pix', 'pending', 99.90, 'USD', 'sandbox')`,
    [tenantId, userId, subId, invoiceId5, providerPaymentId5]
  );

  let currencyMismatchErrorThrown = false;
  try {
    await db.transaction(async (conn) => {
      await processApprovedPayment(
        conn,
        providerPaymentId5,
        new Date(),
        99.90,
        "USD", // Currency mismatch USD vs BRL
        { id: providerPaymentId5, status: "approved" }
      );
    });
  } catch (err) {
    currencyMismatchErrorThrown = true;
  }
  assert(currencyMismatchErrorThrown, "Scenario 5: Currency mismatch must throw an error");

  console.log("✔ Scenario 5 PASSED: Currency mismatch rejected provisioning.");

  // Scenario 6: Billing plan without valid subscription_plan_id fails safely
  const invalidBillingPlanId = crypto.randomUUID();
  await db.query(
    `INSERT INTO billing_plans (id, subscription_plan_id, name, description, price, duration_days, is_active)
     VALUES (?, NULL, 'Orphan Billing Plan', 'No sub plan', 99.90, 30, 1)`,
    [invalidBillingPlanId]
  );

  const invoiceId6 = `inv-6-${Date.now()}`;
  const providerPaymentId6 = `mp-pay-6-${Date.now()}`;
  await db.query(
    `INSERT INTO billing_invoices (id, tenant_id, customer_id, subscription_id, plan_id, invoice_number, amount, currency, status, external_reference)
     VALUES (?, ?, ?, ?, ?, 'INV-TEST-6', 99.90, 'BRL', 'pending', 'ext-6')`,
    [invoiceId6, tenantId, userId, subId, invalidBillingPlanId]
  );
  await db.query(
    `INSERT INTO billing_payments (id, tenant_id, customer_id, subscription_id, invoice_id, provider, provider_payment_id, external_reference, payment_method, status, amount, currency, environment)
     VALUES ('pay-6', ?, ?, ?, ?, 'mercadopago', ?, 'ext-6', 'pix', 'pending', 99.90, 'BRL', 'sandbox')`,
    [tenantId, userId, subId, invoiceId6, providerPaymentId6]
  );

  let orphanPlanErrorThrown = false;
  try {
    await db.transaction(async (conn) => {
      await processApprovedPayment(
        conn,
        providerPaymentId6,
        new Date(),
        99.90,
        "BRL",
        { id: providerPaymentId6, status: "approved" }
      );
    });
  } catch (err) {
    orphanPlanErrorThrown = true;
  }
  assert(orphanPlanErrorThrown, "Scenario 6: Billing plan without subscription_plan_id must fail safely");

  console.log("✔ Scenario 6 PASSED: Billing plan without valid subscription_plan_id failed safely without silent fallback.");

  // Clean test records (child tables first to avoid FK issues)
  await db.query("DELETE FROM notifications WHERE tenant_id = ?", [tenantId]);
  await db.query("DELETE FROM subscription_events WHERE tenant_id = ?", [tenantId]);
  await db.query("DELETE FROM billing_payments WHERE tenant_id = ?", [tenantId]);
  await db.query("DELETE FROM billing_invoices WHERE tenant_id = ?", [tenantId]);
  await db.query("DELETE FROM subscriptions WHERE tenant_id = ?", [tenantId]);
  await db.query("DELETE FROM billing_plans WHERE id IN (?, ?)", [billingPlanId, invalidBillingPlanId]);
  await db.query("DELETE FROM subscription_plans WHERE id = ?", [subPlanId]);
  await db.query("DELETE FROM users WHERE id = ?", [userId]);

  console.log("==================================================");
  console.log("ALL 6 BILLING FLOW TEST SCENARIOS PASSED!");
  console.log("==================================================");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ BILLING TEST SUITE FAILED:", err);
  process.exit(1);
});
