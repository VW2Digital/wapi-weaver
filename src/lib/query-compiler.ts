import db from "./db";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// List of allowed tables to query directly
const ALLOWED_TABLES = new Set([
  "profiles",
  "user_roles",
  "platform_settings",
  "audit_logs",
  "schema_backups",
  "salvy_numbers",
  "tags",
  "contacts",
  "contact_tags",
  "conversation_tags",
  "message_tags",
  "lists",
  "list_contacts",
  "messages",
  "templates",
  "campaigns",
  "campaign_messages",
  "webhook_events",
  "direct_messages",
  "whatsapp_business_profile_logs",
  "sales_funnels",
  "sales_stages",
  "opportunity_lost_reasons",
  "opportunities",
  "opportunity_contacts",
  "opportunity_stage_history",
  "opportunity_activities",
  "opportunity_notes",
  "opportunity_tags",
  "opportunity_audit_logs",
  "bot_settings",
  "bot_steps",
  "bot_step_options",
  "bot_conversation_state",
  "ai_agent_settings",
  "knowledge_base",
  "whatsapp_flows",
  "whatsapp_flow_submissions",
  "teams",
  "team_members",
  "conversation_assignments",
]);

// Helper to determine if a table has a user_id column
function hasUserIdColumn(table: string): boolean {
  return [
    "user_roles",
    "audit_logs",
    "salvy_numbers",
    "tags",
    "contacts",
    "contact_tags",
    "conversation_tags",
    "message_tags",
    "lists",
    "list_contacts",
    "templates",
    "campaigns",
    "campaign_messages",
    "webhook_events",
    "direct_messages",
    "whatsapp_business_profile_logs",
    "sales_funnels",
    "sales_stages",
    "opportunity_lost_reasons",
    "opportunities",
    "opportunity_contacts",
    "opportunity_stage_history",
    "opportunity_activities",
    "opportunity_notes",
    "opportunity_tags",
    "opportunity_audit_logs",
    "bot_settings",
    "bot_steps",
    "bot_step_options",
    "bot_conversation_state",
    "ai_agent_settings",
    "knowledge_base",
    "whatsapp_flows",
    "whatsapp_flow_submissions",
    "teams",
    "conversation_assignments",
  ].includes(table);
}

// Helper to format ISO dates to MySQL-compatible datetime format
function formatToMysqlDateTime(val: any): any {
  if (typeof val !== "string") return val;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
    }
  }
  return val;
}

// Convert arrays or objects for JSON columns and booleans for MySQL
function preprocessData(table: string, data: any): any {
  if (!data) return data;
  const processed = { ...data };

  // Remove keys with undefined values to prevent MySQL driver bind errors
  for (const key in processed) {
    if (processed[key] === undefined) {
      delete processed[key];
    }
  }

  // Auto-stringify any remaining objects/arrays (excluding Date and Buffer) to prevent MySQL driver bind errors on TEXT/JSON columns
  for (const key in processed) {
    const val = processed[key];
    if (
      val !== null &&
      typeof val === "object" &&
      !(val instanceof Date) &&
      !Buffer.isBuffer(val)
    ) {
      processed[key] = JSON.stringify(val);
    }
  }

  // Handle boolean values (MySQL uses 1/0)
  for (const key in processed) {
    if (processed[key] === "true" || processed[key] === true) {
      processed[key] = 1;
    } else if (processed[key] === "false" || processed[key] === false) {
      processed[key] = 0;
    }
  }

  return processed;
}

export async function executeQuery(reqQuery: any, userId: string, userRole: string): Promise<any> {
  const {
    table,
    action,
    select,
    data,
    filters = [],
    order = [],
    limit,
    offset,
    upsertConflict,
    head,
    countMode,
  } = reqQuery;

  if (!table || !ALLOWED_TABLES.has(table)) {
    throw new Error(`A tabela '${table}' não é permitida ou não existe`);
  }

  const isSenderAdmin = userRole === "admin";
  const enforceUserRestriction = hasUserIdColumn(table) && !isSenderAdmin;

  let sql = "";
  const params: any[] = [];

  // Build WHERE clause
  const whereClauses: string[] = [];

  // Enforce RLS-like filter on user_id
  if (enforceUserRestriction) {
    whereClauses.push("user_id = ?");
    params.push(userId);
  } else if (table === "profiles" && !isSenderAdmin) {
    whereClauses.push("id = ?");
    params.push(userId);
  }

  // Parse filters passed from the client
  for (const filter of filters) {
    const { type, column, value, operator } = filter;

    // Safety check on column names
    if (!/^[a-zA-Z0-9_]+$/.test(column)) {
      throw new Error(`Nome de coluna inválido: ${column}`);
    }

    if (type === "eq") {
      if (value === null) {
        whereClauses.push(`${column} IS NULL`);
      } else {
        whereClauses.push(`${column} = ?`);
        params.push(value);
      }
    } else if (type === "neq") {
      if (value === null) {
        whereClauses.push(`${column} IS NOT NULL`);
      } else {
        whereClauses.push(`${column} != ?`);
        params.push(value);
      }
    } else if (type === "in") {
      if (Array.isArray(value) && value.length > 0) {
        const placeholders = value.map(() => "?").join(",");
        whereClauses.push(`${column} IN (${placeholders})`);
        params.push(...value);
      } else {
        whereClauses.push("1 = 0");
      }
    } else if (type === "gte") {
      whereClauses.push(`${column} >= ?`);
      params.push(value);
    } else if (type === "lte") {
      whereClauses.push(`${column} <= ?`);
      params.push(value);
    } else if (type === "gt") {
      whereClauses.push(`${column} > ?`);
      params.push(value);
    } else if (type === "lt") {
      whereClauses.push(`${column} < ?`);
      params.push(value);
    } else if (type === "like") {
      whereClauses.push(`${column} LIKE ?`);
      params.push(value);
    } else if (type === "ilike") {
      whereClauses.push(`LOWER(${column}) LIKE LOWER(?)`);
      params.push(value);
    } else if (type === "is") {
      if (value === null) {
        whereClauses.push(`${column} IS NULL`);
      } else if (typeof value === "boolean") {
        whereClauses.push(`${column} = ?`);
        params.push(value ? 1 : 0);
      } else {
        whereClauses.push(`${column} = ?`);
        params.push(value);
      }
    } else if (type === "not") {
      const op = operator;
      if (op === "is") {
        if (value === null) {
          whereClauses.push(`${column} IS NOT NULL`);
        } else if (typeof value === "boolean") {
          whereClauses.push(`${column} != ?`);
          params.push(value ? 1 : 0);
        } else {
          whereClauses.push(`${column} != ?`);
          params.push(value);
        }
      } else if (op === "eq") {
        if (value === null) {
          whereClauses.push(`${column} IS NOT NULL`);
        } else {
          whereClauses.push(`${column} != ?`);
          params.push(value);
        }
      } else if (op === "in") {
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => "?").join(",");
          whereClauses.push(`${column} NOT IN (${placeholders})`);
          params.push(...value);
        } else {
          whereClauses.push("1 = 1");
        }
      } else {
        whereClauses.push(`NOT (${column} = ?)`);
        params.push(value);
      }
    }
  }

  const whereString = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(" AND ")}` : "";

  let isListContactsWithContacts = false;
  let isCampaignMessagesWithContacts = false;
  let isContactTagsWithTags = false;
  let isConversationTagsWithTags = false;
  let isMessageTagsWithTags = false;

  if (action === "select") {
    let colSelection = "*";
    if (select && select !== "*") {
      if (Array.isArray(select)) {
        colSelection = select.map((c) => {
          return c.includes("(") || c.includes("*") || c.includes(" ") ? c : `\`${c}\``;
        }).join(", ");
      } else if (typeof select === "string") {
        colSelection = select;
      }
    }

    // HEAD mode: just return a COUNT — no data rows
    if (head === true) {
      sql = `SELECT COUNT(*) AS \`_count\` FROM \`${table}\`${whereString}`;
      const countResult = await db.query(sql, params);
      const totalCount = countResult?.[0]?._count ?? 0;
      return { _headCount: Number(totalCount) };
    }

    // Translate PostgreSQL relation counts into MySQL subqueries
    if (colSelection.includes("list_contacts(count)")) {
      colSelection = colSelection.replace(
        "list_contacts(count)",
        "(SELECT COUNT(*) FROM `list_contacts` WHERE `list_contacts`.`list_id` = `lists`.`id`) AS `list_contacts_count`",
      );
    }

    if (
      table === "list_contacts" &&
      (colSelection.includes("contacts(") || colSelection.includes("contacts(*)"))
    ) {
      isListContactsWithContacts = true;
      sql = `SELECT 
        \`list_contacts\`.\`list_id\`, 
        \`list_contacts\`.\`contact_id\`, 
        \`list_contacts\`.\`user_id\`, 
        \`list_contacts\`.\`added_at\`,
        \`contacts\`.\`id\` AS \`c_id\`,
        \`contacts\`.\`user_id\` AS \`c_user_id\`,
        \`contacts\`.\`phone_e164\` AS \`c_phone_e164\`,
        \`contacts\`.\`name\` AS \`c_name\`,
        \`contacts\`.\`email\` AS \`c_email\`,
        \`contacts\`.\`source\` AS \`c_source\`,
        \`contacts\`.\`opted_out\` AS \`c_opted_out\`,
        \`contacts\`.\`custom_fields\` AS \`c_custom_fields\`,
        \`contacts\`.\`created_at\` AS \`c_created_at\`,
        \`contacts\`.\`updated_at\` AS \`c_updated_at\`
      FROM \`list_contacts\`
      LEFT JOIN \`contacts\` ON \`list_contacts\`.\`contact_id\` = \`contacts\`.\`id\`
      ${whereString}`;
    } else if (
      table === "campaign_messages" &&
      (colSelection.includes("contacts(") || colSelection.includes("contacts(*)"))
    ) {
      isCampaignMessagesWithContacts = true;
      // Strip contacts(...) from colSelection and build explicit JOIN columns
      const baseCol = colSelection
        .replace(/,?\s*contacts\([^)]*\)/g, "")
        .trim()
        .replace(/^,|,$/, "")
        .trim();
      const base =
        baseCol && baseCol !== "*"
          ? `\`campaign_messages\`.${baseCol
              .split(",")
              .map((c: string) => (c.trim().startsWith("`") ? c.trim() : `\`${c.trim()}\``))
              .join(", `campaign_messages`.")}`
          : "`campaign_messages`.*";
      sql = `SELECT 
        ${base},
        \`contacts\`.\`name\` AS \`c_contact_name\`,
        \`contacts\`.\`email\` AS \`c_contact_email\`,
        \`contacts\`.\`custom_fields\` AS \`c_contact_custom_fields\`
      FROM \`campaign_messages\`
      LEFT JOIN \`contacts\` ON \`campaign_messages\`.\`contact_id\` = \`contacts\`.\`id\`
      ${whereString}`;
    } else if (
      table === "contact_tags" &&
      (colSelection.includes("tags(") || colSelection.includes("tags(*)"))
    ) {
      isContactTagsWithTags = true;
      sql = `SELECT 
        \`contact_tags\`.\`contact_id\`,
        \`contact_tags\`.\`tag_id\`,
        \`contact_tags\`.\`user_id\`,
        \`tags\`.\`id\` AS \`t_id\`,
        \`tags\`.\`name\` AS \`t_name\`,
        \`tags\`.\`color\` AS \`t_color\`,
        \`tags\`.\`created_at\` AS \`t_created_at\`
      FROM \`contact_tags\`
      LEFT JOIN \`tags\` ON \`contact_tags\`.\`tag_id\` = \`tags\`.\`id\`
      ${whereString}`;
    } else if (
      table === "conversation_tags" &&
      (colSelection.includes("tags(") || colSelection.includes("tags(*)"))
    ) {
      isConversationTagsWithTags = true;
      sql = `SELECT 
        \`conversation_tags\`.\`contact_number\`,
        \`conversation_tags\`.\`tag_id\`,
        \`conversation_tags\`.\`user_id\`,
        \`tags\`.\`id\` AS \`t_id\`,
        \`tags\`.\`name\` AS \`t_name\`,
        \`tags\`.\`color\` AS \`t_color\`,
        \`tags\`.\`created_at\` AS \`t_created_at\`
      FROM \`conversation_tags\`
      LEFT JOIN \`tags\` ON \`conversation_tags\`.\`tag_id\` = \`tags\`.\`id\`
      ${whereString}`;
    } else if (
      table === "message_tags" &&
      (colSelection.includes("tags(") || colSelection.includes("tags(*)"))
    ) {
      isMessageTagsWithTags = true;
      sql = `SELECT 
        \`message_tags\`.\`message_id\`,
        \`message_tags\`.\`tag_id\`,
        \`message_tags\`.\`user_id\`,
        \`tags\`.\`id\` AS \`t_id\`,
        \`tags\`.\`name\` AS \`t_name\`,
        \`tags\`.\`color\` AS \`t_color\`,
        \`tags\`.\`created_at\` AS \`t_created_at\`
      FROM \`message_tags\`
      LEFT JOIN \`tags\` ON \`message_tags\`.\`tag_id\` = \`tags\`.\`id\`
      ${whereString}`;
    } else {
      sql = `SELECT ${colSelection} FROM \`${table}\`${whereString}`;
    }

    // Add ORDER BY
    if (order && order.length > 0) {
      const orderClauses = order.map((o: any) => {
        const dir = o.ascending ? "ASC" : "DESC";
        if (isListContactsWithContacts) {
          return `\`list_contacts\`.\`${o.column}\` ${dir}`;
        }
        if (isCampaignMessagesWithContacts) {
          return `\`campaign_messages\`.\`${o.column}\` ${dir}`;
        }
        if (isConversationTagsWithTags) {
          return `\`conversation_tags\`.\`${o.column}\` ${dir}`;
        }
        if (isMessageTagsWithTags) {
          return `\`message_tags\`.\`${o.column}\` ${dir}`;
        }
        return `\`${o.column}\` ${dir}`;
      });
      sql += ` ORDER BY ${orderClauses.join(", ")}`;
    }

    // When count:'exact' is requested, run a parallel COUNT query
    let totalCount: number | null = null;
    if (countMode === "exact") {
      const countSql = `SELECT COUNT(*) AS \`_count\` FROM \`${table}\`${whereString}`;
      const countRes = await db.query(countSql, params);
      totalCount = Number(countRes?.[0]?._count ?? 0);
    }

    // Add LIMIT and OFFSET
    if (limit !== undefined && limit !== null) {
      const parsedLimit = parseInt(limit, 10);
      if (Number.isNaN(parsedLimit) || parsedLimit < 0) {
        throw new Error(`Valor de LIMIT inválido: ${limit}`);
      }
      sql += ` LIMIT ${parsedLimit}`;

      if (offset !== undefined && offset !== null) {
        const parsedOffset = parseInt(offset, 10);
        if (Number.isNaN(parsedOffset) || parsedOffset < 0) {
          throw new Error(`Valor de OFFSET inválido: ${offset}`);
        }
        sql += ` OFFSET ${parsedOffset}`;
      }
    }

    const results = await db.query(sql, params);

    // Post-process custom count subqueries back to Supabase-like nested arrays
    if (table === "lists" && Array.isArray(results)) {
      for (const row of results) {
        if ("list_contacts_count" in row) {
          row.list_contacts = [{ count: row.list_contacts_count || 0 }];
          delete row.list_contacts_count;
        }
      }
    }

    if (isListContactsWithContacts && Array.isArray(results)) {
      for (const row of results) {
        if (row.c_id) {
          row.contacts = {
            id: row.c_id,
            user_id: row.c_user_id,
            phone_e164: row.c_phone_e164,
            name: row.c_name,
            email: row.c_email,
            source: row.c_source,
            opted_out: row.c_opted_out === 1 || row.c_opted_out === true,
            custom_fields: row.c_custom_fields,
            created_at: row.c_created_at,
            updated_at: row.c_updated_at,
          };
          if (
            typeof row.contacts.custom_fields === "string" &&
            (row.contacts.custom_fields.startsWith("{") ||
              row.contacts.custom_fields.startsWith("["))
          ) {
            try {
              row.contacts.custom_fields = JSON.parse(row.contacts.custom_fields);
            } catch (e) {
              console.warn("Failed to parse custom_fields for list_contacts", e);
            }
          }
        } else {
          row.contacts = null;
        }
        delete row.c_id;
        delete row.c_user_id;
        delete row.c_phone_e164;
        delete row.c_name;
        delete row.c_email;
        delete row.c_source;
        delete row.c_opted_out;
        delete row.c_custom_fields;
        delete row.c_created_at;
        delete row.c_updated_at;
      }
    }

    // Post-process campaign_messages JOIN contacts
    if (isCampaignMessagesWithContacts && Array.isArray(results)) {
      for (const row of results) {
        row.contacts =
          row.c_contact_name !== null ||
          row.c_contact_email !== null ||
          row.c_contact_custom_fields !== null
            ? {
                name: row.c_contact_name ?? null,
                email: row.c_contact_email ?? null,
                custom_fields: row.c_contact_custom_fields ?? null,
              }
            : null;
        if (
          row.contacts &&
          typeof row.contacts.custom_fields === "string" &&
          (row.contacts.custom_fields.startsWith("{") || row.contacts.custom_fields.startsWith("["))
        ) {
          try {
            row.contacts.custom_fields = JSON.parse(row.contacts.custom_fields);
          } catch (e) {
            console.warn("Failed to parse custom_fields for campaign_messages", e);
          }
        }
        delete row.c_contact_name;
        delete row.c_contact_email;
        delete row.c_contact_custom_fields;
      }
    }

    // Post-process contact_tags JOIN tags
    if (isContactTagsWithTags && Array.isArray(results)) {
      for (const row of results) {
        if (row.t_id) {
          row.tags = {
            id: row.t_id,
            name: row.t_name,
            color: row.t_color,
            created_at: row.t_created_at,
          };
        } else {
          row.tags = null;
        }
        delete row.t_id;
        delete row.t_name;
        delete row.t_color;
        delete row.t_created_at;
      }
    }

    // Post-process conversation_tags JOIN tags
    if (isConversationTagsWithTags && Array.isArray(results)) {
      for (const row of results) {
        if (row.t_id) {
          row.tags = {
            id: row.t_id,
            name: row.t_name,
            color: row.t_color,
            created_at: row.t_created_at,
          };
        } else {
          row.tags = null;
        }
        delete row.t_id;
        delete row.t_name;
        delete row.t_color;
        delete row.t_created_at;
      }
    }

    // Post-process message_tags JOIN tags
    if (isMessageTagsWithTags && Array.isArray(results)) {
      for (const row of results) {
        if (row.t_id) {
          row.tags = {
            id: row.t_id,
            name: row.t_name,
            color: row.t_color,
            created_at: row.t_created_at,
          };
        } else {
          row.tags = null;
        }
        delete row.t_id;
        delete row.t_name;
        delete row.t_color;
        delete row.t_created_at;
      }
    }

    // Parse JSON columns back to objects/arrays for consistency with Supabase response
    if (Array.isArray(results)) {
      for (const row of results) {
        for (const key in row) {
          const val = row[key];
          if (typeof val === "string" && (val.startsWith("{") || val.startsWith("["))) {
            try {
              row[key] = JSON.parse(val);
            } catch (e) {
               // Ignorado: string não era JSON válido
            }
          }
        }
      }
    }

    // Return with totalCount if countMode was requested
    if (totalCount !== null) {
      return { _rows: results, _totalCount: totalCount };
    }

    return results;
  } else if (action === "insert") {
    const isArray = Array.isArray(data);
    const dataList = isArray ? data : [data];

    let totalAffectedRows = 0;
    const insertedIds: any[] = [];

    const results = await db.transaction(async (conn) => {
      for (const row of dataList) {
        const insertData = preprocessData(table, row);

        // Preprocess date strings in each row
        for (const key in insertData) {
          insertData[key] = formatToMysqlDateTime(insertData[key]);
        }

        // Generate UUID if not provided
        if (
          !insertData.id &&
          table !== "platform_settings" &&
          table !== "list_contacts" &&
          table !== "contact_tags" &&
          table !== "conversation_tags" &&
          table !== "message_tags"
        ) {
          insertData.id = generateUUID();
        }

        // Fill user_id from the executing context ONLY when it is absent from the payload.
        // Never override an explicitly-provided user_id (e.g. webhook inserting on behalf of a matched user).
        if (hasUserIdColumn(table) && !insertData.user_id) {
          insertData.user_id = userId;
        }

        const columns = Object.keys(insertData);
        const placeholders = columns.map(() => "?").join(", ");
        const values = Object.values(insertData).map((v) => (v === undefined ? null : v));

        let sqlQuery = `INSERT INTO \`${table}\` (${columns.map((c) => `\`${c}\``).join(", ")}) VALUES (${placeholders})`;

        if (upsertConflict) {
          const updateAssigns = columns
            .filter((c) => c !== "id" && c !== "user_id" && c !== "created_at")
            .map((c) => `\`${c}\` = VALUES(\`${c}\`)`)
            .join(", ");

          if (updateAssigns.length > 0) {
            sqlQuery += ` ON DUPLICATE KEY UPDATE ${updateAssigns}`;
          }
        }

        const [res]: any = await (conn as any).execute(sqlQuery, values);
        totalAffectedRows += res.affectedRows;
        insertedIds.push(insertData.id || res.insertId);
      }
      return { insertedIds, totalAffectedRows };
    });

    if (!isArray) {
      const singleData = dataList[0] || {};
      let rows: any[] = [];

      if (table === "list_contacts" && singleData.list_id && singleData.contact_id) {
        rows = await db.query(
          `SELECT * FROM \`list_contacts\` WHERE \`list_id\` = ? AND \`contact_id\` = ?`,
          [singleData.list_id, singleData.contact_id],
        );
      } else if (table === "contact_tags" && singleData.contact_id && singleData.tag_id) {
        rows = await db.query(
          `SELECT * FROM \`contact_tags\` WHERE \`contact_id\` = ? AND \`tag_id\` = ?`,
          [singleData.contact_id, singleData.tag_id],
        );
      } else if (table === "conversation_tags" && singleData.contact_number && singleData.tag_id) {
        rows = await db.query(
          `SELECT * FROM \`conversation_tags\` WHERE \`contact_number\` = ? AND \`tag_id\` = ?`,
          [singleData.contact_number, singleData.tag_id],
        );
      } else if (table === "message_tags" && singleData.message_id && singleData.tag_id) {
        rows = await db.query(
          `SELECT * FROM \`message_tags\` WHERE \`message_id\` = ? AND \`tag_id\` = ?`,
          [singleData.message_id, singleData.tag_id],
        );
      } else {
        let pkCol = "id";
        let pkVal = results.insertedIds[0];
        if (table === "platform_settings") {
          pkCol = "id";
          pkVal = singleData.id || 1;
        }

        if (pkVal) {
          rows = await db.query(`SELECT * FROM \`${table}\` WHERE \`${pkCol}\` = ?`, [pkVal]);

          // Fallback: If no rows found, we might have hit a duplicate key during upsert
          if (rows.length === 0) {
            if (table === "contacts" && singleData.phone_e164) {
              rows = await db.query(
                `SELECT * FROM \`contacts\` WHERE \`user_id\` = ? AND \`phone_e164\` = ?`,
                [singleData.user_id || userId, singleData.phone_e164],
              );
            } else if (table === "tags" && singleData.name) {
              rows = await db.query(
                `SELECT * FROM \`tags\` WHERE \`user_id\` = ? AND \`name\` = ?`,
                [singleData.user_id || userId, singleData.name],
              );
            } else if (table === "user_roles" && singleData.role) {
              rows = await db.query(
                `SELECT * FROM \`user_roles\` WHERE \`user_id\` = ? AND \`role\` = ?`,
                [singleData.user_id || userId, singleData.role],
              );
            } else if (table === "salvy_numbers" && singleData.salvy_id) {
              rows = await db.query(
                `SELECT * FROM \`salvy_numbers\` WHERE \`user_id\` = ? AND \`salvy_id\` = ?`,
                [singleData.user_id || userId, singleData.salvy_id],
              );
            } else if (table === "templates" && singleData.name && singleData.language) {
              rows = await db.query(
                `SELECT * FROM \`templates\` WHERE \`user_id\` = ? AND \`name\` = ? AND \`language\` = ?`,
                [singleData.user_id || userId, singleData.name, singleData.language],
              );
            }
          }
        }
      }

      if (rows.length > 0) {
        const row = rows[0];
        // Parse JSON columns back
        for (const key in row) {
          const val = row[key];
          if (typeof val === "string" && (val.startsWith("{") || val.startsWith("["))) {
            try {
              row[key] = JSON.parse(val);
            } catch (e) {
              // Ignorado
            }
          }
        }
        return row;
      }

      const pkVal = results.insertedIds[0];
      return { id: pkVal, affectedRows: results.totalAffectedRows };
    }

    return { affectedRows: results.totalAffectedRows };
  } else if (action === "update") {
    if (whereClauses.length === 0) {
      throw new Error("UPDATE without WHERE filters is not permitted via API");
    }
    const updateData = preprocessData(table, data);

    // Format datetime fields
    for (const key in updateData) {
      updateData[key] = formatToMysqlDateTime(updateData[key]);
    }

    const columns = Object.keys(updateData).filter(
      (c) => c !== "id" && c !== "user_id" && c !== "created_at",
    );

    if (columns.length === 0) {
      return [];
    }

    const setClauses = columns.map((c) => `\`${c}\` = ?`).join(", ");
    const values = columns.map((c) => updateData[c]);

    sql = `UPDATE \`${table}\` SET ${setClauses}${whereString}`;
    const allParams = [...values, ...params];

    const result = await db.query(sql, allParams);

    // Return the updated rows to satisfy client-side updates (select().single(), etc.)
    try {
      const updatedRows = await db.query(`SELECT * FROM \`${table}\`${whereString}`, params);
      if (Array.isArray(updatedRows)) {
        for (const row of updatedRows) {
          for (const key in row) {
            const val = row[key];
            if (typeof val === "string" && (val.startsWith("{") || val.startsWith("["))) {
              try {
                row[key] = JSON.parse(val);
              } catch (e) {
                // Ignorado
              }
            }
          }
        }
      }
      return updatedRows;
    } catch (e) {
      return { affectedRows: result.affectedRows };
    }
  } else if (action === "delete") {
    if (whereClauses.length === 0) {
      throw new Error("DELETE without WHERE filters is not permitted via API");
    }
    sql = `DELETE FROM \`${table}\`${whereString}`;
    const result = await db.query(sql, params);
    return { affectedRows: result.affectedRows };
  }

  throw new Error(`Ação de consulta não suportada: ${action}`);
}
