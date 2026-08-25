export function resolveInstagramRecordOwnership(account: {
  tenant_id?: string | null;
  user_id: string;
}) {
  return {
    tenantId: account.tenant_id || account.user_id,
    userId: account.user_id,
  };
}
