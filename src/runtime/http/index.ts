// Kapy Runtime — HTTP Client
// Wraps fetch() for kapy-script's `import kapy/http`

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  ok: boolean;
}

/**
 * Make an HTTP GET request.
 */
export async function get(url: string, headers?: Record<string, string>): Promise<HttpResponse> {
  const response = await fetch(url, { method: "GET", headers });
  const body = await response.text();
  const respHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => { respHeaders[key] = value; });
  return { status: response.status, headers: respHeaders, body, ok: response.ok };
}

/**
 * Make an HTTP POST request.
 */
export async function post(url: string, data: string | Record<string, unknown>, headers?: Record<string, string>): Promise<HttpResponse> {
  const body = typeof data === "string" ? data : JSON.stringify(data);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
  const respHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => { respHeaders[key] = value; });
  const responseBody = await response.text();
  return { status: response.status, headers: respHeaders, body: responseBody, ok: response.ok };
}

/**
 * Make an HTTP PUT request.
 */
export async function put(url: string, data: string | Record<string, unknown>, headers?: Record<string, string>): Promise<HttpResponse> {
  const body = typeof data === "string" ? data : JSON.stringify(data);
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
  const respHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => { respHeaders[key] = value; });
  const responseBody = await response.text();
  return { status: response.status, headers: respHeaders, body: responseBody, ok: response.ok };
}

/**
 * Make an HTTP DELETE request.
 */
export async function del(url: string, headers?: Record<string, string>): Promise<HttpResponse> {
  const response = await fetch(url, { method: "DELETE", headers });
  const body = await response.text();
  const respHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => { respHeaders[key] = value; });
  return { status: response.status, headers: respHeaders, body, ok: response.ok };
}