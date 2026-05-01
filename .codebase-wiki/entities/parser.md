# parser

> **Summary**: Recursive descent parser for kapy-script. 1,290 lines. All v0.1 syntax parses correctly including agent, trait, impl, parallel, with, and match. Former infinite-loop bugs fixed: synchronize() now advances past error tokens and DEDENTs, DEDENT loops have isAtEnd() guards, stepStatement() handles return, declaration() skips stray DEDENTs. Error recovery works for unclosed parens, invalid keywords, and missing block bodies.

## Location

- **Type**: module

## Responsibilities
- (to be documented)

## Dependencies
- (to be discovered)

## Dependents
- (to be discovered)

## Key Files
- `src/parser/ast.ts`
- `src/parser/parser.ts`
- `src/parser/errors.ts`

## Design Decisions
- (to be documented)

## Evolution
- **2026-05-01** — Initial creation

## See Also
- [[index]]
