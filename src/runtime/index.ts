// Kapy-script Runtime — @kapy/runtime
// Core types and builtins that kapy-script transpiled code depends on

// ── Result Type ──

export type ResultOk<T> = { readonly _tag: "Ok"; readonly value: T };
export type ResultErr<E> = { readonly _tag: "Err"; readonly error: E };
export type Result<T, E = string> = ResultOk<T> | ResultErr<E>;

export function Ok<T>(value: T): ResultOk<T> {
  return { _tag: "Ok", value };
}

export function Err<E>(error: E): ResultErr<E> {
  return { _tag: "Err", error };
}

export function isOk<T, E>(result: Result<T, E>): result is ResultOk<T> {
  return result._tag === "Ok";
}

export function isErr<T, E>(result: Result<T, E>): result is ResultErr<E> {
  return result._tag === "Err";
}

// Extend Result with unwrap methods
declare module "./index" {
  interface ResultUnwrap<T, E> {
    unwrap(): T;
    unwrapOrCrash(): T;
    unwrapOr(defaultValue: T): T;
  }
}

// Utility: unwrap operators for Result
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result._tag === "Ok") return result.value;
  throw new Error(`Result.unwrap() called on Err: ${JSON.stringify(result)}`);
}

export function unwrapOrCrash<T, E>(result: Result<T, E>): T {
  if (result._tag === "Ok") return result.value;
  throw new Error(`Panic: Result was Err — ${JSON.stringify((result as ResultErr<E>).error)}`);
}

export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (result._tag === "Ok") return result.value;
  return defaultValue;
}

// ── LLM Builtin ──

export interface LLMConfig {
  provider?: string;
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

let defaultLLMConfig: LLMConfig = {
  provider: "openai",
  model: "gpt-4",
  temperature: 0.7,
  maxTokens: 2048,
};

export function configureLLM(config: Partial<LLMConfig>): void {
  defaultLLMConfig = { ...defaultLLMConfig, ...config };
}

export async function llm(prompt: string, input?: any, config?: Partial<LLMConfig>): Promise<Result<string, string>> {
  const mergedConfig = { ...defaultLLMConfig, ...config };

  try {
    const apiKey = mergedConfig.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Err("OPENAI_API_KEY not set. Set it via environment variable or configureLLM().");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: mergedConfig.model,
        messages: [
          { role: "system", content: typeof input === "string" ? input : "" },
          { role: "user", content: prompt },
        ],
        temperature: mergedConfig.temperature,
        max_tokens: mergedConfig.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return Err(`LLM API error: ${response.status} ${error}`);
    }

    const data = await response.json() as any;
    const text = data.choices?.[0]?.message?.content || "";
    return Ok(text);
  } catch (error) {
    return Err(`LLM call failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ── Embed Builtin ──

export async function embed(text: string, config?: Partial<LLMConfig>): Promise<Result<number[], string>> {
  try {
    const apiKey = config?.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Err("OPENAI_API_KEY not set for embeddings.");
    }

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return Err(`Embedding API error: ${response.status} ${error}`);
    }

    const data = await response.json() as any;
    const vector = data.data?.[0]?.embedding || [];
    return Ok(vector);
  } catch (error) {
    return Err(`Embed call failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ── Print Builtin ──

export function print(value: any): void {
  console.log(value);
}

// ── Runtime Utilities ──

export const KapyRuntime = {
  createAgent(options: { tools: string[]; timeout?: number }) {
    return {
      tools: options.tools,
      timeout: options.timeout || 30000,
    };
  },

  async parallel(assignments: Record<string, any>): Promise<Record<string, any>> {
    const entries = Object.entries(assignments);
    const promises = entries.map(([key, fn]) => {
      if (typeof fn === "function") return fn().then((v: any) => [key, v]);
      return Promise.resolve([key, fn]);
    });
    const results = await Promise.all(promises);
    return Object.fromEntries(results);
  },

  async withTimeout(ms: number, fn: () => Promise<any>): Promise<any> {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    );
    return Promise.race([fn(), timeout]);
  },
};