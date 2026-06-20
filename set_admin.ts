import db from './src/lib/db';
async function run() {
  const r = await db.query("INSERT INTO user_roles (id, user_id, role) VALUES (UUID(), '623653a8-2245-4246-9a6a-19198c49beb0', 'admin') ON DUPLICATE KEY UPDATE role='admin'");
  console.log('Updated admin:', r);
  process.exit();
}
run();
