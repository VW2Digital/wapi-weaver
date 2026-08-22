import { dbAdmin } from './src/integrations/mysql/client.server';
import crypto from 'crypto';

async function test() {
  const testId = crypto.randomUUID();
  console.log('Inserting...', testId);
  try {
    const { data, error } = await dbAdmin.from('webhook_events').insert({
      id: testId,
      tenant_id: '6da65e93-4864-43c5-b17b-4c3864a49cfc',
      user_id: '6da65e93-4864-43c5-b17b-4c3864a49cfc',
      source: 'whatsapp',
      raw: { entry: [] },
      payload_json: { test: true },
      processed: true
    }).select('id').single();
    
    console.log('Result:', { data, error });
  } catch (err) {
    console.error('Crash:', err);
  }
  process.exit(0);
}
test();
