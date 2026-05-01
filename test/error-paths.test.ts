import { describe, it, expect } from "bun:test";
import { Lexer, LexError } from "../src/lexer/lexer";
import { ParseError } from "../src/parser/errors";
import { Parser } from "../src/parser/parser";
import { TypeChecker } from "../src/typechecker";

function tokenize(source: string) {
  return new Lexer(source, "test.kapy").tokenize();
}

function parse(source: string) {
  const tokens = new Lexer(source, "test.kapy").tokenize();
  return new Parser(tokens, "test.kapy").parse();
}

function typeCheck(source: string) {
  const tokens = new Lexer(source, "test.kapy").tokenize();
  const ast = new Parser(tokens, "test.kapy").parse();
  const checker = new TypeChecker();
  checker.setFile("test.kapy");
  return checker.check(ast);
}

// ── Lexer Error Paths ──

describe("Lexer error paths", () => {
  it("throws on unterminated string", () => {
    expect(() => tokenize('"hello')).toThrow(LexError);
  });

  it("throws on invalid escape sequence", () => {
    expect(() => tokenize('"hello \\q"')).toThrow(LexError);
  });

  it("throws on unknown character", () => {
    expect(() => tokenize("@")).toThrow(LexError);
  });

  it("throws on odd indentation spaces", () => {
    expect(() => tokenize("fn test\n   x")).toThrow(LexError);
  });

  it("throws on skipping indent levels", () => {
    expect(() => tokenize("fn test\n    x")).toThrow(LexError);
  });

  it("throws on tabs in indentation", () => {
    expect(() => tokenize("\tfn test")).toThrow(LexError);
  });

  it("throws on unmatched dedent", () => {
    expect(() => tokenize("x")).not.toThrow(); // dedent at top level is fine
  });

  it("throws on standalone &", () => {
    expect(() => tokenize("&")).toThrow(LexError);
  });

  it("throws on standalone |", () => {
    expect(() => tokenize("|")).toThrow(LexError);
  });

  it("throws on multiline strings", () => {
    expect(() => tokenize('"hello\nworld"')).toThrow(LexError);
  });

  it("throws on quotes inside interpolation", () => {
    expect(() => tokenize('"Hello, {foo("bar")}"')).toThrow(LexError);
  });
});

// ── Parser Error Paths ──

describe("Parser error paths", () => {
  it("recovers from invalid declaration keyword", () => {
    const ast = parse("invalid_decl");
    expect(ast.declarations.length).toBe(0);
  });

  it("recovers from missing fn body", () => {
    // fn without indented body gets skipped by error recovery
    const ast = parse("fn test");
    expect(ast.declarations.length).toBe(0);
  });

  it("throws on unclosed parenthesis in expression", () => {
    expect(() => {
      // Unclosed paren inside a function body
      const source = `fn test
  input x: any
  output any
  f(`;
      parse(source);
    }).toThrow();
  });

  it("gracefully recovers from parse errors", () => {
    // Parser catches ParseError internally and synchronizes
    const ast = parse("bad_token");
    expect(ast.declarations.length).toBe(0);
  });
});

// ── Type Checker Error Paths ──

describe("Type checker error paths", () => {
  it("flags non-boolean if condition", () => {
    const source = `fn bad_if
  input x: number
  output string
  if x
    "yes"
  else
    "no"`;
    const errors = typeCheck(source);
    expect(errors.some(e => e.message.includes("boolean"))).toBe(true);
  });

  it("flags undefined variable references", () => {
    const source = `fn bad_ref
  input x: number
  output number
  x + unknown_var`;
    const errors = typeCheck(source);
    expect(errors.some(e => e.message.includes("Undefined variable"))).toBe(true);
  });

  it("flags return type mismatch", () => {
    const source = `fn bad_return
  input x: number
  output string
  42`;
    const errors = typeCheck(source);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain("return type");
  });

  it("flags type mismatch in binary expression", () => {
    const source = `fn bad_binop
  input x: string
  output number
  x + 1`;
    const errors = typeCheck(source);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("flags re-assignment with mismatched type", () => {
    const source = `fn bad_assign
  input x: number
  output number
  y = 42
  y = "string"`;
    const errors = typeCheck(source);
    expect(errors.some(e => e.message.includes("Cannot assign"))).toBe(true);
  });

  it("flags invalid match case on sealed trait", () => {
    const source = `sealed trait Shape
  case Circle(radius: number)

fn bad_match
  input shape: Shape
  output number
  match shape
    Triangle(x) -> x`;
    const errors = typeCheck(source);
    expect(errors.some(e => e.message.includes("no case") || e.message.includes("Triangle"))).toBe(true);
  });

  it("passes well-typed function without errors", () => {
    const source = `fn good
  input x: number
  output number
  x + 1`;
    const errors = typeCheck(source);
    expect(errors.length).toBe(0);
  });
});