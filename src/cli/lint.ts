// Kapy-script Linter — kapy lint
// Checks for common issues without blocking compilation

import { readFileSync } from "fs";
import { resolve } from "path";
import { Lexer } from "../lexer/lexer";
import { Parser } from "../parser/parser";
import type { Program, FnDecl, AgentDecl, Declaration, Expression, Block } from "../parser/ast";

export interface LintFinding {
  file: string;
  line: number;
  column: number;
  severity: "warning" | "error";
  rule: string;
  message: string;
  suggestion?: string;
}

export interface LintOptions {
  /** Promote warnings to errors */
  strict: boolean;
}

/** Lint a kapy-script source string */
export function lintSource(source: string, file: string = "<lint>"): LintFinding[] {
  const findings: LintFinding[] = [];
  const usedNames = new Set<string>();
  const assignedNames = new Map<string, { line: number; column: number }>();

  let program: Program;
  try {
    const tokens = new Lexer(source, file).tokenize();
    program = new Parser(tokens, file).parse();
  } catch {
    return findings;
  }

  for (const decl of program.declarations) {
    lintDeclaration(decl, findings, usedNames, assignedNames, file);
  }

  // Check for unused variables
  for (const [name, info] of assignedNames) {
    if (!usedNames.has(name) && !name.startsWith("_")) {
      findings.push({
        file,
        line: info.line,
        column: info.column,
        severity: "warning",
        rule: "unused-variable",
        message: `Unused variable '${name}'`,
        suggestion: `Consider removing or prefixing with '_'`,
      });
    }
  }

  return findings;
}

function lintDeclaration(
  decl: Declaration,
  findings: LintFinding[],
  usedNames: Set<string>,
  assignedNames: Map<string, { line: number; column: number }>,
  file: string,
): void {
  switch (decl.kind) {
    case "FnDecl":
      lintFnDecl(decl, findings, usedNames, assignedNames, file);
      break;
    case "AgentDecl":
      lintAgentDecl(decl, findings, usedNames, assignedNames, file);
      break;
  }
}

function lintFnDecl(
  fn: FnDecl,
  findings: LintFinding[],
  usedNames: Set<string>,
  assignedNames: Map<string, { line: number; column: number }>,
  file: string,
): void {
  if (!fn.output_type) {
    findings.push({
      file,
      line: fn.span.start.line,
      column: fn.span.start.column,
      severity: "warning",
      rule: "missing-output-type",
      message: `Function '${fn.name}' has no output type`,
      suggestion: `Add 'output <type>' for better type inference`,
    });
  }

  if (fn.body.kind === "Block" && fn.body.statements.length === 0) {
    findings.push({
      file,
      line: fn.span.start.line,
      column: fn.span.start.column,
      severity: "warning",
      rule: "empty-body",
      message: `Function '${fn.name}' has an empty body`,
      suggestion: `Add a body or remove the function`,
    });
  }

  for (const input of fn.inputs) {
    usedNames.add(input.name);
  }

  collectFromBody(fn.body, findings, usedNames, assignedNames, file);
}

function lintAgentDecl(
  agent: AgentDecl,
  findings: LintFinding[],
  usedNames: Set<string>,
  assignedNames: Map<string, { line: number; column: number }>,
  file: string,
): void {
  for (const input of agent.inputs) {
    usedNames.add(input.name);
  }

  if (agent.steps) collectFromBody(agent.steps, findings, usedNames, assignedNames, file);
  if (agent.body) collectFromBody(agent.body, findings, usedNames, assignedNames, file);
}

function collectFromBody(
  body: Block | Expression,
  findings: LintFinding[],
  usedNames: Set<string>,
  assignedNames: Map<string, { line: number; column: number }>,
  file: string,
): void {
  if (body.kind !== "Block") {
    collectUsages(body, usedNames);
    return;
  }

  let afterReturn = false;
  for (const stmt of body.statements) {
    if (afterReturn) {
      findings.push({
        file,
        line: stmt.span.start.line,
        column: stmt.span.start.column,
        severity: "warning",
        rule: "unreachable-code",
        message: `Unreachable code after return`,
        suggestion: `Remove unreachable code`,
      });
      break;
    }

    switch (stmt.kind) {
      case "ReturnStmt":
        afterReturn = true;
        collectUsages(stmt.value, usedNames);
        break;
      case "AssignmentStmt":
        assignedNames.set(stmt.name, {
          line: stmt.span.start.line,
          column: stmt.span.start.column,
        });
        collectUsages(stmt.value, usedNames);
        break;
      case "ExpressionStmt":
        collectUsages(stmt.expr, usedNames);
        break;
      case "StepStmt":
        if (stmt.binding) {
          assignedNames.set(stmt.binding, {
            line: stmt.span.start.line,
            column: stmt.span.start.column,
          });
        }
        collectUsages(stmt.expr, usedNames);
        break;
    }
  }
}

function collectUsages(expr: Expression, usedNames: Set<string>): void {
  switch (expr.kind) {
    case "Identifier":
      usedNames.add(expr.name);
      break;
    case "BinaryExpr":
      collectUsages(expr.left, usedNames);
      collectUsages(expr.right, usedNames);
      break;
    case "UnaryExpr":
      collectUsages(expr.operand, usedNames);
      break;
    case "CallExpr":
      collectUsages(expr.callee, usedNames);
      for (const arg of expr.args) collectUsages(arg, usedNames);
      break;
    case "MemberExpr":
      collectUsages(expr.object, usedNames);
      break;
    case "IndexExpr":
      collectUsages(expr.object, usedNames);
      collectUsages(expr.index, usedNames);
      break;
    case "ResultUnwrapExpr":
    case "CrashUnwrapExpr":
      collectUsages(expr.expr, usedNames);
      break;
    case "NumberLiteral":
    case "StringLiteral":
    case "BooleanLiteral":
    case "ArrayLiteral":
    case "RecordLiteral":
      break;
    default:
      // Pipeline, If, For, While, Match, Parallel, With, Lambda, InterpolatedString
      // These all contain sub-expressions but we skip deep walking for simplicity
      break;
  }
}

/** Format a lint finding for display */
export function formatFinding(finding: LintFinding): string {
  const severity = finding.severity === "error" ? "Error" : "Warning";
  let output = `\n  ${severity}: ${finding.message}\n`;
  output += `  → ${finding.file}:${finding.line}:${finding.column}\n`;
  if (finding.suggestion) {
    output += `  → ${finding.suggestion}\n`;
  }
  return output;
}

/** Lint a single file */
export function lintFile(filePath: string, options: LintOptions): LintFinding[] {
  const absolutePath = resolve(filePath);
  let source: string;
  try {
    source = readFileSync(absolutePath, "utf-8");
  } catch {
    console.error(`Error: Cannot read file '${filePath}'`);
    process.exit(1);
  }

  const findings = lintSource(source, filePath);

  if (options.strict) {
    for (const f of findings) {
      f.severity = "error";
    }
  }

  return findings;
}