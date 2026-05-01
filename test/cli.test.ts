import { describe, it, expect } from "bun:test";
import { Lexer } from "../src/lexer/lexer";
import { Parser } from "../src/parser/parser";
import { Emitter } from "../src/transpiler/emitter";
import { Cache } from "../src/transpiler/cache";
import { readFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { resolve, join } from "path";
import { execSync } from "child_process";

function transpile(source: string): string {
  const tokens = new Lexer(source, "test.kapy").tokenize();
  const ast = new Parser(tokens, "test.kapy").parse();
  const emitter = new Emitter();
  const { code } = emitter.emit(ast);
  return code;
}

// ── CLI Integration Tests ──

describe("CLI integration", () => {
  it("lexes and parses the greet example without errors", () => {
    const source = readFileSync(resolve(__dirname, "..", "examples", "greet.kapy"), "utf-8");
    const tokens = new Lexer(source, "greet.kapy").tokenize();
    const ast = new Parser(tokens, "greet.kapy").parse();
    expect(ast.declarations.length).toBe(1);
    expect(ast.declarations[0].kind).toBe("FnDecl");
  });

  it("transpiles hello.kapy to working TypeScript", () => {
    const source = readFileSync(resolve(__dirname, "..", "examples", "hello.kapy"), "utf-8");
    const ts = transpile(source);
    expect(ts).toContain("export async function main");
    expect(ts).toContain("await print");
  });

  it("caches transpiled output correctly", () => {
    const cacheDir = join(__dirname, ".test-cache");
    if (existsSync(cacheDir)) rmSync(cacheDir, { recursive: true });
    mkdirSync(cacheDir, { recursive: true });

    const cache = new Cache(cacheDir);
    const source = "fn main\n  print(\"test\")";

    // Initially no cache
    expect(cache.isValid("test.kapy", source)).toBe(false);

    // Set cache
    const entry = cache.set("test.kapy", source, "// test output");
    expect(existsSync(entry.tsPath)).toBe(true);

    // Now cache should be valid
    expect(cache.isValid("test.kapy", source)).toBe(true);

    // Cache should invalidate on different source
    expect(cache.isValid("test.kapy", "fn main\n  print(\"different\")")).toBe(false);

    // Cleanup
    rmSync(cacheDir, { recursive: true });
  });

  it("cache content hash is deterministic", () => {
    const cache = new Cache(join(__dirname, ".test-cache-2"));
    const hash1 = cache.hash("hello world");
    const hash2 = cache.hash("hello world");
    const hash3 = cache.hash("different content");
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  it("kapy run hello.kapy executes successfully", () => {
    const result = execSync("bun run src/cli/main.ts run examples/hello.kapy", {
      cwd: resolve(__dirname, ".."),
      encoding: "utf-8",
    });
    expect(result).toContain("Hello, kapy-script!");
  });

  it("kapy check hello.kapy reports success", () => {
    const result = execSync("bun run src/cli/main.ts check examples/hello.kapy", {
      cwd: resolve(__dirname, ".."),
      encoding: "utf-8",
    });
    expect(result).toContain("Type-checked successfully");
  });

  it("kapy --version prints version", () => {
    const result = execSync("bun run src/cli/main.ts --version", {
      cwd: resolve(__dirname, ".."),
      encoding: "utf-8",
    });
    expect(result.trim()).toBe("kapy v0.1.0");
  });

  it("kapy --help prints usage", () => {
    const result = execSync("bun run src/cli/main.ts --help", {
      cwd: resolve(__dirname, ".."),
      encoding: "utf-8",
    });
    expect(result).toContain("run");
    expect(result).toContain("check");
    expect(result).toContain("repl");
  });

  it("kapy check with nonexistent file exits with error", () => {
    try {
      execSync("bun run src/cli/main.ts check nonexistent.kapy 2>&1", {
        cwd: resolve(__dirname, ".."),
        encoding: "utf-8",
      });
      expect(true).toBe(false); // Should not reach here
    } catch (e: any) {
      expect(e.status).toBe(1);
    }
  });


});