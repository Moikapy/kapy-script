# Kapy-Script Codebase Wiki

## Overview
**kapy-script** is a programming language designed for AI agent authorship. Transpiles to TypeScript and runs on Bun with a Python-style execution model.

**Current phase:** v0.1 — **Lexer, Parser, and Type Checker complete.** Transpiler and runtime are next.

## Key Pages

### Language & Design
- [[kapy-script]] — Language concept, syntax, and design philosophy
- [[adr-001-hand-written-recursive-descent-parser]] — Why hand-written parser
- [[adr-002-indentation-based-syntax-with-indent-dedent-tokens]] — Why indentation-based syntax
- [[adr-003-transpile-to-typescript--execute-via-bun]] — Why TS transpilation + Bun

### Modules
| Module | Phase | Lines | Status | Description |
|--------|-------|-------|--------|-------------|
| [[lexer]] | 1 | 570 | ✅ Complete | Tokenizer — INDENT/DEDENT, string interpolation |
| [[parser]] | 1 | 1,769 | ✅ Complete | Recursive descent parser — typed AST for all v0.1 syntax |
| [[type-checker]] | 2 | 841 | ✅ Complete | Two-pass type inference, ADT support, Result ?/! operators |
| [[cli]] | 1-2 | 172 | ✅ Partial | `kapy run/check` pipelines through lex → parse → type-check |

### Design Documents
- `design-spec.md` — Full language specification
- `implementation-plan.md` — Phase-by-phase implementation roadmap

## Source Tree
```
src/
  cli/main.ts          # CLI entry point (172 lines)
  lexer/               # Tokenizer (570 lines)
    token.ts            # Token types & spans
    lexer.ts            # Indentation-aware lexer
    index.ts            # Exports
  parser/               # AST parser (1,769 lines)
    ast.ts              # AST node types
    parser.ts           # Recursive descent parser
    errors.ts           # Parse error types
    index.ts            # Exports
  typechecker/           # Type checker (841 lines)
    checker.ts          # TypeChecker + TypeEnv + typesCompatible
    errors.ts           # TypeCheckError with source context
    index.ts            # Exports
test/                   # Test suite
  lexer.test.ts         # 14 tests
  parser.test.ts        # 14 tests
  cli.test.ts           # 6 tests
  typechecker.test.ts   # 23 tests
examples/               # Example .kapy programs
  greet.kapy, result.kapy, divide.kapy, agent.kapy
```

## Phases
| Phase | Status | Description |
|-------|--------|-------------|
| 1: Lexer & Parser | ✅ Complete | Grammar, tokenizer, AST, error recovery |
| 2: Type Checker | ✅ Complete | Inference, ADTs, pattern matching, Result ?/! |
| 3: Transpiler | ❌ Not started | .kapy → .ts, source maps, .kapy-cache/ |
| 4: CLI & Runtime | ❌ Not started | REPL, kapy init, kapy test, mocking |
| 5: Stdlib v0.1 | ❌ Not started | http, fs, json, ai/providers, test |
| 6: Polish | ❌ Not started | Error messages, kapy fmt, kapy lint, docs |
| 7: v0.1 Release | ❌ Not started | npm package, GitHub, playground |

## Test Health
- **56 pass, 0 fail, 147 assertions**
- Lexer: 14 tests
- Parser: 14 tests
- Type checker: 23 tests (compatibility, inference, error detection, ADTs, pattern matching)
- CLI: 6 tests (4 parse checks, 3 type-checks on examples)