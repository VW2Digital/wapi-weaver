export type RawCampaignTotals = Partial<
  Record<"total" | "pending" | "sending" | "sent" | "delivered" | "read" | "failed", number>
>;

/**
 * Normaliza os totais da campanha para exibição.
 *
 * No banco, cada mensagem tem um único status final ("sent", "delivered", "read", etc),
 * então os contadores não são cumulativos. Para UI, geralmente faz mais sentido:
 * - enviadas = sending + sent + delivered + read
 * - entregues = delivered + read
 * - lidas = read
 */
export function normalizeCampaignTotals(totals: RawCampaignTotals | null | undefined) {
  const t = (totals ?? {}) as RawCampaignTotals;

  const total = t.total ?? 0;
  const pending = t.pending ?? 0;
  const sending = t.sending ?? 0;
  const failed = t.failed ?? 0;
  const read = t.read ?? 0;
  const deliveredOnly = t.delivered ?? 0;
  const sentOnly = t.sent ?? 0;

  const delivered = deliveredOnly + read;
  const sent = sentOnly + deliveredOnly + read + sending;
  const completed = sentOnly + deliveredOnly + read + failed;

  return {
    total,
    pending,
    sending,
    sent,
    delivered,
    read,
    failed,
    completed,
  };
}
