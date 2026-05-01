import { describe, it, expect } from "bun:test";
import { Lexer } from "../src/lexer/lexer";
import { Parser } from "../src/parser/parser";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── CLI Integration Tests ──

describe("CLI integration", () => {
  it("lexes and parses the greet example without errors", () => {
    const source = readFileSync(resolve(__dirname, "..", "examples", "greet.kapy"), "utf-8");
    const tokens = new Lexer(source, "greet.kapy").tokenize();
    const ast = new Parser(tokens, "greet.kapy").parse();
    expect(ast.declarations.length).toBe(1);
    expect(ast.declarations[0].kind).toBe("FnDecl");
  });
});