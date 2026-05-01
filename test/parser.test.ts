import { describe, it, expect } from "bun:test";
import { Lexer } from "../src/lexer/lexer";
import { Parser } from "../src/parser/parser";
import { Program } from "../src/parser/ast";
import { readFileSync } from "fs";
import { resolve } from "path";

function parse(source: string): Program {
  const tokens = new Lexer(source, "test.kapy").tokenize();
  return new Parser(tokens, "test.kapy").parse();
}

// ── Parser Tests ──

describe("Parser", () => {
  it("parses a simple function declaration", () => {
    const source = `fn greet
  input name: string
  output string
  "Hello, {name}!"`;
    const ast = parse(source);
    expect(ast.declarations.length).toBe(1);
    expect(ast.declarations[0].kind).toBe("FnDecl");
    const fn = ast.declarations[0] as any;
    expect(fn.name).toBe("greet");
    expect(fn.inputs.length).toBe(1);
    expect(fn.inputs[0].name).toBe("name");
  });

  it("parses a sealed trait with cases", () => {
    const source = `sealed trait Result
  case Ok(value: any)
  case Err(message: string)`;
    const ast = parse(source);
    expect(ast.declarations.length).toBe(1);
    expect(ast.declarations[0].kind).toBe("SealedTraitDecl");
    const trait = ast.declarations[0] as any;
    expect(trait.name).toBe("Result");
    expect(trait.cases.length).toBe(2);
    expect(trait.cases[0].name).toBe("Ok");
    expect(trait.cases[1].name).toBe("Err");
  });

  it("parses an agent declaration with tools and steps", () => {
    const source = `agent ResearchAgent
  input query: string
  output Report

  tools
    search_web, read_document

  steps
    search_web(query) -> sources
    return sources`;
    const ast = parse(source);
    expect(ast.declarations.length).toBe(1);
    expect(ast.declarations[0].kind).toBe("AgentDecl");
    const agent = ast.declarations[0] as any;
    expect(agent.name).toBe("ResearchAgent");
    expect(agent.tools).toContain("search_web");
    expect(agent.tools).toContain("read_document");
  });

  it("parses a function with if/else", () => {
    const source = `fn classify
  input x: number
  output string
  if x > 0
    "positive"
  else
    "non-positive"`;
    const ast = parse(source);
    expect(ast.declarations.length).toBe(1);
    const fn = ast.declarations[0] as any;
    expect(fn.body.kind).toBe("IfExpr");
  });

  it("parses match expressions", () => {
    const source = `fn area
  input shape: Shape
  output number
  match shape
    Circle(r) -> 3.14159 * r * r
    Rectangle(w, h) -> w * h`;
    const ast = parse(source);
    const fn = ast.declarations[0] as any;
    expect(fn.body.kind).toBe("MatchExpr");
    expect(fn.body.cases.length).toBe(2);
  });

  it("parses variable assignments", () => {
    const source = `fn compute
  input x: number
  output number
  name = "kapy"
  count := 0
  count`;
    const ast = parse(source);
    expect(ast.declarations.length).toBe(1);
  });

  it("parses import declarations", () => {
    const source = `import kapy/ai/react`;
    const ast = parse(source);
    expect(ast.declarations.length).toBe(1);
    expect(ast.declarations[0].kind).toBe("ImportDecl");
    const imp = ast.declarations[0] as any;
    expect(imp.module).toEqual(["kapy", "ai", "react"]);
  });

  it("parses test declarations", () => {
    const source = `test "simple addition"
  1 + 1`;
    const ast = parse(source);
    expect(ast.declarations.length).toBe(1);
    expect(ast.declarations[0].kind).toBe("TestDecl");
    const test = ast.declarations[0] as any;
    expect(test.name).toBe("simple addition");
  });

  it("parses trait and impl declarations", () => {
    const source = `trait Printable
  fn to_string
    input self
    output string

impl Printable for Document
  fn to_string
    input self
    output string
    "Document"`;
    const ast = parse(source);
    expect(ast.declarations.length).toBe(2);
    expect(ast.declarations[0].kind).toBe("TraitDecl");
    expect(ast.declarations[1].kind).toBe("ImplDecl");
  });
});

// ── End-to-end Tests (example files) ──

describe("Example files", () => {
  const examplesDir = resolve(__dirname, "..", "examples");

  const examples = ["greet.kapy", "result.kapy", "divide.kapy", "agent.kapy"];

  for (const file of examples) {
    it(`parses ${file}`, () => {
      const source = readFileSync(resolve(examplesDir, file), "utf-8");
      const tokens = new Lexer(source, file).tokenize();
      const ast = new Parser(tokens, file).parse();
      expect(ast.declarations.length).toBeGreaterThan(0);
    });
  }
});