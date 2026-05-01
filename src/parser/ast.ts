// Kapy-script AST Node Types
// Phase 1: Complete v0.1 syntax coverage

import { Token, TokenSpan } from "../lexer/token";

// ── Source Spans ──

/** Source span covering a syntactic construct */
export interface Span {
  readonly start: TokenSpan;
  readonly end: TokenSpan;
}

function spanFrom(start: Token, end: Token): Span {
  return { start: start.span, end: end.span };
}

function spanFromSpan(start: TokenSpan, end: TokenSpan): Span {
  return { start, end };
}

// ── Type Annotations ──

export type KapyType =
  | PrimitiveType
  | NamedType
  | ArrayType
  | RecordType
  | GenericType
  | FunctionType
  | UnionType
  | NullableType;

export interface PrimitiveType {
  readonly kind: "PrimitiveType";
  readonly name: "string" | "number" | "boolean" | "any" | "void";
  readonly span: Span;
}

export interface NamedType {
  readonly kind: "NamedType";
  readonly name: string;
  readonly span: Span;
}

export interface ArrayType {
  readonly kind: "ArrayType";
  readonly element_type: KapyType;
  readonly span: Span;
}

export interface RecordType {
  readonly kind: "RecordType";
  readonly fields: ReadonlyArray<{ name: string; type: KapyType; span: Span }>;
  readonly span: Span;
}

export interface GenericType {
  readonly kind: "GenericType";
  readonly name: string;
  readonly type_args: ReadonlyArray<KapyType>;
  readonly span: Span;
}

export interface FunctionType {
  readonly kind: "FunctionType";
  readonly params: ReadonlyArray<KapyType>;
  readonly return_type: KapyType;
  readonly span: Span;
}

export interface UnionType {
  readonly kind: "UnionType";
  readonly types: ReadonlyArray<KapyType>;
  readonly span: Span;
}

export interface NullableType {
  readonly kind: "NullableType";
  readonly inner: KapyType;
  readonly span: Span;
}

// ── Patterns ──

export type Pattern =
  | WildcardPattern
  | IdentifierPattern
  | LiteralPattern
  | DestructurePattern
  | TuplePattern;

export interface WildcardPattern {
  readonly kind: "WildcardPattern";
  readonly span: Span;
}

export interface IdentifierPattern {
  readonly kind: "IdentifierPattern";
  readonly name: string;
  readonly span: Span;
}

export interface LiteralPattern {
  readonly kind: "LiteralPattern";
  readonly value: number | string | boolean;
  readonly span: Span;
}

export interface DestructurePattern {
  readonly kind: "DestructurePattern";
  readonly name: string;
  readonly fields: ReadonlyArray<Pattern>;
  readonly span: Span;
}

export interface TuplePattern {
  readonly kind: "TuplePattern";
  readonly elements: ReadonlyArray<Pattern>;
  readonly span: Span;
}

// ── Expressions ──

export type Expression =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | ArrayLiteral
  | RecordLiteral
  | Identifier
  | InterpolatedString
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | MemberExpr
  | PipelineExpr
  | MatchExpr
  | IfExpr
  | ForExpr
  | WhileExpr
  | ParallelExpr
  | WithExpr
  | LambdaExpr
  | IndexExpr
  | ResultUnwrapExpr
  | CrashUnwrapExpr;

export interface NumberLiteral {
  readonly kind: "NumberLiteral";
  readonly value: number;
  readonly span: Span;
}

export interface StringLiteral {
  readonly kind: "StringLiteral";
  readonly value: string;
  readonly span: Span;
}

export interface BooleanLiteral {
  readonly kind: "BooleanLiteral";
  readonly value: boolean;
  readonly span: Span;
}

export interface ArrayLiteral {
  readonly kind: "ArrayLiteral";
  readonly elements: ReadonlyArray<Expression>;
  readonly span: Span;
}

export interface RecordLiteral {
  readonly kind: "RecordLiteral";
  readonly fields: ReadonlyArray<{ key: string; value: Expression; span: Span }>;
  readonly span: Span;
}

export interface Identifier {
  readonly kind: "Identifier";
  readonly name: string;
  readonly span: Span;
}

export interface InterpolatedString {
  readonly kind: "InterpolatedString";
  readonly parts: ReadonlyArray<{ text: string } | { expr: string }>;
  readonly span: Span;
}

export interface BinaryExpr {
  readonly kind: "BinaryExpr";
  readonly op: "+" | "-" | "*" | "/" | "%" | "==" | "!=" | "<" | ">" | "<=" | ">=" | "&&" | "||";
  readonly left: Expression;
  readonly right: Expression;
  readonly span: Span;
}

export interface UnaryExpr {
  readonly kind: "UnaryExpr";
  readonly op: "!" | "-";
  readonly operand: Expression;
  readonly span: Span;
}

export interface CallExpr {
  readonly kind: "CallExpr";
  readonly callee: Expression;
  readonly args: ReadonlyArray<Expression>;
  readonly span: Span;
}

export interface MemberExpr {
  readonly kind: "MemberExpr";
  readonly object: Expression;
  readonly property: string;
  readonly span: Span;
}

export interface IndexExpr {
  readonly kind: "IndexExpr";
  readonly object: Expression;
  readonly index: Expression;
  readonly span: Span;
}

export interface PipelineExpr {
  readonly kind: "PipelineExpr";
  readonly stages: ReadonlyArray<Expression>;
  readonly span: Span;
}

export interface MatchExpr {
  readonly kind: "MatchExpr";
  readonly subject: Expression;
  readonly cases: ReadonlyArray<MatchCase>;
  readonly span: Span;
}

export interface MatchCase {
  readonly pattern: Pattern;
  readonly guard?: Expression;
  readonly body: Expression | Block;
  readonly span: Span;
}

export interface IfExpr {
  readonly kind: "IfExpr";
  readonly condition: Expression;
  readonly then_branch: Block;
  readonly else_branch?: Block | IfExpr;
  readonly span: Span;
}

export interface ForExpr {
  readonly kind: "ForExpr";
  readonly variable: string;
  readonly iterable: Expression;
  readonly body: Block;
  readonly span: Span;
}

export interface WhileExpr {
  readonly kind: "WhileExpr";
  readonly condition: Expression;
  readonly body: Block;
  readonly span: Span;
}

export interface ParallelExpr {
  readonly kind: "ParallelExpr";
  readonly assignments: ReadonlyArray<{ name: string; value: Expression; span: Span }>;
  readonly span: Span;
}

export interface WithExpr {
  readonly kind: "WithExpr";
  readonly kind_type: "timeout" | "mock_llm" | "mock_embed" | "mock_tool";
  readonly args: ReadonlyArray<Expression>;
  readonly body: Block;
  readonly span: Span;
}

export interface LambdaExpr {
  readonly kind: "LambdaExpr";
  readonly params: ReadonlyArray<{ name: string; type?: KapyType }>;
  readonly body: Expression;
  readonly span: Span;
}

export interface ResultUnwrapExpr {
  readonly kind: "ResultUnwrapExpr";
  readonly expr: Expression;
  readonly span: Span;
}

export interface CrashUnwrapExpr {
  readonly kind: "CrashUnwrapExpr";
  readonly expr: Expression;
  readonly span: Span;
}

// ── Statements ──

export type Statement =
  | ReturnStmt
  | AssignmentStmt
  | ExpressionStmt
  | StepStmt;

export interface ReturnStmt {
  readonly kind: "ReturnStmt";
  readonly value: Expression;
  readonly span: Span;
}

export interface AssignmentStmt {
  readonly kind: "AssignmentStmt";
  readonly name: string;
  readonly mutable: boolean; // true for :=, false for =
  readonly value: Expression;
  readonly span: Span;
}

export interface ExpressionStmt {
  readonly kind: "ExpressionStmt";
  readonly expr: Expression;
  readonly span: Span;
}

export interface StepStmt {
  readonly kind: "StepStmt";
  readonly expr: Expression;
  readonly binding?: string; // the name after ->
  readonly span: Span;
}

// ── Blocks ──

export interface Block {
  readonly kind: "Block";
  readonly statements: ReadonlyArray<Statement>;
  readonly span: Span;
}

// ── Declarations ──

export type Declaration =
  | FnDecl
  | AgentDecl
  | ToolDecl
  | SealedTraitDecl
  | TraitDecl
  | ImplDecl
  | TestDecl
  | ImportDecl;

export interface InputParam {
  readonly name: string;
  readonly type?: KapyType;
  readonly span: Span;
}

export interface FnDecl {
  readonly kind: "FnDecl";
  readonly name: string;
  readonly inputs: ReadonlyArray<InputParam>;
  readonly output_type?: KapyType;
  readonly body: Block | Expression;
  readonly span: Span;
}

export interface AgentDecl {
  readonly kind: "AgentDecl";
  readonly name: string;
  readonly inputs: ReadonlyArray<InputParam>;
  readonly output_type?: KapyType;
  readonly tools: ReadonlyArray<string>;
  readonly steps?: Block;
  readonly body?: Block;
  readonly span: Span;
}

export interface ToolDecl {
  readonly kind: "ToolDecl";
  readonly name: string;
  readonly inputs: ReadonlyArray<InputParam>;
  readonly output_type?: KapyType;
  readonly permissions?: { network?: string; rate_limit?: string };
  readonly body: Block | Expression;
  readonly span: Span;
}

export interface CaseVariant {
  readonly kind: "CaseVariant";
  readonly name: string;
  readonly fields: ReadonlyArray<{ name: string; type?: KapyType; span: Span }>;
  readonly span: Span;
}

export interface SealedTraitDecl {
  readonly kind: "SealedTraitDecl";
  readonly name: string;
  readonly type_params?: ReadonlyArray<string>;
  readonly cases: ReadonlyArray<CaseVariant>;
  readonly span: Span;
}

export interface TraitDecl {
  readonly kind: "TraitDecl";
  readonly name: string;
  readonly methods: ReadonlyArray<FnDecl>;
  readonly span: Span;
}

export interface ImplDecl {
  readonly kind: "ImplDecl";
  readonly trait_name: string;
  readonly for_name: string;
  readonly methods: ReadonlyArray<FnDecl>;
  readonly span: Span;
}

export interface TestDecl {
  readonly kind: "TestDecl";
  readonly name: string;
  readonly body: Block;
  readonly span: Span;
}

export type ImportPath = string[];

export interface ImportDecl {
  readonly kind: "ImportDecl";
  readonly module: ImportPath;
  readonly names?: string[];  // if { a, b } from "x" syntax
  readonly from?: string;     // if from "x" syntax
  readonly span: Span;
}

// ── Program ──

export interface Program {
  readonly kind: "Program";
  readonly declarations: ReadonlyArray<Declaration>;
  readonly span: Span;
  readonly file: string;
}

// ── Utility ──

/** Create a Span from two tokens */
export function span(start: Token, end: Token): Span {
  return spanFrom(start, end);
}

/** Create a Span from two TokenSpans */
export function spanOf(start: TokenSpan, end: TokenSpan): Span {
  return spanFromSpan(start, end);
}

/** Shorthand for creating an Identifier node */
export function ident(name: string, token: Token): Identifier {
  return {
    kind: "Identifier",
    name,
    span: span(token, token),
  };
}