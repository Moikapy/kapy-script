---
name: kapy-script
description: Write, run, check, format, lint, and test kapy-script programs. Use when working with .kapy files, the @moikapy/kapy-script language, kapy CLI commands (run, check, test, init, repl, fmt, lint), kapy-script syntax questions, kapy-runtime imports, or any task involving files in a kapy-script project. Triggers include ".kapy files", "kapy run", "kapy check", "kapy test", "kapy init", "kapy-script", "kapy-script syntax", "kapy stdlib", "kapy/runtime", "AI-native language", "indentation-based syntax kapy", "Result type kapy", or any development task in a kapy-script project.
---

# kapy-script Language Guide

kapy-script is an AI-native programming language that transpiles to TypeScript and runs on Bun. It uses indentation-based syntax (2 spaces), no braces/semicolons, designed for token-efficient AI authorship.

## Key Principles

- **2-space indentation only** — tabs are rejected at lex time, no 4-space, no mixed
- **No braces, no semicolons** — blocks are indentation-based
- **All functions are async** — the transpiler always emits `async function` returning `Promise<T>`
- **String interpolation uses `{expr}`** — `\{` and `\}` escape literal braces
- **Result type for errors** — no exceptions, use `Result.Ok` / `Result.Err` with `?` (propagate) and `!` (crash) operators

## CLI Commands

All commands available via `kapy` CLI (either standalone or as kapy extension):

```bash
kapy run <file>          # Compile & execute a .kapy file
kapy run --watch <file>  # Re-run on file changes
kapy check <file>        # Parse & type-check (no execution)
kapy test [path]         # Run test declarations
kapy test <file>         # Run a single test file
kapy init <name>         # Scaffold a new project
kapy fmt <file>          # Format a .kapy file in place
kapy fmt --check <file>  # Check if formatting needed (exit 1 if dirty)
kapy fmt --dry-run <file># Print formatted output without writing
kapy lint <file>         # Lint for common issues
kapy lint --strict <file># Treat warnings as errors
kapy repl                # Interactive REPL
```

## Syntax Reference

### Functions

```kapy
fn main
  print("Hello, kapy-script!")

fn greet
  input name: string
  output string
  "Hello, {name}!"
```

- `input` declares parameters with type annotations
- `output` declares the return type
- Last expression is the return value (no explicit `return` needed)
- Use `return value` for early returns

### Variables

```kapy
x = 42        # immutable binding
y := x + 1     # mutable (note the :=)
```

### Types

Primitives: `number`, `string`, `boolean`, `any`, `void`
Array: `string[]`, `number[]`
Generic: `Map[string, number]`
Function params use `input` / `output`, not inline `: Type`

### Control Flow

```kapy
if x > 0
  "positive"
else
  "non-positive"

for item in items
  print(item)

while count > 0
  count = count - 1
```

`if/else` is an expression — it returns the value of the taken branch.

### Sealed Traits & Pattern Matching

```kapy
sealed trait Result
  case Ok(value: any)
  case Err(message: string)

match result
  Ok(v) -> v
  Err(e) -> handle_error(e)
```

Sealed traits are kapy-script's variant/enum type. Pattern matching dispatches on case constructors.

### Error Handling (Result Type)

```kapy
result = risky_operation()
result?     # Unwrap Ok value, propagate Err to caller
result!     # Unwrap Ok value, crash on Err (.unwrapOrCrash())
result ?? 0 # Default value if Err (.unwrapOr(0))
```

The runtime provides `ResultOk` and `ResultErr` class instances with `.unwrap()`, `.unwrapOrCrash()`, `.unwrapOr()` methods.

### Agents (AI)

```kapy
agent ResearchAgent
  input query: string
  output Report

  tools
    search_web, read_document

  steps
    search_web(query) -> sources
    read_document(sources) -> findings
    return findings
```

Agents are a first-class declaration for AI workflows. v0.1 emits structural scaffolding; full runtime dispatch is v0.5.

### Test Declarations

```kapy
test "addition works"
  1 + 1 == 2
```

Tests are transpiled to Bun test blocks and executed via `bun test`.

### Imports

```kapy
import kapy/http
import kapy/fs
import kapy/json
import kapy/ai
import kapy/ai/chain
import kapy/web/router
import kapy/test
```

These transpile to `@moikapy/kapy-runtime/<module>` subpath imports. Note: `kapy/test` contains the keyword `test` — the parser handles this via `consumeModuleSegment()` which accepts keywords in import paths.

### String Interpolation

```kapy
"Hello, {name}!"        # Interpolation
"\{ not interpolated \}" # Escaped braces (literal { and })
```

`{` inside a `"..."` string ALWAYS starts interpolation. Escape with `\{` and `\}` for literal braces.

### Operators

Arithmetic: `+`, `-`, `*`, `/`, `%`
Comparison: `==`, `!=`, `>`, `<`, `>=`, `<=`
Logical: `and`, `or`, `not`
Pipeline: `|>` (left-to-right function application)
Result: `?` (propagate Err), `!` (crash on Err)

### Comments

```kapy
# Single-line comments only (no block comments)
```

### Lambda Expressions

```kapy
fn x -> x + 1           # Single param
fn a, b -> a + b        # Multi param
app.get("/", fn req -> text("Hello"))
```

### Parallel & With

```kapy
parallel
  fetch_user(id)
  fetch_orders(id)
  fetch_settings(id)

with timeout: 5000
  slow_operation()
```

`parallel` runs tasks concurrently. `with timeout: N` sets a millisecond timeout. These are v0.1 syntax with warnings for future features.

### Member Access & Indexing

```kapy
user.name           # Dot access
items[0]            # Index access
result.value        # Property on Result Ok
```

### Record Literals

```kapy
user = { name: "Alice", age: 30 }
```

## Standard Library

| Import | Key Functions | Returns |
|-------|--------------|---------|
| `kapy/http` | `get(url)`, `post(url, body)`, `put(url, body)`, `del(url)` | `Promise<Response>` |
| `kapy/fs` | `readFile(path)`, `writeFile(path, content)`, `listDir(path)`, `stat(path)`, `deleteFile(path)`, `mkdir(path)`, `readJson(path)`, `writeJson(path, data)` | `Result<T, string>` |
| `kapy/json` | `parse(text)`, `stringify(value)`, `unsafeParse(text)`, `unsafeStringify(value)` | `parse`/`stringify` return `Result` |
| `kapy/ai` | `chat(prompt, opts?)`, `openaiChat(...)`, `anthropicChat(...)`, `ollamaChat(...)` | `Result<string, string>` |
| `kapy/ai/chain` | `run(steps)`, `parallel(prompts)`, `mapReduce(items, mapFn, reduceFn)` | Various |
| `kapy/web/router` | `create()`, `json(data)`, `text(str)`, `html(str)`, `redirect(url)`, `parseParams(pattern, url)` | Router instance |
| `kapy/test` | `assertEqual`, `assertTrue`, `assertFalse`, `assertOk`, `assertErr`, `assertThrows`, `assertApprox`, `assertContains`, `assertLength` | Test assertions |

### Mock System (for testing AI features)

```kapy
import kapy/ai

# In test setup:
mock_llm("Expected response")
mock_embed([0.1, 0.2, 0.3])

# chat() returns the mocked response instead of calling an API
result = chat("test prompt")
```

### The `print` Function

`print()` is variadic — accepts multiple arguments:
```kapy
print("x =", x, "y =", y)
```

## Project Structure

A kapy-script project (created by `kapy init`):

```
my-project/
  kapy.pkg          # Project manifest (like package.json for kapy)
  package.json      # NPM manifest (declares @moikapy/kapy-runtime dependency)
  .gitignore
  README.md
  .kapy-cache/      # Transpiled TypeScript output
  src/main.kapy     # Main entry point
  test/main.test.kapy
```

After scaffolding, always run `bun install` to install `@moikapy/kapy-runtime`.

## Runtime Package

The runtime is a separate npm package: `@moikapy/kapy-runtime`
- Subpath exports: `/fs`, `/http`, `/json`, `/ai`, `/ai/chain`, `/web/router`, `/test`
- Core exports: `Result`, `Ok`, `Err`, `llm`, `embed`, `print`, `mock_llm`, `mock_embed`, `parallel`, `withTimeout`

## Version-Gated Features

These parse but produce warnings (v0.5 features, not yet enforced):

| Feature | Status |
|---------|--------|
| `trait` declarations | Parses + warns |
| `impl` blocks | Parses + warns |
| Exhaustive match checking | Warns if non-exhaustive |
| `parallel` execution | Parses + warns |

## Common Patterns

### Web API Server

```kapy
import kapy/http
import kapy/json
import kapy/web/router

fn main
  output any
  app = router.create()
  app.get("/", fn req -> text("Hello!"))
  app.get("/users/:id", fn req ->
    params = router.parseParams("/users/:id", req.url)
    json({ user_id: params.id })
  )
  app.post("/data", fn req ->
    body = json.parse(req.body)
    json({ received: body })
  )
  app.listen(3000)
```

### File Operations with Result

```kapy
import kapy/fs
import kapy/json

fn read_config
  input path: string
  output any
  result = fs.readJson(path)
  result?  # Propagate Err to caller
```

### Test with Assertions

```kapy
import kapy/test
import kapy/json

test "json parse returns Result"
  result = json.parse("\{ \\\"key\\\": 1 \}")
  assertOk(result)

test "json parse handles invalid input"
  result = json.parse("not json")
  assertErr(result)
```

Note the escaped braces in JSON string literals: `\{` and `\}` produce literal `{` and `}` in the string.

## Things to Watch Out For

1. **No tabs** — Tabs in indentation cause a lex error. Always use 2 spaces.
2. **One indent level at a time** — Going from 0 to 4 spaces (skipping 2) is an error.
3. **`{` in strings always starts interpolation** — Use `\{` for a literal brace.
4. **`test` is a keyword** — But it works in import paths like `import kapy/test`.
5. **All functions are async** — The transpiler wraps every function in `async`.
6. **`:=` for mutable** — Regular `=` creates an immutable binding in the type checker (though the transpiler doesn't enforce this at runtime yet).
7. **`?` propagates Err** — It's not optional chaining. It unwraps Ok or returns Err from the current function.
8. **`!` crashes on Err** — It's not a non-null assertion. It unwraps Ok or throws.
9. **`and`/`or`/`not`** — Use these instead of `&&`, `||`, `!` for logical operators.
10. **`#` comments only** — No `//` or `/* */` block comments exist.

## Transpilation Target

kapy-script transpiles to TypeScript. The output goes to `.kapy-cache/` directories. The emitted TypeScript:
- Uses `async function` for all functions
- Imports from `@moikapy/kapy-runtime` for stdlib
- Uses `ResultOk`/`ResultErr` class instances
- Runs on Bun (not Node.js directly)