# runtime

> **Summary**: `@kapy/runtime` — runtime library consumed by transpiled kapy-script code. 176 lines. Provides `Result[T, E]` type with `Ok`/`Err` constructors and unwrap methods, `llm()` and `embed()` builtins with OpenAI API integration, `print()` console.log wrapper, and `KapyRuntime` utilities for agents, parallelism, and timeouts.

## Location
- `src/runtime/index.ts` (176 lines) — All runtime exports
- `src/runtime/package.json` — Package metadata for future npm publish

## Core Exports

### Result Type
```typescript
export type Result<T, E = string> = { _tag: "Ok"; value: T } | { _tag: "Err"; error: E }
export function Ok<T>(value: T): Result<T, any>
export function Err<E>(error: E): Result<any, E>
export function isOk(result): result is ResultOk
export function isErr(result): result is ResultErr
export function unwrap(result): T | throws
export function unwrapOrCrash(result): T | throws
export function unwrapOr(result, defaultValue): T
```

### AI Builtins
- `llm(prompt, input?, config?)` — OpenAI chat completions. Returns `Result<string, string>`. Configurable provider/model/temperature via `configureLLM()`.
- `embed(text, config?)` — OpenAI text-embedding-3-small. Returns `Result<number[], string>`.

### Print
- `print(value)` — `console.log(value)` wrapper

### KapyRuntime
- `KapyRuntime.createAgent({ tools, timeout? })` — Agent context
- `KapyRuntime.parallel({ name: fn, ... })` — Concurrent execution via `Promise.all`
- `KapyRuntime.withTimeout(ms, fn)` — `Promise.race` with timeout

## LLM Configuration
```typescript
configureLLM({
  provider: "openai",
  model: "gpt-4",
  temperature: 0.7,
  maxTokens: 2048,
})
// or via OPENAI_API_KEY env var
```

## Error Handling
All AI builtins return `Result[T, string]` — never throw. Errors are:
- Missing API key
- HTTP error from provider
- JSON parse failure

## Dependencies
- `fetch` (native Bun)
- `crypto` (for cache hashing, via [[transpiler]]/[[cache]])

## Dependents
- [[transpiler]] — Emitted code imports from `@kapy/runtime`

## See Also
- [[transpiler]] — Produces code that depends on this runtime
- [[kapy-script]] — Language overview
- [[type-checker]] — Validates that builtins have correct types