import { describe, it, expect } from "bun:test";
import { Lexer } from "../src/lexer/lexer";
import { Parser } from "../src/parser/parser";
import { Emitter } from "../src/transpiler/emitter";
import { TypeChecker } from "../src/typechecker/checker";

// Helper to type-check a source string
function typeCheck(source: string) {
  const tokens = new Lexer(source, "test.kapy").tokenize();
  const ast = new Parser(tokens, "test.kapy").parse();
  const checker = new TypeChecker();
  checker.setFile("test.kapy");
  const errors = checker.check(ast);
  const warnings = checker.getWarnings();
  return { errors, warnings };
}

// Helper to transpile a source string
function transpile(source: string) {
  const tokens = new Lexer(source, "test.kapy").tokenize();
  const ast = new Parser(tokens, "test.kapy").parse();
  const emitter = new Emitter();
  return emitter.emit(ast, source);
}

describe("Gap fixes", () => {
  // ── Source Maps ──

  it("source maps include sourcesContent with original source", () => {
    const source = `fn main\n  print("hello")`;
    const { sourceMap } = transpile(source);
    const map = JSON.parse(sourceMap);
    expect(map.version).toBe(3);
    expect(map.sources[0]).toBe("test.kapy");
    expect(map.sourcesContent[0]).toBe(source);
  });

  it("source maps have non-empty mappings", () => {
    const source = `fn greet\n  input name: string\n  output string\n  "Hello, {name}!"`;
    const { sourceMap } = transpile(source);
    const map = JSON.parse(sourceMap);
    expect(map.mappings.length).toBeGreaterThan(0);
    const nonEmpty = map.mappings.split(";").filter((s: string) => s.length > 0);
    expect(nonEmpty.length).toBeGreaterThan(0);
  });

  // ── import kapy/test (keyword as module segment) ──

  it("imports kapy/test without parse error", () => {
    const source = `import kapy/test\n\nfn main\n  output any\n  print("ok")`;
    const tokens = new Lexer(source, "test.kapy").tokenize();
    const ast = new Parser(tokens, "test.kapy").parse();
    expect(ast.declarations[0].kind).toBe("ImportDecl");
    expect((ast.declarations[0] as any).module).toEqual(["kapy", "test"]);
  });

  it("imports kapy/web/router without parse error", () => {
    const source = `import kapy/web/router\n\nfn main\n  output any\n  print("ok")`;
    const tokens = new Lexer(source, "test.kapy").tokenize();
    const ast = new Parser(tokens, "test.kapy").parse();
    expect(ast.declarations[0].kind).toBe("ImportDecl");
    expect((ast.declarations[0] as any).module).toEqual(["kapy", "web", "router"]);
  });

  it("kapy/test import registers assertion functions in type checker", () => {
    const source = `import kapy/test\n\ntest "assertions work"\n  assertEqual(1, 1)`;
    const { errors } = typeCheck(source);
    // assertEqual should NOT be flagged as an undefined variable
    expect(errors.some(e => e.message.includes("Undefined variable"))).toBe(false);
  });

  it("kapy/web import registers router in type checker", () => {
    const source = `import kapy/web/router\n\nfn main\n  output any\n  router`;
    const { errors } = typeCheck(source);
    expect(errors.length).toBe(0);
  });

  // ── Version-Gated Warnings ──

  it("impl declarations produce v0.5 error for unknown traits", () => {
    const source = `impl Serializable for User\n  fn to_string\n    input x: any\n    output string\n    "user"`;
    const { errors } = typeCheck(source);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.message.includes("v0.5"))).toBe(true);
  });

  it("non-exhaustive match produces v0.5 warning", () => {
    const source = `sealed trait Result\n  case Ok(value: any)\n  case Err(message: string)\n\nfn unwrap\n  input r: Result\n  output any\n  match r\n    Ok(v) -> v`;
    const { errors, warnings } = typeCheck(source);
    expect(warnings.some(w => w.message.includes("Non-exhaustive") || w.message.includes("v0.5"))).toBe(true);
  });

  // ── Transpiler emits correct stdlib import paths ──

  it("kapy/test emits @moikapy/kapy-runtime/test import", () => {
    const source = `import kapy/test\n\ntest "works"\n  assertEqual(1, 1)`;
    const { code } = transpile(source);
    expect(code).toContain("@moikapy/kapy-runtime/test");
  });

  it("kapy/ai/chain emits @moikapy/kapy-runtime/ai/chain import", () => {
    const source = `import kapy/ai/chain\n\nfn main\n  output any\n  chain`;
    const { code } = transpile(source);
    expect(code).toContain("@moikapy/kapy-runtime/ai/chain");
  });

  it("kapy/web/router emits @moikapy/kapy-runtime/web/router import", () => {
    const source = `import kapy/web/router\n\nfn main\n  output any\n  router`;
    const { code } = transpile(source);
    expect(code).toContain("@moikapy/kapy-runtime/web/router");
  });
});