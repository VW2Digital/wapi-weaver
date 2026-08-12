import db from "../src/lib/db.ts";
import bcrypt from "bcryptjs";

async function verify() {
  const email = "vanderleivw2@gmail.com";
  const pass = "vanderleivw2";

  const users = await db.query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
  if (users.length === 0) {
    console.log(`User ${email} not found. Creating user...`);
    const hash = await bcrypt.hash(pass, 10);
    const id = "vanderlei-test-uid";
    await db.query(
      "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, NOW())",
      [id, email, hash]
    );
    await db.query("INSERT INTO user_roles (user_id, role) VALUES (?, 'admin_master')", [id]);
    console.log(`User ${email} created successfully with password ${pass}!`);
  } else {
    const user = users[0];
    const match = await bcrypt.compare(pass, user.password_hash);
    if (!match) {
      console.log(`Password for ${email} did not match. Updating password hash to '${pass}'...`);
      const hash = await bcrypt.hash(pass, 10);
      await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [hash, user.id]);
      console.log(`Password hash updated for ${email}!`);
    } else {
      console.log(`User ${email} password match SUCCESS!`);
    }
  }
  process.exit(0);
}

verify().catch((err) => {
  console.error(err);
  process.exit(1);
});
