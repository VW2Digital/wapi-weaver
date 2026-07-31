import { execSync } from "child_process";

async function run() {
  console.log("=== EXECUTANDO CHECKOUT SELETIVO DE ARQUIVOS SAAS ===");

  const files = [
    "src/lib/mercadopago.ts",
    "src/lib/subscription-helpers.ts",
    "src/lib/subscription-middleware.ts",
    "src/lib/billing-job.ts",
    "src/lib/encryption.ts",
    "src/lib/stripe.ts",
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
    "src/routes/api/public/webhooks/stripe.ts",
    "src/routes/api/webhooks/mercadopago.ts",
    "src/routes/functions/v1/mercadopago-webhook.ts",
    "src/components/licenses/plans-manager.tsx",
    "test-billing.ts"
  ];

  for (const f of files) {
    try {
      console.log(`Checking out: ${f}...`);
      execSync(`git checkout origin/audit/whatsapp-crm-validation -- "${f}"`, { stdio: "inherit" });
    } catch (e: any) {
      console.error(`Erro ao fazer checkout de ${f}:`, e.message);
    }
  }

  console.log("=== CHECKOUT CONCLUÍDO ===");
  process.exit(0);
}

run().catch(console.error);
