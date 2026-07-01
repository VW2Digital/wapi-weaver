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

  private generateSignature(timestamp: number, bodyJson: string): string {
    return crypto
      .createHmac("sha256", this.apiSecret)
      .update(`${timestamp}.${bodyJson}`)
      .digest("hex");
  }

  private async request(endpoint: string, payload: any): Promise<LicenseResponse> {
    const url = `${this.serverUrl}${endpoint}`;
    const bodyJson = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.generateSignature(timestamp, bodyJson);

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 6000);

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

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return {
          valid: false,
          status: "error",
          error: errorData.error || `HTTP error ${res.status}`,
          message: errorData.message || "Failed to communicate with license server",
        };
      }

      const data = await res.json();
      return data as LicenseResponse;
    } catch (err: any) {
      clearTimeout(id);
      console.error(`[LicenseClient] Network error when calling ${url}:`, err.message || err);
      return {
        valid: false,
        status: "network_error",
        error: "network_error",
        message: `Network error: ${err.message || "Unknown"}`,
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
