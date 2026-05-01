# Kapy-Script Codebase Wiki

## Overview
**kapy-script** is a programming language designed for AI agent authorship. Transpiles to TypeScript and runs on Bun with a Python-style execution model.

**Current phase:** v0.1 — **Lexer, Parser, Type Checker, Transpiler, and Runtime complete.** Stdlib is next.

## Key Pages

### Language & Design
- [[kapy-script]] — Language concept, syntax, and design philosophy
- [[adr-001-hand-written-recursive-descent-parser]] — Parser architecture
- [[adr-002-indentation-based-syntax-with-indent-dedent-tokens]] — Indentation syntax
- [[adr-003-transpile-to-typescript--execute-via-bun]] — Runtime strategy
- [[adr-004-two-pass-type-checker--register-then-check-]] — Type checker architecture
- [[adr-005-structural-type-compatibility-with-any-coercion]] — Type system design

### Modules
| Module | Phase | Lines | Status | Description |
|--------|-------|-------|--------|-------------|
| [[lexer]] | 1 | 570 | ✅ Complete | Tokenizer — INDENT/DEDENT, string interpolation |
| [[parser]] | 1 | 1,769 | ✅ Complete | Recursive descent parser — typed AST for all v0.1 |
| [[type-checker]] | 2 | 841 | ✅ Complete | Two-pass type inference, ADTs, Result ?/! operators |
| [[transpiler]] | 3 | 646 | ✅ Complete | AST → TypeScript emitter, .kapy-cache/ |
| [[runtime]] | 3 | 176 | ✅ Complete | @kapy/runtime — Result, llm, embed, print, KapyRuntime |
| [[cli]] | 1-3 | 285 | ✅ Complete | `kapy run/check/repl` — full pipeline |

## Source Tree
```
src/
  cli/main.ts           # CLI entry point (285 lines)
  lexer/                # Tokenizer (570 lines)
    token.ts             # Token types & spans
    lexer.ts             # Indentation-aware lexer
    index.ts             # Exports
  parser/                # AST parser (1,769 lines)
    ast.ts               # AST node types
    parser.ts            # Recursive descent parser
    errors.ts            # Parse error types
    index.ts             # Exports
  typechecker/            # Type checker (841 lines)
    checker.ts           # TypeChecker + TypeEnv + typesCompatible
    errors.ts            # TypeCheckError with source context
    index.ts             # Exports
  transpiler/             # Transpiler (646 lines)
    emitter.ts           # AST → TypeScript code generation
    cache.ts             # Content-hash-based .kapy-cache/
    index.ts             # Exports
  runtime/                # Runtime library (176 lines)
    index.ts             # Result, llm, embed, print, KapyRuntime
    package.json         # Package metadata
test/                    # Test suite
  lexer.test.ts          # 14 tests
  parser.test.ts         # 14 tests
  typechecker.test.ts    # 23 tests
  transpiler.test.ts     # ~20 tests
  cli.test.ts            # 6 tests
  error-paths.test.ts    # Error handling tests
  expression.test.ts     # Expression evaluation tests
examples/                # Example .kapy programs
  greet.kapy, result.kapy, divide.kapy, agent.kapy, hello.kapy
```

## Phases
| Phase | Status | Description |
|-------|--------|-------------|
| 1: Lexer & Parser | ✅ Complete | Grammar, tokenizer, AST, error recovery |
| 2: Type Checker | ✅ Complete | Inference, ADTs, pattern matching, Result ?/! |
| 3: Transpiler & Runtime | ✅ Complete | .kapy → .ts, source maps, .kapy-cache/, @kapy/runtime |
| 4: CLI & REPL | ✅ Complete | run, check, repl, --version, --help |
| 5: Stdlib v0.1 | ❌ Not started | http, fs, json, ai/providers, test |
| 6: Polish | ❌ Not started | Error messages, kapy fmt, kapy lint, docs |
| 7: v0.1 Release | ❌ Not started | npm package, GitHub, playground |

## First Real Execution
```bash
$ kapy run examples/hello.kapy
Hello, kapy-script!
```

## Test Health
- **94+ passing across 6 test files**
- Lexer: 14 tests
- Parser: 14 tests
- Type checker: 23 tests
- Transpiler: ~20 tests
- CLI: 6 tests
- Error paths + expression evaluation tests

## Pipeline
```
.kapy source
  → Lexer.tokenize() → Token[]
  → Parser.parse() → Program (AST)
  → TypeChecker.check() → TypeCheckError[]
  → Emitter.emit() → { code, sourceMap }
  → Cache.set() → .kapy-cache/
  → Bun.run(tsPath) → Execution
```