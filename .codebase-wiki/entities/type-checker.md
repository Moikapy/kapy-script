# type-checker

> **Summary**: Full v0.1 type checker for kapy-script. 841 lines across 3 files. Local type inference, scoped environment, structural type compatibility, ADT pattern matching, Result ?/! operators, and all v0.1 expression/statement checking.

## Location
- `src/typechecker/checker.ts` (770 lines) — `TypeChecker` class + `TypeEnv` + `typesCompatible()`
- `src/typechecker/errors.ts` (40 lines) — `TypeCheckError` with source-context formatting
- `src/typechecker/index.ts` (31 lines) — Barrel file

## Key Features
- **Two-pass checking** — First pass registers all top-level declarations (fn signatures, sealed traits), second pass checks bodies. Required because functions may reference later declarations.
- **TypeEnv with parent chain** — Lexically scoped environment. `child()` creates nested scopes. Enables block-level, function-level, and global scoping.
- **Structural type compatibility** — `typesCompatible(a, b)` uses structural equality. `any` coerces to everything. Array and generic types recursed into.
- **ADT support** — `sealed trait` case constructors registered as functions in the environment. Pattern matching destructures fields into scope.
- **Result ?/! operators** — `?` unwraps `Result[T, E]` to `T`, `!` crashes (same type rule).
- **Builtin functions**: `print`, `llm`, `embed`, `Ok`, `Err`, `ok`, `err`, `Result[T, E]`
- **Error messages** — Every error carries file:line:column + message. `formatTypeError` renders source line with caret.

## Checker Pipeline
```
TypeChecker
  ├── check(program) — entry point, two-pass
  ├── registerDeclaration(decl) — first pass: register fn/agent/tool/tool signatures
  ├── checkDeclaration(decl) — second pass: type-check function bodies
  ├── checkFnDecl() — body checking with params in child scope
  ├── checkSealedTrait() — register case constructors
  ├── checkExpression(expr) — all expression kinds (17 cases)
  ├── checkStatement(stmt) — all statement kinds
  ├── checkPattern(p, subjectType) — ADT destructuring, wildcard, identifier
  └── checkBlock(block) — check all statements, return last type
```

## Expression Types Supported
| Expression | Inference |
|-----------|-----------|
| Number / String / Boolean Literal | `number`, `string`, `boolean` |
| Identifier | Lookup in TypeEnv |
| InterpolatedString | `string` |
| ArrayLiteral | `any[]` if empty, else unify element types |
| RecordLiteral | `{ key: inferred }` |
| BinaryExpr | `number` (arithmetic), `boolean` (compare, logic) |
| UnaryExpr | `-` → `number`, `!` → `boolean` |
| CallExpr | Resolve callee function type, check arg compatibility |
| MemberExpr | `any` (v0.1 — field lookup not yet checked) |
| IndexExpr | Element type if array, else `any` |
| PipelineExpr | Last stage's type |
| MatchExpr | Unify all case body types |
| IfExpr | Then type if else present, `void` if not |
| ForExpr / WhileExpr | `void` |
| ParallelExpr | `void` (v0.1) |
| WithExpr | `void` (v0.1) |
| LambdaExpr | `FunctionType` of param types → body type |
| ResultUnwrapExpr | `T` from `Result[T, E]` |
| CrashUnwrapExpr | Same as unwrap |

## Error Types
- `Type mismatch` — assignment, return, args
- `Undefined variable` — not in any scope
- `Wrong arg count` — call doesn't match signature
- `Non-numeric operand` — `+`, `-`, etc. on non-numbers
- `Bad if/while condition` — not `boolean`
- `Unknown case` — ADT destructuring with wrong case name

## Dependencies
- [[parser]] — Consumes typed AST (all `ast.ts` node types)

## Dependents
- [[cli]] — `kapy check` pipelines through type-checker
- [[transpiler]] — Will receive type-annotated AST (Phase 3)

## See Also
- [[kapy-script]] — Language overview
- [[parser]] — Produces the AST this consumes
- [[lexer]] — Tokenizer upstream
- Implementation Plan Phase 2 — Type checker specification