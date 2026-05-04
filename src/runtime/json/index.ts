// Kapy Runtime — JSON Utilities
// Wraps JSON.parse/stringify for kapy-script's `import kapy/json`

/**
 * Parse a JSON string into a value.
 * Returns Result.Ok for valid JSON, Result.Err for invalid.
 */
import { Ok, Err, type Result } from "../index.js";

export function parse<T = unknown>(text: string): Result<T, string> {
  try {
    return Ok(JSON.parse(text) as T);
  } catch (error) {
    return Err(`JSON parse error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Stringify a value to JSON.
 * Returns Result.Ok for success, Result.Err for circular references.
 */
export function stringify(value: unknown, indent: number = 2): Result<string, string> {
  try {
    return Ok(JSON.stringify(value, null, indent));
  } catch (error) {
    return Err(`JSON stringify error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse JSON safely — throws on invalid JSON.
 */
export function unsafeParse<T = unknown>(text: string): T {
  return JSON.parse(text) as T;
}

/**
 * Stringify without error handling.
 */
export function unsafeStringify(value: unknown, indent: number = 2): string {
  return JSON.stringify(value, null, indent);
}