// Kapy-script Parser
// Hand-written recursive descent parser for v0.1 syntax

import { Token, TokenType } from "../lexer/token";
import { ParseError } from "./errors";
import {
  type Expression,
  type Statement,
  type Declaration,
  type KapyType,
  type Pattern,
  type Block,
  type Program,
  type Span,
  type InputParam,
  type MatchCase,
  type CaseVariant,
  // Concrete types
  NumberLiteral,
  StringLiteral,
  BooleanLiteral,
  ArrayLiteral,
  RecordLiteral,
  Identifier,
  InterpolatedString,
  BinaryExpr,
  UnaryExpr,
  CallExpr,
  MemberExpr,
  IndexExpr,
  PipelineExpr,
  MatchExpr,
  IfExpr,
  ForExpr,
  WhileExpr,
  ParallelExpr,
  WithExpr,
  LambdaExpr,
  ResultUnwrapExpr,
  CrashUnwrapExpr,
  ReturnStmt,
  AssignmentStmt,
  ExpressionStmt,
  StepStmt,
  FnDecl,
  AgentDecl,
  ToolDecl,
  SealedTraitDecl,
  TraitDecl,
  ImplDecl,
  TestDecl,
  ImportDecl,
  WildcardPattern,
  IdentifierPattern,
  LiteralPattern,
  DestructurePattern,
  PrimitiveType,
  NamedType,
  ArrayType,
  GenericType,
  span,
  spanOf,
  ident,
} from "./ast";

export class Parser {
  private tokens: Token[];
  private current = 0;
  private file: string;

  constructor(tokens: Token[], file: string = "<input>") {
    this.tokens = tokens;
    this.file = file;
  }

  parse(): Program {
    const decls: Declaration[] = [];
    const startToken = this.peek();

    while (!this.isAtEnd()) {
      try {
        const decl = this.declaration();
        if (decl) decls.push(decl);
      } catch (error) {
        if (error instanceof ParseError) {
          // Report error and synchronize
          this.synchronize();
        } else {
          throw error;
        }
      }
    }

    return {
      kind: "Program",
      declarations: decls,
      span: { start: startToken.span, end: this.previous().span },
      file: this.file,
    };
  }

  // ── Declarations ──

  private declaration(): Declaration | null {
    // Skip newlines between declarations
    while (this.check(TokenType.NEWLINE)) {
      this.advance();
    }

    if (this.isAtEnd()) return null;

    switch (this.peek().type) {
      case TokenType.FN: return this.fnDecl();
      case TokenType.AGENT: return this.agentDecl();
      case TokenType.TOOL: return this.toolDecl();
      case TokenType.SEALED: return this.sealedTraitDecl();
      case TokenType.TRAIT: return this.traitDecl();
      case TokenType.IMPL: return this.implDecl();
      case TokenType.TEST: return this.testDecl();
      case TokenType.IMPORT: return this.importDecl();
      default:
        throw this.error(this.peek(), `Expected declaration, got '${this.peek().lexeme}'.`);
    }
  }

  private fnDecl(): FnDecl {
    const fnToken = this.consume(TokenType.FN, "Expected 'fn'.");
    const name = this.consume(TokenType.IDENTIFIER, "Expected function name.").lexeme;
    this.consumeNewline();
    this.consume(TokenType.INDENT, "Expected indented block after function declaration.");

    const inputs = this.parseInputDecl();
    const outputType = this.parseOutputDecl();
    const body = this.parseFnBodyBlock();

    this.consume(TokenType.DEDENT, "Expected dedent after function body.");

    return {
      kind: "FnDecl",
      name,
      inputs,
      output_type: outputType,
      body,
      span: span(fnToken, this.previous()),
    };
  }

  private parseFnBodyBlock(): Block | Expression {
    // Check for 'steps' keyword
    if (this.check(TokenType.STEPS)) {
      this.advance(); // consume 'steps'
      this.consumeNewline();
      this.consume(TokenType.INDENT, "Expected indented block after 'steps'.");
      const stmts = this.parseStepsBlock();
      this.consume(TokenType.DEDENT, "Expected dedent after steps block.");
      return { kind: "Block", statements: stmts, span: span(this.peek(), this.previous()) };
    }

    // If single expression (no nested block)
    const firstToken = this.peek();

    // Check if the block contains statements (look ahead for assignments/returns)
    // or is just a single expression
    if (!this.check(TokenType.DEDENT)) {
      const stmts = this.parseBlockStatements();
      if (stmts.length === 1 && stmts[0].kind === "ExpressionStmt") {
        return (stmts[0] as any).expr;
      }
      return { kind: "Block", statements: stmts, span: span(firstToken, this.previous()) };
    }

    return { kind: "Block", statements: [], span: span(firstToken, this.previous()) };
  }

  private parseInputDecl(): InputParam[] {
    const inputs: InputParam[] = [];
    if (this.check(TokenType.INPUT)) {
      this.advance();
      // Parse one or more input params
      do {
        const nameToken = this.consume(TokenType.IDENTIFIER, "Expected parameter name.");
        let type: KapyType | undefined;
        if (this.match(TokenType.COLON)) {
          type = this.parseType();
        }
        inputs.push({ name: nameToken.lexeme, type, span: span(nameToken, this.previous()) });
      } while (this.match(TokenType.COMMA));
      this.consumeNewline();
    }
    return inputs;
  }

  private parseOutputDecl(): KapyType | undefined {
    if (this.check(TokenType.OUTPUT)) {
      this.advance();
      const type = this.parseType();
      this.consumeNewline();
      return type;
    }
    return undefined;
  }



  private agentDecl(): AgentDecl {
    const agentToken = this.consume(TokenType.AGENT, "Expected 'agent'.");
    const name = this.consume(TokenType.IDENTIFIER, "Expected agent name.").lexeme;
    this.consumeNewline();

    this.consume(TokenType.INDENT, "Expected indented block after agent declaration.");

    const inputs = this.parseInputDecl();
    const outputType = this.parseOutputDecl();

    // Parse tools block
    let tools: string[] = [];
    if (this.check(TokenType.TOOLS)) {
      this.advance();
      this.consumeNewline();
      this.consume(TokenType.INDENT, "Expected indented tools block.");
      const toolNames: string[] = [];
      while (!this.check(TokenType.DEDENT)) {
        if (this.check(TokenType.NEWLINE)) { this.advance(); continue; }
        toolNames.push(this.consume(TokenType.IDENTIFIER, "Expected tool name.").lexeme);
        this.match(TokenType.COMMA);
      }
      this.consume(TokenType.DEDENT, "Expected dedent after tools block.");
      tools = toolNames;
    }

    // Parse steps or body
    let steps: Block | undefined;
    let body: Block | undefined;

    if (this.check(TokenType.STEPS)) {
      this.advance();
      this.consumeNewline();
      this.consume(TokenType.INDENT, "Expected indented steps block.");
      const stmts = this.parseStepsBlock();
      this.consume(TokenType.DEDENT, "Expected dedent after steps block.");
      steps = { kind: "Block", statements: stmts, span: span(this.peek(), this.previous()) };
    } else {
      // Regular body
      const stmts = this.parseBlockStatements();
      body = { kind: "Block", statements: stmts, span: span(this.peek(), this.previous()) };
    }

    this.consume(TokenType.DEDENT, "Expected dedent after agent body.");

    return {
      kind: "AgentDecl",
      name,
      inputs,
      output_type: outputType,
      tools,
      steps,
      body,
      span: span(agentToken, this.previous()),
    };
  }

  private toolDecl(): ToolDecl {
    const toolToken = this.consume(TokenType.TOOL, "Expected 'tool'.");
    const name = this.consume(TokenType.IDENTIFIER, "Expected tool name.").lexeme;
    this.consumeNewline();

    this.consume(TokenType.INDENT, "Expected indented block after tool declaration.");

    const inputs = this.parseInputDecl();
    const outputType = this.parseOutputDecl();

    // Parse optional permissions block
    let permissions: { network?: string; rate_limit?: string } | undefined;
    if (this.check(TokenType.PERMISSIONS)) {
      this.advance();
      this.consumeNewline();
      this.consume(TokenType.INDENT, "Expected indented permissions block.");
      const permMap: Record<string, string> = {};
      while (!this.check(TokenType.DEDENT)) {
        if (this.check(TokenType.NEWLINE)) { this.advance(); continue; }
        const key = this.consume(TokenType.IDENTIFIER, "Expected permission key.").lexeme;
        this.consume(TokenType.COLON, "Expected ':' after permission key.");
        const value = this.expression();
        // Store as string representation
        if (key === "network" || key === "rate_limit") {
          permMap[key] = value.kind === "Identifier" ? (value as any).name : String(value);
        }
      }
      this.consume(TokenType.DEDENT, "Expected dedent after permissions block.");
      permissions = permMap;
    }

    const stmts = this.parseBlockStatements();
    this.consume(TokenType.DEDENT, "Expected dedent after tool body.");

    return {
      kind: "ToolDecl",
      name,
      inputs,
      output_type: outputType,
      permissions: permissions as any,
      body: { kind: "Block", statements: stmts, span: span(this.peek(), this.previous()) },
      span: span(toolToken, this.previous()),
    };
  }

  private sealedTraitDecl(): SealedTraitDecl {
    const sealedToken = this.consume(TokenType.SEALED, "Expected 'sealed'.");
    this.consume(TokenType.TRAIT, "Expected 'trait' after 'sealed'.");
    const name = this.consume(TokenType.IDENTIFIER, "Expected trait name.").lexeme;

    // Optional type params
    let typeParams: string[] | undefined;
    if (this.match(TokenType.LBRACKET)) {
      typeParams = [];
      do {
        typeParams.push(this.consume(TokenType.IDENTIFIER, "Expected type parameter.").lexeme);
      } while (this.match(TokenType.COMMA));
      this.consume(TokenType.RBRACKET, "Expected ']'");
    }

    this.consumeNewline();
    this.consume(TokenType.INDENT, "Expected indented block after sealed trait.");

    const cases: CaseVariant[] = [];
    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      if (this.check(TokenType.NEWLINE)) { this.advance(); continue; }
      cases.push(this.parseCaseDecl());
    }

    this.consume(TokenType.DEDENT, "Expected dedent after sealed trait.");

    return {
      kind: "SealedTraitDecl",
      name,
      type_params: typeParams,
      cases,
      span: span(sealedToken, this.previous()),
    };
  }

  private parseCaseDecl(): CaseVariant {
    const caseToken = this.consume(TokenType.CASE, "Expected 'case'.");
    const name = this.consume(TokenType.IDENTIFIER, "Expected case name.").lexeme;

    let fields: CaseVariant["fields"] = [];
    if (this.match(TokenType.LPAREN)) {
      do {
        const fieldName = this.consume(TokenType.IDENTIFIER, "Expected field name.").lexeme;
        let type: KapyType | undefined;
        if (this.match(TokenType.COLON)) {
          type = this.parseType();
        }
        fields.push({ name: fieldName, type, span: span(caseToken, this.previous()) });
      } while (this.match(TokenType.COMMA));
      this.consume(TokenType.RPAREN, "Expected ')'");
    }

    this.consumeNewline();

    return {
      kind: "CaseVariant",
      name,
      fields,
      span: span(caseToken, this.previous()),
    };
  }

  private traitDecl(): TraitDecl {
    const traitToken = this.consume(TokenType.TRAIT, "Expected 'trait'.");
    const name = this.consume(TokenType.IDENTIFIER, "Expected trait name.").lexeme;
    this.consumeNewline();
    this.consume(TokenType.INDENT, "Expected indented block after trait.");

    const methods: FnDecl[] = [];
    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      if (this.check(TokenType.NEWLINE)) { this.advance(); continue; }
      if (this.check(TokenType.FN)) {
        methods.push(this.fnDecl());
      } else {
        throw this.error(this.peek(), "Expected 'fn' in trait body.");
      }
    }

    this.consume(TokenType.DEDENT, "Expected dedent after trait body.");

    return {
      kind: "TraitDecl",
      name,
      methods,
      span: span(traitToken, this.previous()),
    };
  }

  private implDecl(): ImplDecl {
    const implToken = this.consume(TokenType.IMPL, "Expected 'impl'.");
    const traitName = this.consume(TokenType.IDENTIFIER, "Expected trait name.").lexeme;
    this.consume(TokenType.FOR, "Expected 'for' after trait name.");
    const forName = this.consume(TokenType.IDENTIFIER, "Expected type name.").lexeme;
    this.consumeNewline();
    this.consume(TokenType.INDENT, "Expected indented block after impl.");

    const methods: FnDecl[] = [];
    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      if (this.check(TokenType.NEWLINE)) { this.advance(); continue; }
      if (this.check(TokenType.FN)) {
        methods.push(this.fnDecl());
      } else {
        throw this.error(this.peek(), "Expected 'fn' in impl body.");
      }
    }

    this.consume(TokenType.DEDENT, "Expected dedent after impl body.");

    return {
      kind: "ImplDecl",
      trait_name: traitName,
      for_name: forName,
      methods,
      span: span(implToken, this.previous()),
    };
  }

  private testDecl(): TestDecl {
    const testToken = this.consume(TokenType.TEST, "Expected 'test'.");
    const name = this.consume(TokenType.STRING, "Expected test name string.").literal as string;
    this.consumeNewline();
    this.consume(TokenType.INDENT, "Expected indented block after test.");

    const stmts = this.parseBlockStatements();
    this.consume(TokenType.DEDENT, "Expected dedent after test body.");

    return {
      kind: "TestDecl",
      name,
      body: { kind: "Block", statements: stmts, span: span(this.peek(), this.previous()) },
      span: span(testToken, this.previous()),
    };
  }

  private importDecl(): ImportDecl {
    const importToken = this.consume(TokenType.IMPORT, "Expected 'import'.");

    // import { a, b } from "module"
    // import module.path
    // import kapy/ai/react

    let module: string[] = [];
    let names: string[] | undefined;
    let from: string | undefined;

    if (this.check(TokenType.LBRACE)) {
      // Named imports: import { a, b } from "module"
      this.advance();
      names = [];
      do {
        names.push(this.consume(TokenType.IDENTIFIER, "Expected import name.").lexeme);
      } while (this.match(TokenType.COMMA));
      this.consume(TokenType.RBRACE, "Expected '}'");
      this.consume(TokenType.FROM, "Expected 'from' after import names.");
      from = this.consume(TokenType.STRING, "Expected module path string.").literal as string;
      module = from.split("/");
    } else {
      // Module path: import kapy/ai/react or import utils.helpers
      const first = this.consume(TokenType.IDENTIFIER, "Expected module name.");
      module.push(first.lexeme);

      // Handle dotted paths and slash paths
      while (true) {
        if (this.check(TokenType.SLASH)) {
          this.advance();
          module.push(this.consume(TokenType.IDENTIFIER, "Expected module segment.").lexeme);
        } else if (this.check(TokenType.DOT)) {
          this.advance();
          module.push(this.consume(TokenType.IDENTIFIER, "Expected module segment.").lexeme);
        } else {
          break;
        }
      }

      // Optional 'from' clause
      if (this.match(TokenType.FROM)) {
        from = this.consume(TokenType.STRING, "Expected module path string.").literal as string;
      }
    }

    this.consumeNewline();

    return {
      kind: "ImportDecl",
      module,
      names,
      from,
      span: span(importToken, this.previous()),
    };
  }

  // ── Statements ──

  private parseBlockStatements(): Statement[] {
    const stmts: Statement[] = [];
    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      if (this.check(TokenType.NEWLINE)) { this.advance(); continue; }
      try {
        const stmt = this.statement();
        if (stmt) stmts.push(stmt);
      } catch (error) {
        if (error instanceof ParseError) {
          this.synchronize();
        } else {
          throw error;
        }
      }
    }
    return stmts;
  }

  private parseStepsBlock(): Statement[] {
    const stmts: Statement[] = [];
    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      if (this.check(TokenType.NEWLINE)) { this.advance(); continue; }
      try {
        const stmt = this.stepStatement();
        if (stmt) stmts.push(stmt);
      } catch (error) {
        if (error instanceof ParseError) {
          this.synchronize();
        } else {
          throw error;
        }
      }
    }
    return stmts;
  }

  private statement(): Statement {
    if (this.check(TokenType.RETURN)) return this.returnStatement();
    return this.expressionOrAssignment();
  }

  private stepStatement(): Statement {
    const expr = this.expression();

    // Check for -> binding
    if (this.match(TokenType.ARROW)) {
      const name = this.consume(TokenType.IDENTIFIER, "Expected binding name after '->'.").lexeme;
      this.consumeNewline();
      return {
        kind: "StepStmt",
        expr,
        binding: name,
        span: span(this.peek(), this.previous()),
      } as StepStmt;
    }

    this.consumeNewline();

    return {
      kind: "ExpressionStmt",
      expr,
      span: span(this.peek(), this.previous()),
    } as ExpressionStmt;
  }

  private returnStatement(): ReturnStmt {
    const returnToken = this.consume(TokenType.RETURN, "Expected 'return'.");
    const value = this.expression();
    this.consumeNewline();
    return {
      kind: "ReturnStmt",
      value,
      span: span(returnToken, this.previous()),
    };
  }

  private expressionOrAssignment(): Statement {
    const expr = this.expression();

    // Check for assignment (= or :=)
    if (this.check(TokenType.ASSIGN)) {
      if (expr.kind !== "Identifier") {
        throw this.error(this.previous(), "Invalid assignment target.");
      }
      this.advance(); // consume =
      const value = this.expression();
      this.consumeNewline();
      return {
        kind: "AssignmentStmt",
        name: (expr as any).name,
        mutable: false,
        value,
        span: span(expr.span.start, this.previous().span),
      } as AssignmentStmt;
    }

    if (this.check(TokenType.MUTABLE)) {
      if (expr.kind !== "Identifier") {
        throw this.error(this.previous(), "Invalid assignment target.");
      }
      this.advance(); // consume :=
      const value = this.expression();
      this.consumeNewline();
      return {
        kind: "AssignmentStmt",
        name: (expr as any).name,
        mutable: true,
        value,
        span: span(expr.span.start, this.previous().span),
      } as AssignmentStmt;
    }

    this.consumeNewline();
    return {
      kind: "ExpressionStmt",
      expr,
      span: expr.span,
    } as ExpressionStmt;
  }

  // ── Expressions ──

  private expression(): Expression {
    return this.pipeline();
  }

  private pipeline(): Expression {
    let expr = this.matchOrIf();

    while (this.match(TokenType.PIPE)) {
      const right = this.matchOrIf();
      // Build pipeline: left |> right
      expr = {
        kind: "PipelineExpr",
        stages: expr.kind === "PipelineExpr" ? [...expr.stages, right] : [expr, right],
        span: spanOf(expr.span.start, right.span.end),
      } as PipelineExpr;
    }

    return expr;
  }

  private matchOrIf(): Expression {
    if (this.check(TokenType.MATCH)) return this.matchExpr();
    if (this.check(TokenType.IF)) return this.ifExpr();
    return this.logicOr();
  }

  private matchExpr(): MatchExpr {
    const matchToken = this.consume(TokenType.MATCH, "Expected 'match'.");
    const subject = this.logicOr();
    this.consumeNewline();
    this.consume(TokenType.INDENT, "Expected indented block after 'match'.");

    const cases: MatchCase[] = [];
    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      if (this.check(TokenType.NEWLINE)) { this.advance(); continue; }
      cases.push(this.parseMatchCase());
    }

    this.consume(TokenType.DEDENT, "Expected dedent after match cases.");

    return {
      kind: "MatchExpr",
      subject,
      cases,
      span: span(matchToken, this.previous()),
    } as MatchExpr;
  }

  private parseMatchCase(): MatchCase {
    const pattern = this.parsePattern();
    this.consume(TokenType.ARROW, "Expected '->' after match pattern.");

    let body: Expression | Block;
    if (this.check(TokenType.NEWLINE)) {
      this.advance();
      this.consume(TokenType.INDENT, "Expected indented block in match case.");
      const stmts = this.parseBlockStatements();
      this.consume(TokenType.DEDENT, "Expected dedent after match case body.");
      body = { kind: "Block", statements: stmts, span: span(this.peek(), this.previous()) };
    } else {
      body = this.expression();
      this.consumeNewline();
    }

    return { pattern, body, span: spanOf(pattern.span.start, this.previous().span.end) };
  }

  private parsePattern(): Pattern {
    // Wildcard
    if (this.check(TokenType.IDENTIFIER) && this.peek().lexeme === "_") {
      const token = this.advance();
      return { kind: "WildcardPattern", span: span(token, token) };
    }

    // Number literal pattern
    if (this.check(TokenType.NUMBER)) {
      const token = this.advance();
      return { kind: "LiteralPattern", value: token.literal as number, span: span(token, token) };
    }

    // String literal pattern
    if (this.check(TokenType.STRING)) {
      const token = this.advance();
      return { kind: "LiteralPattern", value: token.literal as string, span: span(token, token) };
    }

    // Boolean pattern
    if (this.check(TokenType.TRUE) || this.check(TokenType.FALSE)) {
      const token = this.advance();
      return { kind: "LiteralPattern", value: token.literal as boolean, span: span(token, token) };
    }

    // Identifier or destructure
    if (this.check(TokenType.IDENTIFIER)) {
      const nameToken = this.advance();

      // Destructure: Name(a, b, c)
      if (this.match(TokenType.LPAREN)) {
        const fields: Pattern[] = [];
        if (!this.check(TokenType.RPAREN)) {
          do {
            fields.push(this.parsePattern());
          } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, "Expected ')' after destructured fields.");
        return {
          kind: "DestructurePattern",
          name: nameToken.lexeme,
          fields,
          span: span(nameToken, this.previous()),
        };
      }

      return {
        kind: "IdentifierPattern",
        name: nameToken.lexeme,
        span: span(nameToken, nameToken),
      };
    }

    throw this.error(this.peek(), "Expected pattern.");
  }

  private ifExpr(): IfExpr {
    const ifToken = this.consume(TokenType.IF, "Expected 'if'.");
    const condition = this.logicOr();
    this.consumeNewline();
    this.consume(TokenType.INDENT, "Expected indented block after 'if'.");

    const thenStmts = this.parseBlockStatements();
    this.consume(TokenType.DEDENT, "Expected dedent after 'if' body.");

    let elseBranch: Block | IfExpr | undefined;
    if (this.match(TokenType.ELSE)) {
      this.consumeNewline();
      if (this.check(TokenType.IF)) {
        // else if
        elseBranch = this.ifExpr();
      } else {
        this.consume(TokenType.INDENT, "Expected indented block after 'else'.");
        const elseStmts = this.parseBlockStatements();
        this.consume(TokenType.DEDENT, "Expected dedent after 'else' body.");
        elseBranch = { kind: "Block", statements: elseStmts, span: span(this.peek(), this.previous()) };
      }
    }

    return {
      kind: "IfExpr",
      condition,
      then_branch: { kind: "Block", statements: thenStmts, span: span(ifToken, this.previous()) },
      else_branch: elseBranch,
      span: span(ifToken, this.previous()),
    } as IfExpr;
  }

  private logicOr(): Expression {
    let left = this.logicAnd();

    while (this.match(TokenType.OR)) {
      const right = this.logicAnd();
      left = { kind: "BinaryExpr", op: "||", left, right, span: spanOf(left.span.start, right.span.end) } as BinaryExpr;
    }

    return left;
  }

  private logicAnd(): Expression {
    let left = this.comparison();

    while (this.match(TokenType.AND)) {
      const right = this.comparison();
      left = { kind: "BinaryExpr", op: "&&", left, right, span: spanOf(left.span.start, right.span.end) } as BinaryExpr;
    }

    return left;
  }

  private comparison(): Expression {
    let left = this.addition();

    const compOps: Record<string, BinaryExpr["op"]> = {
      [TokenType.EQ]: "==",
      [TokenType.NEQ]: "!=",
      [TokenType.LT]: "<",
      [TokenType.GT]: ">",
      [TokenType.LTE]: "<=",
      [TokenType.GTE]: ">=",
    };

    if (this.peek().type in compOps) {
      const op = compOps[this.advance().type];
      const right = this.addition();
      left = { kind: "BinaryExpr", op, left, right, span: spanOf(left.span.start, right.span.end) } as BinaryExpr;
    }

    return left;
  }

  private addition(): Expression {
    let left = this.multiplication();

    while (this.check(TokenType.PLUS) || this.check(TokenType.MINUS)) {
      const token = this.advance();
      const op = token.type === TokenType.PLUS ? "+" : "-";
      const right = this.multiplication();
      left = { kind: "BinaryExpr", op, left, right, span: spanOf(left.span.start, right.span.end) } as BinaryExpr;
    }

    return left;
  }

  private multiplication(): Expression {
    let left = this.unary();

    while (this.check(TokenType.STAR) || this.check(TokenType.SLASH) || this.check(TokenType.PERCENT)) {
      const token = this.advance();
      const opMap: Record<string, BinaryExpr["op"]> = {
        [TokenType.STAR]: "*",
        [TokenType.SLASH]: "/",
        [TokenType.PERCENT]: "%",
      };
      const op = opMap[token.type];
      const right = this.unary();
      left = { kind: "BinaryExpr", op, left, right, span: spanOf(left.span.start, right.span.end) } as BinaryExpr;
    }

    return left;
  }

  private unary(): Expression {
    if (this.check(TokenType.BANG) || this.check(TokenType.MINUS)) {
      const token = this.advance();
      const op = token.type === TokenType.BANG ? "!" : "-";
      const operand = this.unary();
      return { kind: "UnaryExpr", op, operand, span: span(token, this.previous()) } as UnaryExpr;
    }
    return this.postfix();
  }

  private postfix(): Expression {
    let expr = this.call();

    // Result unwrap: expr?
    if (this.match(TokenType.QUESTION)) {
      expr = { kind: "ResultUnwrapExpr", expr, span: span(expr.span.start, this.previous().span) } as ResultUnwrapExpr;
    }

    // Crash unwrap: expr!
    if (this.check(TokenType.BANG) && !this.checkAhead(TokenType.ASSIGN) && !this.checkAhead(TokenType.EQ)) {
      this.advance();
      expr = { kind: "CrashUnwrapExpr", expr, span: span(expr.span.start, this.previous().span) } as CrashUnwrapExpr;
    }

    return expr;
  }

  private call(): Expression {
    let expr = this.primary();

    while (true) {
      if (this.match(TokenType.LPAREN)) {
        const args = this.parseArguments();
        this.consume(TokenType.RPAREN, "Expected ')' after arguments.");
        expr = { kind: "CallExpr", callee: expr, args, span: span(expr.span.start, this.previous().span) } as CallExpr;
      } else if (this.match(TokenType.DOT)) {
        const name = this.consume(TokenType.IDENTIFIER, "Expected property name after '.'.").lexeme;
        expr = { kind: "MemberExpr", object: expr, property: name, span: span(expr.span.start, this.previous().span) } as MemberExpr;
      } else if (this.match(TokenType.LBRACKET)) {
        const index = this.expression();
        this.consume(TokenType.RBRACKET, "Expected ']' after index.");
        expr = { kind: "IndexExpr", object: expr, index, span: span(expr.span.start, this.previous().span) } as IndexExpr;
      } else {
        break;
      }
    }

    return expr;
  }

  private parseArguments(): Expression[] {
    const args: Expression[] = [];
    if (!this.check(TokenType.RPAREN)) {
      do {
        args.push(this.expression());
      } while (this.match(TokenType.COMMA));
    }
    return args;
  }

  private primary(): Expression {
    // Literals
    if (this.check(TokenType.NUMBER)) {
      const token = this.advance();
      return { kind: "NumberLiteral", value: token.literal as number, span: span(token, token) };
    }

    if (this.check(TokenType.STRING)) {
      const token = this.advance();
      // Check for interpolated string
      if (Array.isArray(token.literal)) {
        return { kind: "InterpolatedString", parts: token.literal, span: span(token, token) } as InterpolatedString;
      }
      return { kind: "StringLiteral", value: token.literal as string, span: span(token, token) };
    }

    if (this.check(TokenType.TRUE)) {
      const token = this.advance();
      return { kind: "BooleanLiteral", value: true, span: span(token, token) };
    }

    if (this.check(TokenType.FALSE)) {
      const token = this.advance();
      return { kind: "BooleanLiteral", value: false, span: span(token, token) };
    }

    // Grouping: (expr)
    if (this.match(TokenType.LPAREN)) {
      const expr = this.expression();
      this.consume(TokenType.RPAREN, "Expected ')' after expression.");
      return expr;
    }

    // Array literal: [1, 2, 3]
    if (this.match(TokenType.LBRACKET)) {
      const elements: Expression[] = [];
      if (!this.check(TokenType.RBRACKET)) {
        do {
          elements.push(this.expression());
        } while (this.match(TokenType.COMMA));
      }
      this.consume(TokenType.RBRACKET, "Expected ']' after array elements.");
      return { kind: "ArrayLiteral", elements, span: span(this.peek(), this.previous()) } as ArrayLiteral;
    }

    // Record literal: { key: value }
    if (this.check(TokenType.LBRACE)) {
      return this.recordLiteral();
    }

    // Lambda: params => body
    if (this.check(TokenType.IDENTIFIER) && this.checkAhead(TokenType.ARROW)) {
      return this.lambdaExpr();
    }

    // Identifier
    if (this.check(TokenType.IDENTIFIER)) {
      const token = this.advance();
      return { kind: "Identifier", name: token.lexeme, span: span(token, token) } as Identifier;
    }

    // Special: think(), llm(), embed()
    if (this.check(TokenType.THINK)) {
      const token = this.advance();
      this.consume(TokenType.LPAREN, "Expected '(' after 'think'.");
      const args = this.parseArguments();
      this.consume(TokenType.RPAREN, "Expected ')' after think arguments.");
      return { kind: "CallExpr", callee: { kind: "Identifier", name: "think", span: span(token, token) } as Identifier, args, span: span(token, this.previous()) } as CallExpr;
    }

    // for expression
    if (this.check(TokenType.FOR)) return this.forExpr();

    // while expression
    if (this.check(TokenType.WHILE)) return this.whileExpr();

    // parallel block
    if (this.check(TokenType.PARALLEL)) return this.parallelExpr();

    // with block
    if (this.check(TokenType.WITH)) return this.withExpr();

    throw this.error(this.peek(), `Expected expression, got '${this.peek().lexeme}'.`);
  }

  private recordLiteral(): Expression {
    const openBrace = this.advance(); // consume {
    const fields: { key: string; value: Expression; span: Span }[] = [];

    if (!this.check(TokenType.RBRACE)) {
      do {
        const key = this.consume(TokenType.IDENTIFIER, "Expected field name.").lexeme;
        this.consume(TokenType.COLON, "Expected ':' after field name.");
        const value = this.expression();
        fields.push({ key, value, span: span(this.peek(), this.previous()) });
      } while (this.match(TokenType.COMMA));
    }

    this.consume(TokenType.RBRACE, "Expected '}' after record fields.");

    return { kind: "RecordLiteral", fields, span: span(openBrace, this.previous()) } as RecordLiteral;
  }

  private lambdaExpr(): Expression {
    const firstParam = this.advance(); // consume first param name
    const params: { name: string; type?: KapyType }[] = [{ name: firstParam.lexeme }];

    // More params with comma
    while (this.match(TokenType.COMMA)) {
      const name = this.consume(TokenType.IDENTIFIER, "Expected parameter name.").lexeme;
      params.push({ name });
    }

    this.consume(TokenType.ARROW, "Expected '->' in lambda.");
    const body = this.expression();

    return {
      kind: "LambdaExpr",
      params,
      body,
      span: span(firstParam, this.previous()),
    } as LambdaExpr;
  }

  private forExpr(): ForExpr {
    const forToken = this.consume(TokenType.FOR, "Expected 'for'.");
    const variable = this.consume(TokenType.IDENTIFIER, "Expected loop variable.").lexeme;
    this.consume(TokenType.IN, "Expected 'in' after loop variable.");
    const iterable = this.expression();
    this.consumeNewline();
    this.consume(TokenType.INDENT, "Expected indented block after 'for'.");

    const stmts = this.parseBlockStatements();
    this.consume(TokenType.DEDENT, "Expected dedent after 'for' body.");

    return {
      kind: "ForExpr",
      variable,
      iterable,
      body: { kind: "Block", statements: stmts, span: span(forToken, this.previous()) },
      span: span(forToken, this.previous()),
    } as ForExpr;
  }

  private whileExpr(): WhileExpr {
    const whileToken = this.consume(TokenType.WHILE, "Expected 'while'.");
    const condition = this.expression();
    this.consumeNewline();
    this.consume(TokenType.INDENT, "Expected indented block after 'while'.");

    const stmts = this.parseBlockStatements();
    this.consume(TokenType.DEDENT, "Expected dedent after 'while' body.");

    return {
      kind: "WhileExpr",
      condition,
      body: { kind: "Block", statements: stmts, span: span(whileToken, this.previous()) },
      span: span(whileToken, this.previous()),
    } as WhileExpr;
  }

  private parallelExpr(): ParallelExpr {
    const parallelToken = this.consume(TokenType.PARALLEL, "Expected 'parallel'.");
    this.consumeNewline();
    this.consume(TokenType.INDENT, "Expected indented block after 'parallel'.");

    const assignments: { name: string; value: Expression; span: Span }[] = [];
    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      if (this.check(TokenType.NEWLINE)) { this.advance(); continue; }
      const value = this.expression();
      this.consume(TokenType.ARROW, "Expected '->' in parallel branch.");
      const name = this.consume(TokenType.IDENTIFIER, "Expected binding name.").lexeme;
      this.consumeNewline();
      assignments.push({ name, value, span: span(this.peek(), this.previous()) });
    }

    this.consume(TokenType.DEDENT, "Expected dedent after 'parallel' body.");

    return {
      kind: "ParallelExpr",
      assignments,
      span: span(parallelToken, this.previous()),
    } as ParallelExpr;
  }

  private withExpr(): WithExpr {
    const withToken = this.consume(TokenType.WITH, "Expected 'with'.");
    let kindType: WithExpr["kind_type"] = "timeout";
    const args: Expression[] = [];

    if (this.check(TokenType.TIMEOUT)) {
      this.advance();
      this.consume(TokenType.LPAREN, "Expected '(' after 'timeout'.");
      args.push(this.expression());
      this.consume(TokenType.RPAREN, "Expected ')' after timeout value.");
      kindType = "timeout";
    } else if (this.check(TokenType.IDENTIFIER) && this.peek().lexeme === "mock_llm") {
      this.advance();
      kindType = "mock_llm";
      // Parse returning <value>
      if (this.check(TokenType.IDENTIFIER) && this.peek().lexeme === "returning") {
        this.advance();
        args.push(this.expression());
      }
    } else if (this.check(TokenType.IDENTIFIER) && this.peek().lexeme === "mock_embed") {
      this.advance();
      kindType = "mock_embed";
      if (this.check(TokenType.IDENTIFIER) && this.peek().lexeme === "returning") {
        this.advance();
        args.push(this.expression());
      }
    } else if (this.check(TokenType.IDENTIFIER) && this.peek().lexeme === "mock_tool") {
      this.advance();
      kindType = "mock_tool";
      // mock_tool <name> returning <value>
      args.push(this.expression());
      if (this.check(TokenType.IDENTIFIER) && this.peek().lexeme === "returning") {
        this.advance();
        args.push(this.expression());
      }
    }

    this.consumeNewline();
    this.consume(TokenType.INDENT, "Expected indented block after 'with'.");

    const stmts = this.parseBlockStatements();
    this.consume(TokenType.DEDENT, "Expected dedent after 'with' body.");

    return {
      kind: "WithExpr",
      kind_type: kindType,
      args,
      body: { kind: "Block", statements: stmts, span: span(withToken, this.previous()) },
      span: span(withToken, this.previous()),
    } as WithExpr;
  }

  // ── Type Parsing ──

  private parseType(): KapyType {
    if (this.check(TokenType.IDENTIFIER)) {
      const nameToken = this.advance();
      const name = nameToken.lexeme;

      // Primitive types
      if (["string", "number", "boolean", "any", "void"].includes(name)) {
        return { kind: "PrimitiveType", name: name as any, span: span(nameToken, nameToken) };
      }

      // Check for generic args: Name[T] or Name[T, E]
      if (this.match(TokenType.LBRACKET)) {
        const typeArgs: KapyType[] = [];
        do {
          typeArgs.push(this.parseType());
        } while (this.match(TokenType.COMMA));
        this.consume(TokenType.RBRACKET, "Expected ']'");
        return { kind: "GenericType", name, type_args: typeArgs, span: span(nameToken, this.previous()) };
      }

      // Check for array type: Type[]
      if (this.match(TokenType.LBRACKET)) {
        this.consume(TokenType.RBRACKET, "Expected ']'");
        return {
          kind: "ArrayType",
          element_type: { kind: "NamedType", name, span: span(nameToken, nameToken) },
          span: span(nameToken, this.previous()),
        };
      }

      return { kind: "NamedType", name, span: span(nameToken, nameToken) };
    }

    // Array type: Type[] (when type is not a simple name)
    const innerType = this.parseType();
    if (this.match(TokenType.LBRACKET) && this.check(TokenType.RBRACKET)) {
      this.advance();
      return { kind: "ArrayType", element_type: innerType, span: span(this.peek(), this.previous()) };
    }

    throw this.error(this.peek(), "Expected type.");
  }

  // ── Helpers ──

  private consumeNewline(): void {
    // Accept either a newline or we're at a dedent (which implies the previous line ended)
    if (this.check(TokenType.NEWLINE)) {
      this.advance();
    }
    // Skip additional newlines
    while (this.check(TokenType.NEWLINE)) {
      this.advance();
    }
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw this.error(this.peek(), message);
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private checkAhead(type: TokenType): boolean {
    if (this.current + 1 >= this.tokens.length) return false;
    return this.tokens[this.current + 1].type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private error(token: Token, message: string): ParseError {
    return new ParseError(token.span.file, token.span.line, token.span.column, message);
  }

  /** Synchronize after a parse error — skip to next resync point */
  private synchronize(): void {
    while (!this.isAtEnd()) {
      // Resync at declaration keywords and structural tokens
      switch (this.peek().type) {
        case TokenType.FN:
        case TokenType.AGENT:
        case TokenType.TOOL:
        case TokenType.TRAIT:
        case TokenType.SEALED:
        case TokenType.IMPL:
        case TokenType.TEST:
        case TokenType.IMPORT:
        case TokenType.DEDENT:
        case TokenType.EOF:
          return;
        default:
          this.advance();
      }
    }
  }
}