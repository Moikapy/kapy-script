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

  it("transpiles if/else as IIFE expression", () => {
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
    // If/else in expression context should be wrapped in IIFE
    expect(ts).toContain("(() =>");
    expect(ts).toContain("return");
  });

  it("transpiles import declarations", () => {
    const source = `import kapy/ai/react`;
    const ts = transpile(source);
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
    expect(ts.split("\n").length).toBeGreaterThan(3);
  });

  // ── New: Expression transpilation ──

  it("transpiles string interpolation", () => {
    const source = `fn greet
  input name: string
  output string
  "Hello, {name}!"`;
    const ts = transpile(source);
    // Template literal should contain interpolation syntax
    expect(ts).toContain("`");
    expect(ts).toContain("${name}");
  });

  it("transpiles unary negation", () => {
    const source = `fn negate
  input x: number
  output number
  -x`;
    const ts = transpile(source);
    expect(ts).toContain("-x");
  });

  it("transpiles member access", () => {
    const source = `fn get_name
  input x: any
  output string
  x.name`;
    const ts = transpile(source);
    expect(ts).toContain("x.name");
  });

  it("transpiles index access", () => {
    const source = `fn get_item
  input x: any
  output any
  x[0]`;
    const ts = transpile(source);
    expect(ts).toContain("x[0]");
  });

  it("transpiles function calls as async", () => {
    const source = `fn compute
  input x: number
  output number
  double(x)`;
    const ts = transpile(source);
    expect(ts).toContain("await double(x)");
  });

  it("transpiles for loops", () => {
    const source = `fn loop_test
  input x: any
  output any
  for item in x
    print(item)`;
    const ts = transpile(source);
    expect(ts).toContain("for (const item of");
  });

  it("transpiles while loops", () => {
    const source = `fn loop_test
  input x: any
  output any
  while x > 0
    print(x)`;
    const ts = transpile(source);
    expect(ts).toContain("while (x > 0)");
  });

  it("transpiles parallel blocks", () => {
    const source = `fn parallel_demo
  input x: any
  output any
  parallel
    fetch(x) -> a
    load(x) -> b`;
    const ts = transpile(source);
    expect(ts).toContain("KapyRuntime.parallel");
  });

  it("transpiles with timeout blocks", () => {
    const source = `fn with_demo
  input x: any
  output any
  with timeout(5000)
    fetch(x)`;
    const ts = transpile(source);
    expect(ts).toContain("KapyRuntime.withTimeout");
  });

  it("transpiles result unwrap operator (?)", () => {
    const source = `fn unwrap_test
  input x: any
  output any
  x?`;
    const ts = transpile(source);
    expect(ts).toContain("unwrap");
  });

  it("transpiles crash unwrap operator (!)", () => {
    const source = `fn crash_test
  input x: any
  output any
  x!`;
    const ts = transpile(source);
    expect(ts).toContain("unwrapOrCrash");
  });

  it("transpiles lambda expressions", () => {
    const source = `fn map_test
  input x: any
  output any
  x -> x + 1`;
    const ts = transpile(source);
    expect(ts).toContain("=>");
  });

  it("transpiles mutable variable assignment with :=", () => {
    const source = `fn mut_test
  input x: number
  output number
  y := x + 1
  y`;
    const ts = transpile(source);
    expect(ts).toContain("let y = x + 1");
  });

  it("transpiles agent declarations with runtime import", () => {
    const source = `agent ResearchAgent
  input query: string
  output Report

  tools
    search_web, read_document

  steps
    search_web(query) -> sources
    return sources`;
    const ts = transpile(source);
    expect(ts).toContain("ResearchAgent");
    expect(ts).toContain("KapyRuntime.createAgent");
    expect(ts).toContain("search_web");
    expect(ts).toContain("read_document");
  });

  it("transpiles trait declarations", () => {
    const source = `trait Printable
  fn show
    input x: any
    output string
    x`;
    const ts = transpile(source);
    expect(ts).toContain("interface Printable");
    expect(ts).toContain("show");
  });

  it("transpiles impl declarations", () => {
    const source = `impl Show for Printable
  fn show
    input x: any
    output string
    x`;
    const ts = transpile(source);
    expect(ts).toContain("Show");
    expect(ts).toContain("Printable");
  });

  it("generates source map with VLQ mappings and sourcesContent", () => {
    const source = `fn main
  print("hello")`;
    const tokens = new Lexer(source, "test.kapy").tokenize();
    const ast = new Parser(tokens, "test.kapy").parse();
    const emitter = new Emitter();
    const { sourceMap } = emitter.emit(ast, source);
    const map = JSON.parse(sourceMap);
    expect(map.version).toBe(3);
    expect(map.sources).toContain("test.kapy");
    expect(map.sourcesContent[0]).toBe(source);
    expect(map.mappings.length).toBeGreaterThan(0);
    // Mappings should have at least one non-empty segment (the function declaration)
    const nonEmptySegments = map.mappings.split(";").filter((s: string) => s.length > 0);
    expect(nonEmptySegments.length).toBeGreaterThan(0);
  });
});