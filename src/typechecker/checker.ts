// Kapy-script Type Checker — v0.1
// Local type inference, primitive types, basic ADTs, error reporting

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
  type PrimitiveType,
  type NamedType,
  type ArrayType,
  type GenericType,
  type RecordType,
  type FunctionType,
  type Pattern,
  type BinaryExpr,
} from "../parser/ast";
import { TypeCheckError } from "./errors";

// ── Type Environment ──

/** A scope mapping names to types */
export class TypeEnv {
  private bindings: Map<string, KapyType>;
  private parent: TypeEnv | null;

  constructor(parent: TypeEnv | null = null) {
    this.bindings = new Map();
    this.parent = parent;
  }

  define(name: string, type: KapyType): void {
    this.bindings.set(name, type);
  }

  lookup(name: string): KapyType | undefined {
    const found = this.bindings.get(name);
    if (found) return found;
    if (this.parent) return this.parent.lookup(name);
    return undefined;
  }

  child(): TypeEnv {
    return new TypeEnv(this);
  }
}

// ── Type Utilities ──

/** Built-in primitive types */
const PRIMITIVE_TYPES = new Set(["string", "number", "boolean", "any", "void"]);

/** Built-in generic types and their arity */
const BUILTIN_GENERICS: Record<string, number> = {
  Result: 2,
  List: 1,
  Map: 2,
  Option: 1,
};

/** Check if two types are compatible (v0.1: structural equality, with 'any' coercion) */
export function typesCompatible(expected: KapyType, actual: KapyType): boolean {
  // 'any' is compatible with everything
  if (isAny(expected) || isAny(actual)) return true;

  // Same primitive type
  if (expected.kind === "PrimitiveType" && actual.kind === "PrimitiveType") {
    return expected.name === actual.name;
  }

  // Both named types
  if (expected.kind === "NamedType" && actual.kind === "NamedType") {
    return expected.name === actual.name;
  }

  // Array types: element types must be compatible
  if (expected.kind === "ArrayType" && actual.kind === "ArrayType") {
    return typesCompatible(expected.element_type, actual.element_type);
  }

  // Generic types: name and args must match
  if (expected.kind === "GenericType" && actual.kind === "GenericType") {
    if (expected.name !== actual.name) return false;
    if (expected.type_args.length !== actual.type_args.length) return false;
    return expected.type_args.every((t, i) => typesCompatible(t, actual.type_args[i]));
  }

  // Different kind shapes are incompatible
  if (expected.kind !== actual.kind) return false;

  return false;
}

function isAny(t: KapyType): boolean {
  return t.kind === "PrimitiveType" && t.name === "any";
}

/** Get a human-readable name for a type */
export function typeName(t: KapyType): string {
  switch (t.kind) {
    case "PrimitiveType": return t.name;
    case "NamedType": return t.name;
    case "ArrayType": return `${typeName(t.element_type)}[]`;
    case "GenericType": return `${t.name}[${t.type_args.map(typeName).join(", ")}]`;
    case "RecordType": return `{ ${t.fields.map(f => `${f.name}: ${typeName(f.type)}`).join(", ")} }`;
    case "FunctionType": return `(${t.params.map(typeName).join(", ")}) => ${typeName(t.return_type)}`;
    case "UnionType": return t.types.map(typeName).join(" | ");
    case "NullableType": return `${typeName(t.inner)}?`;
  }
}

// ── Type Checker ──

export class TypeChecker {
  private errors: TypeCheckError[] = [];
  private env: TypeEnv;
  private sealedTraits: Map<string, SealedTraitDecl> = new Map();
  private functionSignatures: Map<string, FnDecl> = new Map();
  private currentFunction: FnDecl | null = null;

  constructor() {
    this.env = new TypeEnv();
    this.registerBuiltins();
  }

  private registerBuiltins(): void {
    // Built-in functions
    this.env.define("print", this.fnType([this.primitive("any")], this.primitive("void")));
    this.env.define("llm", this.fnType([this.primitive("string"), this.primitive("any")], this.generic("Result", [this.primitive("any"), this.primitive("string")])));
    this.env.define("embed", this.fnType([this.primitive("string")], this.generic("Result", [this.named("number[]"), this.primitive("string")])));

    // Built-in Result constructors
    this.env.define("Ok", this.fnType([this.primitive("any")], this.generic("Result", [this.primitive("any"), this.primitive("string")])));
    this.env.define("Err", this.fnType([this.primitive("string")], this.generic("Result", [this.primitive("any"), this.primitive("string")])));

    // Built-in helper functions
    this.env.define("ok", this.fnType([this.primitive("any")], this.generic("Result", [this.primitive("any"), this.primitive("string")])));
    this.env.define("err", this.fnType([this.primitive("string")], this.generic("Result", [this.primitive("any"), this.primitive("string")])));

    // HTTP and fs will be available via stdlib imports — not builtins in checker
  }

  /** Check an entire program. Returns all type errors found. */
  check(program: Program): TypeCheckError[] {
    this.errors = [];

    // First pass: register all top-level declarations
    for (const decl of program.declarations) {
      this.registerDeclaration(decl);
    }

    // Second pass: type-check all declarations
    for (const decl of program.declarations) {
      this.checkDeclaration(decl);
    }

    return this.errors;
  }

  private registerDeclaration(decl: Declaration): void {
    switch (decl.kind) {
      case "FnDecl":
        this.functionSignatures.set(decl.name, decl);
        break;
      case "SealedTraitDecl":
        this.sealedTraits.set(decl.name, decl);
        break;
      case "AgentDecl":
      case "ToolDecl":
        // Register as callable entities
        this.functionSignatures.set(decl.name, this.agentToFnDecl(decl));
        break;
      case "TraitDecl":
      case "ImplDecl":
      case "TestDecl":
      case "ImportDecl":
        // These don't register into the function namespace directly
        break;
    }
  }

  private agentToFnDecl(decl: AgentDecl | ToolDecl): FnDecl {
    return {
      kind: "FnDecl",
      name: decl.name,
      inputs: decl.inputs,
      output_type: decl.output_type,
      body: { kind: "Block", statements: [], span: decl.span },
      span: decl.span,
    };
  }

  // ── Declaration Checking ──

  private checkDeclaration(decl: Declaration): void {
    switch (decl.kind) {
      case "FnDecl":
        this.checkFnDecl(decl);
        break;
      case "SealedTraitDecl":
        this.checkSealedTrait(decl);
        break;
      case "AgentDecl":
        this.checkAgentDecl(decl);
        break;
      case "ToolDecl":
        this.checkToolDecl(decl);
        break;
      case "TraitDecl":
        this.checkTraitDecl(decl);
        break;
      case "ImplDecl":
        this.checkImplDecl(decl);
        break;
      case "TestDecl":
        this.checkTestDecl(decl);
        break;
      case "ImportDecl":
        // v0.1: imports are unchecked (stdlib not implemented yet)
        break;
    }
  }

  private checkFnDecl(decl: FnDecl): void {
    this.currentFunction = decl;

    // Validate declared types
    for (const param of decl.inputs) {
      if (param.type) this.validateType(param.type);
    }
    if (decl.output_type) this.validateType(decl.output_type);

    // Create function scope with parameters
    const fnEnv = this.env.child();
    for (const param of decl.inputs) {
      const paramType = param.type ?? this.primitive("any");
      fnEnv.define(param.name, paramType);
    }

    // Check the body
    const savedEnv = this.env;
    this.env = fnEnv;

    const bodyType = decl.body.kind === "Block"
      ? this.checkBlock(decl.body)
      : this.checkExpression(decl.body);

    this.env = savedEnv;

    // Check return type matches declaration
    if (decl.output_type && !isAny(decl.output_type) && !isAny(bodyType)) {
      if (!typesCompatible(decl.output_type, bodyType)) {
        this.error(
          decl.span.start.line,
          decl.span.start.column,
          `Function '${decl.name}' declares return type '${typeName(decl.output_type)}' but body evaluates to '${typeName(bodyType)}'.`,
        );
      }
    }

    this.currentFunction = null;
  }

  private checkSealedTrait(decl: SealedTraitDecl): void {
    // Register all case constructors in the environment
    for (const caseVariant of decl.cases) {
      // Each case constructor is a function that takes the fields as arguments
      const paramTypes: KapyType[] = caseVariant.fields.map(f => f.type ?? this.primitive("any"));
      const returnType = this.named(decl.name);
      this.env.define(caseVariant.name, this.fnType(paramTypes, returnType));

      // Check that case field types are valid
      for (const field of caseVariant.fields) {
        if (field.type) {
          this.validateType(field.type);
        }
      }
    }

    // Register the sealed trait type itself
    this.env.define(decl.name, this.named(decl.name));
  }

  private checkAgentDecl(decl: AgentDecl): void {
    const agentEnv = this.env.child();
    for (const param of decl.inputs) {
      agentEnv.define(param.name, param.type ?? this.primitive("any"));
    }

    // Register tool names as available functions
    for (const tool of decl.tools) {
      if (!this.env.lookup(tool)) {
        agentEnv.define(tool, this.fnType([this.primitive("any")], this.primitive("any")));
      }
    }

    // Register think as a builtin in agent scope
    agentEnv.define("think", this.fnType([this.primitive("any")], this.primitive("any")));

    const savedEnv = this.env;
    this.env = agentEnv;

    if (decl.steps) {
      this.checkBlock(decl.steps);
    } else if (decl.body) {
      this.checkBlock(decl.body);
    }

    this.env = savedEnv;
  }

  private checkToolDecl(decl: ToolDecl): void {
    const toolEnv = this.env.child();
    for (const param of decl.inputs) {
      toolEnv.define(param.name, param.type ?? this.primitive("any"));
    }

    const savedEnv = this.env;
    this.env = toolEnv;

    if (decl.body.kind === "Block") {
      this.checkBlock(decl.body);
    } else {
      this.checkExpression(decl.body);
    }

    this.env = savedEnv;
  }

  private checkTraitDecl(decl: TraitDecl): void {
    for (const method of decl.methods) {
      this.checkFnDecl(method);
    }
  }

  private checkImplDecl(decl: ImplDecl): void {
    // Verify the trait exists
    const traitType = this.env.lookup(decl.trait_name);
    if (!traitType) {
      this.error(
        decl.span.start.line,
        decl.span.start.column,
        `Trait '${decl.trait_name}' is not defined. Did you forget to declare it?`,
      );
    }

    // Check all methods
    for (const method of decl.methods) {
      this.checkFnDecl(method);
    }
  }

  private checkTestDecl(decl: TestDecl): void {
    const testEnv = this.env.child();

    // Register mock_llm, mock_embed, mock_tool in test scope
    testEnv.define("mock_llm", this.primitive("any"));

    const savedEnv = this.env;
    this.env = testEnv;
    this.checkBlock(decl.body);
    this.env = savedEnv;
  }

  // ── Block & Statement Checking ──

  private checkBlock(block: Block): KapyType {
    let lastType: KapyType = this.primitive("void");

    for (const stmt of block.statements) {
      lastType = this.checkStatement(stmt);
    }

    return lastType;
  }

  private checkStatement(stmt: Statement): KapyType {
    switch (stmt.kind) {
      case "ReturnStmt": {
        const valueType = this.checkExpression(stmt.value);
        if (this.currentFunction?.output_type && !isAny(this.currentFunction.output_type)) {
          if (!typesCompatible(this.currentFunction.output_type, valueType)) {
            this.error(
              stmt.value.span.start.line,
              stmt.value.span.start.column,
              `Return type '${typeName(valueType)}' is not compatible with function return type '${typeName(this.currentFunction.output_type)}'.`,
            );
          }
        }
        return this.primitive("void");
      }

      case "AssignmentStmt": {
        const valueType = this.checkExpression(stmt.value);
        // Check if variable already exists with incompatible type
        const existing = this.env.lookup(stmt.name);
        if (existing && !isAny(existing) && !typesCompatible(existing, valueType)) {
          this.error(
            stmt.span.start.line,
            stmt.span.start.column,
            `Cannot assign '${typeName(valueType)}' to variable '${stmt.name}' of type '${typeName(existing)}'.`,
          );
        }
        this.env.define(stmt.name, valueType);
        return valueType;
      }

      case "ExpressionStmt":
        return this.checkExpression(stmt.expr);

      case "StepStmt": {
        const exprType = this.checkExpression(stmt.expr);
        if (stmt.binding) {
          this.env.define(stmt.binding, exprType);
        }
        return exprType;
      }
    }
  }

  // ── Expression Type Checking ──

  private checkExpression(expr: Expression): KapyType {
    switch (expr.kind) {
      case "NumberLiteral":
        return this.primitive("number");

      case "StringLiteral":
        return this.primitive("string");

      case "BooleanLiteral":
        return this.primitive("boolean");

      case "Identifier": {
        const type = this.env.lookup(expr.name);
        if (!type) {
          this.error(
            expr.span.start.line,
            expr.span.start.column,
            `Undefined variable '${expr.name}'.`,
          );
          return this.primitive("any");
        }
        return type;
      }

      case "InterpolatedString":
        return this.primitive("string");

      case "ArrayLiteral": {
        if (expr.elements.length === 0) return this.arrayOf(this.primitive("any"));

        const elementTypes = expr.elements.map(e => this.checkExpression(e));

        // Check all elements have compatible types
        const firstType = elementTypes[0];
        for (let i = 1; i < elementTypes.length; i++) {
          if (!typesCompatible(firstType, elementTypes[i]) && !isAny(elementTypes[i])) {
            this.error(
              expr.elements[i].span.start.line,
              expr.elements[i].span.start.column,
              `Array element type '${typeName(elementTypes[i])}' is not compatible with '${typeName(firstType)}'.`,
            );
          }
        }

        return this.arrayOf(firstType);
      }

      case "RecordLiteral": {
        const fields: RecordType["fields"] = expr.fields.map(f => ({
          name: f.key,
          type: this.checkExpression(f.value),
          span: f.span,
        }));
        return { kind: "RecordType", fields, span: expr.span };
      }

      case "BinaryExpr": {
        const leftType = this.checkExpression(expr.left);
        const rightType = this.checkExpression(expr.right);

        switch (expr.op) {
          case "+":
            if (leftType.kind === "PrimitiveType" && leftType.name === "string") {
              return this.primitive("string"); // string concatenation
            }
            this.checkBinaryOperands(expr.op, leftType, rightType, expr);
            return this.primitive("number");
          case "-": case "*": case "/": case "%":
            this.checkBinaryOperands(expr.op, leftType, rightType, expr);
            return this.primitive("number");
          case "==": case "!=":
            return this.primitive("boolean");
          case "<": case ">": case "<=": case ">=":
            return this.primitive("boolean");
          case "&&": case "||":
            return this.primitive("boolean");
          default:
            return this.primitive("any");
        }
      }

      case "UnaryExpr": {
        const operandType = this.checkExpression(expr.operand);
        switch (expr.op) {
          case "!":
            return this.primitive("boolean");
          case "-":
            if (!this.isNumeric(operandType) && !isAny(operandType)) {
              this.error(
                expr.operand.span.start.line,
                expr.operand.span.start.column,
                `Unary '-' requires a number, got '${typeName(operandType)}'.`,
              );
            }
            return this.primitive("number");
          default:
            return this.primitive("any");
        }
      }

      case "CallExpr": {
        // Special handling for known functions
        const calleeType = this.checkExpression(expr.callee);

        // Check argument types
        const argTypes = expr.args.map(a => this.checkExpression(a));

        // If callee type is a function type, check arg compatibility
        if (calleeType.kind === "FunctionType") {
          const fnType = calleeType as FunctionType;
          if (fnType.params.length !== argTypes.length) {
            this.error(
              expr.span.start.line,
              expr.span.start.column,
              `Function expects ${fnType.params.length} argument(s), got ${argTypes.length}.`,
            );
          } else {
            for (let i = 0; i < Math.min(fnType.params.length, argTypes.length); i++) {
              if (!typesCompatible(fnType.params[i], argTypes[i])) {
                this.error(
                  expr.args[i]?.span.start.line ?? expr.span.start.line,
                  expr.args[i]?.span.start.column ?? expr.span.start.column,
                  `Argument ${i + 1}: expected '${typeName(fnType.params[i])}', got '${typeName(argTypes[i])}'.`,
                );
              }
            }
          }
          return fnType.return_type;
        }

        // If callee is unknown or 'any', return 'any'
        if (isAny(calleeType)) return this.primitive("any");

        // If calling a named type (like a constructor), look up the function signature
        if (expr.callee.kind === "Identifier") {
          const fnSig = this.functionSignatures.get(expr.callee.name);
          if (fnSig) {
            const paramTypes = fnSig.inputs.map(p => p.type ?? this.primitive("any"));
            for (let i = 0; i < Math.min(paramTypes.length, argTypes.length); i++) {
              if (!typesCompatible(paramTypes[i], argTypes[i])) {
                this.error(
                  expr.args[i]?.span.start.line ?? expr.span.start.line,
                  expr.args[i]?.span.start.column ?? expr.span.start.column,
                  `Argument ${i + 1} of '${expr.callee.name}': expected '${typeName(paramTypes[i])}', got '${typeName(argTypes[i])}'.`,
                );
              }
            }
            return fnSig.output_type ?? this.primitive("any");
          }
        }

        return this.primitive("any");
      }

      case "MemberExpr": {
        this.checkExpression(expr.object);
        // v0.1: member access on 'any' or record types returns 'any'
        return this.primitive("any");
      }

      case "IndexExpr": {
        const objType = this.checkExpression(expr.object);
        this.checkExpression(expr.index);
        // v0.1: array indexing returns element type or any
        if (objType.kind === "ArrayType") return objType.element_type;
        return this.primitive("any");
      }

      case "PipelineExpr": {
        // Pipeline: each stage's output feeds into the next
        let currentType: KapyType = this.primitive("any");
        for (const stage of expr.stages) {
          currentType = this.checkExpression(stage);
        }
        return currentType;
      }

      case "MatchExpr": {
        const subjectType = this.checkExpression(expr.subject);
        let resultType: KapyType | null = null;

        for (const case_ of expr.cases) {
          this.checkPattern(case_.pattern, subjectType);
          const caseBodyType = case_.body.kind === "Block"
            ? this.checkBlock(case_.body)
            : this.checkExpression(case_.body);

          if (!resultType) {
            resultType = caseBodyType;
          } else if (!typesCompatible(resultType, caseBodyType) && !isAny(caseBodyType)) {
            this.error(
              case_.span.start.line,
              case_.span.start.column,
              `Match case has type '${typeName(caseBodyType)}', but previous cases have type '${typeName(resultType)}'.`,
            );
          }
        }

        return resultType ?? this.primitive("any");
      }

      case "IfExpr": {
        const condType = this.checkExpression(expr.condition);
        if (!this.isBoolean(condType) && !isAny(condType)) {
          this.error(
            expr.condition.span.start.line,
            expr.condition.span.start.column,
            `If condition must be boolean, got '${typeName(condType)}'.`,
          );
        }

        const thenType = this.checkBlock(expr.then_branch);
        const elseType = expr.else_branch
          ? (expr.else_branch.kind === "Block" ? this.checkBlock(expr.else_branch) : this.checkExpression(expr.else_branch))
          : this.primitive("void");

        if (expr.else_branch && !typesCompatible(thenType, elseType) && !isAny(elseType)) {
          // Warning only — some mismatch is OK with 'any'
        }

        return expr.else_branch ? thenType : this.primitive("void");
      }

      case "ForExpr": {
        const iterableType = this.checkExpression(expr.iterable);
        const loopEnv = this.env.child();

        // Infer element type from iterable
        const elementType = iterableType.kind === "ArrayType"
          ? iterableType.element_type
          : this.primitive("any");

        loopEnv.define(expr.variable, elementType);

        const savedEnv = this.env;
        this.env = loopEnv;
        this.checkBlock(expr.body);
        this.env = savedEnv;

        return this.primitive("void");
      }

      case "WhileExpr": {
        const condType = this.checkExpression(expr.condition);
        if (!this.isBoolean(condType) && !isAny(condType)) {
          this.error(
            expr.condition.span.start.line,
            expr.condition.span.start.column,
            `While condition must be boolean, got '${typeName(condType)}'.`,
          );
        }
        this.checkBlock(expr.body);
        return this.primitive("void");
      }

      case "ParallelExpr": {
        const parallelEnv = this.env.child();
        for (const assignment of expr.assignments) {
          const valueType = this.checkExpression(assignment.value);
          parallelEnv.define(assignment.name, valueType);
        }
        const savedEnv = this.env;
        this.env = parallelEnv;
        // Return the last assignment type as the parallel block type
        const lastType = expr.assignments.length > 0
          ? parallelEnv.lookup(expr.assignments[expr.assignments.length - 1].name)!
          : this.primitive("void");
        this.env = savedEnv;
        return lastType;
      }

      case "WithExpr": {
        // with blocks: check args and body
        for (const arg of expr.args) {
          this.checkExpression(arg);
        }
        this.checkBlock(expr.body);
        return this.primitive("void");
      }

      case "LambdaExpr": {
        const lambdaEnv = this.env.child();
        const paramTypes: KapyType[] = [];
        for (const param of expr.params) {
          const paramType = param.type ?? this.primitive("any");
          lambdaEnv.define(param.name, paramType);
          paramTypes.push(paramType);
        }

        const savedEnv = this.env;
        this.env = lambdaEnv;
        const bodyType = this.checkExpression(expr.body);
        this.env = savedEnv;

        return { kind: "FunctionType", params: paramTypes, return_type: bodyType, span: expr.span };
      }

      case "ResultUnwrapExpr": {
        const innerType = this.checkExpression(expr.expr);
        // ? operator: if inner is Result[T, E], unwrap to T; otherwise error
        if (innerType.kind === "GenericType" && innerType.name === "Result") {
          return innerType.type_args[0] ?? this.primitive("any");
        }
        // v0.1: if we can't determine the type, allow it but warn
        return this.primitive("any");
      }

      case "CrashUnwrapExpr": {
        const innerType = this.checkExpression(expr.expr);
        if (innerType.kind === "GenericType" && innerType.name === "Result") {
          return innerType.type_args[0] ?? this.primitive("any");
        }
        return this.primitive("any");
      }
    }
  }

  // ── Pattern Checking ──

  private checkPattern(pattern: Pattern, subjectType: KapyType): void {
    switch (pattern.kind) {
      case "WildcardPattern":
        // Always matches
        break;

      case "IdentifierPattern": {
        // Bind the matched value to this name
        this.env.define(pattern.name, subjectType);
        break;
      }

      case "LiteralPattern":
        // Literal patterns match constants — just check type compatibility
        break;

      case "DestructurePattern": {
        // TypeScript narrowing: pattern is DestructurePattern here
        const destructure = pattern;
        // Check that the subject type has this variant
        if (subjectType.kind === "NamedType") {
          const sealedTrait = this.sealedTraits.get(subjectType.name);
          if (sealedTrait) {
            const variant = sealedTrait.cases.find(c => c.name === destructure.name);
            if (!variant) {
              this.error(
                destructure.span.start.line,
                destructure.span.start.column,
                `Sealed trait '${subjectType.name}' has no case '${destructure.name}'. Valid cases: ${sealedTrait.cases.map(c => c.name).join(", ")}`,
              );
            } else {
              // Register destructured fields in scope
              for (let i = 0; i < Math.min(destructure.fields.length, variant.fields.length); i++) {
                const field = variant.fields[i];
                if (field.type) {
                  this.validateType(field.type);
                  const subPattern = destructure.fields[i];
                  if (subPattern.kind === "IdentifierPattern") {
                    this.env.define(subPattern.name, field.type);
                  }
                }
              }
            }
          }
        }
        break;
      }

      case "TuplePattern":
        // v0.1: no type checking for tuple patterns yet
        break;
    }
  }

  // ── Type Validation ──

  private validateType(type: KapyType): void {
    switch (type.kind) {
      case "PrimitiveType":
        if (!PRIMITIVE_TYPES.has(type.name)) {
          this.error(
            type.span.start.line,
            type.span.start.column,
            `Unknown primitive type '${type.name}'. Did you mean 'string', 'number', 'boolean', 'any', or 'void'?`,
          );
        }
        break;

      case "NamedType": {
        const defined = this.env.lookup(type.name) || this.sealedTraits.has(type.name);
        if (!defined && !PRIMITIVE_TYPES.has(type.name)) {
          // v0.1: allow unknown named types (they might be defined later or imported)
          // This is a soft check — we don't error on unknown types in v0.1
        }
        break;
      }

      case "ArrayType":
        this.validateType(type.element_type);
        break;

      case "GenericType":
        if (!BUILTIN_GENERICS[type.name] && !this.sealedTraits.has(type.name)) {
          // v0.1: soft check
        }
        for (const arg of type.type_args) {
          this.validateType(arg);
        }
        break;

      case "RecordType":
        for (const field of type.fields) {
          this.validateType(field.type);
        }
        break;

      case "FunctionType":
        for (const param of type.params) {
          this.validateType(param);
        }
        this.validateType(type.return_type);
        break;

      case "UnionType":
        for (const t of type.types) {
          this.validateType(t);
        }
        break;

      case "NullableType":
        this.validateType(type.inner);
        break;
    }
  }

  // ── Helpers ──

  private checkBinaryOperands(op: string, left: KapyType, right: KapyType, expr: BinaryExpr): void {
    if (!this.isNumeric(left) && !isAny(left)) {
      this.error(
        expr.left.span.start.line,
        expr.left.span.start.column,
        `Operator '${op}' requires number operands, got '${typeName(left)}' on the left.`,
      );
    }
    if (!this.isNumeric(right) && !isAny(right)) {
      this.error(
        expr.right.span.start.line,
        expr.right.span.start.column,
        `Operator '${op}' requires number operands, got '${typeName(right)}' on the right.`,
      );
    }
  }

  private isNumeric(t: KapyType): boolean {
    return t.kind === "PrimitiveType" && t.name === "number";
  }

  private isBoolean(t: KapyType): boolean {
    return t.kind === "PrimitiveType" && t.name === "boolean";
  }

  private primitive(name: "string" | "number" | "boolean" | "any" | "void"): PrimitiveType {
    // Create a minimal PrimitiveType — span is synthetic for builtins
    return {
      kind: "PrimitiveType",
      name,
      span: { start: { line: 0, column: 0, offset: 0, length: 0, file: "<builtin>" }, end: { line: 0, column: 0, offset: 0, length: 0, file: "<builtin>" } },
    };
  }

  private named(name: string): NamedType {
    return {
      kind: "NamedType",
      name,
      span: { start: { line: 0, column: 0, offset: 0, length: 0, file: "<builtin>" }, end: { line: 0, column: 0, offset: 0, length: 0, file: "<builtin>" } },
    };
  }

  private arrayOf(elementType: KapyType): ArrayType {
    return {
      kind: "ArrayType",
      element_type: elementType,
      span: { start: { line: 0, column: 0, offset: 0, length: 0, file: "<builtin>" }, end: { line: 0, column: 0, offset: 0, length: 0, file: "<builtin>" } },
    };
  }

  private generic(name: string, typeArgs: KapyType[]): GenericType {
    return {
      kind: "GenericType",
      name,
      type_args: typeArgs,
      span: { start: { line: 0, column: 0, offset: 0, length: 0, file: "<builtin>" }, end: { line: 0, column: 0, offset: 0, length: 0, file: "<builtin>" } },
    };
  }

  private fnType(params: KapyType[], returnType: KapyType): FunctionType {
    return {
      kind: "FunctionType",
      params,
      return_type: returnType,
      span: { start: { line: 0, column: 0, offset: 0, length: 0, file: "<builtin>" }, end: { line: 0, column: 0, offset: 0, length: 0, file: "<builtin>" } },
    };
  }

  private error(line: number, column: number, message: string): void {
    this.errors.push(new TypeCheckError(this.currentFile, line, column, message));
  }

  private currentFile: string = "<input>";

  /** Set the current file name for error reporting */
  setFile(file: string): void {
    this.currentFile = file;
  }
}