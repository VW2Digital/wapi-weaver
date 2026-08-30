import type { HttpClientPort, HttpRequest, HttpResponse, CredentialResolverPort } from "@/lib/omnichannel-next/infrastructure/http";

export class FakeHttpClient implements HttpClientPort {
  requests: HttpRequest[] = [];
  private fixtures: Map<string, HttpResponse> = new Map();

  setFixture(url: string, status: number, body: unknown): void {
    this.fixtures.set(url, { status, body });
  }

  async request(req: HttpRequest): Promise<HttpResponse> {
    this.requests.push(req);
    const response = this.fixtures.get(req.url);
    if (!response) {
      throw new Error(`No fixture for ${req.url}`);
    }
    return response;
  }
}

export class FakeCredentialResolver implements CredentialResolverPort {
  private tokens: Map<string, string> = new Map();

  addToken(reference: string, token: string): void {
    this.tokens.set(reference, token);
  }

  async resolve(reference: string): Promise<{ token: string }> {
    const token = this.tokens.get(reference);
    if (!token) throw new Error(`Unknown credential reference: ${reference}`);
    return { token };
  }
}
