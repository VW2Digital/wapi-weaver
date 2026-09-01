export function getWebchatAppUrl(): string {
  const raw = process.env.PUBLIC_APP_URL || process.env.APP_URL || "";
  return raw.replace(/\/$/, "");
}

export function getWebchatEmbedCode({
  appUrl,
  publicId,
}: {
  appUrl: string;
  publicId: string;
}): string {
  const base = appUrl.replace(/\/$/, "");
  return `<script
  async
  src="${base}/api/public/webchat/${publicId}/widget/js">
</script>`;
}
