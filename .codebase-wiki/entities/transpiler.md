# transpiler

> **Summary**: AST-to-TypeScript emitter with content-hash-based `.kapy-cache/`. 646 lines across 3 files. Produces clean, readable TypeScript from typed AST. Handles all v0.1 syntax: fn, agent, tool, ADTs, pattern matching, Result ?/!, parallel blocks, pipeline, and interpolated strings.

## Location
- `src/transpiler/emitter.ts` (547 lines) — `Emitter.emit()` generates TS from Program AST
- `src/transpiler/cache.ts` (99 lines) — SHA256 content-hash cache with mtime invalidation
- `src/transpiler/index.ts` — Barrel file

## Pipeline
```
.kapy source
  → Lexer.tokenize() → Token[]
  → Parser.parse() → Program (AST)
  → TypeChecker.check() → error-free annotated AST
  → Emitter.emit() → { code, sourceMap }
  → Cache.set() → .kapy-cache/helloworld.<hash>.ts
  → Bun.run(tsPath) → 🏃 Hello, kapy-script!
```

## Transpilation Mappings

| Kapy-Script | TypeScript |
|------------|-----------|
| `fn greet \n  input name: string \n  output string \n  "Hello, {name}!"` | `export async function greet(name: string): Promise<string> { ... }` |
| `sealed trait Result \n  case Ok(...) \n  case Err(...)` | `export type Result = Ok | Err; export class Ok { ... }` |
| `=` / `:=` | `const` / `let` |
| `?` / `!` | `.unwrap()` / `.unwrapOrCrash()` |
| `think()` | Agent-scoped `KapyRuntime.createAgent()` |
| `parallel { ... }` | `await KapyRuntime.parallel({ ... })` |
| `match` | IIFE with `switch` (discriminated union) |
| `|>` pipeline | Nested `await stage(prev)` calls |
| `"Hello, {name}!"` | Template literal `` `Hello, ${name}!` `` |
| `for x in arr` | `for (const x of arr)` |

## Key Design Decisions
- **All functions are async** — Every emitted function is `async` returning `Promise<T>`. I/O is implicit in kapy-script, so the runtime handles `await` automatically. No `async/await` keywords in source, but every call is `await`-wrapped.
- **Discriminated unions for ADTs** — `sealed trait` → TS union type. Each `case` → class with constructor.
- **IIFE for match expressions** — `match` wraps in `(() => { switch(...) })()` to allow `return` per case.
- **Two-phase import collection** — First pass scans AST for `llm`, `embed`, `print`, `Result`, `parallel`, `agent` usage. Only imports what is used.
- **Source maps** — v0.1 basic JSON emitted. Full mapping deferred to v0.5.

## Cache
- SHA256 content hash → cache key
- `.kapy-cache/helloworld.<hash>.ts`
- mtime comparison invalidates stale cache
- `Cache.get()` returns cached path if valid
- `Cache.set()` writes transpiled output
- `Cache.clear()` wipes all entries

## Dependencies
- [[parser]] — Consumes typed AST nodes
- [[type-checker]] — Annotated AST (type info in AST nodes)
- [[runtime]] — `@kapy/runtime` import in emitted code

## Dependents
- [[cli]] — `kapy run` pipelines through emitter

## See Also
- [[kapy-script]] — Language overview
- [[runtime]] — Runtime library consumed by emitted code
- [[cli]] — CLI that orchestrates the full pipeline