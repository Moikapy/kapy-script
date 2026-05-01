import { describe, it, expect } from "bun:test";
import { Lexer } from "../src/lexer/lexer";
import { Parser } from "../src/parser/parser";
import { Emitter } from "../src/transpiler/emitter";

function transpile(source: string): string {
  const tokens = new Lexer(source, "test.kapy").tokenize();
  const ast = new Parser(tokens, "test.kapy").parse();
  const emitter = new Emitter();
  const { code } = emitter.emit(ast);
  return code;
}

// ── Transpiler Tests ──

describe("Transpiler", () => {
  it("transpiles a simple function", () => {
    const source = `fn greet
  input name: string
  output string
  "Hello, {name}!"`;
    const ts = transpile(source);
    expect(ts).toContain("export async function greet");
    expect(ts).toContain("name: string");
    expect(ts).toContain("Promise<string>");
  });

  it("transpiles a function with binary expressions", () => {
    const source = `fn double
  input x: number
  output number
  x * 2`;
    const ts = transpile(source);
    expect(ts).toContain("x * 2");
  });

  it("transpiles a sealed trait", () => {
    const source = `sealed trait Result
  case Ok(value: any)
  case Err(message: string)`;
    const ts = transpile(source);
    expect(ts).toContain("export type Result");
    expect(ts).toContain("Ok");
    expect(ts).toContain("Err");
  });

  it("transpiles variable assignments", () => {
    const source = `fn compute
  input x: number
  output number
  y = x + 1
  y * 2`;
    const ts = transpile(source);
    expect(ts).toContain("const y = x + 1");
  });

  it("transpiles if/else expressions", () => {
    const source = `fn classify
  input x: number
  output string
  if x > 0
    "positive"
  else
    "non-positive"`;
    const ts = transpile(source);
    expect(ts).toContain("if");
    expect(ts).toContain("else");
  });

  it("transpiles import declarations", () => {
    const source = `import kapy/ai/react`;
    const ts = transpile(source);
    // kapy stdlib imports become runtime imports
    expect(ts.length).toBeGreaterThan(0);
  });

  it("transpiles a test declaration", () => {
    const source = `test "addition works"
  1 + 1 == 2`;
    const ts = transpile(source);
    expect(ts).toContain('test("addition works"');
  });

  it("transpiles array types in output", () => {
    const source = `fn numbers
  input x: number
  output number[]
  [1, 2, 3]`;
    const ts = transpile(source);
    expect(ts).toContain("number[]");
  });

  it("generates clean readable TypeScript", () => {
    const source = `fn greet
  input name: string
  output string
  "Hello, {name}!"`;
    const ts = transpile(source);
    // Should have reasonable formatting
    expect(ts.split("\n").length).toBeGreaterThan(3);
  });
});