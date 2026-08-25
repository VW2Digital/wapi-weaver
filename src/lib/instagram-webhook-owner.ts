export function resolveInstagramChatOwnerId(account: {
  tenant_id?: string | null;
  user_id: string;
}) {
  return account.tenant_id || account.user_id;
}
