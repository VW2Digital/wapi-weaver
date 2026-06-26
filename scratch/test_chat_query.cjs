const mysql = require("mysql2/promise");

const dbConfigLocal = {
  host: "localhost",
  port: 3306,
  user: "wapi_user",
  password: "S0xbxPfKazBVT8JFy1UEOjIsrjox",
  database: "wapi_weaver",
};

const userId = "acff3186-4e4a-4242-a7a5-3e519265b244";

async function run() {
  let conn;
  try {
    conn = await mysql.createConnection(dbConfigLocal);
    console.log("Connected to MySQL.");

    // Query 1: Test the EXACT SQL used in listChatContacts
    const sql = `
      SELECT 
        c.id, 
        c.name, 
        c.phone_e164, 
        c.custom_fields,
        c.email,
        c.source,
        c.opted_out,
        c.is_pinned,
        c.is_archived,
        c.chat_status,
        c.is_unread,
        c.kanban_stage_id,
        c.created_at,
        c.updated_at,
        COALESCE((
          SELECT bcs.bot_active 
          FROM bot_conversation_state bcs 
          WHERE bcs.user_id = c.user_id AND bcs.contact_number = c.phone_e164
          LIMIT 1
        ), 1) AS bot_active,
        (
          SELECT dm.body 
          FROM direct_messages dm 
          WHERE dm.user_id = c.user_id AND dm.contact_phone = c.phone_e164
          ORDER BY dm.created_at DESC 
          LIMIT 1
        ) AS last_message_body,
        (
          SELECT dm.created_at 
          FROM direct_messages dm 
          WHERE dm.user_id = c.user_id AND dm.contact_phone = c.phone_e164
          ORDER BY dm.created_at DESC 
          LIMIT 1
        ) AS last_message_time,
        GREATEST(
          COALESCE(c.is_unread, 0),
          (
            SELECT COUNT(*) 
            FROM direct_messages dm 
            WHERE dm.user_id = c.user_id AND dm.contact_phone = c.phone_e164 
              AND dm.direction = 'incoming' AND dm.status != 'read'
          )
        ) AS unread_count,
        ca.team_id AS active_team_id,
        ca.agent_id AS active_agent_id,
        t.name AS active_team_name,
        COALESCE(p.full_name, p.display_name, u.email) AS active_agent_name,
        s.name AS kanban_stage_name,
        s.color AS kanban_stage_color
      FROM contacts c
      LEFT JOIN conversation_assignments ca 
        ON ca.contact_phone = c.phone_e164 AND ca.user_id = c.user_id AND ca.is_active = true
      LEFT JOIN teams t ON t.id = ca.team_id
      LEFT JOIN users u ON u.id = ca.agent_id
      LEFT JOIN profiles p ON p.id = u.id
      LEFT JOIN sales_stages s ON s.id = c.kanban_stage_id
      WHERE c.user_id = ?
        AND EXISTS (
          SELECT 1 FROM direct_messages dm
          WHERE dm.user_id = c.user_id AND dm.contact_phone = c.phone_e164
        )
      ORDER BY 
        c.is_pinned DESC,
        COALESCE(
          (
            SELECT dm.created_at 
            FROM direct_messages dm 
            WHERE dm.user_id = c.user_id AND dm.contact_phone = c.phone_e164
            ORDER BY dm.created_at DESC 
            LIMIT 1
          ),
          c.created_at
        ) DESC
    `;

    console.log("Executing query...");
    const [rows] = await conn.query(sql, [userId]);
    console.log("Query completed. Row count:", rows.length);
    console.log("Rows:", rows);
  } catch (err) {
    console.error("Error executing query:", err);
  } finally {
    if (conn) await conn.end();
  }
}

run().catch(console.error);
