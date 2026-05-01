# kapy-script

> **Summary**: A programming language designed for AI agent authorship. Transpiles to TypeScript, runs on Bun. Key differentiators: token-efficient syntax (~25-35% fewer tokens than TS), contract-first functions (input/output), built-in AI primitives (llm, embed, tool), algebraic data types, pattern matching, and Result-based error handling with ? operator.

## Applies To
- [[lexer]]
- [[parser]]
- [[type-checker]]
- [[cli]]

## Implementation State
- **Lexer**: ✅ Phase 1 Complete (427 lines)
- **Parser**: ✅ Phase 1 Complete (1,270 lines)
- **Type Checker**: ✅ Phase 2 Complete (770 lines — local inference, ADTs, patterns, Result operators)
- **Transpiler**: ❌ Phase 3 (not started)
- **Runtime**: ❌ Phase 3 (not started)
- **CLI**: ✅ Partial — `kapy run/check` active, `repl`, `test` planned
- **Stdlib**: ❌ Phase 5 (not started)
- **Test suite**: ✅ 56 pass, 0 fail, 147 assertions

## Core Syntax Features
- Indentation-based blocks (no braces)
- Contract-first functions (fn + input/output)
- ADTs: sealed trait + case
- Pattern matching with match
- Pipeline operator |>
- Arrow assignment ->
- ? operator for error propagation (Result unwrapping)
- ! operator for crash-on-error
- = for immutable, := for mutable
- Built-in llm(), embed(), tool keywords
- agent keyword for structured AI agents
- parallel blocks for concurrent execution

## Type System (v0.1)
- Local type inference from RHS expressions
- Primitive types: `string`, `number`, `boolean`, `any`, `void`
- Array types: `T[]`
- Generic types: `Result[T, E]`, `List[T]`, `Map[K, V]`, `Option[T]`
- Record types: `{ key: T }`
- Function types: `(T1, T2) => T`
- ADT types: `sealed trait` with case constructors
- Union and nullable types declared in AST (not yet enforced)

## See Also
- [[lexer]] — Tokenizer implementation (Phase 1)
- [[parser]] — AST parser implementation (Phase 1)
- [[type-checker]] — Type system (Phase 2)
- [[cli]] — Command-line interface (Phase 1-2)
- [[adr-001-hand-written-recursive-descent-parser]] — Parser architecture decision
- [[adr-002-indentation-based-syntax-with-indent-dedent-tokens]] — Indentation syntax decision
- [[adr-003-transpile-to-typescript--execute-via-bun]] — Runtime strategy decision
- [[adr-004-two-pass-type-checker--register-then-check-]] — Type checker phase architecture
- [[adr-005-structural-type-compatibility-with-any-coercion]] — Type system design