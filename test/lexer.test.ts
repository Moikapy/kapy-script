import { describe, it, expect } from "bun:test";
import { Lexer, LexError } from "../src/lexer/lexer";
import { Token, TokenType } from "../src/lexer/token";

function tokenize(source: string): Token[] {
  return new Lexer(source, "test.kapy").tokenize();
}

// ── Lexer Tests ──

describe("Lexer", () => {
  it("tokenizes simple identifiers", () => {
    const tokens = tokenize("hello world");
    // NEWLINE is implicit at end
    const names = tokens.filter(t => t.type === TokenType.IDENTIFIER).map(t => t.lexeme);
    expect(names).toEqual(["hello", "world"]);
  });

  it("recognizes all keywords", () => {
    const keywords = [
      "fn", "agent", "tool", "trait", "sealed", "impl",
      "match", "if", "else", "for", "while", "in",
      "input", "output", "steps", "return", "import", "from",
      "case", "parallel", "with", "timeout", "test", "think",
      "permissions", "budget", "rate_limit",
    ];
    for (const kw of keywords) {
      const tokens = tokenize(kw);
      const kwToken = tokens.find(t => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF && t.type !== TokenType.INDENT && t.type !== TokenType.DEDENT);
      expect(kwToken).toBeDefined();
      expect(kwToken!.lexeme).toBe(kw);
    }
  });

  it("tokenizes numbers", () => {
    const tokens = tokenize("42 3.14 0.5");
    const nums = tokens.filter(t => t.type === TokenType.NUMBER);
    expect(nums.map(t => t.literal)).toEqual([42, 3.14, 0.5]);
  });

  it("tokenizes strings", () => {
    const tokens = tokenize('"hello world"');
    const str = tokens.find(t => t.type === TokenType.STRING);
    expect(str).toBeDefined();
    expect(str!.literal).toBe("hello world");
  });

  it("tokenizes string interpolation", () => {
    const tokens = tokenize('"Hello, {name}!"');
    const str = tokens.find(t => t.type === TokenType.STRING);
    expect(str).toBeDefined();
    expect(Array.isArray(str!.literal)).toBe(true);
  });

  it("tokenizes boolean literals", () => {
    const tokens = tokenize("true false");
    const bools = tokens.filter(t => t.type === TokenType.BOOLEAN || t.type === TokenType.TRUE || t.type === TokenType.FALSE);
    expect(bools.length).toBeGreaterThanOrEqual(2);
  });

  it("handles indentation", () => {
    const source = `fn greet
  input name: string
  "Hello, {name}!"`;
    const tokens = tokenize(source);
    expect(tokens.some(t => t.type === TokenType.INDENT)).toBe(true);
  });

  it("handles nested indentation", () => {
    const source = `fn outer
  fn inner
    "deep"`;
    const tokens = tokenize(source);
    const indents = tokens.filter(t => t.type === TokenType.INDENT);
    expect(indents.length).toBeGreaterThanOrEqual(2);
  });

  it("handles dedent", () => {
    const source = `fn outer
  "inner"
"back"`;
    const tokens = tokenize(source);
    expect(tokens.some(t => t.type === TokenType.DEDENT)).toBe(true);
  });

  it("rejects tabs", () => {
    expect(() => tokenize("\thello")).toThrow(LexError);
  });

  it("handles comments", () => {
    const source = `x = 1 # this is a comment\ny = 2`;
    const tokens = tokenize(source);
    // Comments should be skipped
    expect(tokens.some(t => t.lexeme.includes("comment"))).toBe(false);
  });

  it("tokenizes two-character operators", () => {
    const tokens = tokenize(":= -> |> == != <= >= && ||");
    const opTypes = tokens.filter(t => ![TokenType.NEWLINE, TokenType.EOF, TokenType.INDENT, TokenType.DEDENT].includes(t.type)).map(t => t.type);
    expect(opTypes).toContain(TokenType.MUTABLE);    // :=
    expect(opTypes).toContain(TokenType.ARROW);      // ->
    expect(opTypes).toContain(TokenType.PIPE);        // |>
    expect(opTypes).toContain(TokenType.EQ);          // ==
    expect(opTypes).toContain(TokenType.NEQ);         // !=
    expect(opTypes).toContain(TokenType.LTE);          // <=
    expect(opTypes).toContain(TokenType.GTE);          // >=
    expect(opTypes).toContain(TokenType.AND);          // &&
    expect(opTypes).toContain(TokenType.OR);            // ||
  });

  it("tracks line and column", () => {
    const tokens = tokenize("abc\ndef");
    const abc = tokens.find(t => t.lexeme === "abc");
    const def = tokens.find(t => t.lexeme === "def");
    expect(abc!.span.line).toBe(1);
    expect(def!.span.line).toBe(2);
  });

  it("rejects quotes inside interpolation", () => {
    expect(() => tokenize('"Hello, {foo("bar")}"')).toThrow(LexError);
  });
});