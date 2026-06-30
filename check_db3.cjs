const mysql = require('mysql2/promise');
async function check() {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'wapi_user',
    password: 'S0xbxPfKazBVT8JFy1UEOjIsrjox',
    database: 'wapi_weaver', port: 3306,
  });
  try {
    const [teams] = await conn.execute("SELECT id, user_id, name FROM teams");
    console.log("=== TEAMS ===");
    if (teams.length === 0) console.log("  (none)");
    for (const t of teams) console.log(`  id: ${t.id.slice(0,8)}... | owner: ${t.user_id.slice(0,8)}... | name: ${t.name}`);

    const [members] = await conn.execute("SELECT tm.user_id, tm.team_id FROM team_members tm");
    console.log("\n=== TEAM MEMBERS ===");
    if (members.length === 0) console.log("  (none)");
    for (const m of members) console.log(`  user_id: ${m.user_id.slice(0,8)}... | team_id: ${m.team_id.slice(0,8)}...`);

    // What resolveEffectiveUserId returns for each user
    const [users] = await conn.execute("SELECT id, email FROM users");
    for (const u of users) {
      const [rows] = await conn.execute(
        `SELECT t.user_id FROM team_members tm
         JOIN teams t ON t.id = tm.team_id
         WHERE tm.user_id = ? LIMIT 1`,
        [u.id]
      );
      const effectiveId = rows?.[0]?.user_id ?? u.id;
      console.log(`\n  user ${u.email} (${u.id.slice(0,8)}...)`);
      console.log(`    resolveEffectiveUserId -> ${effectiveId.slice(0,8)}...`);
    }
  } finally {
    await conn.end();
  }
}
check().catch(e => console.error('ERROR:', e.message));
