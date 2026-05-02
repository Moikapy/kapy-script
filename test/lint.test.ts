import { describe, it, expect } from "bun:test";
import { lintSource, formatFinding } from "../src/cli/lint";
import type { LintFinding } from "../src/cli/lint";
import { execSync } from "child_process";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

const CLI = "bun run src/cli/main.ts";
const CWD = join(__dirname, "..");

describe("kapy lint", () => {
  it("detects unused variables", () => {
    const source = `fn greet
  input x: number
  output number
  y = 42
  x`;
    const findings = lintSource(source, "test.kapy");
    const unused = findings.find(f => f.rule === "unused-variable");
    expect(unused).toBeDefined();
    expect(unused!.message).toContain("y");
  });

  it("detects missing output type", () => {
    const source = `fn greet
  x + 1`;
    const findings = lintSource(source, "test.kapy");
    const missing = findings.find(f => f.rule === "missing-output-type");
    expect(missing).toBeDefined();
    expect(missing!.message).toContain("no output type");
  });

  it("detects empty function bodies", () => {
    const source = `fn greet
  output string`;
    const findings = lintSource(source, "test.kapy");
    const empty = findings.find(f => f.rule === "empty-body");
    expect(empty).toBeDefined();
    expect(empty!.message).toContain("empty body");
  });

  it("does not flag used variables", () => {
    const source = `fn greet
  input x: number
  output number
  y = x + 1
  y`;
    const findings = lintSource(source, "test.kapy");
    const unused = findings.find(f => f.rule === "unused-variable");
    expect(unused).toBeUndefined();
  });

  it("does not flag functions with output type", () => {
    const source = `fn greet
  input x: number
  output number
  x + 1`;
    const findings = lintSource(source, "test.kapy");
    const missing = findings.find(f => f.rule === "missing-output-type");
    expect(missing).toBeUndefined();
  });

  it("allows _-prefixed unused variables", () => {
    const source = `fn greet
  input x: number
  output number
  _unused = x + 1
  x`;
    const findings = lintSource(source, "test.kapy");
    const unused = findings.find(f => f.rule === "unused-variable");
    expect(unused).toBeUndefined();
  });

  it("formats findings with file:line:column", () => {
    const finding: LintFinding = {
      file: "test.kapy",
      line: 3,
      column: 5,
      severity: "warning",
      rule: "unused-variable",
      message: "Unused variable 'z'",
      suggestion: "Consider removing or prefixing with '_'",
    };
    const formatted = formatFinding(finding);
    expect(formatted).toContain("Warning: Unused variable 'z'");
    expect(formatted).toContain("test.kapy:3:5");
    expect(formatted).toContain("Consider removing");
  });

  it("returns no findings for parse errors", () => {
    const source = `this is not valid {syntax}`;
    const findings = lintSource(source, "test.kapy");
    expect(findings.length).toBe(0);
  });
});

describe("kapy lint CLI", () => {
  const tmpDir = join(__dirname, ".lint-test");

  it("reports lint issues", () => {
    mkdirSync(tmpDir, { recursive: true });
    const filePath = join(tmpDir, "test.kapy");
    writeFileSync(filePath, "fn greet\n  output number\n  y = 42\n  x\n", "utf-8");

    const result = execSync(`${CLI} lint ${filePath}`, { cwd: CWD, encoding: "utf-8" });
    expect(result).toContain("Unused variable");
    expect(result).toContain("1 warning");

    rmSync(tmpDir, { recursive: true });
  });

  it("exits 0 for clean files", () => {
    mkdirSync(tmpDir, { recursive: true });
    const filePath = join(tmpDir, "clean.kapy");
    writeFileSync(filePath, "fn greet\n  input x: number\n  output number\n  x + 1\n", "utf-8");

    const result = execSync(`${CLI} lint ${filePath}`, { cwd: CWD, encoding: "utf-8" });
    expect(result).toContain("No lint issues");

    rmSync(tmpDir, { recursive: true });
  });

  it("exits 1 with --strict for warnings", () => {
    mkdirSync(tmpDir, { recursive: true });
    const filePath = join(tmpDir, "strict.kapy");
    writeFileSync(filePath, "fn greet\n  output number\n  y = 42\n  x\n", "utf-8");

    try {
      execSync(`${CLI} lint --strict ${filePath}`, { cwd: CWD, encoding: "utf-8" });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.status).toBe(1);
    }

    rmSync(tmpDir, { recursive: true });
  });
});