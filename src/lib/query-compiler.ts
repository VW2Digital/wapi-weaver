import db from './db';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// List of allowed tables to query directly
const ALLOWED_TABLES = new Set([
  'profiles',
  'user_roles',
  'platform_settings',
  'audit_logs',
  'schema_backups',
  'salvy_numbers',
  'tags',
  'contacts',
  'contact_tags',
  'lists',
  'list_contacts',
  'templates',
  'campaigns',
  'campaign_messages',
  'webhook_events'
]);

// Helper to determine if a table has a user_id column
function hasUserIdColumn(table: string): boolean {
  return [
    'user_roles',
    'audit_logs',
    'salvy_numbers',
    'tags',
    'contacts',
    'contact_tags',
    'lists',
    'list_contacts',
    'templates',
    'campaigns',
    'campaign_messages',
    'webhook_events'
  ].includes(table);
}

// Helper to format ISO dates to MySQL-compatible datetime format
function formatToMysqlDateTime(val: any): any {
  if (typeof val !== 'string') return val;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
    }
  }
  return val;
}

// Convert arrays or objects for JSON columns and booleans for MySQL
function preprocessData(table: string, data: any): any {
  if (!data) return data;
  const processed = { ...data };

  // Auto-stringify any remaining objects/arrays (excluding Date and Buffer) to prevent MySQL driver bind errors on TEXT/JSON columns
  for (const key in processed) {
    const val = processed[key];
    if (val !== null && typeof val === 'object' && !(val instanceof Date) && !Buffer.isBuffer(val)) {
      processed[key] = JSON.stringify(val);
    }
  }

  // Handle boolean values (MySQL uses 1/0)
  for (const key in processed) {
    if (processed[key] === 'true' || processed[key] === true) {
      processed[key] = 1;
    } else if (processed[key] === 'false' || processed[key] === false) {
      processed[key] = 0;
    }
  }

  return processed;
}

export async function executeQuery(reqQuery: any, userId: string, userRole: string): Promise<any> {
  const { table, action, select, data, filters = [], order = [], limit, offset, upsertConflict } = reqQuery;

  if (!table || !ALLOWED_TABLES.has(table)) {
    throw new Error(`Table '${table}' is not allowed or does not exist`);
  }

  const isSenderAdmin = userRole === 'admin';
  const enforceUserRestriction = hasUserIdColumn(table) && !isSenderAdmin;

  let sql = '';
  const params: any[] = [];

  // Build WHERE clause
  const whereClauses: string[] = [];

  // Enforce RLS-like filter on user_id
  if (enforceUserRestriction) {
    whereClauses.push('user_id = ?');
    params.push(userId);
  } else if (table === 'profiles' && !isSenderAdmin) {
    whereClauses.push('id = ?');
    params.push(userId);
  }

  // Parse filters passed from the client
  for (const filter of filters) {
    const { type, column, value, operator } = filter;
    
    // Safety check on column names
    if (!/^[a-zA-Z0-9_]+$/.test(column)) {
      throw new Error(`Invalid column name: ${column}`);
    }

    if (type === 'eq') {
      if (value === null) {
        whereClauses.push(`${column} IS NULL`);
      } else {
        whereClauses.push(`${column} = ?`);
        params.push(value);
      }
    } else if (type === 'neq') {
      if (value === null) {
        whereClauses.push(`${column} IS NOT NULL`);
      } else {
        whereClauses.push(`${column} != ?`);
        params.push(value);
      }
    } else if (type === 'in') {
      if (Array.isArray(value) && value.length > 0) {
        const placeholders = value.map(() => '?').join(',');
        whereClauses.push(`${column} IN (${placeholders})`);
        params.push(...value);
      } else {
        whereClauses.push('1 = 0');
      }
    } else if (type === 'gte') {
      whereClauses.push(`${column} >= ?`);
      params.push(value);
    } else if (type === 'lte') {
      whereClauses.push(`${column} <= ?`);
      params.push(value);
    } else if (type === 'gt') {
      whereClauses.push(`${column} > ?`);
      params.push(value);
    } else if (type === 'lt') {
      whereClauses.push(`${column} < ?`);
      params.push(value);
    } else if (type === 'like') {
      whereClauses.push(`${column} LIKE ?`);
      params.push(value);
    } else if (type === 'ilike') {
      whereClauses.push(`LOWER(${column}) LIKE LOWER(?)`);
      params.push(value);
    } else if (type === 'is') {
      if (value === null) {
        whereClauses.push(`${column} IS NULL`);
      } else if (typeof value === 'boolean') {
        whereClauses.push(`${column} = ?`);
        params.push(value ? 1 : 0);
      } else {
        whereClauses.push(`${column} = ?`);
        params.push(value);
      }
    } else if (type === 'not') {
      const op = operator;
      if (op === 'is') {
        if (value === null) {
          whereClauses.push(`${column} IS NOT NULL`);
        } else if (typeof value === 'boolean') {
          whereClauses.push(`${column} != ?`);
          params.push(value ? 1 : 0);
        } else {
          whereClauses.push(`${column} != ?`);
          params.push(value);
        }
      } else if (op === 'eq') {
        if (value === null) {
          whereClauses.push(`${column} IS NOT NULL`);
        } else {
          whereClauses.push(`${column} != ?`);
          params.push(value);
        }
      } else if (op === 'in') {
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => '?').join(',');
          whereClauses.push(`${column} NOT IN (${placeholders})`);
          params.push(...value);
        } else {
          whereClauses.push('1 = 1');
        }
      } else {
        whereClauses.push(`NOT (${column} = ?)`);
        params.push(value);
      }
    }
  }

  const whereString = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';

  if (action === 'select') {
    let colSelection = '*';
    if (select && select !== '*') {
      if (Array.isArray(select)) {
        colSelection = select.map(c => `\`${c}\``).join(', ');
      } else if (typeof select === 'string') {
        colSelection = select;
      }
    }

    sql = `SELECT ${colSelection} FROM \`${table}\`${whereString}`;

    // Add ORDER BY
    if (order && order.length > 0) {
      const orderClauses = order.map((o: any) => {
        const dir = o.ascending ? 'ASC' : 'DESC';
        return `\`${o.column}\` ${dir}`;
      });
      sql += ` ORDER BY ${orderClauses.join(', ')}`;
    }

    // Add LIMIT and OFFSET
    if (limit !== undefined && limit !== null) {
      const parsedLimit = parseInt(limit, 10);
      if (Number.isNaN(parsedLimit) || parsedLimit < 0) {
        throw new Error(`Invalid LIMIT value: ${limit}`);
      }
      sql += ` LIMIT ${parsedLimit}`;
      
      if (offset !== undefined && offset !== null) {
        const parsedOffset = parseInt(offset, 10);
        if (Number.isNaN(parsedOffset) || parsedOffset < 0) {
          throw new Error(`Invalid OFFSET value: ${offset}`);
        }
        sql += ` OFFSET ${parsedOffset}`;
      }
    }

    const results = await db.query(sql, params);
    
    // Parse JSON columns back to objects/arrays for consistency with Supabase response
    if (Array.isArray(results)) {
      for (const row of results) {
        for (const key in row) {
          const val = row[key];
          if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
            try {
              row[key] = JSON.parse(val);
            } catch (e) {
              // Ignore invalid JSON string parsing
            }
          }
        }
      }
    }
    
    return results;

  } else if (action === 'insert') {
    const isArray = Array.isArray(data);
    const dataList = isArray ? data : [data];

    // Fetch all existing user IDs once to validate foreign keys
    const userRows = await db.query('SELECT id FROM users');
    const existingUserIds = new Set(userRows.map((u: any) => u.id));

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
        if (!insertData.id && table !== 'platform_settings') {
          insertData.id = generateUUID();
        }

        // Validate user_id to prevent foreign key errors (use executing user's ID as fallback)
        if (hasUserIdColumn(table)) {
          if (!insertData.user_id || !existingUserIds.has(insertData.user_id)) {
            insertData.user_id = userId;
          }
        }

        const columns = Object.keys(insertData);
        const placeholders = columns.map(() => '?').join(', ');
        const values = Object.values(insertData);

        let sqlQuery = `INSERT INTO \`${table}\` (${columns.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`;

        if (upsertConflict) {
          const updateAssigns = columns
            .filter(c => c !== 'id' && c !== 'user_id' && c !== 'created_at')
            .map(c => `\`${c}\` = VALUES(\`${c}\`)`)
            .join(', ');

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
      let pkCol = 'id';
      let pkVal = results.insertedIds[0];
      if (table === 'platform_settings') {
        pkCol = 'id';
        pkVal = singleData.id || 1;
      }

      if (pkVal) {
        const rows = await db.query(`SELECT * FROM \`${table}\` WHERE \`${pkCol}\` = ?`, [pkVal]);
        if (rows.length > 0) {
          const row = rows[0];
          // Parse JSON columns back
          for (const key in row) {
            const val = row[key];
            if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
              try {
                row[key] = JSON.parse(val);
              } catch (e) {
                // Ignore
              }
            }
          }
          return row;
        }
      }
      return { id: pkVal, affectedRows: results.totalAffectedRows };
    }

    return { affectedRows: results.totalAffectedRows };

  } else if (action === 'update') {
    const updateData = preprocessData(table, data);
    
    // Format datetime fields
    for (const key in updateData) {
      updateData[key] = formatToMysqlDateTime(updateData[key]);
    }

    const columns = Object.keys(updateData).filter(c => c !== 'id' && c !== 'user_id' && c !== 'created_at');
    
    if (columns.length === 0) {
      return [];
    }

    const setClauses = columns.map(c => `\`${c}\` = ?`).join(', ');
    const values = columns.map(c => updateData[c]);

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
            if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
              try {
                row[key] = JSON.parse(val);
              } catch (e) {
                // Ignore
              }
            }
          }
        }
      }
      return updatedRows;
    } catch (e) {
      return { affectedRows: result.affectedRows };
    }

  } else if (action === 'delete') {
    sql = `DELETE FROM \`${table}\`${whereString}`;
    const result = await db.query(sql, params);
    return { affectedRows: result.affectedRows };
  }

  throw new Error(`Unsupported query action: ${action}`);
}
