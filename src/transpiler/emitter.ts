// Kapy-script Transpiler — Phase 3
// Emits clean, readable TypeScript from a typed AST

import {
  type Program,
  type Declaration,
  type FnDecl,
  type AgentDecl,
  type ToolDecl,
  type SealedTraitDecl,
  type TraitDecl,
  type ImplDecl,
  type TestDecl,
  type Expression,
  type Statement,
  type Block,
  type KapyType,
  type Pattern,
} from "../parser/ast";

// ── Emitter ──

export class Emitter {
  private output: string[] = [];
  private indent: number = 0;
  private imports: Set<string> = new Set();
  private runtimeImports: Set<string> = new Set();
  private testImports: Set<string> = new Set();
  private sourceMapLines: Map<number, number> = new Map();
  private currentKapyLine: number = 1;
  private originalSource: string = "";

  /** Transpile a complete program to TypeScript */
  private anyType: KapyType = { kind: "PrimitiveType", name: "any", span: { start: { line: 0, column: 0, offset: 0, length: 0, file: "<synth>" }, end: { line: 0, column: 0, offset: 0, length: 0, file: "<synth>" } } };

  emit(program: Program, source?: string): { code: string; sourceMap: string } {
    this.output = [];
    this.indent = 0;
    this.imports = new Set();
    this.runtimeImports = new Set();
    this.testImports = new Set();
    this.sourceMapLines = new Map();
    this.currentKapyLine = 1;
    this.originalSource = source || "";

    // First pass: collect all imports needed
    for (const decl of program.declarations) {
      this.collectImports(decl);
    }

    // Emit runtime imports
    if (this.runtimeImports.size > 0) {
      this.emitLine(`import { ${[...this.runtimeImports].join(", ")} } from "@moikapy/kapy-runtime";`);
      this.emitLine("");
    }

    // Emit test imports
    if (this.testImports.size > 0) {
      this.emitLine(`import { ${[...this.testImports].join(", ")} } from "bun:test";`);
      this.emitLine("");
    }

    // Emit npm imports
    for (const imp of this.imports) {
      this.emitLine(imp);
    }
    if (this.imports.size > 0) {
      this.emitLine("");
    }

    // Emit each declaration
    for (const decl of program.declarations) {
      this.emitDeclaration(decl);
      this.emitLine("");
    }

    // If there's a main function, call it
    const hasMain = program.declarations.some(d => d.kind === "FnDecl" && d.name === "main");
    if (hasMain) {
      this.emitLine("// Entry point");
      this.emitLine("await main();");
    }

    const code = this.output.join("\n");
    const sourceMap = this.generateSourceMap(program, code);

    return { code, sourceMap };
  }

  // ── Import Collection ──

  private collectImports(decl: Declaration): void {
    switch (decl.kind) {
      case "ImportDecl":
        if (decl.from) {
          const names = decl.names ? decl.names.join(", ") : "";
          this.imports.add(`import { ${names} } from "${decl.from}";`);
        } else if (decl.module.length >= 2 && decl.module[0] === "kapy") {
          // kapy stdlib imports → @moikapy/kapy-runtime submodules
          // kapy/http → @moikapy/kapy-runtime/http
          // kapy/ai/chain → @moikapy/kapy-runtime/ai/chain
          // kapy/web/router → @moikapy/kapy-runtime/web/router
          const submodule = decl.module.slice(1).join("/");
          const runtimeModule = `@moikapy/kapy-runtime/${submodule}`;
          if (decl.names && decl.names.length > 0) {
            this.imports.add(`import { ${decl.names.join(", ")} } from "${runtimeModule}";`);
          } else {
            // Default import: use last segment as the local name
            const localName = decl.module[decl.module.length - 1];
            this.imports.add(`import * as ${localName} from "${runtimeModule}";`);
          }
        }
        break;
      case "FnDecl":
        this.collectExprImports(decl.body);
        // Check if function uses print
        const bodyStr = JSON.stringify(decl.body);
        if (bodyStr.includes('"kind":"CallExpr"') || bodyStr.includes('"name":"print"')) {
          this.runtimeImports.add("print");
        }
        break;
      case "AgentDecl":
        this.runtimeImports.add("agent");
        break;
      case "TestDecl":
        this.testImports.add("test");
        this.collectExprImports(decl.body);
        // Check for print/llm/embed/tool calls in test body
        const testBodyStr = JSON.stringify(decl.body);
        if (testBodyStr.includes('"kind":"CallExpr"')) {
          this.runtimeImports.add("print");
        }
        if (testBodyStr.includes('"kind":"ResultUnwrapExpr"') || testBodyStr.includes('"kind":"CrashUnwrapExpr"')) {
          this.runtimeImports.add("Result");
        }
        break;
      default:
        break;
    }
  }

  private collectExprImports(body: Block | Expression): void {
    // Walk the AST looking for feature usage that requires runtime imports
    // This is a simplified version — full implementation would walk all expressions
    const bodyStr = JSON.stringify(body);
    if (bodyStr.includes('"kind":"ResultUnwrapExpr"')) {
      this.runtimeImports.add("Result");
    }
    if (bodyStr.includes('"kind":"CrashUnwrapExpr"')) {
      this.runtimeImports.add("Result");
    }
  }

  // ── Declaration Emission ──

  private emitDeclaration(decl: Declaration): void {
    switch (decl.kind) {
      case "FnDecl":
        this.emitFnDecl(decl);
        break;
      case "AgentDecl":
        this.emitAgentDecl(decl);
        break;
      case "ToolDecl":
        this.emitToolDecl(decl);
        break;
      case "SealedTraitDecl":
        this.emitSealedTrait(decl);
        break;
      case "TraitDecl":
        this.emitTraitDecl(decl);
        break;
      case "ImplDecl":
        this.emitImplDecl(decl);
        break;
      case "TestDecl":
        this.emitTestDecl(decl);
        break;
      case "ImportDecl":
        if (decl.from) {
          // npm import — emit as-is
          this.emitLine(`import { ${(decl.names || []).join(", ")} } from "${decl.from}";`);
        }
        // kapy stdlib imports are handled by collectImports (no duplicate emission)
        break;
    }
  }

  private emitFnDecl(decl: FnDecl): void {
    const params = decl.inputs.map(p => `${p.name}: ${this.emitType(p.type ?? this.anyType)}`).join(", ");
    const returnType = decl.output_type ? this.emitType(decl.output_type) : "void";
    // All kapy-script functions are async (I/O is implicit)
    this.currentKapyLine = decl.span.start.line;
    this.emitLine(`/** Generated from: ${decl.span.start.file}:${decl.span.start.line} */`);
    this.emitLine(`export async function ${decl.name}(${params}): Promise<${returnType}> {`);

    this.indent++;
    this.emitBody(decl.body);
    this.indent--;

    this.emitLine("}");
  }

  private emitAgentDecl(decl: AgentDecl): void {
    const params = decl.inputs.map(p => `${p.name}: ${this.emitType(p.type ?? this.anyType)}`).join(", ");
    const returnType = decl.output_type ? this.emitType(decl.output_type) : "any";
    // Agent: track source line
    this.currentKapyLine = decl.span.start.line;
    this.emitLine(`/** Generated from: ${decl.span.start.file}:${decl.span.start.line} */`);
    this.emitLine(`export async function ${decl.name}(${params}): Promise<${returnType}> {`);
    this.indent++;
    if (decl.tools.length > 0) {
      this.emitLine(`const _ctx = KapyRuntime.createAgent({`);
      this.indent++;
      this.emitLine(`tools: [${decl.tools.map(t => `"${t}"`).join(", ")}],`);
      this.indent--;
      this.emitLine("});");
    }

    if (decl.steps) {
      this.emitBlock(decl.steps);
    } else if (decl.body) {
      this.emitBlock(decl.body);
    }

    this.indent--;
    this.emitLine("}");
  }

  private emitToolDecl(decl: ToolDecl): void {
    const params = decl.inputs.map(p => `${p.name}: ${this.emitType(p.type ?? this.anyType)}`).join(", ");
    const returnType = decl.output_type ? this.emitType(decl.output_type) : "any";
    // Tool: track source line
    this.currentKapyLine = decl.span.start.line;
    this.emitLine(`/** Generated from: ${decl.span.start.file}:${decl.span.start.line} */`);
    this.emitLine(`export async function ${decl.name}(${params}): Promise<${returnType}> {`);

    this.indent++;
    this.emitBody(decl.body);
    this.indent--;

    this.emitLine("}");
  }

  private emitSealedTrait(decl: SealedTraitDecl): void {
    this.emitLine(`// Sealed trait: ${decl.name}`);

    // Generate a discriminated union type
    this.emitLine(`export type ${decl.name} = ${decl.cases.map(c => c.name).join(" | ")};`);
    this.emitLine("");

    // Generate each case as a class/value
    for (const caseVariant of decl.cases) {
      const fields = caseVariant.fields.map(f => `${f.name}: ${this.emitType(f.type ?? this.anyType)}`);
      this.emitLine(`export class ${caseVariant.name} {`);
      this.indent++;
      if (fields.length > 0) {
        this.emitLine(`constructor(public ${fields.join(", public ")}) {}`);
      } else {
        this.emitLine(`constructor() {}`);
      }
      this.indent--;
      this.emitLine("}");
    }
  }

  private emitTraitDecl(decl: TraitDecl): void {
    this.emitLine(`// Trait: ${decl.name}`);
    this.emitLine(`export interface ${decl.name} {`);
    this.indent++;
    for (const method of decl.methods) {
      const params = method.inputs.map(p => `${p.name}: ${this.emitType(p.type ?? this.anyType)}`).join(", ");
      const retType = method.output_type ? this.emitType(method.output_type) : "void";
      this.emitLine(`${method.name}(${params}): ${retType};`);
    }
    this.indent--;
    this.emitLine("}");
  }

  private emitImplDecl(decl: ImplDecl): void {
    this.emitLine(`// Impl: ${decl.trait_name} for ${decl.for_name}`);
    for (const method of decl.methods) {
      const params = method.inputs.map(p => `${p.name}: ${this.emitType(p.type ?? this.anyType)}`).join(", ");
      const retType = method.output_type ? this.emitType(method.output_type) : "void";
      this.emitLine(`export function ${method.name}(${params}): ${retType} {`);
      this.indent++;
      this.emitBody(method.body);
      this.indent--;
      this.emitLine("}");
    }
  }

  private emitTestDecl(decl: TestDecl): void {
    this.emitLine(`test("${decl.name}", async () => {`);
    this.indent++;
    this.emitBlock(decl.body);
    this.indent--;
    this.emitLine("});");
  }

  // ── Body & Block Emission ──

  private emitBody(body: Block | Expression): void {
    if (body.kind === "Block") {
      this.emitBlock(body);
    } else {
      // Single expression body — if it's the output, return it
      // Otherwise just emit as a statement
      this.emitLine(`${this.emitExpression(body)};`);
    }
  }

  private emitBlock(block: Block): void {
    for (const stmt of block.statements) {
      this.emitStatement(stmt);
    }
  }

  private emitStatement(stmt: Statement): void {
    switch (stmt.kind) {
      case "ReturnStmt":
        this.emitLine(`return ${this.emitExpression(stmt.value)};`);
        break;
      case "AssignmentStmt":
        if (stmt.mutable) {
          this.emitLine(`let ${stmt.name} = ${this.emitExpression(stmt.value)};`);
        } else {
          this.emitLine(`const ${stmt.name} = ${this.emitExpression(stmt.value)};`);
        }
        break;
      case "ExpressionStmt":
        this.emitLine(`${this.emitExpression(stmt.expr)};`);
        break;
      case "StepStmt":
        if (stmt.binding) {
          this.emitLine(`const ${stmt.binding} = ${this.emitExpression(stmt.expr)};`);
        } else {
          this.emitLine(`${this.emitExpression(stmt.expr)};`);
        }
        break;
    }
  }

  // ── Expression Emission ──

  private emitExpression(expr: Expression): string {
    switch (expr.kind) {
      case "NumberLiteral":
        return String(expr.value);

      case "StringLiteral":
        return JSON.stringify(expr.value);

      case "BooleanLiteral":
        return expr.value ? "true" : "false";

      case "ArrayLiteral":
        return `[${expr.elements.map(e => this.emitExpression(e)).join(", ")}]`;

      case "RecordLiteral":
        return `{ ${expr.fields.map(f => `${f.key}: ${this.emitExpression(f.value)}`).join(", ")} }`;

      case "Identifier":
        return expr.name;

      case "InterpolatedString": {
        const parts = expr.parts.map(p => {
          if ("text" in p) {
            // Escape for template literal context
            let escaped = p.text
              .replace(/`/g, "\\`")       // escape backticks
              .replace(/\$\{/g, "\\${");  // escape template interpolation
            return escaped;
          }
          return `\${${p.expr}}`;
        });
        return `\`${parts.join("")}\``;
      }

      case "BinaryExpr": {
        const left = this.emitExpression(expr.left);
        const right = this.emitExpression(expr.right);
        return `${left} ${expr.op} ${right}`;
      }

      case "UnaryExpr":
        return `${expr.op}${this.emitExpression(expr.operand)}`;

      case "CallExpr": {
        const callee = this.emitExpression(expr.callee);
        const args = expr.args.map(a => this.emitExpression(a)).join(", ");
        // All function calls are async in kapy-script
        return `await ${callee}(${args})`;
      }

      case "MemberExpr":
        return `${this.emitExpression(expr.object)}.${expr.property}`;

      case "IndexExpr":
        return `${this.emitExpression(expr.object)}[${this.emitExpression(expr.index)}]`;

      case "PipelineExpr": {
        // Pipeline: left |> right → right(left)
        // For v0.1: chain as nested calls
        let result = this.emitExpression(expr.stages[0]);
        for (let i = 1; i < expr.stages.length; i++) {
          const stage = expr.stages[i];
          result = `await ${this.emitExpression(stage)}(${result})`;
        }
        return result;
      }

      case "MatchExpr": {
        const subject = this.emitExpression(expr.subject);
        const cases = expr.cases.map(c => {
          const pattern = this.emitPattern(c.pattern, subject);
          const body = c.body.kind === "Block"
            ? this.emitMatchBody(c.body)
            : this.emitExpression(c.body);
          return `${pattern} {\n    return ${body};\n  }`;
        }).join("\n  ");

        return `(() => {\n  switch (${subject}) {\n  ${cases}\n  default: throw new Error("Non-exhaustive match");\n  }\n})()`;
      }

      case "IfExpr": {
        // if/else is an expression in kapy-script — emit as IIFE
        const condition = this.emitExpression(expr.condition);
        const thenBody = this.emitBlockAsReturnBody(expr.then_branch);
        let ifCode = `if (${condition}) {\n    ${thenBody}\n  }`;

        if (expr.else_branch) {
          if (expr.else_branch.kind === "IfExpr") {
            ifCode += ` else ${this.emitExpression(expr.else_branch)}`;
          } else {
            const elseBody = this.emitBlockAsReturnBody(expr.else_branch as Block);
            ifCode += ` else {\n    ${elseBody}\n  }`;
          }
        }

        return `(() => {\n  ${ifCode}\n})()`;
      }

      case "ForExpr": {
        const iterable = this.emitExpression(expr.iterable);
        const body = expr.body.statements.map(s => this.emitStatement_ts(s)).join("\n    ");
        return `for (const ${expr.variable} of ${iterable}) {\n    ${body}\n  }`;
      }

      case "WhileExpr": {
        const condition = this.emitExpression(expr.condition);
        const body = expr.body.statements.map(s => this.emitStatement_ts(s)).join("\n    ");
        return `while (${condition}) {\n    ${body}\n  }`;
      }

      case "ParallelExpr": {
        const assignments = expr.assignments.map(a => `${a.name}: ${this.emitExpression(a.value)}`);
        this.runtimeImports.add("parallel");
        return `await KapyRuntime.parallel({ ${assignments.join(", ")} })`;
      }

      case "WithExpr": {
        const body = expr.body.statements.map(s => this.emitStatement_ts(s)).join("\n    ");
        if (expr.kind_type === "timeout") {
          const ms = expr.args[0] ? this.emitExpression(expr.args[0]) : "30000";
          return `await KapyRuntime.withTimeout(${ms}, async () => {\n    ${body}\n  })`;
        }
        return `// with block\n{\n    ${body}\n  }`;
      }

      case "LambdaExpr": {
        const params = expr.params.map(p => p.name).join(", ");
        return `(${params}) => ${this.emitExpression(expr.body)}`;
      }

      case "ResultUnwrapExpr":
        this.runtimeImports.add("Result");
        return `${this.emitExpression(expr.expr)}.unwrap()`;

      case "CrashUnwrapExpr":
        this.runtimeImports.add("Result");
        return `${this.emitExpression(expr.expr)}.unwrapOrCrash()`;
    }
  }

  private emitMatchBody(body: Block | Expression): string {
    if (body.kind === "Block") {
      // Return the last expression from the block
      const stmts = body.statements;
      if (stmts.length === 0) return "undefined";
      const last = stmts[stmts.length - 1];
      if (last.kind === "ExpressionStmt") {
        return this.emitExpression(last.expr);
      }
      if (last.kind === "ReturnStmt") {
        return this.emitExpression(last.value);
      }
      return "undefined";
    }
    return this.emitExpression(body);
  }

  private emitStatement_ts(stmt: Statement): string {
    switch (stmt.kind) {
      case "ReturnStmt":
        return `return ${this.emitExpression(stmt.value)};`;
      case "AssignmentStmt":
        if (stmt.mutable) {
          return `let ${stmt.name} = ${this.emitExpression(stmt.value)};`;
        }
        return `const ${stmt.name} = ${this.emitExpression(stmt.value)};`;
      case "ExpressionStmt":
        return `${this.emitExpression(stmt.expr)};`;
      case "StepStmt":
        if (stmt.binding) {
          return `const ${stmt.binding} = ${this.emitExpression(stmt.expr)};`;
        }
        return `${this.emitExpression(stmt.expr)};`;
    }
  }

  /** Emit a block's statements with the last expression as a return value.
   *  Used inside IIFEs where the block result must be returned. */
  private emitBlockAsReturnBody(block: Block): string {
    const stmts = block.statements;
    if (stmts.length === 0) return "return undefined;";
    const lines = stmts.slice(0, -1).map(s => this.emitStatement_ts(s));
    const last = stmts[stmts.length - 1];
    // Last statement becomes the return value
    if (last.kind === "ExpressionStmt") {
      lines.push(`return ${this.emitExpression(last.expr)};`);
    } else if (last.kind === "ReturnStmt") {
      lines.push(`return ${this.emitExpression(last.value)};`);
    } else {
      lines.push(this.emitStatement_ts(last));
    }
    return lines.join("\n    ");
  }

  private emitPattern(pattern: Pattern, _subject: string): string {
    switch (pattern.kind) {
      case "WildcardPattern":
        return "default";
      case "IdentifierPattern":
        return `case ${pattern.name}:`;
      case "LiteralPattern":
        return `case ${JSON.stringify(pattern.value)}:`;
      case "DestructurePattern": {
        const fields = pattern.fields.map((f, i) => {
          if (f.kind === "IdentifierPattern") return f.name;
          return `_${i}`;
        });
        return `// ${pattern.name}(${fields.join(", ")})`;
      }
      case "TuplePattern":
        return `// tuple pattern`;
    }
  }

  // ── Type Emission ──

  private emitType(type: KapyType): string {
    switch (type.kind) {
      case "PrimitiveType":
        return type.name;
      case "NamedType":
        return type.name;
      case "ArrayType":
        return `${this.emitType(type.element_type)}[]`;
      case "GenericType":
        return `${type.name}<${type.type_args.map(t => this.emitType(t)).join(", ")}>`;
      case "RecordType":
        return `{ ${type.fields.map(f => `${f.name}: ${this.emitType(f.type)}`).join("; ")} }`;
      case "FunctionType":
        return `(${type.params.map(t => this.emitType(t)).join(", ")}) => ${this.emitType(type.return_type)}`;
      case "UnionType":
        return type.types.map(t => this.emitType(t)).join(" | ");
      case "NullableType":
        return `${this.emitType(type.inner)} | null`;
    }
  }

  // ── Helpers ──

  // @ts-expect-error — v0.1: unused, planned for future use
  private _needsAsync(body: Block | Expression): boolean {
    const str = JSON.stringify(body);
    return str.includes('"kind":"CallExpr"') ||
           str.includes('"kind":"ParallelExpr"') ||
           str.includes('"kind":"ForExpr"') ||
           str.includes('"kind":"WhileExpr"') ||
           str.includes('"kind":"IfExpr"');
    // Conservative: most functions will be async since I/O is common
  }

  private emitLine(line: string): void {
    this.sourceMapLines.set(this.output.length + 1, this.currentKapyLine);
    this.output.push("  ".repeat(this.indent) + line);
  }

  private generateSourceMap(program: Program, code: string): string {
    // Generate a v3 source map mapping TS lines back to .kapy lines
    const kapyFile = program.file || "unknown.kapy";
    const lines = code.split("\n");

    // Build VLQ mappings — each segment maps a TS line to a .kapy line
    let mappings = "";
    let prevKapyLine = 0;

    for (let tsLine = 0; tsLine < lines.length; tsLine++) {
      if (tsLine > 0) mappings += ";";
      const kapyLine = this.sourceMapLines.get(tsLine + 1); // 1-indexed
      if (kapyLine !== undefined) {
        // Segment: column 0 TS -> column 0 kapy, relative encoding
        const lineDelta = kapyLine - 1 - prevKapyLine;
        mappings += "AAAA" + vlqEncode(lineDelta);
        prevKapyLine = kapyLine - 1;
      }
      // Lines without a mapping are empty segments
    }

    return JSON.stringify({
      version: 3,
      sources: [kapyFile],
      sourcesContent: [this.originalSource],
      names: [],
      mappings,
      file: "",
    });
  }
}

/** VLQ encode a number for source maps */
function vlqEncode(value: number): string {
  let v = value < 0 ? ((-value) << 1) | 1 : value << 1;
  let result = "";
  do {
    let digit = v & 0x1F;
    v >>>= 5;
    if (v > 0) digit |= 0x20;
    result += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[digit];
  } while (v > 0);
  return result;
}