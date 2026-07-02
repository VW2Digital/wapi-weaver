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
  private get serverUrl() {
    return process.env.LICENSE_SERVER_URL || "https://painel.blivcrm.com";
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

  private async request(endpoint: string, payload: any): Promise<LicenseResponse> {
    const url = `${this.serverUrl.replace(/\/+$/, "")}${endpoint}`;
    const bodyJson = this.stableStringify(payload) || "{}";
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.generateSignature(timestamp, bodyJson);

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-App-Id": this.appId,
          "X-Timestamp": timestamp.toString(),
          "X-Signature": signature,
        },
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
          console.error(`[LicenseClient] Falha ao parsear JSON. URL: ${this.serverUrl}, Endpoint: ${endpoint}, Status: ${res.status}`);
          return {
            valid: false,
            status: "error",
            error: "json_parse_error",
            message: "Painel retornou HTML em vez de JSON"
          };
        }
      } else {
        console.error(`[LicenseClient] Resposta não-JSON recebida. URL: ${this.serverUrl}, Endpoint: ${endpoint}, Status: ${res.status}, Body: ${text.slice(0, 200)}`);
        if (text.trim().startsWith("<")) {
          return {
            valid: false,
            status: "error",
            error: "html_response",
            message: "Painel retornou HTML em vez de JSON"
          };
        }
      }

      if (!res.ok) {
        console.error(`[LicenseClient] Erro HTTP recebido. URL: ${this.serverUrl}, Endpoint: ${endpoint}, Status: ${res.status}, Body: ${text}`);
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
        return {
          valid: false,
          status: "error",
          error: data.error || `HTTP_${res.status}`,
          message
        };
      }

      return data as LicenseResponse;
    } catch (err: any) {
      clearTimeout(id);
      console.error(`[LicenseClient] Erro de comunicação com o Painel. URL: ${this.serverUrl}, Endpoint: ${endpoint}, Erro: ${err.message || err}`);
      
      let message = "Servidor de licenças inacessível";
      if (err.name === "AbortError") {
        message = "Tempo limite de conexão esgotado (Timeout)";
      } else if (err.code === "ENOTFOUND") {
        message = "Servidor de licenças inacessível (DNS não encontrado)";
      } else if (err.code === "ECONNREFUSED") {
        message = "Servidor de licenças inacessível (Conexão recusada)";
      }

      return {
        valid: false,
        status: "network_error",
        error: err.code || "network_error",
        message
      };
    }
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
    return this.request("/api/licenses/validate", {
      license_key: licenseKey,
      app_id: this.appId,
      domain,
      installation_id: installationId,
      app_url: appUrl,
      app_version: appVersion,
    });
  }
}

export const licenseClient = new LicenseClient();
