import { describe, it, expect } from "bun:test";
import { formatSource } from "../src/cli/fmt";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const CLI = "bun run src/cli/main.ts";
const CWD = join(__dirname, "..");

describe("kapy fmt", () => {
  it("removes trailing whitespace", () => {
    const source = "fn greet\n  input x: number   \n  output string\n  x + 1";
    const result = formatSource(source);
    expect(result).not.toContain("   \n");
    expect(result).toContain("input x: number\n");
  });

  it("ensures final newline", () => {
    const source = "fn greet\n  input x: number\n  output string\n  x + 1";
    const result = formatSource(source);
    expect(result.endsWith("\n")).toBe(true);
  });

  it("collapses multiple blank lines to single", () => {
    const source = "fn greet\n  output string\n  \"hello\"\n\n\n\nfn main\n  output string\n  \"world\"";
    const result = formatSource(source);
    expect(result).not.toContain("\n\n\n");
    expect(result).toContain("\n\nfn main");
  });

  it("preserves indentation (2-space)", () => {
    const source = "fn greet\n  input x: number\n  output string\n  x + 1";
    const result = formatSource(source);
    expect(result).toContain("  input");
  });

  it("adds spaces around + operator", () => {
    const source = "fn add\n  input x: number\n  output number\n  x+1";
    const result = formatSource(source);
    expect(result).toContain("x + 1");
    expect(result).not.toContain("x+1");
  });

  it("returns original source for parse errors", () => {
    const source = "this is not valid kapy {syntax}";
    const result = formatSource(source);
    // Formatter adds a trailing newline — strip it for comparison
    expect(result.trim()).toBe(source.trim());
  });

  it("handles type annotation spacing", () => {
    const source = "fn greet\n  input x:number\n  output string\n  x + 1";
    const result = formatSource(source);
    expect(result).toContain("x: number");
    expect(result).not.toContain("x:number");
  });

  it("does not modify already-formatted code", () => {
    const source = "fn greet\n  input x: number\n  output string\n  x + 1\n";
    const result = formatSource(source);
    expect(result).toBe(source);
  });
});

describe("kapy fmt CLI", () => {
  const tmpDir = join(__dirname, ".fmt-test");

  it("formats a file in place", () => {
    mkdirSync(tmpDir, { recursive: true });
    const filePath = join(tmpDir, "test.kapy");
    writeFileSync(filePath, "fn greet\n  input x:number\n  output string\n  x+1\n", "utf-8");

    execSync(`${CLI} fmt ${filePath}`, { cwd: CWD, encoding: "utf-8" });

    const result = readFileSync(filePath, "utf-8");
    expect(result).toContain("x: number");
    expect(result).toContain("x + 1");

    rmSync(tmpDir, { recursive: true });
  });

  it("exits 1 with --check if file needs formatting", () => {
    mkdirSync(tmpDir, { recursive: true });
    const filePath = join(tmpDir, "test.kapy");
    writeFileSync(filePath, "fn greet\n  input x:number\n  output string\n  x+1\n", "utf-8");

    try {
      execSync(`${CLI} fmt --check ${filePath}`, { cwd: CWD, encoding: "utf-8" });
      expect(true).toBe(false); // Should not reach here
    } catch (e: any) {
      expect(e.status).toBe(1);
    }

    rmSync(tmpDir, { recursive: true });
  });

  it("exits 0 with --check if file is already formatted", () => {
    mkdirSync(tmpDir, { recursive: true });
    const filePath = join(tmpDir, "test.kapy");
    writeFileSync(filePath, "fn greet\n  input x: number\n  output string\n  x + 1\n", "utf-8");

    execSync(`${CLI} fmt --check ${filePath}`, { cwd: CWD, encoding: "utf-8" });

    rmSync(tmpDir, { recursive: true });
  });

  it("prints formatted output with --dry-run", () => {
    mkdirSync(tmpDir, { recursive: true });
    const filePath = join(tmpDir, "test.kapy");
    const original = "fn greet\n  input x:number\n  output string\n  x+1\n";
    writeFileSync(filePath, original, "utf-8");

    const result = execSync(`${CLI} fmt --dry-run ${filePath}`, { cwd: CWD, encoding: "utf-8" });
    expect(result).toContain("x: number");
    expect(result).toContain("x + 1");

    // Original file should be unchanged
    const after = readFileSync(filePath, "utf-8");
    expect(after).toBe(original);

    rmSync(tmpDir, { recursive: true });
  });
});