import { existsSync } from "fs";

const filesToCheck = [
  "src/components/licenses/gateway-settings.tsx",
  "src/components/licenses/plans-manager.tsx",
  "src/lib/billing-job.ts",
  "src/lib/billing.functions.ts",
  "src/lib/license-admin.functions.ts",
  "src/lib/license-client.ts",
  "src/lib/license-server.ts",
  "src/lib/license-verifier.ts",
  "src/lib/mercadopago.ts",
  "src/lib/stripe.ts",
  "src/lib/subscription-helpers.ts",
  "src/lib/subscription-middleware.ts",
  "src/routes/_app/billing.tsx",
  "src/routes/_app/license.tsx",
  "src/routes/_app/licenses/$id.tsx",
  "src/routes/_app/licenses/index.tsx",
  "src/routes/api/admin/payment-gateways/mercadopago.ts",
  "src/routes/api/admin/payment-gateways/mercadopago/test.ts",
  "src/routes/api/billing/checkout.ts",
  "src/routes/api/billing/checkout/card.ts",
  "src/routes/api/billing/checkout/pix.ts",
  "src/routes/api/billing/invoices.ts",
  "src/routes/api/billing/invoices/$id.ts",
  "src/routes/api/billing/payments/$id/status.ts",
  "src/routes/api/billing/plans.ts",
  "src/routes/api/billing/public-key.ts",
  "src/routes/api/billing/subscription.ts",
  "src/routes/api/billing/subscription/renew.ts",
  "src/routes/api/licenses/activate.ts",
  "src/routes/api/licenses/health.ts",
  "src/routes/api/public/webhooks/stripe.ts",
  "src/routes/api/webhooks/mercadopago.ts",
];

console.log("=== EXISTÊNCIA DOS ARQUIVOS SAAS ===");
const results = filesToCheck.map(f => ({
  file: f,
  exists: existsSync(f)
}));
console.table(results);
