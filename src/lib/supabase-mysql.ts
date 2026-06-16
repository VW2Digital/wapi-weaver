import { executeQuery } from './query-compiler';

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
      action: 'select',
      filters: [],
      order: [],
      select: '*'
    };
  }

  select(columns: string | string[] = '*') {
    if (this.query.action === 'select') {
      this.query.select = columns;
    }
    return this;
  }

  insert(data: any, options: { upsert?: boolean } = {}) {
    this.query.action = 'insert';
    this.query.data = data;
    if (options.upsert) {
      this.query.upsertConflict = true;
    }
    return this;
  }

  upsert(data: any, options: { onConflict?: string } = {}) {
    this.query.action = 'insert';
    this.query.data = data;
    this.query.upsertConflict = true;
    return this;
  }

  update(data: any) {
    this.query.action = 'update';
    this.query.data = data;
    return this;
  }

  delete() {
    this.query.action = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    this.query.filters.push({ type: 'eq', column, value });
    return this;
  }

  neq(column: string, value: any) {
    this.query.filters.push({ type: 'neq', column, value });
    return this;
  }

  in(column: string, value: any[]) {
    this.query.filters.push({ type: 'in', column, value });
    return this;
  }

  gte(column: string, value: any) {
    this.query.filters.push({ type: 'gte', column, value });
    return this;
  }

  lte(column: string, value: any) {
    this.query.filters.push({ type: 'lte', column, value });
    return this;
  }

  gt(column: string, value: any) {
    this.query.filters.push({ type: 'gt', column, value });
    return this;
  }

  lt(column: string, value: any) {
    this.query.filters.push({ type: 'lt', column, value });
    return this;
  }

  not(column: string, operator: string, value: any) {
    this.query.filters.push({ type: 'not', column, operator, value });
    return this;
  }

  like(column: string, value: string) {
    this.query.filters.push({ type: 'like', column, value });
    return this;
  }

  ilike(column: string, value: string) {
    this.query.filters.push({ type: 'ilike', column, value });
    return this;
  }

  is(column: string, value: any) {
    this.query.filters.push({ type: 'is', column, value });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.query.order.push({
      column,
      ascending: options.ascending !== false
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
      let resultData = data;
      
      if (this.singleRow) {
        resultData = Array.isArray(data) ? data[0] : data;
        if (resultData === undefined || resultData === null) {
          const val = { data: null, error: { message: 'No rows returned for single() query' } };
          return onfulfilled ? onfulfilled(val) : val;
        }
      } else if (this.maybeSingleRow) {
        resultData = Array.isArray(data) ? (data[0] || null) : (data || null);
      }

      const val = { data: resultData, error: null };
      return onfulfilled ? onfulfilled(val) : val;
    } catch (err: any) {
      const val = { data: null, error: { message: err.message } };
      return onfulfilled ? onfulfilled(val) : val;
    }
  }
}

export class ServerSupabaseMySQLClient {
  private userId: string;
  private userRole: string;

  constructor(userId: string, userRole: string) {
    this.userId = userId;
    this.userRole = userRole;
  }

  from(table: string) {
    return new QueryBuilder(table, this.userId, this.userRole);
  }
}
