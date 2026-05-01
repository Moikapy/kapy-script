// Kapy-script Token Types
// Phase 1: All tokens needed for v0.1 syntax

/** Source location span for error reporting */
export interface TokenSpan {
  readonly line: number;
  readonly column: number;
  readonly offset: number;
  readonly length: number;
  readonly file: string;
}

/** Token types for the kapy-script lexer */
export enum TokenType {
  // Literals
  NUMBER,
  STRING,
  BOOLEAN,

  // Identifiers & Keywords
  IDENTIFIER,
  // Keywords
  FN,
  AGENT,
  TOOL,
  TRAIT,
  SEALED,
  IMPL,
  MATCH,
  IF,
  ELSE,
  FOR,
  WHILE,
  IN,
  INPUT,
  OUTPUT,
  STEPS,
  RETURN,
  IMPORT,
  FROM,
  CASE,
  PARALLEL,
  WITH,
  TIMEOUT,
  TEST,
  THINK,
  PERMISSIONS,
  BUDGET,
  RATE_LIMIT,
  TOOLS,
  TRUE,
  FALSE,

  // Operators
  ASSIGN,       // =
  MUTABLE,      // :=
  ARROW,        // ->
  PIPE,         // |>
  QUESTION,     // ?
  BANG,         // !
  DOT,          // .
  COLON,        // :
  DOUBLE_COLON, // ::
  PLUS,         // +
  MINUS,        // -
  STAR,         // *
  SLASH,        // /
  PERCENT,      // %
  EQ,           // ==
  NEQ,          // !=
  LT,           // <
  GT,           // >
  LTE,          // <=
  GTE,          // >=
  AND,          // &&
  OR,           // ||

  // Delimiters
  LPAREN,       // (
  RPAREN,       // )
  LBRACKET,     // [
  RBRACKET,     // ]
  LBRACE,       // {
  RBRACE,       // }
  COMMA,        // ,

  // Structural
  NEWLINE,
  INDENT,
  DEDENT,
  EOF,
}

/** A lexical token with source location */
export class Token {
  constructor(
    public readonly type: TokenType,
    public readonly lexeme: string,
    public readonly literal: unknown,
    public readonly span: TokenSpan,
  ) {}

  toString(): string {
    if (this.type === TokenType.NEWLINE) return "NEWLINE";
    if (this.type === TokenType.INDENT) return "INDENT";
    if (this.type === TokenType.DEDENT) return "DEDENT";
    if (this.type === TokenType.EOF) return "EOF";
    return `${TokenType[this.type]}('${this.lexeme}'${this.literal !== null ? ` = ${JSON.stringify(this.literal)}` : ""})`;
  }
}

/** Keyword map: keyword text → TokenType */
export const KEYWORDS: ReadonlyMap<string, TokenType> = new Map([
  ["fn", TokenType.FN],
  ["agent", TokenType.AGENT],
  ["tool", TokenType.TOOL],
  ["trait", TokenType.TRAIT],
  ["sealed", TokenType.SEALED],
  ["impl", TokenType.IMPL],
  ["match", TokenType.MATCH],
  ["if", TokenType.IF],
  ["else", TokenType.ELSE],
  ["for", TokenType.FOR],
  ["while", TokenType.WHILE],
  ["in", TokenType.IN],
  ["input", TokenType.INPUT],
  ["output", TokenType.OUTPUT],
  ["steps", TokenType.STEPS],
  ["return", TokenType.RETURN],
  ["import", TokenType.IMPORT],
  ["from", TokenType.FROM],
  ["case", TokenType.CASE],
  ["parallel", TokenType.PARALLEL],
  ["with", TokenType.WITH],
  ["timeout", TokenType.TIMEOUT],
  ["test", TokenType.TEST],
  ["think", TokenType.THINK],
  ["permissions", TokenType.PERMISSIONS],
  ["budget", TokenType.BUDGET],
  ["tools", TokenType.TOOLS],
  ["rate_limit", TokenType.RATE_LIMIT],
  ["true", TokenType.TRUE],
  ["false", TokenType.FALSE],
]);