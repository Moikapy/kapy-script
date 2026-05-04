// Kapy-script Runtime — @kapy/runtime
// Core types and builtins that kapy-script transpiled code depends on

import { get_llm_mock, get_embed_mock } from "./mock";

// ── Environment-safe helper ──

function getEnv(key: string): string | undefined {
  if (typeof process !== "undefined" && process.env) {
    return process.env[key];
  }
  return undefined;
}

// ── OpenAI API Types ──

interface OpenAIChatResponse {
  choices?: { message?: { content?: string } }[];
}

interface OpenAIEmbedResponse {
  data?: { embedding?: number[] }[];
}

// ── Result Type ──

export class ResultOk<T> {
  readonly _tag = "Ok" as const;
  constructor(public readonly value: T) {}
  unwrap(): T { return this.value; }
  unwrapOrCrash(): T { return this.value; }
  unwrapOr(defaultValue: T): T { return this.value; }
}

export class ResultErr<E> {
  readonly _tag = "Err" as const;
  constructor(public readonly error: E) {}
  unwrap(): never { throw new Error(`Result.unwrap() called on Err: ${JSON.stringify(this.error)}`); }
  unwrapOrCrash(): never { throw new Error(`Result.unwrapOrCrash() called on Err: ${JSON.stringify(this.error)}`); }
  unwrapOr<T>(defaultValue: T): T { return defaultValue; }
}

export type Result<T, E = string> = ResultOk<T> | ResultErr<E>;

export function Ok<T>(value: T): ResultOk<T> {
  return new ResultOk(value);
}

export function Err<E>(error: E): ResultErr<E> {
  return new ResultErr(error);
}

export function isOk<T, E>(result: Result<T, E>): result is ResultOk<T> {
  return result._tag === "Ok";
}

export function isErr<T, E>(result: Result<T, E>): result is ResultErr<E> {
  return result._tag === "Err";
}

// Result unwrap operators for kapy-script ? and ! operators
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
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/** Error classification for LLM API errors */
export type LLMErrorKind = "auth" | "rate_limit" | "context_overflow" | "server" | "timeout" | "network" | "unknown";

export interface LLMError {
  kind: LLMErrorKind;
  status?: number;
  message: string;
}

let defaultLLMConfig: LLMConfig = {
  provider: "openai",
  model: "gpt-4",
  temperature: 0.7,
  maxTokens: 2048,
  timeout: 30000,
};

export function configureLLM(config: Partial<LLMConfig>): void {
  defaultLLMConfig = { ...defaultLLMConfig, ...config };
}

/** Classify an HTTP status code into an error kind */
function classifyHttpError(status: number): LLMErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limit";
  if (status === 413) return "context_overflow";
  if (status >= 500) return "server";
  return "unknown";
}

export async function llm(prompt: string, input?: any, config?: Partial<LLMConfig>): Promise<Result<string, string>> {
  // Check for mock first
  const mock = get_llm_mock();
  if (mock !== null) {
    return Ok(mock);
  }

  const mergedConfig = { ...defaultLLMConfig, ...config };

  try {
    const apiKey = mergedConfig.apiKey || getEnv("OPENAI_API_KEY");
    if (!apiKey) {
      return Err("OPENAI_API_KEY not set. Set it via environment variable or configureLLM().");
    }

    const controller = new AbortController();
    const timeoutMs = mergedConfig.timeout ?? 30000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
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
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        const kind = classifyHttpError(response.status);
        return Err(`LLM ${kind} error (${response.status}): ${body}`);
      }

      const data = await response.json() as OpenAIChatResponse;
      const text = data.choices?.[0]?.message?.content || "";
      return Ok(text);
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return Err(`LLM timeout after ${mergedConfig.timeout ?? 30000}ms`);
    }
    return Err(`LLM call failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ── Embed Builtin ──

export async function embed(text: string, config?: Partial<LLMConfig>): Promise<Result<number[], string>> {
  // Check for mock first
  const mockVector = get_embed_mock();
  if (mockVector !== null) {
    return Ok(mockVector);
  }

  try {
    const apiKey = config?.apiKey || getEnv("OPENAI_API_KEY");
    if (!apiKey) {
      return Err("OPENAI_API_KEY not set for embeddings.");
    }

    const controller = new AbortController();
    const timeoutMs = config?.timeout ?? 30000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
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
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        const kind = classifyHttpError(response.status);
        return Err(`Embed ${kind} error (${response.status}): ${body}`);
      }

      const data = await response.json() as OpenAIEmbedResponse;
      const vector = data.data?.[0]?.embedding || [];
      return Ok(vector);
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return Err(`Embed timeout after ${config?.timeout ?? 30000}ms`);
    }
    return Err(`Embed call failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ── Print Builtin ──

export function print(...values: any[]): void {
  console.log(...values);
}

// ── Kapy Test Runner ──

// Re-export Bun test globals for transpiled code
export { test, describe, expect } from "bun:test";

// ── Runtime Utilities ──

export const KapyRuntime = {
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

// ── Re-export mock functions ──

export { mock_llm, mock_embed, mock_tool, mock_reset } from "./mock";
// ── Stdlib module re-exports ──
// These allow `import { ... } from "@kapy/runtime/http"` etc.

export * as http from "./http";
export * as fs from "./fs";
export * as json from "./json";
export * as ai from "./ai";
