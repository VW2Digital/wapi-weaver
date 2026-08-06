import Stripe from "stripe";

const _apiKey = process.env.STRIPE_SECRET_KEY;

// Lazy initialization: avoid crashing at module load when STRIPE_SECRET_KEY is absent.
// The Stripe SDK throws if instantiated with an empty string.
let _instance: Stripe | null = null;

function getInstance(): Stripe {
  if (!_instance) {
    if (!_apiKey) {
      throw new Error(
        "[Stripe] STRIPE_SECRET_KEY is not configured. Set it in your .env file.",
      );
    }
    _instance = new Stripe(_apiKey, {
      apiVersion: "2026-06-24.dahlia" as Stripe.LatestApiVersion,
    });
  }
  return _instance;
}

// Proxy preserves the `stripe.xxx` call syntax across all importers without
// requiring any changes to call sites.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop: string | symbol) {
    return getInstance()[prop as keyof Stripe];
  },
});
