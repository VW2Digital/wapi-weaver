import type { HttpRequest, HttpResponse } from "./http.types";

export interface HttpClientPort {
  request(req: HttpRequest): Promise<HttpResponse>;
}
