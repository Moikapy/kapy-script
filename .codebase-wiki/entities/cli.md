# cli

> **Summary**: Command-line interface for kapy-script. 285 lines at `src/cli/main.ts`. Orchestrates the full compile-and-execute pipeline: lex → parse → type-check → emit → cache → bun run.

## Location
- `src/cli/main.ts` (285 lines) — CLI entry point and pipeline orchestrator

## Commands
| Command | Status | Pipeline |
|---------|--------|----------|
| `kapy run <file>` | ✅ Phase 3 | Lex → Parse → TypeCheck → Emit → Cache → Execute |
| `kapy check <file>` | ✅ Phase 2 | Lex → Parse → TypeCheck |
| `kapy repl` | Partial | Parse + echo AST + type check |
| `kapy --version` | ✅ | v0.1.0 |
| `kapy --help` | ✅ | Full usage info |

## Pipeline (Phase 3)
```
.kapy source
  → new Lexer().tokenize() → Token[]
  → new Parser().parse() → Program (AST)
  → new TypeChecker().check() → TypeCheckError[]
  → new Emitter().emit() → { code, sourceMap }
  → cache.set(absolutePath, source, code) → .kapy-cache/
  → Bun.spawnSync(["bun", "run", tsPath]) → Execution
```

Error handling at every phase: lex/parse/type errors surface with file:line:column and source context.

## Cache Strategy
- Reads `.kapy-cache/` adjacent to source file
- SHA256 content hash as cache key
- mtime check: if source is newer than cache, recompile
- Cached `.ts` executed directly via `bun run`

## REPL
- `:` commands: `:help`, `:quit`, `:type` (experimental)
- Multi-line input for block definitions (`. ` prompt)
- Parse + type-check on every evaluation
- `tryEval()` shows defined names and type error counts

## Dependencies
- [[lexer]] — Tokenizes source
- [[parser]] — Parses tokens into AST
- [[type-checker]] — Checks AST types (Phase 2)
- [[transpiler]] — Emits TypeScript from annotated AST (Phase 3)

## See Also
- [[kapy-script]] — Language overview
- [[transpiler]] — Emits code the CLI caches and runs
- [[runtime]] — Runtime library used by emitted code