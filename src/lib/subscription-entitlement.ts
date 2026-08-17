export type EntitlementRecord = Record<string, any> | null | undefined;

export interface CombinedEntitlement {
  allowed: boolean;
  status: "trialing" | "active" | "past_due" | "expired" | "cancelled" | "suspended";
  effectiveEnd: Date | null;
  reason: string | null;
}

function validDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function subscriptionEnd(subscription: EntitlementRecord): Date | null {
  if (!subscription) return null;
  const status = String(subscription.status || "").toLowerCase();
  if (status === "trial" || status === "trialing") {
    return validDate(subscription.trial_ends_at) ||
      validDate(subscription.current_period_end) ||
      validDate(subscription.expires_at);
  }
  return validDate(subscription.current_period_end) || validDate(subscription.expires_at);
}

export function resolveCombinedEntitlement(
  license: EntitlementRecord,
  subscription: EntitlementRecord,
  now: Date = new Date(),
): CombinedEntitlement {
  const nowMs = now.getTime();
  const licenseStatus = String(license?.status || "").toLowerCase();
  const subscriptionStatus = String(subscription?.status || "").toLowerCase();
  const licenseEnd = validDate(license?.expires_at);
  const subEnd = subscriptionEnd(subscription);
  const graceEnd = validDate(subscription?.grace_period_ends_at);

  // Bloqueio manual na licença é uma decisão administrativa explícita.
  if (["blocked", "suspended", "cancelled"].includes(licenseStatus)) {
    return {
      allowed: false,
      status: licenseStatus === "cancelled" ? "cancelled" : "suspended",
      effectiveEnd: licenseEnd || subEnd,
      reason: "license_blocked",
    };
  }

  const licenseUnlimited = licenseStatus === "active" && !licenseEnd;
  const licenseValid = licenseStatus === "active" && (licenseUnlimited || licenseEnd!.getTime() > nowMs);
  const subPeriodValid = ["active", "expiring", "trial", "trialing"].includes(subscriptionStatus) &&
    (!subEnd || subEnd.getTime() > nowMs);
  const graceValid = subscriptionStatus === "past_due" && !!graceEnd && graceEnd.getTime() > nowMs;

  if (licenseValid || subPeriodValid || graceValid) {
    const validEnds = [
      licenseValid && !licenseUnlimited ? licenseEnd : null,
      subPeriodValid ? subEnd : null,
      graceValid ? graceEnd : null,
    ].filter((date): date is Date => !!date);
    const effectiveEnd = licenseUnlimited
      ? null
      : validEnds.reduce<Date | null>((latest, date) =>
          !latest || date.getTime() > latest.getTime() ? date : latest, null);

    return {
      allowed: true,
      status: licenseValid
        ? "active"
        : graceValid
          ? "past_due"
          : ["trial", "trialing"].includes(subscriptionStatus)
            ? "trialing"
            : "active",
      effectiveEnd,
      reason: graceValid ? "grace_period" : null,
    };
  }

  return {
    allowed: false,
    status: subscriptionStatus === "cancelled" ? "cancelled" : "expired",
    effectiveEnd: [licenseEnd, subEnd].filter((date): date is Date => !!date)
      .reduce<Date | null>((latest, date) =>
        !latest || date.getTime() > latest.getTime() ? date : latest, null),
    reason: "subscription_expired",
  };
}

