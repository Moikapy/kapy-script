# lexer

> **Summary**: Tokenizer for .kapy source files. 570 lines across 3 files. Handles indentation-based blocks (INDENT/DEDENT tokens), string interpolation with `{expr}`, line comments (`#`), and all v0.1 operators/keywords.

## Location
- `src/lexer/token.ts` (143 lines) — Token types, `TokenSpan` interface, KEYWORDS map
- `src/lexer/lexer.ts` (427 lines) — The `Lexer` class with indentation tracking
- `src/lexer/index.ts` — Re-exports

## Key Design Decisions
- **INDENT/DEDENT tokens** — Handled at lex time, similar to Python. See [[adr-002-indentation-based-syntax-with-indent-dedent-tokens]]
- **Tabs rejected** at lex time — forces 2-space indentation only
- **One indent level at a time** — jumping from 0 to 4 spaces is an error
- **String interpolation** — `"Hello, {name}!"` parsed at lex time into parts array with `text` and `expr` segments
- **Error recovery** — `LexError` carries file, line, column for all errors

## Exports
- `Token` — Token class with type, lexeme, literal, span
- `TokenType` — Enum of all token types (~60 types)
- `TokenSpan` — Source location interface (line, column, offset, length, file)
- `KEYWORDS` — Map of keyword strings → TokenType
- `LexError` — Error class with file/line/column
- `Lexer` — Main tokenizer class

## Token Types
**Literals**: NUMBER, STRING, BOOLEAN
**Keywords**: FN, AGENT, TOOL, TRAIT, SEALED, IMPL, MATCH, IF, ELSE, FOR, WHILE, IN, INPUT, OUTPUT, STEPS, RETURN, IMPORT, FROM, AS, THINK, TOOLS, PARALLEL, WITH, STEPS, THEN, STEPS
**Operators**: ASSIGN (=), MUTABLE (:=), EQ (==), NEQ (!=), LT, GT, LTE, GTE, PLUS, MINUS, STAR, SLASH, PERCENT, ARROW (->), PIPE (|>), BANG (!), QUESTION (?), DOT, COMMA, DOUBLE_COLON (::), COLON
**Control**: INDENT, DEDENT, NEWLINE, LPAREN, RPAREN, LBRACKET, RBRACKET, LBRACE, RBRACE, AND (&&), OR (||), EOF

## Dependencies
- (none — self-contained)

## Dependents
- [[parser]] — Consumes token stream
- [[cli]] — Calls `Lexer.tokenize()` in the pipeline
- [[type-checker]] — Indirect (via parser AST)

## See Also
- [[kapy-script]] — Language overview
- [[parser]] — Consumes lexer output
- [[type-checker]] — Types the output of the pipeline
- [[adr-002-indentation-based-syntax-with-indent-dedent-tokens]] — Indentation syntax decision