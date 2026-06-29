// reset-sidebar-order.js
// Reset the sidebar_order in the database to NULL
// Run with: node reset-sidebar-order.js

import mysql from 'mysql2/promise';
import { config } from 'dotenv';

config();

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const [before] = await conn.query('SELECT sidebar_order FROM platform_settings WHERE id = 1');
console.log('Before:', before[0]?.sidebar_order ? 'Has custom order' : 'Already NULL');

await conn.query('UPDATE platform_settings SET sidebar_order = NULL WHERE id = 1');
console.log('✓ sidebar_order cleared. Menu will now use default NAV order.');

await conn.end();
