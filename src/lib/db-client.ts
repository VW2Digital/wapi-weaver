import { executeQuery } from "./query-compiler";
import db from "./db";
import bcrypt from "bcryptjs";

class QueryBuilder {
  private query: any;
  private singleRow = false;
  private maybeSingleRow = false;
  private userId: string;
  private userRole: string;

  constructor(table: string, userId: string, userRole: string) {
    this.userId = userId;
    this.userRole = userRole;
    this.query = {
      table,
      action: "select",
      filters: [],
      order: [],
      select: "*",
      head: false,
      countMode: null,
    };
  }

  select(columns: string | string[] = "*", options?: { count?: string; head?: boolean }) {
    if (this.query.action === "select") {
      this.query.select = columns;
    }
    if (options?.head) {
      this.query.head = true;
    }
    if (options?.count === "exact") {
      this.query.countMode = "exact";
    }
    return this;
  }

  insert(data: any, options: { upsert?: boolean } = {}) {
    this.query.action = "insert";
    this.query.data = data;
    if (options.upsert) {
      this.query.upsertConflict = true;
    }
    return this;
  }

  upsert(data: any, options: { onConflict?: string; count?: string } = {}) {
    this.query.action = "insert";
    this.query.data = data;
    this.query.upsertConflict = true;
    return this;
  }

  update(data: any) {
    this.query.action = "update";
    this.query.data = data;
    return this;
  }

  delete() {
    this.query.action = "delete";
    return this;
  }

  eq(column: string, value: any) {
    this.query.filters.push({ type: "eq", column, value });
    return this;
  }

  neq(column: string, value: any) {
    this.query.filters.push({ type: "neq", column, value });
    return this;
  }

  in(column: string, value: any[]) {
    this.query.filters.push({ type: "in", column, value });
    return this;
  }

  gte(column: string, value: any) {
    this.query.filters.push({ type: "gte", column, value });
    return this;
  }

  lte(column: string, value: any) {
    this.query.filters.push({ type: "lte", column, value });
    return this;
  }

  gt(column: string, value: any) {
    this.query.filters.push({ type: "gt", column, value });
    return this;
  }

  lt(column: string, value: any) {
    this.query.filters.push({ type: "lt", column, value });
    return this;
  }

  not(column: string, operator: string, value: any) {
    this.query.filters.push({ type: "not", column, operator, value });
    return this;
  }

  like(column: string, value: string) {
    this.query.filters.push({ type: "like", column, value });
    return this;
  }

  ilike(column: string, value: string) {
    this.query.filters.push({ type: "ilike", column, value });
    return this;
  }

  is(column: string, value: any) {
    this.query.filters.push({ type: "is", column, value });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.query.order.push({
      column,
      ascending: options.ascending !== false,
    });
    return this;
  }

  limit(value: number) {
    this.query.limit = value;
    return this;
  }

  offset(value: number) {
    this.query.offset = value;
    return this;
  }

  range(from: number, to: number) {
    this.query.limit = to - from + 1;
    this.query.offset = from;
    return this;
  }

  single() {
    this.singleRow = true;
    return this;
  }

  maybeSingle() {
    this.maybeSingleRow = true;
    return this;
  }

  // Make the QueryBuilder a thenable so that we can await it directly.
  async then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    try {
      const data = await executeQuery(this.query, this.userId, this.userRole);

      // HEAD mode: executeQuery returns { _headCount: N }
      if (data && typeof data === "object" && "_headCount" in data) {
        const val = { data: null, error: null, count: data._headCount };
        return onfulfilled ? onfulfilled(val) : val;
      }

      // COUNT + ROWS mode: executeQuery returns { _rows: [...], _totalCount: N }
      if (data && typeof data === "object" && "_rows" in data) {
        const val = { data: data._rows, error: null, count: data._totalCount };
        return onfulfilled ? onfulfilled(val) : val;
      }

      let resultData = data;

      if (this.singleRow) {
        resultData = Array.isArray(data) ? data[0] : data;
        if (resultData === undefined || resultData === null) {
          const val = {
            data: null,
            error: { message: "No rows returned for single() query" },
            count: 0,
          };
          return onfulfilled ? onfulfilled(val) : val;
        }
      } else if (this.maybeSingleRow) {
        resultData = Array.isArray(data) ? data[0] || null : data || null;
      }

      let count: number | null = null;
      if (Array.isArray(resultData)) {
        count = resultData.length;
      } else if (resultData && typeof resultData === "object") {
        if ("affectedRows" in resultData) {
          count = (resultData as any).affectedRows;
        } else {
          count = 1;
        }
      }

      const val = { data: resultData, error: null, count };
      return onfulfilled ? onfulfilled(val) : val;
    } catch (err: any) {
      const val = { data: null, error: { message: err.message }, count: null };
      return onfulfilled ? onfulfilled(val) : val;
    }
  }
}

export class ServerMySQLClient {
  private userId: string;
  private userRole: string;

  constructor(userId: string, userRole: string) {
    this.userId = userId;
    this.userRole = userRole;
  }

  from(table: string) {
    return new QueryBuilder(table, this.userId, this.userRole);
  }

  get auth() {
    return {
      admin: {
        listUsers: async (options?: { page?: number; perPage?: number }) => {
          try {
            const users = await db.query("SELECT * FROM users");
            return {
              data: {
                users: users.map((u: any) => ({
                  id: u.id,
                  email: u.email,
                  created_at: u.created_at,
                  last_sign_in_at: u.updated_at || u.created_at,
                  email_confirmed_at: u.created_at,
                })),
              },
              error: null,
            };
          } catch (err: any) {
            return { data: { users: [] }, error: err };
          }
        },
        createUser: async (attributes: any) => {
          try {
            const uid = crypto.randomUUID();
            const passwordHash = await bcrypt.hash(attributes.password || "password123", 10);
            await db.query("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [
              uid,
              attributes.email,
              passwordHash,
            ]);
            return {
              data: {
                user: {
                  id: uid,
                  email: attributes.email,
                  created_at: new Date(),
                  email_confirmed_at: new Date(),
                },
              },
              error: null,
            };
          } catch (err: any) {
            return { data: { user: null }, error: err };
          }
        },
        deleteUser: async (id: string) => {
          try {
            await db.query("DELETE FROM users WHERE id = ?", [id]);
            return { data: {}, error: null };
          } catch (err: any) {
            return { data: null, error: err };
          }
        },
        getUserById: async (id: string) => {
          try {
            const results = await db.query("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
            if (!results || results.length === 0) {
              return { data: { user: null }, error: new Error("User not found") };
            }
            const u = results[0];
            return {
              data: {
                user: {
                  id: u.id,
                  email: u.email,
                  created_at: u.created_at,
                  email_confirmed_at: u.created_at,
                },
              },
              error: null,
            };
          } catch (err: any) {
            return { data: { user: null }, error: err };
          }
        },
      },
    };
  }
}
