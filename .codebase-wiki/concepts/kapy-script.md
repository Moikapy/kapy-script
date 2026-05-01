# kapy-script

> **Summary**: A programming language designed for AI agent authorship. Transpiles to TypeScript, runs on Bun. Key differentiators: token-efficient syntax (~25-35% fewer tokens than TS), contract-first functions (input/output), built-in AI primitives (llm, embed, tool), algebraic data types, pattern matching, and Result-based error handling with ? operator.

## Applies To
- [[lexer]]
- [[parser]]
- [[cli]]

## Description
Phase: v0.1 (lexer + parser complete, transpiler & runtime pending)

Core syntax features:
- Indentation-based blocks (no braces)
- Contract-first functions (fn + input/output)
- ADTs: sealed trait + case
- Pattern matching with match
- Pipeline operator |>
- Arrow assignment ->
- ? operator for error propagation
- = for immutable, := for mutable
- Built-in llm(), embed(), tool keywords
- agent keyword for structured AI agents

Implementation state:
- Lexer: ✅ Complete (427 lines)
- Parser: ✅ Complete (1270 lines)
- Type Checker: ❌ Not started (Phase 2)
- Transpiler: ❌ Not started (Phase 3)
- Runtime: ❌ Not started (Phase 3)
- CLI: ✅ Partial (172 lines)
- Stdlib: ❌ Not started (Phase 5)

## Key Characteristics
- (to be discovered)

## See Also
- [[index]]

---
*Created: 2026-05-01*