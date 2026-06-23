class QueryBuilder {
  private table: string;
  private client: MySQLClient;
  private query: any;
  private singleRow = false;
  private maybeSingleRow = false;

  constructor(table: string, client: MySQLClient) {
    this.table = table;
    this.client = client;
    this.query = {
      table,
      action: "select",
      filters: [],
      order: [],
      select: "*",
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
      const res = await this.client.request("/api/query", this.query);

      if (
        typeof window !== "undefined" &&
        ["insert", "update", "delete"].includes(this.query.action) &&
        this.table === "conversation_tags"
      ) {
        try {
          const bc = new BroadcastChannel("conversation-tags-realtime");
          bc.postMessage({
            event: this.query.action.toUpperCase(),
            table: "conversation_tags",
            data: res.data,
          });
          bc.close();
        } catch (e) {
          console.error("Error broadcasting tag update:", e);
        }
      }

      // HEAD mode: server returns { _headCount: N }
      if (res.data && typeof res.data === "object" && "_headCount" in res.data) {
        const val = { data: null, error: null, count: res.data._headCount };
        return onfulfilled ? onfulfilled(val) : val;
      }

      // COUNT + ROWS mode: server returns { _rows: [...], _totalCount: N }
      if (res.data && typeof res.data === "object" && "_rows" in res.data) {
        const val = { data: res.data._rows, error: res.error, count: res.data._totalCount };
        return onfulfilled ? onfulfilled(val) : val;
      }

      let data = res.data;
      if (this.singleRow) {
        data = Array.isArray(data) ? data[0] : data;
        if (data === undefined || data === null) {
          const val = {
            data: null,
            error: { message: "Nenhuma linha retornada para a consulta single()" },
            count: 0,
          };
          return onfulfilled ? onfulfilled(val) : val;
        }
      } else if (this.maybeSingleRow) {
        data = Array.isArray(data) ? data[0] || null : data || null;
      }

      let count: number | null = null;
      if (Array.isArray(data)) {
        count = data.length;
      } else if (data && typeof data === "object") {
        if ("affectedRows" in data) {
          count = (data as any).affectedRows;
        } else {
          count = 1;
        }
      }

      const val = { data, error: res.error, count };
      return onfulfilled ? onfulfilled(val) : val;
    } catch (err: any) {
      const val = { data: null, error: { message: err.message }, count: null };
      return onfulfilled ? onfulfilled(val) : val;
    }
  }
}

class MySQLClient {
  private _listeners: any[] = [];
  private _channels = new Map<string, any[]>();
  private _broadcastChannels = new Map<string, BroadcastChannel>();

  async request(path: string, body: any) {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("app-token") || localStorage.getItem("sb-token")
        : null;
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const res = await fetch(path, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let result: any = {};
    try {
      result = text ? JSON.parse(text) : {};
    } catch (e) {
      if (!res.ok) {
        throw new Error(`Erro HTTP ${res.status}: ${text.substring(0, 200)}`);
      }
      throw new Error(`Resposta JSON inválida: ${text.substring(0, 200)}`);
    }

    if (!res.ok) {
      const errMsg =
        result.error && typeof result.error === "object" && "message" in result.error
          ? result.error.message
          : typeof result.error === "string"
            ? result.error
            : `Erro HTTP ${res.status}`;
      throw new Error(errMsg);
    }
    return result;
  }

  from(table: string) {
    return new QueryBuilder(table, this);
  }

  channel(name: string) {
    let bc = this._broadcastChannels.get(name);
    if (!bc && typeof window !== "undefined") {
      try {
        bc = new BroadcastChannel(name);
        this._broadcastChannels.set(name, bc);
        bc.onmessage = (event) => {
          const listeners = this._channels.get(name) || [];
          listeners.forEach((listener) => {
            try {
              listener.callback(event.data);
            } catch (e) {
              console.error("Error in realtime channel callback:", e);
            }
          });
        };
      } catch (err) {
        console.error("BroadcastChannel not supported or error:", err);
      }
    }

    const ch = {
      on: (event: string, filter: any, callback: any) => {
        const listeners = this._channels.get(name) || [];
        listeners.push({ event, filter, callback });
        this._channels.set(name, listeners);
        return ch;
      },
      subscribe: (statusCallback?: any) => {
        if (statusCallback) {
          setTimeout(() => statusCallback("SUBSCRIBED"), 0);
        }
        return ch;
      },
      unsubscribe: () => {
        this._channels.delete(name);
        const activeBc = this._broadcastChannels.get(name);
        if (activeBc) {
          activeBc.close();
          this._broadcastChannels.delete(name);
        }
      },
    };
    return ch;
  }

  removeChannel(channel: any) {
    return Promise.resolve();
  }

  get auth() {
    return {
      getSession: async () => {
        const sessionStr =
          typeof window !== "undefined" ? localStorage.getItem("app-session") : null;
        return { data: { session: sessionStr ? JSON.parse(sessionStr) : null }, error: null };
      },
      getUser: async () => {
        const sessionStr =
          typeof window !== "undefined" ? localStorage.getItem("app-session") : null;
        const session = sessionStr ? JSON.parse(sessionStr) : null;
        return { data: { user: session ? session.user : null }, error: null };
      },
      signInWithPassword: async ({ email, password }: any) => {
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const data = await res.json();
          if (!res.ok) {
            return {
              data: { session: null, user: null },
              error: { message: data.error || "Falha ao fazer login" },
            };
          }
          const session = {
            access_token: data.access_token,
            user: data.user,
          };
          if (typeof window !== "undefined") {
            localStorage.setItem("app-token", data.access_token);
            localStorage.setItem("app-session", JSON.stringify(session));
          }

          this._notifyListeners("SIGNED_IN", session);
          return { data: { session, user: data.user }, error: null };
        } catch (err: any) {
          return { data: { session: null, user: null }, error: { message: err.message } };
        }
      },
      signUp: async ({ email, password, options }: any) => {
        try {
          const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, options }),
          });
          const data = await res.json();
          if (!res.ok) {
            return {
              data: { session: null, user: null },
              error: { message: data.error || "Falha ao registrar" },
            };
          }
          const session = {
            access_token: data.access_token,
            user: data.user,
          };
          if (typeof window !== "undefined") {
            localStorage.setItem("app-token", data.access_token);
            localStorage.setItem("app-session", JSON.stringify(session));
          }

          this._notifyListeners("SIGNED_IN", session);
          return { data: { session, user: data.user }, error: null };
        } catch (err: any) {
          return { data: { session: null, user: null }, error: { message: err.message } };
        }
      },
      signOut: async () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("app-token");
          localStorage.removeItem("app-session");
        }
        this._notifyListeners("SIGNED_OUT", null);
        return { error: null };
      },
      updateUser: async ({ password }: any) => {
        try {
          const token = typeof window !== "undefined" ? localStorage.getItem("app-token") : null;
          const headers = {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          };
          const res = await fetch("/api/auth/update", {
            method: "POST",
            headers,
            body: JSON.stringify({ password }),
          });
          const data = await res.json();
          if (!res.ok) {
            return {
              data: { user: null },
              error: { message: data.error || "Falha ao atualizar usuário" },
            };
          }
          return { data: { user: {} as any }, error: null };
        } catch (err: any) {
          return { data: { user: null }, error: { message: err.message } };
        }
      },
      onAuthStateChange: (callback: any) => {
        this._listeners.push(callback);
        const sessionStr =
          typeof window !== "undefined" ? localStorage.getItem("app-session") : null;
        const session = sessionStr ? JSON.parse(sessionStr) : null;
        setTimeout(() => callback("INITIAL_SESSION", session), 0);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                this._listeners = this._listeners.filter((cb) => cb !== callback);
              },
            },
          },
        };
      },
      resetPasswordForEmail: async (email: string) => {
        try {
          const res = await fetch("/api/auth/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          const data = await res.json();
          if (!res.ok) {
            return {
              data: null,
              error: { message: data.error || "Falha ao enviar e-mail de recuperação" },
            };
          }
          return { data: {}, error: null };
        } catch (err: any) {
          return { data: null, error: { message: err.message } };
        }
      },
      signInWithOtp: async ({ email }: any) => {
        try {
          const res = await fetch("/api/auth/otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          const data = await res.json();
          if (!res.ok) {
            return {
              data: null,
              error: { message: data.error || "Falha ao enviar link mágico" },
            };
          }
          return { data: {}, error: null };
        } catch (err: any) {
          return { data: null, error: { message: err.message } };
        }
      },
      get mfa() {
        return {
          getAuthenticatorAssuranceLevel: async () => {
            return {
              data: {
                currentLevel: "aal1",
                nextLevel: "aal1",
              },
              error: null,
            };
          },
          listFactors: async () => {
            return { data: { all: [], totp: [] }, error: null };
          },
          enroll: async () => {
            return { data: null, error: null };
          },
          challenge: async () => {
            return { data: null, error: null };
          },
          verify: async () => {
            return { error: null };
          },
          unenroll: async () => {
            return { error: null };
          },
        };
      },
    };
  }

  _notifyListeners(event: string, session: any) {
    this._listeners.forEach((cb) => {
      try {
        cb(event, session);
      } catch (e) {
        console.error("Erro no listener de estado de autenticação:", e);
      }
    });
  }

  get storage() {
    return {
      from: (bucket: string) => ({
        upload: async (filePath: string, file: File) => {
          try {
            const token = typeof window !== "undefined" ? localStorage.getItem("app-token") : null;
            const headers = {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            };

            const form = new FormData();
            form.append("path", filePath);
            form.append("file", file);

            const res = await fetch("/api/storage/upload", {
              method: "POST",
              headers,
              body: form,
            });

            const result = await res.json();
            if (!res.ok) {
              return {
                data: null,
                error: { message: result.error || `Upload falhou com status ${res.status}` },
              };
            }
            return { data: { path: filePath }, error: null };
          } catch (err: any) {
            return { data: null, error: { message: err.message } };
          }
        },
        remove: async (paths: string[]) => {
          try {
            const token = typeof window !== "undefined" ? localStorage.getItem("app-token") : null;
            const headers = {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            };
            const res = await fetch("/api/storage/remove", {
              method: "POST",
              headers,
              body: JSON.stringify({ paths }),
            });
            const result = await res.json();
            return { data: paths, error: res.ok ? null : { message: result.error } };
          } catch (err: any) {
            return { data: null, error: { message: err.message } };
          }
        },
        getPublicUrl: (filePath: string) => {
          return { data: { publicUrl: `/api/storage/file?path=${filePath}` } };
        },
        createSignedUrl: async (filePath: string, expiresIn: number) => {
          return { data: { signedUrl: `/api/storage/file?path=${filePath}` }, error: null };
        },
      }),
    };
  }
}

export const db = new MySQLClient() as any;
export { db as supabase };
