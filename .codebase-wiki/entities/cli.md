# cli

> **Summary**: Command-line interface for kapy-script. 172 lines at `src/cli/main.ts`. Orchestrates the compile pipeline: lex → parse → type-check → (eventually) transpile → execute.

## Location
- `src/cli/main.ts` (172 lines) — CLI entry point and pipeline orchestrator

## Commands
| Command | Status | Pipeline |
|---------|--------|----------|
| `kapy run <file>` | ✅ Phase 2 | Lex → Parse → TypeCheck → Execute |
| `kapy repl` | Partial | Parse + echo AST |
| `kapy check <file>` | ✅ Phase 2 | Lex → Parse → TypeCheck (no execute) |
| `kapy test` | Planned | Phase 4 |
| `kapy init` | Planned | Phase 4 |
| `kapy build` | Planned | Phase 3+ |

## Pipeline (Phase 2)
```
.kapy source
  → Lexer.tokenize() → Token[]
  → Parser.parse() → Program (AST)
  → TypeChecker.check() → TypeCheckError[]
  → Execute (or `kapy check` reports errors only)
```

All three phases pipe errors back to source line:column with source context.

## Dependencies
- [[lexer]] — Tokenizes source
- [[parser]] — Parses tokens into AST
- [[type-checker]] — Checks AST types (Phase 2)

## See Also
- [[kapy-script]] — Language overview
- [[type-checker]] — Phase 2 addition