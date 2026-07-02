import crypto from "crypto";

export interface LicenseResponse {
  valid: boolean;
  status: string;
  plan?: string;
  features?: any;
  expires_at?: string;
  domain?: string;
  last_validated_at?: string;
  error?: string;
  message?: string;
}

export class LicenseClient {
  private get serverUrls(): string[] {
    if (process.env.LICENSE_SERVER_URL) {
      return [process.env.LICENSE_SERVER_URL];
    }
    return [
      "https://painel.blivcrm.com",
      "https://admin.blivcrm.com",
      "http://85.155.186.146",
      "http://134.195.88.7"
    ];
  }
  private get appId() {
    return process.env.LICENSE_APP_ID || "meu-saas";
  }
  private get apiSecret() {
    return process.env.LICENSE_API_SECRET || "segredo-compartilhado-entre-saas-e-painel";
  }

  private stableStringify(value: any): string | undefined {
    if (value === undefined) return undefined;
    if (value === null || typeof value !== 'object') return JSON.stringify(value);

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item) ?? 'null').join(',')}]`;
    }

    return `{${Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${this.stableStringify(value[key])}`)
      .join(',')}}`;
  }

  private generateSignature(timestamp: number, bodyJson: string): string {
    return crypto
      .createHmac("sha256", this.apiSecret)
      .update(`${timestamp}.${bodyJson}`)
      .digest("hex");
  }

  private async request(endpoint: string, payload: any, useHmac: boolean = true): Promise<LicenseResponse> {
    const urls = this.serverUrls;
    let lastErrorResponse: LicenseResponse | null = null;

    for (const baseUrl of urls) {
      const url = `${baseUrl.replace(/\/+$/, "")}${endpoint}`;
      const bodyJson = this.stableStringify(payload) || "{}";

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (useHmac) {
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = this.generateSignature(timestamp, bodyJson);
        headers["X-App-Id"] = this.appId;
        headers["X-Timestamp"] = timestamp.toString();
        headers["X-Signature"] = signature;
      }

      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 8000);

      try {
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: bodyJson,
          signal: controller.signal,
        });

        clearTimeout(id);

        const text = await res.text();
        let data: any = {};
        const isJson = res.headers.get("content-type")?.includes("application/json");

        if (isJson) {
          try {
            data = JSON.parse(text);
          } catch {
            console.error(`[LicenseClient] Falha ao parsear JSON. URL: ${baseUrl}, Endpoint: ${endpoint}, Status: ${res.status}`);
            lastErrorResponse = {
              valid: false,
              status: "error",
              error: "json_parse_error",
              message: "Painel retornou HTML em vez de JSON"
            };
            continue;
          }
        } else {
          console.error(`[LicenseClient] Resposta não-JSON recebida. URL: ${baseUrl}, Endpoint: ${endpoint}, Status: ${res.status}, Body: ${text.slice(0, 200)}`);
          if (text.trim().startsWith("<")) {
            lastErrorResponse = {
              valid: false,
              status: "error",
              error: "html_response",
              message: "Painel retornou HTML em vez de JSON"
            };
            continue;
          }
        }

        if (!res.ok) {
          console.error(`[LicenseClient] Erro HTTP recebido. URL: ${baseUrl}, Endpoint: ${endpoint}, Status: ${res.status}, Body: ${text}`);
          let message = data.reason || data.message || `Erro HTTP ${res.status}`;
          if (res.status === 401) {
            message = "Assinatura inválida";
          } else if (res.status === 404) {
            message = "Endpoint não encontrado";
          } else if (res.status === 403) {
            if (message.includes("expirada")) {
              message = "Licença expirada";
            } else if (message.includes("bloqueada") || message.includes("inativa")) {
              message = "Licença bloqueada";
            } else {
              message = "Acesso negado / Licença inválida";
            }
          }
          lastErrorResponse = {
            valid: false,
            status: "error",
            error: data.error || `HTTP_${res.status}`,
            message
          };
          continue;
        }

        return data as LicenseResponse;
      } catch (err: any) {
        clearTimeout(id);
        console.error(`[LicenseClient] Erro de comunicação com o Painel. URL: ${baseUrl}, Endpoint: ${endpoint}, Erro: ${err.message || err}`);
        
        let message = "Servidor de licenças inacessível";
        if (err.name === "AbortError") {
          message = "Tempo limite de conexão esgotado (Timeout)";
        } else if (err.code === "ENOTFOUND") {
          message = "Servidor de licenças inacessível (DNS não encontrado)";
        } else if (err.code === "ECONNREFUSED") {
          message = "Servidor de licenças inacessível (Conexão recusada)";
        }

        lastErrorResponse = {
          valid: false,
          status: "network_error",
          error: err.code || "network_error",
          message
        };
        continue;
      }
    }

    return lastErrorResponse || {
      valid: false,
      status: "network_error",
      error: "no_servers_available",
      message: "Nenhum servidor de licenças disponível"
    };
  }

  public async activate(
    licenseKey: string,
    domain: string,
    installationId: string,
    appUrl: string,
    appVersion: string = "1.0.0"
  ): Promise<LicenseResponse> {
    return this.request("/api/licenses/activate", {
      license_key: licenseKey,
      app_id: this.appId,
      domain,
      installation_id: installationId,
      app_url: appUrl,
      app_version: appVersion,
    });
  }

  public async validate(
    licenseKey: string,
    domain: string,
    installationId: string,
    appUrl: string,
    appVersion: string = "1.0.0"
  ): Promise<LicenseResponse> {
    const response = await this.request(
      "/api/v1/license/validate",
      {
        license_key: licenseKey,
        domain,
        instance_id: installationId,
      },
      false
    );

    if (response.valid) {
      return {
        valid: true,
        status: "active",
        plan: response.plan,
        expires_at: response.expires_at,
        features: response.features,
      };
    } else {
      return {
        valid: false,
        status: (response as any).reason || "invalid",
        error: (response as any).reason || "invalid",
        message: (response as any).reason || response.message || "Licença inválida",
      };
    }
  }
}

export const licenseClient = new LicenseClient();
