# parser

> **Summary**: Recursive descent parser producing typed AST nodes from the lexer's token stream. 1,769 lines. Supports all v0.1 syntax: fn, agent, tool, trait, sealed, impl, match, if/else, for/while, input/output, steps, pipeline, arrow assignment.

## Location
- `src/parser/ast.ts` (468 lines) — All AST node type definitions
- `src/parser/parser.ts` (1,270 lines) — The Parser class (recursive descent)
- `src/parser/errors.ts` (31 lines) — `ParseError` and `formatParseError`
- `src/parser/index.ts` — Re-exports

## Key Design Decisions
- **Hand-written recursive descent** — not PEG, not combinator. See [[adr-001-hand-written-recursive-descent-parser]]
- **Source location on every node** — every AST node carries span for error reporting
- **Error recovery** — parser continues after errors to report multiple issues per file
- **AST as source-of-truth** — typed AST nodes feed both type checker and transpiler

## Phase 2 Parser Fixes
- **Multi-input parsing** — `fnDecl` now loops to parse multiple `input` lines (was single-input only)
- **Array type postfix** — `parseType` handles `T[]` postfix on any type expression
- **Safety guards** — iteration limits, depth counter, step counter prevent infinite loops on malformed input

## Major AST Node Types
- **Declarations**: `FnDecl`, `AgentDecl`, `ToolDecl`, `TraitDecl`, `SealedTraitDecl`, `ImplDecl`
- **Expressions**: `BinaryExpr`, `CallExpr`, `MatchExpr`, `PipelineExpr`, `MemberExpr`, `UnaryExpr`, `CrashUnwrapExpr`, `ResultUnwrapExpr`, `InterpolatedString`, `LambdaExpr`, `ParallelExpr`, `WithExpr`
- **Statements**: `AssignmentStmt`, `ExpressionStmt`, `ReturnStmt`, `IfStmt`, `ForStmt`, `WhileStmt`, `StepStmt`
- **Types**: `PrimitiveType`, `NamedType`, `ArrayType`, `RecordType`, `FunctionType`, `GenericType`, `UnionType`, `NullableType`
- **Literals**: `NumberLiteral`, `StringLiteral`, `BooleanLiteral`, `ArrayLiteral`, `RecordLiteral`
- **Patterns**: `CaseVariant`, `DestructurePattern`, `IdentifierPattern`, `LiteralPattern`, `TuplePattern`, `WildcardPattern`

## Exports
- All AST node classes (`FnDecl`, `AgentDecl`, `CallExpr`, etc.)
- `Parser` class with `parse()` method
- `ParseError`, `formatParseError`

## Dependencies
- [[lexer]] — Consumes `Token[]` stream from `Lexer.tokenize()`

## Dependents
- [[cli]] — Calls `Parser.parse()` in the pipeline
- [[type-checker]] — Consumes the Program AST (Phase 2)
- Transpiler — Will receive type-annotated AST (Phase 3)

## See Also
- [[kapy-script]] — Language overview
- [[lexer]] — Tokenizer that feeds this parser
- [[type-checker]] — Types the output of this parser
- [[adr-001-hand-written-recursive-descent-parser]] — Architecture decision