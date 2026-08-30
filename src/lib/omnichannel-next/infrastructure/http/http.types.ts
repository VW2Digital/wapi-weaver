export interface HttpRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface HttpResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}
