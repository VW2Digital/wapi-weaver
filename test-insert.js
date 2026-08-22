import('./src/lib/db.ts').then(async ({ default: db }) => {
  try {
    const r = await db.query('INSERT INTO webhook_events (id, tenant_id, user_id, source, raw, payload_json, processed) VALUES (UUID(), "6da65e93-4864-43c5-b17b-4c3864a49cfc", "6da65e93-4864-43c5-b17b-4c3864a49cfc", "whatsapp", "{}", "{}", 1)');
    console.log('Insert success:', r);
  } catch (e) {
    console.error('Insert error:', e);
  }
  process.exit(0);
});
