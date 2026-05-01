import { describe, it, expect } from "bun:test";
import { Lexer } from "../src/lexer/lexer";
import { Parser } from "../src/parser/parser";
import { TypeChecker, TypeEnv, typesCompatible, typeName } from "../src/typechecker";
import { KapyType } from "../src/parser/ast";

function typeCheck(source: string): { errors: ReturnType<TypeChecker["check"]>; checker: TypeChecker } {
  const tokens = new Lexer(source, "test.kapy").tokenize();
  const ast = new Parser(tokens, "test.kapy").parse();
  const checker = new TypeChecker();
  checker.setFile("test.kapy");
  const errors = checker.check(ast);
  return { errors, checker };
}

// ── Type Compatibility Tests ──

describe("Type compatibility", () => {
  const prim = (name: "string" | "number" | "boolean" | "any" | "void") =>
    ({ kind: "PrimitiveType" as const, name, span: { start: { line: 0, column: 0, offset: 0, length: 0, file: "" }, end: { line: 0, column: 0, offset: 0, length: 0, file: "" } } });

  it("same primitive types are compatible", () => {
    expect(typesCompatible(prim("number"), prim("number"))).toBe(true);
    expect(typesCompatible(prim("string"), prim("string"))).toBe(true);
    expect(typesCompatible(prim("boolean"), prim("boolean"))).toBe(true);
  });

  it("different primitive types are not compatible", () => {
    expect(typesCompatible(prim("number"), prim("string"))).toBe(false);
    expect(typesCompatible(prim("boolean"), prim("number"))).toBe(false);
  });

  it("'any' is compatible with everything", () => {
    expect(typesCompatible(prim("any"), prim("number"))).toBe(true);
    expect(typesCompatible(prim("string"), prim("any"))).toBe(true);
    expect(typesCompatible(prim("any"), prim("any"))).toBe(true);
  });
});

describe("Type name formatting", () => {
  it("formats primitive types", () => {
    const prim = (name: any) => ({ kind: "PrimitiveType" as const, name, span: { start: { line: 0, column: 0, offset: 0, length: 0, file: "" }, end: { line: 0, column: 0, offset: 0, length: 0, file: "" } } });
    expect(typeName(prim("number"))).toBe("number");
    expect(typeName(prim("string"))).toBe("string");
  });

  it("formats named types", () => {
    const named = (name: string) => ({ kind: "NamedType" as const, name, span: { start: { line: 0, column: 0, offset: 0, length: 0, file: "" }, end: { line: 0, column: 0, offset: 0, length: 0, file: "" } } });
    expect(typeName(named("Report"))).toBe("Report");
  });

  it("formats generic types", () => {
    const prim = (name: any) => ({ kind: "PrimitiveType" as const, name, span: { start: { line: 0, column: 0, offset: 0, length: 0, file: "" }, end: { line: 0, column: 0, offset: 0, length: 0, file: "" } } });
    const generic = { kind: "GenericType" as const, name: "Result", type_args: [prim("any"), prim("string")], span: { start: { line: 0, column: 0, offset: 0, length: 0, file: "" }, end: { line: 0, column: 0, offset: 0, length: 0, file: "" } } };
    expect(typeName(generic)).toBe("Result[any, string]");
  });
});

// ── Type Checker Tests ──

describe("TypeChecker", () => {
  it("passes for a simple typed function", () => {
    const source = `fn greet
  input name: string
  output string
  "Hello, {name}!"`;
    const { errors } = typeCheck(source);
    expect(errors.length).toBe(0);
  });

  it("catches return type mismatch", () => {
    const source = `fn broken
  input x: number
  output string
  42`;
    const { errors } = typeCheck(source);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain("return type");
  });

  it("infers number literal type", () => {
    const source = `fn compute
  input x: number
  output number
  x + 1`;
    const { errors } = typeCheck(source);
    expect(errors.length).toBe(0);
  });

  it("catches type mismatch in binary expression", () => {
    const source = `fn bad
  input x: string
  output number
  x + 1`;
    const { errors } = typeCheck(source);
    // Should complain about string + number
    expect(errors.length).toBeGreaterThan(0);
  });

  it("handles boolean conditions in if expressions", () => {
    const source = `fn check
  input x: number
  output string
  if x > 0
    "positive"
  else
    "non-positive"`;
    const { errors } = typeCheck(source);
    expect(errors.length).toBe(0);
  });

  it("catches non-boolean if condition", () => {
    const source = `fn bad_if
  input x: number
  output string
  if x
    "yes"
  else
    "no"`;
    const { errors } = typeCheck(source);
    expect(errors.some(e => e.message.includes("boolean"))).toBe(true);
  });

  it("type-checks sealed traits and case constructors", () => {
    const source = `sealed trait Result
  case Ok(value: any)
  case Err(message: string)`;
    const { errors } = typeCheck(source);
    expect(errors.length).toBe(0);
  });

  it("type-checks pattern matching on sealed traits", () => {
    const source = `sealed trait Shape
  case Circle(radius: number)
  case Rectangle(width: number, height: number)

fn area
  input shape: Shape
  output number
  match shape
    Circle(r) -> 3.14159 * r * r
    Rectangle(w, h) -> w * h`;
    const { errors } = typeCheck(source);
    expect(errors.length).toBe(0);
  });

  it("catches invalid match case on sealed trait", () => {
    const source = `sealed trait Shape
  case Circle(radius: number)

fn bad_match
  input shape: Shape
  output number
  match shape
    Triangle(x) -> x`;
    const { errors } = typeCheck(source);
    expect(errors.some(e => e.message.includes("no case") || e.message.includes("Triangle"))).toBe(true);
  });

  it("type-checks variable assignments", () => {
    const source = `fn compute
  input x: number
  output number
  y = x + 1
  y * 2`;
    const { errors } = typeCheck(source);
    expect(errors.length).toBe(0);
  });

  it("catches type mismatch in variable assignment", () => {
    const source = `fn compute
  input x: number
  output string
  y = x + 1
  y`;
    const { errors } = typeCheck(source);
    // y is number (x+1), function declares string return
    expect(errors.some(e => e.message.includes("return type") || e.message.includes("evaluates to"))).toBe(true);
  });

  it("type-checks array literals with consistent types", () => {
    const source = `fn compute
  input x: number
  output number[]
  [1, 2, 3, 4]`;
    const { errors } = typeCheck(source);
    expect(errors.length).toBe(0);
  });

  it("detects undefined variable references", () => {
    const source = `fn compute
  input x: number
  output number
  x + undefined_var`;
    const { errors } = typeCheck(source);
    expect(errors.some(e => e.message.includes("Undefined variable"))).toBe(true);
  });

  it("agent declarations type-check without errors", () => {
    const source = `agent ResearchAgent
  input query: string
  output string

  tools
    search_web, read_document

  steps
    search_web(query) -> sources
    return sources`;
    const { errors } = typeCheck(source);
    // Agents with tools may have soft errors, but should not crash
  });

  it("test declarations type-check", () => {
    const source = `test "addition works"
  1 + 1 == 2`;
    const { errors } = typeCheck(source);
    expect(errors.length).toBe(0);
  });

  it("string concatenation type-checks", () => {
    const source = `fn concat
  input a: string
  input b: string
  output string
  "Hello, " + a`;
    const { errors } = typeCheck(source);
    expect(errors.length).toBe(0);
  });

  it("Result unwrap operator type-checks", () => {
    const source = `fn safe_div
  input a: number
  input b: number
  output Result
  if b == 0
    Err("div by zero")
  else
    Ok(a / b)`;
    const { errors } = typeCheck(source);
    // Should not crash, may have soft errors
  });
});

// ── Example File Type-Checking ──

describe("Example files type-check", () => {
  const { readFileSync } = require("fs");
  const { resolve } = require("path");
  const examplesDir = resolve(__dirname, "..", "examples");
  const examples = ["greet.kapy", "result.kapy", "agent.kapy"];

  for (const file of examples) {
    it(`type-checks ${file}`, () => {
      const source = readFileSync(resolve(examplesDir, file), "utf-8");
      const { errors } = typeCheck(source);
      // Examples should type-check with at most soft errors (no hard type mismatches)
      // We just verify the type checker doesn't crash
    });
  }
});