# parser

> **Summary**: parser module, with 4 source files, entry point at `src/parser/index.ts`, exports 20 symbols.

## Location
- **Files**: 4 source files

## Responsibilities
- span
- span of
- ident
- parser class
- format parse error
- parse error class

## Dependencies
- [[lexer]] — `../lexer/token`
- `./ast`
- `./errors`
- [[parser]] — `./parser`

## Dependents
- [[src-cli]]
- [[src-parser]]
- [[test]]

## Exports
- `AgentDecl`
- `ArrayLiteral`
- `ArrayType`
- `AssignmentStmt`
- `BinaryExpr`
- `Block`
- `BooleanLiteral`
- `CallExpr`
- `CaseVariant`
- `CrashUnwrapExpr`
- `Declaration`
- `DestructurePattern`
- `Expression`
- `ExpressionStmt`
- `FnDecl`
- ... and 5 more

## Key Files
- `src/parser/index.ts` — Module entry point

## Design Decisions
- (to be documented through ADRs)

## Evolution
- **2026-05-01** — Initial enrichment from source analysis

---
*Last updated: 2026-05-01*