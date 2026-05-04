import { describe, it, expect } from "bun:test";
import { Lexer } from "../src/lexer/lexer";
import { Parser } from "../src/parser/parser";
import { Emitter } from "../src/transpiler/emitter";
import { Cache } from "../src/transpiler/cache";
import { parsePkg } from "../src/cli/pkg";
import { initProject } from "../src/cli/init";
import { readFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { resolve, join } from "path";
import { execSync } from "child_process";

const CLI = "bun run src/cli/main.ts";
const CWD = resolve(__dirname, "..");

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
    const source = 'fn main\n  print("test")';

    expect(cache.isValid("test.kapy", source)).toBe(false);
    const entry = cache.set("test.kapy", source, "// test output");
    expect(existsSync(entry.tsPath)).toBe(true);
    expect(cache.isValid("test.kapy", source)).toBe(true);
    expect(cache.isValid("test.kapy", 'fn main\n  print("different")')).toBe(false);

    rmSync(cacheDir, { recursive: true });
  });

  it("cache content hash is deterministic", () => {
    const cache = new Cache(join(__dirname, ".test-cache-2"));
    const h1 = cache.hash("hello world");
    const h2 = cache.hash("hello world");
    const h3 = cache.hash("different content");
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });

  it("kapy run hello.kapy executes successfully", () => {
    const result = execSync(`${CLI} run examples/hello.kapy`, { cwd: CWD, encoding: "utf-8" });
    expect(result).toContain("Hello, kapy-script!");
  });

  it("kapy check hello.kapy reports success", () => {
    const result = execSync(`${CLI} check examples/hello.kapy`, { cwd: CWD, encoding: "utf-8" });
    expect(result).toContain("Type-checked successfully");
  });

  it("kapy --version prints version", () => {
    const result = execSync(`${CLI} --version`, { cwd: CWD, encoding: "utf-8" });
    expect(result.trim()).toBe("kapy v0.1.0");
  });

  it("kapy --help prints usage", () => {
    const result = execSync(`${CLI} --help`, { cwd: CWD, encoding: "utf-8" });
    expect(result).toContain("run");
    expect(result).toContain("check");
    expect(result).toContain("repl");
    expect(result).toContain("test");
    expect(result).toContain("init");
  });

  it("kapy check with nonexistent file exits with error", () => {
    try {
      execSync(`${CLI} check nonexistent.kapy 2>&1`, { cwd: CWD, encoding: "utf-8" });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.status).toBe(1);
    }
  });
});

// ── kapy.pkg Parser Tests ──

describe("kapy.pkg parser", () => {
  it("parses all standard fields", () => {
    const content = `name: my-agent
version: 1.0.0
entry: src/main.kapy
ai_provider: openai
ai_model: gpt-4
ai_api_key: env.OPENAI_API_KEY`;
    const pkg = parsePkg(content);
    expect(pkg.name).toBe("my-agent");
    expect(pkg.version).toBe("1.0.0");
    expect(pkg.entry).toBe("src/main.kapy");
    expect(pkg.ai_provider).toBe("openai");
    expect(pkg.ai_model).toBe("gpt-4");
  });

  it("parses dependencies with scoped packages", () => {
    const content = `name: test
version: 0.1.0
entry: src/main.kapy

dependencies
  @moikapy/kapy-runtime: ^0.1.0
  zod: 3.22.0`;
    const pkg = parsePkg(content);
    expect(pkg.dependencies["@moikapy/kapy-runtime"]).toBe("^0.1.0");
    expect(pkg.dependencies.zod).toBe("3.22.0");
  });

  it("parses ai_options section", () => {
    const content = `name: test
version: 0.1.0

ai_options
  temperature: 0.7
  max_tokens: 2048`;
    const pkg = parsePkg(content);
    expect(pkg.ai_options?.temperature).toBe("0.7");
    expect(pkg.ai_options?.max_tokens).toBe("2048");
  });

  it("preserves unknown fields in raw", () => {
    const content = `name: test
custom_field: custom_value`;
    const pkg = parsePkg(content);
    expect(pkg.raw.custom_field).toBe("custom_value");
  });

  it("handles comments and blank lines", () => {
    const content = `name: test
# This is a comment

version: 0.1.0`;
    const pkg = parsePkg(content);
    expect(pkg.name).toBe("test");
    expect(pkg.version).toBe("0.1.0");
  });
});
// ── Init Command Tests ──

describe("init command", () => {
  it("creates project directory with all files", () => {
    initProject({ name: "test-project", dir: __dirname });
    const baseDir = join(__dirname, "test-project");

    expect(existsSync(join(baseDir, "src"))).toBe(true);
    expect(existsSync(join(baseDir, "test"))).toBe(true);
    expect(existsSync(join(baseDir, ".kapy-cache"))).toBe(true);
    expect(existsSync(join(baseDir, "kapy.pkg"))).toBe(true);
    expect(existsSync(join(baseDir, "package.json"))).toBe(true);
    expect(existsSync(join(baseDir, ".gitignore"))).toBe(true);
    expect(existsSync(join(baseDir, "README.md"))).toBe(true);
    expect(existsSync(join(baseDir, "src", "main.kapy"))).toBe(true);
    expect(existsSync(join(baseDir, "test", "main.test.kapy"))).toBe(true);

    rmSync(baseDir, { recursive: true });
  });

  it("writes correct kapy.pkg content", () => {
    initProject({ name: "my-app", dir: __dirname });
    const baseDir = join(__dirname, "my-app");
    const pkgContent = readFileSync(join(baseDir, "kapy.pkg"), "utf-8");

    expect(pkgContent).toContain("name: my-app");
    expect(pkgContent).toContain("version: 0.1.0");
    expect(pkgContent).toContain("entry: src/main.kapy");

    rmSync(baseDir, { recursive: true });
  });

  it("writes src/main.kapy with project name", () => {
    initProject({ name: "hello-world", dir: __dirname });
    const baseDir = join(__dirname, "hello-world");
    const mainContent = readFileSync(join(baseDir, "src", "main.kapy"), "utf-8");

    expect(mainContent).toContain("Hello from hello-world!");

    rmSync(baseDir, { recursive: true });
  });

  it("writes valid package.json", () => {
    initProject({ name: "test-pkg", dir: __dirname });
    const baseDir = join(__dirname, "test-pkg");
    const pkgJson = JSON.parse(readFileSync(join(baseDir, "package.json"), "utf-8"));

    expect(pkgJson.name).toBe("test-pkg");
    expect(pkgJson.version).toBe("0.1.0");
    expect(pkgJson.type).toBe("module");
    expect(pkgJson.dependencies["@moikapy/kapy-runtime"]).toBe("^0.1.0");

    rmSync(baseDir, { recursive: true });
  });

  it("writes .gitignore with expected entries", () => {
    initProject({ name: "gitignore-test", dir: __dirname });
    const baseDir = join(__dirname, "gitignore-test");
    const gitignore = readFileSync(join(baseDir, ".gitignore"), "utf-8");

    expect(gitignore).toContain(".kapy-cache/");
    expect(gitignore).toContain("node_modules/");
    expect(gitignore).toContain("dist/");

    rmSync(baseDir, { recursive: true });
  });
});
