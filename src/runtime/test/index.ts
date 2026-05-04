// Kapy Runtime — Test Assertions
// Assertion helpers for kapy-script `test` declarations
// Used via `import kapy/test` or `import { assert } from "@moikapy/kapy-runtime/test"`

/**
 * Assert that a value equals an expected value.
 * Uses deep equality for objects and arrays.
 */
export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (typeof actual === "object" && actual !== null && typeof expected === "object" && expected !== null) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new AssertionError(
        message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      );
    }
    return;
  }
  if (actual !== expected) {
    throw new AssertionError(
      message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

/**
 * Assert that a value is truthy.
 */
export function assertTrue(value: unknown, message?: string): void {
  if (!value) {
    throw new AssertionError(message ?? `Expected truthy value, got ${JSON.stringify(value)}`);
  }
}

/**
 * Assert that a value is falsy.
 */
export function assertFalse(value: unknown, message?: string): void {
  if (value) {
    throw new AssertionError(message ?? `Expected falsy value, got ${JSON.stringify(value)}`);
  }
}

/**
 * Assert that a Result is Ok.
 */
export function assertOk<T, E>(result: { _tag: string; value?: T; error?: E }, message?: string): void {
  if (result._tag !== "Ok") {
    throw new AssertionError(
      message ?? `Expected Ok(...), got Err(${JSON.stringify((result as any).error)})`,
    );
  }
}

/**
 * Assert that a Result is Err.
 */
export function assertErr<T, E>(result: { _tag: string; value?: T; error?: E }, message?: string): void {
  if (result._tag !== "Err") {
    throw new AssertionError(
      message ?? `Expected Err(...), got Ok(${JSON.stringify((result as any).value)})`,
    );
  }
}

/**
 * Assert that a function throws an error.
 */
export async function assertThrows(fn: () => Promise<unknown> | void, message?: string): Promise<void> {
  try {
    await fn();
    throw new AssertionError(message ?? "Expected function to throw, but it did not");
  } catch (error) {
    if (error instanceof AssertionError) throw error;
    // Expected throw — assertion passes
  }
}

/**
 * Assert that two numbers are approximately equal.
 */
export function assertApprox(actual: number, expected: number, tolerance: number = 0.001, message?: string): void {
  if (Math.abs(actual - expected) > tolerance) {
    throw new AssertionError(
      message ?? `Expected ${expected} ± ${tolerance}, got ${actual}`,
    );
  }
}

/**
 * Assert that a string contains a substring.
 */
export function assertContains(haystack: string, needle: string, message?: string): void {
  if (!haystack.includes(needle)) {
    throw new AssertionError(
      message ?? `Expected string to contain "${needle}", got: ${haystack.slice(0, 100)}`,
    );
  }
}

/**
 * Assert that an array has a specific length.
 */
export function assertLength(arr: unknown[], length: number, message?: string): void {
  if (arr.length !== length) {
    throw new AssertionError(
      message ?? `Expected array of length ${length}, got ${arr.length}`,
    );
  }
}

/**
 * Custom assertion error that works with bun:test.
 */
export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssertionError";
  }
}