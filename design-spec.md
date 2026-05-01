# Kapy-Script Design Spec

**Date:** 2026-04-30
**Status:** Draft
**Authors:** 0xKobold

---

## 1. Language Overview & Philosophy

**Kapy-script** is a programming language. Like Python, Rust, or Go — it has its own grammar, compiler, runtime, and standard library. You build software with it: websites, APIs, CLIs, data pipelines, scripts, desktop apps, anything.

The difference is that kapy-script is **designed for AI agent authorship**. Every syntax decision, every type system trade-off, every stdlib module is optimized so that an AI agent — any model, any framework — can pick it up and write correct, working code with fewer tokens and fewer errors than equivalent TypeScript or Python.

It transpiles to TypeScript and runs on Bun with a Python-like execution model: `.kapy` is source-of-truth, compilation is invisible, `kapy run` just works.

### Core Principles

1. **Optimized for AI authorship** — Every design decision optimizes for AI readability and writeability. Fewer tokens, fewer error classes, predictable structure. The result is a language clean enough for anyone.
2. **A real programming language** — Not a DSL, not a framework, not an SDK. Build anything you'd build with Python or TypeScript.
3. **Explicit contracts** — Every function declares its inputs and outputs. No guessing what goes in or comes out.
4. **Phased power** — Ship useful early, grow the type system as real usage demands it.
5. **Ecosystem access** — Transpiles to TypeScript, so the entire npm/Bun ecosystem is available.

### What Makes Kapy-Script Different

- **Token-efficient** — Indentation-based, minimal punctuation (~25-35% fewer tokens than equivalent TypeScript for general code, 40-50% for AI patterns). Cheaper inference, more context per dollar.
- **Error-resistant** — No braces to mismatch, no semicolons to forget, no `async/await` to miss. Eliminates the most common AI-generated syntax errors.
- **Contract-first** — Every function has `input` and `output` declarations. AI agents always know what a function expects and returns.
- **AI features built in** — `llm()`, `embed()`, and `tool` are first-class because modern apps increasingly include AI features. Not because the language is "about AI."
- **Scala-grade types, phased** — Powerful type system that grows with you, but starts simple.

---

## 2. Syntax & Semantics

### 2.1 Structural Rules

- **Indentation-based blocks** — No braces. 2 spaces per level (fewer tokens, consistent)
- **No semicolons** — Newlines terminate statements
- **No parentheses on control flow** — `if`, `match`, `for`, `while` take bare expressions
- **Keywords lowercase** — `fn`, `agent`, `trait`, `sealed`, `match`, `import`

### 2.2 Function Definition

Functions are the core unit. Every function has explicit `input` and `output`:

```kapyscript
fn greet
  input name: string
  output string

  "Hello, {name}!"
```

Type inference makes annotations optional when unambiguous:

```kapyscript
fn double
  input x
  output x * 2  # inferred: number -> number
```

Multi-expression bodies use `steps`:

```kapyscript
fn search_and_summarize
  input query: string
  output Summary

  steps
    search(query) -> results
    filter(results, r => r.relevance > 0.7) -> top
    summarize(top) -> summary
    return summary
```

### 2.3 Algebraic Data Types

```kapyscript
sealed trait Result
  case Ok(value: T)
  case Err(message: string)

sealed trait Shape
  case Circle(radius: number)
  case Rectangle(width: number, height: number)
```

### 2.4 Pattern Matching

```kapyscript
fn area
  input shape: Shape
  output number

  match shape
    Circle(r) -> 3.14159 * r * r
    Rectangle(w, h) -> w * h
```

Exhaustiveness checking enforced at compile time (phased: strict in v0.5+, best-effort in v0.1).

### 2.5 Traits

```kapyscript
trait Summarizable
  fn summarize
    input self
    output string

impl Summarizable for Document
  fn summarize
    input self
    output string
    llm("Summarize this document", self.content) -> raw
    return raw.text
```

### 2.6 Variables & Pipelines

```kapyscript
name = "kapy"           # immutable by default
count := 0              # mutable (note the :=)

# Pipeline operator chains operations left-to-right
query |> search |> filter(r => r.score > 0.5) |> summarize
```

### 2.7 AI Builtin Primitives

Modern applications increasingly include AI features. Rather than requiring third-party SDKs and boilerplate, kapy-script provides three built-in primitives:

```kapyscript
# LLM call — provider-agnostic
llm("Classify this text", input) -> result

# Embedding — vector representation
embed(document) -> vector

# Tool registration — makes a function available to LLM calls
tool search_web
  input query: string
  output Result[]

  # implementation
  http.get("https://api.search/{query}") -> response
  return parse(response)
```

These are language-level features because they're as common in modern apps as HTTP calls or file I/O. However, see the Open Questions section for a discussion on whether these should remain builtins or move to stdlib.

**Note on testing:** `llm()` and `embed()` calls are deterministic in test mode via `with mock_llm` (see Section 10). Production calls respect rate limits and budget caps (see Section 11).

### 2.8 Agents

The `agent` keyword defines a structured AI agent — a reusable unit that bundles an LLM with tools and a behavior pattern:

```kapyscript
agent ResearchAgent
  input query: string
  output Report

  tools
    search_web, read_document, cite_sources

  steps
    think("Plan research approach for {query}") -> plan
    search_web(query) -> sources
    read_document(sources) -> findings
    cite_sources(findings) -> report
    return report
```

#### Agent Runtime Semantics

An `agent` is **syntactic sugar** that transpiles to a structured function with these runtime behaviors:

| Behavior | Default | Configurable |
|----------|---------|-------------|
| **Execution model** | Sequential `steps`, each step is an `await` | Steps run sequentially by default |
| **`think` keyword** | Calls LLM with the prompt and available context, returns structured reasoning | Transpiles to `llm()` with a system prompt template |
| **Tool registration** | `tools` block registers functions as callable tools with the LLM | Transpiles to tool registration in the runtime |
| **Error handling** | Failed tool calls return `Err`, the agent can retry or abort | Follows standard `Result[T, E]` pattern |
| **Retries** | No automatic retries — the author explicitly handles retries in `steps` | Use `retry()` from `kapy/ai` stdlib |
| **Timeout** | Default 30 seconds per LLM call, configurable per agent | `timeout: Duration` in agent declaration |
| **Streaming** | Agents stream output by default in REPL mode, return complete in script mode | Transpiles to streaming-compatible runtime calls |
| **Cost tracking** | Every `llm()` and `embed()` call logs token usage to `kapy.observability` | See Section 9 |

An `agent` is **not magic** — it transpiles to a regular async function. The `think` and `tools` keywords provide structure, but the runtime behavior is explicit and inspectable:

```typescript
// Transpiled output of agent ResearchAgent
async function ResearchAgent(query: string): Promise<Result<Report, string>> {
  const runtime = KapyRuntime.createAgent({
    tools: [searchWeb, readDocument, citeSources],
    timeout: Duration.seconds(30)
  });
  const plan = await runtime.think("Plan research approach for {query}", { query });
  const sources = await searchWeb(query);
  // ... explicit, no magic
}
```

This is a **feature of the language**, not its purpose — just like Python has `import http.server` but isn't "the HTTP server language."

### 2.9 Concurrency

Modern apps need concurrency. Kapy-script provides structured concurrency primitives:

**Parallel execution** — run multiple operations concurrently:

```kapyscript
# All three run concurrently, results available when all complete
parallel
  fetch_user(id) -> user
  fetch_posts(id) -> posts
  fetch_comments(id) -> comments

# user, posts, and comments are all in scope after the parallel block
combine(user, posts, comments) -> result
```

**Explicit await** — all `llm()` and I/O operations are async under the hood, but there's no `async/await` keyword. The runtime handles this. Within a `parallel` block, all branches are awaited concurrently.

**Cancellation** — cooperative cancellation via context:

```kapyscript
fn long_running_task
  input ctx: Context
  output Result

  steps
    ctx.check_cancelled()? -> # returns Err if context was cancelled
    do_work()? -> result
    return result
```

**Timeouts** — built-in timeout support:

```kapyscript
# Timeout after 10 seconds
with timeout(10.seconds)
  slow_operation() -> result
```

The concurrency model maps to JavaScript's `Promise.all` and `AbortController` under the hood — the transpiler handles the `async/await` plumbing.

---

## 3. Compiler Architecture

### 3.1 Execution Model (Python-style)

```bash
kapy run agent.kapy        # parse → type-check → transpile → execute via Bun
kapy repl                   # interactive REPL
kapy test agent.kapy        # test runner
kapy build                  # produce distributable output
kapy check agent.kapy       # type-check only, no execution
```

Under the hood:

```
.kapy source
    ↓
Lexer (tokenizer)
    ↓
Parser → AST
    ↓
Type Checker (Scala-grade, phased)
    ↓
Transpiler → .ts (cached in .kapy-cache/)
    ↓
Bun executes
```

The `.kapy-cache/` directory is the equivalent of Python's `__pycache__/` — cached transpilation output, gitignored, never touched by the user. Cache invalidation is content-hash-based: if the `.kapy` file hasn't changed, reuse the `.ts` cache.

### 3.2 Compiler Pipeline

| Phase | Responsibility | Output |
|-------|---------------|--------|
| **Lexer** | Tokenize `.kapy` source | Token stream |
| **Parser** | Build AST from tokens | Typed AST nodes |
| **Type Checker** | Infer types, resolve traits, check exhaustiveness | Annotated AST |
| **Transpiler** | Emit TypeScript from annotated AST | `.ts` files in cache |
| **Runtime** | Hand off to Bun, manage cache, handle `kapy` CLI | Execution |

### 3.3 Transpiler Output

The emitted TypeScript is clean and readable — this aids debugging when users inspect stack traces:

```typescript
// Generated from: agent.kapy
// DO NOT EDIT — changes will be overwritten

async function greet(name: string): Promise<string> {
  return `Hello, ${name}!`;
}
```

AI builtins map to the kapy-script runtime library:

```typescript
// llm("Classify this", input) becomes:
import { llm } from "@kapy/runtime";
await llm("Classify this", input);
```

### 3.4 Error Handling in Compiler

Errors point back to `.kapy` source lines, never the transpiled `.ts`. The compiler generates source maps so Bun's runtime errors map cleanly:

```
Error in agent.kapy:12:5
  |
12|   search_web(query) -> results
   |   ^^^^^^^^^^^^
  |
  ToolNotFound: "search_web" is not registered
```

### 3.5 Incremental Compilation

- **Watch mode:** `kapy run --watch agent.kapy` — recompiles on file change
- **Import graph:** When `a.kapy` imports `b.kapy`, changing `b.kapy` invalidates both caches
- **Content hashing:** File content → SHA256 → cache key. No timestamps, no false invalidation

---

## 4. Type System Phasing

### v0.1 — Get Running (Weeks)

The minimum type system that makes the language usable:

| Feature | Support Level |
|---------|-------------|
| **Local type inference** | Variables infer from right-hand side. Function returns infer from body when unambiguous |
| **Basic ADTs** | `sealed trait` + `case` with positional fields |
| **Simple pattern matching** | No exhaustiveness checking yet |
| **Primitive types** | `string`, `number`, `boolean`, `any`, `void` |
| **Arrays & Records** | `T[]`, `{ key: T }` |
| **Generics (simple)** | `List[T]`, `Map[K, V]` — declaration only, no variance |

```kapyscript
# v0.1 — all of this works
sealed trait Result
  case Ok(value: any)
  case Err(message: string)

fn divide
  input a: number, b: number
  output Result
  if b == 0
    Err("division by zero")
  else
    Ok(a / b)
```

### v0.5 — Get Useful (Months)

Type system gains power for real-world code:

| Feature | Support Level |
|---------|-------------|
| **Exhaustiveness checking** | Compiler verifies all `match` cases are covered |
| **Traits** | Define and implement traits on types |
| **Trait resolution** | Compiler finds the right `impl` automatically |
| **Full generics** | Constraints, bounds, where clauses |
| **Union & intersection types** | `A \| B`, `A & B` |
| **Nullable types** | `T?` = `T \| null` |

```kapyscript
# v0.5 — traits + exhaustiveness + full generics

trait Printable
  fn to_string
    input self
    output string

sealed trait Result[T, E]
  case Ok(value: T)
  case Err(error: E)

impl Printable for Result[T, E]
  fn to_string
    input self
    output string
    match self
      Ok(v) -> "Ok({v})"
      Err(e) -> "Err({e})"
```

### v1.0 — Production Stable (Target: 1-2 Years)

Mature type system with production stability:

| Feature | Support Level |
|---------|-------------|
| **Variance annotations** | `[+T]` covariant, `[-T]` contravariant |
| **Production-hardened compiler** | Great error messages, fast compilation |
| **Full FFI** | Typed interop with TypeScript packages |
| **LSP** | Language Server Protocol for IDE support |

```kapyscript
# v1.0 — variance annotations

sealed trait Result[+T, +E]
  case Ok(value: T)
  case Err(error: E)
```

> **Note:** v1.0 focuses on production stability. Advanced type features (higher-kinded types, type classes, dependent types, refinement types) are deferred to v2.0+ (see roadmap). This is a deliberate scope reduction from earlier drafts — shipping a stable compiler is more valuable than research-grade type features.

### Phasing Principle

Never block the user. If a v0.1 program uses a v0.5 feature, the compiler gives a clear error with a version target — not a cryptic parse failure:

```
Error: Trait implementation requires kapy v0.5+
  |
 3| impl Printable for Result
   | ^^^^
  |
  Traits are not yet supported. Upgrade to kapy v0.5 or later.
  Current version: v0.1.2
```

---

## 5. Standard Library

### 5.1 Architecture

The stdlib is split into two layers:

| Layer | What | Example |
|-------|------|---------|
| **Builtin primitives** | Language grammar keywords | `llm`, `embed`, `tool` |
| **Standard library** | Importable modules | `kapy/ai`, `kapy/http`, `kapy/fs` |

Builtins are always available — no import needed. Stdlib modules are imported Python-style:

```kapyscript
import kapy/ai
import kapy/http
import kapy/fs
```

### 5.2 AI Standard Library (`kapy/ai`)

A feature-rich stdlib for applications that include AI capabilities. Built on the three language primitives, composed into higher-level patterns:

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `kapy/ai/react` | ReAct agent loop | `react_loop`, `reflect` |
| `kapy/ai/chain` | Sequential chain of calls | `chain`, `parallel` |
| `kapy/ai/rag` | Retrieval-augmented generation | `index`, `retrieve`, `augment` |
| `kapy/ai/memory` | Agent memory & context | `ShortTerm`, `LongTerm`, `episodic` |
| `kapy/ai/plan` | Planning & decomposition | `plan`, `subtask`, `decompose` |
| `kapy/ai/tools` | Tool composition & routing | `tool_registry`, `route` |
| `kapy/ai/providers` | LLM provider adapters | `openai`, `anthropic`, `ollama`, `bedrock` |

Example — adding AI features to an application:

```kapyscript
import kapy/ai/react

agent Solver
  input problem: string
  output string

  tools
    search, calculate, verify

  steps
    react_loop(problem) -> result
    return result
```

### 5.3 Web Standard Library (`kapy/web`)

For building web applications and APIs — the most common thing an AI agent will build:

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `kapy/web/router` | HTTP routing | `Router`, `get`, `post`, `middleware` |
| `kapy/web/html` | HTML templating | `html`, `render`, `fragment` |
| `kapy/web/static` | Static file serving | `serve_static`, ` SPA` |
| `kapy/web/session` | Session management | `Session`, `CookieStore`, `RedisStore` |
| `kapy/web/ws` | WebSocket support | `WebSocket`, `upgrade` |

Example — a web API:

```kapyscript
import kapy/web/router

fn handle_users
  input req: Request
  output Response

  match req.method
    GET -> ok(get_all_users())
    POST -> create_user(req.body)? -> ok(created)
    _ -> status(405, "Method not allowed")

router.start
  get "/users", handle_users
  get "/users/:id", handle_user_detail
  post "/users", handle_create_user
  listen 3000
```

### 5.4 General Standard Library

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `kapy/http` | HTTP client & server | `get`, `post`, `serve` |
| `kapy/fs` | File system | `read`, `write`, `watch` |
| `kapy/json` | JSON parsing & serialization | `parse`, `stringify` |
| `kapy/crypto` | Hashing & encryption | `sha256`, `encrypt` |
| `kapy/path` | Path manipulation | `join`, `resolve`, `basename` |
| `kapy/time` | Dates & durations | `now`, `Duration`, `sleep` |
| `kapy/test` | Testing framework | `test`, `expect`, `describe` |
| `kapy/fmt` | String formatting | `template`, `interpolate` |

### 5.5 Interop Bridge

Since kapy-script transpiles to TypeScript, the npm ecosystem is accessible:

```kapyscript
# Import any npm package
import { z } from "zod"

fn validate
  input data: any
  output boolean
  z.object({ name: z.string() }).safeParse(data).success
```

The transpiler emits standard ES module imports, so any npm package works at runtime. For type-safe interop, a FFI declaration syntax bridges kapy-script types to TypeScript types:

```kapyscript
# Declare types for untyped npm packages
ffi undici
  fn fetch
    input url: string
    output Promise[Response]
```

### 5.6 Standard Library Phasing

| Version | What Ships |
|--------|----------|
| **v0.1** | `kapy/ai/providers`, `kapy/ai/chain`, `kapy/http`, `kapy/web/router`, `kapy/fs`, `kapy/json`, `kapy/test` + npm interop |
| **v0.5** | `kapy/ai/react`, `kapy/ai/rag`, `kapy/ai/memory`, `kapy/ai/tools`, `kapy/web/html`, `kapy/web/static`, `kapy/crypto`, `kapy/time` |
| **v1.0** | `kapy/ai/plan`, `kapy/ai/providers` (full multi-provider), `kapy/web/session`, `kapy/web/ws`, `kapy/fmt`, `kapy/path`, FFI declarations |

---

## 6. Packages & Distribution

### 6.1 Module System

Python-style, filesystem-mapped:

```
my-project/
  agent.kapy            # import agent
  utils/                # import utils
    helpers.kapy         # import utils.helpers
    format.kapy          # import utils.format
    __init__.kapy        # optional, makes utils a package with exports
```

Imports are relative to project root:

```kapyscript
import utils.helpers
import kapy/ai/react
```

### 6.2 Package Manager: `kapy pkg`

Built on Bun's package manager — because the transpiled output is TypeScript, any kapy package is fundamentally an npm package:

```bash
kapy pkg install kapy/rag          # install a kapy library
kapy pkg install zod               # install an npm package
kapy pkg publish                   # publish to npm registry
```

A `kapy.pkg` file defines the package (like `package.json` but minimal):

```kapyscript
# kapy.pkg
name: "my-agent-lib"
version: "0.1.0"
description: "Research agent toolkit"
dependencies
  kapy/ai: "^0.1"
  zod: "^3.22"
entry: "src/index.kapy"
```

No JSON, no braces, no commas — just the same syntax as the language itself.

### 6.3 Package Resolution

| Import Style | Resolves To |
|---|---|
| `kapy/xxx` | Standard library (always available, no install needed) |
| `@scope/name` | npm registry package (installed via `kapy pkg install`) |
| `./relative` | Local project file |
| `utils.helpers` | Project module (filesystem-mapped) |

### 6.4 Distribution as npm Packages

When you `kapy pkg publish`, the CLI:

1. Transpiles all `.kapy` files to `.ts` and `.js`
2. Generates a `package.json` with proper `main`/`exports`
3. Bundles `@kapy/runtime` as a dependency
4. Publishes to the npm registry

Consumers can use it from TypeScript too:

```typescript
// In a regular TypeScript project:
import { ResearchAgent } from "my-agent-lib";
```

Kapy-script packages aren't a walled garden. They're first-class npm citizens.

### 6.5 `kapy` CLI Summary

| Command | Purpose |
|---|---|
| `kapy run <file>` | Execute a `.kapy` file |
| `kapy repl` | Interactive REPL |
| `kapy test <file>` | Run tests |
| `kapy check <file>` | Type-check only |
| `kapy build` | Transpile to `.ts` output directory |
| `kapy pkg install <pkg>` | Install dependency |
| `kapy pkg publish` | Publish to npm |
| `kapy fmt` | Format `.kapy` files |
| `kapy init` | Scaffold a new project |

---

## 7. Error Handling & Developer Experience

### 7.1 Error Handling

No exceptions. All errors are values — this aligns with the Scala tradition and the principle that error paths should be explicit and visible:

```kapyscript
# Errors are return values, not thrown
fn read_config
  input path: string
  output Result[Config, string]

  match fs.read(path)
    Ok(content) -> parse(content)
    Err(reason) -> Err("Config not found: {reason}")
```

The `Result[T, E]` type is the standard error channel. `Err` is never thrown — it's always returned and must be handled explicitly.

**The `?` operator** for ergonomic error propagation:

```kapyscript
fn process
  input path: string
  output Result[Report, string]

  read_config(path)? -> config        # short-circuits Err, unwraps Ok
  fetch_data(config)? -> data
  analyze(data)? -> report
  return report
```

The `?` operator is sugar for: "if this returned `Err`, return that `Err` immediately." Same purpose as Rust's `?` or Scala's `.fold`, but minimal syntax.

**The `!` operator** for explicit crash-on-error (for scripts and prototyping):

```kapyscript
content = fs.read("config.json")!   # throws if Err, use only when you mean it
```

### 7.2 Panic vs. Error

| Mechanism | Use When | Recovery |
|-----------|----------|----------|
| `Result[T, E]` | Expected failures (file not found, bad input) | Pattern match or `?` |
| `panic(msg)` | Programmer bugs (impossible state, assertion failure) | Cannot be caught. Process exits. |

No middle ground, no `try/catch`, no `finally`. Predictable for AI agents — every error path is visible in the code.

### 7.3 Compiler Errors

Errors point to `.kapy` source, never transpiled `.ts`. Source maps make this possible:

```
Error: Non-exhaustive match
  → agent.kapy:8:3
   |
 8 |   match shape
   |   ^^^^^^^^^^^
   |
   Missing cases: Triangle, Ellipse

Hint: Add a catch-all with `_ ->` if some cases are impossible
```

**Error categories:**

| Category | Example | Style |
|----------|---------|-------|
| Parse errors | Invalid syntax | Shows the exact token and what was expected |
| Type errors | Mismatched types | Shows both types and suggests fixes |
| Exhaustiveness | Incomplete match | Lists missing cases explicitly |
| Scope errors | Undefined variable | Suggests similar names |
| Version errors | Feature not yet available | States which version enables it |

### 7.4 REPL Experience

```bash
$ kapy repl
kapy v0.1.0 — Type :help for commands

> name = "kapy"
"kapy"

> llm("What is {name}?")
"Kapy-script is a programming language designed for AI agent authorship..."

> fn greet
.   input name: string
.   output string
.   "Hello, {name}!"
Defined: greet

> greet("world")
"Hello, world!"
```

Multi-line input uses `.` continuation prompt. The REPL supports:
- Expression evaluation
- Function definition
- Agent definition
- `:type <expr>` — show inferred type
- `:help` — available commands
- `:load <file>` — load a `.kapy` file into REPL session

### 7.5 Formatting & Linting

**`kapy fmt`** — opinionated formatter, like `gofmt`. One canonical style:

```bash
kapy fmt              # format all .kapy files in project
kapy fmt agent.kapy   # format specific file
kapy fmt --check      # CI check: exits 1 if any file is unformatted
```

**`kapy lint`** — catches common mistakes:

```bash
kapy lint              # lint all files
kapy lint --strict     # treat warnings as errors
```

| Rule | Description |
|------|-------------|
| Unused variable | Defined but never referenced |
| Shadowed binding | Variable name shadows outer scope |
| Unnecessary `?` | Expression can't return Err |
| `panic` in library | `panic` should only be in scripts, not libraries |
| Missing `steps` | Multi-expression body without `steps` block |

---

## 8. Token Efficiency Analysis

### Side-by-Side Comparison

**TypeScript (typical AI SDK pattern):**
```typescript
interface ResearchAgentInput {
  query: string;
}

interface ResearchAgentOutput {
  report: Report;
}

const researchAgentTools = [searchWeb, readDocument, citeSources];

async function researchAgent(input: ResearchAgentInput): Promise<ResearchAgentOutput> {
  const plan = await think("Plan research approach for " + input.query);
  const sources = await searchWeb(input.query);
  const findings = await readDocument(sources);
  const report = await citeSources(findings);
  return report;
}
```
**~72 tokens**

**Kapy-script:**
```kapyscript
agent ResearchAgent
  input query: string
  output Report

  tools
    search_web, read_document, cite_sources

  steps
    think("Plan research approach for {query}") -> plan
    search_web(query) -> sources
    read_document(sources) -> findings
    cite_sources(findings) -> report
    return report
```
**~39 tokens**

**→ 46% savings** on this example.

### Token Savings Breakdown

| Eliminated | Tokens saved per occurrence |
|---|---|
| `{ }` braces | ~2 per block |
| `;` semicolons | ~1 per statement |
| `( )` on control flow | ~2 per if/match |
| `async/await` | ~2 per call |
| Interface boilerplate | ~10-15 per interface |
| `const` / `let` / `: type` | ~2-3 per variable |
| `function` → `fn` | ~1 per function |
| `return` (implicit in expressions) | ~1 where elided |

### Realistic Estimate Across Codebase Types

| Code style | Estimated token savings |
|---|---|
| Simple functions & data | **25-35%** |
| Agent/tool patterns | **40-50%** |
| Complex type hierarchies | **35-45%** |

**Overall: ~25-35% fewer tokens** for general-purpose code, **40-50% fewer** for AI-specific patterns (agents, tools, pipelines). The compounding effect — cheaper inference, more context per dollar, faster iteration in agent loops — makes this significant at scale.

**Note:** v0.5+ code with type annotations will be more verbose, narrowing the gap. The 25-35% figure accounts for realistic codebases with type annotations, error handling, and imports.

---

## 9. Observability

AI-driven applications need visibility into what the AI is doing, what it costs, and why it made decisions. Kapy-script provides built-in observability for AI primitives.

### 9.1 Tracing

Every `llm()`, `embed()`, and `tool` call is automatically traced:

```kapyscript
# kapy.observability captures:
# - Timestamp
# - Function/agent name
# - Input and output
# - Token count (prompt + completion)
# - Latency
# - Provider and model

llm("Classify this", input) -> result
# Trace: [2026-04-30T10:15:32Z] llm("Classify this") -> "positive" | 142 tokens | 1.2s | openai/gpt-4
```

### 9.2 Cost Tracking

Per-agent and per-function token usage and cost:

```kapyscript
# Access cost data programmatically
agent ResearchAgent
  input query: string
  output Report

  steps
    think("Plan approach") -> plan           # tracked
    search_web(query) -> sources            # tracked
    llm("Synthesize", sources) -> report     # tracked
    return report

# After execution:
agent.cost    # { tokens: 3421, prompt: 2100, completion: 1321, estimated_usd: 0.034 }
```

### 9.3 Execution Logs

Structured logs for debugging agent behavior:

```bash
kapy run agent.kapy --log-level=debug
# [DEBUG] ResearchAgent.steps[1].think("Plan approach")
# [DEBUG]   -> plan: "Search for recent papers on..."
# [DEBUG] ResearchAgent.steps[2].search_web("quantum computing")
# [DEBUG]   -> sources: [3 results]
```

### 9.4 Replay Mode

Reproduce AI-driven behavior from recorded traces:

```bash
kapy run agent.kapy --replay=trace-2026-04-30.json
# Replays all llm/embed/tool calls from the trace file
# No actual LLM calls are made — deterministic reproduction
```

This is essential for debugging non-deterministic AI behavior in production.

---

## 10. Testing

Testing AI code requires deterministic behavior from non-deterministic systems. Kapy-script provides built-in mocking for AI primitives.

### 10.1 Mocking LLM Calls

```kapyscript
import kapy/test

test "summarizer produces summary"
  with mock_llm returning "Generated summary text"
    Summarizer("doc.txt") -> result
    expect result == "Generated summary text"
```

`mock_llm` intercepts all `llm()` calls within the test scope and returns the specified value. No real LLM calls are made.

### 10.2 Mocking Embeddings

```kapyscript
test "embeddings are compared correctly"
  with mock_embed returning [0.1, 0.2, 0.3]
    embed("hello") -> vec
    expect vec.cosine_similarity([0.1, 0.2, 0.3]) == 1.0
```

### 10.3 Tool Mocking

```kapyscript
test "search agent uses tools correctly"
  with mock_llm returning "Use search_web to find results"
  with mock_tool search_web returning ["result1", "result2"]
    SearchAgent("test query") -> result
    expect result.sources.length == 2
```

### 10.4 Property-Based Testing

```kapyscript
test "division handles all inputs"
  for_all a: number, b: number where b != 0
    divide(a, b) -> result
    match result
      Ok(val) -> expect val == a / b
      Err(_) -> expect false  # should never reach here
```

### 10.5 Integration Testing

For end-to-end tests that need real LLM calls:

```kapyscript
test "summarizer works with real LLM" integration
  # This test makes real LLM calls
  # Marked as 'integration' — skipped in fast test runs
  Summarizer("sample.txt") -> result
  expect result.length > 0
  expect result.type == string
```

```bash
kapy test                        # unit tests only (mocks)
kapy test --integration           # unit + integration tests
kapy test --integration --replay  # replay recorded traces
```

---

## 11. Security

AI primitives introduce unique security risks that kapy-script addresses with built-in safeguards.

### 11.1 Rate Limiting

Built-in rate limiting on `llm()` and `embed()` calls:

```kapyscript
# Per-agent rate limits
agent ResearchAgent
  input query: string
  output Report

  rate_limit
    max_calls: 10
    per: 1.minutes
    
  # ...
```

### 11.2 Budget Enforcement

Cost budgets prevent runaway AI spending:

```kapyscript
# Per-function budget cap
fn research
  input query: string
  output Result

  budget max: 0.50.usd  # Stop after $0.50 of LLM calls
  steps
    llm("Research", query) -> result
    return result
```

When the budget is exceeded, the function returns `Err("Budget exceeded: $0.50")`.

### 11.3 Tool Permissions

Tools declare what they can access — no implicit capabilities:

```kapyscript
tool search_web
  input query: string
  output Result[]
  permissions
    network: outbound
    rate_limit: 10.per_minute
  
  http.get("https://api.search/{query}") -> response
  return parse(response)
```

### 11.4 Input Sanitization

The `kapy/ai` stdlib provides sanitization utilities for preventing prompt injection:

```kapyscript
import kapy/ai/sanitize

fn safe_llm
  input prompt: string, data: string
  output Result

  sanitized = sanitize.escape_user_input(data)
  llm(prompt, sanitized) -> result
  return result
```

### 11.5 Audit Logging

All AI primitive calls can be logged to an audit trail:

```bash
kapy run agent.kapy --audit-log=audit.jsonl
```

Produces structured logs:

```json
{"timestamp": "2026-04-30T10:15:32Z", "call": "llm", "prompt_tokens": 2100, "completion_tokens": 1321, "model": "gpt-4", "agent": "ResearchAgent"}
```

---

## 12. Implementation Roadmap

### Phase 1: v0.1 — Get Running (Target: Weeks)
- [ ] Grammar specification (formal PEG grammar)
- [ ] Lexer & parser (hand-written or PEG, TypeScript, runs on Bun)
- [ ] Basic type system (inference, ADTs, simple generics)
- [ ] Transpiler: `.kapy` → `.ts` with source maps
- [ ] `kapy` CLI: `run`, `repl`, `check`
- [ ] `.kapy-cache/` with content-hash invalidation
- [ ] Runtime: `@kapy/runtime` package
- [ ] Builtins: `llm`, `embed`, `tool`
- [ ] Stdlib: `kapy/ai/providers`, `kapy/ai/chain`, `kapy/http`, `kapy/web/router`, `kapy/fs`, `kapy/json`, `kapy/test`
- [ ] npm interop (import existing packages)
- [ ] REPL with multi-line input
- [ ] `kapy init` project scaffolding
- [ ] Concurrency: `parallel` blocks
- [ ] Testing: `mock_llm`, `mock_embed`, `mock_tool`
- [ ] Observability: tracing, cost tracking
- [ ] Security: rate limiting, budget enforcement basics
- [ ] `kapy.pkg` package manifest parsing

### Phase 2: v0.5 — Get Useful (Target: Months)

- [ ] Exhaustiveness checking in pattern matching
- [ ] Traits + trait resolution
- [ ] Full generics with constraints and bounds
- [ ] Union & intersection types
- [ ] Nullable types (`T?`)
- [ ] Stdlib: `kapy/ai/react`, `kapy/ai/rag`, `kapy/ai/memory`, `kapy/ai/tools`
- [ ] Stdlib: `kapy/web/html`, `kapy/web/static`, `kapy/crypto`, `kapy/time`
- [ ] `kapy fmt` opinionated formatter
- [ ] `kapy lint` with core rules
- [ ] `kapy pkg install` and `kapy pkg publish`
- [ ] Import graph-aware incremental compilation
- [ ] Watch mode (`kapy run --watch`)
- [ ] Testing: property-based testing, integration tests
- [ ] Observability: replay mode, audit logging
- [ ] Security: tool permissions, input sanitization

### Phase 3: v1.0 — Production Stable (Target: 1-2 Years)

- [ ] Full generics with constraints and bounds (mature)
- [ ] Variance annotations (`[+T]`, `[-T]`)
- [ ] Stdlib: `kapy/ai/plan`, full multi-provider support
- [ ] Stdlib: `kapy/web/session`, `kapy/web/ws`, `kapy/fmt`, `kapy/path`
- [ ] FFI declarations for type-safe npm interop
- [ ] `kapy build` distributable output
- [ ] Language Server Protocol (LSP) implementation
- [ ] Production-hardened compiler with great error messages
- [ ] Performance benchmarks and optimization
- [ ] Migration guide: TypeScript → kapy-script

### Phase 4: v2.0+ — Advanced Types (Target: 3-5 Years)

These are research-grade type system features that require significant compiler engineering. They ship only when there's demonstrated demand and a proven implementation.

- [ ] Higher-kinded types (`F[_]`)
- [ ] Type classes (Scala 3 `given`/`using` style)
- [ ] Dependent function types
- [ ] Refinement types
- [ ] Opaq types (zero-cost newtype wrappers)
- [ ] Self-hosting compiler (kapy-script compiles itself)
---

## Appendix A: Example Programs

### A.1 — Hello World

```kapyscript
fn main
  print("Hello, kapy-script!")
```

### A.2 — Web API

```kapyscript
import kapy/web/router

fn handle_users
  input req: Request
  output Response

  match req.method
    GET -> ok(get_all_users())
    POST -> create_user(req.body)? -> ok(created)
    _ -> status(405, "Method not allowed")

router.start
  get "/users", handle_users
  get "/users/:id", handle_user_detail
  post "/users", handle_create_user
  listen 3000
```

### A.3 — AI-Powered Summarizer

```kapyscript
import kapy/ai/chain
import kapy/fs

agent Summarizer
  input path: string
  output string

  tools
    read_file, count_words

  steps
    fs.read(path)? -> content
    chain(
      "Extract key points from this text",
      "Write a 3-sentence summary from these points"
    )(content) -> summary
    return summary
```

### A.4 — CLI Tool

```kapyscript
import kapy/fs
import kapy/json

fn main
  input args: string[]
  output void

  if args.length == 0
    print("Usage: kapy run convert.kapy <file>")
    return

  match fs.read(args[0])
    Ok(content) ->
      json.parse(content)? -> data
      json.stringify(data, indent=2) -> formatted
      print(formatted)
    Err(msg) ->
      print("Error: {msg}")
```

### A.5 — Multi-Agent System

```kapyscript
import kapy/ai/react

agent Researcher
  input topic: string
  output Findings

  tools
    search, read_paper

  steps
    react_loop("Research {topic}") -> findings
    return findings

agent Writer
  input findings: Findings
  output Report

  tools
    draft, edit, cite

  steps
    react_loop("Write report from findings") -> report
    return report

fn research_and_report
  input topic: string
  output Report

  steps
    Researcher(topic) -> findings
    Writer(findings) -> report
    return report
```

---

## Appendix B: Open Questions

These are unresolved design decisions that need community input and real-world validation:

### B.1 Should AI Primitives Be Builtins or Stdlib?

**Current decision:** `llm()`, `embed()`, `tool` are language keywords.

**Argument for builtins:** AI features are as common as arithmetic in modern apps. Making them keywords means zero boilerplate.

**Argument for stdlib:** Language surface area should be minimal. `import kapy/ai` is only 2 tokens more. Reduces the language spec, makes the language easier to implement, and lets AI features evolve independently.

**Resolution:** Ship v0.1 with builtins. Evaluate moving to stdlib before v1.0 based on usage patterns.

### B.2 Variable Mutability Syntax

The current `=` for immutable and `:=` for mutable follows mathematical convention. Alternatives:
- `let` / `mut` (Rust-style) — more tokens but more explicit
- `val` / `var` (Scala-style) — familiar but adds keywords

**Resolution:** Keep `=` / `:=` for v0.1. Evaluate based on AI agent error rates.

### B.3 Async Model

Current design: no `async/await` keywords — the runtime handles async implicitly. All I/O and `llm()` calls are async under the hood.

**Risk:** This can be confusing for developers coming from TypeScript where `async/await` is explicit.

**Resolution:** v0.1 ships with implicit async. v0.5 evaluates whether explicit `async` markers improve readability for AI agents.

### B.4 FFI Type Safety

The `ffi` declaration syntax for TypeScript interop is sketched but not fully specified:
- How do generic TypeScript types map to kapy-script types?
- How are Promise types handled?
- What about TypeScript union types that don't exist in kapy-script yet?

**Resolution:** v0.1 uses `any` for all npm interop. v0.5 introduces typed FFI with v1.0 completing the type mapping.

### B.5 Package Namespace Collision

`kapy/` namespace is reserved for the standard library. But what about community packages that want to use `kapy/` prefixes?

**Resolution:** v0.1 reserves `kapy/` strictly. v0.5 introduces a `@kapy/` scoped registry for community packages.

---

## Appendix C: Migration Guide (TypeScript → Kapy-Script)

For teams adopting kapy-script from TypeScript:

| TypeScript | Kapy-Script | Notes |
|-----------|------------|-------|
| `function` | `fn` | Always |
| `async/await` | implicit | Runtime handles async automatically |
| `{ }` blocks | indentation | 2 spaces |
| `;` | newline | Newlines terminate statements |
| `interface Props { }` | `input/output` declarations | Contracts on functions |
| `try/catch` | `Result[T, E]` + `?` | Explicit error handling |
| `const` / `let` | `=` / `:=` | `=` is immutable, `:=` is mutable |
| `x \|\| y` | `match` or `?` | Pattern matching preferred |
| `Promise<T>` | `T` | Async is implicit |
| `Array<T>` | `T[]` | Same syntax |
| `Record<K,V>` | `{ key: V }` | Inline records |
| `type Foo = A \| B` | `sealed trait Foo; case A; case B` | ADTs |
| `switch` | `match` | With exhaustiveness checking |
