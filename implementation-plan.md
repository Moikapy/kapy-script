# Kapy-Script Implementation Plan

**Date:** 2026-04-30
**Status:** Draft
**Based on:** [kapy-script-design.md](./2026-04-30-kapy-script-design.md)

---

## Overview

This plan breaks the kapy-script compiler and runtime into concrete, deliverable milestones. Each phase produces a working system you can actually use — not just internals.

**Tech Stack:** TypeScript, running on Bun
**Target:** Bun runtime (JavaScriptCore engine)
**Testing:** Bun's built-in test runner

---

## Phase 1: Lexer & Parser (Week 1-2)

**Goal:** Parse `.kapy` files into an AST. No type checking, no transpilation — just proving the grammar works.

### Deliverables

| Item | Description | Test Criteria |
|------|-------------|---------------|
| Grammar spec | Formal PEG grammar for kapy-script | All syntax examples from the spec parse correctly |
| Lexer | Tokenize `.kapy` source into token stream | Handles indentation, strings, numbers, keywords, operators |
| Parser | Build AST from token stream | Produces typed AST nodes for all v0.1 syntax |
| Error recovery | Continue parsing after errors, report multiple errors per file | No single typo crashes the parser |
| REPL skeleton | Parse and echo AST (no execution yet) | `kapy repl` starts, parses input, shows AST |

### v0.1 Syntax to Support

```
fn, agent, tool, trait, sealed, impl, match, if, else, for, while
input, output, steps, return
=, :=, ->, |>, ?, !, ., :, ::
llm(), embed()
string, number, boolean, any, void, T[]
Comments: # line comments
```

### File Structure

```
kapy/
  src/
    lexer/
      token.ts          # Token types
      lexer.ts           # Tokenizer
    parser/
      ast.ts             # AST node types
      parser.ts          # Recursive descent parser
      errors.ts          # Parse error types
    cli/
      main.ts            # kapy CLI entry point
  test/
    lexer.test.ts
    parser.test.ts
```

### Key Decisions

- **Parser approach:** Hand-written recursive descent. PEG parsers are hard to debug and produce poor error messages. Recursive descent gives full control over error recovery and messaging.
- **Indentation tracking:** Use a stack of indentation levels, similar to Python's approach. Emit `INDENT` and `DEDENT` tokens.
- **AST representation:** Each node carries source location (file, line, column) for error reporting.

### Exit Criteria

- [ ] `kapy check examples/agent.kapy` parses without error
- [ ] All v0.1 syntax examples from the design spec parse correctly
- [ ] Parse errors point to exact file:line:column with helpful messages
- [ ] REPL can parse input and show AST

---

## Phase 2: Type Checker v0.1 (Week 3-4)

**Goal:** Add basic type inference and checking. This is the simplest type system that makes the language usable.

### Deliverables

| Item | Description | Test Criteria |
|------|-------------|---------------|
| Type checker | Local type inference, primitive types, basic ADTs | Catches type mismatches |
| Type inference | Infer variable types from RHS, infer function returns from body | Minimal annotations required |
| ADT support | `sealed trait` + `case` with positional fields | Pattern matching on ADTs type-checks |
| Error messages | Type errors point to `.kapy` source with suggestions | `Error: Expected string, got number at agent.kapy:12:5` |
| `kapy check` | Type-check only, no execution | Returns exit 0 on success, 1 on type errors |

### Type System (v0.1 Scope Only)

```typescript
// Types the checker understands
PrimitiveType: string | number | boolean | any | void
ArrayType: T[]
RecordType: { key: Type }
FunctionType: (InputTypes) => OutputType
ADTType: sealed trait with cases
GenericType: List[T], Map[K, V]  // declaration only, no variance
ResultType: Result[Ok, Err]  // built-in
```

### File Structure

```
kapy/
  src/
    typechecker/
      types.ts          # Type representation
      checker.ts        # Type checking logic
      inference.ts      # Type inference
      errors.ts         # Type error types
  test/
    typechecker.test.ts
```

### Exit Criteria

- [ ] `kapy check` catches type mismatches
- [ ] Type inference works for simple cases (no annotations needed)
- [ ] ADTs type-check correctly
- [ ] Version-gated features give clear "requires v0.5+" errors
- [ ] All type errors point to `.kapy` source locations

---

## Phase 3: Transpiler (Week 5-7)

**Goal:** Emit working TypeScript from the typed AST. This is the moment `kapy run hello.kapy` actually produces output.

### Deliverables

| Item | Description | Test Criteria |
|------|-------------|---------------|
| TypeScript emitter | Convert typed AST to clean `.ts` | Output is readable, debuggable TypeScript |
| Source maps | Generate `.ts.map` files mapping back to `.kapy` | Runtime errors point to `.kapy` lines |
| `.kapy-cache/` | Content-hash-based cache of transpiled output | Unchanged files reuse cache |
| `kapy run` | Full pipeline: parse → type-check → transpile → execute via Bun | `kapy run hello.kapy` prints "Hello, kapy-script!" |
| Import resolution | Resolve `import` statements for local and stdlib modules | Can import and call functions from other `.kapy` files |
| npm interop | Import npm packages from `.kapy` files | `import { z } from "zod"` works |

### Transpilation Mappings

| Kapy-Script | TypeScript |
|-------------|-----------|
| `fn greet` `input name: string` | `async function greet(name: string)` |
| `Result[T, E]` | `Result<T, E>` (from `@kapy/runtime`) |
| `match x` `Ok(v) -> ...` | `switch` + type narrowing |
| `?` operator | `if (result.isErr()) return result` |
| `parallel` block | `await Promise.all([...])` |
| `agent` keyword | Structured function with `@kapy/runtime` agent support |
| `llm()` | `(await llm(...))` from `@kapy/runtime` |
| `embed()` | `(await embed(...))` from `@kapy/runtime` |

### File Structure

```
kapy/
  src/
    transpiler/
      emitter.ts        # AST → TypeScript code generation
      sourcemap.ts      # Source map generation
      cache.ts          # .kapy-cache/ management
      imports.ts        # Import resolution
    runtime/
      index.ts          # @kapy/runtime package
      result.ts         # Result[T, E] implementation
      llm.ts            # llm() builtin
      embed.ts           # embed() builtin
      agent.ts           # Agent runtime
      observability.ts   # Tracing, cost tracking
```

### Exit Criteria

- [ ] `kapy run hello.kapy` prints "Hello, kapy-script!"
- [ ] Runtime errors in `.ts` map back to `.kapy` source lines
- [ ] Can import and use npm packages
- [ ] `.kapy-cache/` correctly invalidates on file change
- [ ] `Result[T, E]` works with `?` and `!` operators

---

## Phase 4: CLI & Runtime (Week 8-9)

**Goal:** Complete the developer experience — REPL, project scaffolding, test runner.

### Deliverables

| Item | Description | Test Criteria |
|------|-------------|---------------|
| REPL | Interactive `kapy repl` with multi-line input | Can define functions, run expressions |
| `kapy init` | Scaffold a new kapy-script project | Creates `kapy.pkg`, `src/`, `.gitignore` |
| `kapy test` | Run tests defined with `test` keyword | Discovers and runs tests, reports results |
| `kapy.pkg` parsing | Read and resolve `kapy.pkg` manifest | Resolves dependencies |
| Mocking system | `mock_llm`, `mock_embed`, `mock_tool` for tests | Tests run without real LLM calls |

### CLI Commands

```bash
kapy run <file>           # Execute a .kapy file
kapy repl                 # Interactive REPL
kapy test <file>          # Run tests
kapy check <file>         # Type-check only
kapy init <name>          # Scaffold new project
kapy run --watch <file>   # Watch mode (re-run on change)
```

### REPL Commands

```
:help        Show available commands
:type <expr> Show inferred type
:load <file> Load a .kapy file
:quit        Exit REPL
```

### `kapy init` Output

```
my-project/
  kapy.pkg
  src/
    main.kapy
  test/
    main.test.kapy
  .gitignore
  .kapy-cache/
```

### Exit Criteria

- [ ] `kapy init my-project` creates a working project
- [ ] `kapy test` discovers and runs tests
- [ ] REPL handles multi-line input and shows results
- [ ] Mocking system works for `llm()`, `embed()`, `tool`
- [ ] `kapy run --watch` re-executes on file change

---

## Phase 5: Standard Library v0.1 (Week 10-13)

**Goal:** Ship enough stdlib to build real applications. HTTP, filesystem, JSON, testing, and AI provider adapters.

### Deliverables

| Module | Contents | Priority |
|--------|----------|----------|
| `@kapy/runtime` | Result type, llm, embed, observability, agent runtime | P0 — ships in Phase 3 |
| `kapy/ai/providers` | OpenAI, Anthropic adapters (config-driven) | P0 |
| `kapy/ai/chain` | Sequential and parallel LLM chains | P1 |
| `kapy/http` | HTTP client (fetch wrapper) | P0 |
| `kapy/web/router` | HTTP server with routing | P1 |
| `kapy/fs` | File read/write/watch | P0 |
| `kapy/json` | JSON parse/stringify | P0 |
| `kapy/test` | Test runner, assertions, mocking | P0 |

### `kapy/ai/providers` Design

```kapyscript
# kapy.pkg configuration for provider
ai_provider: openai
ai_model: gpt-4
ai_api_key: env.OPENAI_API_KEY
ai_options
  temperature: 0.7
  max_tokens: 2048
```

Multiple providers supported via configuration, not code changes:

```kapyscript
# Switch to Anthropic by changing config only
llm("Classify this", input) -> result  # Same code, different provider
```

### Exit Criteria

- [ ] Can build a working HTTP API server in kapy-script
- [ ] Can make LLM calls via `llm()` with configurable providers
- [ ] Can read/write JSON files
- [ ] Tests run with mocking support
- [ ] `kapy/ai/chain` supports sequential and parallel chains

---

## Phase 6: Polish & Documentation (Week 14-16)

**Goal:** Make kapy-script ready for early adopters. Error messages, docs, examples, formatting.

### Deliverables

| Item | Description |
|------|-------------|
| Error messages | Clear, actionable errors for all compiler phases |
| `kapy fmt` | Opinionated code formatter |
| `kapy lint` | Basic lint rules (unused variables, missing `steps`, `panic` in library) |
| Documentation | Getting started guide, language reference, examples |
| Example projects | Web API, CLI tool, AI agent — all working end-to-end |
| Tutorial | "Build your first kapy-script app" walkthrough |

### Error Message Quality Targets

Every error must include:
1. **File, line, column** — exact location
2. **What went wrong** — in plain language
3. **What to do** — actionable suggestion
4. **Version gate** — if it's a feature not yet available, state which version adds it

Example:
```
Error: Cannot call `llm()` outside of `fn` or `agent` body
  → agent.kapy:15:3
   |
15|   llm("Classify this", data) -> result
   |   ^^^
   |
  `llm()` is only available inside function or agent definitions.
  Did you mean to wrap this in a function?

  fn classify
    input data: string
    output string
    llm("Classify this", data) -> result
```

### Documentation Structure

```
docs/
  getting-started.md     # Installation, hello world
  language-reference.md  # Full syntax reference
  stdlib.md              # Standard library docs
  examples/
    web-api/             # HTTP API example
    cli-tool/            # CLI tool example
    ai-agent/            # AI agent example
  migration-guide.md     # TypeScript → kapy-script
```

### Exit Criteria

- [ ] All compiler errors meet quality targets
- [ ] `kapy fmt` formats all example projects correctly
- [ ] `kapy lint` catches common mistakes
- [ ] Getting started guide works end-to-end
- [ ] All 3 example projects build and run without errors

---

## Phase 7: v0.1 Release (Week 16-18)

**Goal:** Cut the first public release. Package it, announce it, get feedback.

### Deliverables

| Item | Description |
|------|-------------|
| npm package | `npm install -g kapy-script` installs the CLI |
| GitHub repo | Public repo with issues, discussions, contributing guide |
| Release notes | v0.1 changelog with known limitations |
| Roadmap | Published v0.5 and v1.0 plans |
| Playground | Web-based REPL for trying kapy-script in the browser |

### Known Limitations (v0.1)

To set expectations, these features will NOT be in v0.1:
- Traits and trait resolution (v0.5)
- Exhaustiveness checking in pattern matching (v0.5)
- Union and intersection types (v0.5)
- Package manager (`kapy pkg install`/`publish`) (v0.5)
- Watch mode may have edge cases with complex imports
- LSP/IDE support (v1.0)

### Release Checklist

- [ ] All Phase 1-6 exit criteria pass
- [ ] `npm install -g kapy-script` works on macOS and Linux
- [ ] `kapy init` + `kapy run` works in a clean environment
- [ ] All example projects build and run
- [ ] Documentation site is live
- [ ] GitHub repo is public with CONTRIBUTING.md
- [ ] v0.1 release notes published

---

## Phase 8+: Post v0.1 Roadmap

These phases are less detailed — they'll be planned more carefully once v0.1 is in users' hands and we have real feedback.

### Phase 9: v0.5 — Get Useful (Months after v0.1)

| Feature | Effort | Dependency |
|---------|--------|-----------|
| Exhaustiveness checking | High | v0.1 pattern matching |
| Traits + impl | Very High | v0.1 ADTs |
| Full generics with bounds | High | v0.1 simple generics |
| Union & intersection types | Medium | v0.1 type checker |
| Nullable types (`T?`) | Low | Union types |
| `kapy/ai/react` | Medium | v0.1 `kapy/ai/providers` |
| `kapy/ai/rag` | High | v0.1 embedding support |
| `kapy/ai/memory` | Medium | v0.1 agent runtime |
| `kapy/web/html` | Medium | v0.1 `kapy/web/router` |
| `kapy fmt` | Medium | Stable AST |
| `kapy lint` | Medium | Stable type checker |
| `kapy pkg install`/`publish` | High | v0.1 `kapy.pkg` parsing |
| Import graph incremental compilation | High | v0.1 cache system |

### Phase 10: v1.0 — Production Stable (1-2 Years)

| Feature | Effort | Notes |
|---------|--------|-------|
| Variance annotations | High | Requires mature type checker |
| Production-hardened compiler | Very High | Error messages, edge cases, performance |
| LSP implementation | Very High | Full IDE support |
| FFI type-safe interop | High | TypeScript type mapping |
| `kapy build` distributable output | Medium | Single binary output |
| Performance benchmarks | Medium | Comparison with TypeScript, Python |
| Migration guide | Low | Already drafted in design spec |

### Phase 11: v2.0+ — Advanced Types (3-5 Years)

Research-grade features, demand-driven:
- Higher-kinded types (`F[_]`)
- Type classes (Scala 3 `given`/`using`)
- Dependent function types
- Refinement types
- Opaque types
- Self-hosting compiler

---

## Dependency Graph

```
Phase 1: Lexer & Parser
    ↓
Phase 2: Type Checker v0.1
    ↓
Phase 3: Transpiler ←── @kapy/runtime starts here
    ↓
Phase 4: CLI & Runtime
    ↓
Phase 5: Standard Library v0.1
    ↓
Phase 6: Polish & Documentation
    ↓
Phase 7: v0.1 Release
    ↓
Phase 8+: Post-v0.1 (v0.5, v1.0, v2.0+)
```

Each phase depends on the previous one. **No parallel development** until v0.1 is stable — we need real user feedback before building v0.5 features.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| PEG grammar ambiguity | Medium | High | Hand-written recursive descent parser |
| Indentation parsing bugs | Medium | High | Exhaustive test suite for edge cases (mixed tabs/spaces, continuation lines) |
| Source map accuracy | Medium | Medium | Round-trip tests: `.kapy` line → `.ts` line → `.kapy` line |
| Bun API changes | Low | High | Pin Bun version, abstract runtime layer |
| npm package naming conflict | Medium | Low | Reserve `kapy-script` and `@kapy/runtime` on npm early |
| Type checker performance on large files | Low | Medium | Incremental checking, cache results |
| v0.1 scope creep | High | High | Strict phase boundaries, no feature additions mid-phase |

---

## Testing Strategy

### Unit Tests (Every Phase)

Each phase has comprehensive unit tests covering:
- Happy path: All syntax examples from the design spec
- Error path: Malformed input produces helpful error messages
- Edge cases: Indentation, unicode, very long lines, deeply nested structures

### Integration Tests (Phase 3+)

End-to-end tests that run `.kapy` files through the full pipeline:
- Parse → type-check → transpile → execute
- Compare output against expected results
- Source map round-trip verification

### Snapshot Tests (Phase 3+)

Transpiler output snapshots:
- Given `.kapy` input, produce `.ts` output
- Snapshots checked into git
- Any change to transpiler output requires explicit snapshot update

### Property-Based Tests (Phase 4+)

- Random `.kapy` programs should parse or produce a helpful error
- Type checker should never crash on any input
- Transpiler should produce valid TypeScript for all well-typed programs

---

## Success Metrics for v0.1

| Metric | Target |
|--------|--------|
| Can build and run a web API | ✅ End-to-end example works |
| Can build and run a CLI tool | ✅ End-to-end example works |
| Can build and run an AI agent | ✅ End-to-end example works with mocked LLM |
| Token savings vs equivalent TypeScript | ≥25% on real codebases |
| Error message quality | 100% of errors point to `.kapy` source with suggestion |
| Time to "Hello World" | < 5 minutes from install to running code |
| Compiler speed | < 1 second for files < 1000 lines |
| Test coverage | ≥80% for compiler, ≥90% for runtime |
