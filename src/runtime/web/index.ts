// Kapy Runtime — HTTP Router
// Simple HTTP server using Bun.serve for kapy-script's `import kapy/web/router`

export interface Route {
  method: string;
  path: string;
  handler: (req: Request) => Promise<Response> | Response;
}

export interface RouterConfig {
  port?: number;
  hostname?: string;
  development?: boolean;
}

export interface App {
  get(path: string, handler: (req: Request) => Promise<Response> | Response): App;
  post(path: string, handler: (req: Request) => Promise<Response> | Response): App;
  put(path: string, handler: (req: Request) => Promise<Response> | Response): App;
  delete(path: string, handler: (req: Request) => Promise<Response> | Response): App;
  use(middleware: (req: Request, next: () => Promise<Response>) => Promise<Response>): App;
  listen(port?: number, callback?: () => void): void;
  stop(): void;
}

/**
 * Create a new router app.
 *
 * Usage in .kapy:
 *   import kapy/web/router
 *   app = router.create()
 *   app.get("/", fn req -> "Hello, World!")
 *   app.listen(3000)
 */
export function create(config?: RouterConfig): App {
  const routes: Route[] = [];
  const middlewares: ((req: Request, next: () => Promise<Response>) => Promise<Response>)[] = [];
  let server: ReturnType<typeof Bun.serve> | null = null;

  const app: App = {
    get(path: string, handler: (req: Request) => Promise<Response> | Response): App {
      routes.push({ method: "GET", path, handler });
      return app;
    },
    post(path: string, handler: (req: Request) => Promise<Response> | Response): App {
      routes.push({ method: "POST", path, handler });
      return app;
    },
    put(path: string, handler: (req: Request) => Promise<Response> | Response): App {
      routes.push({ method: "PUT", path, handler });
      return app;
    },
    delete(path: string, handler: (req: Request) => Promise<Response> | Response): App {
      routes.push({ method: "DELETE", path, handler });
      return app;
    },
    use(middleware: (req: Request, next: () => Promise<Response>) => Promise<Response>): App {
      middlewares.push(middleware);
      return app;
    },
    listen(port?: number, callback?: () => void): void {
      const actualPort = port ?? config?.port ?? 3000;
      const hostname = config?.hostname ?? "0.0.0.0";

      server = Bun.serve({
        port: actualPort,
        hostname,
        fetch: async (req: Request): Promise<Response> => {
          const url = new URL(req.url);
          const method = req.method;

          // Find matching route
          for (const route of routes) {
            if (route.method === method && matchPath(route.path, url.pathname)) {
              try {
                const result = await route.handler(req);

                // Coerce return value to Response
                if (result instanceof Response) return result;
                if (typeof result === "string") {
                  return new Response(result, { headers: { "Content-Type": "text/plain" } });
                }
                if (typeof result === "object") {
                  return new Response(JSON.stringify(result), {
                    headers: { "Content-Type": "application/json" },
                  });
                }
                return new Response(String(result));
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return new Response(JSON.stringify({ error: message }), {
                  status: 500,
                  headers: { "Content-Type": "application/json" },
                });
              }
            }
          }

          return new Response("Not Found", { status: 404 });
        },
      });

      if (callback) callback();
      console.log(`🚀 Server listening on http://${hostname === "0.0.0.0" ? "localhost" : hostname}:${actualPort}`);
    },
    stop(): void {
      if (server) {
        server.stop();
        server = null;
        console.log("Server stopped.");
      }
    },
  };

  return app;
}

/**
 * Simple path matching — supports exact matches and :param wildcards.
 * /users/:id matches /users/123
 */
function matchPath(pattern: string, pathname: string): boolean {
  const patternParts = pattern.split("/");
  const pathnameParts = pathname.split("/");

  if (patternParts.length !== pathnameParts.length) return false;

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) continue; // wildcard
    if (patternParts[i] !== pathnameParts[i]) return false;
  }

  return true;
}

/**
 * Parse :params from a URL path.
 * /users/:id with /users/123 → { id: "123" }
 * Returns empty object if the pattern doesn't match the path.
 */
export function parseParams(pattern: string, pathname: string): Record<string, string> {
  const params: Record<string, string> = {};
  const patternParts = pattern.split("/");
  const pathnameParts = pathname.split("/");

  if (patternParts.length !== pathnameParts.length) return params; // No match

  // Verify match first
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      params[patternParts[i].slice(1)] = pathnameParts[i] || "";
    } else if (patternParts[i] !== pathnameParts[i]) {
      return {}; // No match
    }
  }

  return params;
}

/**
 * Create a JSON response.
 */
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Create a plain text response.
 */
export function text(data: string, status = 200): Response {
  return new Response(data, {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}

/**
 * Create an HTML response.
 */
export function html(data: string, status = 200): Response {
  return new Response(data, {
    status,
    headers: { "Content-Type": "text/html" },
  });
}

/**
 * Create a redirect response.
 */
export function redirect(url: string, status = 302): Response {
  return new Response(null, {
    status,
    headers: { Location: url },
  });
}